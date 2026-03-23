# Contributing to Portly

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/Bedri-B/Portly.git
cd Portly

# Python backend
pip install -r requirements.txt

# React dashboard
cd web && npm install && cd ..

# Run in dev mode
python -m portly
```

The dashboard dev server (with hot reload):

```bash
cd web
npm run dev
```

This proxies API requests to `http://localhost:19800`, so make sure portly is running.

## Project Structure

```
portly/            Python package
  config.py        Platform, paths, configuration
  cli.py           CLI entry point and commands
  server.py        Server launchers, PID management
  proxy.py         HTTP/HTTPS reverse proxy
  api.py           REST API endpoints
  web_server.py    Static file server + API proxy
  registry.py      Route registry (Docker, aliases, scanned)
  discovery.py     Docker discovery, port scanning
  tls.py           Certificate generation
  service.py       OS service install/uninstall
  updater.py       GitHub release update checker
scripts/           Build and install scripts
web/               React dashboard (Vite + TypeScript)
```

## Making Changes

1. **Fork** the repo and create a branch from `main`.
2. Make your changes. Keep commits focused and atomic.
3. If you changed Python code, make sure it compiles:
   ```bash
   python -m py_compile portly/<file>.py
   ```
4. If you changed the dashboard, make sure it builds:
   ```bash
   cd web && npm run build
   ```
5. Open a pull request against `main`.

## Code Style

- **Python**: Standard library only (no pip dependencies at runtime). Keep it simple.
- **TypeScript/React**: Follow the existing patterns. Functional components, React Query for data fetching.
- No over-engineering. Prefer clear, direct code over abstractions.

## What to Contribute

- Bug fixes
- New service discovery sources
- Dashboard improvements
- Platform support (better Linux/macOS service management)
- Documentation

## Reporting Issues

Use [GitHub Issues](https://github.com/Bedri-B/Portly/issues). Include:

- Your OS and version
- Steps to reproduce
- Expected vs actual behavior
- Logs if applicable (run with `portly --daemon` to see output)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
