## Glossary

- **AdHoc Scan**: On-demand scan started by a user. Can be queued/persisted (`/run`) or direct/not-persisted (`/run-direct`).
- **AuditEvent**: A log record of actions (created/updated/deleted config, jobs queued, etc.). Stored in `audit_events`.
- **BASELINE_CHECK**: A job type meaning “everything except ping/user”: system + registry + file + service.
- **Bull**: The job queue library used by the backend. Backed by Redis.
- **CheckResult**: A history row for one executed check. Stored in `check_results`.
- **checkName**: The human label for a check (e.g., “SNMP Trap Service”).
- **checkType / JobType**: The category of work (PING, FILE_CHECK, SERVICE_CHECK, etc.).
- **Configuration**: The UI area where you define checks, machines, schedules, and settings.
- **Collector**: The PowerShell code that runs remotely and returns JSON.
- **Data Viewer (hub)**: The UI page with tabs for PC History, Job Monitor, and Results.
- **Evaluator**: Backend logic that turns raw resultData into a status (SUCCESS/FAILED/WARNING).
- **FULL_CHECK**: A job type meaning “run everything”: ping + all active checks.
- **WinRM**: Windows Remote Management. The remote execution transport used by the backend (via Python `pywinrm`).
- **Tracking (service expectedStatus)**: Record service state, but don’t warn when state differs.


