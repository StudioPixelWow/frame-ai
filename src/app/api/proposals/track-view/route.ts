/**
 * POST /api/proposals/track-view - Track a proposal view via public token
 * Body: { publicToken }
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposals } from '@/lib/db/collections';
import type { Proposal } from '@/lib/db/schema';

export async function POST(req: NextRequest) {
  try {
    const { publicToken } = await req.json();
    if (!publicToken) {
      return NextResponse.json({ error: 'Missing publicToken' }, { status: 400 });
    }

    // Find proposal by publicToken
    const all = await proposals.getAllAsync();
    const proposal = (all as Proposal[]).find((p) => p.publicToken === publicToken);
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updates: Partial<Proposal> = {
      viewCount: (proposal.viewCount || 0) + 1,
      lastViewedAt: now,
      updatedAt: now,
    };

    // Set firstViewedAt only on first view
    if (!proposal.firstViewedAt) {
      updates.firstViewedAt = now;
    }

    // Transition from published to viewed
    if (proposal.status === 'published') {
      updates.status = 'viewed';
    }

    await proposals.updateAsync(proposal.id, updates as any);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[proposals/track-view] POST error:', err);
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 });
  }
}
