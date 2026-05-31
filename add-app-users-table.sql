-- Login accounts table (admin/employee/client). Required for creating user logins.
-- Run once in the Supabase SQL Editor if creating a user returns
-- "טבלת app_users לא קיימת" / relation app_users does not exist.

CREATE TABLE IF NOT EXISTS app_users (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
