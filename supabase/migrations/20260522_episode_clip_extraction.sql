-- ============================================================
-- Episode Clip Extraction Flow — Migration
-- Creates: app_episode_analyses, app_approved_clips
-- Upgrades: app_podcast_clip_candidates (new columns)
-- ============================================================

-- 1. Episode Analyses table (stores full-episode analysis results)
CREATE TABLE IF NOT EXISTS app_episode_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_episode_analyses_episode_id
  ON app_episode_analyses ((data->>'episodeId'));

-- 2. Approved Clips table (created ONLY after user approval)
CREATE TABLE IF NOT EXISTS app_approved_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approved_clips_episode_id
  ON app_approved_clips ((data->>'episodeId'));

CREATE INDEX IF NOT EXISTS idx_approved_clips_status
  ON app_approved_clips ((data->>'status'));

CREATE INDEX IF NOT EXISTS idx_approved_clips_queue_position
  ON app_approved_clips (((data->>'queuePosition')::int))
  WHERE data->>'status' IN ('queued', 'processing');

-- 3. Podcast Clip Candidates — ensure table exists (JSONB pattern)
--    New fields (candidateStatus, clipIndex, description, hookSentence,
--    topic, confidenceScore, reasonForSelection, previewThumbnail)
--    are stored inside the JSONB `data` column, no ALTER needed.
CREATE TABLE IF NOT EXISTS app_podcast_clip_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_podcast_clip_candidates_episode_id
  ON app_podcast_clip_candidates ((data->>'episodeId'));

CREATE INDEX IF NOT EXISTS idx_podcast_clip_candidates_status
  ON app_podcast_clip_candidates ((data->>'candidateStatus'));

-- 4. Enable RLS (match existing pattern)
ALTER TABLE app_episode_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_approved_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_podcast_clip_candidates ENABLE ROW LEVEL SECURITY;

-- Allow full access (service-role key pattern used by the app)
CREATE POLICY IF NOT EXISTS "Allow all for episode_analyses"
  ON app_episode_analyses FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow all for approved_clips"
  ON app_approved_clips FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow all for podcast_clip_candidates"
  ON app_podcast_clip_candidates FOR ALL USING (true) WITH CHECK (true);
