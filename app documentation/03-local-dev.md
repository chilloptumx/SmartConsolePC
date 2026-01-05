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
- Frontend UI: `http://localhost:3001` (container port 3000)
- Backend API: `http://localhost:5001` (container port 5000)

Override with `.env`:
- `FRONTEND_HOST_PORT`
- `BACKEND_HOST_PORT`

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

### Why we don’t keep `node_modules/` or `dist/` in the repo
The containers mount the source directories and use a dedicated `/app/node_modules` volume.
Build output (`dist/`) is generated in-container via `npm run build` (backend) or Vite (frontend).


