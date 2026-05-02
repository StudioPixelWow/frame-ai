/**
 * GET  /api/data/growth/actions       — list growth actions (optional ?clientId, ?status)
 * POST /api/data/growth/actions       — approve / reject / execute a growth action
 *
 * POST body:
 *   { actionId, action: 'approve' | 'reject' | 'execute', reason?, approvedBy? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { growthActions, growthOpportunities } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId');
    const status = req.nextUrl.searchParams.get('status');

    let actions = await growthActions.getAllAsync() || [];

    if (clientId) actions = actions.filter(a => a.clientId === clientId);
    if (status) actions = actions.filter(a => a.approvalStatus === status || a.executionStatus === status);

    actions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(actions);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { actionId, action, reason, approvedBy } = body;

    if (!actionId || !action) {
      return NextResponse.json({ error: 'Missing actionId or action' }, { status: 400 });
    }

    const existing = await growthActions.getByIdAsync(actionId);
    if (!existing) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      await growthActions.updateAsync(actionId, {
        approvalStatus: 'approved',
        approvedBy: approvedBy || 'admin',
        approvedAt: now,
        updatedAt: now,
      });

      // Mark opportunity as acted on
      if (existing.opportunityId) {
        await growthOpportunities.updateAsync(existing.opportunityId, { status: 'acted_on' }).catch(() => {});
      }

      return NextResponse.json({ success: true, status: 'approved' });
    }

    if (action === 'reject') {
      await growthActions.updateAsync(actionId, {
        approvalStatus: 'rejected',
        rejectedBy: approvedBy || 'admin',
        rejectedAt: now,
        rejectionReason: reason || null,
        updatedAt: now,
      });

      if (existing.opportunityId) {
        await growthOpportunities.updateAsync(existing.opportunityId, { status: 'dismissed' }).catch(() => {});
      }

      return NextResponse.json({ success: true, status: 'rejected' });
    }

    if (action === 'execute') {
      if (existing.approvalStatus !== 'approved') {
        return NextResponse.json({ error: 'Action must be approved before execution' }, { status: 400 });
      }

      // Mark as executed — actual platform writes are NOT automatic
      // This records the decision; human executes the change in the platform
      await growthActions.updateAsync(actionId, {
        executionStatus: 'completed',
        executedAt: now,
        updatedAt: now,
      });

      if (existing.opportunityId) {
        await growthOpportunities.updateAsync(existing.opportunityId, { status: 'resolved' }).catch(() => {});
      }

      return NextResponse.json({ success: true, status: 'executed' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
