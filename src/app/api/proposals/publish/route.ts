/**
 * POST /api/proposals/publish - Publish a proposal
 * Body: { proposalId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposals } from '@/lib/db/collections';

export async function POST(req: NextRequest) {
  try {
    const { proposalId } = await req.json();
    if (!proposalId) {
      return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 });
    }

    const existing = await proposals.getByIdAsync(proposalId);
    if (!existing) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updated = await proposals.updateAsync(proposalId, {
      status: 'published',
      publishedAt: now,
      updatedAt: now,
    } as any);

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[proposals/publish] POST error:', err);
    return NextResponse.json({ error: 'Failed to publish proposal' }, { status: 500 });
  }
}
