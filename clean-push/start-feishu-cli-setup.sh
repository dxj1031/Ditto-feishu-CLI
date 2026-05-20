#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

open_url() {
  if command -v open >/dev/null 2>&1; then
    open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1 || true
  else
    printf '%s\n' "$1"
  fi
}

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is missing."
  if command -v brew >/dev/null 2>&1; then
    echo "Installing Node.js with Homebrew..."
    brew install node
  else
    echo "Opening Node.js download page. Install Node.js LTS, then run this launcher again."
    open_url "https://nodejs.org/"
    exit 1
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is missing. Install Node.js LTS with npm, then run this launcher again."
  open_url "https://nodejs.org/"
  exit 1
fi

if [ ! -d "node_modules/electron" ]; then
  echo "Installing setup window dependencies..."
  npm install
fi

npm start
