#!/usr/bin/env bash
# Launcher: run the setup script, then try to open any generated .app
DIR="$(cd "$(dirname "$0")" && pwd)"

# Run the main setup script (do not exec so we can continue)
"$DIR/start-feishu-cli-setup.sh"

# Common locations for a built app. Adjust names if you change packager outputs.
APP_CANDIDATES=(
	"$DIR/FeishuCLI.app"
	"$DIR/dist/FeishuCLI-darwin-x64/FeishuCLI.app"
	"$DIR/dist/FeishuCLI-darwin-arm64/FeishuCLI.app"
	"$DIR/dist/FeishuCLI/FeishuCLI.app"
)

for APP in "${APP_CANDIDATES[@]}"; do
	if [ -d "$APP" ]; then
		# Try to remove Gatekeeper quarantine attribute (best-effort).
		if command -v xattr >/dev/null 2>&1; then
			xattr -d com.apple.quarantine "$APP" >/dev/null 2>&1 || true
		fi
		# Open the app
		if command -v open >/dev/null 2>&1; then
			open "$APP" >/dev/null 2>&1 || true
		fi
		exit 0
	fi
done

exit 0
