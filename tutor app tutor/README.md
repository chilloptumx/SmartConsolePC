## Tutor Folder: Learn SmartConsole Like a Human

This folder is written as a **tutor-style guide**: plain language first, then the technical names in parentheses so you can “graduate” into the codebase without getting lost.

### How to read this folder

- **If you’re brand new**: start with `01-mental-model.md`, then `05-ui-tour.md`.
- **If you’re debugging a run**: read `02-how-a-check-runs.md` and `08-troubleshooting-playbook.md`.
- **If you’re adding features**: read `03-job-types-and-cadence.md`, `06-api-tour.md`, and `07-database-tour.md`.

### What this app *is*

SmartConsole is a **Windows PC health history system**:
- You define “things to look at” (**check configurations**) like registry keys, files, or Windows services.
- The backend runs those checks on machines on a schedule (**scheduled jobs**) or on-demand (**AdHoc Scan**).
- Every run creates rows in a history table (**CheckResult**) so the UI can show trends over time.

### The one diagram to keep in your head

```
Browser (React UI)
   |
   |  HTTP (/api/*)
   v
Backend (Express)
   |
   |  enqueue work
   v
Redis + Bull queue  --->  Worker (job-scheduler)
                                |
                                | WinRM remote PowerShell (python + pywinrm)
                                v
                           Windows machines
                                |
                                | results (JSON)
                                v
                           Postgres (history + config)
```

### Vocabulary cheat sheet

If the app feels confusing, it’s usually because these words are overloaded:
- **“Check”** can mean a *definition* (config row) or an *execution result* (CheckResult row).
- **“Ping”** in this app is **not ICMP** — it’s a tiny remote execution probe (WinRM) that answers: “can we run PowerShell on the box?”

Next: open `01-mental-model.md`.


