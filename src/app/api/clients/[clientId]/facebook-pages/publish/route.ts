/**
 * POST /api/clients/[clientId]/facebook-pages/publish
 * Publishes content (text + optional image/video URL) to the connected Facebook Page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });
    }

    const body = await request.json();
    const { message, mediaUrl, mediaType } = body;

    if (!message && !mediaUrl) {
      return NextResponse.json({ error: 'יש להזין טקסט או קישור למדיה' }, { status: 400 });
    }

    // Get client's page info
    const supabase = getSupabase();
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, facebook_page_id, facebook_page_name, meta_page_id, meta_access_token, meta_connection_status')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    const pageId = client.facebook_page_id || client.meta_page_id;
    const pageAccessToken = client.meta_access_token;

    if (!pageId || !pageAccessToken) {
      return NextResponse.json({ error: 'לא מחובר דף פייסבוק — יש לחבר דף תחילה' }, { status: 400 });
    }

    let postResult: any;

    // Determine if we're posting a photo, video, or text-only
    if (mediaUrl && mediaType === 'video') {
      // Video post
      const videoRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/videos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_url: mediaUrl,
            description: message || '',
            access_token: pageAccessToken,
          }),
          signal: AbortSignal.timeout(60000),
        },
      );
      postResult = await videoRes.json();

      if (!videoRes.ok || postResult.error) {
        const fbError = postResult.error;
        if (fbError?.code === 190 || fbError?.error_subcode === 463) {
          return NextResponse.json({ error: 'טוקן הדף פג תוקף — יש לחבר מחדש' }, { status: 401 });
        }
        return NextResponse.json({ error: fbError?.message || 'שגיאה בפרסום הסרטון' }, { status: 502 });
      }
    } else if (mediaUrl) {
      // Photo post
      const photoRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/photos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: mediaUrl,
            message: message || '',
            access_token: pageAccessToken,
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      postResult = await photoRes.json();

      if (!photoRes.ok || postResult.error) {
        const fbError = postResult.error;
        if (fbError?.code === 190 || fbError?.error_subcode === 463) {
          return NextResponse.json({ error: 'טוקן הדף פג תוקף — יש לחבר מחדש' }, { status: 401 });
        }
        return NextResponse.json({ error: fbError?.message || 'שגיאה בפרסום התמונה' }, { status: 502 });
      }
    } else {
      // Text-only post
      const feedRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            access_token: pageAccessToken,
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      postResult = await feedRes.json();

      if (!feedRes.ok || postResult.error) {
        const fbError = postResult.error;
        if (fbError?.code === 190 || fbError?.error_subcode === 463) {
          return NextResponse.json({ error: 'טוקן הדף פג תוקף — יש לחבר מחדש' }, { status: 401 });
        }
        return NextResponse.json({ error: fbError?.message || 'שגיאה בפרסום הפוסט' }, { status: 502 });
      }
    }

    return NextResponse.json({
      success: true,
      postId: postResult.id || postResult.post_id || '',
      pageName: client.facebook_page_name || '',
    });
  } catch (err) {
    console.error('[facebook-pages/publish] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'שגיאה לא צפויה' },
      { status: 500 },
    );
  }
}
