# Portly

> Stop memorizing port numbers. Access every local service by name.

**Portly** is a local reverse proxy that lets you reach any service — Docker containers, dev servers, APIs — through clean URLs like `http://myapp.localhost` instead of `localhost:3000`.

No changes to how you start your services. No wrapping commands. Just run `portly` and add aliases.

```bash
portly alias myapp 3000
portly alias api 8080

curl http://myapp.localhost    # -> localhost:3000
curl https://api.localhost     # -> localhost:8080
```

## Install

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/Bedri-B/Portly/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/Bedri-B/Portly/main/install.ps1 | iex
```

Downloads the latest release, puts it on your PATH, ready to go.

## Uninstall

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/Bedri-B/Portly/main/uninstall.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/Bedri-B/Portly/main/uninstall.ps1 | iex
```

<details>
<summary>Manual install / build from source</summary>

Download a binary from [**Releases**](../../releases) and add it to your PATH, or build from source:

```bash
git clone https://github.com/Bedri-B/Portly.git && cd Portly
pip install pyinstaller
cd web && npm install && npm run build && cd ..
python build.py      # outputs dist/portly
```

Or run directly without building: `python app.py`

</details>

## How it works

```
http://myapp.localhost   ->  proxy (:80)   ->  localhost:3000
https://api.localhost    ->  proxy (:443)  ->  localhost:8080
```

Portly builds a route table from three sources:

| Source | Description |
|--------|-------------|
| **Aliases** | You map a name to a port: `portly alias myapp 3000` |
| **Docker** | Auto-discovers running containers with published ports |
| **Port scan** | Probes a list of ports you configure, registers what's listening |

The route table refreshes every 10 seconds. Aliases are persisted in `config.json`.

## CLI

```
portly                            Start proxy + open dashboard
portly --no-browser               Start without opening browser

portly alias <name> <port>        Map name.localhost -> localhost:port
portly alias <name> --remove      Remove an alias
portly aliases                    List all aliases with status

portly install                    Install as a system service
portly uninstall                  Remove system service
portly help                       Show help
```

## Dashboard

Portly ships with a web dashboard at `http://localhost:19802`:

- **Services** — all active routes with clickable URLs and source labels
- **Aliases** — add/remove aliases, configure port scanning
- **Settings** — domain suffix, ports, HTTPS toggle, Docker discovery

## Configuration

A `config.json` is created next to the binary on first run:

```json
{
  "proxy_port": 80,
  "https_port": 443,
  "domain": ".localhost",
  "https_enabled": true,
  "docker_discovery": true,
  "aliases": {},
  "scan_ports": []
}
```

| Key | Default | What it does |
|-----|---------|--------------|
| `proxy_port` | `80` | HTTP proxy. Set to 80 for portless URLs |
| `https_port` | `443` | HTTPS proxy |
| `domain` | `.localhost` | Suffix for service URLs |
| `https_enabled` | `true` | HTTPS with auto-generated certs |
| `docker_discovery` | `true` | Auto-detect Docker container ports |
| `aliases` | `{}` | Name-to-port mappings |
| `scan_ports` | `[]` | Ports to probe for running services |

Everything is also configurable from the dashboard.

## HTTPS

Enabled by default. Certs are auto-generated using the first available method:

1. [**mkcert**](https://github.com/FiloSottile/mkcert) — locally-trusted, no browser warnings
2. **openssl** — self-signed fallback
3. **Python cryptography** — last resort

Certs are stored in `certs/` next to the binary. If port 443 requires elevated privileges, the proxy falls back to `19444`.

## API

All endpoints are on the API port (default `19800`).

```bash
# List all services
curl localhost:19800/api/services

# Add an alias
curl -X POST localhost:19800/api/aliases -d '{"name":"myapp","port":3000}'

# Remove an alias
curl -X DELETE localhost:19800/api/aliases/myapp

# Get full status
curl localhost:19800/api/status
```

<details>
<summary>Full endpoint reference</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Services, config, aliases |
| `GET` | `/api/services` | All routed services |
| `GET` | `/api/aliases` | All aliases |
| `POST` | `/api/aliases` | Add alias |
| `DELETE` | `/api/aliases/{name}` | Remove alias |
| `POST` | `/api/refresh` | Force refresh routes |
| `GET` | `/api/config` | Current config |
| `PUT` | `/api/config` | Update config |
| `POST` | `/api/scan-ports` | Set scan ports |

</details>

## Running as a service

```bash
portly install      # auto-starts on boot
portly uninstall    # remove
```

Uses **nssm** on Windows, **systemd** on Linux, **launchd** on macOS.

## License

MIT
