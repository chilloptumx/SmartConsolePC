## Moving SmartConsolePC (Docker) to another Windows PC

This guide helps you move **the entire Docker application** (SmartConsolePC) to another Windows 11 PC running **Docker Desktop**.

### What you’re moving
- **Source code**: `docker-compose.yml`, `backend/`, `frontend/`, scripts, docs
- **Runtime configuration**: your `.env` (not committed)
- **Data** (optional): Postgres DB contents (machines/checks/history), Redis queue state

### Before you start (on the NEW PC)
- Install **Docker Desktop** and ensure it’s running (Linux containers mode / WSL2 backend).
- Install **Git** (only needed for the Git method).
- Make sure the new PC can reach your target Windows machines for WinRM (if you’re scanning remote PCs).

### Choose a transfer method

#### Option A (recommended): GitHub clone + restore data
Use this if the new PC has internet access and you want the cleanest workflow.

1. **Clone the repo**

```powershell
Set-Location C:\
git clone https://github.com/chilloptumx/SmartConsolePC.git SmartConsole
Set-Location C:\SmartConsole
```

2. **Copy your `.env`**
- From the old PC: copy `C:\SmartConsole\.env`
- To the new PC: place it at `C:\SmartConsole\.env`

> If you don’t want to copy secrets, create a new `.env` from `env.example` and re-enter your values.

3. **(Optional but recommended) Restore the database**
- On the old PC, create a backup:

```powershell
Set-Location C:\SmartConsole
docker compose exec -T postgres pg_dump -U healthcheck healthcheck > .\db-backup.sql
```

- Copy `db-backup.sql` to the new PC’s `C:\SmartConsole\`
- On the new PC, start the stack once, then restore:

```powershell
Set-Location C:\SmartConsole
docker compose up -d --build

# restore into postgres
Get-Content .\db-backup.sql | docker compose exec -T postgres psql -U healthcheck healthcheck
```

4. **Start the full app**

```powershell
Set-Location C:\SmartConsole
docker compose up -d --build
```

5. **Open the UI**
- **UI**: `http://localhost:3001`
- **API**: `http://localhost:5001/health`

---

#### Option B (offline / USB): copy a zip of the folder + restore data
Use this if you don’t want to use Git or don’t have internet access.

1. **Stop containers on the old PC**

```powershell
Set-Location C:\SmartConsole
docker compose down
```

2. **Create a DB backup file (recommended)**

```powershell
Set-Location C:\SmartConsole
docker compose up -d postgres
docker compose exec -T postgres pg_dump -U healthcheck healthcheck > .\db-backup.sql
docker compose down
```

3. **Copy the folder**
- Copy the entire `C:\SmartConsole\` folder to the new PC (USB / network share).
- Ensure the new PC has `C:\SmartConsole\.env` (copy it too).

4. **Start and restore**

```powershell
Set-Location C:\SmartConsole
docker compose up -d --build

# restore DB if you copied db-backup.sql
if (Test-Path .\db-backup.sql) {
  Get-Content .\db-backup.sql | docker compose exec -T postgres psql -U healthcheck healthcheck
}
```

5. **Open the UI**
- **UI**: `http://localhost:3001`
- **API**: `http://localhost:5001/health`

---

### Notes / gotchas
- **Ports**: host ports are controlled by `.env` variables:
  - `FRONTEND_HOST_PORT` (default **3001**)
  - `BACKEND_HOST_PORT` (default **5001**)
- **Secrets**: `.env` is intentionally not committed; you must copy it (or re-create it).
- **Data persistence**: Postgres data lives in Docker volume `postgres_data`. The `pg_dump/psql` method above is the most portable way to move it.
- **Redis**: it’s safe to ignore Redis data during a move; the queue will rebuild.

### Quick verification commands

```powershell
Set-Location C:\SmartConsole
docker compose ps
Invoke-WebRequest -UseBasicParsing http://localhost:5001/health
```


