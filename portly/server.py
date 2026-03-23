"""Server launchers and main run loop."""

import ssl
import threading
import time
from http.server import HTTPServer

from portly.config import config, CONFIG_PATH
from portly.registry import registry
from portly.proxy import ProxyHandler
from portly.api import APIHandler
from portly.web_server import WebHandler
from portly.tls import ensure_certs


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


def _refresh_loop():
    while True:
        try:
            registry.refresh()
        except Exception:
            pass
        time.sleep(10)


def run_server():
    domain = config["domain"]
    proxy_port = config["proxy_port"]
    ps = f":{proxy_port}" if proxy_port != 80 else ""

    print(f"\n  portly")
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
