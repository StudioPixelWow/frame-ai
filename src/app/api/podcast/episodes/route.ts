/**
 * GET  /api/podcast/episodes - List episodes (optional ?clientId filter)
 * POST /api/podcast/episodes - Create a new episode
 *
 * Two-tier persistence (same pattern as podcast-db.ts):
 *   1. Relational table `podcast_episodes` — if it exists
 *   2. Fallback: `app_podcast_episodes` (SupabaseCrud JSONB)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { podcastEpisodes } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
    } catch {}

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

    // JSONB mode
    const now = new Date().toISOString();
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

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[podcast-episodes] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create episode' },
      { status: 400 }
    );
  }
}
