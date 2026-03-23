# Portly

A portless reverse proxy for local development. Access any service — Docker containers, npm dev servers, APIs — via clean URLs like `http://myapp.localhost` instead of remembering port numbers.

## Features

- **Portless URLs** — `http://myapp.localhost` instead of `localhost:3000`
- **HTTPS** — Auto-generated TLS certs via mkcert or openssl: `https://myapp.localhost`
- **Docker auto-discovery** — Running containers with published ports are detected automatically
- **Static aliases** — Map any name to any local port, no command changes needed
- **Port scanning** — Auto-detect services on configured ports
- **Web dashboard** — Manage aliases, view all services, configure settings
- **REST API** — Full programmatic control
- **System service** — Run as a background service on Windows, Linux, or macOS
- **Single binary** — One executable with the dashboard bundled in

## Quick Start

```bash
# Download from Releases or build from source
portly

# Add an alias — no need to change how you start your app
portly alias myapp 3000
portly alias api 8080

# Now access them by name
curl http://myapp.localhost
curl https://api.localhost
```

Your existing `npm run dev`, `python manage.py runserver`, etc. stay exactly the same. Just add an alias and access by name.

## How It Works

```
http://myapp.localhost  ──→  reverse proxy (port 80)  ──→  localhost:3000
https://api.localhost   ──→  reverse proxy (port 443)  ──→  localhost:8080
```

Three sources feed the route table:

| Source | How it works |
|--------|-------------|
| **Docker** | Auto-discovers running containers with published ports |
| **Aliases** | Manual `name → port` mappings in config |
| **Port scan** | Probes configured ports, registers whatever is listening |

## Installation

### From Release

Download from [Releases](../../releases), add to PATH, run `portly`.

### From Source

```bash
git clone https://github.com/Bedri-B/Portly.git
cd Portly

pip install pyinstaller
cd web && npm install && npm run build && cd ..

# Run directly
python app.py

# Or build executable
python build.py
```

## CLI

```bash
portly                          # Start proxy + open dashboard
portly --no-browser             # Start without browser (service mode)

portly alias <name> <port>      # Map name.localhost -> localhost:port
portly alias <name> --remove    # Remove alias
portly aliases                  # List all aliases

portly install                  # Install as system service
portly uninstall                # Remove system service
portly help                     # Show help
```

## Configuration

Auto-created at `config.json` next to the executable:

```json
{
  "proxy_port": 80,
  "https_port": 443,
  "api_port": 19800,
  "web_port": 19802,
  "domain": ".localhost",
  "https_enabled": true,
  "docker_discovery": true,
  "aliases": {
    "myapp": 3000,
    "api": 8080
  },
  "scan_ports": [3000, 5173, 8080]
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `proxy_port` | `80` | HTTP proxy port (80 = no port in URLs) |
| `https_port` | `443` | HTTPS proxy port |
| `domain` | `.localhost` | Domain suffix (`.localhost`, `.local`, etc.) |
| `https_enabled` | `true` | Enable HTTPS proxy with auto-generated certs |
| `docker_discovery` | `true` | Auto-discover Docker container ports |
| `aliases` | `{}` | Static name-to-port mappings |
| `scan_ports` | `[]` | Ports to auto-scan for running services |

All settings are also editable from the web dashboard's **Settings** page.

## HTTPS

HTTPS is enabled by default on port 443. Certificates are auto-generated:

1. **mkcert** (recommended) — If installed, generates locally-trusted certs. Install: `brew install mkcert` / `choco install mkcert`
2. **openssl** — Falls back to self-signed certs (browser warning on first visit)
3. **Python** — Last resort, requires `cryptography` package

Certs are stored in `certs/` next to the executable.

## REST API

All endpoints on the API port (default `19800`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | All services, config, aliases |
| `GET` | `/api/services` | List all routed services |
| `GET` | `/api/aliases` | List aliases |
| `POST` | `/api/aliases` | Add alias `{"name": "x", "port": 3000}` |
| `DELETE` | `/api/aliases/{name}` | Remove alias |
| `POST` | `/api/refresh` | Force refresh route table |
| `GET` | `/api/config` | Current config |
| `PUT` | `/api/config` | Update config |
| `POST` | `/api/scan-ports` | Set scan ports `{"ports": [3000, 5173]}` |

## Dashboard

Open `http://localhost:19802` (auto-opens on start):

| Page | Purpose |
|------|---------|
| **Services** | All routed services with clickable URLs, source badges (Docker/Alias/Scan) |
| **Aliases** | Add/remove aliases, configure port scanning |
| **Settings** | Domain, ports, HTTPS toggle, Docker discovery toggle |

## Building

```bash
python build.py    # Builds React frontend + packages into single exe
```

## License

MIT
