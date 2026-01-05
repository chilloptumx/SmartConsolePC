## Troubleshooting

### Containers don’t start / crash loop
- Check status:

```powershell
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

- Common causes:
  - `.env` missing or invalid values
  - Postgres/Redis not healthy yet
  - Backend failing Prisma migrate/generate at boot

### “Online/Offline” doesn’t match expectation
Machine status is stored on `Machine.status` and is updated by the scheduler after checks run.
If you want “online/offline” to be driven strictly by PING results, that requires an explicit mapping rule.

### No results appear in Dashboard columns
Dashboard “dynamic columns” are populated from `/api/data/latest-results` for selected objects.
If columns show `-`:
- ensure checks have run at least once
- confirm “collected objects” includes that `(checkType, checkName)` combo

### WinRM failures / remote PowerShell errors
- Ensure WinRM is enabled on target:

```powershell
Enable-PSRemoting -Force
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force
Restart-Service WinRM
```

- Verify credentials in `.env`:
  - `WINDOWS_ADMIN_USER`
  - `WINDOWS_ADMIN_PASSWORD`

### Registry/File “not found” doesn’t highlight
“Not found” is driven by either:
- `resultData.exists === false`, or
- a clear “not found” message

If you see neither, inspect the result JSON in Data Viewer to confirm what shape is being returned.


