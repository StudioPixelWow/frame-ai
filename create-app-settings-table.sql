-- Creates the app_settings table used to store the Meta Business Manager token
-- (and other app-level key/value settings). Run this once in the Supabase SQL Editor.
--
-- The connect route saves: { key: 'meta_business_token', value: { access_token, ... } }

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- The server uses the Supabase SERVICE ROLE key, which bypasses RLS, so no
-- policies are required. (RLS stays disabled by default on new tables.)
