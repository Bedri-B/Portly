"""Build script: builds React frontend, then packages everything into a single exe."""

import subprocess
import sys
import platform
import shutil
from pathlib import Path

APP_DIR = Path(__file__).parent
WEB_DIR = APP_DIR / "web"
WEB_DIST = WEB_DIR / "dist"
DIST_DIR = APP_DIR / "dist"
SYSTEM = platform.system()


def build_web():
    print("Building React frontend...")
    subprocess.run(["npm", "run", "build"], cwd=str(WEB_DIR), check=True, shell=True)
    print(f"  React build: {WEB_DIST}\n")


def build_exe():
    name = "docker-global"
    exe_name = f"{name}.exe" if SYSTEM == "Windows" else name

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--console",  # headless server needs console for stdout
        "--name", name,
        "--add-data", f"{WEB_DIST}{os.pathsep}web",
        "--distpath", str(DIST_DIR),
        "--workpath", str(APP_DIR / "build"),
        "--specpath", str(APP_DIR),
        str(APP_DIR / "app.py"),
    ]

    print(f"Building exe for {SYSTEM}...")
    subprocess.run(cmd, check=True)

    exe = DIST_DIR / exe_name
    print(f"\nBuild complete: {exe}")
    print(f"Size: {exe.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    import os
    build_web()
    build_exe()
