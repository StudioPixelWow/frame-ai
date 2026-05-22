/**
 * GET /api/clients/[clientId]/facebook-pages
 * Fetches available Facebook Pages the system Meta BM token has access to.
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

async function getSystemToken(): Promise<{ accessToken: string; businessId: string } | null> {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_business_token')
      .single();

    if (!error && data?.value) {
      const val = typeof data.value === 'object' ? data.value : { access_token: data.value };
      if (val.access_token) {
        return { accessToken: val.access_token, businessId: val.business_id || '' };
      }
    }

    // Fallback: app_meta_business table
    const { data: metaData, error: metaError } = await supabase
      .from('app_meta_business')
      .select('config')
      .single();

    if (!metaError && metaData?.config) {
      const cfg = metaData.config as any;
      if (cfg.access_token) {
        return { accessToken: cfg.access_token, businessId: cfg.business_id || '' };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });
    }

    const system = await getSystemToken();
    if (!system) {
      return NextResponse.json(
        { error: 'לא נמצא טוקן Meta Business — יש לחבר את Meta Business Manager בהגדרות המערכת' },
        { status: 400 },
      );
    }

    const { accessToken, businessId } = system;

    // Try fetching owned pages via business ID first, then fallback to /me/accounts
    let pages: any[] = [];

    if (businessId) {
      const bmRes = await fetch(
        `https://graph.facebook.com/v19.0/${businessId}/owned_pages?fields=id,name,access_token,picture.type(small),fan_count,category&limit=100&access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(30000) },
      );
      const bmData = await bmRes.json();

      if (bmRes.ok && bmData.data) {
        pages = bmData.data;
      }
    }

    // If no pages from BM, try /me/accounts
    if (pages.length === 0) {
      const meRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture.type(small),fan_count,category&limit=100&access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(30000) },
      );
      const meData = await meRes.json();

      if (!meRes.ok || meData.error) {
        const fbError = meData.error;
        if (fbError?.code === 190 || fbError?.error_subcode === 463) {
          return NextResponse.json({ error: 'טוקן Meta פג תוקף — יש לחדש את החיבור בהגדרות' }, { status: 401 });
        }
        return NextResponse.json({ error: fbError?.message || 'שגיאה בטעינת דפי פייסבוק' }, { status: 502 });
      }

      pages = meData.data || [];
    }

    // Map to clean response
    const result = pages.map((p: any) => ({
      id: p.id,
      name: p.name || '',
      accessToken: p.access_token || '',
      pictureUrl: p.picture?.data?.url || '',
      fanCount: p.fan_count || 0,
      category: p.category || '',
    }));

    return NextResponse.json({ pages: result, total: result.length });
  } catch (err) {
    console.error('[facebook-pages] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'שגיאה לא צפויה' },
      { status: 500 },
    );
  }
}
