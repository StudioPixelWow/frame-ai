/**
 * GET /api/seo/gsc — Fetch GSC analytics data
 * POST /api/seo/gsc — Connect GSC credentials to a client
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import {
  connectGSC,
  getTopQueries,
  getTopPages,
  getIndexingStatus,
  getPositionChanges,
} from '@/lib/seo/gsc-real-service';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const type = searchParams.get('type') || 'queries'; // queries | pages | indexing | changes
    const days = parseInt(searchParams.get('days') || '28', 10);

    if (!clientId) {
      return NextResponse.json({ error: 'נדרש clientId' }, { status: 400 });
    }

    // Fetch client GSC credentials from Supabase
    const sb = getSupabase();
    const { data: client, error: clientError } = await sb
      .from('clients')
      .select('gsc_refresh_token, gsc_site_url, gsc_connection_status')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError || !client) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    if (!client.gsc_refresh_token || !client.gsc_site_url) {
      return NextResponse.json({
        error: 'GSC לא מחובר ללקוח זה',
        connectionStatus: client.gsc_connection_status || 'not_connected',
      }, { status: 400 });
    }

    const refreshToken = client.gsc_refresh_token as string;
    const siteUrl = client.gsc_site_url as string;

    let data: unknown;

    switch (type) {
      case 'queries':
        data = await getTopQueries(refreshToken, siteUrl, days);
        break;
      case 'pages':
        data = await getTopPages(refreshToken, siteUrl, days);
        break;
      case 'indexing':
        data = await getIndexingStatus(refreshToken, siteUrl);
        break;
      case 'changes':
        data = await getPositionChanges(refreshToken, siteUrl, days);
        break;
      default:
        return NextResponse.json({ error: `סוג לא תקין: ${type}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, type, days, data });
  } catch (error) {
    console.error('[GSC API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, refreshToken, siteUrl } = body;

    if (!clientId || !refreshToken || !siteUrl) {
      return NextResponse.json(
        { error: 'נדרשים clientId, refreshToken ו-siteUrl' },
        { status: 400 }
      );
    }

    // Validate connection
    const result = await connectGSC(refreshToken, siteUrl);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'חיבור GSC נכשל', connectionStatus: 'error' },
        { status: 400 }
      );
    }

    // Save to client record
    const sb = getSupabase();
    const { error: updateError } = await sb
      .from('clients')
      .update({
        gsc_refresh_token: refreshToken,
        gsc_site_url: siteUrl,
        gsc_connection_status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('[GSC API] Update client error:', updateError.message);
      return NextResponse.json(
        { error: 'שגיאה בשמירת החיבור' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'GSC חובר בהצלחה',
      connectionStatus: 'connected',
      siteUrl,
    });
  } catch (error) {
    console.error('[GSC API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בשרת' },
      { status: 500 }
    );
  }
}
