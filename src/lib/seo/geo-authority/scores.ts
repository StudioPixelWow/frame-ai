/**
 * Advanced GEO scoring — derives the advanced score family from the data already
 * on the plan + the base Authority sub-scores. Each score returns
 * { value 0-100, explanation, factors[], recommendations[] } and is deterministic
 * (quota-free) so the dashboard always has numbers.
 */

import { computeAuthorityScore } from './authority-score';

export interface Score { value: number; explanation: string; factors: string[]; recommendations: string[]; }
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const arr = (v: any) => (Array.isArray(v) ? v : []);
const avg = (...n: number[]) => n.reduce((a, b) => a + b, 0) / Math.max(1, n.length);

export const SCORE_LABELS: Record<string, string> = {
  ai_query_opportunity: 'AI Query Opportunity',
  competitor_weakness: 'Competitor Weakness',
  citation_opportunity: 'Citation Opportunity',
  answer_simulation: 'Answer Simulation',
  reputation_risk: 'Reputation Risk',
  content_roi: 'Content ROI',
  knowledge_gap: 'Knowledge Gap',
  brand_entity_authority: 'Brand Entity Authority',
  ai_recommendation: 'AI Recommendation',
  ai_trust: 'AI Trust',
  citation_probability: 'Citation Probability',
  featured_source: 'Featured Source',
  geo_opportunity: 'GEO Opportunity',
  ai_influence: 'AI Influence',
  forecast_confidence: 'Forecast Confidence',
  content_brief_priority: 'Content Brief Priority',
  brand_memory_growth: 'Brand Memory Growth',
  conversation_path_opportunity: 'Conversation Path Opportunity',
};

export function computeAllScores(plan: any): Record<string, Score> {
  const base = computeAuthorityScore(plan);
  const s = base.subScores;
  const competitors = arr(plan?.competitors);
  const gaps = arr(plan?.contentGaps);
  const keywords = [...arr(plan?.aiKeywords), ...arr(plan?.clientKeywords)];
  const vis = arr(plan?.visibilityResults).length ? arr(plan?.visibilityResults) : arr(plan?.baselineAiQueries);
  const foundRatio = vis.length ? vis.filter((v: any) => v.found).length / vis.length : 0;
  const dataCompleteness = avg(
    arr(plan?.scannedPages).length ? 100 : 0, vis.length ? 100 : 0,
    competitors.length ? 100 : 0, keywords.length ? 100 : 0,
  );

  const out: Record<string, Score> = {};
  const set = (k: string, value: number, explanation: string, factors: string[], recommendations: string[]) =>
    (out[k] = { value: clamp(value), explanation, factors, recommendations });

  set('ai_trust', avg(s.eeat, s.schema, s.citation, s.brand, s.entity),
    'אמון מנועי AI במותג — שילוב E-E-A-T, Schema, ציטוטים, מותג וישויות.',
    [`E-E-A-T ${s.eeat}`, `Schema ${s.schema}`, `Citation ${s.citation}`, `Brand ${s.brand}`],
    s.eeat < 60 ? ['חזק אותות E-E-A-T (מחבר, תאריכים, אודות)'] : []);

  set('geo_opportunity', clamp(40 + keywords.length * 2 + gaps.length * 3 + competitors.length * 2),
    'פוטנציאל GEO כולל לפי ביקוש, פערים ומתחרים.',
    [`${keywords.length} ביטויים`, `${gaps.length} פערים`, `${competitors.length} מתחרים`],
    gaps.length === 0 ? ['הרץ Content Gap Finder לחשיפת הזדמנויות'] : []);

  set('ai_recommendation', clamp(foundRatio * 100 * 0.85),
    'עד כמה AI ממליץ על המותג (לא רק מזכיר).',
    [`מופיע ב-${Math.round(foundRatio * 100)}% מהשאילתות`],
    foundRatio < 0.5 ? ['שפר מבנה תשובה ועדויות כדי לעבור מ"אזכור" ל"המלצה"'] : []);

  set('ai_influence', avg(foundRatio * 100, s.topical, s.entity),
    'מידת ההשפעה של המותג על תשובות AI.',
    [`hit-rate ${Math.round(foundRatio * 100)}%`, `Topical ${s.topical}`, `Entity ${s.entity}`], []);

  set('citation_probability', avg(s.contentDepth, s.schema, s.citation, s.eeat),
    'סיכוי שעמוד יהפוך למקור מצוטט ע"י AI.',
    [`Content ${s.contentDepth}`, `Schema ${s.schema}`, `Citation ${s.citation}`],
    s.citation < 50 ? ['הוסף מקורות/נתונים ו-FAQ בני-שליפה'] : []);

  set('featured_source', avg(foundRatio * 100, s.citation, s.contentDepth),
    'פוטנציאל להפוך למקור מוביל/ראשי בתשובות.',
    [`Citation ${s.citation}`, `Content ${s.contentDepth}`], []);

  set('competitor_weakness', competitors.length ? clamp(55 + competitors.length * 3) : 30,
    competitors.length ? 'חולשות מתחרים שניתן לנצל.' : 'לא נסרקו מתחרים.',
    [`${competitors.length} מתחרים נסרקו`],
    competitors.length === 0 ? ['הרץ Competitor Reverse Engineering'] : []);

  set('citation_opportunity', clamp(100 - s.citation + 20),
    'גודל הזדמנות הציטוט (היפוך לציטוט קיים).',
    [`Citation נוכחי ${s.citation}`], s.citation < 50 ? ['בנה Citation Opportunities'] : []);

  set('answer_simulation', clamp(foundRatio * 100),
    'תוצאת סימולציית תשובה — האם המותג היה מופיע עכשיו.',
    [`hit-rate ${Math.round(foundRatio * 100)}%`],
    foundRatio < 0.6 ? ['הרץ Answer Simulation לאיתור פערים פר-שאילתה'] : []);

  set('reputation_risk', clamp(100 - (foundRatio * 30) - s.brand * 0.4),
    'סיכון תדמיתי — נמוך = טוב. גבוה אם נוכחות/מותג חלשים.',
    [`Brand ${s.brand}`], ['הרץ AI Reputation Monitor לבדיקת דיוק התיאור']);

  set('content_roi', avg(out.geo_opportunity.value, 100 - s.contentDepth + 20),
    'תשואה צפויה מיצירת תוכן חדש.',
    [`Opportunity ${out.geo_opportunity.value}`, `Content gap headroom`], []);

  set('knowledge_gap', clamp(100 - s.entity),
    'מה AI לא יודע על המותג (היפוך כיסוי ישויות).',
    [`Entity coverage ${s.entity}`], s.entity < 60 ? ['הרץ AI Knowledge Gap Detector'] : []);

  set('entity_gap', clamp(100 - s.entity),
    'ישויות חסרות בעמודים/תחומים.', [`Entity ${s.entity}`], []);

  set('brand_entity_authority', avg(s.brand, s.entity),
    'חוזק הקשר מותג↔שירות/נושא/אדם/מיקום.',
    [`Brand ${s.brand}`, `Entity ${s.entity}`],
    avg(s.brand, s.entity) < 60 ? ['חזק קשרי מותג-שירות ב-Knowledge Graph'] : []);

  set('forecast_confidence', clamp(dataCompleteness),
    'רמת ביטחון בתחזית — תלוי בכמות הנתונים שנאספו.',
    [`שלמות נתונים ${Math.round(dataCompleteness)}%`],
    dataCompleteness < 75 ? ['השלם סריקות (עמודים/נראות/מתחרים) לדיוק תחזית'] : []);

  set('content_brief_priority', out.geo_opportunity.value,
    'עדיפות יצירת בריף תוכן.', [`GEO Opportunity ${out.geo_opportunity.value}`], []);

  set('brand_memory_growth', clamp(foundRatio * 100),
    'מגמת "זיכרון" המותג אצל מנועי AI לאורך זמן.',
    [`hit-rate נוכחי ${Math.round(foundRatio * 100)}%`], []);

  set('conversation_path_opportunity', clamp(40 + keywords.length * 3),
    'פוטנציאל מסעות שיחה (follow-up) לבניית אשכולות.',
    [`${keywords.length} ביטויי זרע`], ['הרץ Conversation Path Analyzer']);

  set('ai_query_opportunity', clamp(45 + keywords.length * 2 + gaps.length * 2),
    'פוטנציאל שאילתות AI חדשות לכיסוי.',
    [`${keywords.length} ביטויים`, `${gaps.length} פערים`], ['הרץ AI Query Discovery']);

  return out;
}
