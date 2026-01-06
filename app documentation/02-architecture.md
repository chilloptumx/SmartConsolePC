## Architecture

### Components
- **Frontend** (`frontend/`): React UI (Vite dev server in Docker)
- **Backend** (`backend/`): Express API + Prisma + Bull worker
- **PostgreSQL**: stores machines, check configs, results, audit events
- **Redis**: Bull queue backing store

### Data flow (checks)
1. User triggers a scan:
   - Dashboard “Run” triggers `FULL_CHECK` per machine, or
   - AdHoc Scan posts to `/api/adhoc-scan/run` with selected check IDs
2. Backend enqueues a job via Bull:
   - `triggerCheck(machineId, jobType, checkConfig?)` in `backend/src/services/job-scheduler.ts`
3. Worker executes the job:
   - `processSingleMachine()` fetches the machine record and runs a `switch(jobType)`
4. Remote execution:
   - PowerShell commands are executed via WinRM using Python `pywinrm`
   - Backend wrapper: `backend/src/services/powershell-executor.ts`
5. Results persisted:
   - `CheckResult` row created per check
   - Machine status updated (ONLINE/WARNING/ERROR/UNKNOWN/OFFLINE)

### Important backend files
- **Routes**
  - `backend/src/routes/machines.ts`: CRUD + trigger manual check
  - `backend/src/routes/config.ts`: CRUD for registry/file/service/user/system checks
  - `backend/src/routes/adhoc-scan.ts`: enqueue selected checks for machines
  - `backend/src/routes/data.ts`: results browsing + latest-results
- **Services**
  - `backend/src/services/job-scheduler.ts`: Bull queue, job processor, check execution logic
  - `backend/src/services/powershell-executor.ts`: WinRM + PowerShell commands (registry/file/service/system/user)
  - `backend/src/services/registry-path.ts`: normalization and escaping helpers
  - `backend/src/services/check-evaluators.ts`: evaluates “exists/missing/expected value” and parses result data

### “Collected objects”
The UI treats any unique `(checkType, checkName)` recorded in `CheckResult` as a **collected object**.
This powers:
- Dashboard “dynamic columns”
- PC History object selector (inside Data Viewer hub)

Backend endpoint:
- `GET /api/data/collected-objects` (per machine)
- `GET /api/data/collected-objects?scope=all` (across all machines)


