"""Static file server for the web dashboard, with API proxy."""

import http.client
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

from portly.config import config, STATIC_DIR

MIME = {
    ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
    ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
    ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
    ".ttf": "font/ttf", ".map": "application/json",
}


class WebHandler(BaseHTTPRequestHandler):
    def _is_api(self):
        return urlparse(self.path).path.startswith("/api/")

    def _proxy_api(self, body: bytes = b""):
        """Forward /api/* requests to the API server."""
        try:
            conn = http.client.HTTPConnection("127.0.0.1", config["api_port"], timeout=10)
            headers = {k: v for k, v in self.headers.items()}
            conn.request(self.command, self.path, body=body or None, headers=headers)
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
            msg = f"API proxy error: {e}".encode()
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def _read_body(self) -> bytes:
        n = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(n) if n else b""

    def do_GET(self):
        if self._is_api():
            return self._proxy_api()
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

    def do_POST(self):
        if self._is_api():
            return self._proxy_api(self._read_body())
        self._method_not_allowed()

    def do_PUT(self):
        if self._is_api():
            return self._proxy_api(self._read_body())
        self._method_not_allowed()

    def do_DELETE(self):
        if self._is_api():
            return self._proxy_api()
        self._method_not_allowed()

    def do_OPTIONS(self):
        if self._is_api():
            return self._proxy_api()
        self.send_response(200)
        self.end_headers()

    def _method_not_allowed(self):
        self.send_response(405)
        self.end_headers()

    def _file(self, fp):
        data = fp.read_bytes()
        mime = MIME.get(fp.suffix.lower(), "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a): pass
