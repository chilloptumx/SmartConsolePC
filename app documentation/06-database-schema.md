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

- **`service_checks`** (`ServiceCheck`)
  - Windows service checks configured by:
    - `serviceName` (Win32_Service.Name), and/or
    - `executablePath` substring match against Win32_Service.PathName
  - `expectedStatus` defaults to `"Running"`

- **`user_checks`** (`UserCheck`) and **`system_checks`** (`SystemCheck`)
  - Support built-in modes and optional custom scripts

### Scheduling and auditing
- **`scheduled_jobs`** (`ScheduledJob`)
- **`job_machines`** (`JobMachine`)
- **`audit_events`** (`AuditEvent`)

### JobType enum (check types)
`check_results.checkType` and `scheduled_jobs.jobType` use the `JobType` enum.
Current values include:
- `PING`
- `REGISTRY_CHECK`
- `FILE_CHECK`
- `SERVICE_CHECK`
- `USER_INFO`
- `SYSTEM_INFO`
- `BASELINE_CHECK`
- `FULL_CHECK`

### Migrations
Prisma migrations live at:
- `backend/prisma/migrations/*`


