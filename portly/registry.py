"""Route registry: aggregates Docker, alias, and scanned services."""

import hashlib
import threading

from portly.config import config
from portly.discovery import discover_docker_ports, port_is_open, scan_ports_parallel, collect_scan_ports

# Word list for generating memorable names from port numbers.
# Each port deterministically maps to a 4-6 letter word.
_WORDS = [
    "acre", "apex", "aria", "atom", "aura", "axle", "base", "beam", "bolt",
    "brew", "buzz", "calm", "cape", "cave", "chip", "clay", "code", "coil",
    "cola", "cone", "cope", "core", "cozy", "crab", "crest", "cube", "curl",
    "dale", "dart", "dawn", "daze", "deck", "dell", "dew", "dome", "dove",
    "drum", "dune", "dusk", "echo", "edge", "elm", "ember", "epic", "fawn",
    "fern", "fizz", "flux", "foam", "fold", "fort", "fox", "fuse", "gale",
    "gate", "gear", "gilt", "glen", "glow", "glyph", "grain", "grip", "gulf",
    "gust", "halo", "haven", "hawk", "haze", "helm", "hive", "holt", "horn",
    "husk", "hymn", "iris", "isle", "ivy", "jade", "jazz", "jest", "jewel",
    "jolt", "keel", "kelp", "kite", "knot", "lace", "lake", "lark", "lava",
    "leaf", "lens", "lily", "lime", "link", "loft", "loop", "luna", "lure",
    "lynx", "malt", "maple", "mars", "maze", "mesa", "mist", "mint", "mode",
    "moon", "moss", "muse", "myth", "nave", "neon", "nest", "node", "nova",
    "oar", "opal", "orbit", "orca", "oryx", "owlet", "palm", "path", "peak",
    "pear", "pine", "pixel", "plum", "pond", "port", "prism", "pulse", "quay",
    "quill", "rain", "reed", "reef", "riff", "rift", "rise", "river", "rook",
    "rose", "ruby", "rune", "sage", "sail", "sand", "seed", "silk", "snow",
    "sonar", "soul", "spark", "spire", "star", "stem", "stone", "surf", "swan",
    "tarn", "teal", "tempo", "thaw", "tide", "torch", "trail", "tree", "tulip",
    "vale", "vault", "veil", "vine", "void", "volt", "wade", "wave", "weld",
    "well", "whirl", "wick", "wild", "willow", "wind", "wisp", "wren", "yarn",
    "yew", "zeal", "zen", "zinc", "zone",
]


def _port_to_name(port: int) -> str:
    """Deterministically map a port number to a memorable word."""
    h = int(hashlib.md5(str(port).encode()).hexdigest(), 16)
    return _WORDS[h % len(_WORDS)]


class RouteRegistry:
    def __init__(self):
        self.routes: dict[str, dict] = {}
        self._lock = threading.Lock()

    def refresh(self):
        new_routes = {}

        # 1. Docker containers
        strip_raw = config.get("docker_strip_prefix", "")
        prefixes = [p.strip() for p in strip_raw.split(",") if p.strip()]
        for name, info in discover_docker_ports().items():
            new_routes[name] = info
            # Auto-create short name by stripping matching prefix
            for prefix in prefixes:
                if name.startswith(prefix):
                    short = name[len(prefix):]
                    if short and short not in new_routes:
                        new_routes[short] = {**info, "_alias_of": name}
                    break

        # 1b. Manual short aliases for Docker containers
        for short, target in config.get("short_aliases", {}).items():
            if target in new_routes and short not in new_routes:
                new_routes[short] = {**new_routes[target], "_alias_of": target}

        # 2. Static aliases
        for name, port in config.get("aliases", {}).items():
            alive = port_is_open(port)
            new_routes[name] = {
                "port": port,
                "image": "",
                "state": "running" if alive else "stopped",
                "source": "alias",
            }

        # 3. Auto-scanned ports (parallel)
        known_ports = {r["port"] for r in new_routes.values()}
        known_names = set(new_routes.keys())
        scan_candidates = [p for p in collect_scan_ports() if p not in known_ports]
        for port in scan_ports_parallel(scan_candidates):
            name = _port_to_name(port)
            # Handle collisions: append port if name already taken
            if name in known_names:
                name = f"{name}-{port}"
            known_names.add(name)
            new_routes[name] = {
                "port": port,
                "image": "",
                "state": "running",
                "source": "scan",
            }

        with self._lock:
            self.routes = new_routes

    def lookup(self, hostname: str) -> int | None:
        with self._lock:
            if hostname in self.routes:
                return self.routes[hostname]["port"]
            norm = hostname.replace("-", "_")
            if norm in self.routes:
                return self.routes[norm]["port"]
            for name in self.routes:
                if name.endswith(f"_{hostname}") or name.endswith(f"-{hostname}"):
                    return self.routes[name]["port"]
            return None

    def _url(self, name: str, https: bool = False) -> str:
        domain = config["domain"]
        scheme = "https" if https else "http"
        port = config["https_port"] if https else config["proxy_port"]
        default_port = 443 if https else 80
        base = f"{scheme}://{name}{domain}"
        if port != default_port:
            base += f":{port}"
        return base

    def all_services(self) -> list[dict]:
        https_on = config.get("https_enabled", False)
        with self._lock:
            return [
                {
                    "name": name,
                    "url": self._url(name, https=https_on),
                    "http_url": self._url(name, https=False),
                    "https_url": self._url(name, https=True) if https_on else None,
                    "direct": f"http://localhost:{info['port']}",
                    "port": info["port"],
                    "image": info.get("image", ""),
                    "state": info["state"],
                    "source": info.get("source", "unknown"),
                }
                for name, info in sorted(self.routes.items())
            ]


registry = RouteRegistry()
