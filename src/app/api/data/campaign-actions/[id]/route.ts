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
import { campaignActions, campaignActionApprovals, ads, adSets, campaigns } from '@/lib/db';
import { logCampaignActivity } from '@/lib/optimization/activity-log';
import type { CampaignAction } from '@/lib/db/schema';
import { getSupabase } from '@/lib/db/store';
import {
  createMetaAd, pauseMetaAd, resumeMetaAd,
  mapCtaToMeta,
  type MetaCredentials, type MetaWriteResult,
} from '@/lib/meta-ads/write-service';

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
      // Only admin can execute — employee cannot write to Meta either
      if (role === 'client' || role === 'employee') {
        return NextResponse.json({ error: role === 'client' ? 'לקוח לא יכול לבצע פעולות — רק אישור/דחייה' : 'עובד לא יכול לבצע פעולות מול מטא — רק מנהל' }, { status: 403 });
      }
      if (existing.status !== 'approved') {
        return NextResponse.json({ error: 'Only approved actions can be executed' }, { status: 400 });
      }

      // Step 1: Local DB execution
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

      // Step 2: Meta API write (if publishToMeta flag is set and credentials exist)
      let metaResult: MetaWriteResult | null = null;
      const publishToMeta = body.publishToMeta === true;

      if (publishToMeta) {
        const creds = await getClientMetaCreds(existing.clientId);
        if (!creds) {
          console.warn(`[execute] No Meta credentials for client ${existing.clientId} — skipping Meta write`);
        } else {
          metaResult = await executeMetaAction(existing, creds, execResult.newEntityId);
          if (metaResult && !metaResult.success) {
            // Meta failed but local succeeded — mark as executed with warning
            console.error(`[execute] Meta write failed:`, metaResult.error);
            await logCampaignActivity(
              existing.campaignId, existing.clientId,
              'action_failed', `פרסום למטא נכשל: ${existing.title || existing.description}`,
              metaResult.error || 'Unknown Meta error', userId, id,
            );
          } else if (metaResult?.success && metaResult.metaId) {
            // Save the Meta ID back to the local entity
            await saveMetaId(existing, execResult.newEntityId, metaResult.metaId);
          }
        }
      }

      const updated = await campaignActions.updateAsync(id, {
        status: 'executed',
        executedAt: now,
        updatedAt: now,
      });

      // Log specific activity type based on action type
      const activityType = getExecutionActivityType(existing.type as string);
      const logDesc = metaResult?.success
        ? `בוצע ופורסם למטא (${metaResult.metaId})`
        : publishToMeta && metaResult && !metaResult.success
          ? `בוצע מקומית — פרסום למטא נכשל: ${metaResult.error}`
          : `פעולה פנימית — טרם פורסם למטא`;
      await logCampaignActivity(
        existing.campaignId, existing.clientId,
        activityType, `בוצע: ${existing.title || existing.description}`,
        logDesc, userId, id,
        null, {
          ...(execResult.newEntityId ? { newEntityId: execResult.newEntityId } : {}),
          ...(metaResult ? { metaResult: { success: metaResult.success, metaId: metaResult.metaId, error: metaResult.error } } : {}),
        },
      );

      return NextResponse.json({ ...updated, executionResult: execResult, metaResult });
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

// ── Meta Write Integration Helpers ───────────────────────────────────

async function getClientMetaCreds(clientId: string): Promise<MetaCredentials | null> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('clients')
      .select('meta_ad_account_id, meta_access_token, meta_page_id')
      .eq('id', clientId)
      .maybeSingle();

    if (!data) return null;
    const adAccountId = (data as Record<string, unknown>).meta_ad_account_id as string;
    const accessToken = (data as Record<string, unknown>).meta_access_token as string;
    if (!adAccountId || !accessToken) return null;

    return { adAccountId, accessToken };
  } catch {
    return null;
  }
}

async function getClientMetaPageId(clientId: string): Promise<string | null> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('clients')
      .select('meta_page_id')
      .eq('id', clientId)
      .maybeSingle();
    return (data as Record<string, unknown>)?.meta_page_id as string || null;
  } catch {
    return null;
  }
}

async function executeMetaAction(
  action: CampaignAction,
  creds: MetaCredentials,
  newLocalEntityId?: string,
): Promise<MetaWriteResult> {
  const type = action.type;
  const payload = action.payload || {};

  try {
    switch (type) {
      case 'duplicate_ad':
      case 'create_variation': {
        // Get the newly created local ad
        const localAdId = newLocalEntityId;
        if (!localAdId) return { success: false, error: 'No local ad created to publish' };
        const localAd = await ads.getByIdAsync(localAdId);
        if (!localAd) return { success: false, error: 'Local ad not found' };

        // Need the adset's Meta ID
        const localAdSet = await adSets.getByIdAsync(localAd.adSetId);
        if (!localAdSet?.metaAdSetId) return { success: false, error: 'Parent ad set has no Meta ID — publish the ad set first' };

        // Need the Page ID
        const pageId = await getClientMetaPageId(action.clientId);
        if (!pageId) return { success: false, error: 'Missing Meta Page ID — configure in client integrations' };

        return createMetaAd(creds, {
          adSetId: localAdSet.metaAdSetId,
          name: localAd.name,
          status: 'PAUSED',
          creative: {
            pageId,
            message: localAd.primaryText,
            headline: localAd.headline,
            description: localAd.description,
            linkUrl: localAd.ctaLink,
            imageUrl: localAd.mediaUrl || undefined,
            callToAction: mapCtaToMeta(localAd.ctaType),
          },
        });
      }

      case 'pause_ad': {
        const adId = (payload.adIdToPause as string) || action.adId;
        if (!adId) return { success: false, error: 'Missing ad ID' };
        const ad = await ads.getByIdAsync(adId);
        if (!ad?.metaAdId) return { success: false, error: 'Ad has no Meta ID — not yet published' };
        return pauseMetaAd(creds, ad.metaAdId);
      }

      case 'resume_ad': {
        const adId = (payload.adIdToResume as string) || action.adId;
        if (!adId) return { success: false, error: 'Missing ad ID' };
        const ad = await ads.getByIdAsync(adId);
        if (!ad?.metaAdId) return { success: false, error: 'Ad has no Meta ID — not yet published' };
        return resumeMetaAd(creds, ad.metaAdId);
      }

      case 'increase_budget':
      case 'decrease_budget':
      case 'test_new_audience':
      case 'create_new_adset':
      case 'mark_for_review':
        // These require manual Meta management or extended implementation
        return { success: true, metaId: undefined };

      default:
        return { success: false, error: `Meta write not supported for action type: ${type}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Meta execution failed';
    return { success: false, error: msg };
  }
}

async function saveMetaId(
  action: CampaignAction,
  localEntityId: string | undefined,
  metaId: string,
): Promise<void> {
  try {
    const type = action.type;
    const now = new Date().toISOString();

    if ((type === 'duplicate_ad' || type === 'create_variation') && localEntityId) {
      await ads.updateAsync(localEntityId, {
        metaAdId: metaId,
        status: 'active',
        lastSyncedAt: now,
        updatedAt: now,
      });
    } else if (type === 'pause_ad' || type === 'resume_ad') {
      // Status already updated locally — just update lastSyncedAt
      const adId = (action.payload?.adIdToPause as string) || (action.payload?.adIdToResume as string) || action.adId;
      if (adId) {
        await ads.updateAsync(adId, { lastSyncedAt: now, updatedAt: now });
      }
    }
  } catch (err) {
    console.error('[saveMetaId] Failed:', err);
  }
}
