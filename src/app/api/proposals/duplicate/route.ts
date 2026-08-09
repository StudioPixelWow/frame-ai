/**
 * POST /api/proposals/duplicate - Duplicate a proposal
 * Body: { proposalId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposals } from '@/lib/db/collections';
import type { Proposal } from '@/lib/db/schema';

export async function POST(req: NextRequest) {
  try {
    const { proposalId } = await req.json();
    if (!proposalId) {
      return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 });
    }

    const existing = await proposals.getByIdAsync(proposalId) as Proposal | null;
    if (!existing) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { id, ...rest } = existing;

    const duplicate = await proposals.createAsync({
      ...rest,
      title: `${existing.title} (עותק)`,
      publicToken: crypto.randomUUID(),
      status: 'draft',
      viewCount: 0,
      approval: null,
      approvedSnapshot: null,
      publishedAt: null,
      firstViewedAt: null,
      lastViewedAt: null,
      createdAt: now,
      updatedAt: now,
    } as any);

    return NextResponse.json(duplicate, { status: 201 });
  } catch (err) {
    console.error('[proposals/duplicate] POST error:', err);
    return NextResponse.json({ error: 'Failed to duplicate proposal' }, { status: 500 });
  }
}
