## Service Checks (Windows Services) — Explained Simply

Service checks answer questions like:
- “Does this service exist on the machine?”
- “If it exists, what state is it in?”
- “Is it Running (or intentionally Stopped)?”

### Two ways to identify a service

In Windows, the service has multiple identities:
- **Name** (technical, stable): like `SNMPTRAP`
- **DisplayName** (human label): like “SNMP Trap”
- **PathName** (where the executable lives): often includes quotes and arguments

SmartConsole supports two matching strategies:

- **Service Name** (`serviceName`)
  - Matches Win32_Service.Name exactly
  - Best when you know the service’s real name (not display name)

- **Executable Path substring** (`executablePath`)
  - Searches Win32_Service.PathName for a substring match
  - Helpful when service name varies, but the binary path is consistent

You can provide one or both.

### What gets stored in history (resultData)

Service checks are stored as JSON in `check_results.resultData`.
Typical fields:
- `exists` (boolean)
- `matchedBy` (`serviceName` or `executablePath`)
- `name` / `displayName`
- `state` (e.g. Running, Stopped)
- `startMode` (Auto, Manual, Disabled)
- `pathName`
- `processId`

### Pass/Fail logic (evaluator)

Think of this like grading:

- **If the service does not exist** → `FAILED`
  - resultData will include `exists: false`

- **If it exists and expectedStatus is a specific state**
  - If the actual state is different → `WARNING`
  - Otherwise → `SUCCESS` (assuming the remote call succeeded)

- **If expectedStatus is "Tracking"**
  - Always record state
  - Don’t warn on state changes

### A concrete example (SNMP Trap)

Example configuration:
- Name: **SNMP Trap Service**
- Service Name: **SNMPTRAP**
- Executable Path: **C:\Windows\System32\snmptrap.exe**
- Expected Status: **Running**

If the machine reports:
- `exists=true`, `state=Stopped` → the result is `WARNING`

### Where to look in code

- **DB model**: `backend/prisma/schema.prisma` (`ServiceCheck`)
- **Collector (PowerShell)**: `backend/src/services/powershell-executor.ts` (`getServiceInfo`)
- **Evaluator (status)**: `backend/src/services/check-evaluators.ts` (`evaluateServiceCheckResult`)
- **CRUD API**: `backend/src/routes/config.ts` (`/api/config/service-checks`)
- **UI**: `frontend/src/app/pages/Configuration.tsx` (Service Checks tab)

Next: `05-ui-tour.md`.


