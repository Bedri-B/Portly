"""HTTP/HTTPS reverse proxy handler."""

import http.client
import json
from http.server import BaseHTTPRequestHandler

from portly.config import config
from portly.registry import registry


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
