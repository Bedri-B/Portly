# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | Yes                |
| < 1.0   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email the maintainer or use [GitHub's private vulnerability reporting](https://github.com/Bedri-B/Portly/security/advisories/new).
3. Include a description of the vulnerability, steps to reproduce, and potential impact.

You should receive a response within 48 hours. We will work with you to understand and address the issue before any public disclosure.

## Scope

Portly runs as a local service on your machine. Key security considerations:

- **Network exposure**: By default, portly binds to `0.0.0.0` — it listens on all interfaces. On trusted networks this is fine; on untrusted networks, consider firewall rules.
- **No authentication**: The API and dashboard have no auth. They are designed for local development use only.
- **TLS certificates**: Auto-generated self-signed certs are for local dev convenience, not production security.
- **Config file**: `config.json` is stored in plain text next to the binary.

Portly is a development tool and is not designed for production or public-facing deployments.
