/**
 * GET  /api/podcast/episodes - List episodes (optional ?clientId filter)
 * POST /api/podcast/episodes - Create a new episode
 *
 * Two-tier persistence (same pattern as podcast-db.ts):
 *   1. Relational table `podcast_episodes` — if it exists
 *   2. Fallback: `app_podcast_episodes` (SupabaseCrud JSONB)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabase } from '@/lib/db/store';
import { podcastEpisodes } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/* ── Auto-migration: create podcast_episodes table if missing ── */

const CREATE_TABLE_SQL = `
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
`;

let _tableCreationAttempted = false;

async function ensureTable(): Promise<boolean> {
  if (_tableCreationAttempted) return false;
  _tableCreationAttempted = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  // Try exec_sql RPC
  const sb = createClient(url, key);
  for (const param of ['sql', 'query', 'sql_text']) {
    try {
      const { error } = await sb.rpc('exec_sql', { [param]: CREATE_TABLE_SQL });
      if (!error) {
        console.log('[podcast-episodes] Auto-created podcast_episodes table via exec_sql');
        // Notify PostgREST to reload schema
        await sb.rpc('exec_sql', { [param]: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});
        return true;
      }
      if (error.message?.includes('already exists')) return true;
      if (error.message?.includes('argument') || error.message?.includes('Could not find')) continue;
    } catch { continue; }
  }

  // Fallback: REST endpoint
  try {
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ sql: CREATE_TABLE_SQL }),
    });
    if (res.ok) {
      console.log('[podcast-episodes] Auto-created podcast_episodes table via REST');
      return true;
    }
  } catch {}

  console.warn('[podcast-episodes] Could not auto-create table — run migration manually');
  return false;
}

/* ── Mode detection (cached per process) ── */

type StorageMode = 'relational' | 'jsonb';
let _mode: StorageMode | null = null;
let _modePromise: Promise<StorageMode> | null = null;

async function detectMode(): Promise<StorageMode> {
  if (_mode) return _mode;
  if (_modePromise) return _modePromise;

  _modePromise = (async (): Promise<StorageMode> => {
    try {
      const sb = getSupabase();
      const { error } = await sb.from('podcast_episodes').select('id').limit(0);
      if (!error) {
        console.log('[podcast-episodes] Using relational table podcast_episodes');
        return 'relational';
      }
      console.warn('[podcast-episodes] detectMode relational check failed:', error.message);

      // Table doesn't exist — try to create it
      const created = await ensureTable();
      if (created) {
        // Re-check after creation
        const { error: retryError } = await sb.from('podcast_episodes').select('id').limit(0);
        if (!retryError) {
          console.log('[podcast-episodes] Table auto-created successfully, using relational mode');
          return 'relational';
        }
      }
    } catch (e) {
      console.warn('[podcast-episodes] detectMode threw:', e);
    }

    console.log('[podcast-episodes] Using JSONB fallback table app_podcast_episodes');
    return 'jsonb';
  })();

  _mode = await _modePromise;
  _modePromise = null;
  return _mode;
}

/* ── GET ── */

export async function GET(req: NextRequest) {
  try {
    const mode = await detectMode();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (mode === 'relational') {
      const sb = getSupabase();
      let query = sb
        .from('podcast_episodes')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) {
        // If relational suddenly fails, switch to JSONB
        console.warn('[podcast-episodes] relational GET failed, falling back to JSONB:', error.message);
        _mode = 'jsonb';
      } else {
        return NextResponse.json(data ?? []);
      }
    }

    // JSONB mode
    const items = await podcastEpisodes.getAllAsync();
    let result = items as Record<string, any>[];
    if (clientId) {
      result = result.filter(
        (ep) => ep.clientId === clientId || ep.client_id === clientId
      );
    }
    // Sort by creation date descending
    result.sort((a, b) => {
      const da = a.createdAt || a.created_at || '';
      const db = b.createdAt || b.created_at || '';
      return db.localeCompare(da);
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[podcast-episodes] GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

/* ── POST ── */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      title,
      showName,
      guestNames,
      language,
      sourceFilePath,
      sourceFileSize,
      clientId,
    } = body;

    if (!title || !sourceFilePath) {
      return NextResponse.json(
        { error: 'title and sourceFilePath are required' },
        { status: 400 }
      );
    }

    const mode = await detectMode();

    if (mode === 'relational') {
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from('podcast_episodes')
          .insert({
            title,
            show_name: showName || null,
            guest_names: guestNames || null,
            language: language || 'he',
            source_file_path: sourceFilePath,
            source_file_size: sourceFileSize || null,
            client_id: clientId || null,
            status: 'uploaded',
            processing_progress: {},
            metadata: {},
          })
          .select()
          .single();

        if (error) {
          console.warn('[podcast-episodes] relational POST failed, falling back to JSONB:', error.message);
          _mode = 'jsonb';
        } else {
          return NextResponse.json(data, { status: 201 });
        }
      } catch (e) {
        console.warn('[podcast-episodes] relational POST threw, falling back to JSONB:', e);
        _mode = 'jsonb';
      }
    }

    // JSONB mode — last resort fallback
    // CRITICAL: Force a real UUID so downstream systems (polling, processing) work.
    // SupabaseCrud.createAsync may return temp-XXXX IDs when the JSONB table
    // doesn't exist, which breaks Supabase REST queries and the process route.
    const now = new Date().toISOString();
    const forcedId = randomUUID();

    // Try direct insert into the relational table one more time with our own UUID
    try {
      const sb = getSupabase();
      const { data: retryData, error: retryError } = await sb
        .from('podcast_episodes')
        .insert({
          id: forcedId,
          title,
          show_name: showName || null,
          guest_names: guestNames || null,
          language: language || 'he',
          source_file_path: sourceFilePath,
          source_file_size: sourceFileSize || null,
          client_id: clientId || null,
          status: 'uploaded',
          processing_progress: {},
          metadata: {},
        })
        .select()
        .single();

      if (!retryError && retryData) {
        console.log('[podcast-episodes] JSONB fallback recovered — relational insert succeeded with forced UUID');
        _mode = 'relational'; // Fix cached mode
        return NextResponse.json(retryData, { status: 201 });
      }
      console.warn('[podcast-episodes] Retry relational insert also failed:', retryError?.message);
    } catch (retryErr) {
      console.warn('[podcast-episodes] Retry relational threw:', retryErr);
    }

    // True JSONB fallback — still use a real UUID
    const created = await podcastEpisodes.createAsync({
      title,
      showName: showName || null,
      guestNames: guestNames || null,
      language: language || 'he',
      sourceFilePath,
      sourceFileSize: sourceFileSize || null,
      clientId: clientId || null,
      status: 'uploaded',
      processingProgress: { stage: '', percent: 0, stageLabel: '', startedAt: null, estimatedRemaining: null },
      errorMessage: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    } as any);

    // Override the temp ID if SupabaseCrud returned one
    if (created && typeof created.id === 'string' && created.id.startsWith('temp-')) {
      (created as any).id = forcedId;
      console.warn(`[podcast-episodes] Replaced temp ID with forced UUID: ${forcedId}`);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[podcast-episodes] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create episode' },
      { status: 400 }
    );
  }
}
