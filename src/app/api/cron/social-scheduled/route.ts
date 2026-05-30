/**
 * Social scheduled-posts publisher cron.
 * Publishes any app_social_posts rows whose scheduled_at is due.
 * Add to vercel.json crons (e.g. every 15 min).
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

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const sb = getSupabase();
  const nowIso = new Date().toISOString();

  const { data: due } = await sb
    .from('app_social_posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
    .limit(25);

  if (!due || due.length === 0) return NextResponse.json({ published: 0 });

  let published = 0;
  for (const p of due as any[]) {
    try {
      const { data: client } = await sb
        .from('clients')
        .select('fb_page_id, fb_page_access_token, ig_user_id')
        .eq('id', p.client_id).single();
      const c = client as any;
      if (!c?.fb_page_id || !c?.fb_page_access_token) {
        await sb.from('app_social_posts').update({ status: 'failed', result: { error: 'הדף נותק' } }).eq('id', p.id);
        continue;
      }
      const outcome = await publishSocial({
        pageId: c.fb_page_id, pageToken: c.fb_page_access_token, igUserId: c.ig_user_id,
        kind: p.kind, message: p.message, mediaUrl: p.media_url, mediaType: p.media_type, targets: p.targets || { facebook: true },
      });
      const anyOk = outcome.facebook?.ok || outcome.instagram?.ok;
      await sb.from('app_social_posts').update({
        status: anyOk ? 'published' : 'failed', result: outcome, published_at: new Date().toISOString(),
      }).eq('id', p.id);
      if (anyOk) published++;
    } catch (e) {
      await sb.from('app_social_posts').update({ status: 'failed', result: { error: String(e) } }).eq('id', p.id);
    }
  }

  return NextResponse.json({ published, processed: due.length });
}
