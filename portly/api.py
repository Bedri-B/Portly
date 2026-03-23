"""REST API handler."""

import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

from portly.config import config, save_config
from portly.registry import registry
from portly.discovery import collect_scan_ports


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
        elif path == "/api/scan":
            try:
                data = json.loads(self._body())
                if "ports" in data:
                    config["scan_ports"] = [int(p) for p in data["ports"]]
                if "ranges" in data:
                    config["scan_ranges"] = [[int(r[0]), int(r[1])] for r in data["ranges"]]
                if "common" in data:
                    config["scan_common"] = bool(data["common"])
                save_config(config)
                registry.refresh()
                self._json({
                    "message": "Scan config updated",
                    "scan_ports": config["scan_ports"],
                    "scan_ranges": config["scan_ranges"],
                    "scan_common": config["scan_common"],
                    "total_scan_targets": len(collect_scan_ports()),
                })
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
                           "https_enabled", "docker_discovery", "aliases",
                           "scan_ports", "scan_ranges", "scan_common"}
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
