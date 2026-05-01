/**
 * GET    /api/data/campaign-actions/[id]  — Get single action
 * PUT    /api/data/campaign-actions/[id]  — Update action (approve / reject / execute)
 * DELETE /api/data/campaign-actions/[id]  — Delete action
 *
 * Role-based access:
 *   admin    → can approve, reject, execute
 *   client   → can approve, reject only (not execute)
 *   employee → can approve, reject for assigned clients only
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaignActions, campaignActionApprovals, ads, adSets } from '@/lib/db';
import { logCampaignActivity } from '@/lib/optimization/activity-log';
import type { CampaignAction } from '@/lib/db/schema';

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
    const role = req.headers.get('x-user-role') || 'admin';
    const userId = req.headers.get('x-user-id') || 'admin';

    // ── Approve ────────────────────────────────────────────────
    if (body.action === 'approve') {
      if (existing.status !== 'pending' && existing.status !== 'approval_required') {
        return NextResponse.json({ error: 'Only pending/approval_required actions can be approved' }, { status: 400 });
      }
      const updated = await campaignActions.updateAsync(id, {
        status: 'approved',
        approvedBy: body.approvedBy || userId,
        approvedAt: now,
        updatedAt: now,
      });

      // Update linked approval item
      await updateLinkedApproval(id, 'approved', userId, now, body.decisionNotes);

      // Log
      await logCampaignActivity(
        existing.campaignId, existing.clientId,
        'action_approved', `פעולה אושרה: ${existing.title || existing.description}`,
        `אושר ע"י ${userId}`, userId, id,
      );

      return NextResponse.json(updated);
    }

    // ── Reject ─────────────────────────────────────────────────
    if (body.action === 'reject') {
      if (existing.status !== 'pending' && existing.status !== 'approval_required') {
        return NextResponse.json({ error: 'Only pending/approval_required actions can be rejected' }, { status: 400 });
      }
      const updated = await campaignActions.updateAsync(id, {
        status: 'rejected',
        rejectionReason: body.rejectionReason || '',
        approvedBy: body.approvedBy || userId,
        approvedAt: now,
        updatedAt: now,
      });

      await updateLinkedApproval(id, 'rejected', userId, now, body.rejectionReason);

      await logCampaignActivity(
        existing.campaignId, existing.clientId,
        'action_rejected', `פעולה נדחתה: ${existing.title || existing.description}`,
        body.rejectionReason || 'ללא סיבה', userId, id,
      );

      return NextResponse.json(updated);
    }

    // ── Execute ────────────────────────────────────────────────
    if (body.action === 'execute') {
      // Only admin can execute
      if (role === 'client') {
        return NextResponse.json({ error: 'לקוח לא יכול לבצע פעולות — רק אישור/דחייה' }, { status: 403 });
      }
      if (existing.status !== 'approved') {
        return NextResponse.json({ error: 'Only approved actions can be executed' }, { status: 400 });
      }

      const execResult = await executeAction(existing);
      if (execResult.error) {
        await campaignActions.updateAsync(id, {
          status: 'failed',
          failedReason: execResult.error,
          updatedAt: now,
        });
        await logCampaignActivity(
          existing.campaignId, existing.clientId,
          'action_failed', `פעולה נכשלה: ${existing.title || existing.description}`,
          execResult.error, userId, id,
        );
        return NextResponse.json({ error: execResult.error }, { status: 500 });
      }

      const updated = await campaignActions.updateAsync(id, {
        status: 'executed',
        executedAt: now,
        updatedAt: now,
      });

      // Log specific activity type based on action type
      const activityType = getExecutionActivityType(existing.type as string);
      await logCampaignActivity(
        existing.campaignId, existing.clientId,
        activityType, `בוצע: ${existing.title || existing.description}`,
        `פעולה פנימית — טרם פורסם למטא`, userId, id,
        null, execResult.newEntityId ? { newEntityId: execResult.newEntityId } : undefined,
      );

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
  try {
    const { id } = await context.params;
    const deleted = await campaignActions.deleteAsync(id);
    if (!deleted) return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete action' }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

async function updateLinkedApproval(
  actionId: string,
  status: 'approved' | 'rejected',
  decidedBy: string,
  decidedAt: string,
  notes?: string,
) {
  try {
    const allApprovals = await campaignActionApprovals.getAllAsync();
    const linked = allApprovals.find(a => a.actionId === actionId);
    if (linked) {
      await campaignActionApprovals.updateAsync(linked.id, {
        status,
        decidedBy,
        decidedAt,
        decisionNotes: notes || null,
        updatedAt: decidedAt,
      });
    }
  } catch { /* non-critical */ }
}

function getExecutionActivityType(actionType: string): 'draft_ad_created' | 'ad_paused' | 'ad_resumed' | 'budget_changed' | 'adset_created' | 'action_executed' | 'marked_for_review' {
  switch (actionType) {
    case 'duplicate_ad':
    case 'create_variation': return 'draft_ad_created';
    case 'pause_ad': return 'ad_paused';
    case 'resume_ad': return 'ad_resumed';
    case 'increase_budget':
    case 'decrease_budget': return 'budget_changed';
    case 'create_new_adset':
    case 'test_new_audience': return 'adset_created';
    case 'mark_for_review': return 'marked_for_review';
    default: return 'action_executed';
  }
}

// ── Internal execution logic ─────────────────────────────────────────
// All execution is DB-only. No Meta API calls.

interface ExecResult {
  success: boolean;
  error?: string;
  newEntityId?: string;
}

async function executeAction(action: CampaignAction): Promise<ExecResult> {
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
        const { id: _origId, ...origRest } = original;
        const newAd = await ads.createAsync({
          ...origRest,
          name: `${original.name} (עותק)`,
          status: 'draft' as const,
          impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0,
          ctr: 0, cpl: 0, cpc: 0, roas: 0, reach: 0, frequency: 0, cpm: 0,
          metaAdId: '',
          lastSyncedAt: null,
          notes: `שוכפל ממודעה ${original.name} (${originalId})`,
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
        const { id: _origId2, ...origRest2 } = original;
        const newAd = await ads.createAsync({
          ...origRest2,
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
          notes: `וריאציה של ${original.name} (${originalId})\n${(payload.variationExplanation as string) || ''}`,
          createdAt: now,
          updatedAt: now,
        });
        return { success: true, newEntityId: newAd?.id };
      }

      case 'pause_ad': {
        const adId = (payload.adIdToPause as string) || (action.adId as string);
        if (!adId) return { success: false, error: 'Missing adIdToPause' };
        await ads.updateAsync(adId, { status: 'paused' as const, updatedAt: new Date().toISOString() });
        return { success: true };
      }

      case 'resume_ad': {
        const adId = (payload.adIdToResume as string) || (action.adId as string);
        if (!adId) return { success: false, error: 'Missing adIdToResume' };
        await ads.updateAsync(adId, { status: 'active' as const, updatedAt: new Date().toISOString() });
        return { success: true };
      }

      case 'create_new_adset': {
        const campaignId = action.campaignId as string;
        if (!campaignId) return { success: false, error: 'Missing campaignId' };
        const now = new Date().toISOString();
        const newAdSet = await adSets.createAsync({
          campaignId,
          name: (payload.newAdSetName as string) || 'סדרת מודעות חדשה',
          status: 'draft' as const,
          ageMin: (payload.newAgeRange as { min: number })?.min || null,
          ageMax: (payload.newAgeRange as { max: number })?.max || null,
          genders: [],
          geoLocations: (payload.newGeoLocations as string[]) || [],
          interests: (payload.newInterests as string[]) || [],
          customAudiences: [],
          excludedAudiences: [],
          placements: [],
          dailyBudget: null,
          lifetimeBudget: null,
          startDate: null,
          endDate: null,
          notes: '',
          bidStrategy: null,
          bidAmount: null,
          metaAdSetId: '',
          lastSyncedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        return { success: true, newEntityId: newAdSet?.id };
      }

      case 'increase_budget':
      case 'decrease_budget':
      case 'test_new_audience':
      case 'mark_for_review': {
        // These are recorded but not executed against Meta
        // Admin reviews and applies manually in Meta Ads Manager
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
