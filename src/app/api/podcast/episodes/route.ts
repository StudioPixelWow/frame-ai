/**
 * GET  /api/podcast/episodes - List episodes (optional ?clientId filter)
 * POST /api/podcast/episodes - Create a new episode
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

// ── Auto-migration: create podcast tables if missing ─────────────────────
let migrationAttempted = false;

async function ensurePodcastTables(): Promise<void> {
  if (migrationAttempted) return;
  migrationAttempted = true;

  const ddl = `
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

  try {
    await supabase.rpc('exec_sql', { sql: ddl });
  } catch {
    // exec_sql not available — tables must exist already or be created via migration endpoint
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensurePodcastTables();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    let query = supabase
      .from('podcast_episodes')
      .select('*')
      .order('created_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensurePodcastTables();
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

    const { data, error } = await supabase
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create episode' },
      { status: 400 }
    );
  }
}
