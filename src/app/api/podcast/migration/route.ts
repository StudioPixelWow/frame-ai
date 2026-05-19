/**
 * POST /api/podcast/migration - Create all podcast clip engine tables
 *
 * Runs CREATE TABLE IF NOT EXISTS for:
 *   podcast_episodes, podcast_transcripts, podcast_clip_candidates,
 *   podcast_rendered_clips, brand_presets
 *
 * Safe to run multiple times.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

const TABLES: Record<string, string> = {
  podcast_episodes: `
    CREATE TABLE IF NOT EXISTS public.podcast_episodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      client_id UUID,
      title TEXT NOT NULL,
      show_name TEXT,
      guest_names TEXT[],
      language TEXT DEFAULT 'he',
      source_file_path TEXT NOT NULL,
      source_file_size BIGINT,
      duration_seconds INTEGER,
      audio_file_path TEXT,
      status TEXT DEFAULT 'uploaded',
      processing_progress JSONB DEFAULT '{}',
      error_message TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `,

  podcast_transcripts: `
    CREATE TABLE IF NOT EXISTS public.podcast_transcripts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      episode_id UUID NOT NULL,
      provider TEXT,
      language TEXT,
      full_text TEXT,
      segments JSONB,
      speaker_labels JSONB,
      chunk_index INTEGER DEFAULT 0,
      chunk_start_time FLOAT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `,

  podcast_clip_candidates: `
    CREATE TABLE IF NOT EXISTS public.podcast_clip_candidates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      episode_id UUID NOT NULL,
      title TEXT NOT NULL,
      start_time FLOAT NOT NULL,
      end_time FLOAT NOT NULL,
      transcript_excerpt TEXT,
      topic_tags TEXT[] DEFAULT '{}',
      viral_score INTEGER DEFAULT 0,
      engagement_score INTEGER DEFAULT 0,
      hook_score INTEGER DEFAULT 0,
      reasoning TEXT DEFAULT '',
      is_selected BOOLEAN DEFAULT false,
      user_adjusted_start FLOAT,
      user_adjusted_end FLOAT,
      format_config JSONB,
      hook_package JSONB,
      brand_preset_id UUID,
      viral_style TEXT,
      timeline_edits JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `,

  podcast_rendered_clips: `
    CREATE TABLE IF NOT EXISTS public.podcast_rendered_clips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clip_candidate_id UUID NOT NULL,
      episode_id UUID NOT NULL,
      render_job_id UUID,
      output_format TEXT DEFAULT '16:9',
      output_file_path TEXT,
      output_file_size BIGINT,
      duration_seconds FLOAT,
      priority INTEGER DEFAULT 2,
      status TEXT DEFAULT 'queued',
      render_config JSONB DEFAULT '{}',
      social_package JSONB,
      thumbnail_paths TEXT[],
      completed_at TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `,

  brand_presets: `
    CREATE TABLE IF NOT EXISTS public.brand_presets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      client_id UUID,
      name TEXT NOT NULL,
      config JSONB DEFAULT '{}',
      intro_path TEXT,
      outro_path TEXT,
      logo_path TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `,
};

async function execSql(sql: string): Promise<{ success: boolean; error?: string }> {
  // Try different RPC param names that Supabase instances may use
  for (const param of ['sql', 'query', 'sql_text']) {
    try {
      const { error } = await supabase.rpc('exec_sql', { [param]: sql });
      if (!error) {
        return { success: true };
      }
      if (error.message?.includes('already exists')) {
        return { success: true };
      }
      // Wrong param name, try next
      if (error.message?.includes('argument') || error.message?.includes('Could not find')) {
        continue;
      }
      return { success: false, error: error.message };
    } catch (err) {
      continue;
    }
  }

  // Fallback: try raw REST endpoint
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (res.ok) {
      return { success: true };
    }

    const text = await res.text();
    return { success: false, error: `REST fallback failed: ${text}` };
  } catch (err) {
    return {
      success: false,
      error: `All methods failed. Run SQL manually in Supabase Dashboard.`,
    };
  }
}

export async function POST() {
  const results: Record<string, { success: boolean; error?: string }> = {};
  const failedSql: Record<string, string> = {};

  for (const [tableName, ddl] of Object.entries(TABLES)) {
    try {
      const result = await execSql(ddl);
      results[tableName] = result;
      if (!result.success) {
        failedSql[tableName] = ddl.trim();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results[tableName] = { success: false, error: errorMsg };
      failedSql[tableName] = ddl.trim();
    }
  }

  const allSucceeded = Object.values(results).every((r) => r.success);

  // Also run a schema reload notification
  try {
    await execSql("NOTIFY pgrst, 'reload schema';");
  } catch {
    // Non-critical
  }

  // ── Update bucket file_size_limit for large video uploads ──
  let bucketUpdate: { success: boolean; error?: string; fileSizeLimit?: number } = { success: false };
  try {
    const FIVE_GB = 5 * 1024 * 1024 * 1024; // 5 GB
    // Try to update existing bucket
    const { error: updateErr } = await supabase.storage.updateBucket('project-files', {
      fileSizeLimit: FIVE_GB,
      public: true,
    });
    if (updateErr) {
      // Bucket might not exist — try to create it
      const { error: createErr } = await supabase.storage.createBucket('project-files', {
        public: true,
        fileSizeLimit: FIVE_GB,
      });
      if (createErr) {
        bucketUpdate = { success: false, error: `update: ${updateErr.message}, create: ${createErr.message}` };
      } else {
        bucketUpdate = { success: true, fileSizeLimit: FIVE_GB };
      }
    } else {
      bucketUpdate = { success: true, fileSizeLimit: FIVE_GB };
    }
  } catch (e) {
    bucketUpdate = { success: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (allSucceeded) {
    return NextResponse.json({
      success: true,
      message: 'All podcast tables created successfully',
      results,
      bucketUpdate,
    });
  }

  return NextResponse.json(
    {
      success: false,
      message: 'Some tables failed to create. Run the SQL manually in Supabase Dashboard.',
      results,
      manualSql: failedSql,
      bucketUpdate,
    },
    { status: 207 }
  );
}
