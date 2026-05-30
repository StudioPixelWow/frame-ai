/**
 * POST /api/clients/[clientId]/facebook-pages/connect
 * Connects a Facebook Page to a client (saves page ID, name, access token).
 * Also supports DELETE method to disconnect.
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

// camelCase to snake_case helper
function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
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
    const { pageId, pageName, pageAccessToken, pictureUrl } = body;

    if (!pageId || !pageAccessToken) {
      return NextResponse.json({ error: 'חסרים פרטי דף פייסבוק (pageId, pageAccessToken)' }, { status: 400 });
    }

    // Validate the page token AND discover a linked Instagram business account.
    const testRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(pageAccessToken)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const testData = await testRes.json();

    if (!testRes.ok || testData.error) {
      return NextResponse.json(
        { error: testData.error?.message || 'טוקן הדף אינו תקין' },
        { status: 400 },
      );
    }

    const igAccount = testData.instagram_business_account;

    // Save page details to DEDICATED columns (do NOT overwrite the ad-account token).
    const supabase = getSupabase();
    const updateData: Record<string, any> = {
      fb_page_id: pageId,
      fb_page_name: pageName || testData.name || '',
      fb_page_access_token: pageAccessToken,
      fb_page_picture: pictureUrl || '',
      ig_user_id: igAccount?.id || null,
      ig_username: igAccount?.username || null,
      social_connected_at: new Date().toISOString(),
      // Keep legacy fields populated for older readers (page id only, not token).
      facebook_page_id: pageId,
      facebook_page_name: pageName || testData.name || '',
      meta_page_id: pageId,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId);

    if (updateError) {
      console.error('[facebook-pages/connect] Update error:', updateError);
      return NextResponse.json({ error: 'שגיאה בשמירת הדף ללקוח' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      pageId,
      pageName: pageName || testData.name || '',
      pictureUrl: pictureUrl || '',
      instagram: igAccount ? { id: igAccount.id, username: igAccount.username } : null,
    });
  } catch (err) {
    console.error('[facebook-pages/connect] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'שגיאה לא צפויה' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/clients/[clientId]/facebook-pages/connect
 * Disconnects the Facebook Page from this client.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        fb_page_id: null,
        fb_page_name: null,
        fb_page_access_token: null,
        fb_page_picture: null,
        ig_user_id: null,
        ig_username: null,
        facebook_page_id: '',
        facebook_page_name: '',
        meta_page_id: '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('[facebook-pages/connect] DELETE error:', updateError);
      return NextResponse.json({ error: 'שגיאה בניתוק הדף' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[facebook-pages/connect] DELETE error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'שגיאה לא צפויה' },
      { status: 500 },
    );
  }
}
