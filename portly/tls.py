"""TLS certificate generation with automatic mkcert installation."""

import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen, Request

from portly.config import CERT_DIR, SYSTEM, config, run_cmd


def _cert_paths() -> tuple[Path, Path]:
    """Return (cert_file, key_file) paths."""
    return CERT_DIR / "cert.pem", CERT_DIR / "cert-key.pem"


def _cert_domains() -> list[str]:
    """Build the list of domains/IPs to include in the certificate,
    based on the configured domain suffix."""
    domain = config.get("domain", ".localhost").lstrip(".")
    # e.g. domain = "localhost" → ["localhost", "*.localhost", "127.0.0.1", "::1"]
    # e.g. domain = "test"      → ["test", "*.test", "localhost", "127.0.0.1", "::1"]
    names = [domain, f"*.{domain}"]
    if domain != "localhost":
        names += ["localhost", "*.localhost"]
    names += ["127.0.0.1", "::1"]
    # dedupe while preserving order
    seen = set()
    result = []
    for n in names:
        if n not in seen:
            seen.add(n)
            result.append(n)
    return result


def _find_mkcert() -> str | None:
    """Find mkcert binary, checking common install locations."""
    found = shutil.which("mkcert")
    if found:
        return found
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
            r = subprocess.run(
                ["winget", "install", "FiloSottile.mkcert", "--accept-source-agreements", "--accept-package-agreements"],
                capture_output=True, text=True, timeout=120,
            )
            if r.returncode == 0:
                return _find_mkcert()
        elif SYSTEM == "Darwin":
            if shutil.which("brew"):
                subprocess.run(["brew", "install", "mkcert"], capture_output=True, timeout=120)
                return shutil.which("mkcert")
        elif SYSTEM == "Linux":
            apt = shutil.which("apt-get")
            if apt:
                subprocess.run(["sudo", "apt-get", "install", "-y", "mkcert"],
                               capture_output=True, timeout=120)
                found = shutil.which("mkcert")
                if found:
                    return found
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
    cert_file, key_file = _cert_paths()
    # Also check legacy paths
    legacy_cert = CERT_DIR / "localhost.pem"
    legacy_key = CERT_DIR / "localhost-key.pem"
    if not cert_file.exists() and legacy_cert.exists():
        cert_file, key_file = legacy_cert, legacy_key

    mkcert = _find_mkcert()
    info = {
        "exists": cert_file.exists() and key_file.exists(),
        "cert_path": str(cert_file),
        "key_path": str(key_file),
        "mkcert_installed": mkcert is not None,
        "method": "unknown",
        "expires": None,
        "domains": [],
        "configured_domains": _cert_domains(),
    }

    if not info["exists"]:
        info["method"] = "none"
        return info

    openssl = shutil.which("openssl")
    if openssl:
        try:
            r = run_cmd([openssl, "x509", "-in", str(cert_file), "-noout",
                         "-enddate", "-subject", "-issuer", "-ext", "subjectAltName"])
            text = r.stdout
            for line in text.splitlines():
                if "notAfter" in line:
                    info["expires"] = line.split("=", 1)[1].strip()
                if "DNS:" in line or "IP:" in line:
                    parts = line.strip().split(",")
                    for p in parts:
                        p = p.strip()
                        if p.startswith("DNS:") or p.startswith("IP Address:"):
                            info["domains"].append(p.split(":", 1)[1])
            if "mkcert" in text.lower():
                info["method"] = "mkcert"
            else:
                info["method"] = "self-signed"
        except Exception:
            info["method"] = "unknown"

    return info


def remove_certs() -> dict:
    """Delete existing certificates."""
    removed = []
    for name in ["cert.pem", "cert-key.pem", "localhost.pem", "localhost-key.pem"]:
        p = CERT_DIR / name
        if p.exists():
            p.unlink()
            removed.append(str(p))
    if removed:
        return {"success": True, "message": "Certificates removed. Disable HTTPS or regenerate.", "removed": removed}
    return {"success": True, "message": "No certificates to remove."}


def regenerate_certs() -> dict:
    """Remove old certs and generate new ones."""
    remove_certs()
    return setup_https()


def setup_https() -> dict:
    """Full HTTPS setup: install mkcert if needed, generate trusted certs.
    Uses the configured domain from config."""
    CERT_DIR.mkdir(exist_ok=True)
    cert_file, key_file = _cert_paths()
    domains = _cert_domains()

    mkcert = _find_mkcert()
    if not mkcert:
        mkcert = _install_mkcert()
    if not mkcert:
        return {
            "success": False,
            "method": "none",
            "message": "Could not find or install mkcert. Install it manually: https://github.com/FiloSottile/mkcert",
        }

    print("  Installing mkcert root CA...")
    r = run_cmd([mkcert, "-install"])
    if r.returncode != 0:
        return {
            "success": False,
            "method": "mkcert",
            "message": f"mkcert -install failed: {r.stderr.strip()}",
        }

    cert_file.unlink(missing_ok=True)
    key_file.unlink(missing_ok=True)
    print(f"  Generating trusted certificates for: {', '.join(domains)}")
    r = run_cmd([mkcert, "-cert-file", str(cert_file), "-key-file", str(key_file)] + domains,
                cwd=str(CERT_DIR))
    if cert_file.exists() and key_file.exists():
        return {
            "success": True,
            "method": "mkcert",
            "message": f"Trusted certificates generated for {', '.join(domains)}. Restart portly.",
            "domains": domains,
        }
    return {
        "success": False,
        "method": "mkcert",
        "message": f"Certificate generation failed: {r.stderr.strip()}",
    }


def ensure_certs() -> tuple[Path, Path]:
    """Generate certs if they don't exist. Uses configured domain."""
    CERT_DIR.mkdir(exist_ok=True)
    cert_file, key_file = _cert_paths()

    # Check legacy paths too
    legacy_cert = CERT_DIR / "localhost.pem"
    legacy_key = CERT_DIR / "localhost-key.pem"
    if not cert_file.exists() and legacy_cert.exists():
        return legacy_cert, legacy_key

    if cert_file.exists() and key_file.exists():
        return cert_file, key_file

    domains = _cert_domains()
    base_domain = config.get("domain", ".localhost").lstrip(".")

    mkcert = _find_mkcert()
    if mkcert:
        print(f"  Generating trusted cert via mkcert for *{config.get('domain', '.localhost')}...")
        run_cmd([mkcert, "-install"], cwd=str(CERT_DIR))
        run_cmd([mkcert, "-cert-file", str(cert_file), "-key-file", str(key_file)] + domains,
                cwd=str(CERT_DIR))
        if cert_file.exists():
            return cert_file, key_file

    # Build SAN string from domains
    san_parts = []
    for d in domains:
        if d.replace(".", "").replace(":", "").replace("*", "").isdigit() or ":" in d:
            san_parts.append(f"IP:{d}")
        else:
            san_parts.append(f"DNS:{d}")
    san_string = ",".join(san_parts)

    openssl = shutil.which("openssl")
    if openssl:
        print(f"  Generating self-signed cert via openssl for {base_domain}...")
        run_cmd([
            openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", str(key_file), "-out", str(cert_file),
            "-days", "365",
            "-subj", f"/CN={base_domain}",
            "-addext", f"subjectAltName={san_string}",
        ])
        if cert_file.exists():
            return cert_file, key_file

    print("  Generating self-signed cert via Python...")
    try:
        from ssl import _ssl  # noqa
        dns_names = [d for d in domains if not d.replace(".", "").replace(":", "").isdigit() and ":" not in d and "*" not in d]
        ip_addrs = [d for d in domains if d.replace(".", "").isdigit()]
        script = f"""
import datetime, ipaddress
try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    key = rsa.generate_private_key(65537, 2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "{base_domain}")])
    sans = []
    for d in {dns_names!r}:
        sans.append(x509.DNSName(d))
    for ip in {ip_addrs!r}:
        sans.append(x509.IPAddress(ipaddress.ip_address(ip)))
    cert = (x509.CertificateBuilder()
        .subject_name(name).issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.utcnow())
        .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName(sans), critical=False)
        .sign(key, hashes.SHA256()))
    open(r"{cert_file}", "wb").write(cert.public_bytes(serialization.Encoding.PEM))
    open(r"{key_file}", "wb").write(key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption()))
except ImportError:
    pass
"""
        run_cmd([sys.executable, "-c", script])
    except Exception:
        pass

    return cert_file, key_file
