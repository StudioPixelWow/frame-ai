-- Campaign-level assignments: lets a single ad account serve MULTIPLE clients,
-- with each campaign assigned to exactly one client.
-- Run once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS app_meta_campaign_assignments (
  meta_campaign_id TEXT PRIMARY KEY,
  ad_account_id    TEXT,
  campaign_name    TEXT,
  client_id        TEXT,
  client_name      TEXT,
  access_token     TEXT,
  assigned_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mca_client ON app_meta_campaign_assignments (client_id);
CREATE INDEX IF NOT EXISTS idx_mca_account ON app_meta_campaign_assignments (ad_account_id);
