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

export async function GET(req: NextRequest) {
  try {
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
