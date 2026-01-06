## Mental Model (with Analogies)

Think of SmartConsole like a **clinic + lab** for computers.

### The “clinic” analogy

- **Machine** (`Machine`): a *patient* (a Windows PC you care about).
- **Check configuration** (`RegistryCheck`, `FileCheck`, `ServiceCheck`, `UserCheck`, `SystemCheck`): a *test order* (“please measure X on each patient”).
- **Scheduled job** (`ScheduledJob`): the clinic’s *recurring appointment schedule* (“every hour, run these tests for everyone”).
- **AdHoc scan** (`/api/adhoc-scan/*`): a *walk‑in appointment* (“run these tests right now”).
- **Queue** (Bull on Redis): the *waiting room ticket system* (work is lined up and processed in order).
- **Worker** (`job-scheduler.ts`): the *technician* who actually runs tests and records the result.
- **Remote PowerShell** (`powershell-executor.ts` + `winrm-exec.py`): the *medical tool* used to take the measurement.
- **Result history** (`CheckResult`): the *lab report archive* — append-only, so you can look back in time.
- **Audit events** (`AuditEvent`): the *front desk logbook* (“who changed what, what was queued, what completed”).

### Why there are “two worlds”: configuration vs history

SmartConsole stores two kinds of data:

1) **Configuration** (what you *intend* to check)
- “I want to track these 8 registry keys and these 3 services.”

2) **History** (what happened when it ran)
- “At 10:03, the SNMP Trap service was Running.”
- “At 11:03, it was Stopped (warning).”

The UI often mixes these:
- **Dashboard columns** come from “objects” (history + configured defaults).
- **PC History** is 100% history.
- **Configuration** is 100% definitions.

### The easiest way to stay oriented

When you see a thing in the UI, ask:

1) “Is this a **definition**?”  
   If yes, it lives in a config table like `service_checks`.

2) “Or is this a **recorded outcome**?”  
   If yes, it lives in `check_results`.

### Quick glossary (you’ll see these everywhere)

- **CheckType** / **JobType** (`JobType` enum): the category of work (PING, FILE_CHECK, SERVICE_CHECK, etc.)
- **checkName**: the human label (e.g. “SNMP Trap Service”)
- **resultData**: the JSON payload the backend stored (the raw “lab values”)
- **status**: SUCCESS / FAILED / WARNING / TIMEOUT

Next: `02-how-a-check-runs.md`.


