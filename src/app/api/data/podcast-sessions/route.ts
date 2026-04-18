import { NextRequest, NextResponse } from 'next/server';
import { podcastSessions } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { getSupabase } from '@/lib/db/store';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await podcastSessions.getAllAsync());
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const now = new Date().toISOString();

    // Validate required fields
    if (!body.clientName || !body.sessionDate || !body.startTime) {
      return NextResponse.json(
        { error: 'חסרים שדות חובה: שם לקוח, תאריך, שעת התחלה' },
        { status: 400 }
      );
    }

    // Provide defaults for all optional fields the schema requires
    const sessionData = {
      clientId: body.clientId || '',
      clientName: body.clientName,
      packageType: body.packageType || 'recording_only',
      price: body.price ?? 0,
      sessionDate: body.sessionDate,
      startTime: body.startTime,
      endTime: body.endTime || '',
      sessionStatus: body.sessionStatus || 'booked',
      contentStatus: body.contentStatus || 'pending_upload',
      agreementPdfUrl: body.agreementPdfUrl || '',
      agreementSent: body.agreementSent ?? false,
      videosCount: body.videosCount ?? (body.packageType === 'recording_3_videos' ? 3 : body.packageType === 'recording_5_videos' ? 5 : body.packageType === 'recording_10_videos' ? 10 : 0),
      draftUrls: body.draftUrls || [],
      finalUrls: body.finalUrls || [],
      paymentStatus: body.paymentStatus || 'pending',
      paidAt: body.paidAt ?? null,
      notes: body.notes || '',
      createdAt: body.createdAt || now,
      updatedAt: body.updatedAt || now,
    };

    console.log('[Podcast] Creating session:', {
      client: sessionData.clientName,
      date: sessionData.sessionDate,
      time: `${sessionData.startTime}-${sessionData.endTime}`,
      package: sessionData.packageType,
      price: sessionData.price,
    });

    const created = await podcastSessions.createAsync(sessionData);

    console.log('[Podcast] Session created:', created.id);

    // ── Sync to accounting: create a project-payment record ──
    if (sessionData.price > 0) {
      try {
        const sb = getSupabase();
        const paymentRow: Record<string, unknown> = {
          client_id: sessionData.clientId || '',
          title: `הקלטת פודקאסט — ${sessionData.clientName}`,
          description: `חבילה: ${sessionData.packageType}, תאריך: ${sessionData.sessionDate}`,
          amount: sessionData.price,
          due_date: sessionData.sessionDate,
          status: sessionData.paymentStatus || 'pending',
          payment_type: 'custom',
          is_due: true,
          is_paid: sessionData.paymentStatus === 'paid',
          paid_at: sessionData.paymentStatus === 'paid' ? now : null,
          created_at: now,
          updated_at: now,
        };
        const { error: payErr } = await sb.from('business_project_payments').insert(paymentRow);
        if (payErr) {
          console.warn('[Podcast] Accounting sync failed:', payErr.message);
        } else {
          console.log('[Podcast] Accounting payment created for session:', created.id);
        }
      } catch (accErr) {
        console.warn('[Podcast] Accounting sync error (non-critical):', accErr);
      }
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Podcast] Create failed:', errMsg);
    return NextResponse.json({ error: `שגיאה ביצירת הקלטה: ${errMsg}` }, { status: 400 });
  }
}
