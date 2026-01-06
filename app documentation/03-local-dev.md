## Local development (Windows + Docker)

### Prereqs
- Docker Desktop (with WSL2 backend recommended)

> Note: This repo is designed to run via Docker. A local Node/npm install on Windows is optional.

### Quick start
From the repo root:

```powershell
Set-Location C:\SmartConsole
Copy-Item .\env.example .\.env
docker compose up -d --build
```

### Ports
Defaults:
- Frontend UI: `http://localhost:3001`
- Backend API: `http://localhost:5001`

Override with `.env`:
- `FRONTEND_HOST_PORT`
- `BACKEND_HOST_PORT`

> Note: Docker still uses internal container ports (Vite on 3000, API on 5000). You normally should only care about the **host ports** above.

### Common commands
```powershell
# view service status
docker compose ps

# tail logs
docker compose logs -f backend

# restart backend or frontend
docker compose restart backend
docker compose restart frontend

# rebuild images (when Dockerfile or dependencies change)
docker compose build --no-cache
docker compose up -d --force-recreate
```

### If frontend changes don’t show up (Docker Desktop + Windows)
On Windows, Docker Desktop + bind mounts can sometimes fail to propagate file-watch events into Linux containers. When that happens, Vite keeps serving an older bundle even though files changed.

This repo enables **polling** to make hot reload/rebuilds reliable:
- `frontend/vite.config.ts`: `server.watch.usePolling = true`
- `docker-compose.yml`: `CHOKIDAR_USEPOLLING=true` for the frontend service

If you ever edit frontend code and the UI still looks unchanged:

```powershell
docker compose restart frontend
```

### Why we don’t keep `node_modules/` or `dist/` in the repo
The containers mount the source directories and use a dedicated `/app/node_modules` volume.
Build output (`dist/`) is generated in-container via `npm run build` (backend) or Vite (frontend).

### Running against an external Postgres (optional)
If you want to run the backend against a Postgres instance **outside** Docker (local Postgres install, VM, managed Postgres):
- Use the scripts in `Database build/` to generate/apply a **schema-only** SQL file (`schema.sql`)
- Point `DATABASE_URL` at your external Postgres (see `Database build/env.external-postgres.example`)

This is optional — the default Docker Compose workflow already includes Postgres.


