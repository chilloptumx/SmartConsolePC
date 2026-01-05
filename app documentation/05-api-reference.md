## API reference (core)

Base URL (default):
- Host: `http://localhost:5001`

All API routes are under `/api/*`.

### Health
- `GET /health`

### Machines
- `GET /api/machines`
- `POST /api/machines`
- `GET /api/machines/:id`
- `PUT /api/machines/:id`
- `DELETE /api/machines/:id`
- `POST /api/machines/:id/check` (body: `{ checkType: "FULL_CHECK" | ... }`)

### Configuration
Registry checks:
- `GET /api/config/registry-checks`
- `POST /api/config/registry-checks`
- `PUT /api/config/registry-checks/:id`
- `DELETE /api/config/registry-checks/:id`

File checks:
- `GET /api/config/file-checks`
- `POST /api/config/file-checks`
- `PUT /api/config/file-checks/:id`
- `DELETE /api/config/file-checks/:id`

User checks:
- `GET /api/config/user-checks`
- `POST /api/config/user-checks`
- `PUT /api/config/user-checks/:id`
- `DELETE /api/config/user-checks/:id`

System checks:
- `GET /api/config/system-checks`
- `POST /api/config/system-checks`
- `PUT /api/config/system-checks/:id`
- `DELETE /api/config/system-checks/:id`

### Ad-hoc scan
- `POST /api/adhoc-scan/run`

Body:
```json
{
  "machineIds": ["uuid"],
  "builtIns": { "ping": true, "userInfo": true, "systemInfo": false },
  "registryCheckIds": ["uuid"],
  "fileCheckIds": ["uuid"],
  "userCheckIds": ["uuid"],
  "systemCheckIds": ["uuid"]
}
```

Response returns a `startedAt` marker and `expected[]` objects. The UI polls latest results using:
- `POST /api/data/latest-results`

Manual one-off target (not persisted):
- `POST /api/adhoc-scan/run-direct`

Body:
```json
{
  "targetHost": "hostname-or-ip",
  "builtIns": { "ping": true, "userInfo": true, "systemInfo": false },
  "registryCheckIds": ["uuid"],
  "fileCheckIds": ["uuid"],
  "userCheckIds": ["uuid"],
  "systemCheckIds": ["uuid"]
}
```

Response returns `results[]` immediately and does **not** create a Machine record or persist results to the database.

### Data
- `GET /api/data/results` (filters + pagination)
- `GET /api/data/results/:id`
- `GET /api/data/results/export`
- `GET /api/data/stats`
- `GET /api/data/collected-objects`
- `POST /api/data/latest-results`
- `GET /api/data/users`

### Schedules / jobs
- `GET /api/schedules/jobs`
- `POST /api/schedules/jobs`
- `PUT /api/schedules/jobs/:id`
- `DELETE /api/schedules/jobs/:id`
- `POST /api/schedules/jobs/:id/run-now`

### Reports
- `GET /api/reports`
- `POST /api/reports`
- `PUT /api/reports/:id`
- `DELETE /api/reports/:id`
- `POST /api/reports/:id/send-now`

### Monitor / audit
- `GET /api/monitor/events`


