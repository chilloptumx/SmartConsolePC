## Configuration and checks

### Where checks are defined (database)
Checks are persisted in Postgres and exposed through Prisma models in:
- `backend/prisma/schema.prisma`

Relevant models:
- `RegistryCheck`: `registryPath`, `valueName?`, `expectedValue?`, `isActive`
- `FileCheck`: `filePath`, `checkExists`, plus flags (currently informational): `checkSize`, `checkCreated`, `checkModified`
- `UserCheck`: `checkType`, optional `customScript`
- `SystemCheck`: `checkType`, optional `customScript`

### Where checks are managed (API)
CRUD routes live in `backend/src/routes/config.ts`:
- `GET/POST/PUT/DELETE /api/config/registry-checks`
- `GET/POST/PUT/DELETE /api/config/file-checks`
- `GET/POST/PUT/DELETE /api/config/user-checks`
- `GET/POST/PUT/DELETE /api/config/system-checks`

### How checks are executed
The scheduler/worker is in `backend/src/services/job-scheduler.ts`.

Key concepts:
- Jobs are enqueued with `triggerCheck(machineId, jobType, checkConfig?)`.
- Job types: `PING`, `REGISTRY_CHECK`, `FILE_CHECK`, `USER_INFO`, `SYSTEM_INFO`, `FULL_CHECK`.
- “Run all” vs “run one”:
  - Scheduled jobs typically run “all active checks” for that type.
  - AdHoc Scan runs a specific check by ID (e.g., `registryCheckId`, `fileCheckId`).
- **Manual one-off targets (AdHoc Scan)**:
  - The AdHoc Scan UI supports a “manual target” mode for running checks against a hostname/IP that is **not** in the Machines list.
  - Manual targets are **not persisted** (no Machine record is created, and results are not written to `check_results`).

### Result normalization and evaluation
The “does it exist?” and expected-value logic is centralized in:
- `backend/src/services/check-evaluators.ts`

Behavior:
- **Registry check**
  - If `{ exists: false }` → `FAILED`
  - If `expectedValue` provided and exists=true + valueName present:
    - mismatch → `WARNING`
    - match → `SUCCESS`
- **File check**
  - Default is `checkExists=true`
  - If `{ exists: false }` and checkExists=true → `FAILED`
  - If `{ exists: true }` and checkExists=false → `FAILED`

### Adding a new registry check (UI)
In **Configuration → Registry Checks**:
1. Add Name
2. Add Registry Path (accepts `HKLM:\...`, `HKLM\...`, `HKEY_LOCAL_MACHINE\...`, etc.)
3. Optional: Value Name
4. Optional: Expected Value

### Adding a new file check (UI)
In **Configuration → File Checks**:
1. Add Name
2. Add Path (e.g. `C:\Windows\System32\notepad.exe`)
3. Toggle **Exists** (default true)

> Note: `checkSize/checkCreated/checkModified` are stored + displayed but currently do not affect pass/fail.

### Adding a *new kind* of check (developer)
If you want a new checkType with custom semantics:
1. Add a new `JobType` value in `backend/prisma/schema.prisma` enum `JobType`
2. Update:
   - `backend/src/services/job-scheduler.ts` (execution + persistence)
   - frontend UI to configure, run, and render results
3. Add tests for evaluation (recommended)


