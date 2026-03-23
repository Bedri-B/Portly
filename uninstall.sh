#!/usr/bin/env bash
set -euo pipefail

# Portly uninstaller

INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BIN="$INSTALL_DIR/portly"

# Stop service if running
portly uninstall 2>/dev/null || true

if [ -f "$BIN" ]; then
  if [ -w "$INSTALL_DIR" ]; then
    rm -f "$BIN"
  else
    sudo rm -f "$BIN"
  fi
  echo "Removed $BIN"
else
  echo "portly not found at $BIN"
fi

echo "Uninstalled."
