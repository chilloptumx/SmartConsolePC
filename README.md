## SmartConsolePC (Smart Console PC Health Monitor)

Thorough documentation now lives in `app documentation/` (start with `app documentation/README.md`).

## Smart Console PC Health Monitor

I built **Smart Console PC Health Monitor** to track the health of Windows PCs and keep a clean history of what I’ve collected (registry checks, file checks, system info, users, and connectivity). Everything runs locally in Docker: **React UI**, **Node/Express API**, **PostgreSQL**, and **Redis**.

### What I can do in the UI

- **Dashboard**: see each machine in a grid and trigger a full scan.
  - Click **Total / Online / Offline / Warnings** to filter the machine list
  - Click a **PC name** to open PC Viewer pre-selected to that machine
- **Configuration**:
  - Manage machines
  - Manage **Registry Checks** (add/edit/delete)
  - Manage **File Checks** (add/edit/delete)
  - Manage **Email Reports**
  - Manage **Job Scheduler** (scheduled jobs + run now)
  - View effective Settings (SMTP + built-in checks)
- **Data Viewer**: filter results and inspect values/types (registry + files).
- **PC Viewer**: historical pivot view with date range + export (CSV/MD/HTML).
- **Job Monitor**: audit trail of jobs + actions.

### Quick start (Windows + Docker Desktop)

1. **Copy env template**

```powershell
Set-Location C:\SmartConsole
Copy-Item .\env.example .\.env
```

2. **Edit `.env`** (minimum: your Windows admin credentials for remoting)

- `WINDOWS_ADMIN_USER`
- `WINDOWS_ADMIN_PASSWORD`

3. **Start services**

```powershell
docker compose up -d --build
```

4. **Open the UI**

- **Frontend (UI)**: `http://localhost:3001`
- **Backend (API)**: `http://localhost:5001`
- **Backend health**: `http://localhost:5001/health`

If you need different ports, set:
- `FRONTEND_HOST_PORT`
- `BACKEND_HOST_PORT`

### Windows remoting (WinRM) setup

On the Windows machine(s) I want to scan, run PowerShell **as Administrator**:

```powershell
Enable-PSRemoting -Force
Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force
Restart-Service WinRM
```

### Notes

- I do **not** commit `.env` (secrets stay local).
- The UI talks to the API via **same-origin `/api` proxy** in dev, so it won’t break when host ports change.
  - Status (Success/Failed)
- Sort by any column
- Export to CSV
- Click row for detailed JSON result

### 6. Email Reports

Navigate to **Email Reports**:

1. Click "Create Report"
2. Configure:
   - Name
   - Recipients (comma-separated emails)
   - Schedule (cron expression)
   - Filters (same as Data Viewer)
   - Columns to include
3. Save and enable
4. Use "Send Now" to test

## API Endpoints

### Machines
```
GET    /api/machines          - List all machines
POST   /api/machines          - Add machine
GET    /api/machines/:id      - Get machine details
PUT    /api/machines/:id      - Update machine
DELETE /api/machines/:id      - Delete machine
POST   /api/machines/:id/check - Trigger manual check
```

### Configuration
```
GET    /api/config/registry-checks - List registry checks
POST   /api/config/registry-checks - Create registry check
PUT    /api/config/registry-checks/:id - Update
DELETE /api/config/registry-checks/:id - Delete

GET    /api/config/file-checks - List file checks
POST   /api/config/file-checks - Create file check
(Similar CRUD operations)
```

### Scheduling
```
GET    /api/schedules/jobs        - List scheduled jobs
POST   /api/schedules/jobs        - Create job
PUT    /api/schedules/jobs/:id    - Update job
DELETE /api/schedules/jobs/:id    - Delete job
POST   /api/schedules/jobs/:id/run-now - Run job now
```

### Data
```
GET    /api/data/results          - Get check results (with filters)
GET    /api/data/results/:id      - Get single result
GET    /api/data/results/export   - Export as CSV
GET    /api/data/stats            - Get statistics
```

### Reports
```
GET    /api/reports               - List email reports
POST   /api/reports               - Create report
PUT    /api/reports/:id           - Update report
DELETE /api/reports/:id           - Delete report
POST   /api/reports/:id/send-now  - Send report now
```

## Database Schema

Key tables:
- `machines`: Windows PCs being monitored
- `registry_checks`: Registry paths to monitor
- `file_checks`: File paths to monitor
- `scheduled_jobs`: Cron-based job definitions
- `check_results`: Historical check data
- `email_reports`: Email report configurations

See `backend/prisma/schema.prisma` for full schema.

## Development

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name init

# Run dev server
npm run dev
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

### View Database

```bash
cd backend
npx prisma studio
```

Opens Prisma Studio at http://localhost:5555

## Troubleshooting

### PowerShell Connection Fails

1. Verify WinRM/SSH is enabled on Windows machine
2. Check firewall rules
3. Test with `Test-WSMan` or SSH connection
4. Verify credentials in `.env`

### No Data Appearing

1. Check backend logs: `docker-compose logs backend`
2. Verify scheduled jobs are active (Scheduling page)
3. Manually trigger a check (Dashboard → Machine → "Run Check")
4. Check Redis connection: `docker-compose logs redis`

### Email Not Sending

1. Verify SMTP settings in `.env`
2. For Gmail: Use App Password, not regular password
3. Check backend logs for email errors
4. Test with "Send Now" on a report

### Database Connection Issues

1. Check PostgreSQL is running: `docker-compose ps`
2. Verify DATABASE_URL in `.env`
3. Check logs: `docker-compose logs postgres`

## Backup and Restore

### Backup Database

```bash
docker-compose exec postgres pg_dump -U healthcheck healthcheck > backup.sql
```

### Restore Database

```bash
docker-compose exec -T postgres psql -U healthcheck healthcheck < backup.sql
```

## Security Considerations

1. **Change default passwords** in `.env`
2. **Use strong Windows credentials**
3. **Restrict WinRM TrustedHosts** to specific IPs
4. **Use HTTPS** in production (add nginx reverse proxy)
5. **Keep Docker images updated**
6. **Backup database regularly**

## License

Private/Internal Use

## Support

For issues or questions, check logs:
```bash
docker-compose logs -f
```

