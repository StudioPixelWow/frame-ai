/**
 * GEO Authority — real "Apply" of an APPROVED draft to the client's website.
 *
 * Only runs when the user explicitly applies an already-approved draft, and only
 * when a WordPress connection exists on the plan. Supported draft kinds:
 *   • schema         → injects a <script type="application/ld+json"> block
 *   • faq            → appends an FAQ section
 *   • internal_link  → appends a contextual internal link
 * Other kinds (citation/brand/content) are content suggestions → marked applied
 * with a note so a human can place them; we never silently rewrite copy.
 *
 * Returns { applied, reason?, detail? } — callers decide how to surface it.
 */

import { getPages, getPosts, updatePageContent, type WPConnection } from '@/lib/seo/wordpress-client';

interface ApplyOutcome { applied: boolean; reason?: string; detail?: string; }

function connFromPlan(plan: any): WPConnection | null {
  const wp = plan?.wpConnection;
  if (!wp?.siteUrl || !wp?.username || !wp?.applicationPassword) return null;
  return { siteUrl: wp.siteUrl, username: wp.username, applicationPassword: wp.applicationPassword, useAltApiFormat: wp.useAltApiFormat };
}

function norm(u?: string) { return (u || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase(); }

async function findPage(conn: WPConnection, targetUrl?: string) {
  const [pages, posts] = await Promise.all([
    getPages(conn).catch(() => []),
    getPosts(conn).catch(() => []),
  ]);
  const all = [...pages, ...posts];
  if (!all.length) return null;
  if (targetUrl) {
    const t = norm(targetUrl);
    const hit = all.find((p) => norm(p.url) === t || norm(p.url).endsWith(t) || t.endsWith(norm(p.url)));
    if (hit) return hit;
  }
  // Fall back to the home page (shortest slug) for site-wide schema like Organization.
  return all.sort((a, b) => (a.slug || '').length - (b.slug || '').length)[0];
}

export async function applyDraft(plan: any, draft: any): Promise<ApplyOutcome> {
  const conn = connFromPlan(plan);
  if (!conn) return { applied: false, reason: 'no_wp', detail: 'אין חיבור WordPress לתוכנית — הטיוטה סומנה כמאושרת אך לא הוחלה באתר.' };

  const payload = draft?.payload || {};
  try {
    if (draft.kind === 'schema') {
      const jsonLd = payload.jsonLd || payload.json_ld;
      if (!jsonLd) return { applied: false, reason: 'empty', detail: 'אין JSON-LD בטיוטה.' };
      const page = await findPage(conn, draft.target_page);
      if (!page) return { applied: false, reason: 'no_page', detail: 'לא נמצא עמוד יעד ב-WordPress.' };
      const block = `\n<!-- GEO Authority schema -->\n<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>\n`;
      if (page.content.includes(JSON.stringify(jsonLd).slice(0, 40))) return { applied: true, detail: 'ה-Schema כבר קיים בעמוד.' };
      const res = await updatePageContent(conn, page.id, `${page.content}${block}`);
      return res.success ? { applied: true, detail: `Schema (${payload.schemaType || ''}) הוזרק לעמוד ${page.url}` } : { applied: false, reason: 'wp_error', detail: res.error };
    }

    if (draft.kind === 'faq') {
      const items: Array<{ question: string; answer: string }> = Array.isArray(payload.items) ? payload.items
        : (payload.question ? [{ question: payload.question, answer: payload.answer }] : []);
      if (!items.length) return { applied: false, reason: 'empty', detail: 'אין שאלות בטיוטה.' };
      const page = await findPage(conn, draft.target_page);
      if (!page) return { applied: false, reason: 'no_page', detail: 'לא נמצא עמוד יעד.' };
      const html = `\n<!-- GEO Authority FAQ -->\n<section class="geo-faq"><h2>שאלות נפוצות</h2>\n${items.map((i) => `<h3>${i.question}</h3>\n<p>${i.answer}</p>`).join('\n')}\n</section>\n`;
      const res = await updatePageContent(conn, page.id, `${page.content}${html}`);
      return res.success ? { applied: true, detail: `נוספו ${items.length} שאלות לעמוד ${page.url}` } : { applied: false, reason: 'wp_error', detail: res.error };
    }

    if (draft.kind === 'internal_link') {
      const toUrl = payload.to || payload.to_page; const anchor = payload.anchor || payload.anchorText;
      if (!toUrl || !anchor) return { applied: false, reason: 'empty', detail: 'חסר יעד/Anchor לקישור.' };
      const page = await findPage(conn, payload.from || draft.target_page);
      if (!page) return { applied: false, reason: 'no_page', detail: 'לא נמצא עמוד מקור.' };
      const block = `\n<p class="geo-related">קראו גם: <a href="${toUrl}">${anchor}</a></p>\n`;
      const res = await updatePageContent(conn, page.id, `${page.content}${block}`);
      return res.success ? { applied: true, detail: `נוסף קישור פנימי בעמוד ${page.url}` } : { applied: false, reason: 'wp_error', detail: res.error };
    }

    // citation / brand_mention / content — textual suggestions; place manually.
    return { applied: true, reason: 'manual', detail: 'טיוטת תוכן — סומנה כהוחלה; מומלץ לשבץ ידנית בעמוד הרלוונטי.' };
  } catch (e) {
    return { applied: false, reason: 'error', detail: e instanceof Error ? e.message : 'failed' };
  }
}
