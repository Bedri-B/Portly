"""Pre-commit checks: compile Python, build frontend, verify structure.

Usage: python scripts/check.py
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
WEB_DIR = ROOT / "web"
PORTLY_DIR = ROOT / "portly"

RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RESET = "\033[0m"
CHECK = f"{GREEN}OK{RESET}"
CROSS = f"{RED}FAIL{RESET}"

errors = 0


def run(label, cmd, cwd=None):
    global errors
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=60)
        if r.returncode == 0:
            print(f"  {CHECK} {label}")
        else:
            print(f"  {CROSS} {label}")
            if r.stderr.strip():
                for line in r.stderr.strip().splitlines()[:5]:
                    print(f"      {line}")
            errors += 1
    except Exception as e:
        print(f"  {CROSS} {label}: {e}")
        errors += 1


def main():
    global errors
    print("\n  portly checks\n")

    # Python compile checks
    print(f"  {YELLOW}Python{RESET}")
    for py in sorted(PORTLY_DIR.glob("*.py")):
        run(f"compile {py.name}", [sys.executable, "-m", "py_compile", str(py)])

    # Frontend build
    print(f"\n  {YELLOW}Frontend{RESET}")
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    if (WEB_DIR / "node_modules").exists():
        run("tsc type-check", [npm, "run", "build"], cwd=str(WEB_DIR))
    else:
        print(f"  {YELLOW}SKIP{RESET} (run npm install first)")

    # Structure checks
    print(f"\n  {YELLOW}Structure{RESET}")
    expected = [
        "portly/__init__.py", "portly/__main__.py", "portly/cli.py",
        "portly/config.py", "portly/server.py", "portly/api.py",
        "portly/proxy.py", "portly/registry.py", "portly/discovery.py",
        "portly/tls.py", "portly/service.py", "portly/updater.py",
        "portly/web_server.py",
        "web/package.json", "web/src/App.tsx", "web/src/lib/api.ts",
        "README.md", "LICENSE", "CONTRIBUTING.md",
    ]
    for f in expected:
        p = ROOT / f
        if p.exists():
            print(f"  {CHECK} {f}")
        else:
            print(f"  {CROSS} {f} missing")
            errors += 1

    # Summary
    print()
    if errors:
        print(f"  {CROSS} {errors} error(s) found\n")
        sys.exit(1)
    else:
        print(f"  {CHECK} All checks passed\n")


if __name__ == "__main__":
    main()
