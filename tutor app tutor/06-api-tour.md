## API Tour (What Exists, and How the UI Uses It)

SmartConsole’s frontend talks to the backend via HTTP under `/api/*`.

### Machines

- `GET /api/machines`
- `POST /api/machines`
- `PUT /api/machines/:id`
- `DELETE /api/machines/:id`
- `POST /api/machines/:id/check` (manual trigger; e.g. `{ checkType: "FULL_CHECK" }`)

### Configuration (CRUD)

These endpoints create the “test order definitions”:

- `GET/POST/PUT/DELETE /api/config/registry-checks`
- `GET/POST/PUT/DELETE /api/config/file-checks`
- `GET/POST/PUT/DELETE /api/config/service-checks`
- `GET/POST/PUT/DELETE /api/config/user-checks`
- `GET/POST/PUT/DELETE /api/config/system-checks`

### AdHoc scan

Two modes:

- **Queued (persisted history)**:
  - `POST /api/adhoc-scan/run`
  - returns `startedAt` + `expected[]`
  - UI polls `POST /api/data/latest-results`

- **Direct (not persisted)**:
  - `POST /api/adhoc-scan/run-direct`
  - returns `results[]` immediately

### Data browsing

- `GET /api/data/results` (server-side filters + pagination)
- `GET /api/data/results/:id`
- `GET /api/data/results/export`
- `GET /api/data/collected-objects` (machine-scoped or `scope=all`)
- `POST /api/data/latest-results` (bulk “latest per machine/object”)
- `GET /api/data/users` (distinct users seen in USER_INFO)

Two “dashboard helpers”:
- `POST /api/data/long-sessions`
- `POST /api/data/warnings-bucket`

### Scheduling + Reports

- Scheduled jobs: `GET/POST/PUT/DELETE /api/schedules/jobs` and `POST /api/schedules/jobs/:id/run-now`
- Email reports: `GET/POST/PUT/DELETE /api/reports` and `POST /api/reports/:id/send-now`

### Settings (safe UI visibility + controls)

- `GET /api/settings/smtp`
- `GET /api/settings/checks`
- `GET /api/settings/auth` and `PUT /api/settings/auth`
- `GET /api/settings/database` and `POST /api/settings/database/purge`

Next: `07-database-tour.md`.


