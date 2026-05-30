-- Many-to-many: a client can have MULTIPLE ad accounts (5-6+), and an ad account
-- can serve multiple clients. Run once in the Supabase SQL Editor.
-- The legacy clients.meta_ad_account_id stays as the "primary" account for back-compat.

CREATE TABLE IF NOT EXISTS app_client_ad_accounts (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  account_name  TEXT,
  assigned_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, ad_account_id)
);
CREATE INDEX IF NOT EXISTS idx_caa_client  ON app_client_ad_accounts (client_id);
CREATE INDEX IF NOT EXISTS idx_caa_account ON app_client_ad_accounts (ad_account_id);
