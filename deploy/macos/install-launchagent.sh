#!/usr/bin/env bash
# Installs a LaunchAgent so the Rack+ backend runs at login, restarts on crash,
# and survives closing Terminal. Run once from a shell where `node` resolves correctly.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="${REPO_ROOT%/}"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found in PATH. Install Node (e.g. Homebrew) or fix PATH, then re-run." >&2
  exit 1
fi

NODE_BIN="$(command -v node)"
NODE_REAL="$(cd "$(dirname "$NODE_BIN")" && pwd)/$(basename "$NODE_BIN")"
BACKEND_DIR="$REPO_ROOT/backend"
DIST_JS="$BACKEND_DIR/dist/server.js"

if [[ ! -f "$DIST_JS" ]]; then
  echo "error: missing $DIST_JS — from backend/: run npm ci && npm run build" >&2
  exit 1
fi

LOG_DIR="${HOME}/Library/Logs/RackPlus"
mkdir -p "$LOG_DIR"

AGENT_DIR="${HOME}/Library/LaunchAgents"
mkdir -p "$AGENT_DIR"
PLIST_DST="${AGENT_DIR}/com.rackplus.backend.plist"

TMP_PLIST="$(mktemp)"
trap 'rm -f "$TMP_PLIST"' EXIT

cat >"$TMP_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.rackplus.backend</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_REAL}</string>
    <string>dist/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${BACKEND_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/backend.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/backend.err.log</string>
</dict>
</plist>
EOF

plutil -lint "$TMP_PLIST" >/dev/null
cp "$TMP_PLIST" "$PLIST_DST"

# Reload if already registered
UID_NUM="$(id -u)"
if launchctl print "gui/${UID_NUM}/com.rackplus.backend" &>/dev/null; then
  launchctl bootout "gui/${UID_NUM}" "$PLIST_DST" 2>/dev/null || launchctl unload "$PLIST_DST" 2>/dev/null || true
fi
if launchctl bootstrap "gui/${UID_NUM}" "$PLIST_DST" 2>/dev/null; then
  :
else
  launchctl load -w "$PLIST_DST"
fi

echo "Installed LaunchAgent: $PLIST_DST"
echo "  Node:  $NODE_REAL"
echo "  Cwd:   $BACKEND_DIR"
echo "  Logs:  $LOG_DIR/backend.{out,err}.log"
echo "After code updates: rebuild backend (npm run build in backend/) then:"
echo "  launchctl kickstart -k gui/${UID_NUM}/com.rackplus.backend"
