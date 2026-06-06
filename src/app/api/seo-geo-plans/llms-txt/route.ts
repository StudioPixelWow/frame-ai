/**
 * POST /api/seo-geo-plans/llms-txt   { planId }
 *
 * Generates an llms.txt file for the client's site — the emerging standard that
 * tells AI engines what the site is about and which content matters. Returns the
 * file content + an E-E-A-T readiness checklist. The user hosts it at /llms.txt.
 * Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { getRequestRole } from '@/lib/auth/api-guard';
import { generateWithAI } from '@/lib/ai/openai-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  }
  try {
    const { planId } = await req.json().catch(() => ({}));
    if (!planId) return NextResponse.json({ error: 'planId נדרש' }, { status: 400 });
    const plan: any = await seoPlans.getByIdAsync(planId);
    if (!plan) return NextResponse.json({ error: 'התוכנית לא נמצאה' }, { status: 404 });

    const businessName = plan.businessName || plan.clientName || '';
    let siteUrl = plan.websiteUrl || '';
    if (siteUrl && !/^https?:\/\//.test(siteUrl)) siteUrl = `https://${siteUrl}`;
    siteUrl = siteUrl.replace(/\/+$/, '');
    const facts = plan.websiteScan?.websiteFacts || {};
    const industry = facts.detected_industry?.value || facts.industry || plan.businessProfile?.industry || '';
    const location = facts.detected_location?.value || facts.location || plan.businessProfile?.location || '';
    const kwList = (Array.isArray(plan.clientKeywords) && plan.clientKeywords.length ? plan.clientKeywords : plan.targetKeywords) || [];
    const keywords = kwList.map((k: any) => (typeof k === 'string' ? k : k?.keyword)).filter(Boolean).slice(0, 12);

    // One-line + paragraph description (AI), best-effort.
    let summary = `${businessName}${industry ? ` — ${industry}` : ''}${location ? `, ${location}` : ''}`;
    let about = '';
    try {
      const out = await generateWithAI(
        'אתה כותב תיאורי עסק תמציתיים ומדויקים בעברית. החזר JSON בלבד.',
        `עסק: ${businessName}${industry ? `, תחום: ${industry}` : ''}${location ? `, אזור: ${location}` : ''}. ביטויי מפתח: ${keywords.join(', ')}.
החזר {"oneLine":"משפט אחד שמתאר את העסק","about":"2-3 משפטים על מה העסק מציע ולמי"}`,
        { temperature: 0.3, maxTokens: 400 },
      );
      const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
      if (j.oneLine) summary = j.oneLine;
      if (j.about) about = j.about;
    } catch { /* fallback to defaults */ }

    // ── Build llms.txt ──
    const lines: string[] = [];
    lines.push(`# ${businessName}`);
    lines.push(`> ${summary}`);
    lines.push('');
    if (about) { lines.push(about); lines.push(''); }
    if (siteUrl) { lines.push('## Main'); lines.push(`- [${businessName}](${siteUrl}): ${summary}`); lines.push(''); }
    if (keywords.length) {
      lines.push('## Topics');
      for (const k of keywords) lines.push(`- ${k}`);
      lines.push('');
    }
    lines.push('## Contact');
    if (siteUrl) lines.push(`- Website: ${siteUrl}`);
    lines.push('');
    lines.push(`<!-- generated ${new Date().toISOString().split('T')[0]} by PixelManageAI -->`);
    const llmsTxt = lines.join('\n');

    // ── E-E-A-T readiness checklist (from what we can detect) ──
    const hasSchema = facts.has_schema?.value ?? facts.has_schema;
    const hasSsl = facts.has_ssl?.value ?? facts.has_ssl;
    const hasSitemap = facts.has_sitemap?.value ?? facts.has_sitemap;
    const checklist = [
      { id: 'llms', label: 'קובץ llms.txt', ok: true, hint: `העלה את הקובץ לכתובת ${siteUrl || 'האתר'}/llms.txt` },
      { id: 'schema', label: 'Schema (Organization/Article)', ok: !!hasSchema, hint: 'הוסף schema.org — נעשה אוטומטית במודול GEO על דפים קיימים' },
      { id: 'author', label: 'מחבר + תאריכים גלויים', ok: false, hint: 'הוסף שם מחבר, ביו, ותאריך פרסום/עדכון גלויים בכל מאמר (E-E-A-T)' },
      { id: 'sitemap', label: 'Sitemap', ok: !!hasSitemap, hint: 'ודא sitemap.xml פעיל' },
      { id: 'bing', label: 'הגשת Sitemap ל-Bing', ok: false, hint: 'ChatGPT משתמש באינדקס של Bing — הגש את ה-sitemap ב-Bing Webmaster Tools' },
      { id: 'ssl', label: 'SSL', ok: !!hasSsl, hint: 'ודא HTTPS תקין' },
    ];

    return NextResponse.json({ success: true, llmsTxt, llmsTxtUrl: siteUrl ? `${siteUrl}/llms.txt` : null, checklist });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'יצירת llms.txt נכשלה' }, { status: 500 });
  }
}
