# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-23

### Added
- Reverse proxy mapping `name.localhost` to `localhost:port`
- Docker container auto-discovery
- Static alias management (`portly alias myapp 3000`)
- Smart port scanning: common dev ports, custom ranges, parallel probing
- HTTPS support with auto-generated certificates (mkcert, openssl, or Python fallback)
- Web dashboard with Services, Aliases, and Settings pages
- REST API for all operations
- Background server mode with PID tracking
- `start`, `stop`, `restart`, `status` CLI commands
- Auto-start on boot via system service (Windows/Linux/macOS)
- Update checker and installer via GitHub Releases
- Auto-update option (disabled by default, checks hourly)
- Cross-platform support: Windows, Linux, macOS
- Single binary distribution via PyInstaller
- Install/uninstall scripts for all platforms
