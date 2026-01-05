## Transfer checklist (SmartConsolePC)

### On OLD PC
- [ ] `docker compose ps` (confirm running)
- [ ] Copy `.env` somewhere safe (do not commit it)
- [ ] Create DB backup:

```powershell
Set-Location C:\SmartConsole
docker compose exec -T postgres pg_dump -U healthcheck healthcheck > .\db-backup.sql
```

- [ ] Copy `db-backup.sql` to the new PC (optional but recommended)
- [ ] (Optional) Stop stack before moving:

```powershell
Set-Location C:\SmartConsole
docker compose down
```

### On NEW PC
- [ ] Install Docker Desktop, confirm `docker info` works
- [ ] Get the code (Git clone or copy folder)
- [ ] Place `.env` at `C:\SmartConsole\.env`
- [ ] Start stack:

```powershell
Set-Location C:\SmartConsole
docker compose up -d --build
```

- [ ] Restore DB (if you copied `db-backup.sql`):

```powershell
Set-Location C:\SmartConsole
Get-Content .\db-backup.sql | docker compose exec -T postgres psql -U healthcheck healthcheck
```

- [ ] Verify:
  - UI: `http://localhost:3001`
  - API health: `http://localhost:5001/health`


