/**
 * GEO content generator — produces a NEW standalone article engineered to be
 * CITED by AI engines (ChatGPT / Perplexity / Gemini / Google AI Overview).
 *
 * Cite-friendly structure (per 2026 GEO best practices):
 *   - TL;DR summary at the very top (LLMs extract these)
 *   - A direct one-paragraph answer to the core question
 *   - Claim → evidence → statistic blocks
 *   - A Q&A (FAQ) section with concrete questions
 *   - An optional comparison/criteria list
 *   - FAQPage + Article JSON-LD schema embedded
 *   - Visible author + dates (E-E-A-T)
 */

import { generateWithAI } from '@/lib/ai/openai-client';

export interface GeoArticle {
  title: string;
  tldr: string;
  html: string;            // full post body incl. JSON-LD <script>
  metaTitle: string;
  metaDescription: string;
  faq: { q: string; a: string }[];
  focusKeyword: string;
}

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function generateGeoArticle(
  keyword: string,
  businessName: string,
  opts: { siteUrl?: string; author?: string; industry?: string; location?: string } = {},
): Promise<GeoArticle> {
  const author = opts.author || businessName;
  const today = new Date().toISOString().split('T')[0];

  const system = [
    'אתה כותב תוכן SEO/GEO מקצועי בעברית, שנכתב כדי שמנועי AI (ChatGPT, Perplexity, Gemini, Google AI Overview) יצטטו אותו.',
    'כתוב תוכן מדויק, עובדתי, עם טענות מגובות בנתונים. הימנע מסיסמאות שיווקיות ריקות.',
    'החזר JSON תקין בלבד, ללא טקסט נוסף.',
  ].join(' ');

  const user = `נושא/ביטוי מטרה: "${keyword}"
עסק: ${businessName}${opts.industry ? ` · תחום: ${opts.industry}` : ''}${opts.location ? ` · אזור: ${opts.location}` : ''}

צור מאמר שמותאם לציטוט ע"י מנועי AI. החזר JSON במבנה:
{
  "title": "כותרת ברורה הכוללת את הביטוי",
  "metaTitle": "כותרת SEO עד 60 תווים",
  "metaDescription": "תיאור עד 155 תווים",
  "tldr": "סיכום TL;DR של 2-3 משפטים שעונה ישירות על השאלה המרכזית",
  "directAnswer": "פסקה אחת שעונה ישירות ומדויק על השאלה המרכזית של הביטוי",
  "claims": [ { "claim": "טענה", "evidence": "הסבר/הוכחה", "stat": "נתון או מספר אם רלוונטי (אחרת ריק)" } ],
  "comparison": [ "קריטריון/נקודה 1", "קריטריון 2", "קריטריון 3" ],
  "faq": [ { "q": "שאלה נפוצה", "a": "תשובה קצרה וישירה" } ]
}
דרישות: 4-6 claims, 4-6 שאלות FAQ. תשובות קצרות וישירות (משפט-שניים). עברית תקינה.`;

  const raw = await generateWithAI(system, user, { temperature: 0.4, maxTokens: 2200 });
  let data: any = {};
  try {
    const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    data = JSON.parse(jsonStr);
  } catch {
    data = { title: keyword, tldr: '', directAnswer: raw.slice(0, 400), claims: [], faq: [], comparison: [] };
  }

  const title = data.title || keyword;
  const faq: { q: string; a: string }[] = Array.isArray(data.faq) ? data.faq.filter((f: any) => f?.q && f?.a) : [];
  const claims: any[] = Array.isArray(data.claims) ? data.claims : [];
  const comparison: string[] = Array.isArray(data.comparison) ? data.comparison : [];

  // ── Build cite-friendly HTML ──
  const parts: string[] = [];
  if (data.tldr) parts.push(`<p><strong>TL;DR:</strong> ${esc(data.tldr)}</p>`);
  parts.push(`<p style="font-size:0.85em;color:#666">מאת ${esc(author)} · עודכן ${today}</p>`);
  if (data.directAnswer) parts.push(`<h2>${esc(title)}</h2><p>${esc(data.directAnswer)}</p>`);
  if (claims.length) {
    parts.push('<h2>נקודות מפתח ונתונים</h2>');
    for (const c of claims) {
      parts.push(`<p><strong>${esc(c.claim || '')}</strong> — ${esc(c.evidence || '')}${c.stat ? ` <em>(${esc(c.stat)})</em>` : ''}</p>`);
    }
  }
  if (comparison.length) {
    parts.push('<h2>על מה לשים דגש</h2><ul>' + comparison.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>');
  }
  if (faq.length) {
    parts.push('<h2>שאלות נפוצות</h2>');
    for (const f of faq) parts.push(`<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`);
  }

  // ── JSON-LD: Article + FAQPage ──
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: title,
        author: { '@type': 'Organization', name: author },
        datePublished: today, dateModified: today,
        ...(opts.siteUrl ? { publisher: { '@type': 'Organization', name: businessName, url: opts.siteUrl } } : {}),
      },
      ...(faq.length ? [{
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }] : []),
    ],
  };
  parts.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);

  return {
    title,
    tldr: data.tldr || '',
    html: parts.join('\n'),
    metaTitle: (data.metaTitle || title).slice(0, 60),
    metaDescription: (data.metaDescription || data.tldr || '').slice(0, 155),
    faq,
    focusKeyword: keyword,
  };
}
