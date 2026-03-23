"""CLI entry point and commands."""

import os
import subprocess
import sys
import time
import webbrowser

from portly.config import config, save_config, SYSTEM, VERSION, _SUBPROCESS_FLAGS
from portly.discovery import port_is_open
from portly.server import run_server, is_running
from portly.service import service_install, service_uninstall


def _dashboard_url() -> str:
    return f"http://localhost:{config['web_port']}"


def _start_background():
    """Launch portly server as a detached background process."""
    exe = sys.executable
    args = [exe]
    if not getattr(sys, "frozen", False):
        args = [exe, "-m", "portly"]
    args.append("--daemon")

    if SYSTEM == "Windows":
        # DETACHED_PROCESS | CREATE_NO_WINDOW
        subprocess.Popen(args, creationflags=0x00000008 | 0x08000000,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         stdin=subprocess.DEVNULL)
    else:
        subprocess.Popen(args, start_new_session=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         stdin=subprocess.DEVNULL)


def _wait_for_server(timeout: float = 5.0) -> bool:
    """Wait for the API port to become reachable."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_is_open(config["api_port"]):
            return True
        time.sleep(0.2)
    return False


def _setup_autostart():
    """On first run, install as a startup service if auto_start is enabled."""
    if not config.get("auto_start", True):
        return
    if not getattr(sys, "frozen", False):
        return  # Only for packaged binaries
    try:
        service_install()
    except Exception:
        pass  # Non-fatal; user can set it up manually


def cli_alias(args):
    if len(args) < 1:
        print("Usage:")
        print("  portly alias <name> <port>")
        print("  portly alias <name> --remove")
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
            alive = port_is_open(port)
            print(f"  {name} -> localhost:{port}  ({'up' if alive else 'down'})")
        else:
            print(f"'{name}' not found")


def cli_aliases():
    aliases = config.get("aliases", {})
    if not aliases:
        print("No aliases. Add one: portly alias myapp 3000"); return
    domain = config["domain"]
    ps = f":{config['proxy_port']}" if config["proxy_port"] != 80 else ""
    print(f"{'Name':<20} {'Port':<8} {'URL':<40} {'Status'}")
    print("-" * 80)
    for name, port in sorted(aliases.items()):
        alive = port_is_open(port)
        url = f"http://{name}{domain}{ps}"
        st = "\033[32mup\033[0m" if alive else "\033[31mdown\033[0m"
        print(f"{name:<20} {port:<8} {url:<40} {st}")


def cli_update():
    """Check for updates and optionally install."""
    from portly.updater import check_update, perform_update
    print("Checking for updates...")
    info = check_update()
    print(f"  Current: v{info['current']}")
    print(f"  Latest:  v{info['latest']}")
    if not info["available"]:
        print("  Already up to date.")
        return
    print(f"  Update available!")
    result = perform_update(info)
    print(f"  {result['message']}")


def cli_status():
    """Show whether portly is running."""
    if is_running():
        print(f"portly is running — {_dashboard_url()}")
    else:
        print("portly is not running.")


def main():
    args = sys.argv[1:]

    # Internal daemon mode — run server in foreground (used by background launch)
    if args and args[0] == "--daemon":
        run_server()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down.")
        return

    if not args:
        # If already running, just open the dashboard
        if is_running():
            print(f"portly is already running — opening dashboard.")
            webbrowser.open(_dashboard_url())
            return

        # Start in background, wait for it, then open dashboard
        print("Starting portly...")
        _start_background()
        if _wait_for_server():
            print(f"portly is running — {_dashboard_url()}")
            webbrowser.open(_dashboard_url())
        else:
            print("portly started (waiting for server timed out, it may still be starting).")
            webbrowser.open(_dashboard_url())
        return

    cmd = args[0]
    if cmd in ("alias",):
        cli_alias(args[1:])
    elif cmd in ("aliases", "list"):
        cli_aliases()
    elif cmd in ("install",):
        service_install()
        config["auto_start"] = True
        save_config(config)
    elif cmd in ("uninstall",):
        service_uninstall()
        config["auto_start"] = False
        save_config(config)
    elif cmd in ("start",):
        if is_running():
            print("portly is already running.")
        else:
            print("Starting portly...")
            _start_background()
            if _wait_for_server():
                print(f"portly is running — {_dashboard_url()}")
            else:
                print("Started (server may still be initializing).")
    elif cmd in ("stop",):
        from portly.config import PID_PATH
        if not is_running():
            print("portly is not running.")
            return
        try:
            pid = int(PID_PATH.read_text().strip())
            if SYSTEM == "Windows":
                subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                               capture_output=True, **_SUBPROCESS_FLAGS)
            else:
                os.kill(pid, 15)  # SIGTERM
            PID_PATH.unlink(missing_ok=True)
            print("portly stopped.")
        except Exception as e:
            print(f"Failed to stop: {e}")
    elif cmd in ("restart",):
        from portly.config import PID_PATH
        if is_running():
            try:
                pid = int(PID_PATH.read_text().strip())
                if SYSTEM == "Windows":
                    subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                                   capture_output=True, **_SUBPROCESS_FLAGS)
                else:
                    os.kill(pid, 15)
                PID_PATH.unlink(missing_ok=True)
                time.sleep(1)
            except Exception:
                pass
        print("Starting portly...")
        _start_background()
        if _wait_for_server():
            print(f"portly is running — {_dashboard_url()}")
        else:
            print("Started (server may still be initializing).")
    elif cmd in ("status",):
        cli_status()
    elif cmd in ("update",):
        cli_update()
    elif cmd == "--no-browser":
        run_server()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down.")
    elif cmd in ("help", "-h", "--help"):
        print(f"""portly v{VERSION} — Portless reverse proxy for local & Docker services

Usage:
  portly                          Start (or open dashboard if running)
  portly start                    Start server in background
  portly stop                     Stop background server
  portly restart                  Restart background server
  portly status                   Show running status

  portly alias <name> <port>      Map name.localhost -> localhost:port
  portly alias <name> --remove    Remove alias
  portly aliases                  List all aliases

  portly install                  Install as system service (auto-start on boot)
  portly uninstall                Remove system service

  portly update                   Check for updates and install
  portly help                     Show this help
""")
    else:
        print(f"Unknown: {cmd}. Run 'portly help'.")
