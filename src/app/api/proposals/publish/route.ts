/**
 * POST /api/proposals/publish - Publish a proposal
 * Body: { proposalId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposals, leads } from '@/lib/db/collections';

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

    /* ── Auto-create lead for new clients ───────────────────── */
    const isNewClient = !existing.clientId || existing.clientId === '__new__';
    if (isNewClient) {
      try {
        const leadName = existing.clientContactPerson || existing.clientBusinessName || existing.clientName || 'ליד מהצעת מחיר';
        await leads.createAsync({
          fullName: leadName,
          name: leadName,
          company: existing.clientBusinessName || '',
          email: existing.clientEmail || '',
          phone: existing.clientPhone || '',
          source: 'proposal',
          interestType: 'other',
          status: 'proposal_sent',
          proposalSent: true,
          proposalAmount: existing.price || 0,
          value: existing.price || 0,
          followupDone: false,
          notes: `נוצר אוטומטית מהצעת מחיר: ${existing.title}`,
          assigneeId: null,
          followUpAt: null,
          convertedAt: null,
          convertedClientId: null,
          convertedEntityType: null,
          convertedEntityId: null,
          campaignId: null,
          campaignName: '',
          adAccountId: '',
          adSetId: null,
          adId: null,
        } as any);
        console.log('[proposals/publish] Auto-created lead for new client:', leadName);
      } catch (leadErr) {
        console.error('[proposals/publish] Failed to auto-create lead (non-blocking):', leadErr);
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[proposals/publish] POST error:', err);
    return NextResponse.json({ error: 'Failed to publish proposal' }, { status: 500 });
  }
}
