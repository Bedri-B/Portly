#!/usr/bin/env bash
set -euo pipefail

# Portly installer — downloads the latest release binary for your platform.

REPO="Bedri-B/Portly"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux*)   PLATFORM="linux-amd64" ;;
  Darwin*)  PLATFORM="macos-arm64" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows-amd64" ;;
  *)        echo "Unsupported OS: $OS"; exit 1 ;;
esac

echo "Portly installer"
echo "  Platform: $PLATFORM"
echo "  Install to: $INSTALL_DIR"
echo

# Get latest release tag
TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | cut -d'"' -f4)
if [ -z "$TAG" ]; then
  echo "Error: Could not find latest release."
  exit 1
fi
echo "  Latest release: $TAG"

# Download
URL="https://github.com/$REPO/releases/download/$TAG/portly-$PLATFORM"
if [ "$PLATFORM" = "windows-amd64" ]; then
  URL="${URL}.exe"
fi

TMP=$(mktemp)
echo "  Downloading $URL ..."
curl -fsSL -o "$TMP" "$URL"

# Install
if [ "$PLATFORM" = "windows-amd64" ]; then
  DEST="$INSTALL_DIR/portly.exe"
else
  chmod +x "$TMP"
  DEST="$INSTALL_DIR/portly"
fi

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP" "$DEST"
else
  echo "  Need sudo to install to $INSTALL_DIR"
  sudo mv "$TMP" "$DEST"
  sudo chmod +x "$DEST"
fi

echo
echo "Installed portly to $DEST"
echo "Run 'portly' to start."
