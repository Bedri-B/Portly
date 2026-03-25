"""HTTP/HTTPS reverse proxy handler."""

import http.client
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

from portly.config import config
from portly.registry import registry

# Reserved subdomain — routes to the dashboard/API
DASHBOARD_NAME = "portly"


def _error_page(status: int, title: str, message: str, details: list[str],
                host: str = "", suggestions: list[dict] | None = None) -> bytes:
    """Generate a styled HTML error page."""
    domain = config["domain"]
    ps = f":{config['proxy_port']}" if config["proxy_port"] != 80 else ""
    dashboard_url = f"http://{DASHBOARD_NAME}{domain}{ps}"

    details_html = "".join(f'<li>{d}</li>' for d in details)
    suggestions_html = ""
    if suggestions:
        items = "".join(
            f'<a href="{s["url"]}" class="svc">'
            f'<span class="dot" style="background:{s.get("color","#6366f1")}"></span>'
            f'<span>{s["name"]}</span>'
            f'<span class="port">:{s["port"]}</span>'
            f'</a>'
            for s in suggestions
        )
        suggestions_html = f'<div class="section"><h3>Available services</h3><div class="svc-list">{items}</div></div>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — Portly</title>
<link rel="icon" type="image/svg+xml" href="{dashboard_url}/favicon.svg">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: system-ui,-apple-system,sans-serif; background:#0a0a14; color:#e4e4e7; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }}
  .card {{ max-width:560px; width:100%; background:#111118; border:1px solid #1e1e2e; border-radius:16px; overflow:hidden; }}
  .header {{ padding:32px 32px 24px; text-align:center; }}
  .status {{ font-size:48px; font-weight:700; color:#6366f1; opacity:0.3; }}
  h1 {{ font-size:22px; font-weight:700; margin-top:8px; letter-spacing:-0.3px; }}
  .host {{ font-family:monospace; font-size:13px; color:#818cf8; background:#1a1a2e; padding:4px 12px; border-radius:6px; display:inline-block; margin-top:10px; }}
  .body {{ padding:0 32px 28px; }}
  .msg {{ font-size:14px; color:#a1a1aa; line-height:1.6; margin-bottom:20px; }}
  .section {{ margin-bottom:20px; }}
  h3 {{ font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#52525b; margin-bottom:10px; }}
  ul {{ list-style:none; }}
  li {{ font-size:13px; color:#71717a; padding:6px 0; padding-left:16px; position:relative; line-height:1.4; }}
  li::before {{ content:""; position:absolute; left:0; top:12px; width:6px; height:6px; border-radius:50%; background:#27272a; }}
  .svc-list {{ display:flex; flex-direction:column; gap:4px; }}
  .svc {{ display:flex; align-items:center; gap:10px; padding:10px 14px; background:#0f0f1a; border:1px solid #1e1e2e; border-radius:8px; text-decoration:none; color:#e4e4e7; font-size:13px; transition:border-color 0.15s,background 0.15s; }}
  .svc:hover {{ border-color:#6366f1; background:#14142a; }}
  .dot {{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }}
  .port {{ font-family:monospace; font-size:11px; color:#52525b; margin-left:auto; }}
  .footer {{ padding:16px 32px; border-top:1px solid #1e1e2e; display:flex; justify-content:space-between; align-items:center; }}
  .footer a {{ color:#6366f1; text-decoration:none; font-size:13px; font-weight:500; transition:color 0.15s; }}
  .footer a:hover {{ color:#818cf8; }}
  .footer .brand {{ font-size:11px; color:#3f3f50; font-family:monospace; }}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="status">{status}</div>
    <h1>{title}</h1>
    {"<div class='host'>" + host + "</div>" if host else ""}
  </div>
  <div class="body">
    <p class="msg">{message}</p>
    <div class="section">
      <h3>Possible reasons</h3>
      <ul>{details_html}</ul>
    </div>
    {suggestions_html}
  </div>
  <div class="footer">
    <a href="{dashboard_url}">Open Dashboard</a>
    <span class="brand">portly</span>
  </div>
</div>
</body>
</html>""".encode("utf-8")


def _service_suggestions(limit: int = 6) -> list[dict]:
    """Get a few running services for the error page."""
    domain = config["domain"]
    ps = f":{config['proxy_port']}" if config["proxy_port"] != 80 else ""
    colors = {"docker": "#38bdf8", "alias": "#a78bfa", "scan": "#fbbf24"}
    result = []
    for s in registry.all_services():
        if s["state"] == "running" and len(result) < limit:
            result.append({
                "name": s["name"],
                "port": s["port"],
                "url": f"http://{s['name']}{domain}{ps}",
                "color": colors.get(s["source"], "#6366f1"),
            })
    return result


class ProxyHandler(BaseHTTPRequestHandler):
    def _resolve(self) -> tuple[str, int | None, str]:
        """Returns (kind, port, subdomain). kind is 'dashboard', 'service', 'stopped', or 'none'."""
        host = self.headers.get("Host", "").split(":")[0]
        domain = config["domain"]
        if host in ("localhost", "127.0.0.1", ""):
            return "none", None, ""
        if not host.endswith(domain):
            return "none", None, host
        name = host[: -len(domain)]
        if name == DASHBOARD_NAME:
            return "dashboard", config["web_port"], name
        port = registry.lookup(name)
        if port is not None:
            # Check if the route is known but the service state is stopped
            with registry._lock:
                info = registry.routes.get(name, {})
                if info.get("state") == "stopped":
                    return "stopped", port, name
            return "service", port, name
        return "unknown", None, name

    def _proxy(self, body: bytes = b""):
        kind, port, name = self._resolve()

        if kind == "none":
            self._page_no_subdomain()
            return
        if kind == "unknown":
            self._page_not_found(name)
            return
        if kind == "stopped":
            self._page_stopped(name, port or 0)
            return

        try:
            # Try IPv4 first, fall back to IPv6
            conn = None
            for target_host in ("127.0.0.1", "::1"):
                try:
                    conn = http.client.HTTPConnection(target_host, port, timeout=30)
                    conn.request(self.command, self.path, body=body or None,
                                 headers={k: v for k, v in self.headers.items()})
                    break
                except (ConnectionRefusedError, OSError):
                    conn = None
                    continue
            if conn is None:
                raise ConnectionRefusedError(f"Could not connect to port {port}")
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
        except Exception:
            self._page_unreachable(name, port or 0)

    # ── Error pages ──────────────────────────────────────────────

    def _send_error_page(self, status: int, body: bytes):
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _page_not_found(self, name: str):
        domain = config["domain"]
        host = f"{name}{domain}"
        body = _error_page(
            status=404,
            title="Service Not Found",
            message=f"No service is registered for this address. Portly doesn't know where to route traffic for this hostname.",
            host=host,
            details=[
                f"No alias, Docker container, or scanned port is mapped to <b>{name}</b>",
                "The service may not be running yet",
                "The name might be misspelled",
                f"Try adding an alias: <code>portly alias {name} &lt;port&gt;</code>",
            ],
            suggestions=_service_suggestions(),
        )
        self._send_error_page(404, body)

    def _page_stopped(self, name: str, port: int):
        domain = config["domain"]
        host = f"{name}{domain}"
        body = _error_page(
            status=503,
            title="Service Stopped",
            message=f"This service is registered but not currently responding on port {port}.",
            host=host,
            details=[
                f"The alias <b>{name}</b> points to <code>localhost:{port}</code> but nothing is listening",
                "Start the service that runs on this port",
                "Check if the port number is correct in your alias configuration",
                "The service may have crashed or been stopped",
            ],
            suggestions=_service_suggestions(),
        )
        self._send_error_page(503, body)

    def _page_unreachable(self, name: str, port: int):
        domain = config["domain"]
        host = f"{name}{domain}"
        body = _error_page(
            status=502,
            title="Service Unreachable",
            message=f"Portly tried to reach <code>localhost:{port}</code> but the connection failed.",
            host=host,
            details=[
                f"The target service on port {port} refused the connection or timed out",
                "The service may have just crashed or restarted",
                "A firewall might be blocking the connection",
                "Try refreshing in a few seconds",
            ],
            suggestions=_service_suggestions(),
        )
        self._send_error_page(502, body)

    def _page_no_subdomain(self):
        domain = config["domain"]
        ps = f":{config['proxy_port']}" if config["proxy_port"] != 80 else ""
        dashboard_url = f"http://{DASHBOARD_NAME}{domain}{ps}"
        body = _error_page(
            status=200,
            title="Portly is Running",
            message="You've reached the proxy directly. Use a subdomain to access a service, or open the dashboard to manage everything.",
            host=f"localhost{ps}",
            details=[
                f"Access services at <code>http://&lt;name&gt;{domain}{ps}</code>",
                f"Dashboard: <a href='{dashboard_url}' style='color:#818cf8'>{dashboard_url}</a>",
                "Add aliases via CLI: <code>portly alias myapp 3000</code>",
                "Docker containers are discovered automatically",
            ],
            suggestions=_service_suggestions(),
        )
        self._send_error_page(200, body)

    # ── HTTP methods ─────────────────────────────────────────────

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
