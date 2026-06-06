/**
 * UGC module tables — auto-created via ensureTable (exec_sql RPC), matching the
 * system's existing pattern. IDs are TEXT to match the rest of the app.
 */

import { ensureTable } from '@/lib/db/store';

export const DDL = {
  ugc_projects: `
    CREATE TABLE IF NOT EXISTS public.ugc_projects (
      id text PRIMARY KEY,
      user_id text,
      client_id text,
      business_name text NOT NULL,
      business_type text,
      goal text,
      target_audience text,
      tone text,
      language text DEFAULT 'he',
      duration integer DEFAULT 30,
      style text,
      brand_colors text,
      logo_url text,
      brief_json jsonb,
      result_json jsonb,
      status text DEFAULT 'draft',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );`,
  ugc_video_inputs: `
    CREATE TABLE IF NOT EXISTS public.ugc_video_inputs (
      id text PRIMARY KEY,
      project_id text,
      selling_points text,
      location text,
      existing_assets text,
      presenter_type text,
      ai_tools_selected jsonb,
      notes text,
      created_at timestamptz DEFAULT now()
    );`,
  ugc_scripts: `
    CREATE TABLE IF NOT EXISTS public.ugc_scripts (
      id text PRIMARY KEY,
      project_id text,
      variation_label text,
      hook text,
      full_script text,
      shot_breakdown jsonb,
      captions jsonb,
      cta text,
      status text DEFAULT 'generated',
      created_at timestamptz DEFAULT now()
    );`,
  ugc_prompts: `
    CREATE TABLE IF NOT EXISTS public.ugc_prompts (
      id text PRIMARY KEY,
      project_id text,
      variation_label text,
      tool_name text,
      prompt_type text,
      prompt_text text,
      status text DEFAULT 'ready',
      output_url text,
      created_at timestamptz DEFAULT now()
    );`,
  ugc_exports: `
    CREATE TABLE IF NOT EXISTS public.ugc_exports (
      id text PRIMARY KEY,
      project_id text,
      final_video_url text,
      subtitles_url text,
      aspect_ratio text DEFAULT '9:16',
      duration integer,
      created_at timestamptz DEFAULT now()
    );`,
};

let _done = false;
export async function ensureUgcTables(): Promise<void> {
  if (_done) return;
  for (const [name, ddl] of Object.entries(DDL)) {
    try { await ensureTable(name, ddl); } catch { /* best-effort; SQL fallback documented */ }
  }
  _done = true;
}

export function ugcId(prefix = 'ugc'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
