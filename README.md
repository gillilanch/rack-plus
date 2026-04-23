# 🖥️ Rack+ #

### Rack. Configure. Connect. ###

Rack+ is a management tool for hardware rack configurations, featuring an Express API backend and a Vite+React frontend.

## 🌐 Quick Access (Fox Mac Studio)

Assumes PORT=4000 is set in backend/.env

 Access Type        | URL                                        |
| ------------------|:-------------------------------------------|
| Local             | http://127.0.0.1:4000                      | 
| LAN (mDNS)        | http://Foxs-Mac-Studio.local:4000          |
| LAN (IP)          | http://10.231.208.225:4000 (DHCP dependent)|
| Health Check      | http://hostname:4000/health → {"ok":true}  |

## LINK TO SPREADSHEET PULLING DATA FROM AVCAD ##
 
 [AVCAD DATABASE GOOGLE SHEET](https://docs.google.com/spreadsheets/d/13aci_txPa9jII7c7MccJdVHicMuQZQECIsBW6Ewof2c/edit?gid=1613961878#gid=1613961878)

## 🏗️ Project Structure ##
 
 Path               | Description                                                                                        |
| ------------------|:---------------------------------------------------------------------------------------------------|
| `backend/`        | Node Express API, Prisma ORM, and Catalog Sync. Build output: `/dist`.                             | 
| `frontend/`       | Vite + React SPA. Build output: `/dist` (served by backend in production).                         |
| `docs/`           | Deployment and [Handoff Documentation](https://www.google.com/search?q=docs/MAC_STUDIO_HANDOFF.md).|

## ⚙️ Initial Setup: The DATABASE_URL Rule ##
PostgreSQL on macOS typically uses your system username. **You must verify this** to prevent Prisma connection errors.

1. Open Terminal and run: `whoami`

2. Update `backend/.env` using that result:

```
# Replace YOUR_USERNAME with the output of `whoami`
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/rackapp"
```
---

> [!WARNING]
>If you migrate code between the Mac Studio and a laptop, you must update this line on each machine as usernames will differ.
>
---

## 🚀 How to Run ##

**Option A: Development (Local Laptop)**
Requires two terminal windows and a local Postgres instance (`brew services start postgresql@16`).

**1. Config:** `cp backend/.env.development.example backend/.env`
     
     * `cp frontend/.env.development.example frontend/.env.development`

**2. Terminal 1 (Backend):**

```bash
cd backend && npm ci
npx prisma migrate deploy
npm run dev
```

**3.Terminal 2 (Frontend):**

```bash
cd frontend && npm ci
npm run dev
```

**4. Access:** Open the URL provided by Vite (usually `http://localhost:5173`).

**Option B: Production (Mac Studio Server)**
This mode serves the API and the UI on a single port.

**1.Build & Prepare:**
```bash
# From repo root
cd backend && npm ci && npx prisma migrate deploy && npm run build
cd ../frontend && npm ci && npm run build
```
**2.Launch:**
```bash
# From repo root
./start.sh
```
**3. Desktop Shortcut:**
After building, you can use the `macos/Rack+.app` wrapper to launch the server and browser simultaneously.

---

## 🛠️ Operations & Maintenance ##

**Environment Variables (`backend/ .env1\`)**

| Variable          | Description                           | Default      |
| ------------------|:--------------------------------------|:-------------|
| `DATABASE_URL`    | Postgres connection string            | —            |
| `PORT`            | HTTP port for the app                 | `4000`       |
| `NODE_ENV`        | Set to `production` for the Mac Studio| `development`|
| `ADMIN_TOKEN`     | Optional Bearer token for admin routes| —            |

**Admin Console**
Access `http://localhost:4000/admin` directly on the server Mac.
   * Note: Remote access to /admin is blocked (403) for security.

**Keeping it Running (24/7 Mode)**}
To ensure the app restarts after a crash or reboot, use one of these methods:
   * **Luanchpad(Recommended):** Run `./deploy/macos/install-launchagent.sh`
   * **PM2:**
   ```bash
   pm2 start backend/dist/server.js --name rackplus
   pm2 save
   ```
---
## 🏥 Troubleshooting ##

|Symptom  | Action                                                                             
|--------------------|:-----------------------------------------------------------------------:|
|**Site Unreachable**|Check health check URL; ensure `./start.sh` or service is running.       |
|**Database Error**  |Run `brew services list` to check Postgres; verify whoami matches `.env`.|
|**403 Forbidden**   |You are likely trying to access `/admin` from a remote machine.          |
|**Code Changes not showing**|Run `npm run build` in both frontend and backend directories.    |
---
**Full Handoff Guide:** `docs/MAC_STUDIO_HANDOFF.md`

*Created by: Seher Allahbachayo*

