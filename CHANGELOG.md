# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-03-25

### Added
- **Dashboard at `portly.localhost`** — access via the proxy, no more raw port URLs
- **Restart from dashboard** — restart button in sidebar, full-screen overlay during restart
- **Service cards** — card-based grid layout showing both HTTP and HTTPS URLs with copy-to-clipboard
- **Shortcuts** — create short aliases for long Docker names (e.g. `pgadmin` → `global_pgadmin`)
- **Docker prefix stripping** — set `docker_strip_prefix` to auto-shorten container names
- **Memorable port names** — scanned ports get word names (`spark.localhost`) instead of `port-3000`
- **One-click HTTPS setup** — installs mkcert, root CA, and generates trusted certs from the dashboard
- **Full certificate management** — view cert info, regenerate, remove, all from Settings
- **Domain-aware certs** — certificates cover your configured domain, not just `.localhost`
- **Dev tooling** — `scripts/dev.py` (concurrent servers), `scripts/dev-setup.sh`, `scripts/check.py`
- **`pyproject.toml`** — proper Python packaging with `pip install -e .` support
- **Open-source files** — CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, issue/PR templates, FUNDING.yml

### Changed
- **HTTPS off by default** — enable via dashboard or config (was on by default)
- **CLI exits immediately** — `portly` starts background server, prints URL, opens browser, exits
- **Reorganized into `portly/` package** — split monolith `app.py` into 12 focused modules
- **Scripts moved to `scripts/`** — build, install, dev tooling all in one place
- **UI/UX overhaul** — refined dark theme, wider sidebar, larger typography, animated cards
- **README rewritten** — badges, table of contents, comprehensive docs, development section

### Fixed
- Dashboard no longer flashes "Loading" on every refetch (placeholderData keeps cached content visible)
- `/api/*` requests on dashboard port now proxy to API server instead of returning HTML

## [2.1.0] - 2026-03-23

### Added
- Smart port scanning: common dev ports, custom ranges, parallel probing

## [2.0.0] - 2026-03-23

### Changed
- Refocused as portless proxy: removed Docker management, added aliases, HTTPS, port scanning

## [1.0.0] - 2026-03-23

### Added
- Initial release
- Reverse proxy mapping `name.localhost` to `localhost:port`
- Docker container auto-discovery
- Web dashboard
- REST API
