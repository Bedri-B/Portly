"""
docker-global: Portless reverse proxy + port management for local and Docker services.

Maps human-readable URLs like https://myapp.localhost to localhost:port.
Auto-discovers Docker container ports. Supports static aliases for any local service.
"""

import subprocess
import threading
import json
import os
import sys
import platform
import time
import ssl
import socket
import webbrowser
import http.client
import shutil
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

# ── Platform ─────────────────────────────────────────────────────────────────
SYSTEM = platform.system()

_SUBPROCESS_FLAGS = {}
if SYSTEM == "Windows":
    _SUBPROCESS_FLAGS["creationflags"] = 0x08000000  # CREATE_NO_WINDOW

# ── Paths ────────────────────────────────────────────────────────────────────
if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent
    STATIC_DIR = Path(sys._MEIPASS) / "web"  # type: ignore[attr-defined]
else:
    APP_DIR = Path(__file__).resolve().parent
    STATIC_DIR = APP_DIR / "web" / "dist"

CONFIG_PATH = APP_DIR / "config.json"
CERT_DIR = APP_DIR / "certs"

# ── Config ───────────────────────────────────────────────────────────────────
DEFAULT_CONFIG = {
    "proxy_port": 80,
    "https_port": 443,
    "api_port": 19800,
    "web_port": 19802,
    "domain": ".localhost",
    "https_enabled": True,
    "docker_discovery": True,
    "aliases": {},
    "scan_ports": [],
}


def load_config() -> dict:
    cfg = dict(DEFAULT_CONFIG)
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, encoding="utf-8") as f:
                cfg.update(json.load(f))
        except Exception:
            pass
    return cfg


def save_config(cfg: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


config = load_config()
if not CONFIG_PATH.exists():
    save_config(config)


# ── Subprocess helper ────────────────────────────────────────────────────────
def _run(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=30, **_SUBPROCESS_FLAGS, **kwargs)


# ── TLS Certificate Generation ───────────────────────────────────────────────
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
        _run([mkcert, "-install"], cwd=str(CERT_DIR))
        _run([mkcert, "-cert-file", str(cert_file), "-key-file", str(key_file),
              "localhost", "*.localhost", "127.0.0.1", "::1"], cwd=str(CERT_DIR))
        if cert_file.exists():
            return cert_file, key_file

    # Fallback: openssl self-signed
    openssl = shutil.which("openssl")
    if openssl:
        print("  Generating self-signed cert via openssl...")
        _run([
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
        # Use subprocess to run a tiny Python script that generates the cert
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
    # No cryptography lib — write a placeholder
    pass
"""
        _run([sys.executable, "-c", f"import ipaddress\n{script}"])
    except Exception:
        pass

    return cert_file, key_file


# ── Port Probing ─────────────────────────────────────────────────────────────
def _port_is_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.3):
            return True
    except (OSError, ConnectionRefusedError):
        return False


# ── Docker Container Discovery (read-only) ──────────────────────────────────
def discover_docker_ports() -> dict[str, dict]:
    """Find all running Docker containers with published ports."""
    routes = {}
    if not config.get("docker_discovery", True):
        return routes
    try:
        r = _run(["docker", "ps", "--format", "json"])
        if r.returncode != 0:
            return routes
        for line in r.stdout.strip().splitlines():
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
                name = obj.get("Names", obj.get("name", ""))
                ports_str = obj.get("Ports", "")
                image = obj.get("Image", "")
                state = obj.get("State", "running")
                # Parse ports like "0.0.0.0:5435->5432/tcp"
                for chunk in ports_str.split(","):
                    chunk = chunk.strip()
                    if "->" in chunk and ":" in chunk:
                        host_part = chunk.split("->")[0]
                        port_str = host_part.rsplit(":", 1)[-1]
                        try:
                            pub_port = int(port_str)
                            if pub_port > 0:
                                routes[name] = {
                                    "port": pub_port,
                                    "image": image,
                                    "state": state,
                                    "source": "docker",
                                }
                                break
                        except ValueError:
                            continue
            except json.JSONDecodeError:
                continue
    except Exception:
        pass
    return routes


# ── Route Registry ───────────────────────────────────────────────────────────
class RouteRegistry:
    def __init__(self):
        self.routes: dict[str, dict] = {}
        self._lock = threading.Lock()

    def refresh(self):
        new_routes = {}

        # 1. Docker containers
        for name, info in discover_docker_ports().items():
            new_routes[name] = info

        # 2. Static aliases
        for name, port in config.get("aliases", {}).items():
            alive = _port_is_open(port)
            new_routes[name] = {
                "port": port,
                "image": "",
                "state": "running" if alive else "stopped",
                "source": "alias",
            }

        # 3. Auto-scanned ports
        for port in config.get("scan_ports", []):
            already = any(r["port"] == port for r in new_routes.values())
            if already:
                continue
            if _port_is_open(port):
                new_routes[f"port-{port}"] = {
                    "port": port,
                    "image": "",
                    "state": "running",
                    "source": "scan",
                }

        with self._lock:
            self.routes = new_routes

    def lookup(self, hostname: str) -> int | None:
        with self._lock:
            if hostname in self.routes:
                return self.routes[hostname]["port"]
            norm = hostname.replace("-", "_")
            if norm in self.routes:
                return self.routes[norm]["port"]
            # prefix match
            for name in self.routes:
                if name.endswith(f"_{hostname}") or name.endswith(f"-{hostname}"):
                    return self.routes[name]["port"]
            return None

    def _url(self, name: str, https: bool = False) -> str:
        domain = config["domain"]
        scheme = "https" if https else "http"
        port = config["https_port"] if https else config["proxy_port"]
        default_port = 443 if https else 80
        base = f"{scheme}://{name}{domain}"
        if port != default_port:
            base += f":{port}"
        return base

    def all_services(self) -> list[dict]:
        https_on = config.get("https_enabled", False)
        with self._lock:
            return [
                {
                    "name": name,
                    "url": self._url(name, https=https_on),
                    "http_url": self._url(name, https=False),
                    "https_url": self._url(name, https=True) if https_on else None,
                    "direct": f"http://localhost:{info['port']}",
                    "port": info["port"],
                    "image": info.get("image", ""),
                    "state": info["state"],
                    "source": info.get("source", "unknown"),
                }
                for name, info in sorted(self.routes.items())
            ]


registry = RouteRegistry()


def _refresh_loop():
    while True:
        try:
            registry.refresh()
        except Exception:
            pass
        time.sleep(10)


# ── Reverse Proxy ────────────────────────────────────────────────────────────
class ProxyHandler(BaseHTTPRequestHandler):
    def _target_port(self) -> int | None:
        host = self.headers.get("Host", "").split(":")[0]
        domain = config["domain"]
        if host in ("localhost", "127.0.0.1", ""):
            return None
        name = host[: -len(domain)] if host.endswith(domain) else host
        return registry.lookup(name)

    def _proxy(self, body: bytes = b""):
        port = self._target_port()
        if port is None:
            self._fallback()
            return
        try:
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
            conn.request(self.command, self.path, body=body or None,
                         headers={k: v for k, v in self.headers.items()})
            resp = conn.getresponse()
            data = resp.read()
            self.send_response(resp.status)
            for h, v in resp.getheaders():
                if h.lower() not in ("transfer-encoding", "connection"):
                    self.send_header(h, v)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            conn.close()
        except Exception as e:
            msg = f"Proxy error: {e}".encode()
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def _fallback(self):
        body = json.dumps({
            "services": registry.all_services(),
            "dashboard": f"http://localhost:{config['web_port']}",
        }, indent=2).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self): self._proxy()
    def do_POST(self): self._proxy(self._read())
    def do_PUT(self): self._proxy(self._read())
    def do_DELETE(self): self._proxy()
    def do_PATCH(self): self._proxy(self._read())
    def do_HEAD(self): self._proxy()
    def do_OPTIONS(self):
        self.send_response(200)
        for h, v in [("Access-Control-Allow-Origin", "*"),
                     ("Access-Control-Allow-Methods", "*"),
                     ("Access-Control-Allow-Headers", "*")]:
            self.send_header(h, v)
        self.end_headers()

    def _read(self):
        n = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(n) if n else b""

    def log_message(self, *a): pass


# ── REST API ─────────────────────────────────────────────────────────────────
class APIHandler(BaseHTTPRequestHandler):
    def _json(self, data, status=200):
        body = json.dumps(data, indent=2, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _err(self, msg, status=400):
        self._json({"error": msg}, status)

    def _body(self):
        n = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(n).decode() if n else ""

    def do_OPTIONS(self):
        self.send_response(200)
        for h, v in [("Access-Control-Allow-Origin", "*"),
                     ("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"),
                     ("Access-Control-Allow-Headers", "Content-Type")]:
            self.send_header(h, v)
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/")

        if path == "/api/status":
            self._json({
                "services": registry.all_services(),
                "config": {k: v for k, v in config.items() if k != "aliases"},
                "aliases": config.get("aliases", {}),
                "scan_ports": config.get("scan_ports", []),
            })
        elif path == "/api/services":
            self._json({"services": registry.all_services()})
        elif path == "/api/aliases":
            self._json({"aliases": config.get("aliases", {})})
        elif path == "/api/config":
            self._json({"config": config})
        else:
            self._err("Not found", 404)

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")

        if path == "/api/aliases":
            try:
                data = json.loads(self._body())
                name, port = data["name"], int(data["port"])
                aliases = config.get("aliases", {})
                aliases[name] = port
                config["aliases"] = aliases
                save_config(config)
                registry.refresh()
                self._json({"message": f"Alias '{name}' -> localhost:{port}", "aliases": aliases})
            except (KeyError, ValueError) as e:
                self._err(f"Need 'name' (str) and 'port' (int): {e}")
        elif path == "/api/refresh":
            registry.refresh()
            self._json({"message": "Refreshed", "services": registry.all_services()})
        elif path == "/api/scan-ports":
            try:
                data = json.loads(self._body())
                config["scan_ports"] = [int(p) for p in data.get("ports", [])]
                save_config(config)
                registry.refresh()
                self._json({"message": "Scan ports updated", "scan_ports": config["scan_ports"]})
            except Exception as e:
                self._err(str(e))
        else:
            self._err("Not found", 404)

    def do_PUT(self):
        path = urlparse(self.path).path.rstrip("/")

        if path == "/api/config":
            try:
                new = json.loads(self._body())
                allowed = {"proxy_port", "https_port", "domain", "api_port", "web_port",
                           "https_enabled", "docker_discovery", "aliases", "scan_ports"}
                for k, v in new.items():
                    if k in allowed:
                        config[k] = v
                save_config(config)
                registry.refresh()
                self._json({"message": "Config saved. Restart for port changes.", "config": config})
            except Exception as e:
                self._err(str(e))
        else:
            self._err("Not found", 404)

    def do_DELETE(self):
        path = urlparse(self.path).path.rstrip("/")

        if path.startswith("/api/aliases/"):
            name = path.split("/")[-1]
            aliases = config.get("aliases", {})
            if name in aliases:
                del aliases[name]
                config["aliases"] = aliases
                save_config(config)
                registry.refresh()
                self._json({"message": f"Removed '{name}'", "aliases": aliases})
            else:
                self._err(f"'{name}' not found", 404)
        else:
            self._err("Not found", 404)

    def log_message(self, *a): pass


# ── Static File Server ───────────────────────────────────────────────────────
MIME = {
    ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
    ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
    ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
    ".ttf": "font/ttf", ".map": "application/json",
}


class WebHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            path = "/index.html"
        fp = STATIC_DIR / path.lstrip("/")
        if fp.is_file():
            self._file(fp)
        else:
            idx = STATIC_DIR / "index.html"
            if idx.is_file():
                self._file(idx)
            else:
                msg = b"Dashboard not built. Run: cd web && npm run build"
                self.send_response(503)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Content-Length", str(len(msg)))
                self.end_headers()
                self.wfile.write(msg)

    def _file(self, fp):
        data = fp.read_bytes()
        mime = MIME.get(fp.suffix.lower(), "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a): pass


# ── Server Launchers ─────────────────────────────────────────────────────────
def _serve(port, handler, name, ssl_ctx=None):
    try:
        server = HTTPServer(("0.0.0.0", port), handler)
        if ssl_ctx:
            server.socket = ssl_ctx.wrap_socket(server.socket, server_side=True)
        print(f"  {name:16s}  {'https' if ssl_ctx else 'http'}://localhost:{port}")
        server.serve_forever()
    except OSError as e:
        if e.errno in (10013, 13, 98, 10048):
            print(f"  {name:16s}  FAILED on :{port} — {e}")
            if "Proxy" in name and port in (80, 443):
                fb = 19801 if port == 80 else 19444
                print(f"  {name:16s}  Falling back to :{fb}")
                if "HTTPS" in name:
                    config["https_port"] = fb
                else:
                    config["proxy_port"] = fb
                server = HTTPServer(("0.0.0.0", fb), handler)
                if ssl_ctx:
                    server.socket = ssl_ctx.wrap_socket(server.socket, server_side=True)
                print(f"  {name:16s}  {'https' if ssl_ctx else 'http'}://localhost:{fb}")
                server.serve_forever()
        else:
            raise


# ── Service Install ──────────────────────────────────────────────────────────
SERVICE_NAME = "docker-global"


def _exe_path():
    if getattr(sys, "frozen", False):
        return str(Path(sys.executable).resolve())
    return f'"{sys.executable}" "{Path(__file__).resolve()}"'


def service_install():
    exe = _exe_path()
    if SYSTEM == "Windows":
        nssm = shutil.which("nssm")
        if nssm:
            print(f"Installing '{SERVICE_NAME}' via nssm...")
            _run([nssm, "install", SERVICE_NAME, exe])
            _run([nssm, "set", SERVICE_NAME, "DisplayName", "Docker Global"])
            _run([nssm, "set", SERVICE_NAME, "Start", "SERVICE_AUTO_START"])
            _run([nssm, "set", SERVICE_NAME, "AppStdout", str(APP_DIR / "service.log")])
            _run([nssm, "set", SERVICE_NAME, "AppStderr", str(APP_DIR / "service.log")])
            _run([nssm, "start", SERVICE_NAME])
            print("Installed and started.")
        else:
            print("Install nssm first: winget install nssm")
    elif SYSTEM == "Linux":
        unit = f"[Unit]\nDescription=Docker Global\nAfter=network.target\n\n[Service]\nExecStart={exe}\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n"
        Path(f"/etc/systemd/system/{SERVICE_NAME}.service").write_text(unit)
        _run(["systemctl", "daemon-reload"])
        _run(["systemctl", "enable", "--now", SERVICE_NAME])
        print("Installed and started.")
    elif SYSTEM == "Darwin":
        plist = f'<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.docker-global</string><key>ProgramArguments</key><array><string>{exe}</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/></dict></plist>'
        p = Path.home() / "Library/LaunchAgents/com.docker-global.plist"
        p.write_text(plist)
        _run(["launchctl", "load", str(p)])
        print("Installed and started.")


def service_uninstall():
    if SYSTEM == "Windows":
        nssm = shutil.which("nssm")
        if nssm:
            _run([nssm, "stop", SERVICE_NAME])
            _run([nssm, "remove", SERVICE_NAME, "confirm"])
        else:
            _run(["sc", "stop", SERVICE_NAME])
            _run(["sc", "delete", SERVICE_NAME])
    elif SYSTEM == "Linux":
        _run(["systemctl", "disable", "--now", SERVICE_NAME])
        Path(f"/etc/systemd/system/{SERVICE_NAME}.service").unlink(missing_ok=True)
        _run(["systemctl", "daemon-reload"])
    elif SYSTEM == "Darwin":
        p = Path.home() / "Library/LaunchAgents/com.docker-global.plist"
        _run(["launchctl", "unload", str(p)])
        p.unlink(missing_ok=True)
    print(f"Service '{SERVICE_NAME}' removed.")


# ── Server Start ─────────────────────────────────────────────────────────────
def run_server():
    domain = config["domain"]
    proxy_port = config["proxy_port"]
    ps = f":{proxy_port}" if proxy_port != 80 else ""

    print(f"\n  docker-global")
    print(f"  Domain: *{domain}{ps}")
    print(f"  Config: {CONFIG_PATH}\n")

    threads = [
        threading.Thread(target=_serve, args=(config["api_port"], APIHandler, "API"), daemon=True),
        threading.Thread(target=_serve, args=(proxy_port, ProxyHandler, "HTTP Proxy"), daemon=True),
        threading.Thread(target=_serve, args=(config["web_port"], WebHandler, "Dashboard"), daemon=True),
        threading.Thread(target=_refresh_loop, daemon=True),
    ]

    # HTTPS proxy
    if config.get("https_enabled"):
        cert, key = ensure_certs()
        if cert.exists() and key.exists():
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(str(cert), str(key))
            threads.append(threading.Thread(
                target=_serve,
                args=(config["https_port"], ProxyHandler, "HTTPS Proxy", ctx),
                daemon=True,
            ))

    for t in threads:
        t.start()

    registry.refresh()
    print()
    return config["web_port"]


# ── CLI ──────────────────────────────────────────────────────────────────────
def cli_alias(args):
    if len(args) < 1:
        print("Usage:")
        print("  docker-global alias <name> <port>")
        print("  docker-global alias <name> --remove")
        return
    name = args[0]
    if len(args) > 1 and args[1] in ("--remove", "-r", "remove"):
        aliases = config.get("aliases", {})
        if name in aliases:
            del aliases[name]
            config["aliases"] = aliases
            save_config(config)
            print(f"Removed '{name}'")
        else:
            print(f"'{name}' not found")
    elif len(args) > 1:
        try:
            port = int(args[1])
        except ValueError:
            print(f"Invalid port: {args[1]}"); return
        aliases = config.get("aliases", {})
        aliases[name] = port
        config["aliases"] = aliases
        save_config(config)
        domain = config["domain"]
        ps = f":{config['proxy_port']}" if config["proxy_port"] != 80 else ""
        print(f"  {name} -> localhost:{port}")
        print(f"  http://{name}{domain}{ps}")
    else:
        aliases = config.get("aliases", {})
        if name in aliases:
            port = aliases[name]
            alive = _port_is_open(port)
            print(f"  {name} -> localhost:{port}  ({'up' if alive else 'down'})")
        else:
            print(f"'{name}' not found")


def cli_aliases():
    aliases = config.get("aliases", {})
    if not aliases:
        print("No aliases. Add one: docker-global alias myapp 3000"); return
    domain = config["domain"]
    ps = f":{config['proxy_port']}" if config["proxy_port"] != 80 else ""
    print(f"{'Name':<20} {'Port':<8} {'URL':<40} {'Status'}")
    print("-" * 80)
    for name, port in sorted(aliases.items()):
        alive = _port_is_open(port)
        url = f"http://{name}{domain}{ps}"
        st = "\033[32mup\033[0m" if alive else "\033[31mdown\033[0m"
        print(f"{name:<20} {port:<8} {url:<40} {st}")


def main():
    args = sys.argv[1:]
    if not args:
        wp = run_server()
        webbrowser.open(f"http://localhost:{wp}")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down.")
        return

    cmd = args[0]
    if cmd in ("alias",):
        cli_alias(args[1:])
    elif cmd in ("aliases", "list"):
        cli_aliases()
    elif cmd in ("install",):
        service_install()
    elif cmd in ("uninstall",):
        service_uninstall()
    elif cmd == "--no-browser":
        run_server()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down.")
    elif cmd in ("help", "-h", "--help"):
        print("""docker-global — Portless reverse proxy for local & Docker services

Usage:
  docker-global                          Start proxy + dashboard
  docker-global --no-browser             Start without opening browser

  docker-global alias <name> <port>      Map name.localhost -> localhost:port
  docker-global alias <name> --remove    Remove alias
  docker-global aliases                  List all aliases

  docker-global install                  Install as system service
  docker-global uninstall                Remove system service
""")
    else:
        print(f"Unknown: {cmd}. Run 'docker-global help'.")


if __name__ == "__main__":
    main()
