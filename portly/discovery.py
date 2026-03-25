"""Docker container discovery and port scanning."""

import json
import socket
from concurrent.futures import ThreadPoolExecutor

from portly.config import config, run_cmd, COMMON_DEV_PORTS


# ── Port Probing ─────────────────────────────────────────────────────────────

def port_is_open(port: int) -> bool:
    """Check if a port is open on localhost (tries IPv4 then IPv6)."""
    for host in ("127.0.0.1", "::1"):
        try:
            with socket.create_connection((host, port), timeout=0.3):
                return True
        except (OSError, ConnectionRefusedError):
            continue
    return False


def scan_ports_parallel(ports: list[int]) -> set[int]:
    """Probe a list of ports in parallel, return the set that are open."""
    if not ports:
        return set()
    open_ports = set()
    with ThreadPoolExecutor(max_workers=min(64, len(ports))) as pool:
        results = pool.map(lambda p: (p, port_is_open(p)), ports)
        for port, is_open in results:
            if is_open:
                open_ports.add(port)
    return open_ports


def collect_scan_ports() -> list[int]:
    """Build the full list of ports to scan from config."""
    ports = set(config.get("scan_ports", []))

    for r in config.get("scan_ranges", []):
        if isinstance(r, list) and len(r) == 2:
            lo, hi = int(r[0]), int(r[1])
            ports.update(range(lo, hi + 1))

    if config.get("scan_common", True):
        ports.update(COMMON_DEV_PORTS)

    own = {config.get("api_port", 19800), config.get("web_port", 19802),
           config.get("proxy_port", 80), config.get("https_port", 443)}
    ports -= own

    return sorted(ports)


# ── Docker Container Discovery ───────────────────────────────────────────────

def discover_docker_ports() -> dict[str, dict]:
    """Find all running Docker containers with published ports."""
    routes = {}
    if not config.get("docker_discovery", True):
        return routes
    try:
        r = run_cmd(["docker", "ps", "--format", "json"])
        if r.returncode != 0:
            return routes
        for line in r.stdout.strip().splitlines():
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
                name = obj.get("Names", obj.get("name", ""))
                ports_str = obj.get("Ports", "")
                image = obj.get("Image", "")
                state = obj.get("State", "running")
                for chunk in ports_str.split(","):
                    chunk = chunk.strip()
                    if "->" in chunk and ":" in chunk:
                        host_part = chunk.split("->")[0]
                        port_str = host_part.rsplit(":", 1)[-1]
                        try:
                            pub_port = int(port_str)
                            if pub_port > 0:
                                routes[name] = {
                                    "port": pub_port,
                                    "image": image,
                                    "state": state,
                                    "source": "docker",
                                }
                                break
                        except ValueError:
                            continue
            except json.JSONDecodeError:
                continue
    except Exception:
        pass
    return routes
