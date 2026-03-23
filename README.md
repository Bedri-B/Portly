# DockerGlobal

A self-hosted Docker Compose management tool with a web dashboard and a portless reverse proxy. Manage all your compose stacks from a single UI, access containers by name instead of port numbers, and run it as a system service.

## Features

- **Web Dashboard** — React-based UI to manage all Docker Compose stacks in one place
- **Portless Reverse Proxy** — Access containers via `http://container_name.localhost` instead of remembering port numbers
- **Docker Desktop Control** — Start, stop, and restart Docker Desktop from the dashboard
- **Stack Management** — Start, stop, restart, and pull images for any compose stack
- **Config & .env Editor** — Edit compose files and environment variables in-browser
- **Live Logs** — View container logs directly from the dashboard
- **REST API** — Full programmatic control over all operations
- **System Service** — Install as a background service on Windows, Linux, or macOS
- **Single Binary** — Ships as one executable with the React dashboard bundled in

## Quick Start

### From Release

Download the latest binary from [Releases](../../releases) for your platform, place it on your PATH, and run:

```bash
docker-global
```

This starts all servers and opens the dashboard in your browser.

### From Source

```bash
# Clone
git clone https://github.com/Bedri-B/DockerGlobal.git
cd DockerGlobal

# Install Python dependencies
pip install pyinstaller

# Install and build the web dashboard
cd web
npm install
npm run build
cd ..

# Run directly
python app.py

# Or build the executable
python build.py
./dist/docker-global
```

## Architecture

DockerGlobal runs three servers:

| Server | Default Port | Purpose |
|--------|-------------|---------|
| **Dashboard** | `19802` | React web UI |
| **API** | `19800` | REST API for all operations |
| **Proxy** | `80` | Reverse proxy mapping `name.localhost` to container ports |

All ports and the domain suffix are configurable via `config.json` or the Settings page.

## Portless Reverse Proxy

Instead of remembering which service is on which port:

```
http://localhost:5435   →   http://global_postgres.localhost
http://localhost:6385   →   http://global_redis.localhost
http://localhost:5053   →   http://global_pgadmin.localhost
```

The proxy listens on port 80 by default so URLs are clean (no port suffix). If port 80 is unavailable, it falls back to `19801`.

**Fuzzy matching** is supported: `postgres.localhost` will match `global_postgres`.

## Configuration

A `config.json` file is created on first run next to the executable:

```json
{
  "proxy_port": 80,
  "domain": ".localhost",
  "api_port": 19800,
  "web_port": 19802
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `proxy_port` | `80` | Port for the reverse proxy. Use `80` for portless URLs |
| `domain` | `.localhost` | Domain suffix for service URLs |
| `api_port` | `19800` | Port for the REST API |
| `web_port` | `19802` | Port for the web dashboard |

Edit via the **Settings** tab in the dashboard or directly in the file. Port changes require a restart.

## CLI Usage

```bash
docker-global                # Start servers + open browser
docker-global --no-browser   # Start servers without opening browser (service mode)
docker-global install        # Install as a system service
docker-global uninstall      # Remove the system service
docker-global status         # Check service status
```

## Installing as a Service

### Windows

Requires [nssm](https://nssm.cc/) for best results:

```bash
winget install nssm
docker-global install
```

Or use `sc.exe` (run as Administrator):

```bash
docker-global install
```

### Linux

Installs a systemd unit:

```bash
sudo docker-global install
```

### macOS

Installs a launchd plist:

```bash
docker-global install
```

## REST API

All endpoints are served from the API port (default `19800`).

### Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Full status: Docker Desktop, all stacks, services, config |
| `GET` | `/api/stacks` | List all stack names |
| `GET` | `/api/services` | List all services with portless URLs |
| `GET` | `/api/config` | Current configuration |
| `POST` | `/api/refresh` | Force refresh all caches |

### Docker Desktop

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/docker/start` | Start Docker Desktop |
| `POST` | `/api/docker/stop` | Stop Docker Desktop |
| `POST` | `/api/docker/restart` | Restart Docker Desktop |

### Stack Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stacks/{name}/status` | Container status for a stack |
| `POST` | `/api/stacks/{name}/up` | Start a stack (`docker compose up -d`) |
| `POST` | `/api/stacks/{name}/down` | Stop a stack (`docker compose down`) |
| `POST` | `/api/stacks/{name}/restart` | Restart a stack |
| `POST` | `/api/stacks/{name}/pull` | Pull latest images |
| `GET` | `/api/stacks/{name}/logs?tail=200` | Get recent logs |
| `GET` | `/api/stacks/{name}/env` | Read `.env` file |
| `PUT` | `/api/stacks/{name}/env` | Write `.env` file |
| `GET` | `/api/stacks/{name}/config` | Read compose config |
| `PUT` | `/api/stacks/{name}/config` | Write compose config |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/api/config` | Update configuration |

## Building

### Local Build

```bash
# Build React frontend + Python executable
python build.py
```

The output is `dist/docker-global` (or `docker-global.exe` on Windows).

### CI/CD

Push a tag to trigger cross-platform builds:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This builds binaries for Windows, Linux, and macOS via GitHub Actions and creates a release.

## Project Structure

```
DockerGlobal/
├── app.py              # Python server: API + proxy + static file server
├── build.py            # Build script (React + PyInstaller)
├── requirements.txt    # Python dependencies
├── web/                # React + Vite + TypeScript dashboard
│   ├── src/
│   │   ├── pages/      # Overview, Services, Stacks, Settings
│   │   ├── lib/api.ts  # API client
│   │   └── ...
│   └── package.json
└── .github/
    └── workflows/
        └── build.yml   # Cross-platform CI build + release
```

## License

MIT
