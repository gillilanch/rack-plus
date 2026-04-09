# Rack+ for Mac (double-click app)

## What this is

[`Rack+.app`](Rack+.app) is a small **launcher**, not a fully bundled runtime. It:

1. Starts the **production** backend (`NODE_ENV=production`, `backend/dist/server.js`) in the background if it is not already running.
2. Opens your browser to the app.

You still need **Node.js**, **`backend/.env`** (with `DATABASE_URL`), and **PostgreSQL** running (e.g. Homebrew `postgresql@16`, not Docker). Run **`npm ci`** / **`npm run build`** in `backend/` and `frontend/` once (see repo [README](../README.md)).

## Where to keep the app

Leave **`Rack+.app` inside this folder**: `rack+/macos/Rack+.app`.  
If you move only the `.app` elsewhere, it will not find the project.

## First launch (Gatekeeper)

If macOS blocks the app: **Control-click** → **Open** → **Open**.

## Make the launcher executable (if needed)

```bash
chmod +x macos/Rack+.app/Contents/MacOS/rackplus
```

## Stop the server

```bash
kill "$(cat "$HOME/Library/Application Support/Rack+/backend.pid")"
```

Or quit the `node` process in Activity Monitor. Logs: `~/Library/Application Support/Rack+/backend.*.log`
