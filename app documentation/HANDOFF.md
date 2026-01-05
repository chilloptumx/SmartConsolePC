## Handoff — SmartConsole PC Health Monitor (next session starter)

### Current state (what’s working)
- App runs in Docker Compose with:
  - Frontend: `http://localhost:3001`
  - Backend: `http://localhost:5001`
- AdHoc Scan queues checks and polls latest results.
- Registry/file checks now correctly mark missing targets as **FAILED** (not “success just because PowerShell ran”).
- UI highlights “not found” registry/file results in red across pages:
  - PC Viewer
  - Data Viewer
  - AdHoc Scan
  - Dashboard (includes fallback for message-based “not found”)
- Dashboard summary cards:
  - Online = ONLINE + WARNING
  - Offline = OFFLINE + UNKNOWN + ERROR
  - Warnings = WARNING

### Key changes recently made (high-signal)
- **Backend correctness fixes**
  - Added `backend/src/services/check-evaluators.ts` and tests `check-evaluators.test.ts`
  - Updated `backend/src/services/job-scheduler.ts` to use evaluators for both batch and single-check runs
  - Fixed PowerShell file-path quoting in `backend/src/services/powershell-executor.ts`
- **Frontend “not found” highlight**
  - `frontend/src/app/pages/Dashboard.tsx`
  - `frontend/src/app/pages/AdHocScan.tsx`
  - `frontend/src/app/pages/DataViewer.tsx`
  - `frontend/src/app/pages/PcViewer.tsx`
- **Repo cleanup**
  - Removed host `node_modules/` and generated `dist/` folders from workspace
  - `.gitignore` already excludes these

### How to run (Windows)
```powershell
Set-Location C:\SmartConsole
docker compose up -d --build
```

### How to verify quickly
From the backend container:
```bash
curl -s http://localhost:5000/health
```

In the UI:
- Dashboard should show machines and dynamic columns (collected objects)
- Data Viewer should show results rows and red highlights for missing file/registry

### “Where is X implemented?”
- **Job execution**: `backend/src/services/job-scheduler.ts`
- **Remote PowerShell**: `backend/src/services/powershell-executor.ts` + `backend/scripts/winrm-exec.py`
- **Registry path normalization**: `backend/src/services/registry-path.ts`
- **Check evaluation logic**: `backend/src/services/check-evaluators.ts`
- **Ad-hoc scan API**: `backend/src/routes/adhoc-scan.ts`
- **Config CRUD**: `backend/src/routes/config.ts`
- **Latest results query**: `backend/src/routes/data.ts` (`POST /api/data/latest-results`)
- **Dashboard UI**: `frontend/src/app/pages/Dashboard.tsx`

### Known gaps / recommended next work
- **FileCheck flags not enforced**:
  - `checkSize`, `checkCreated`, `checkModified` are stored + shown but not used for pass/fail.
  - Decide desired semantics (thresholds? date windows?) and implement in evaluator + UI.
- **Status semantics**:
  - Current machine status derives from last executed job result(s).
  - If you want “online/offline” strictly driven by PING, define a rule and update scheduler + UI.
- **Test coverage**:
  - Only evaluator unit tests exist. Consider adding:
    - API route tests (adhoc-scan payload validation, config CRUD)
    - UI smoke tests (optional)

### Commands for next session
- Rebuild containers:
```powershell
docker compose up -d --build --force-recreate
```
- View logs:
```powershell
docker compose logs -f backend
```
- Run backend unit tests (inside backend container):
```powershell
docker compose exec -T backend npm test
```


