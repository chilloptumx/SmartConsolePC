## Job Types, Cadence, and “What Runs When”

The backend uses one enum to describe “kinds of work”:
- Prisma/DB: `JobType`
- Code: `jobType` strings like `"SERVICE_CHECK"`

### The current job types (JobType)

- **PING**: remote-exec probe (not ICMP)
- **REGISTRY_CHECK**: run one registry check (or all active if scheduled)
- **FILE_CHECK**: run one file check (or all active if scheduled)
- **SERVICE_CHECK**: run one service check (or all active if scheduled)
- **USER_INFO**: built-in user info *or* configured user checks
- **SYSTEM_INFO**: built-in system info *or* configured system checks
- **BASELINE_CHECK**: “everything else” cadence (system + registry + file + service; no ping/user)
- **FULL_CHECK**: full suite (ping + system + user + registry + file + service)

### The “3-cadence” recommendation (why it exists)

If you run EVERYTHING every 5 minutes, you’ll:
- overload the target machines (and your queue),
- create noisy data,
- and make “what changed?” harder to see.

The app’s recommended cadence splits work into 3 independent schedules:

```
Ping cadence         -> PING            (fast, answers: “can we reach it?”)
User cadence         -> USER_INFO        (moderate, answers: “who’s logged in?”)
Everything else      -> BASELINE_CHECK   (heavier, answers: “configuration drift / health signals”)
```

### FULL_CHECK vs BASELINE_CHECK (the difference)

This is the most common confusion.

- **FULL_CHECK** = “do literally everything”
  - Ping
  - All active system checks
  - All active user checks
  - All active registry checks
  - All active file checks
  - All active service checks

- **BASELINE_CHECK** = “everything except the fast/volatile stuff”
  - All active system checks
  - All active registry checks
  - All active file checks
  - All active service checks
  - (No Ping, No User)

### Service check “Tracking” mode (why it exists)

Sometimes you don’t want alerts, you want **telemetry**:
- “record state over time”
- “show it in UI”
- “don’t warn on mismatch”

That’s what **Expected Status = Tracking** does:
- the result JSON still includes `state`, `startMode`, etc.
- the evaluator does *not* create a `WARNING` when state changes

Next: `04-service-checks.md`.


