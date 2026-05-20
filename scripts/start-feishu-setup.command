#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_VERSION="v24.15.0"
NODE_DIST_URL="https://nodejs.org/dist/${NODE_VERSION}"
NODE_SHA_ARM64="372331B969779AB5D15B949884FC6EAF88D5AFE87BDE8BA881D6400B9100FFC4"
NODE_SHA_X64="FFD5EE293467927F3EE731A553EB88FD1F48CF74EEBC2D74A6BABE4AF228673B"
NODE_EXEC=""
NODE_HOME=""

if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$DIR" >/dev/null 2>&1 || true
fi

case "$(uname -m)" in
  arm64)
    NODE_ARCH="arm64"
    ;;
  x86_64)
    NODE_ARCH="x64"
    ;;
  *)
    NODE_ARCH=""
    ;;
esac

if [ -n "${NODE_ARCH:-}" ]; then
  NODE_HOME="$DIR/runtime/node-${NODE_VERSION}-darwin-${NODE_ARCH}"
  NODE_TARBALL="$DIR/runtime/node-${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz"

  if [ -x "$NODE_HOME/bin/node" ]; then
    NODE_EXEC="$NODE_HOME/bin/node"
    export PATH="$NODE_HOME/bin:$PATH"
  fi
fi

if [ -z "$NODE_EXEC" ] && [ "${FEISHU_SETUP_FORCE_NODE_DOWNLOAD:-}" != "1" ]; then
  NODE_EXEC="$(command -v node || true)"
fi

if [ -z "$NODE_EXEC" ] && [ -n "${NODE_ARCH:-}" ]; then
  if ! command -v curl >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
    echo "Node.js is missing and this Mac does not have curl/tar available for automatic download."
  else
    mkdir -p "$DIR/runtime"
    NODE_URL="${NODE_DIST_URL}/node-${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz"
    NODE_TMP="${NODE_TARBALL}.tmp"
    EXPECTED_SHA="$NODE_SHA_X64"
    if [ "$NODE_ARCH" = "arm64" ]; then
      EXPECTED_SHA="$NODE_SHA_ARM64"
    fi

    echo "Node.js runtime was not found. Downloading ${NODE_VERSION} for macOS ${NODE_ARCH}..."
    curl -L "$NODE_URL" -o "$NODE_TMP"

    if [ "${FEISHU_SETUP_SKIP_NODE_SHA:-}" != "1" ] && command -v shasum >/dev/null 2>&1; then
      ACTUAL_SHA="$(shasum -a 256 "$NODE_TMP" | awk '{print toupper($1)}')"
      if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
        rm -f "$NODE_TMP"
        echo "Downloaded Node.js checksum mismatch."
        echo "Expected: $EXPECTED_SHA"
        echo "Actual:   $ACTUAL_SHA"
        exit 1
      fi
    fi

    mv "$NODE_TMP" "$NODE_TARBALL"
    echo "Node.js downloaded and verified. Extracting runtime..."
    tar -xzf "$NODE_TARBALL" -C "$DIR/runtime"

    if [ -x "$NODE_HOME/bin/node" ]; then
      NODE_EXEC="$NODE_HOME/bin/node"
      export PATH="$NODE_HOME/bin:$PATH"
    fi
  fi
fi

if [ -z "$NODE_EXEC" ]; then
  echo "Node.js runtime was not found."
  echo "Install Node.js LTS from https://nodejs.org/ or run again with a working network connection."
  if command -v open >/dev/null 2>&1; then
    open "https://nodejs.org/en/download" >/dev/null 2>&1 || true
  fi
  STATUS=1
else
  export FEISHU_SETUP_WORKSPACE="${FEISHU_SETUP_WORKSPACE:-$HOME/feishu-CLI}"
  set +e
  "$NODE_EXEC" "$DIR/app/terminal-setup.mjs"
  STATUS=$?
  set -e
fi

if [ -t 0 ] && [ "${FEISHU_SETUP_NO_PAUSE:-}" != "1" ]; then
  echo ""
  printf "Press Enter to close this window..."
  read -r _ || true
fi

exit "$STATUS"
