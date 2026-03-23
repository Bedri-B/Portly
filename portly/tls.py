"""TLS certificate generation."""

import shutil
import sys
from pathlib import Path

from portly.config import CERT_DIR, run_cmd


def ensure_certs() -> tuple[Path, Path]:
    """Generate a self-signed cert for *.localhost if it doesn't exist."""
    CERT_DIR.mkdir(exist_ok=True)
    cert_file = CERT_DIR / "localhost.pem"
    key_file = CERT_DIR / "localhost-key.pem"

    if cert_file.exists() and key_file.exists():
        return cert_file, key_file

    # Try mkcert first (trusted certs)
    mkcert = shutil.which("mkcert")
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
        print("  Generating self-signed cert via openssl...")
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
