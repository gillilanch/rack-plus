#!/usr/bin/env bash
# One-time Mac Studio setup: Homebrew deps, Postgres, .env, npm ci, migrate, builds, launcher perms.
# No Docker. Run:  chmod +x scripts/setup-mac-studio.sh && ./scripts/setup-mac-studio.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f backend/package.json ]] || [[ ! -f frontend/package.json ]]; then
  echo "error: run from Rack+ repo root (need backend/ and frontend/)." >&2
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Install Homebrew first:" >&2
  echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"' >&2
  exit 1
fi

echo "==> brew: Node, Git, PostgreSQL 16"
brew update
brew install node@22 git postgresql@16 || true
brew link node@22 --force --overwrite 2>/dev/null || true

echo "==> Start Postgres"
brew services start postgresql@16 || true
sleep 2

echo "==> Database rackapp"
createdb rackapp 2>/dev/null || true

USER_NAME="$(whoami)"
LOCAL_URL="postgresql://${USER_NAME}@localhost:5432/rackapp"
ENV_FILE="$REPO_ROOT/backend/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$REPO_ROOT/backend/.env.macstudio.example" ]]; then
    cp "$REPO_ROOT/backend/.env.macstudio.example" "$ENV_FILE"
  else
    cp "$REPO_ROOT/backend/.env.example" "$ENV_FILE"
  fi
fi
if grep -q '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null; then
  sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"${LOCAL_URL}\"|" "$ENV_FILE"
else
  printf '\nDATABASE_URL="%s"\n' "$LOCAL_URL" >>"$ENV_FILE"
fi

echo "==> Backend"
(cd "$REPO_ROOT/backend" && npm ci && npx prisma migrate deploy)

echo "==> Frontend"
(cd "$REPO_ROOT/frontend" && npm ci && npm run build)

echo "==> Backend build"
(cd "$REPO_ROOT/backend" && npm run build)

chmod +x "$REPO_ROOT/start.sh" 2>/dev/null || true
LAUNCHER="$REPO_ROOT/macos/Rack+.app/Contents/MacOS/rackplus"
if [[ -f "$LAUNCHER" ]]; then
  chmod +x "$LAUNCHER"
fi

echo ""
echo "Done. Start for LAN:"
echo "  cd \"$REPO_ROOT\" && ./start.sh"
echo ""
echo "Optional 24/7 (after this setup):"
echo "  chmod +x deploy/macos/install-launchagent.sh && ./deploy/macos/install-launchagent.sh"
