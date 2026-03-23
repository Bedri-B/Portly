"""CLI entry point and commands."""

import sys
import time
import webbrowser

from portly.config import config, save_config
from portly.discovery import port_is_open
from portly.server import run_server
from portly.service import service_install, service_uninstall


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


def main():
    args = sys.argv[1:]
    if not args:
        wp = run_server()
        webbrowser.open(f"http://localhost:{wp}")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down.")
        return

    cmd = args[0]
    if cmd in ("alias",):
        cli_alias(args[1:])
    elif cmd in ("aliases", "list"):
        cli_aliases()
    elif cmd in ("install",):
        service_install()
    elif cmd in ("uninstall",):
        service_uninstall()
    elif cmd == "--no-browser":
        run_server()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down.")
    elif cmd in ("help", "-h", "--help"):
        print("""portly — Portless reverse proxy for local & Docker services

Usage:
  portly                          Start proxy + dashboard
  portly --no-browser             Start without opening browser

  portly alias <name> <port>      Map name.localhost -> localhost:port
  portly alias <name> --remove    Remove alias
  portly aliases                  List all aliases

  portly install                  Install as system service
  portly uninstall                Remove system service
""")
    else:
        print(f"Unknown: {cmd}. Run 'portly help'.")
