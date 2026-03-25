"""TLS certificate generation with automatic mkcert installation."""

import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen, Request

from portly.config import CERT_DIR, SYSTEM, run_cmd


def _find_mkcert() -> str | None:
    """Find mkcert binary, checking common install locations."""
    found = shutil.which("mkcert")
    if found:
        return found
    # Check common Windows install paths
    if SYSTEM == "Windows":
        for path in [
            Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / "mkcert.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages",
        ]:
            if path.is_file():
                return str(path)
            if path.is_dir():
                for exe in path.rglob("mkcert.exe"):
                    return str(exe)
    return None


def _install_mkcert() -> str | None:
    """Try to install mkcert automatically. Returns path if successful."""
    print("  Installing mkcert for trusted HTTPS certificates...")
    try:
        if SYSTEM == "Windows":
            # Try winget
            r = subprocess.run(
                ["winget", "install", "FiloSottile.mkcert", "--accept-source-agreements", "--accept-package-agreements"],
                capture_output=True, text=True, timeout=120,
            )
            if r.returncode == 0:
                return _find_mkcert()
        elif SYSTEM == "Darwin":
            # Try brew
            if shutil.which("brew"):
                subprocess.run(["brew", "install", "mkcert"], capture_output=True, timeout=120)
                return shutil.which("mkcert")
        elif SYSTEM == "Linux":
            # Try apt, then direct download
            apt = shutil.which("apt-get")
            if apt:
                subprocess.run(["sudo", "apt-get", "install", "-y", "mkcert"],
                               capture_output=True, timeout=120)
                found = shutil.which("mkcert")
                if found:
                    return found

            # Direct binary download as fallback
            machine = platform.machine().lower()
            if "x86_64" in machine or "amd64" in machine:
                arch = "amd64"
            elif "aarch64" in machine or "arm64" in machine:
                arch = "arm64"
            else:
                return None
            url = f"https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-{arch}"
            dest = Path("/usr/local/bin/mkcert")
            try:
                with urlopen(Request(url, headers={"User-Agent": "portly"}), timeout=30) as resp:
                    tmp = tempfile.NamedTemporaryFile(delete=False)
                    tmp.write(resp.read())
                    tmp.close()
                    os.chmod(tmp.name, 0o755)
                    subprocess.run(["sudo", "mv", tmp.name, str(dest)], capture_output=True)
                    return str(dest) if dest.exists() else None
            except Exception:
                pass
    except Exception as e:
        print(f"  Could not install mkcert: {e}")
    return None


def cert_info() -> dict:
    """Return info about current certificates."""
    cert_file = CERT_DIR / "localhost.pem"
    key_file = CERT_DIR / "localhost-key.pem"
    mkcert = _find_mkcert()

    info = {
        "exists": cert_file.exists() and key_file.exists(),
        "cert_path": str(cert_file),
        "key_path": str(key_file),
        "mkcert_installed": mkcert is not None,
        "method": "unknown",
        "expires": None,
        "domains": [],
    }

    if not info["exists"]:
        info["method"] = "none"
        return info

    # Parse cert for expiry and SANs using openssl
    openssl = shutil.which("openssl")
    if openssl and cert_file.exists():
        try:
            r = run_cmd([openssl, "x509", "-in", str(cert_file), "-noout",
                         "-enddate", "-subject", "-issuer", "-ext", "subjectAltName"])
            text = r.stdout
            # Expiry
            for line in text.splitlines():
                if "notAfter" in line:
                    info["expires"] = line.split("=", 1)[1].strip()
                if "DNS:" in line or "IP:" in line:
                    parts = line.strip().split(",")
                    for p in parts:
                        p = p.strip()
                        if p.startswith("DNS:") or p.startswith("IP Address:"):
                            info["domains"].append(p.split(":", 1)[1])
            # Check if mkcert-issued (issuer contains "mkcert")
            if "mkcert" in text.lower():
                info["method"] = "mkcert"
            else:
                info["method"] = "self-signed"
        except Exception:
            info["method"] = "unknown"

    return info


def remove_certs() -> dict:
    """Delete existing certificates."""
    cert_file = CERT_DIR / "localhost.pem"
    key_file = CERT_DIR / "localhost-key.pem"
    removed = []
    if cert_file.exists():
        cert_file.unlink()
        removed.append(str(cert_file))
    if key_file.exists():
        key_file.unlink()
        removed.append(str(key_file))
    if removed:
        return {"success": True, "message": "Certificates removed. Disable HTTPS or regenerate.", "removed": removed}
    return {"success": True, "message": "No certificates to remove."}


def regenerate_certs() -> dict:
    """Remove old certs and generate new ones."""
    remove_certs()
    return setup_https()


def setup_https() -> dict:
    """Full HTTPS setup: install mkcert if needed, generate trusted certs.
    Returns a status dict for the API."""
    CERT_DIR.mkdir(exist_ok=True)
    cert_file = CERT_DIR / "localhost.pem"
    key_file = CERT_DIR / "localhost-key.pem"

    # Step 1: Find or install mkcert
    mkcert = _find_mkcert()
    if not mkcert:
        mkcert = _install_mkcert()
    if not mkcert:
        return {
            "success": False,
            "method": "none",
            "message": "Could not find or install mkcert. Install it manually: https://github.com/FiloSottile/mkcert",
        }

    # Step 2: Install root CA
    print("  Installing mkcert root CA...")
    r = run_cmd([mkcert, "-install"])
    if r.returncode != 0:
        return {
            "success": False,
            "method": "mkcert",
            "message": f"mkcert -install failed: {r.stderr.strip()}",
        }

    # Step 3: Generate certs (remove old ones first)
    cert_file.unlink(missing_ok=True)
    key_file.unlink(missing_ok=True)
    print("  Generating trusted certificates...")
    r = run_cmd([mkcert,
                 "-cert-file", str(cert_file),
                 "-key-file", str(key_file),
                 "localhost", "*.localhost", "127.0.0.1", "::1"],
                cwd=str(CERT_DIR))
    if cert_file.exists() and key_file.exists():
        return {
            "success": True,
            "method": "mkcert",
            "message": "Trusted HTTPS certificates generated. Restart portly and your browser.",
        }
    return {
        "success": False,
        "method": "mkcert",
        "message": f"Certificate generation failed: {r.stderr.strip()}",
    }


def ensure_certs() -> tuple[Path, Path]:
    """Generate certs for *.localhost if they don't exist."""
    CERT_DIR.mkdir(exist_ok=True)
    cert_file = CERT_DIR / "localhost.pem"
    key_file = CERT_DIR / "localhost-key.pem"

    if cert_file.exists() and key_file.exists():
        return cert_file, key_file

    # Try mkcert first (trusted certs)
    mkcert = _find_mkcert()
    if mkcert:
        print("  Generating trusted cert via mkcert...")
        run_cmd([mkcert, "-install"], cwd=str(CERT_DIR))
        run_cmd([mkcert, "-cert-file", str(cert_file), "-key-file", str(key_file),
                 "localhost", "*.localhost", "127.0.0.1", "::1"], cwd=str(CERT_DIR))
        if cert_file.exists():
            return cert_file, key_file

    # Fallback: openssl self-signed
    openssl = shutil.which("openssl")
    if openssl:
        print("  Generating self-signed cert via openssl (browser will show warning)...")
        run_cmd([
            openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", str(key_file), "-out", str(cert_file),
            "-days", "365",
            "-subj", "/CN=localhost",
            "-addext", "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1",
        ])
        if cert_file.exists():
            return cert_file, key_file

    # Last resort: Python stdlib
    print("  Generating self-signed cert via Python...")
    try:
        from ssl import _ssl  # noqa
        script = f"""
import ssl, datetime
try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    key = rsa.generate_private_key(65537, 2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    cert = (x509.CertificateBuilder()
        .subject_name(name).issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.utcnow())
        .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName([
            x509.DNSName("localhost"), x509.DNSName("*.localhost"),
            x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
        ]), critical=False)
        .sign(key, hashes.SHA256()))
    open(r"{cert_file}", "wb").write(cert.public_bytes(serialization.Encoding.PEM))
    open(r"{key_file}", "wb").write(key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption()))
except ImportError:
    pass
"""
        run_cmd([sys.executable, "-c", f"import ipaddress\n{script}"])
    except Exception:
        pass

    return cert_file, key_file
