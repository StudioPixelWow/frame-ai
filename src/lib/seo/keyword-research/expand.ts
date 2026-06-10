/**
 * Seed-keyword expander — takes the handful of keywords the client actually cares
 * about and uses AI to grow them into a large, high-quality set: ~150 real Google
 * search keywords + ~150 conversational AI/GEO queries, all grounded in the seeds
 * and the business context. NEVER pulls from page titles, footers or headings —
 * the seeds are the only source of intent. Falls back to a deterministic Hebrew
 * expander (no scraping) when AI is unavailable.
 */

import { generateWithAI } from '@/lib/ai/openai-client';

export interface ExpandContext {
  businessName?: string;
  industry?: string;
  location?: string;
  services?: string[];
}
export interface ExpandedKeywords {
  google: string[];   // search-style keywords for Google
  ai: string[];       // conversational questions for AI engines (GEO)
  usedAI: boolean;
}

const clean = (s: string) => String(s || '').replace(/["'‏‎]/g, '').replace(/\s+/g, ' ').trim();
const isHeb = (s: string) => /[֐-׿]/.test(s);

function dedupeCap(list: string[], cap: number): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const raw of list) {
    const t = clean(raw);
    if (!t || t.length < 2 || t.length > 90) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

async function aiBatch(kind: 'google' | 'ai', seeds: string[], ctx: ExpandContext, target: number): Promise<string[]> {
  const heb = seeds.some(isHeb) || isHeb(`${ctx.industry || ''}${ctx.businessName || ''}`);
  const lang = heb ? 'עברית' : 'English';
  const ctxLine = [
    ctx.businessName ? `עסק: ${ctx.businessName}` : '',
    ctx.industry ? `תחום: ${ctx.industry}` : '',
    ctx.location ? `אזור: ${ctx.location}` : '',
    ctx.services && ctx.services.length ? `שירותים: ${ctx.services.slice(0, 8).join(', ')}` : '',
  ].filter(Boolean).join(' · ');

  const system = kind === 'google'
    ? `אתה מומחה מחקר מילות מפתח ל-SEO בישראל. קלט: ביטויי זרע שהלקוח בחר. פלט: ביטויי חיפוש אמיתיים שאנשים מקלידים בגוגל, בהרחבה של ביטויי הזרע בלבד (וריאציות, מילים נרדפות, זנב ארוך, כוונת קנייה/מידע, שילובי אזור). ${lang} בלבד. בלי שמות מותג מומצאים, בלי כפילויות, בלי טקסט שיווקי, בלי כותרות אתר. החזר JSON: {"keywords":["...","..."]} בלבד.`
    : `אתה מומחה GEO (נראות במנועי AI) בישראל. קלט: ביטויי זרע שהלקוח בחר. פלט: שאלות טבעיות ושלמות שמשתמש אמיתי ישאל את ChatGPT/Gemini/Perplexity סביב ביטויי הזרע (שאלות מלאות, השוואות, "איך/למה/מה הכי טוב/האם", כוונת בחירה והמלצה). כל שאלה עומדת בפני עצמה וברורה. ${lang} בלבד. בלי כפילויות, בלי טקסט שיווקי, בלי כותרות אתר. החזר JSON: {"queries":["...","..."]} בלבד.`;

  const user = `ביטויי הזרע של הלקוח (הבסיס היחיד):
${seeds.map((s, i) => `${i + 1}. ${s}`).join('\n')}

${ctxLine ? ctxLine + '\n\n' : ''}צור ${target} ${kind === 'google' ? 'ביטויי חיפוש' : 'שאלות'} שמרחיבים את ביטויי הזרע. כל פריט חייב להיות קשור ישירות לאחד מביטויי הזרע. גוון אבל הישאר רלוונטי.`;

  const acc: string[] = [];
  // Two passes to comfortably reach the target without overflowing a single response.
  for (let pass = 0; pass < 2 && acc.length < target; pass++) {
    const res: any = await generateWithAI(system, pass === 0 ? user : `${user}\n\nאל תחזור על ביטויים שכבר ניתנו. תן ${Math.max(20, target - acc.length)} חדשים.`, { temperature: 0.8, maxTokens: 2600 });
    let d: any = res?.success ? res.data : null;
    if (typeof d === 'string') { try { d = JSON.parse(d.slice(d.indexOf('{'), d.lastIndexOf('}') + 1)); } catch { d = null; } }
    const arr: string[] = Array.isArray(d?.keywords) ? d.keywords : Array.isArray(d?.queries) ? d.queries : Array.isArray(d) ? d : [];
    if (!arr.length) break;
    acc.push(...arr.map(clean).filter(Boolean));
  }
  return acc;
}

/** Deterministic, seed-only expander (no AI, no scraping) — safe fallback. */
function deterministic(kind: 'google' | 'ai', seeds: string[], ctx: ExpandContext, target: number): string[] {
  const heb = seeds.some(isHeb);
  const loc = ctx.location ? (heb ? ` ב${ctx.location}` : ` in ${ctx.location}`) : '';
  const out: string[] = [];
  const gMods = heb ? ['', ' מומלץ', ' מחיר', ' עלות', ' איכותי', ' מקצועי', ' ביקורות', ' המלצות', ` בישראל`, loc] : ['', ' price', ' cost', ' reviews', ' near me'];
  const aMods = heb
    ? (s: string) => [`מה זה ${s}?`, `איך בוחרים ${s}?`, `מה היתרונות של ${s}?`, `כמה עולה ${s}?`, `מי מספק ${s} מומלץ${loc}?`, `מה חשוב לדעת לפני ${s}?`]
    : (s: string) => [`what is ${s}?`, `how to choose ${s}?`, `benefits of ${s}?`, `how much does ${s} cost?`, `best ${s} provider?`];
  for (const seed of seeds) {
    if (kind === 'google') for (const m of gMods) out.push(`${seed}${m}`);
    else out.push(...aMods(seed));
    if (out.length >= target) break;
  }
  return out;
}

export async function expandSeedKeywords(seedsRaw: string[], ctx: ExpandContext = {}): Promise<ExpandedKeywords> {
  const seeds = dedupeCap(seedsRaw, 20);
  if (!seeds.length) return { google: [], ai: [], usedAI: false };

  let google: string[] = [], ai: string[] = [], usedAI = false;
  try {
    const [g, a] = await Promise.all([aiBatch('google', seeds, ctx, 150), aiBatch('ai', seeds, ctx, 150)]);
    google = dedupeCap(g, 150); ai = dedupeCap(a, 150);
    usedAI = google.length > 0 || ai.length > 0;
  } catch { /* fall through */ }

  if (google.length < 30) google = dedupeCap([...google, ...deterministic('google', seeds, ctx, 150)], 150);
  if (ai.length < 30) ai = dedupeCap([...ai, ...deterministic('ai', seeds, ctx, 150)], 150);

  return { google, ai, usedAI };
}
