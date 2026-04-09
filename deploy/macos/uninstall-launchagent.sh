#!/usr/bin/env bash
set -euo pipefail

PLIST_DST="${HOME}/Library/LaunchAgents/com.rackplus.backend.plist"

if [[ ! -f "$PLIST_DST" ]]; then
  echo "Nothing to remove: $PLIST_DST not found."
  exit 0
fi

UID_NUM="$(id -u)"
launchctl bootout "gui/${UID_NUM}" "$PLIST_DST" 2>/dev/null || launchctl unload "$PLIST_DST" 2>/dev/null || true
rm -f "$PLIST_DST"
echo "Removed LaunchAgent com.rackplus.backend."
