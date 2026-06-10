/**
 * Per-query drill-down — the heart of the "explainable visibility" experience.
 *
 * For a single monitored query it assembles everything we already measured:
 *   - the latest per-engine responses (appeared / not, full AI answer text, position)
 *   - the sources the AI cited (ours / competitors / other)
 *   - which competitors appeared in those answers
 *   - the most recent change events / diffs for that query (the Data-Moat edge)
 * …then produces an AI explanation of WHY we did / didn't appear and 3 CONCRETE,
 * TYPED improvement actions. Each action carries an actionType so the UI can offer
 * a one-click "בצע עכשיו" that generates the matching content/schema draft.
 *
 * Pure read + reasoning. Never changes a website.
 */

import { visSb, vid, ensureVisibilityTables } from './db';
import { seoPlans } from '@/lib/db';
import { generateWithAI } from '@/lib/ai/openai-client';
import { generateGeoArticle } from '@/lib/seo/geo-content-generator';

export type ImprovementActionType =
  | 'geo_article'      // a new cite-friendly article targeting the query
  | 'faq_schema'       // FAQ block + FAQPage JSON-LD on the target page
  | 'direct_answer'    // a concise direct-answer paragraph for the page
  | 'entity_authority' // strengthen entity/E-E-A-T signals (author, about, sameAs)
  | 'digital_pr';      // pursue a citation on a recurring third-party source

export interface ImprovementAction {
  actionType: ImprovementActionType;
  title: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
}

export interface EngineResponse {
  engine: string;
  found: boolean;
  position: number | null;
  mentionType: string | null;
  answerText: string;
  citations: { domain: string; url: string; isOwn: boolean; isCompetitor: boolean; position: number | null }[];
  competitors: string[];
  createdAt: string | null;
}

export interface QueryDrilldown {
  query: { id: string; text: string; topic: string; intent: string | null; targetPageUrl: string | null };
  engines: EngineResponse[];
  coverage: { tested: number; appeared: number; rate: number };
  why: string;
  improvements: ImprovementAction[];
  citedDomains: { domain: string; isOwn: boolean; isCompetitor: boolean; count: number }[];
  competitors: { name: string; count: number }[];
  changes: { engine: string; type: string; explanation: string; date: string }[];
  measured: boolean; // false ⇒ no run yet for this query
}

const ACTION_LABELS: Record<ImprovementActionType, string> = {
  geo_article: 'מאמר מותאם-ציטוט',
  faq_schema: 'שאלות נפוצות + Schema',
  direct_answer: 'פסקת תשובה ישירה',
  entity_authority: 'חיזוק סמכות/ישות',
  digital_pr: 'השגת ציטוט חיצוני',
};
export function actionLabel(t: ImprovementActionType): string { return ACTION_LABELS[t] || t; }

export async function getQueryDrilldown(planId: string, queryId: string): Promise<QueryDrilldown> {
  const sb = visSb();
  const plan: any = await seoPlans.getByIdAsync(planId);

  // The query may be a real query or a prompt (prompt id starts with 'vp').
  const fromQueries = await sb.from('geo_visibility_queries').select('*').eq('id', queryId).maybeSingle().then((r) => r.data);
  const fromPrompts = fromQueries ? null : await sb.from('geo_visibility_prompts').select('*').eq('id', queryId).maybeSingle().then((r) => r.data);
  const q: any = fromQueries || fromPrompts || {};
  const queryText: string = q.query_text || q.prompt_text || '';
  const topic: string = q.topic || queryText;

  // Latest responses for this query (across runs; newest first), de-duplicated to
  // the most recent per engine so the panel always reflects the current state.
  const responsesRaw = await sb.from('geo_visibility_responses')
    .select('*').eq('plan_id', planId).eq('query_id', queryId)
    .order('created_at', { ascending: false }).limit(60).then((r) => r.data || []);

  const respByEngine = new Map<string, any>();
  for (const r of responsesRaw) if (!respByEngine.has(r.ai_engine)) respByEngine.set(r.ai_engine, r);
  const respIds = Array.from(respByEngine.values()).map((r) => r.id);

  const [cits, comps] = await Promise.all([
    respIds.length ? sb.from('geo_visibility_citations').select('*').in('response_id', respIds).then((r) => r.data || []) : Promise.resolve([]),
    respIds.length ? sb.from('geo_visibility_competitor_mentions').select('*').eq('query_id', queryId).order('created_at', { ascending: false }).limit(60).then((r) => r.data || []) : Promise.resolve([]),
  ]);

  const engines: EngineResponse[] = Array.from(respByEngine.values()).map((r) => ({
    engine: r.ai_engine,
    found: !!r.found,
    position: r.position ?? null,
    mentionType: r.mention_type || null,
    answerText: r.raw_response || '',
    citations: cits.filter((c: any) => c.response_id === r.id).map((c: any) => ({ domain: c.cited_domain, url: c.cited_url, isOwn: !!c.is_own_site, isCompetitor: !!c.is_competitor_site, position: c.citation_position ?? null })),
    competitors: [],
    createdAt: r.created_at || null,
  }));

  // Aggregate cited domains + competitors across the engines.
  const domMap = new Map<string, { domain: string; isOwn: boolean; isCompetitor: boolean; count: number }>();
  for (const c of cits) {
    const key = c.cited_domain || '—';
    const cur = domMap.get(key) || { domain: key, isOwn: !!c.is_own_site, isCompetitor: !!c.is_competitor_site, count: 0 };
    cur.count++; cur.isOwn = cur.isOwn || !!c.is_own_site; cur.isCompetitor = cur.isCompetitor || !!c.is_competitor_site;
    domMap.set(key, cur);
  }
  const citedDomains = Array.from(domMap.values()).sort((a, b) => b.count - a.count);

  const compMap = new Map<string, number>();
  for (const cm of comps) compMap.set(cm.competitor_name, (compMap.get(cm.competitor_name) || 0) + 1);
  const competitors = Array.from(compMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  // attach competitor names per engine response (best-effort by run)
  for (const e of engines) e.competitors = comps.filter((cm: any) => cm.ai_engine === e.engine).map((cm: any) => cm.competitor_name);

  // Recent change events for this query (Data-Moat differentiator).
  const changeRows = await sb.from('geo_ai_answer_change_events')
    .select('*').eq('plan_id', planId).eq('query_id', queryId)
    .order('created_at', { ascending: false }).limit(10).then((r) => r.data || [], () => []);
  const changes = changeRows.map((e: any) => ({ engine: e.ai_engine || '—', type: e.event_type || 'change', explanation: e.explanation || '', date: e.created_at || '' }));

  const tested = engines.length;
  const appeared = engines.filter((e) => e.found).length;
  const coverage = { tested, appeared, rate: tested ? Math.round((appeared / tested) * 100) : 0 };
  const measured = tested > 0;

  // ── AI explanation + concrete improvement actions ──
  const { why, improvements } = await explain({
    plan, queryText, topic, engines, citedDomains, competitors, coverage,
  });

  return {
    query: { id: queryId, text: queryText, topic, intent: q.intent || null, targetPageUrl: q.target_page_url || null },
    engines, coverage, why, improvements, citedDomains, competitors, changes, measured,
  };
}

async function explain(ctx: {
  plan: any; queryText: string; topic: string; engines: EngineResponse[];
  citedDomains: QueryDrilldown['citedDomains']; competitors: QueryDrilldown['competitors']; coverage: { tested: number; appeared: number; rate: number };
}): Promise<{ why: string; improvements: ImprovementAction[] }> {
  const facts = ctx.plan?.websiteScan?.websiteFacts || {};
  const industry = facts?.detected_industry?.value || facts?.industry || '';
  const brand = ctx.plan?.clientName || ctx.plan?.businessProfile?.businessName || '';
  const appearedEngines = ctx.engines.filter((e) => e.found).map((e) => e.engine);
  const missingEngines = ctx.engines.filter((e) => !e.found).map((e) => e.engine);
  const ownCited = ctx.citedDomains.filter((d) => d.isOwn).map((d) => d.domain);
  const compCited = ctx.citedDomains.filter((d) => d.isCompetitor).map((d) => d.domain);
  const otherCited = ctx.citedDomains.filter((d) => !d.isOwn && !d.isCompetitor).map((d) => d.domain).slice(0, 8);
  const sampleAnswer = (ctx.engines.find((e) => e.answerText)?.answerText || '').slice(0, 900);

  const system = `אתה אנליסט GEO (נראות מותג במנועי AI) בכיר בעברית. נתח שאילתה אחת: למה המותג הופיע/לא הופיע בתשובות ה-AI, ומה לעשות כדי להופיע/לחזק.
כללים: מבוסס אך ורק על הנתונים שסופקו; בלי להמציא מספרים; ענייני, חד וקצר; עברית תקנית.
החזר JSON בלבד:
{"why":"הסבר 2-4 משפטים למה הופענו/לא הופענו בשאילתה הזו, כולל אילו מקורות AI מעדיף כאן ומי המתחרים שכן הופיעו",
"improvements":[{"actionType":"geo_article|faq_schema|direct_answer|entity_authority|digital_pr","title":"כותרת פעולה קצרה","detail":"מה בדיוק לעשות ולמה זה יעלה את הסיכוי להופיע בשאילתה הזו","impact":"high|medium|low"}]}
תן בדיוק 3 פעולות, מדורגות מהמשפיעה ביותר. בחר actionType שמתאים לפער: אם מתחרים מצוטטים ואנחנו לא — שקול geo_article/direct_answer; אם חסר מבנה תשובה — faq_schema; אם המקורות הם צד-שלישי חוזר — digital_pr; אם חסרים סימני סמכות — entity_authority.`;

  const user = `מותג: ${brand}${industry ? ` · תחום: ${industry}` : ''}
שאילתה: "${ctx.queryText}" (נושא: ${ctx.topic})
כיסוי: הופענו ב-${ctx.coverage.appeared}/${ctx.coverage.tested} מנועים (${ctx.coverage.rate}%).
מנועים שהופענו בהם: ${appearedEngines.join(', ') || 'אף אחד'}.
מנועים שלא הופענו בהם: ${missingEngines.join(', ') || 'אין'}.
מקורות שלנו שצוטטו: ${ownCited.join(', ') || 'אין'}.
מתחרים שצוטטו: ${compCited.join(', ') || 'אין'}.
מקורות צד-שלישי שצוטטו: ${otherCited.join(', ') || 'אין'}.
מתחרים שהוזכרו בתשובות: ${ctx.competitors.map((c) => c.name).join(', ') || 'אין'}.
דוגמת תשובת AI (קטע): ${sampleAnswer || '—'}`;

  try {
    const res: any = await generateWithAI(system, user, { temperature: 0.5, maxTokens: 1100 });
    let d: any = res?.success ? res.data : null;
    if (typeof d === 'string') { try { d = JSON.parse(d.slice(d.indexOf('{'), d.lastIndexOf('}') + 1)); } catch { d = null; } }
    if (d && d.why) {
      const allowed: ImprovementActionType[] = ['geo_article', 'faq_schema', 'direct_answer', 'entity_authority', 'digital_pr'];
      const improvements: ImprovementAction[] = (Array.isArray(d.improvements) ? d.improvements : []).slice(0, 4).map((x: any) => ({
        actionType: allowed.includes(x.actionType) ? x.actionType : 'geo_article',
        title: String(x.title || '').slice(0, 120),
        detail: String(x.detail || '').slice(0, 400),
        impact: ['high', 'medium', 'low'].includes(x.impact) ? x.impact : 'medium',
      })).filter((x: ImprovementAction) => x.title);
      if (improvements.length) return { why: String(d.why), improvements };
    }
  } catch { /* fall through to deterministic */ }

  return deterministic(ctx);
}

export interface ExecutedDraft {
  draftId: string;
  actionType: ImprovementActionType;
  title: string;
  html: string;
  text: string;
  note: string;
}

/**
 * "בצע עכשיו" — generate a content/schema draft for a chosen improvement.
 * Draft-gated: it produces and persists a draft; it never publishes to the site.
 */
export async function executeImprovement(planId: string, queryId: string, action: { actionType: ImprovementActionType; title?: string; detail?: string }): Promise<ExecutedDraft> {
  await ensureVisibilityTables();
  const sb = visSb();
  const plan: any = await seoPlans.getByIdAsync(planId);
  const brand = plan?.clientName || plan?.businessProfile?.businessName || 'העסק';
  const facts = plan?.websiteScan?.websiteFacts || {};
  const industry = facts?.detected_industry?.value || facts?.industry || '';
  const location = facts?.location?.value || facts?.location || '';
  const siteUrl = plan?.websiteUrl || '';

  const q: any = (await sb.from('geo_visibility_queries').select('*').eq('id', queryId).maybeSingle().then((r) => r.data))
    || (await sb.from('geo_visibility_prompts').select('*').eq('id', queryId).maybeSingle().then((r) => r.data)) || {};
  const queryText: string = q.query_text || q.prompt_text || action.title || '';

  let title = action.title || queryText;
  let html = '';
  let text = '';
  let note = 'הטיוטה נשמרה. עברו עליה ואשרו לפני פרסום לאתר.';

  const t = action.actionType;
  if (t === 'geo_article') {
    const art = await generateGeoArticle(queryText, brand, { siteUrl, author: brand, industry, location });
    title = art.title; html = art.html; text = `${art.tldr}\n\n${(art.faq || []).map((f) => `${f.q}\n${f.a}`).join('\n\n')}`;
  } else {
    const prompts: Record<string, { sys: string; usr: string }> = {
      faq_schema: {
        sys: 'אתה כותב GEO בעברית. צור בלוק שאלות-נפוצות שמנועי AI אוהבים לצטט + JSON-LD מסוג FAQPage. החזר JSON {"faq":[{"q":"","a":""}]} בלבד (5-7 שאלות, תשובות קצרות וישירות).',
        usr: `מותג: ${brand}. שאילתה/נושא: "${queryText}".${industry ? ` תחום: ${industry}.` : ''}`,
      },
      direct_answer: {
        sys: 'אתה כותב GEO בעברית. כתוב פסקת "תשובה ישירה" קצרה (40-70 מילים) שעונה במדויק על השאלה, בפורמט שמנועי AI מצטטים. החזר JSON {"answer":"...","heading":"..."} בלבד.',
        usr: `שאלה: "${queryText}". מותג: ${brand}.${industry ? ` תחום: ${industry}.` : ''}`,
      },
      entity_authority: {
        sys: 'אתה יועץ E-E-A-T/Entity SEO בעברית. החזר JSON {"steps":["צעד קונקרטי",...],"schema":"JSON-LD Organization/Person כטקסט"} בלבד — צעדים לחיזוק אמון מנועי AI במותג.',
        usr: `מותג: ${brand}. אתר: ${siteUrl}.${industry ? ` תחום: ${industry}.` : ''} שאילתה: "${queryText}".`,
      },
      digital_pr: {
        sys: 'אתה אסטרטג Digital-PR בעברית. החזר JSON {"targets":[{"name":"","why":"","how":""}]} בלבד — 5 יעדים קונקרטיים (אתרי תוכן/דירוגים/מאגרים ישראליים) להשגת ציטוט שמנועי AI מצטטים בנושא.',
        usr: `מותג: ${brand}.${industry ? ` תחום: ${industry}.` : ''}${location ? ` אזור: ${location}.` : ''} שאילתה: "${queryText}".`,
      },
    };
    const p = prompts[t] || prompts.direct_answer;
    const res: any = await generateWithAI(p.sys, p.usr, { temperature: 0.5, maxTokens: 1400 });
    let d: any = res?.success ? res.data : null;
    if (typeof d === 'string') { try { d = JSON.parse(d.slice(d.indexOf('{'), d.lastIndexOf('}') + 1)); } catch { d = { raw: String(res?.data || '') }; } }
    ({ html, text, title } = renderActionDraft(t, d, title, queryText));
  }

  const draftId = vid('vdraft');
  await sb.from('geo_visibility_drafts').insert({
    id: draftId, plan_id: planId, client_id: plan?.clientId || null, query_id: queryId,
    query_text: queryText, action_type: t, title, content_html: html, content_text: text,
    meta: {}, status: 'draft', created_at: new Date().toISOString(),
  }).then(() => {}, () => {});

  return { draftId, actionType: t, title, html, text, note };
}

function esc(s: string): string { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function renderActionDraft(t: ImprovementActionType, d: any, fallbackTitle: string, queryText: string): { html: string; text: string; title: string } {
  if (t === 'faq_schema') {
    const faq: { q: string; a: string }[] = Array.isArray(d?.faq) ? d.faq.filter((f: any) => f?.q && f?.a) : [];
    const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
    const html = `${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n')}\n<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
    const text = faq.map((f) => `${f.q}\n${f.a}`).join('\n\n');
    return { html, text, title: `שאלות נפוצות: ${queryText}` };
  }
  if (t === 'direct_answer') {
    const heading = d?.heading || queryText; const answer = d?.answer || d?.raw || '';
    return { html: `<h2>${esc(heading)}</h2><p>${esc(answer)}</p>`, text: answer, title: heading };
  }
  if (t === 'entity_authority') {
    const steps: string[] = Array.isArray(d?.steps) ? d.steps : [];
    const schema = d?.schema || '';
    const html = `<ul>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>${schema ? `<script type="application/ld+json">${typeof schema === 'string' ? schema : JSON.stringify(schema)}</script>` : ''}`;
    return { html, text: steps.join('\n'), title: 'חיזוק סמכות וישות' };
  }
  if (t === 'digital_pr') {
    const targets: any[] = Array.isArray(d?.targets) ? d.targets : [];
    const html = `<ul>${targets.map((x) => `<li><b>${esc(x.name)}</b> — ${esc(x.why)} <em>(${esc(x.how)})</em></li>`).join('')}</ul>`;
    const text = targets.map((x) => `${x.name} — ${x.why} (${x.how})`).join('\n');
    return { html, text, title: 'יעדי Digital-PR לציטוט' };
  }
  return { html: `<p>${esc(d?.raw || '')}</p>`, text: String(d?.raw || ''), title: fallbackTitle };
}

function deterministic(ctx: {
  queryText: string; engines: EngineResponse[]; citedDomains: QueryDrilldown['citedDomains'];
  competitors: QueryDrilldown['competitors']; coverage: { tested: number; appeared: number; rate: number };
}): { why: string; improvements: ImprovementAction[] } {
  const compCited = ctx.citedDomains.filter((d) => d.isCompetitor);
  const ownCited = ctx.citedDomains.filter((d) => d.isOwn);
  const why = ctx.coverage.tested === 0
    ? 'עדיין לא בוצעה בדיקה לשאילתה זו — הרץ בדיקה כדי לקבל ניתוח מבוסס נתונים.'
    : ctx.coverage.appeared === 0
      ? `לא הופענו באף אחד מ-${ctx.coverage.tested} המנועים שנבדקו לשאילתה זו. ${compCited.length ? `מנועי ה-AI מצטטים כאן מקורות מתחרים (${compCited.map((d) => d.domain).slice(0, 3).join(', ')}) במקום את האתר שלנו.` : 'אין לנו תוכן ייעודי וברור שעונה ישירות על השאילתה בפורמט שמנועי AI אוהבים לצטט.'}`
      : `הופענו ב-${ctx.coverage.appeared} מתוך ${ctx.coverage.tested} מנועים (${ctx.coverage.rate}%). ${ownCited.length ? `התוכן שלנו (${ownCited[0].domain}) כבר מצוטט, אך לא בכל המנועים.` : 'אנחנו מוזכרים אך ללא ציטוט ישיר של האתר — חיזוק התוכן יעלה את העקביות.'}`;

  const improvements: ImprovementAction[] = [
    { actionType: 'direct_answer', title: 'הוסף פסקת תשובה ישירה', detail: `כתוב פסקה ממוקדת שעונה במדויק על "${ctx.queryText}" בראש העמוד הרלוונטי — מנועי AI מצטטים תשובות ישירות וקצרות.`, impact: 'high' },
    { actionType: 'faq_schema', title: 'שאלות נפוצות + FAQ Schema', detail: 'הוסף בלוק שאלות-תשובות עם סימון FAQPage JSON-LD סביב השאילתה — מעלה משמעותית את הסיכוי לציטוט.', impact: 'high' },
    compCited.length
      ? { actionType: 'geo_article', title: 'מאמר מותאם-ציטוט מול המתחרים', detail: `המתחרים מצוטטים כאן. צור מאמר עומק שמכסה את הנושא טוב יותר מ-${compCited[0].domain}, עם נתונים וטענות מגובות.`, impact: 'high' as const }
      : { actionType: 'entity_authority', title: 'חיזוק סמכות וישות', detail: 'הוסף מחבר נראה, עמוד "אודות", ו-sameAs לרשתות — מחזק את אמון מנועי ה-AI במותג כמקור.', impact: 'medium' as const },
  ];
  return { why, improvements };
}
