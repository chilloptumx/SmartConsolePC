-- Optional: create application role + database for SmartConsole.
-- Run this as a Postgres admin (e.g., `postgres`) against an admin database (often `postgres`).
--
-- IMPORTANT:
-- - Change the password.
-- - Some managed Postgres providers disallow CREATE DATABASE / CREATE ROLE.
--   In that case, create them in the provider UI and skip this script.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'healthcheck') THEN
    CREATE ROLE healthcheck LOGIN PASSWORD 'change_me_strong_password';
  END IF;
END $$;

-- Create the database if it does not exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'healthcheck') THEN
    CREATE DATABASE healthcheck OWNER healthcheck;
  END IF;
END $$;

-- Recommended defaults (optional). Run against the *target* database if desired.
-- ALTER DATABASE healthcheck SET timezone TO 'UTC';


