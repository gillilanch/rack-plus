# Fox Mac Studio — handoff & troubleshooting

Operational reference for whoever maintains **Rack+** on the office Mac Studio. The main README still covers day-to-day dev; this page focuses on **LAN production**, **Postgres**, and **common failures**.

---

## New operator checklist

Use this on a **fresh clone** or when taking over the Studio.

1. Install **Node.js (LTS)**, **Git**, and **Homebrew Postgres** (e.g. `postgresql@16`). Run **`whoami`** — you will need that name for `DATABASE_URL`.
2. **Clone** the repo (`git clone` — not a ZIP). **`cd`** into it.
3. **`cp backend/.env.macstudio.example backend/.env`**. Edit **`DATABASE_URL`** (user from `whoami`), **`PORT`**, and optional catalog lines (see below).
4. Start Postgres: **`brew services start postgresql@16`** (or your version). **`createdb rackapp`** if the DB does not exist.
5. Build and migrate:

   ```bash
   cd backend && npm ci && npx prisma migrate deploy && npm run build
   cd ../frontend && npm ci && npm run build
   ```

6. From the **repo root**, run **`./start.sh`**. If Terminal says “Permission denied”, run **`chmod +x start.sh`** once.
7. Verify **`http://127.0.0.1:<PORT>/health`** returns **`"ok": true`**. Share the LAN URLs from the top of this doc with staff.

**After every `git pull` that changes code or dependencies:** repeat step 5 (at least `npm ci` where lockfiles changed, `prisma migrate deploy`, both **`npm run build`**), then restart **`./start.sh`** (or launchd / PM2).

**Google Sheet catalog:** if you set **`FOX_CATALOG_CSV_URL`**, the sheet must be shared **Anyone with the link → Viewer** so the server can fetch the CSV (see comments in `backend/.env.macstudio.example`).

---

## URLs (same port for UI + API)

With **`PORT=4000`** in `backend/.env` (default), staff typically use:

| Where | URL |
|--------|-----|
| **On the Mac Studio** | `http://127.0.0.1:4000` |
| **Other devices on the same LAN** | `http://Foxs-Mac-Studio.local:4000` |
| **By IP** | `http://10.231.208.225:4000` *(example; DHCP may assign a different IP — see below)* |

**If you change `PORT` in `backend/.env`**, replace `4000` everywhere above.

**Finding the current LAN IP** (on the Studio):

```bash
ipconfig getifaddr en0 || ipconfig getifaddr en1
```

`./start.sh` also prints “This Mac / Other devices / or use IP” using the same logic.

**Health check** (any device that can reach the server):

`http://<host>:<PORT>/health` → should return JSON with `"ok": true`.

**Admin tools** (server Mac only, not from other PCs): `http://localhost:<PORT>/admin`.

---

## One-time: get the code

```bash
cd ~/Downloads   # or your preferred folder
git clone https://github.com/seherallahbachayo/rack-.git rack-
cd rack-
```

Use SSH if you prefer: `git clone git@github.com:seherallahbachayo/rack-.git rack-`.

**Do not** rely on a ZIP download for updates — use **`git clone`** / **`git pull`** so `.env` stays local and the repo stays connected to GitHub.

---

## One-time: `backend/.env` on the Studio

1. Copy the template:

   ```bash
   cd rack-/backend
   cp .env.macstudio.example .env
   ```

2. Edit **`backend/.env`** (never commit this file).

3. **Required**

   - **`DATABASE_URL`** — PostgreSQL on **this Mac only**. Use your macOS login name (`whoami`), e.g. user `fnlaeng`:

     ```env
     DATABASE_URL="postgresql://fnlaeng@localhost:5432/rackapp"
     ```

   - **`PORT`** — e.g. `4000` (must match the URLs you give staff).

4. **Optional but common**

   - **`NODE_ENV=production`** when serving built `frontend/dist` from the backend (e.g. `./start.sh`).
   - **Catalog (Google Sheet → Postgres):** `FOX_CATALOG_CSV_URL`, `FOX_CATALOG_SYNC_INTERVAL_MS`, `FOX_CATALOG_SYNC_ON_STARTUP`, `FOX_CATALOG_PRUNE_ON_SYNC`, `CATALOG_WEBHOOK_SECRET` — see comments in `backend/.env.macstudio.example`.

**Same laptop vs Studio:** each machine uses **`localhost`** in `DATABASE_URL`, which always means **Postgres on that machine**. Copying `.env` from another computer is OK for **variable names**, but you must set **`DATABASE_URL`** to a user/database that exists **on this Mac** (see Postgres below).

---

## One-time: Postgres + Prisma

1. **Start Postgres** (Homebrew example):

   ```bash
   brew services start postgresql@16
   ```

   Adjust the version if you installed something else.

2. **Create the app database** (safe to run again):

   ```bash
   createdb rackapp
   ```

   If you see **`database "rackapp" already exists`**, that is fine — nothing to fix.

3. **Apply migrations** (from `backend/`):

   ```bash
   cd rack-/backend
   npm ci
   npx prisma migrate deploy
   ```

4. **Build** backend and frontend (from repo root or `backend` / `frontend` as shown in main README):

   ```bash
   cd rack-/backend && npm run build
   cd ../frontend && npm ci && npm run build
   cd ../backend && npm run build
   ```

---

## Running the app (production-style)

From the **repo root**, after builds exist:

```bash
./start.sh
```

Leave that Terminal window open, or use **launchd** / **PM2** as in the main README.

The script runs **`NODE_ENV=production`** and **`node backend/dist/server.js`** with cwd `backend/`, so the server loads **`backend/.env`**.

---

## Updating code from GitHub

```bash
cd rack-
git fetch origin
git pull origin main
```

If Git asks how to reconcile **divergent branches**, choose one policy (once):

```bash
git config pull.rebase false   # merge (common default)
git pull origin main
```

Or, if this Mac should **match GitHub exactly** and local commits can be discarded:

```bash
git fetch origin
git reset --hard origin/main
```

**After pulls** that change dependencies or lockfiles:

```bash
cd backend && npm ci && npx prisma migrate deploy && npm run build
cd ../frontend && npm ci && npm run build
```

If **`git pull`** complains that **`backend/package-lock.json`** would be overwritten, either:

```bash
git checkout -- backend/package-lock.json
git pull origin main
cd backend && npm ci
```

or stash, pull, then `npm ci` as needed.

---

## Troubleshooting

### `Environment variable not found: DATABASE_URL` (Prisma P1012)

- **`backend/.env` is missing or empty** — create it from `backend/.env.macstudio.example`.
- **`DATABASE_URL` line** must be present and valid.

### `User was denied access on the database` / Prisma errors on catalog sync

- **Wrong Postgres user** in `DATABASE_URL` — use the same name as `whoami` on the Studio (e.g. `fnlaeng`), or create a matching Postgres role.
- **Postgres not running** — `brew services list`, start the service.
- **Test the URL:**

  ```bash
  psql "postgresql://fnlaeng@localhost:5432/rackapp" -c "SELECT 1"
  ```

  If this fails, fix Postgres before debugging the app.

### Server listens, but Prisma still fails on requests

Older builds ran **`dotenv.config()` after** importing Prisma. The repo now loads env **first** via `backend/src/loadEnv.ts`. If you see this class of bug, **pull latest** and **`npm run build`** in `backend/`.

### “Wrong” port in the banner vs browser

- **`PORT`** in `backend/.env` controls the real port.
- **`./start.sh`** prints the same port as the server (resolved via Node + `dotenv` when possible). If in doubt, use the port in **`backend/.env`**.

### `(node) [DEP0040] DeprecationWarning: punycode`

Harmless Node.js warning from a dependency. Safe to ignore, or run with `NODE_NO_WARNINGS=1` if you want silence.

### Other devices cannot open the Mac by URL

- Same **Wi‑Fi / LAN** as the Studio.
- **Firewall** on macOS: allow incoming for the Node process / port if prompted.
- **IP changed** — use `Foxs-Mac-Studio.local` or re-check `ipconfig getifaddr`; consider a **DHCP reservation** for the Studio.

### `EADDRINUSE` / “port already in use”

Another process is using **`PORT`** (default `4000`). Stop the other **`node`** / old **`./start.sh`** Terminal, or set a different **`PORT`** in **`backend/.env`** and use that in all URLs.

### Git: “divergent branches”

See **Updating code** above (`git config pull.rebase false` or `git reset --hard origin/main`).

---

## Security reminders

- **`backend/.env` must stay out of git** (secrets, DB URL, webhooks). Do not remove `.env` from `.gitignore` to “make deploy easier.”
- **Admin** and destructive DB tools are restricted to **localhost** on purpose.

---

## See also

- [README.md](../README.md) — full run instructions, Docker, launchd, PM2
- [backend/.env.macstudio.example](../backend/.env.macstudio.example) — annotated template
- [macos/README.md](../macos/README.md) — Rack+.app
