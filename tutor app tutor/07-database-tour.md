## Database Tour (What’s Stored Where)

SmartConsole uses Postgres for:
- **configuration** (what to check, which machines exist)
- **history** (what happened when a check ran)
- **audit trail** (who changed what / what was queued)

### The most important tables

#### `machines`
One row per Windows PC being monitored.

Key columns:
- `hostname`, `ipAddress`
- `status` (ONLINE/WARNING/ERROR/UNKNOWN/OFFLINE)
- `lastSeen`
- optional `locationId`

#### Configuration tables (the “test orders”)

- `registry_checks`
- `file_checks`
- `service_checks`
- `user_checks`
- `system_checks`

These tables define what can be run and what shows up in pickers.

#### `check_results` (the history)

This is the “lab report archive”.

Each row represents one executed check:
- `machineId`
- `checkType` (enum `JobType`)
- `checkName` (human label)
- `status` (SUCCESS/FAILED/WARNING/TIMEOUT)
- `resultData` (JSON payload)
- `message` (optional)
- `createdAt`

Important: this table is append-only by design. History is the product.

#### Scheduling + audit

- `scheduled_jobs` and `job_machines`: define recurring automation (cron + targets)
- `audit_events`: actions log (config changes, job events, etc.)

### Relationship picture

```
machines 1 --- * check_results
machines 1 --- * audit_events

scheduled_jobs 1 --- * job_machines * --- 1 machines
```

### Where the schema is defined

- Prisma schema: `backend/prisma/schema.prisma`
- Migrations: `backend/prisma/migrations/*`

Next: `08-troubleshooting-playbook.md`.


