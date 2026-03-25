#!/usr/bin/env bash
set -euo pipefail

# Portly development environment setup
# Run once after cloning: bash scripts/dev-setup.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Portly dev setup ==="
echo ""

# Python
echo "[1/3] Python environment"
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
  echo "  ERROR: Python 3 not found. Install it first."
  exit 1
fi

PY=$(command -v python3 || command -v python)
echo "  Using: $PY ($($PY --version 2>&1))"

echo "  Installing in editable mode..."
$PY -m pip install -e ".[dev]" --quiet 2>/dev/null || $PY -m pip install -e . --quiet

echo "  Done."
echo ""

# Node
echo "[2/3] Web dashboard"
if ! command -v node &>/dev/null; then
  echo "  WARNING: Node.js not found. Dashboard dev server won't work."
  echo "  Install it from https://nodejs.org/"
else
  echo "  Using: node $(node --version), npm $(npm --version)"
  echo "  Installing dependencies..."
  cd "$ROOT/web"
  npm install --silent
  echo "  Building dashboard..."
  npm run build --silent
  cd "$ROOT"
  echo "  Done."
fi
echo ""

# Summary
echo "[3/3] Ready!"
echo ""
echo "  Start developing:"
echo "    python -m portly              # Run server (foreground)"
echo "    python -m portly --daemon     # Run server (background, see output)"
echo ""
echo "  Frontend hot reload:"
echo "    cd web && npm run dev         # Vite dev server on :5173"
echo ""
echo "  Or run both at once:"
echo "    bash scripts/dev.sh"
echo ""
echo "  Run checks:"
echo "    python scripts/check.py"
echo ""
