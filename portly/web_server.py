"""Static file server for the web dashboard."""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

from portly.config import STATIC_DIR

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
