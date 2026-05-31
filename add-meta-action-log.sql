-- Meta optimization action log — records every optimization/management action
-- attempted on a client's campaigns (what was tried, Meta's response, success/fail).
-- Powers the activity report in the campaign dashboard and client card.
-- Run once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS app_meta_action_log (
  id           TEXT PRIMARY KEY,
  client_id    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  action_kind  TEXT,
  category     TEXT,
  title        TEXT,
  status       TEXT,          -- 'success' | 'failed' | 'info'
  meta_id      TEXT,
  object_type  TEXT,          -- 'adset' | 'ad' | 'campaign' | 'audience'
  detail       TEXT,
  error        TEXT,
  actor        TEXT
);

CREATE INDEX IF NOT EXISTS idx_meta_action_log_client ON app_meta_action_log (client_id, created_at DESC);
