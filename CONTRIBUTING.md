# Contributing to Portly

Thanks for your interest in contributing! Here's how to get started.

## Quick Start

```bash
git clone https://github.com/Bedri-B/Portly.git
cd Portly

# Automated setup (installs Python package + web dependencies + builds dashboard)
bash scripts/dev-setup.sh          # macOS/Linux
# or
powershell scripts/dev-setup.ps1   # Windows
```

This installs portly as an editable Python package, installs npm dependencies, and builds the dashboard.

## Running in Development

### Option 1: Both servers at once

```bash
python scripts/dev.py    # or: bash scripts/dev.sh
```

This starts:
- **Backend** on `http://localhost:19802` (API on `:19800`)
- **Frontend** on `http://localhost:5173` (Vite hot reload)

Use `http://localhost:5173` during development — it proxies `/api/*` to the backend and hot-reloads on file changes.

### Option 2: Separately

Terminal 1 — backend:
```bash
python -m portly --daemon    # foreground mode, shows logs
```

Terminal 2 — frontend:
```bash
cd web
npm run dev                  # Vite dev server on :5173
```

### Option 3: Backend only (no hot reload)

```bash
python -m portly             # starts + opens dashboard at :19802
```

Uses the pre-built dashboard from `web/dist/`. Rebuild after frontend changes:
```bash
cd web && npm run build
```

## Pre-commit Checks

Before submitting a PR, run the check script:

```bash
python scripts/check.py
```

This verifies:
- All Python modules compile
- Frontend builds without errors
- Required files exist

## Project Structure

```
portly/              Python package
  __init__.py
  __main__.py        Entry point for `python -m portly`
  cli.py             CLI commands (start, stop, alias, update, etc.)
  config.py          Platform detection, paths, config load/save
  server.py          HTTP server launchers, PID management
  api.py             REST API endpoints
  proxy.py           HTTP/HTTPS reverse proxy
  web_server.py      Dashboard static server + API proxy
  registry.py        Route registry (Docker + aliases + scanned ports)
  discovery.py       Docker discovery, parallel port scanning
  tls.py             Certificate generation + mkcert management
  service.py         OS service install/uninstall
  updater.py         GitHub release update checker
scripts/
  dev.py             Run backend + frontend concurrently
  dev.sh             Same, shell version
  dev-setup.sh       One-time setup (macOS/Linux)
  dev-setup.ps1      One-time setup (Windows)
  check.py           Pre-commit verification
  build.py           PyInstaller build (frontend + exe)
  install.sh/.ps1    User install scripts
  uninstall.sh/.ps1  User uninstall scripts
web/                 React dashboard (Vite + TypeScript)
  src/
    App.tsx          Router, sidebar layout
    lib/api.ts       API client, TypeScript interfaces
    pages/           Services, Aliases, Settings pages
```

## Making Changes

1. **Fork** the repo and create a branch from `main`.
2. Make your changes.
3. Run `python scripts/check.py` to verify.
4. Open a pull request against `main`.

## Architecture

```
┌──────────────────────────────────────────────────┐
│  CLI (cli.py)                                    │
│  portly start/stop/alias/update/...              │
└──────────────┬───────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────┐
│  Server (server.py)                              │
│  Spawns threads: API, Proxy, Dashboard, Refresh  │
└──────┬────────┬─────────┬────────┬───────────────┘
       │        │         │        │
  ┌────▼──┐ ┌──▼───┐ ┌───▼──┐ ┌──▼──────────┐
  │  API  │ │Proxy │ │ Web  │ │  Registry   │
  │:19800 │ │ :80  │ │:19802│ │  refresh()  │
  │       │ │ :443 │ │      │ │  every 10s  │
  └───────┘ └──────┘ └──┬───┘ └─────────────┘
                        │         │
                   /api/* proxy   │
                   to :19800   ┌──▼──────────┐
                               │  Discovery  │
                               │  Docker     │
                               │  Aliases    │
                               │  Port scan  │
                               └─────────────┘
```

**Key design decisions:**
- Backend is **stdlib only** — no pip dependencies at runtime
- Dashboard web server proxies `/api/*` to the API server, so production builds work on a single origin
- Port names for scanned services use deterministic word mapping (not `port-3000`)
- Config is a single JSON file, no env vars

## Code Style

- **Python**: Standard library only. No type: ignore unless necessary. Keep functions small.
- **TypeScript/React**: Functional components, React Query for data fetching, lucide-react for icons.
- No over-engineering. Three similar lines > premature abstraction.

## What to Contribute

- Bug fixes
- New service discovery sources
- Dashboard UX improvements
- Platform support (better Linux/macOS service management)
- Documentation
- Tests

## Reporting Issues

Use [GitHub Issues](https://github.com/Bedri-B/Portly/issues). Include:

- Your OS and version
- Portly version (`portly help`)
- Steps to reproduce
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
