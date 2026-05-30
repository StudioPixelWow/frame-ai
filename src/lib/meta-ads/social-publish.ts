/**
 * Social publishing service — Facebook Page + linked Instagram.
 * Supports feed posts and stories, to one or both networks in parallel.
 */

const API = 'https://graph.facebook.com/v19.0';

export interface PublishInput {
  pageId: string;
  pageToken: string;
  igUserId?: string;        // linked IG business account (uses the page token)
  kind: 'post' | 'story';
  message?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  targets: { facebook?: boolean; instagram?: boolean };
}

export interface PublishOutcome {
  facebook?: { ok: boolean; id?: string; error?: string };
  instagram?: { ok: boolean; id?: string; error?: string };
}

async function fbJson(url: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  return res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
}

// ── Facebook ──
async function publishFacebook(i: PublishInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    if (i.kind === 'story') {
      if (!i.mediaUrl) return { ok: false, error: 'סטורי דורש מדיה' };
      // FB Page stories: photo_stories / video_stories
      if (i.mediaType === 'video') {
        const d = await fbJson(`${API}/${i.pageId}/video_stories`, { video_url: i.mediaUrl, access_token: i.pageToken });
        return d.error ? { ok: false, error: d.error.message } : { ok: true, id: d.post_id || d.id };
      }
      const d = await fbJson(`${API}/${i.pageId}/photo_stories`, { photo_url: i.mediaUrl, access_token: i.pageToken });
      return d.error ? { ok: false, error: d.error.message } : { ok: true, id: d.post_id || d.id };
    }
    // Feed post
    if (i.mediaUrl && i.mediaType === 'video') {
      const d = await fbJson(`${API}/${i.pageId}/videos`, { file_url: i.mediaUrl, description: i.message || '', access_token: i.pageToken });
      return d.error ? { ok: false, error: d.error.message } : { ok: true, id: d.id };
    }
    if (i.mediaUrl) {
      const d = await fbJson(`${API}/${i.pageId}/photos`, { url: i.mediaUrl, message: i.message || '', access_token: i.pageToken });
      return d.error ? { ok: false, error: d.error.message } : { ok: true, id: d.post_id || d.id };
    }
    const d = await fbJson(`${API}/${i.pageId}/feed`, { message: i.message || '', access_token: i.pageToken });
    return d.error ? { ok: false, error: d.error.message } : { ok: true, id: d.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'שגיאה' };
  }
}

// ── Instagram (Graph API: create container → publish) ──
async function publishInstagram(i: PublishInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!i.igUserId) return { ok: false, error: 'אין חשבון אינסטגרם מקושר' };
  if (!i.mediaUrl) return { ok: false, error: 'אינסטגרם דורש מדיה (תמונה/וידאו)' };
  try {
    const container: Record<string, unknown> = { access_token: i.pageToken };
    if (i.mediaType === 'video') container.video_url = i.mediaUrl; else container.image_url = i.mediaUrl;
    if (i.kind === 'story') container.media_type = 'STORIES';
    else if (i.message) container.caption = i.message;

    const created = await fbJson(`${API}/${i.igUserId}/media`, container);
    if (created.error || !created.id) return { ok: false, error: created.error?.message || 'יצירת מדיה נכשלה' };

    // Video may need a moment to process — best-effort single retry.
    let publishRes = await fbJson(`${API}/${i.igUserId}/media_publish`, { creation_id: created.id, access_token: i.pageToken });
    if (publishRes.error && i.mediaType === 'video') {
      await new Promise((r) => setTimeout(r, 8000));
      publishRes = await fbJson(`${API}/${i.igUserId}/media_publish`, { creation_id: created.id, access_token: i.pageToken });
    }
    return publishRes.error ? { ok: false, error: publishRes.error.message } : { ok: true, id: publishRes.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'שגיאה' };
  }
}

export async function publishSocial(i: PublishInput): Promise<PublishOutcome> {
  const out: PublishOutcome = {};
  const jobs: Promise<void>[] = [];
  if (i.targets.facebook) jobs.push(publishFacebook(i).then((r) => { out.facebook = r; }));
  if (i.targets.instagram) jobs.push(publishInstagram(i).then((r) => { out.instagram = r; }));
  await Promise.all(jobs);
  return out;
}
