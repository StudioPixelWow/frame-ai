/**
 * POST /api/data/approval-queue/[id]/action — Approve or reject an automation
 *
 * Body: { action: 'approve' | 'reject', decidedBy?: string, notes?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { approvalQueue } from '@/lib/db';
import { executeApprovedAutomation, rejectAutomation } from '@/lib/automation/engine';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { action, decidedBy, notes } = body as {
      action: 'approve' | 'reject';
      decidedBy?: string;
      notes?: string;
    };

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action — must be "approve" or "reject"' }, { status: 400 });
    }

    // Fetch the approval item
    const item = approvalQueue.getById(id);
    if (!item) {
      return NextResponse.json({ error: 'Approval item not found' }, { status: 404 });
    }

    if (item.status !== 'pending') {
      return NextResponse.json({ error: `Already ${item.status}` }, { status: 409 });
    }

    const now = new Date().toISOString();
    const userId = decidedBy || 'system';

    if (action === 'approve') {
      // Execute the automation action
      const result = await executeApprovedAutomation(item.automationRunId, userId);

      // Update the approval item
      approvalQueue.update(id, {
        status: 'approved',
        decidedBy: userId,
        decidedAt: now,
        decisionNotes: notes || null,
      });

      return NextResponse.json({
        success: true,
        action: 'approved',
        executionResult: result,
      });
    } else {
      // Reject
      await rejectAutomation(item.automationRunId, userId, notes);

      approvalQueue.update(id, {
        status: 'rejected',
        decidedBy: userId,
        decidedAt: now,
        decisionNotes: notes || null,
      });

      return NextResponse.json({
        success: true,
        action: 'rejected',
      });
    }
  } catch (error) {
    console.error('[ApprovalAction] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process approval action' },
      { status: 500 }
    );
  }
}
