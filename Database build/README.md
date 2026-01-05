# Database build (External Postgres)

This folder contains everything you need to **create a fresh Postgres database schema** for SmartConsole **without any data** (no seed). Use it when you want to run the backend against a **separate Postgres instance** (local Postgres, VM, cloud Postgres, etc.) instead of the Docker Postgres container.

## What’s in here

- `01-create-db-and-user.sql`: Optional SQL to create a database + application user (run as an admin user).
- `schema.sql`: The **schema-only** SQL for the current app (generated from Prisma). Apply this to an empty database.
- `02-apply-schema.ps1`: PowerShell helper to apply `schema.sql` using `psql`.
- `03-generate-schema.ps1`: PowerShell helper to regenerate `schema.sql` from `backend/prisma/schema.prisma`.
- `env.external-postgres.example`: Example environment variables for pointing the backend at an external Postgres.

## Prerequisites

- Postgres server you can connect to (v13+ recommended)
- `psql` available on your machine (Postgres client tools)
- Optional (only if regenerating schema): Node.js + the backend dependencies installed (`backend/package.json`)

## Option A (Recommended): Use Prisma migrations (creates `_prisma_migrations`)

This is the best path if you plan to keep using Prisma normally with this database.

1. Copy the example env file and edit it:

   - Copy `Database build/env.external-postgres.example` to your own `.env` (wherever you store secrets).
   - Set `DATABASE_URL` to your external Postgres connection string.

2. From the repo root, run:

```powershell
cd backend
npm ci
npm run prisma:migrate
```

That will create the schema (and Prisma’s migration history table). **It will not seed data** unless you explicitly run `npm run prisma:seed`.

## Option B: Apply `schema.sql` directly with `psql` (no Node required)

Use this if you only want the schema and don’t care about Prisma’s migration history table.

### 1) Create database + user (optional)

If your Postgres provider allows it, connect as an admin and run:

```powershell
psql "postgresql://postgres:<ADMIN_PASSWORD>@<HOST>:5432/postgres" -v ON_ERROR_STOP=1 -f "Database build/01-create-db-and-user.sql"
```

Notes:
- Many managed Postgres providers do **not** allow `CREATE DATABASE`. In that case, create the DB via the provider’s UI and skip this step.
- Edit `01-create-db-and-user.sql` placeholders before running, or use `psql -v` variables if you prefer.

### 2) Apply the schema

Either run the helper script:

```powershell
.\Database\ build\02-apply-schema.ps1 -DatabaseUrl "postgresql://healthcheck:<PASSWORD>@<HOST>:5432/healthcheck?schema=public"
```

Or run `psql` directly:

```powershell
psql "postgresql://healthcheck:<PASSWORD>@<HOST>:5432/healthcheck?schema=public" -v ON_ERROR_STOP=1 -f "Database build/schema.sql"
```

## Regenerating `schema.sql` (when Prisma schema changes)

If `backend/prisma/schema.prisma` changes, regenerate `Database build/schema.sql`:

```powershell
.\Database\ build\03-generate-schema.ps1
```

This uses `prisma migrate diff --from-empty --to-schema-datamodel ... --script` to produce a fresh schema-only SQL file.


