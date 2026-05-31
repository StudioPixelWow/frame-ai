-- Default content cadence for clients: 2 posts/week (Monday + Thursday).
-- Run once in the Supabase SQL Editor.

-- Weekly posts count → default 2
ALTER TABLE clients ADD COLUMN IF NOT EXISTS weekly_posts_count INTEGER DEFAULT 2;
ALTER TABLE clients ALTER COLUMN weekly_posts_count SET DEFAULT 2;
UPDATE clients SET weekly_posts_count = 2 WHERE weekly_posts_count IS NULL;

-- Preferred publish days → default Monday(1) + Thursday(4), stored as JSON array.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS publish_days JSONB DEFAULT '[1,4]'::jsonb;
ALTER TABLE clients ALTER COLUMN publish_days SET DEFAULT '[1,4]'::jsonb;
UPDATE clients SET publish_days = '[1,4]'::jsonb WHERE publish_days IS NULL;
