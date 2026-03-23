"""OS service install/uninstall (Windows, Linux, macOS)."""

import shutil
import sys
from pathlib import Path

from portly.config import SYSTEM, APP_DIR, run_cmd

SERVICE_NAME = "portly"


def _exe_path():
    if getattr(sys, "frozen", False):
        return str(Path(sys.executable).resolve())
    return f'"{sys.executable}" "{Path(__file__).resolve()}"'


def service_install():
    exe = _exe_path()
    if SYSTEM == "Windows":
        nssm = shutil.which("nssm")
        if nssm:
            print(f"Installing '{SERVICE_NAME}' via nssm...")
            run_cmd([nssm, "install", SERVICE_NAME, exe])
            run_cmd([nssm, "set", SERVICE_NAME, "DisplayName", "Portly"])
            run_cmd([nssm, "set", SERVICE_NAME, "Start", "SERVICE_AUTO_START"])
            run_cmd([nssm, "set", SERVICE_NAME, "AppStdout", str(APP_DIR / "service.log")])
            run_cmd([nssm, "set", SERVICE_NAME, "AppStderr", str(APP_DIR / "service.log")])
            run_cmd([nssm, "start", SERVICE_NAME])
            print("Installed and started.")
        else:
            print("Install nssm first: winget install nssm")
    elif SYSTEM == "Linux":
        unit = f"[Unit]\nDescription=Portly\nAfter=network.target\n\n[Service]\nExecStart={exe}\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n"
        Path(f"/etc/systemd/system/{SERVICE_NAME}.service").write_text(unit)
        run_cmd(["systemctl", "daemon-reload"])
        run_cmd(["systemctl", "enable", "--now", SERVICE_NAME])
        print("Installed and started.")
    elif SYSTEM == "Darwin":
        plist = f'<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.portly</string><key>ProgramArguments</key><array><string>{exe}</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/></dict></plist>'
        p = Path.home() / "Library/LaunchAgents/com.portly.plist"
        p.write_text(plist)
        run_cmd(["launchctl", "load", str(p)])
        print("Installed and started.")


def service_uninstall():
    if SYSTEM == "Windows":
        nssm = shutil.which("nssm")
        if nssm:
            run_cmd([nssm, "stop", SERVICE_NAME])
            run_cmd([nssm, "remove", SERVICE_NAME, "confirm"])
        else:
            run_cmd(["sc", "stop", SERVICE_NAME])
            run_cmd(["sc", "delete", SERVICE_NAME])
    elif SYSTEM == "Linux":
        run_cmd(["systemctl", "disable", "--now", SERVICE_NAME])
        Path(f"/etc/systemd/system/{SERVICE_NAME}.service").unlink(missing_ok=True)
        run_cmd(["systemctl", "daemon-reload"])
    elif SYSTEM == "Darwin":
        p = Path.home() / "Library/LaunchAgents/com.portly.plist"
        run_cmd(["launchctl", "unload", str(p)])
        p.unlink(missing_ok=True)
    print(f"Service '{SERVICE_NAME}' removed.")
