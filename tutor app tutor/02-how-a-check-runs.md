## How a Check Runs (End-to-End)

This is the “movie scene” of what happens when you click a button in the UI.

### Scenario A: AdHoc Scan (queued, then polled)

When you run an AdHoc Scan against a saved machine, it is **queued** and then the UI **polls** for completion.

```
User clicks "Run Scan"
   |
   | POST /api/adhoc-scan/run
   v
Backend builds an "expected list" of objects
   |
   | enqueue N jobs (Bull queue)
   v
Worker executes jobs (remote PowerShell)
   |
   | writes CheckResult rows
   v
UI polls: POST /api/data/latest-results (since=startedAt)
   |
   v
UI stops polling once all expected objects show up
```

Key idea: the backend returns two things:
- **startedAt**: the timestamp “start line” for this run
- **expected[]**: the checklist the UI waits for

### Scenario B: AdHoc Scan (direct, manual target)

Manual target mode runs immediately and does **not persist** results.

```
User provides targetHost (hostname/IP)
   |
   | POST /api/adhoc-scan/run-direct
   v
Backend executes checks sequentially
   |
   v
Backend returns results[] immediately (no DB writes)
```

Think of this as “walk up to a random patient, take measurements, don’t file paperwork”.

### Scenario C: Scheduled Jobs (automation)

Scheduled jobs are time-based triggers that enqueue work, like a repeating calendar reminder.

```
Cron fires
  |
  v
Bull repeatable job wakes up
  |
  v
Worker runs jobType for a set of machines
  |
  v
CheckResults are stored, machine status updated, audit events recorded
```

### What actually happens on the Windows machine

The worker does remote execution via WinRM:
- Node spawns a Python helper (`backend/scripts/winrm-exec.py`)
- Python uses `pywinrm` to run PowerShell remotely
- The PowerShell prints JSON
- Node parses JSON into `resultData` and stores it

### A crucial “aha”: PING is a probe, not ICMP

In this app, `PING` runs a tiny PowerShell snippet remotely and returns:
- `reachable: true`
- `computerName`
- `timestamp`

So “Ping succeeded” really means:
> “Remote execution works with our configured credentials and transport.”

### Where to look in code

- **Queueing**: `backend/src/routes/adhoc-scan.ts` and `backend/src/services/job-scheduler.ts`
- **Remote PowerShell**: `backend/src/services/powershell-executor.ts`
- **Result evaluation**: `backend/src/services/check-evaluators.ts`
- **Latest-results polling**: `backend/src/routes/data.ts` (`POST /api/data/latest-results`)

Next: `03-job-types-and-cadence.md`.


