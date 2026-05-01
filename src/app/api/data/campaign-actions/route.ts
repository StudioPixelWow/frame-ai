/**
 * GET  /api/data/campaign-actions        — List all actions (optional ?clientId=xxx&status=pending)
 * POST /api/data/campaign-actions        — Create a new action
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaignActions } from '@/lib/db';
import { requireRole } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const all = await campaignActions.getAllAsync();
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId');
    const status = url.searchParams.get('status');
    const campaignId = url.searchParams.get('campaignId');

    let filtered = all;
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
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

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
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
