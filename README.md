# Rack+

Rack configure. Connect.

## How to run the app

**Before anything else:** copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and set `DATABASE_URL` (defaults match Docker Postgres below).

---

### A) Development (on your computer)

You need **two terminals** and **Postgres** running.

1. Start Postgres (from the **repo root**):

   ```bash
   docker compose up -d
   ```

2. **Terminal 1 — backend** (folder `backend/`):

   ```bash
   npm ci
   npx prisma migrate deploy
   npm run dev
   ```

3. **Terminal 2 — frontend** (folder `frontend/`):

   ```bash
   npm ci
   npm run dev
   ```

4. Open the app in your browser at the URL **Vite prints** (usually **http://localhost:5173**).

---

### B) Production (one Mac server, everyone else uses a browser)

All commands from the **repo root** unless noted.

1. Start Postgres:

   ```bash
   docker compose up -d
   ```

2. Install dependencies, migrate, build, run **one** server (API + website on the same port):

   ```bash
   cd backend && npm ci && npx prisma migrate deploy
   cd ../frontend && npm ci && npm run build
   cd ../backend && npm run build && NODE_ENV=production npm start
   ```

3. **On other computers on the same network:** open  
   `http://<this-Mac’s-name>.local:4000`  
   or `http://<this-Mac’s-LAN-IP>:4000`  
   (change the port in `backend/.env` if you changed `PORT`).

4. **Check it’s working:** open `http://…/health` — you should see `{"ok":true}`.

**Admin (only on the server Mac):** `http://localhost:4000/admin` — delete racks, wipe all, restart (see below).

### C) Double-click on Mac (after production build)

Once **`backend/dist`** and **`frontend/dist`** exist (same builds as **B**), you can open **[`macos/Rack+.app`](macos/Rack+.app)** in Finder. It starts the server in the background (if needed) and opens the browser. Keep the app **inside** `macos/` next to the repo. Details: [`macos/README.md`](macos/README.md).

---

## More detail

### Environment variables (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | HTTP port (default `4000`) |
| `NODE_ENV` | Use `production` when running **B)** so the server serves the built frontend |
| `FRONTEND_DIST` | Optional absolute path to `frontend/dist` if not next to the repo layout |
| `ADMIN_TOKEN` | Optional; if set, admin API needs `Authorization: Bearer …` or `X-Admin-Token` |

### Production notes (Mac Studio / shared LAN)

- Install **Node.js LTS**, **Git**, and **Docker Desktop** (for Postgres) on the server Mac.
- For a shared office network, **change the default Postgres password** in [`docker-compose.yml`](docker-compose.yml) and use the same password in `DATABASE_URL`.

### Admin console (this Mac only)

Open **`http://localhost:<PORT>/admin`** in a browser **on the server Mac** (not from another device).

- Remote browsers get **403** on `/admin` by design.
- **Restart** exits the Node process; use **launchd** or **PM2** (below) if you want it to come back automatically.

### After you change code (production)

```bash
git pull
cd backend && npm ci && npx prisma migrate deploy && npm run build
cd ../frontend && npm ci && npm run build
# Then restart the server (Ctrl+C and npm start again, or kickstart / pm2 — see below)
```

### Data tools

- **Prisma Studio** (from `backend/`): `npx prisma studio`
- **Backup DB** (example): `docker exec rackapp-postgres pg_dump -U postgres rackapp > backup.sql`

### Ops tips

- Prefer a **DHCP reservation** or static LAN IP for the server Mac.
- Adjust **Energy** so the Mac does not sleep if you need 24/7 access.
- Allow the app **TCP port** in the macOS firewall if prompted.

---

## Run 24/7 with low maintenance (Mac Studio “appliance”)

Goal: the app **starts after login** and **restarts if Node crashes**, without leaving Terminal open.

### 1. Postgres (Docker)

- **`docker compose up -d`** — Postgres uses **`restart: unless-stopped`**.
- Docker Desktop → enable **start at login** (wording varies).
- Docker usually starts after **someone logs into the Mac**. For recovery after a full reboot with no one present, IT sometimes uses **automatic login** for a dedicated server user.

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

| Problem | Try |
|---------|-----|
| Site down | `http://<server>:<PORT>/health` → `{"ok":true}`? |
| DB down | Docker running? `docker compose up -d` from repo root |
| API down | `launchctl kickstart -k gui/$(id -u)/com.rackplus.backend` or `pm2 restart rackplus` |

**Admin:** `http://localhost:<PORT>/admin` on the server Mac only.
