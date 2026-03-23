"""
docker-global: Headless server — API + reverse proxy + static file server for React dashboard.

No desktop GUI. Launches a browser to the web dashboard on start.
"""

import subprocess
import threading
import json
import os
import sys
import platform
import time
import webbrowser
import http.client
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

# ── Platform ─────────────────────────────────────────────────────────────────
SYSTEM = platform.system()

_SUBPROCESS_FLAGS = {}
if SYSTEM == "Windows":
    _SUBPROCESS_FLAGS["creationflags"] = 0x08000000  # CREATE_NO_WINDOW

# ── Resolve paths ────────────────────────────────────────────────────────────
if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent
    GLOBAL_ROOT = APP_DIR.parent.parent / "docker"
    STATIC_DIR = Path(sys._MEIPASS) / "web"  # type: ignore[attr-defined]
else:
    APP_DIR = Path(__file__).resolve().parent
    GLOBAL_ROOT = APP_DIR.parent / "docker"
    STATIC_DIR = APP_DIR / "web" / "dist"

CONFIG_PATH = APP_DIR / "config.json"

# ── Config (user-customizable) ──────────────────────────────────────────────
DEFAULT_CONFIG = {
    "api_port": 19800,
    "proxy_port": 80,
    "web_port": 19802,
    "domain": ".localhost",
}


def load_config() -> dict:
    cfg = dict(DEFAULT_CONFIG)
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, encoding="utf-8") as f:
                user = json.load(f)
            cfg.update(user)
        except Exception:
            pass
    return cfg


def save_config(cfg: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


config = load_config()

# Write defaults if no config file exists yet
if not CONFIG_PATH.exists():
    save_config(config)


# ── Subprocess helpers ───────────────────────────────────────────────────────
def _run(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=120, **_SUBPROCESS_FLAGS, **kwargs)


def _popen(cmd, **kwargs):
    return subprocess.Popen(cmd, **_SUBPROCESS_FLAGS, **kwargs)


# ── Docker Desktop Control ───────────────────────────────────────────────────
class DockerDesktop:
    @staticmethod
    def is_running() -> bool:
        try:
            return _run(["docker", "info"]).returncode == 0
        except Exception:
            return False

    @staticmethod
    def start():
        if SYSTEM == "Windows":
            for p in [
                Path(os.environ.get("ProgramFiles", "")) / "Docker" / "Docker" / "Docker Desktop.exe",
                Path(os.environ.get("LOCALAPPDATA", "")) / "Docker" / "Docker Desktop.exe",
            ]:
                if p.exists():
                    subprocess.Popen([str(p)], creationflags=0x00000008)
                    return "Starting Docker Desktop..."
            return "Docker Desktop not found."
        elif SYSTEM == "Darwin":
            subprocess.Popen(["open", "-a", "Docker"])
            return "Starting Docker Desktop..."
        else:
            subprocess.Popen(["systemctl", "--user", "start", "docker-desktop"])
            return "Starting Docker Desktop..."

    @staticmethod
    def stop():
        if SYSTEM == "Windows":
            _run(["taskkill", "/IM", "Docker Desktop.exe", "/F"])
        elif SYSTEM == "Darwin":
            _run(["osascript", "-e", 'quit app "Docker"'])
        else:
            _run(["systemctl", "--user", "stop", "docker-desktop"])
        return "Stopping Docker Desktop..."

    @staticmethod
    def restart():
        DockerDesktop.stop()
        time.sleep(3)
        return DockerDesktop.start()


# ── Stack Discovery & Control ────────────────────────────────────────────────
def discover_stacks(root: Path) -> list[dict]:
    stacks = []
    if not root.exists():
        return stacks
    for path in sorted(root.rglob("docker-compose.y*ml")):
        if "docker-global" in path.parts:
            continue
        rel = path.parent.relative_to(root)
        name = str(rel).replace("\\", "/") if str(rel) != "." else "root"
        env_file = path.parent / ".env"
        stacks.append({
            "name": name,
            "compose_file": path,
            "dir": path.parent,
            "env_file": env_file if env_file.exists() else None,
        })
    return stacks


def run_compose(stack_dir: Path, *args):
    return _run(["docker", "compose"] + list(args), cwd=str(stack_dir))


def get_container_status(stack_dir: Path) -> list[dict]:
    try:
        r = run_compose(stack_dir, "ps", "--format", "json", "-a")
        if r.returncode != 0:
            return []
        containers = []
        for line in r.stdout.strip().splitlines():
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
                containers.append({
                    "name": obj.get("Name", obj.get("name", "?")),
                    "state": obj.get("State", obj.get("state", "unknown")),
                    "status": obj.get("Status", obj.get("status", "")),
                    "image": obj.get("Image", obj.get("image", "")),
                    "ports": obj.get("Publishers", obj.get("Ports", [])),
                })
            except json.JSONDecodeError:
                continue
        return containers
    except Exception:
        return []


# ── Route Registry (Portless) ────────────────────────────────────────────────
class RouteRegistry:
    def __init__(self):
        self.routes: dict[str, dict] = {}
        self._lock = threading.Lock()

    def refresh(self):
        new_routes = {}
        for stack in discover_stacks(GLOBAL_ROOT):
            for c in get_container_status(stack["dir"]):
                ports = c.get("ports", [])
                pub_port = None
                for p in (ports if isinstance(ports, list) else []):
                    port = p.get("PublishedPort", p.get("published_port", 0))
                    if port and port > 0:
                        pub_port = port
                        break
                if pub_port:
                    new_routes[c["name"]] = {
                        "port": pub_port,
                        "stack": stack["name"],
                        "image": c.get("image", ""),
                        "state": c["state"],
                    }
        with self._lock:
            self.routes = new_routes

    def lookup(self, hostname: str) -> int | None:
        with self._lock:
            if hostname in self.routes:
                return self.routes[hostname]["port"]
            normalized = hostname.replace("-", "_")
            if normalized in self.routes:
                return self.routes[normalized]["port"]
            for name in self.routes:
                if name.endswith(f"_{hostname}") or name.endswith(f"-{hostname}"):
                    return self.routes[name]["port"]
            return None

    def _service_url(self, name: str) -> str:
        domain = config["domain"]
        proxy_port = config["proxy_port"]
        base = f"http://{name}{domain}"
        if proxy_port != 80:
            base += f":{proxy_port}"
        return base

    def all_services(self) -> list[dict]:
        with self._lock:
            return [
                {
                    "name": name,
                    "url": self._service_url(name),
                    "direct": f"http://localhost:{info['port']}",
                    "port": info["port"],
                    "stack": info["stack"],
                    "image": info["image"],
                    "state": info["state"],
                }
                for name, info in sorted(self.routes.items())
            ]


route_registry = RouteRegistry()


def _registry_refresh_loop():
    while True:
        try:
            route_registry.refresh()
        except Exception:
            pass
        time.sleep(15)


# ── Reverse Proxy ────────────────────────────────────────────────────────────
class ProxyHandler(BaseHTTPRequestHandler):
    def _get_target_port(self) -> int | None:
        host = self.headers.get("Host", "").split(":")[0]
        domain = config["domain"]
        if host in ("localhost", "127.0.0.1", ""):
            return None
        if host.endswith(domain):
            service_name = host[: -len(domain)]
        else:
            service_name = host
        return route_registry.lookup(service_name)

    def _proxy(self, body: bytes = b""):
        port = self._get_target_port()
        if port is None:
            self._send_fallback()
            return
        try:
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
            conn.request(self.command, self.path, body=body or None,
                         headers={k: v for k, v in self.headers.items()})
            resp = conn.getresponse()
            resp_body = resp.read()
            self.send_response(resp.status)
            for h, v in resp.getheaders():
                if h.lower() not in ("transfer-encoding", "connection"):
                    self.send_header(h, v)
            self.send_header("Content-Length", str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)
            conn.close()
        except Exception as e:
            msg = f"Proxy error: {e}".encode()
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def _send_fallback(self):
        body = json.dumps({"services": route_registry.all_services(),
                           "dashboard": f"http://localhost:{config['web_port']}"}, indent=2).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self): self._proxy()
    def do_POST(self): self._proxy(self._body())
    def do_PUT(self): self._proxy(self._body())
    def do_DELETE(self): self._proxy()
    def do_PATCH(self): self._proxy(self._body())
    def do_OPTIONS(self):
        self.send_response(200)
        for h, v in [("Access-Control-Allow-Origin", "*"),
                     ("Access-Control-Allow-Methods", "*"),
                     ("Access-Control-Allow-Headers", "*")]:
            self.send_header(h, v)
        self.end_headers()

    def _body(self):
        n = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(n) if n else b""

    def log_message(self, *a): pass


# ── REST API ─────────────────────────────────────────────────────────────────
class APIHandler(BaseHTTPRequestHandler):
    stacks_cache = None

    def _stacks(self):
        if not APIHandler.stacks_cache:
            APIHandler.stacks_cache = {s["name"]: s for s in discover_stacks(GLOBAL_ROOT)}
        return APIHandler.stacks_cache

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
                     ("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS"),
                     ("Access-Control-Allow-Headers", "Content-Type")]:
            self.send_header(h, v)
        self.end_headers()

    def do_GET(self):
        p = urlparse(self.path)
        path = p.path.rstrip("/")
        query = parse_qs(p.query)

        if path == "/api/status":
            stacks_data = {}
            for s in discover_stacks(GLOBAL_ROOT):
                stacks_data[s["name"]] = {
                    "compose_file": str(s["compose_file"]),
                    "has_env": s["env_file"] is not None,
                    "containers": get_container_status(s["dir"]),
                }
            self._json({
                "docker_desktop": DockerDesktop.is_running(),
                "stacks": stacks_data,
                "services": route_registry.all_services(),
                "config": {
                    "proxy_port": config["proxy_port"],
                    "domain": config["domain"],
                    "api_port": config["api_port"],
                    "web_port": config["web_port"],
                },
            })
        elif path == "/api/stacks":
            self._json({"stacks": list(self._stacks().keys())})
        elif path == "/api/services":
            self._json({"services": route_registry.all_services()})
        elif path == "/api/config":
            self._json({"config": config})
        elif path.startswith("/api/stacks/"):
            self._handle_stack_get(path, query)
        else:
            self._err("Not found", 404)

    def _handle_stack_get(self, path, query):
        parts = path.split("/")
        if len(parts) > 4:
            stack_name = "/".join(parts[3:-1])
            action = parts[-1]
        elif len(parts) == 4:
            stack_name = parts[3]
            action = "status"
        else:
            self._err("Bad request"); return

        stack = self._stacks().get(stack_name)
        if not stack:
            self._err(f"Stack '{stack_name}' not found", 404); return

        if action == "status":
            self._json({"stack": stack_name, "containers": get_container_status(stack["dir"])})
        elif action == "env":
            if stack["env_file"] and stack["env_file"].exists():
                self._json({"env": stack["env_file"].read_text(encoding="utf-8")})
            else:
                self._err("No .env file", 404)
        elif action == "config":
            self._json({"config": stack["compose_file"].read_text(encoding="utf-8")})
        elif action == "logs":
            tail = query.get("tail", ["200"])[0]
            try:
                r = run_compose(stack["dir"], "logs", "--tail", tail)
                self._json({"logs": r.stdout or r.stderr})
            except Exception as e:
                self._err(str(e))
        else:
            self._err(f"Unknown: {action}", 404)

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")

        if path == "/api/docker/start":
            self._json({"message": DockerDesktop.start()})
        elif path == "/api/docker/stop":
            self._json({"message": DockerDesktop.stop()})
        elif path == "/api/docker/restart":
            self._json({"message": DockerDesktop.restart()})
        elif path == "/api/refresh":
            APIHandler.stacks_cache = None
            route_registry.refresh()
            self._json({"message": "Refreshed"})
        elif path.startswith("/api/stacks/"):
            parts = path.split("/")
            if len(parts) > 4:
                stack_name = "/".join(parts[3:-1])
                action = parts[-1]
            else:
                stack_name = parts[3] if len(parts) > 3 else ""
                action = ""
            stack = self._stacks().get(stack_name)
            if not stack:
                self._err(f"Stack '{stack_name}' not found", 404); return
            actions = {"up": ("up", "-d"), "down": ("down",), "restart": ("restart",), "pull": ("pull",)}
            if action in actions:
                try:
                    r = run_compose(stack["dir"], *actions[action])
                    self._json({"action": action, "stack": stack_name,
                                "stdout": r.stdout, "stderr": r.stderr, "returncode": r.returncode})
                except Exception as e:
                    self._err(str(e))
            else:
                self._err(f"Unknown: {action}", 404)
        else:
            self._err("Not found", 404)

    def do_PUT(self):
        path = urlparse(self.path).path.rstrip("/")

        if path == "/api/config":
            body = self._body()
            try:
                new_cfg = json.loads(body)
                # Validate
                allowed = {"proxy_port", "domain", "api_port", "web_port"}
                for k, v in new_cfg.items():
                    if k in allowed:
                        config[k] = v
                save_config(config)
                self._json({"message": "Config saved. Restart docker-global for port changes to take effect.", "config": config})
            except Exception as e:
                self._err(str(e))
            return

        if not path.startswith("/api/stacks/"):
            self._err("Not found", 404); return

        parts = path.split("/")
        stack_name = "/".join(parts[3:-1]) if len(parts) > 4 else parts[3]
        action = parts[-1] if len(parts) > 4 else ""
        stack = self._stacks().get(stack_name)
        if not stack:
            self._err(f"Stack '{stack_name}' not found", 404); return

        body = self._body()
        try:
            data = json.loads(body)
        except Exception:
            self._err("Invalid JSON"); return

        if action == "env":
            if stack["env_file"]:
                stack["env_file"].write_text(data.get("env", ""), encoding="utf-8")
                self._json({"message": "Saved .env"})
            else:
                self._err("No .env file", 404)
        elif action == "config":
            stack["compose_file"].write_text(data.get("config", ""), encoding="utf-8")
            self._json({"message": "Saved config"})
        else:
            self._err(f"Unknown: {action}", 404)

    def log_message(self, *a): pass


# ── Static File Server (serves React build) ─────────────────────────────────
MIME_TYPES = {
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

        file_path = STATIC_DIR / path.lstrip("/")

        if file_path.is_file():
            self._serve_file(file_path)
        else:
            index = STATIC_DIR / "index.html"
            if index.is_file():
                self._serve_file(index)
            else:
                msg = b"Dashboard not built yet. Run: cd web && npm run build"
                self.send_response(503)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Content-Length", str(len(msg)))
                self.end_headers()
                self.wfile.write(msg)

    def _serve_file(self, fp: Path):
        data = fp.read_bytes()
        ext = fp.suffix.lower()
        mime = MIME_TYPES.get(ext, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        if ext in (".js", ".css", ".woff2", ".png", ".svg"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a): pass


# ── Server launchers ─────────────────────────────────────────────────────────
def _serve(port, handler, name):
    try:
        server = HTTPServer(("0.0.0.0", port), handler)
        print(f"  {name:12s}  http://localhost:{port}")
        server.serve_forever()
    except OSError as e:
        if e.errno in (10013, 13, 98):  # Permission denied / addr in use
            print(f"  {name:12s}  FAILED on port {port} — {e}")
            if name == "Proxy" and port == 80:
                fallback = 19801
                print(f"  {name:12s}  Falling back to port {fallback}")
                config["proxy_port"] = fallback
                server = HTTPServer(("0.0.0.0", fallback), handler)
                print(f"  {name:12s}  http://localhost:{fallback}")
                server.serve_forever()
        else:
            raise


# ── Windows Service (nssm-based) ─────────────────────────────────────────────
SERVICE_NAME = "docker-global"


def _get_exe_path() -> str:
    if getattr(sys, "frozen", False):
        return str(Path(sys.executable).resolve())
    return f'"{sys.executable}" "{Path(__file__).resolve()}"'


def service_install():
    exe = _get_exe_path()
    if SYSTEM == "Windows":
        # Use nssm if available, otherwise sc.exe
        nssm = _which("nssm")
        if nssm:
            print(f"Installing service '{SERVICE_NAME}' via nssm...")
            _run([nssm, "install", SERVICE_NAME, exe])
            _run([nssm, "set", SERVICE_NAME, "DisplayName", "Docker Global Manager"])
            _run([nssm, "set", SERVICE_NAME, "Description", "Docker Compose manager with reverse proxy"])
            _run([nssm, "set", SERVICE_NAME, "Start", "SERVICE_AUTO_START"])
            _run([nssm, "set", SERVICE_NAME, "AppStdout", str(APP_DIR / "service.log")])
            _run([nssm, "set", SERVICE_NAME, "AppStderr", str(APP_DIR / "service.log")])
            _run([nssm, "start", SERVICE_NAME])
            print("Service installed and started.")
        else:
            # Fallback: use sc.exe (requires running as exe, not python script)
            if getattr(sys, "frozen", False):
                print(f"Installing service '{SERVICE_NAME}' via sc.exe...")
                r = _run(["sc", "create", SERVICE_NAME,
                          f"binPath={exe}", "start=auto",
                          f"DisplayName=Docker Global Manager"])
                if r.returncode == 0:
                    _run(["sc", "start", SERVICE_NAME])
                    print("Service installed and started.")
                else:
                    print(f"Failed: {r.stderr}")
                    print("Try running as Administrator, or install nssm: winget install nssm")
            else:
                print("sc.exe requires a frozen exe. Use nssm instead:")
                print("  winget install nssm")
                print(f'  nssm install {SERVICE_NAME} "{exe}"')
    elif SYSTEM == "Linux":
        unit = f"""[Unit]
Description=Docker Global Manager
After=network.target docker.service

[Service]
Type=simple
ExecStart={exe}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
        unit_path = Path(f"/etc/systemd/system/{SERVICE_NAME}.service")
        print(f"Writing systemd unit to {unit_path}...")
        unit_path.write_text(unit)
        _run(["systemctl", "daemon-reload"])
        _run(["systemctl", "enable", SERVICE_NAME])
        _run(["systemctl", "start", SERVICE_NAME])
        print("Service installed and started.")
    elif SYSTEM == "Darwin":
        plist = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.docker-global</string>
    <key>ProgramArguments</key><array><string>{exe}</string></array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>{APP_DIR}/service.log</string>
    <key>StandardErrorPath</key><string>{APP_DIR}/service.log</string>
</dict>
</plist>"""
        plist_path = Path.home() / "Library/LaunchAgents/com.docker-global.plist"
        print(f"Writing launchd plist to {plist_path}...")
        plist_path.write_text(plist)
        _run(["launchctl", "load", str(plist_path)])
        print("Service installed and started.")


def service_uninstall():
    if SYSTEM == "Windows":
        nssm = _which("nssm")
        if nssm:
            _run([nssm, "stop", SERVICE_NAME])
            _run([nssm, "remove", SERVICE_NAME, "confirm"])
        else:
            _run(["sc", "stop", SERVICE_NAME])
            _run(["sc", "delete", SERVICE_NAME])
        print(f"Service '{SERVICE_NAME}' removed.")
    elif SYSTEM == "Linux":
        _run(["systemctl", "stop", SERVICE_NAME])
        _run(["systemctl", "disable", SERVICE_NAME])
        unit_path = Path(f"/etc/systemd/system/{SERVICE_NAME}.service")
        if unit_path.exists():
            unit_path.unlink()
        _run(["systemctl", "daemon-reload"])
        print(f"Service '{SERVICE_NAME}' removed.")
    elif SYSTEM == "Darwin":
        plist_path = Path.home() / "Library/LaunchAgents/com.docker-global.plist"
        _run(["launchctl", "unload", str(plist_path)])
        if plist_path.exists():
            plist_path.unlink()
        print(f"Service '{SERVICE_NAME}' removed.")


def service_status():
    if SYSTEM == "Windows":
        r = _run(["sc", "query", SERVICE_NAME])
        print(r.stdout if r.returncode == 0 else f"Service '{SERVICE_NAME}' not found.")
    elif SYSTEM == "Linux":
        r = _run(["systemctl", "status", SERVICE_NAME])
        print(r.stdout)
    elif SYSTEM == "Darwin":
        r = _run(["launchctl", "list", "com.docker-global"])
        print(r.stdout if r.returncode == 0 else f"Service not found.")


def _which(name):
    import shutil
    return shutil.which(name)


# ── Main ─────────────────────────────────────────────────────────────────────
def run_server():
    proxy_port = config["proxy_port"]
    api_port = config["api_port"]
    web_port = config["web_port"]
    domain = config["domain"]

    print(f"\n  docker-global server")
    print(f"  Root: {GLOBAL_ROOT}")
    print(f"  Config: {CONFIG_PATH}")
    print(f"  Domain: *{domain}" + (f":{proxy_port}" if proxy_port != 80 else ""))
    print()

    threads = [
        threading.Thread(target=_serve, args=(api_port, APIHandler, "API"), daemon=True),
        threading.Thread(target=_serve, args=(proxy_port, ProxyHandler, "Proxy"), daemon=True),
        threading.Thread(target=_serve, args=(web_port, WebHandler, "Dashboard"), daemon=True),
        threading.Thread(target=_registry_refresh_loop, daemon=True),
    ]
    for t in threads:
        t.start()

    route_registry.refresh()
    print()

    return web_port


def main():
    args = sys.argv[1:]

    if "--install" in args or "install" in args:
        service_install()
    elif "--uninstall" in args or "uninstall" in args:
        service_uninstall()
    elif "--status" in args or "status" in args:
        service_status()
    elif "--no-browser" in args:
        # Service mode: no browser
        run_server()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down.")
    else:
        web_port = run_server()
        webbrowser.open(f"http://localhost:{web_port}")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down.")


if __name__ == "__main__":
    main()
