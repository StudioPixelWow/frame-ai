/**
 * Playbooks API
 * GET: Get playbooks (optional ?industry= filter)
 * POST: Save/update a playbook
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlaybooks, savePlaybook, seedDefaultPlaybooks } from '@/lib/agency-intelligence/playbooks';

export async function GET(req: NextRequest) {
  try {
    const industry = req.nextUrl.searchParams.get('industry') || undefined;
    const playbooks = await getPlaybooks(industry);
    return NextResponse.json(playbooks);
  } catch {
    return NextResponse.json({ error: 'Failed to load playbooks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Seed defaults
    if (body.action === 'seed') {
      const count = await seedDefaultPlaybooks();
      return NextResponse.json({ success: true, seeded: count });
    }

    // Save/update
    if (!body.industry) {
      return NextResponse.json({ error: 'industry is required' }, { status: 400 });
    }
    const success = await savePlaybook(body);
    if (!success) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
