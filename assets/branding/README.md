# Portly Branding

Portal-inspired logo mark — a gateway arch with traffic flowing through, services connecting from both sides.

## Files

| File | Purpose |
|------|---------|
| `portly-mark.svg` | Transparent logo mark (256x256) |
| `portly-app-icon.svg` | Square app icon with dark background (512x512) |
| `portly-logo-dark.svg` | Horizontal logo for dark backgrounds |
| `portly-logo-light.svg` | Horizontal logo for light backgrounds |
| `portly-doc-banner.svg` | Wide banner for docs, README, social previews |

The favicon lives at `web/public/favicon.svg` (32x32, optimized).

## Design

The mark is a rounded arch (portal/gateway) with:
- **Gradient stroke**: indigo (#6366f1) to violet (#a78bfa)
- **Flow dots** inside the arch: cyan → indigo → violet (traffic passing through)
- **Service nodes** on both sides: cyan, green, amber, red (connected services)
- **Connecting lines** from nodes to the arch walls

## Colors

| Color | Hex | Use |
|-------|-----|-----|
| Indigo | `#6366f1` | Primary, arch gradient start |
| Violet | `#a78bfa` | Arch gradient end |
| Sky blue | `#38bdf8` | Flow dot, service node |
| Emerald | `#34d399` | Service node |
| Amber | `#fbbf24` | Service node |
| Red | `#f87171` | Service node |
| Indigo muted | `#818cf8` | Secondary flow dot |

## Usage

- Dashboard sidebar: inline SVG via `PortlyLogo` React component
- Favicon: `web/public/favicon.svg`
- GitHub repo: use `portly-doc-banner.svg` as social preview
- README: reference `portly-logo-dark.svg`
