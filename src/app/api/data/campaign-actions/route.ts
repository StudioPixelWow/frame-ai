/**
 * GET  /api/data/campaign-actions        — List actions (optional ?clientId, ?status, ?campaignId)
 * POST /api/data/campaign-actions        — Create a new action
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaignActions, campaignActionApprovals } from '@/lib/db';
import { requireRole } from '@/lib/auth/api-guard';
import { logCampaignActivity } from '@/lib/optimization/activity-log';

export async function GET(req: NextRequest) {
  // Both admin and client can view — client sees only their own
  try {
    const all = await campaignActions.getAllAsync();
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId');
    const status = url.searchParams.get('status');
    const campaignId = url.searchParams.get('campaignId');

    // Role-based filtering
    const role = req.headers.get('x-user-role') || 'admin';
    const userClientId = req.headers.get('x-client-id') || '';

    let filtered = all;

    // Client can only see their own actions
    if (role === 'client' && userClientId) {
      filtered = filtered.filter(a => a.clientId === userClientId);
    }

    if (clientId) filtered = filtered.filter(a => a.clientId === clientId);
    if (status) filtered = filtered.filter(a => a.status === status);
    if (campaignId) filtered = filtered.filter(a => a.campaignId === campaignId);

    // Sort by createdAt descending
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ actions: filtered, total: filtered.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Admin and employee can create actions
  try {
    const body = await req.json();
    const now = new Date().toISOString();

    const action = {
      ...body,
      status: body.status || 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const created = await campaignActions.createAsync(action);

    // Auto-create approval item if status is approval_required
    if (action.status === 'approval_required' || action.status === 'pending') {
      try {
        await campaignActionApprovals.createAsync({
          actionId: created?.id || action.id,
          clientId: action.clientId,
          campaignId: action.campaignId,
          title: action.title || action.description,
          description: action.description,
          previewBefore: action.previewBefore || '',
          previewAfter: action.previewAfter || '',
          affectedObjectType: action.objectType || 'ad',
          affectedObjectId: action.objectId || '',
          status: 'pending',
          decidedBy: null,
          decidedAt: null,
          decisionNotes: null,
          createdAt: now,
          updatedAt: now,
        });
      } catch { /* non-critical */ }
    }

    // Log activity
    await logCampaignActivity(
      action.campaignId,
      action.clientId,
      'action_generated',
      `פעולה חדשה: ${action.title || action.description}`,
      action.description,
      action.createdBy || 'system',
      created?.id || action.id,
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
