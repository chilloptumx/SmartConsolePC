## Database schema (overview)

The schema is defined in `backend/prisma/schema.prisma`.

### Core tables
- **`machines`** (`Machine`)
  - Windows PCs being monitored
  - Key fields: `hostname`, `ipAddress`, `status`, `lastSeen`, `pcModel`, optional `locationId`

- **`check_results`** (`CheckResult`)
  - Append-only history of executed checks
  - Key fields:
    - `machineId`
    - `checkType` (enum `JobType`)
    - `checkName` (human label; also participates in “collected objects”)
    - `status` (`SUCCESS|FAILED|WARNING|TIMEOUT`)
    - `resultData` (JSON)
    - `message` (optional)
    - `createdAt`

### Check configuration tables
- **`registry_checks`** (`RegistryCheck`)
  - `registryPath` is normalized to regedit-style (e.g., `HKEY_LOCAL_MACHINE\...`)
  - `valueName` optional: if omitted, check is “key exists”
  - `expectedValue` optional: mismatch produces WARNING when the value exists

- **`file_checks`** (`FileCheck`)
  - `filePath`
  - `checkExists` determines whether existence is expected
  - Other flags exist but are currently informational (UI shows them)

- **`user_checks`** (`UserCheck`) and **`system_checks`** (`SystemCheck`)
  - Support built-in modes and optional custom scripts

### Scheduling and auditing
- **`scheduled_jobs`** (`ScheduledJob`)
- **`job_machines`** (`JobMachine`)
- **`audit_events`** (`AuditEvent`)

### Migrations
Prisma migrations live at:
- `backend/prisma/migrations/*`


