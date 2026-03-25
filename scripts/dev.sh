#!/usr/bin/env bash
set -euo pipefail

# Run backend + frontend dev servers concurrently.
# Usage: bash scripts/dev.sh
# Ctrl+C stops both.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  echo ""
  echo "  Stopping..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo ""
echo "  portly dev"
echo ""

# Backend
echo "  Starting backend..."
cd "$ROOT"
python -m portly --daemon &
BACKEND_PID=$!
sleep 1

# Frontend
echo "  Starting frontend (Vite)..."
echo ""
cd "$ROOT/web"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:   http://localhost:19802  (API: :19800)"
echo "  Frontend:  http://localhost:5173   (hot reload)"
echo "  Press Ctrl+C to stop both."
echo ""

wait
