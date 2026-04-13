/**
 * GET /api/data/clients - Get all clients
 * POST /api/data/clients - Create a new client
 */

import { NextRequest, NextResponse } from 'next/server';
import { clients } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  try {
    ensureSeeded();
    return NextResponse.json(clients.getAll());
  } catch (error) {
    console.error('[API] GET /api/data/clients error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();
    const body = await req.json();

    // Provide sensible defaults for required Client fields
    const now = new Date().toISOString();
    const clientData = {
      name: body.name || '',
      company: body.company || '',
      contactPerson: body.contactPerson || '',
      email: body.email || '',
      phone: body.phone || '',
      logoUrl: body.logoUrl || '',
      color: body.color || '#00B5FE',
      clientType: body.clientType || 'marketing',
      businessField: body.businessField || '',
      marketingGoals: body.marketingGoals || '',
      keyMarketingMessages: body.keyMarketingMessages || '',
      assignedManagerId: body.assignedManagerId || null,
      websiteUrl: body.websiteUrl || '',
      facebookPageUrl: body.facebookPageUrl || '',
      instagramProfileUrl: body.instagramProfileUrl || '',
      tiktokProfileUrl: body.tiktokProfileUrl || '',
      retainerAmount: body.retainerAmount ?? 0,
      retainerDay: body.retainerDay ?? 1,
      paymentStatus: body.paymentStatus || 'none',
      nextPaymentDate: body.nextPaymentDate || null,
      status: body.status || 'active',
      notes: body.notes || '',
      convertedFromLead: body.convertedFromLead || null,
      createdAt: now,
      updatedAt: now,
      portalEnabled: body.portalEnabled ?? false,
      portalUserId: body.portalUserId || null,
      lastPortalLoginAt: null,
      facebookPageId: body.facebookPageId || '',
      facebookPageName: body.facebookPageName || '',
      instagramAccountId: body.instagramAccountId || '',
      instagramUsername: body.instagramUsername || '',
      tiktokAccountId: body.tiktokAccountId || '',
      tiktokUsername: body.tiktokUsername || '',
      monthlyGanttStatus: body.monthlyGanttStatus || 'none',
      annualGanttStatus: body.annualGanttStatus || 'none',
    };

    const created = clients.create(clientData);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/data/clients error:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 400 }
    );
  }
}
