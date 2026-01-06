## UI Tour (What to Click, and Why)

### 1) Dashboard

The Dashboard is your “control room”:
- **Machine grid**: one row per PC
- **Summary cards**: Total / Online / Offline / Warnings (these are clickable filters)
- **Dynamic columns**: optional “objects” pulled from latest results (think: “favorite vitals”)

Key behaviors:
- Clicking a machine name opens **PC History** for that machine:
  - `/data-viewer?tab=pc-history&machineId=<id>`

### 2) Data Viewer (Hub)

The sidebar has a single entry: **Data Viewer** — but it’s really a hub with tabs:

- **PC History**
  - A pivot/grid view over a date range
  - Great for “how did this change over time?”

- **Job Monitor**
  - A combined feed of:
    - Audit events (config changes, job scheduling events)
    - Check results (success/warning/failure)
  - Great for “what happened and when?”

- **Results**
  - A classic “rows in a table” view with search and filters
  - Great for “find all failures of type X last week”

### 3) AdHoc Scan

AdHoc Scan is for “do it now” checks:
- Select a machine
- Choose built-ins (Ping/User/System) and configured checks (Registry/File/Service/User/System)
- Run scan
- Export to CSV/Markdown/HTML

There’s also a **manual target** mode:
- run against a hostname/IP not in the machines list
- results are returned immediately and **not persisted**

### 4) Configuration

Configuration is where you define:
- **Collected data (objects)**:
  - Registry checks
  - File checks
  - Service checks
  - User checks
  - System checks
- **Machines**:
  - PC list
  - Define locations
- **Automation**:
  - Job scheduler (cron)
  - Report scheduler (email reports)
- **Integrations**:
  - SMTP
  - Scan authentication (optional DB override for WinRM creds)
  - Database info + runtime purge

Next: `06-api-tour.md`.


