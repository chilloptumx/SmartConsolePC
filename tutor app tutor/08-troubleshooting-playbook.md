## Troubleshooting Playbook (Step-by-Step)

This is meant to be followed like a checklist.

### 1) “The UI is up but it shows no data”

- Confirm backend health:
  - `GET http://localhost:5001/health`
- Confirm there are machines:
  - Configuration → PC List
- Confirm something actually ran:
  - Data Viewer → Job Monitor tab
  - Look for recent CHECK_RESULT entries

If nothing ran:
- create/enable scheduled jobs (Configuration → Job Scheduler), or
- run an AdHoc Scan, or
- click “Run Full Check” from Dashboard.

### 2) “Ping says Offline but I can reach the machine”

Remember: `PING` is **remote execution**, not ICMP.

So failures usually mean:
- wrong credentials
- WinRM not enabled / not reachable
- TrustedHosts / auth transport mismatch

Use Configuration → Scan authentication to confirm the effective auth source.

### 3) “Service check says missing but I swear it exists”

Checklist:
- Are you using **Service Name** or **Display Name**?
  - SmartConsole matches Win32_Service.Name, not DisplayName.
- If you used executable path matching:
  - the matcher is a substring of Win32_Service.PathName
  - PathName often includes quotes + arguments
  - try matching the stable portion like `\\System32\\snmptrap.exe`

### 4) “Registry/File results show as SUCCESS even when missing”

They shouldn’t: evaluator logic treats `resultData.exists=false` as FAILED.

If you see a mismatch:
- open the row in Data Viewer → “ResultData (JSON)”
- confirm `exists` is present and boolean
- if `exists` is missing, the PowerShell collector isn’t returning the expected JSON shape

### 5) “Email reports won’t send”

- Confirm SMTP settings are configured:
  - Configuration → SMTP
  - or `GET /api/settings/smtp`
- If using Gmail:
  - you need an App Password
- Confirm report is active and has recipients
- Try “Send Now”
- Check backend logs (`docker compose logs -f backend`)

### 6) “Everything is slow / queue backlog”

- Look for too-frequent schedules:
  - set up the recommended 3-cadence
- Avoid FULL_CHECK too often (it runs everything)
- Reduce number of selected objects on Dashboard (latest-results polling cost)


