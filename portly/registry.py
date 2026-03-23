"""Route registry: aggregates Docker, alias, and scanned services."""

import threading

from portly.config import config
from portly.discovery import discover_docker_ports, port_is_open, scan_ports_parallel, collect_scan_ports


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
            alive = port_is_open(port)
            new_routes[name] = {
                "port": port,
                "image": "",
                "state": "running" if alive else "stopped",
                "source": "alias",
            }

        # 3. Auto-scanned ports (parallel)
        known_ports = {r["port"] for r in new_routes.values()}
        scan_candidates = [p for p in collect_scan_ports() if p not in known_ports]
        for port in scan_ports_parallel(scan_candidates):
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
