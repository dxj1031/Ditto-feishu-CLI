#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Run bundled Node runtime if present, otherwise try system node
if [ -x "./runtime/node/bin/node" ]; then
  NODE_EXEC="./runtime/node/bin/node"
else
  NODE_EXEC="$(command -v node || true)"
fi

if [ -z "$NODE_EXEC" ]; then
  echo "Node runtime not found. Please install Node.js or include a Node runtime in ./runtime/node/"
  exit 1
fi

# If app is bundled as app/FeishuCLI.app, try to open it
if [ -d "app/FeishuCLI.app" ]; then
  if command -v open >/dev/null 2>&1; then
    open "app/FeishuCLI.app" >/dev/null 2>&1 || true
  fi
  exit 0
fi

# Fallback: run packaged start script via node
if [ -f "app/start.js" ]; then
  "$NODE_EXEC" app/start.js
  exit 0
fi

echo "No runnable app found."
exit 1
