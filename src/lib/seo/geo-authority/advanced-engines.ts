/**
 * Advanced GEO engines — the genuinely-new modules. All are DRAFT/RECOMMENDATION
 * producers: they store structured results for review; nothing touches the live
 * website. generateWithAI(system,user,opts) → { success, data } (parsed JSON).
 */

import { generateWithAI } from '@/lib/ai/openai-client';
import { insertRows, replaceRows } from './advanced-db';

export interface EngineCtx {
  planId: string; clientId?: string | null;
  businessName: string; industry?: string; location?: string; websiteUrl?: string;
  keywords: string[];
  competitors: string[];
  pages: Array<{ url?: string; title?: string; content?: string }>;
  visibility: Array<{ query?: string; platform?: string; found?: boolean }>;
}

function asArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (typeof data === 'string') { try { const i = data.indexOf('['), j = data.lastIndexOf(']'); if (i >= 0) return JSON.parse(data.slice(i, j + 1)); } catch { /* */ } }
  return [];
}
function asObject(data: any): any {
  if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  if (typeof data === 'string') { try { const i = data.indexOf('{'), j = data.lastIndexOf('}'); if (i >= 0) return JSON.parse(data.slice(i, j + 1)); } catch { /* */ } }
  return {};
}
const head = (c: EngineCtx) => `עסק: ${c.businessName}${c.industry ? `, תחום: ${c.industry}` : ''}${c.location ? `, אזור: ${c.location}` : ''}${c.websiteUrl ? `, אתר: ${c.websiteUrl}` : ''}.`;

/* #1 AI Query Discovery */
export async function runQueryDiscovery(c: EngineCtx) {
  const r = await generateWithAI(
    'אתה מומחה GEO. ייצר שאילתות AI אמיתיות (לא מילות מפתח) בעברית. החזר JSON array בלבד.',
    `${head(c)} ביטויי זרע: ${c.keywords.slice(0, 10).join(', ')}.
ייצר 12 שאילתות מגוונות. כל פריט: {"query":"השאלה","query_type":"conversational|problem|follow_up|buyer_journey|local|comparison|recommendation|long_tail","topic":"נושא","target_page":"עמוד יעד מוצע","priority":"high|medium|low","country":"IL","language":"he","est_volume":"low|medium|high"}`,
    { temperature: 0.6, maxTokens: 1600 });
  const items = (r.success ? asArray(r.data) : []).map((q: any) => ({ client_id: c.clientId || null, query: q.query, query_type: q.query_type, topic: q.topic, target_page: q.target_page, priority: q.priority, country: q.country || 'IL', language: q.language || 'he', est_volume: q.est_volume, status: 'open' }));
  const n = await replaceRows('geo_query_discovery_sets', c.planId, items);
  return { count: n, items };
}

/* #4 AI Answer Simulation */
export async function runAnswerSimulation(c: EngineCtx) {
  const queries = (c.visibility.map((v) => v.query).filter(Boolean) as string[]).slice(0, 8);
  const seed = queries.length ? queries : c.keywords.slice(0, 6);
  const r = await generateWithAI(
    'אתה מדמה תשובות של מנועי AI (ChatGPT/Gemini/Perplexity/Claude). אתה מעריך אם מותג נתון היה מופיע. החזר JSON array בלבד. אל תמציא עובדות — סמן הערכה.',
    `${head(c)} שאילתות לבדיקה: ${seed.join(' | ')}.
לכל שאילתה החזר: {"query":"...","platform":"chatgpt","brand_appeared":true/false,"was_cited":true/false,"who_appeared":["מי כן היה מופיע"],"ideal_answer":"תשובה אידיאלית קצרה","missing":"מה חסר כדי להופיע","recommendation":"המלצה","score":0-100}`,
    { temperature: 0.4, maxTokens: 1800 });
  const items = (r.success ? asArray(r.data) : []).map((x: any) => ({ client_id: c.clientId || null, query: x.query, platform: x.platform || 'chatgpt', brand_appeared: !!x.brand_appeared, was_cited: !!x.was_cited, who_appeared: x.who_appeared || [], ideal_answer: x.ideal_answer, missing: x.missing, recommendation: x.recommendation, score: x.score ?? null }));
  const n = await replaceRows('geo_answer_simulations', c.planId, items);
  return { count: n, items };
}

/* #3 AI Citation Opportunity Finder */
export async function runCitationOpportunity(c: EngineCtx) {
  const r = await generateWithAI(
    'אתה מומחה GEO לציטוטים. אתה מזהה הזדמנויות להפוך עמודים למקור מצוטט. החזר JSON array בלבד.',
    `${head(c)} עמודים: ${c.pages.slice(0, 8).map((p) => p.title || p.url).join(', ')}.
ייצר 8 הזדמנויות ציטוט. כל פריט: {"page":"עמוד באתר שיכול להפוך למקור","source_type":"data|research|guide|definition|stats","gap":"מה חסר","probability":0-100,"competitor_cited":"מתחרה שמצוטט במקום"}`,
    { temperature: 0.5, maxTokens: 1500 });
  const items = (r.success ? asArray(r.data) : []).map((x: any) => ({ page: x.page, source_type: x.source_type, gap: x.gap, probability: x.probability ?? null, competitor_cited: x.competitor_cited, status: 'open' }));
  const n = await replaceRows('geo_citation_opportunities', c.planId, items);
  return { count: n, items };
}

/* #6 AI Reputation Monitor */
export async function runReputationMonitor(c: EngineCtx) {
  const r = await generateWithAI(
    'אתה בודק כיצד מנועי AI מתארים מותג. אל תמציא — אם אינך יודע, ציין "לא ידוע". החזר JSON object בלבד.',
    `${head(c)}
החזר: {"description":"כיצד AI כנראה מתאר את המותג","accurate":true/false,"sentiment":"positive|neutral|negative","risk_level":"low|medium|high","issues":["מידע שגוי/חוסרים"],"missing_expertise":["תחומי מומחיות שלא מזוהים"],"competitors_better":["מתחרים שמוצגים טוב יותר"],"score":0-100}`,
    { temperature: 0.3, maxTokens: 1100 });
  const o = r.success ? asObject(r.data) : {};
  const row = { client_id: c.clientId || null, platform: 'multi', sentiment: o.sentiment || 'neutral', accurate: o.accurate ?? null, risk_level: o.risk_level || 'medium', issues: o.issues || [], missing_expertise: o.missing_expertise || [], description: o.description || '', score: o.score ?? null };
  const n = await insertRows('geo_reputation_checks', c.planId, [row]);
  return { count: n, item: o };
}

/* #15 GEO Opportunity Engine */
export async function runOpportunityEngine(c: EngineCtx) {
  const r = await generateWithAI(
    'אתה מנוע הזדמנויות GEO. אתה מדרג הזדמנויות לפי ROI/קושי/ביקוש. החזר JSON array בלבד.',
    `${head(c)} ביטויים: ${c.keywords.slice(0, 10).join(', ')}. מתחרים: ${c.competitors.slice(0, 6).join(', ')}.
ייצר 12 הזדמנויות. כל פריט: {"title":"...","type":"content|schema|entity|citation|linking","bucket":"quick_win|strategic|high_effort|lost","roi":0-100,"difficulty":0-100,"visibility_potential":0-100,"citation_potential":0-100,"lead_potential":0-100,"demand":0-100,"related_query":"...","related_topic":"...","related_page":"..."}`,
    { temperature: 0.5, maxTokens: 2000 });
  const items = (r.success ? asArray(r.data) : []).map((x: any) => ({
    client_id: c.clientId || null, title: x.title, type: x.type, bucket: x.bucket,
    roi: x.roi ?? null, difficulty: x.difficulty ?? null, visibility_potential: x.visibility_potential ?? null,
    citation_potential: x.citation_potential ?? null, lead_potential: x.lead_potential ?? null, demand: x.demand ?? null,
    score: Math.round(((x.roi || 0) + (x.visibility_potential || 0) + (x.demand || 0)) / 3 - (x.difficulty || 0) * 0.3),
    related_query: x.related_query, related_topic: x.related_topic, related_page: x.related_page, status: 'open',
  }));
  const n = await replaceRows('geo_opportunities', c.planId, items);
  return { count: n, items };
}

/* #17 GEO Roadmap Generator */
export async function runRoadmap(c: EngineCtx) {
  const r = await generateWithAI(
    'אתה בונה תוכנית עבודה GEO. החזר JSON object בלבד.',
    `${head(c)} ביטויים: ${c.keywords.slice(0, 10).join(', ')}.
החזר תוכנית: {"30":[{"task":"...","impact":"high|medium|low","effort":"high|medium|low"}],"60":[...],"90":[...],"180":[...]}`,
    { temperature: 0.4, maxTokens: 2000 });
  const payload = r.success ? asObject(r.data) : {};
  const n = await insertRows('geo_roadmaps', c.planId, [{ horizon: 'full', payload }]);
  return { count: n, payload };
}

/* #22 AI Content Brief Generator */
export async function runContentBrief(c: EngineCtx, topic?: string) {
  const subject = topic || c.keywords[0] || c.businessName;
  const r = await generateWithAI(
    'אתה כותב בריף תוכן GEO מלא בעברית. החזר JSON object בלבד.',
    `${head(c)} נושא הבריף: "${subject}".
החזר: {"h1":"...","meta_title":"...","meta_description":"...","h2":["..."],"h3":["..."],"faq":[{"q":"...","a":"..."}],"entities":["..."],"citations":["..."],"internal_links":["..."],"schema":["FAQPage","Article"],"target_queries":["..."],"target_ai_answer":"...","tone":"...","word_count":1200,"eeat_notes":"..."}`,
    { temperature: 0.5, maxTokens: 2200 });
  const payload = r.success ? asObject(r.data) : {};
  const n = await insertRows('geo_content_briefs', c.planId, [{ client_id: c.clientId || null, title: payload.h1 || subject, target_page: null, payload, priority_score: null, status: 'draft' }]);
  return { count: n, payload };
}

/* #23 AI Content Validator */
export async function runContentValidator(c: EngineCtx, target: string, content: string) {
  const r = await generateWithAI(
    'אתה בודק מוכנות תוכן ל-GEO לפני פרסום. החזר JSON object בלבד.',
    `${head(c)} בדוק את התוכן הבא ל: ${target}.
תוכן: """${(content || '').slice(0, 4000)}"""
החזר: {"score":0-100,"passed":true/false,"checks":[{"name":"Citation Quality|Entity Coverage|AI Readiness|Schema|Internal Links|FAQ|Brand Mentions|Answer Clarity|Content Depth|Duplicate Risk","ok":true/false,"note":"..."}]}`,
    { temperature: 0.2, maxTokens: 1400 });
  const o = r.success ? asObject(r.data) : {};
  const n = await insertRows('geo_content_validations', c.planId, [{ target, score: o.score ?? null, checks: o.checks || [], passed: !!o.passed }]);
  return { count: n, item: o };
}

/* #21 GEO Forecast Engine */
export async function runForecast(c: EngineCtx) {
  const r = await generateWithAI(
    'אתה חוזה השפעת GEO אם ייושמו ההמלצות. היה שמרני וציין הנחות. החזר JSON object בלבד.',
    `${head(c)} ביטויים: ${c.keywords.length}, מתחרים: ${c.competitors.length}, נראות נוכחית: ${c.visibility.filter((v) => v.found).length}/${c.visibility.length}.
החזר: {"30":{"visibility_growth":"%","mentions":n,"citations":n,"authority_score":n},"60":{...},"90":{...},"confidence":0-100,"assumptions":["..."]}`,
    { temperature: 0.3, maxTokens: 1400 });
  const payload = r.success ? asObject(r.data) : {};
  const n = await insertRows('geo_forecasts', c.planId, [{ payload, confidence: payload.confidence ?? null }]);
  return { count: n, payload };
}

/* #25 AI Conversation Path Analyzer */
export async function runConversationPaths(c: EngineCtx) {
  const r = await generateWithAI(
    'אתה מנתח מסעות שיחה של משתמשים (follow-up queries) לבניית אשכולות תוכן. החזר JSON array בלבד.',
    `${head(c)} ביטויי זרע: ${c.keywords.slice(0, 6).join(', ')}.
ייצר 5 מסעות. כל פריט: {"seed":"שאילתת פתיחה","path":["שלב 1","שלב 2","שלב 3"],"missing_pages":["עמודים חסרים"],"linking":["הצעות קישור פנימי"],"funnel":"awareness|consideration|decision"}`,
    { temperature: 0.6, maxTokens: 1600 });
  const items = (r.success ? asArray(r.data) : []).map((x: any) => ({ seed: x.seed, path: x.path || [], missing_pages: x.missing_pages || [], linking: x.linking || [], funnel: x.funnel }));
  const n = await replaceRows('geo_conversation_paths', c.planId, items);
  return { count: n, items };
}
