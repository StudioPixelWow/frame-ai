-- Facebook Page + Instagram publishing support.
-- Run once in the Supabase SQL Editor.

-- Page token stored SEPARATELY from the ad-account token so connecting a page
-- doesn't overwrite the Meta ad token (they're different tokens).
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS fb_page_id            TEXT,
  ADD COLUMN IF NOT EXISTS fb_page_name          TEXT,
  ADD COLUMN IF NOT EXISTS fb_page_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS fb_page_picture        TEXT,
  ADD COLUMN IF NOT EXISTS ig_user_id            TEXT,   -- linked Instagram business account
  ADD COLUMN IF NOT EXISTS ig_username           TEXT,
  ADD COLUMN IF NOT EXISTS social_connected_at   TIMESTAMPTZ;

-- Scheduled / published social posts queue.
CREATE TABLE IF NOT EXISTS app_social_posts (
  id            TEXT PRIMARY KEY,
  client_id     TEXT,
  client_name   TEXT,
  kind          TEXT,            -- 'post' | 'story'
  message       TEXT,
  media_url     TEXT,
  media_type    TEXT,            -- 'image' | 'video' | null
  targets       JSONB,           -- e.g. {"facebook":true,"instagram":true}
  scheduled_at  TIMESTAMPTZ,     -- null = publish now
  status        TEXT,            -- 'scheduled' | 'published' | 'failed'
  result        JSONB,           -- per-network post ids / errors
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  published_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_social_posts_client ON app_social_posts (client_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_due ON app_social_posts (status, scheduled_at);
