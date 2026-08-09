/**
 * POST /api/clients/[clientId]/facebook-pages/publish
 *   Publish (or schedule) a post/story to Facebook and/or the linked Instagram.
 *   Body: { kind?: 'post'|'story', message?, mediaUrl?, mediaType?, targets?:{facebook,instagram}, scheduledAt? }
 *   scheduledAt (ISO, future) → queued; otherwise published immediately.
 *
 * GET — list this client's scheduled/published posts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publishSocial } from '@/lib/meta-ads/social-publish';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  );
}

function genId() {
  return `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = (await params).id;
    if (!clientId) return NextResponse.json({ error: 'חסר מזהה לקוח' }, { status: 400 });

    const body = await request.json();
    const { kind = 'post', message, mediaUrl, mediaType, scheduledAt } = body;
    const targets = body.targets || { facebook: true, instagram: false };

    if (!message && !mediaUrl) return NextResponse.json({ error: 'יש להזין טקסט או מדיה' }, { status: 400 });
    if (kind === 'story' && !mediaUrl) return NextResponse.json({ error: 'סטורי דורש מדיה' }, { status: 400 });
    if (targets.instagram && !mediaUrl) return NextResponse.json({ error: 'אינסטגרם דורש מדיה' }, { status: 400 });

    const sb = getSupabase();
    const { data: client } = await sb
      .from('clients')
      .select('id, name, fb_page_id, fb_page_access_token, ig_user_id')
      .eq('id', clientId).single();
    if (!client) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });

    const c = client as any;
    if (!c.fb_page_id || !c.fb_page_access_token) {
      return NextResponse.json({ error: 'לא מחובר דף פייסבוק — חבר דף תחילה' }, { status: 400 });
    }
    if (targets.instagram && !c.ig_user_id) {
      return NextResponse.json({ error: 'אין חשבון אינסטגרם מקושר לדף הזה' }, { status: 400 });
    }

    // ── Schedule for later ──
    const when = scheduledAt ? new Date(scheduledAt) : null;
    if (when && when.getTime() > Date.now() + 60_000) {
      const id = genId();
      const { error } = await sb.from('app_social_posts').insert({
        id, client_id: clientId, client_name: c.name || '', kind, message: message || '',
        media_url: mediaUrl || '', media_type: mediaType || null, targets,
        scheduled_at: when.toISOString(), status: 'scheduled', created_at: new Date().toISOString(),
      });
      if (error) return NextResponse.json({ error: `שמירת התזמון נכשלה: ${error.message}` }, { status: 500 });
      return NextResponse.json({ success: true, scheduled: true, id, scheduledAt: when.toISOString() });
    }

    // ── Publish now ──
    const outcome = await publishSocial({
      pageId: c.fb_page_id, pageToken: c.fb_page_access_token, igUserId: c.ig_user_id,
      kind, message, mediaUrl, mediaType, targets,
    });

    const anyOk = outcome.facebook?.ok || outcome.instagram?.ok;
    // Log the published post
    try {
      await sb.from('app_social_posts').insert({
        id: genId(), client_id: clientId, client_name: c.name || '', kind, message: message || '',
        media_url: mediaUrl || '', media_type: mediaType || null, targets,
        status: anyOk ? 'published' : 'failed', result: outcome,
        created_at: new Date().toISOString(), published_at: new Date().toISOString(),
      });
    } catch { /* logging is best-effort */ }

    if (!anyOk) {
      return NextResponse.json({ error: 'הפרסום נכשל', outcome }, { status: 502 });
    }
    return NextResponse.json({ success: true, published: true, outcome });
  } catch (err) {
    console.error('[facebook-pages/publish] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'שגיאה לא צפויה' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = (await params).id;
    const sb = getSupabase();
    const { data } = await sb
      .from('app_social_posts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);
    return NextResponse.json({ posts: data || [] });
  } catch {
    return NextResponse.json({ posts: [] });
  }
}
