## Overview

**Smart Console PC Health Monitor** monitors Windows PCs and stores a history of health/attribute checks:
- Connectivity (PING)
- Registry checks (key exists / value exists / expected value)
- File checks (exists + file metadata)
- Service checks (Windows service exists + state metadata)
- User info (current/last user, optional custom PowerShell)
- System info (hardware/OS info, optional custom PowerShell)

It runs locally via Docker Compose:
- **Frontend**: React + Vite (`frontend/`)
- **Backend**: Node + Express + Prisma (`backend/`)
- **Database**: PostgreSQL
- **Queue**: Redis + Bull (job execution)

### High-level user flows
- **Configuration**: define registry/file/user/system checks, machines, schedules, settings
- **Dashboard**: view machine status grid, run full checks, view latest collected objects
  - Summary cards (**Total / Online / Offline / Warnings**) are clickable filters for the machine list
  - Clicking a machine name deep-links into **PC History** (inside Data Viewer) for that specific machine
- **AdHoc Scan**: run selected checks for a single machine, then export a table
- **Data Viewer (hub)**: explore historical results
  - PC History (pivot/grid)
  - Job Monitor (audit + results feed)
  - Results (row-level search/filter)

### Key “objects” in the system
- **Machine**: a Windows endpoint tracked by the system
- **Check configuration**: persisted definitions of registry/file/user/system checks
- **CheckResult**: one recorded execution result (stored as JSON `resultData`)
- **ScheduledJob**: cron job that enqueues checks
- **AuditEvent**: system log of actions and job execution steps


