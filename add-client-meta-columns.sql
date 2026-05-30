-- Adds the Meta connection columns to the clients table.
-- Without these, assigning an ad account to a client fails (the UPDATE has
-- nowhere to write), so nothing is saved and the client stays "not connected".
-- Run once in the Supabase SQL Editor.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS meta_ad_account_id     TEXT,
  ADD COLUMN IF NOT EXISTS meta_access_token      TEXT,
  ADD COLUMN IF NOT EXISTS meta_connection_status TEXT,
  ADD COLUMN IF NOT EXISTS meta_last_synced_at    TIMESTAMPTZ;
