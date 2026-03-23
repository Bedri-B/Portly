"""Server launchers and main run loop."""

import atexit
import os
import ssl
import threading
import time
from http.server import HTTPServer

from portly.config import config, CONFIG_PATH, PID_PATH, SYSTEM
from portly.registry import registry
from portly.proxy import ProxyHandler
from portly.api import APIHandler
from portly.web_server import WebHandler
from portly.tls import ensure_certs


def _write_pid():
    PID_PATH.write_text(str(os.getpid()))
    atexit.register(lambda: PID_PATH.unlink(missing_ok=True))


def is_running() -> bool:
    """Check if another portly instance is already running."""
    if not PID_PATH.exists():
        return False
    try:
        pid = int(PID_PATH.read_text().strip())
        if SYSTEM == "Windows":
            import ctypes
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
            if handle:
                kernel32.CloseHandle(handle)
                return True
            return False
        else:
            os.kill(pid, 0)
            return True
    except (ValueError, OSError, ProcessLookupError):
        PID_PATH.unlink(missing_ok=True)
        return False


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


def _auto_update_loop():
    """Periodically check for updates and apply if auto_update is enabled."""
    time.sleep(60)  # Wait a bit after startup
    while True:
        try:
            if config.get("auto_update", False):
                from portly.updater import check_update, perform_update
                info = check_update()
                if info["available"]:
                    print(f"  Auto-updating to v{info['latest']}...")
                    result = perform_update(info)
                    print(f"  {result['message']}")
        except Exception:
            pass
        time.sleep(3600)  # Check every hour


def run_server():
    _write_pid()

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
        threading.Thread(target=_auto_update_loop, daemon=True),
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
