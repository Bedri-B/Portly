"""Platform detection, paths, and configuration management."""

import json
import platform
import subprocess
import sys
from pathlib import Path

# ── Platform ─────────────────────────────────────────────────────────────────
SYSTEM = platform.system()

_SUBPROCESS_FLAGS = {}
if SYSTEM == "Windows":
    _SUBPROCESS_FLAGS["creationflags"] = 0x08000000  # CREATE_NO_WINDOW

# ── Paths ────────────────────────────────────────────────────────────────────
if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent
    STATIC_DIR = Path(sys._MEIPASS) / "web"  # type: ignore[attr-defined]
else:
    APP_DIR = Path(__file__).resolve().parent.parent
    STATIC_DIR = APP_DIR / "web" / "dist"

CONFIG_PATH = APP_DIR / "config.json"
CERT_DIR = APP_DIR / "certs"

# ── Config ───────────────────────────────────────────────────────────────────
GITHUB_REPO = "Bedri-B/Portly"
VERSION = "1.0.0"
PID_PATH = APP_DIR / "portly.pid"

DEFAULT_CONFIG = {
    "proxy_port": 80,
    "https_port": 443,
    "api_port": 19800,
    "web_port": 19802,
    "domain": ".localhost",
    "https_enabled": False,
    "docker_discovery": True,
    "aliases": {},
    "docker_strip_prefix": "",     # strip prefix from Docker names, e.g. "global_"
    "short_aliases": {},           # {"pgadmin": "global_pgadmin"} — shortcut -> real name
    "scan_ports": [],
    "scan_ranges": [],         # [[3000, 3010], [8080, 8090]]
    "scan_common": True,       # scan well-known dev ports
    "auto_start": True,        # start on boot
    "auto_update": False,      # check & install updates automatically
}

# Well-known dev server ports — scanned when scan_common is True
COMMON_DEV_PORTS = [
    # Frontend
    3000, 3001, 3002, 3003,    # React, Next.js, Remix
    4000, 4200, 4321,          # AdonisJS, Angular, Astro
    5173, 5174, 5175,          # Vite
    5500, 5501,                # Live Server
    8000, 8001,                # Various
    8080, 8081, 8082,          # Common HTTP alt
    8443,                      # Common HTTPS alt
    8888, 8889,                # Jupyter
    # Backend
    3030, 3333,                # Various Node
    4000,                      # Phoenix, AdonisJS
    5000, 5001,                # Flask, .NET
    5555,                      # Flower, Prisma Studio
    6006,                      # Storybook
    6379,                      # Redis
    7860, 7861,                # Gradio
    8787,                      # RStudio
    8501, 8502,                # Streamlit
    9000, 9090,                # Various
    9229,                      # Node debugger
    # Databases / tools
    1433,                      # MSSQL
    3306,                      # MySQL
    5432, 5433, 5434, 5435,    # PostgreSQL
    5672,                      # RabbitMQ
    6379,                      # Redis
    8083, 8086,                # InfluxDB
    9200,                      # Elasticsearch
    15672,                     # RabbitMQ management
    27017,                     # MongoDB
]


def load_config() -> dict:
    cfg = dict(DEFAULT_CONFIG)
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, encoding="utf-8") as f:
                cfg.update(json.load(f))
        except Exception:
            pass
    return cfg


def save_config(cfg: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


config = load_config()
if not CONFIG_PATH.exists():
    save_config(config)


# ── Subprocess helper ────────────────────────────────────────────────────────
def run_cmd(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=30, **_SUBPROCESS_FLAGS, **kwargs)
