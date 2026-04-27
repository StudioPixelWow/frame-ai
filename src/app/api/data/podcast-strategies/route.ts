import { NextRequest, NextResponse } from 'next/server';
import { podcastStrategies } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { getSupabase } from '@/lib/db/store';

/**
 * Ensure the podcast_strategies table exists.
 * Tries exec_sql RPC first, falls back to direct .from() probe.
 * If table doesn't exist and can't be created, returns false.
 */
async function ensurePodcastTable(): Promise<boolean> {
  const sb = getSupabase();
  const tableName = 'app_podcast_strategies';

  // Quick check: is the table already accessible?
  try {
    const { error } = await sb.from(tableName).select('id').limit(0);
    if (!error) return true;
  } catch {}

  // Table not accessible — try to create it
  const ddl = `CREATE TABLE IF NOT EXISTS public.${tableName} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );`;

  try {
    const { error } = await sb.rpc('exec_sql', { query: ddl });
    if (!error) {
      // Refresh PostgREST cache
      await sb.rpc('exec_sql', { query: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});
      console.log(`[podcast-strategies] Auto-created table ${tableName}`);
      return true;
    }
    console.warn(`[podcast-strategies] exec_sql failed:`, error.message);
  } catch (e) {
    console.warn(`[podcast-strategies] exec_sql RPC not available`);
  }

  return false;
}

export async function GET() {
  ensureSeeded();
  try {
    const tableReady = await ensurePodcastTable();
    if (!tableReady) {
      // Table doesn't exist and can't be auto-created — return empty array (not 500)
      // This lets the UI work gracefully: no strategies yet, wizard can still open
      console.warn('[podcast-strategies] GET — table not ready, returning empty array');
      return NextResponse.json([]);
    }
    const all = await podcastStrategies.getAllAsync();
    console.log(`[podcast-strategies] GET → ${all.length} strategies found`);
    return NextResponse.json(all);
  } catch (error) {
    console.error('[podcast-strategies] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch podcast strategies' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    // First, ensure the table exists before attempting insert
    const tableReady = await ensurePodcastTable();

    const body = await req.json();
    console.log('[podcast-strategies] POST body keys:', Object.keys(body));
    const now = new Date().toISOString();
    if (!body.createdAt) body.createdAt = now;
    if (!body.updatedAt) body.updatedAt = now;
    // Safe defaults for JSONB fields
    if (!body.goals) body.goals = [];
    if (!body.questions) body.questions = [];
    if (!body.clipIdeas) body.clipIdeas = [];
    if (!body.persona) body.persona = { tone: 'casual', expertiseLevel: 'expert', speakingStyle: '', industry: '', audience: '' };
    if (!body.episodeStructure) body.episodeStructure = null;
    if (!body.status) body.status = 'draft';
    if (body.clientApproved === undefined) body.clientApproved = false;
    if (body.clientApprovedAt === undefined) body.clientApprovedAt = null;
    if (body.useRealAI === undefined) body.useRealAI = false;

    if (!tableReady) {
      console.error('[podcast-strategies] POST — table not ready, cannot save');
      return NextResponse.json(
        { error: 'טבלת אסטרטגיות פודקאסט לא קיימת. יש להריץ מיגרציה: GET /api/data/migrate-collections', tableNotReady: true },
        { status: 503 }
      );
    }

    const created = await podcastStrategies.createAsync(body);
    console.log('[podcast-strategies] POST created id:', created.id, '| temp?', created.id?.startsWith('temp-'));

    // Safety: if we got a temp-* id despite table check passing, something went wrong
    if (created.id?.startsWith('temp-')) {
      console.error('[podcast-strategies] POST got temp-* id despite table check — persistence failure');
      return NextResponse.json(
        { error: 'שגיאה בשמירה למסד הנתונים. יש לבדוק את הטבלה app_podcast_strategies ב-Supabase.', tableNotReady: true },
        { status: 503 }
      );
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[podcast-strategies] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create podcast strategy' },
      { status: 400 }
    );
  }
}
