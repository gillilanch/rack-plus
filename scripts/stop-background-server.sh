#!/usr/bin/env bash
# Stops Node started by macos/Rack+.app (pid file).
set -euo pipefail
PID_FILE="${HOME}/Library/Application Support/Rack+/backend.pid"
if [[ ! -f "$PID_FILE" ]]; then
  echo "Nothing to stop ($PID_FILE missing)."
  exit 0
fi
PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID" && rm -f "$PID_FILE" && echo "Stopped $PID."
else
  rm -f "$PID_FILE" && echo "Removed stale pid file."
fi
