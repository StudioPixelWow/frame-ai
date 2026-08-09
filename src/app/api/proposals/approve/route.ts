/**
 * POST /api/proposals/approve - Approve a proposal via public token
 * Body: { publicToken, approval: ProposalApprovalData }
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposals } from '@/lib/db/collections';
import type { Proposal } from '@/lib/db/schema';

export async function POST(req: NextRequest) {
  try {
    const { publicToken, approval } = await req.json();
    if (!publicToken || !approval) {
      return NextResponse.json({ error: 'Missing publicToken or approval data' }, { status: 400 });
    }

    // Find proposal by publicToken
    const all = await proposals.getAllAsync();
    const proposal = (all as Proposal[]).find((p) => p.publicToken === publicToken);
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Create a deep copy snapshot of the proposal at approval time
    const approvedSnapshot = JSON.parse(JSON.stringify(proposal));

    const now = new Date().toISOString();
    await proposals.updateAsync(proposal.id, {
      status: 'approved',
      approval,
      approvedSnapshot,
      updatedAt: now,
    } as any);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[proposals/approve] POST error:', err);
    return NextResponse.json({ error: 'Failed to approve proposal' }, { status: 500 });
  }
}
