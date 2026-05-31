-- Attached files for tasks (array of "name|url" entries pointing to Supabase Storage).
-- Run once in the Supabase SQL Editor so uploaded task files actually persist.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;
