"""Run backend + frontend dev servers concurrently.

Usage: python scripts/dev.py
  - Starts the portly backend (python -m portly --daemon mode, foreground)
  - Starts the Vite dev server for the dashboard (hot reload on :5173)
  - Ctrl+C stops both
"""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
WEB_DIR = ROOT / "web"


def main():
    procs = []
    print("\n  portly dev\n")

    # Backend
    print("  Starting backend...")
    backend = subprocess.Popen(
        [sys.executable, "-m", "portly", "--daemon"],
        cwd=str(ROOT),
    )
    procs.append(backend)
    time.sleep(1)

    # Frontend
    print("  Starting frontend (Vite)...\n")
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend = subprocess.Popen(
        [npm, "run", "dev"],
        cwd=str(WEB_DIR),
        shell=(sys.platform == "win32"),
    )
    procs.append(frontend)

    print("  Backend:   http://localhost:19802  (API: :19800)")
    print("  Frontend:  http://localhost:5173   (hot reload)")
    print("  Press Ctrl+C to stop both.\n")

    def cleanup(*_):
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, cleanup)

    try:
        # Wait for either to exit
        while True:
            for p in procs:
                if p.poll() is not None:
                    cleanup()
            time.sleep(0.5)
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()
