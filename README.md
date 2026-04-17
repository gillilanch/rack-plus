# Rack+

Rack configure. Connect.

## Fox Mac Studio — URLs (with `PORT=4000` in `backend/.env`)

| | |
|--|--|
| **This Mac** | `http://127.0.0.1:4000` |
| **Other devices on the LAN** | `http://Foxs-Mac-Studio.local:4000` |
| **By IP** | `http://10.231.208.225:4000` *(example; DHCP may assign a different IP)* |

**Health check:** `http://<host>:4000/health` → should return `{"ok":true}`.  
If you change **`PORT`** in `backend/.env`, use that port in every URL above.

## LINK TO SPREADSHEET PULLING DATA FROM AVCAD
** https://docs.google.com/spreadsheets/d/13aci_txPa9jII7c7MccJdVHicMuQZQECIsBW6Ewof2c/edit?gid=1613961878#gid=1613961878 ** 
---

## **Production on the Mac Studio — run `./start.sh` (required)**

After **`backend/dist`** and **`frontend/dist`** exist and **`backend/.env`** is configured (Postgres + `DATABASE_URL`), start the app **from the repo root** with:

```bash
./start.sh
```

Leave that Terminal window open (or use launchd / PM2 below). This script runs the backend in production mode; it serves the **built** frontend and the **API** on **one port** (see URLs above). **Do not skip this step** when operating the shared Mac Studio server.

---

## Repo layout (short)

| | |
|--|--|
| **`backend/`** | Node **Express** API (`src/server.ts`, routes under `src/routes/`), **Prisma** (`prisma/`, `src/db/`, `src/repos/`), catalog sync, employees API. **`backend/.env`** holds secrets and `DATABASE_URL`. Production build output: **`backend/dist/`**. |
| **`frontend/`** | **Vite + React** SPA: UI under **`frontend/src/app/`** (components, pages, API client helpers). Dev server with hot reload; production build output: **`frontend/dist/`** (served by the backend when `NODE_ENV=production`). |

---

## DATABASE_URL and `whoami` — edit `backend/.env` on **this** Mac

PostgreSQL on your Mac is usually set up so the **database user name matches your macOS login**. Do **not** guess the name: open Terminal on the machine where the app runs and run:

```bash
whoami
```

Use that exact string as the username in **`DATABASE_URL`** inside **`backend/.env`** (replace `YOUR_USERNAME` in the templates):

```env
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/rackapp"
```

**Example:** if `whoami` prints `fnlaeng`, the line must be `postgresql://fnlaeng@localhost:5432/rackapp`. If you copy `.env` from another laptop or the Mac Studio, **edit this line on each computer** — login names differ, and a wrong user causes “access denied” / Prisma errors.

---

## How to run the app

**Environment files (pick one machine / mode):**

| Where | Copy this → `backend/.env` | Frontend dev only |
|-------|----------------------------|-------------------|
| **Fox Mac Studio** (production LAN) | [`backend/.env.macstudio.example`](backend/.env.macstudio.example) | not used (built SPA) |
| **Your laptop** (two terminals, `npm run dev`) | [`backend/.env.development.example`](backend/.env.development.example) | [`frontend/.env.development.example`](frontend/.env.development.example) → `frontend/.env.development` |

Or start from the generic [`backend/.env.example`](backend/.env.example) and edit by hand.

**Handoff / troubleshooting (Mac Studio, Postgres, git):** [`docs/MAC_STUDIO_HANDOFF.md`](docs/MAC_STUDIO_HANDOFF.md) — includes a **new operator checklist** and common errors.

---

### A) Development (on your computer)

You need **two terminals** and **Postgres** running (**Homebrew Postgres** on the Mac is the usual setup; match `DATABASE_URL` in `backend/.env`).

1. **First time on laptop:**  
   `cp backend/.env.development.example backend/.env` and  
   `cp frontend/.env.development.example frontend/.env.development`  
   Run **`whoami`**, then set **`DATABASE_URL`** in `backend/.env` to use that username (see **DATABASE_URL and `whoami`** above). If `PORT` in `backend/.env` is not `4000`, set the same value as `VITE_DEV_API_PORT` in `frontend/.env.development`.

2. **Start Postgres** (example — Homebrew):

   ```bash
   brew services start postgresql@16
   ```

   Create the DB once if needed: `createdb rackapp`.

3. **Terminal 1 — backend** (folder `backend/`):

   ```bash
   npm ci
   npx prisma migrate deploy
   npm run dev
   ```

4. **Terminal 2 — frontend** (folder `frontend/`):

   ```bash
   npm ci
   npm run dev
   ```

5. Open the app at the URL **Vite prints** (usually **http://localhost:5173**).

---

### B) Production (one Mac server, everyone else uses a browser)

All commands from the **repo root** unless noted.

1. **Postgres** on the server Mac: e.g. `brew services start postgresql@16`. Run **`whoami`** on **that** Mac and put the result into **`DATABASE_URL`** in `backend/.env` (see **DATABASE_URL and `whoami`** above). Use `createdb rackapp` if the database does not exist yet.

2. Install dependencies, migrate, and build:

   ```bash
   cd backend && npm ci && npx prisma migrate deploy
   cd ../frontend && npm ci && npm run build
   cd ../backend && npm run build
   ```

3. **Run the server** — from the **repo root**:

   ```bash
   ./start.sh
   ```

   **This is the standard way to run production on the Mac Studio** (API + static UI on one port). Alternatively: `cd backend && NODE_ENV=production npm start` after `cd backend` (same effect if builds exist).

4. **On other computers on the same network:** use the URLs at the **top of this README** (or your Mac’s current LAN IP / `.local` name).

5. **Check it’s working:** `http://…/health` — you should see `{"ok":true}`.

**Admin (only on the server Mac):** `http://localhost:4000/admin` — delete racks, wipe all, restart (see below).

### C) Double-click on Mac (after production build)

Once **`backend/dist`** and **`frontend/dist`** exist (same builds as **B**), you can open **[`macos/Rack+.app`](macos/Rack+.app)** in Finder. It starts the server in the background (if needed) and opens the browser. Keep the app **inside** `macos/` next to the repo. Details: [`macos/README.md`](macos/README.md).

---

## More detail

### Environment variables (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string — username should match **`whoami`** on the machine running Postgres (see **DATABASE_URL and `whoami`** above) |
| `PORT` | HTTP port (default `4000`) |
| `NODE_ENV` | Use `production` when running **B)** so the server serves the built frontend |
| `FRONTEND_DIST` | Optional absolute path to `frontend/dist` if not next to the repo layout |
| `ADMIN_TOKEN` | Optional; if set, admin API needs `Authorization: Bearer …` or `X-Admin-Token` |

### Production notes (Mac Studio / shared LAN)

- Install **Node.js LTS** and **Git** on the server Mac. **Postgres** is typically **Homebrew** (`postgresql@16` or similar); configure `DATABASE_URL` accordingly.
- For a shared office network, prefer a **DHCP reservation** or static LAN IP for the server Mac.
- Optional: **Docker Compose** in this repo can run Postgres instead — see [`docker-compose.yml`](docker-compose.yml) and point `DATABASE_URL` at that container if you use it.

### Admin console (this Mac only)

Open **`http://localhost:<PORT>/admin`** in a browser **on the server Mac** (not from another device).

- Remote browsers get **403** on `/admin` by design.
- **Restart** exits the Node process; use **launchd** or **PM2** (below) if you want it to come back automatically.

### After you change code (production)

```bash
git pull
cd backend && npm ci && npx prisma migrate deploy && npm run build
cd ../frontend && npm ci && npm run build
# Then restart: ./start.sh again, or launchctl / pm2 — see below
```

### Data tools

- **Prisma Studio** (from `backend/`): `npx prisma studio`
- **Backup DB** (example, Homebrew / local Postgres): `pg_dump rackapp > backup.sql` (adjust user/host as needed)

### Ops tips

- Adjust **Energy** so the Mac does not sleep if you need 24/7 access.
- Allow the app **TCP port** in the macOS firewall if prompted.

---

## Run 24/7 with low maintenance (Mac Studio “appliance”)

Goal: the app **starts after login** and **restarts if Node crashes**, without leaving Terminal open.

### 1. Postgres (Homebrew)

Keep Postgres running, e.g. `brew services start postgresql@16`. Ensure `DATABASE_URL` in `backend/.env` matches.

*(Optional: **Docker** — `docker compose up -d` from the repo root if you prefer containerized Postgres; set `DATABASE_URL` to match [`docker-compose.yml`](docker-compose.yml).)*

### 2. Node backend (launchd — recommended on macOS)

After you have done **B)** once (builds exist):

```bash
./deploy/macos/install-launchagent.sh
```

- **Logs:** `~/Library/Logs/RackPlus/backend.{out,err}.log`
- **After code updates:** `cd backend && npm run build` then  
  `launchctl kickstart -k gui/$(id -u)/com.rackplus.backend`
- **Uninstall:** `./deploy/macos/uninstall-launchagent.sh`

**Node path:** `launchd` does not load `.zshrc`. Prefer **Homebrew Node**, or run the install script from a shell where **nvm** works.

### 3. Alternative: PM2

```bash
npm install -g pm2
cd /path/to/rack+/backend
NODE_ENV=production pm2 start dist/server.js --name rackplus
pm2 save
pm2 startup   # run the command it prints (often needs sudo)
```

### Handoff quick reference

**Fox Mac Studio (LAN URLs, Postgres, `backend/.env`, git pull issues):** **[`docs/MAC_STUDIO_HANDOFF.md`](docs/MAC_STUDIO_HANDOFF.md)**.

| Problem | Try |
|---------|-----|
| Site down | `http://<server>:<PORT>/health` → `{"ok":true}`? |
| DB down | Postgres running? `brew services list` — or your Docker stack if you use it |
| API down | `./start.sh` running? Or `launchctl kickstart -k gui/$(id -u)/com.rackplus.backend` / `pm2 restart rackplus` |

**Admin:** `http://localhost:<PORT>/admin` on the server Mac only.
