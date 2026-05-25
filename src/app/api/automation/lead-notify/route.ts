/**
 * POST /api/automation/lead-notify
 * Accepts { leadId, clientId } — loads lead data and sends WhatsApp notification to the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { leads } from '@/lib/db';
import { getClientById } from '@/lib/db/client-helpers';
import { notifyClientOnNewLead } from '@/lib/automation/lead-notification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, clientId } = body;

    if (!leadId || !clientId) {
      return NextResponse.json(
        { error: 'חסרים שדות: leadId, clientId' },
        { status: 400 }
      );
    }

    // Load lead data
    const lead = await leads.getByIdAsync(leadId);
    if (!lead) {
      return NextResponse.json(
        { error: `ליד לא נמצא: ${leadId}` },
        { status: 404 }
      );
    }

    // Load client to get name
    const client = await getClientById(clientId);
    if (!client) {
      return NextResponse.json(
        { error: `לקוח לא נמצא: ${clientId}` },
        { status: 404 }
      );
    }

    const result = await notifyClientOnNewLead({
      name: lead.fullName || lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || '',
      clientId,
      clientName: client.name || '',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'הודעה נשלחה בהצלחה' });
  } catch (err) {
    console.error('[lead-notify] Error:', err);
    return NextResponse.json(
      { error: 'שגיאה בשליחת הודעה' },
      { status: 500 }
    );
  }
}
