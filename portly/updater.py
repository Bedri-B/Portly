"""Update checker and installer using GitHub Releases."""

import json
import os
import platform
import shutil
import stat
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

from portly.config import GITHUB_REPO, VERSION, SYSTEM


def _platform_suffix() -> str:
    machine = platform.machine().lower()
    if SYSTEM == "Windows":
        return "windows-amd64.exe"
    elif SYSTEM == "Darwin":
        return "macos-arm64" if "arm" in machine or "aarch" in machine else "macos-amd64"
    else:
        return "linux-amd64"


def check_update() -> dict:
    """Check GitHub for a newer release. Returns {available, current, latest, download_url}."""
    try:
        req = Request(
            f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "portly"},
        )
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        tag = data.get("tag_name", "")
        latest = tag.lstrip("v")
        suffix = _platform_suffix()
        download_url = ""
        for asset in data.get("assets", []):
            if asset["name"].endswith(suffix):
                download_url = asset["browser_download_url"]
                break

        return {
            "available": _version_newer(latest, VERSION),
            "current": VERSION,
            "latest": latest,
            "download_url": download_url,
        }
    except (URLError, OSError, json.JSONDecodeError, KeyError):
        return {"available": False, "current": VERSION, "latest": VERSION, "download_url": ""}


def _version_newer(latest: str, current: str) -> bool:
    """Compare semver-like strings."""
    try:
        def parts(v): return tuple(int(x) for x in v.split(".")[:3])
        return parts(latest) > parts(current)
    except (ValueError, IndexError):
        return False


def perform_update(info: dict | None = None) -> dict:
    """Download and replace the current binary. Returns {success, message}."""
    if info is None:
        info = check_update()

    if not info["available"]:
        return {"success": False, "message": f"Already up to date (v{VERSION})."}

    url = info.get("download_url", "")
    if not url:
        return {"success": False, "message": "No download URL found for this platform."}

    if not getattr(sys, "frozen", False):
        return {"success": False, "message": "Update only works for packaged binaries. Use git pull for dev installs."}

    exe_path = Path(sys.executable).resolve()

    try:
        # Download to temp file
        req = Request(url, headers={"User-Agent": "portly"})
        with urlopen(req, timeout=120) as resp:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=exe_path.suffix, dir=exe_path.parent)
            shutil.copyfileobj(resp, tmp)
            tmp.close()
            tmp_path = Path(tmp.name)

        # Make executable on Unix
        if SYSTEM != "Windows":
            tmp_path.chmod(tmp_path.stat().st_mode | stat.S_IEXEC)

        # Replace binary
        backup = exe_path.with_suffix(exe_path.suffix + ".bak")
        if backup.exists():
            backup.unlink()
        exe_path.rename(backup)
        tmp_path.rename(exe_path)

        # Clean up backup
        try:
            backup.unlink()
        except OSError:
            pass  # On Windows the running exe can't be deleted; it'll be cleaned next time

        return {"success": True, "message": f"Updated to v{info['latest']}. Restart portly to use the new version."}
    except Exception as e:
        return {"success": False, "message": f"Update failed: {e}"}
