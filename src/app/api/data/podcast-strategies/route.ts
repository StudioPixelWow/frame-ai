import { NextRequest, NextResponse } from 'next/server';
import { podcastStrategies } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await podcastStrategies.getAllAsync());
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch podcast strategies' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
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
    const created = await podcastStrategies.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create podcast strategy' }, { status: 400 });
  }
}
