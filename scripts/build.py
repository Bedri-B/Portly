"""Build script: builds React frontend, then packages everything into a single exe."""

import os
import subprocess
import sys
import platform
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
WEB_DIR = ROOT_DIR / "web"
WEB_DIST = WEB_DIR / "dist"
DIST_DIR = ROOT_DIR / "dist"
SYSTEM = platform.system()


def build_web():
    print("Building React frontend...")
    subprocess.run(["npm", "run", "build"], cwd=str(WEB_DIR), check=True, shell=True)
    print(f"  React build: {WEB_DIST}\n")


def build_exe():
    name = "portly"
    exe_name = f"{name}.exe" if SYSTEM == "Windows" else name

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--console",
        "--name", name,
        "--add-data", f"{WEB_DIST}{os.pathsep}web",
        "--distpath", str(DIST_DIR),
        "--workpath", str(ROOT_DIR / "build"),
        "--specpath", str(ROOT_DIR),
        str(ROOT_DIR / "portly" / "__main__.py"),
    ]

    print(f"Building exe for {SYSTEM}...")
    subprocess.run(cmd, check=True)

    exe = DIST_DIR / exe_name
    print(f"\nBuild complete: {exe}")
    print(f"Size: {exe.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    build_web()
    build_exe()
