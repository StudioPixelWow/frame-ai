import { NextRequest, NextResponse } from 'next/server';
import { podcastStrategies } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
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

    const created = await podcastStrategies.createAsync(body);
    console.log('[podcast-strategies] POST created id:', created.id, '| temp?', created.id?.startsWith('temp-'));

    // Safety: if we got a temp-* id, the table doesn't exist — tell the client
    if (created.id?.startsWith('temp-')) {
      console.error('[podcast-strategies] POST FAILED — table app_podcast_strategies does not exist. Run /api/data/migrate-collections');
      return NextResponse.json(
        { error: 'Database table not ready. Run migration first: GET /api/data/migrate-collections' },
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
