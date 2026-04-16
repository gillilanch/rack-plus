#!/usr/bin/env bash
# Start Rack+ for the LAN (no Docker). Postgres must already be running (e.g. Homebrew postgresql@16).
# One-time: backend/.env with DATABASE_URL, then npm ci + migrate + build backend and frontend.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -f "$ROOT/backend/dist/server.js" ]]; then
  echo "Missing backend build. Run:"
  echo "  cd backend && npm ci && npx prisma migrate deploy && npm run build"
  echo "  cd ../frontend && npm ci && npm run build"
  exit 1
fi

if [[ ! -f "$ROOT/frontend/dist/index.html" ]]; then
  echo "Missing frontend build. Run:"
  echo "  cd frontend && npm ci && npm run build"
  exit 1
fi

PORT=4001
if [[ -f "$ROOT/backend/.env" ]] && grep -q '^PORT=' "$ROOT/backend/.env"; then
  PORT="$(grep '^PORT=' "$ROOT/backend/.env" | head -1 | cut -d= -f2 | tr -d ' "'\''')"
fi

cd "$ROOT/backend"
export NODE_ENV=production

echo ""
echo "Rack+ is running — leave this window open."
echo "  This Mac:        http://127.0.0.1:${PORT}"
LAN_NAME="$(scutil --get LocalHostName 2>/dev/null || hostname | sed 's/\..*//')"
echo "  Other devices:   http://${LAN_NAME}.local:${PORT}"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [[ -n "$IP" ]]; then
  echo "  (or use IP)      http://${IP}:${PORT}"
fi
echo ""

exec node dist/server.js
