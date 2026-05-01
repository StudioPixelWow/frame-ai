/**
 * GET    /api/data/campaign-actions/[id]  — Get single action
 * PUT    /api/data/campaign-actions/[id]  — Update action (approve / reject / execute)
 * DELETE /api/data/campaign-actions/[id]  — Delete action
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaignActions, ads } from '@/lib/db';
import { requireRole } from '@/lib/auth/api-guard';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const action = await campaignActions.getByIdAsync(id);
    if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    return NextResponse.json(action);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch action' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const existing = await campaignActions.getByIdAsync(id);
    if (!existing) return NextResponse.json({ error: 'Action not found' }, { status: 404 });

    const now = new Date().toISOString();

    // ── Approve ────────────────────────────────────────────────
    if (body.action === 'approve') {
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: 'Only pending actions can be approved' }, { status: 400 });
      }
      const updated = await campaignActions.updateAsync(id, {
        status: 'approved',
        approvedBy: body.approvedBy || 'admin',
        approvedAt: now,
        updatedAt: now,
      });
      return NextResponse.json(updated);
    }

    // ── Reject ─────────────────────────────────────────────────
    if (body.action === 'reject') {
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: 'Only pending actions can be rejected' }, { status: 400 });
      }
      const updated = await campaignActions.updateAsync(id, {
        status: 'rejected',
        rejectionReason: body.rejectionReason || '',
        approvedBy: body.approvedBy || 'admin',
        approvedAt: now,
        updatedAt: now,
      });
      return NextResponse.json(updated);
    }

    // ── Execute ────────────────────────────────────────────────
    if (body.action === 'execute') {
      if (existing.status !== 'approved') {
        return NextResponse.json({ error: 'Only approved actions can be executed' }, { status: 400 });
      }

      // Execute the action internally (DB only, no Meta API)
      const execResult = await executeAction(existing);
      if (execResult.error) {
        return NextResponse.json({ error: execResult.error }, { status: 500 });
      }

      const updated = await campaignActions.updateAsync(id, {
        status: 'executed',
        executedAt: now,
        updatedAt: now,
      });
      return NextResponse.json({ ...updated, executionResult: execResult });
    }

    // ── Generic update ─────────────────────────────────────────
    const updated = await campaignActions.updateAsync(id, {
      ...body,
      updatedAt: now,
    });
    return NextResponse.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const { id } = await context.params;
    const deleted = await campaignActions.deleteAsync(id);
    if (!deleted) return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete action' }, { status: 500 });
  }
}

// ── Internal execution logic ─────────────────────────────────────────
// All execution is DB-only. No Meta API calls.

interface ExecResult {
  success: boolean;
  error?: string;
  newEntityId?: string;
}

async function executeAction(action: Record<string, unknown>): Promise<ExecResult> {
  const type = action.type as string;
  const payload = (action.payload || {}) as Record<string, unknown>;

  try {
    switch (type) {
      case 'duplicate_ad': {
        const originalId = payload.originalAdId as string;
        if (!originalId) return { success: false, error: 'Missing originalAdId' };
        const original = await ads.getByIdAsync(originalId);
        if (!original) return { success: false, error: 'Original ad not found' };

        const now = new Date().toISOString();
        const newAd = await ads.createAsync({
          ...original,
          id: undefined as unknown as string, // let store generate
          name: `${original.name} (עותק)`,
          status: 'draft' as const,
          impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0,
          ctr: 0, cpl: 0, cpc: 0, roas: 0, reach: 0, frequency: 0, cpm: 0,
          metaAdId: '',
          lastSyncedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        return { success: true, newEntityId: newAd?.id };
      }

      case 'create_variation': {
        const originalId = payload.originalAdId as string;
        if (!originalId) return { success: false, error: 'Missing originalAdId' };
        const original = await ads.getByIdAsync(originalId);
        if (!original) return { success: false, error: 'Original ad not found' };

        const now = new Date().toISOString();
        const newAd = await ads.createAsync({
          ...original,
          id: undefined as unknown as string,
          name: `${original.name} (וריאציה)`,
          status: 'draft' as const,
          primaryText: (payload.newPrimaryText as string) || original.primaryText,
          headline: (payload.newHeadline as string) || original.headline,
          description: (payload.newDescription as string) || original.description,
          ctaType: (payload.newCtaType as string) || original.ctaType,
          impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0,
          ctr: 0, cpl: 0, cpc: 0, roas: 0, reach: 0, frequency: 0, cpm: 0,
          metaAdId: '',
          lastSyncedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        return { success: true, newEntityId: newAd?.id };
      }

      case 'pause_ad': {
        const adId = payload.adIdToPause as string;
        if (!adId) return { success: false, error: 'Missing adIdToPause' };
        await ads.updateAsync(adId, { status: 'paused' as const, updatedAt: new Date().toISOString() });
        return { success: true };
      }

      case 'increase_budget':
      case 'decrease_budget': {
        // Budget changes are recorded but not executed against Meta
        // The admin reviews in Meta Ads Manager
        return { success: true };
      }

      case 'test_new_audience': {
        // Audience changes are recorded but not executed
        return { success: true };
      }

      default:
        return { success: false, error: `Unknown action type: ${type}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Execution failed';
    return { success: false, error: msg };
  }
}
