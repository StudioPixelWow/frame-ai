/**
 * Advanced GEO Growth Center — registry of the 25 advanced modules. Each maps to
 * either a new engine `action`, a derived `scoreKey`, or an existing module it
 * extends (`extends`). `resolveAdvStatus` derives a live status from stored data.
 */

export type AdvStatus = 'ready' | 'partial' | 'empty';

export interface AdvModule {
  id: string; num: number; nameHe: string; name: string; icon: string; descHe: string;
  tab: string;            // which UI tab it lives under
  action?: string;        // engine action (run_*)
  scoreKey?: string;      // score it primarily produces
  extends?: string;       // existing module/engine it extends (no duplication)
  table?: string;         // first-class result table
}

export const ADV_MODULES: AdvModule[] = [
  { id: 'query_discovery', num: 1, nameHe: 'AI Query Discovery', name: 'AI Query Discovery Engine', icon: '🔍', tab: 'queries', action: 'query_discovery', scoreKey: 'ai_query_opportunity', table: 'geo_query_discovery_sets', extends: 'generate-questions', descHe: 'מייצר שאילתות AI אמיתיות (שיחה/בעיה/השוואה/המלצה/לוקאלי/לונג-טייל) עם שיוך לנושא, עמוד יעד, עדיפות, מדינה ושפה.' },
  { id: 'competitor_reverse', num: 2, nameHe: 'Competitor Reverse Engineering', name: 'GEO Competitor Reverse Engineering', icon: '🛠️', tab: 'competitors', scoreKey: 'competitor_weakness', extends: 'competitor-engine.ts', descHe: 'מנתח למה מתחרים מצוטטים: FAQ, ישויות, Schema, ציטוטים, מבנה עמוד, עמודים מצוטטים, פערי סמכות.' },
  { id: 'citation_opportunity', num: 3, nameHe: 'Citation Opportunity Finder', name: 'AI Citation Opportunity Finder', icon: '📑', tab: 'citations', action: 'citation_opportunity', scoreKey: 'citation_opportunity', table: 'geo_citation_opportunities', descHe: 'מזהה Citation Gaps והזדמנויות עם הסתברות ציטוט, סוג מקור ועמודי מתחרים מצוטטים.' },
  { id: 'answer_simulation', num: 4, nameHe: 'AI Answer Simulation', name: 'AI Answer Simulation', icon: '🧪', tab: 'simulations', action: 'answer_simulation', scoreKey: 'answer_simulation', table: 'geo_answer_simulations', descHe: 'מדמה: אם ChatGPT/Claude/Gemini/Perplexity היו עונים עכשיו — האם המותג היה מופיע, מי הופיע במקום, ומה חסר.' },
  { id: 'gsc_overlay', num: 5, nameHe: 'Search Console + AI Overlay', name: 'Search Console + AI Overlay', icon: '📊', tab: 'overview', scoreKey: 'ai_influence', extends: 'gsc-real-service.ts', descHe: 'מאחד GSC (Impressions/Clicks/Position) עם נראות AI ל-Share of AI Voice ו-Combined Opportunity Score.' },
  { id: 'reputation_monitor', num: 6, nameHe: 'AI Reputation Monitor', name: 'AI Reputation Monitor', icon: '🛡️', tab: 'reputation', action: 'reputation_monitor', scoreKey: 'reputation_risk', table: 'geo_reputation_checks', descHe: 'בודק כיצד AI מתאר את המותג: דיוק, מידע שגוי, מומחיות חסרה, הטיה, סיכון תדמיתי וטון.' },
  { id: 'content_roi', num: 7, nameHe: 'Content ROI Predictor', name: 'GEO Content ROI Predictor', icon: '💰', tab: 'opportunities', scoreKey: 'content_roi', descHe: 'מעריך לפני יצירה: GEO impact, צמיחת נראות, פוטנציאל ציטוט/לידים, קושי וזמן להשפעה.' },
  { id: 'knowledge_gap', num: 8, nameHe: 'AI Knowledge Gap Detector', name: 'AI Knowledge Gap Detector', icon: '🧠', tab: 'reputation', scoreKey: 'knowledge_gap', extends: 'semantic-entity-graph.ts', descHe: 'מה AI לא יודע/מבלבל על המותג: שירותים, תחומים, מיקומים ומומחים שלא מזוהים.' },
  { id: 'brand_entity_authority', num: 9, nameHe: 'Brand Entity Authority', name: 'Brand Entity Authority Engine', icon: '🔗', tab: 'entity', scoreKey: 'brand_entity_authority', extends: 'knowledge_graph', descHe: 'מודד חוזק קשר מותג↔שירות/נושא/אדם/מיקום (למשל עו"ד ↔ מס שבח) עם קשרים חזקים/חלשים/חסרים.' },
  { id: 'ai_recommendation_score', num: 10, nameHe: 'AI Recommendation Score', name: 'AI Recommendation Score', icon: '⭐', tab: 'overview', scoreKey: 'ai_recommendation', extends: 'visibility-engine.ts', descHe: 'לא רק אזכור — כמה AI ממליץ: mention→neutral→recommended→strongly→top, ציון 0–100.' },
  { id: 'ai_trust_score', num: 11, nameHe: 'AI Trust Score', name: 'AI Trust Score', icon: '🤝', tab: 'overview', scoreKey: 'ai_trust', descHe: 'אמון מנועי AI: אזכורים, ציטוטים, איכות מקורות, ישויות, Schema, E-E-A-T, עומק תוכן, אחידות מותג.' },
  { id: 'entity_gap', num: 12, nameHe: 'Entity Gap Finder', name: 'Entity Gap Finder', icon: '🧩', tab: 'entity', scoreKey: 'entity_gap', extends: 'entity_expansion', descHe: 'ישויות חסרות בכל עמוד/תחום: חוקים, אנשים, מוסדות, מושגים, ערים, תתי-תחומים.' },
  { id: 'citation_probability', num: 13, nameHe: 'Citation Probability Score', name: 'Citation Probability Score', icon: '🎲', tab: 'citations', scoreKey: 'citation_probability', extends: 'citation_builder', descHe: 'הסתברות שעמוד יהפוך למקור מצוטט: מבנה, עומק, מקורות, Schema, FAQ, בהירות, סמכות דומיין.' },
  { id: 'featured_source', num: 14, nameHe: 'Featured Source Detector', name: 'AI Featured Source Detector', icon: '🏅', tab: 'simulations', scoreKey: 'featured_source', descHe: 'מבדיל mention / citation / featured / primary / supporting source לכל שאילתה.' },
  { id: 'opportunity_engine', num: 15, nameHe: 'GEO Opportunity Engine', name: 'GEO Opportunity Engine', icon: '🚀', tab: 'opportunities', action: 'opportunity_engine', scoreKey: 'geo_opportunity', table: 'geo_opportunities', extends: 'opportunity-priority-engine.ts', descHe: 'Top הזדמנויות לפי ROI/קושי/ביקוש: Quick Wins, אסטרטגי, High-Effort, Lost.' },
  { id: 'action_center', num: 16, nameHe: 'GEO Action Center', name: 'GEO Action Center', icon: '🎯', tab: 'actions', extends: 'geo_tasks', descHe: 'מרכז משימות אחד: המלצות, עדיפות, סטטוס, impact/effort, עמוד/שאילתה/נושא/מתחרה, אישור.' },
  { id: 'roadmap', num: 17, nameHe: 'GEO Roadmap Generator', name: 'GEO Roadmap Generator', icon: '🗺️', tab: 'roadmap', action: 'roadmap', table: 'geo_roadmaps', extends: 'plan-generator.ts', descHe: 'תוכנית עבודה 30/60/90/180 יום לפי הזדמנויות, פערים, קושי והשפעה.' },
  { id: 'market_share', num: 18, nameHe: 'AI Market Share', name: 'AI Market Share Dashboard', icon: '📈', tab: 'overview', scoreKey: 'ai_influence', extends: 'visibility-engine.ts', descHe: 'Share of AI Voice לפי נושא/שירות/עיר/מדינה/מנוע/מתחרה/חודש.' },
  { id: 'source_network', num: 19, nameHe: 'AI Source Network Map', name: 'AI Source Network Map', icon: '🕸️', tab: 'citations', table: 'geo_source_network_nodes', descHe: 'מפה: מי מצטט את מי — מקורות ממשלתיים, תוכן, מתחרים, האתר שלנו, צד ג׳.' },
  { id: 'ai_influence', num: 20, nameHe: 'AI Influence Score', name: 'AI Influence Score', icon: '💥', tab: 'overview', scoreKey: 'ai_influence', descHe: 'כמה המותג משפיע על תשובות AI: אזכורים, ציטוטים, מקור ראשי, הופעה לפני מתחרים.' },
  { id: 'forecast', num: 21, nameHe: 'GEO Forecast Engine', name: 'GEO Forecast Engine', icon: '🔮', tab: 'forecast', action: 'forecast', scoreKey: 'forecast_confidence', table: 'geo_forecasts', descHe: 'תחזית 30/60/90: צמיחת נראות, אזכורים, ציטוטים, ציון סמכות + רמת ביטחון והנחות.' },
  { id: 'content_brief', num: 22, nameHe: 'AI Content Brief Generator', name: 'AI Content Brief Generator', icon: '📝', tab: 'briefs', action: 'content_brief', scoreKey: 'content_brief_priority', table: 'geo_content_briefs', descHe: 'בריף מלא: H1/H2/H3, Meta, FAQ, ישויות, ציטוטים, קישורים, Schema, שאילתות יעד, טון, אורך, E-E-A-T.' },
  { id: 'content_validator', num: 23, nameHe: 'AI Content Validator', name: 'AI Content Validator', icon: '✅', tab: 'validator', action: 'content_validator', scoreKey: 'content_validation', table: 'geo_content_validations', extends: 'validation-gate.ts', descHe: 'בדיקה לפני פרסום: ציטוטים, ישויות, AI readiness, Schema, קישורים, FAQ, מותג, בהירות, עומק, כפילות.' },
  { id: 'brand_memory', num: 24, nameHe: 'AI Brand Memory Tracker', name: 'AI Brand Memory Tracker', icon: '🧬', tab: 'overview', scoreKey: 'brand_memory_growth', table: 'geo_brand_memory_snapshots', descHe: 'מעקב לאורך זמן אם AI "לומד" את המותג: אזכורים, נושאים מקושרים, צמיחת ציטוטים, דחיקת מתחרים.' },
  { id: 'conversation_paths', num: 25, nameHe: 'Conversation Path Analyzer', name: 'AI Conversation Path Analyzer', icon: '🧭', tab: 'queries', action: 'conversation_paths', scoreKey: 'conversation_path_opportunity', table: 'geo_conversation_paths', descHe: 'מנתח שרשרת שאלות (follow-up) → מסעות, אשכולות, עמודים חסרים, קישור פנימי, מיפוי פאנל.' },
];

export const ADV_TABS: { id: string; label: string; icon: string }[] = [
  { id: 'overview', label: 'סקירה', icon: '📊' },
  { id: 'opportunities', label: 'הזדמנויות', icon: '🚀' },
  { id: 'queries', label: 'שאילתות AI', icon: '🔍' },
  { id: 'competitors', label: 'מתחרים', icon: '🛠️' },
  { id: 'citations', label: 'ציטוטים', icon: '📑' },
  { id: 'simulations', label: 'סימולציות', icon: '🧪' },
  { id: 'reputation', label: 'מוניטין', icon: '🛡️' },
  { id: 'entity', label: 'ישויות', icon: '🧩' },
  { id: 'forecast', label: 'תחזית', icon: '🔮' },
  { id: 'roadmap', label: 'Roadmap', icon: '🗺️' },
  { id: 'actions', label: 'Action Center', icon: '🎯' },
  { id: 'briefs', label: 'בריפים', icon: '📝' },
  { id: 'validator', label: 'ולידציה', icon: '✅' },
];

export function getAdvModule(id: string) { return ADV_MODULES.find((m) => m.id === id); }

export function resolveAdvStatus(m: AdvModule, data: { tables: Record<string, number>; scores: Record<string, any> }): AdvStatus {
  if (m.table && data.tables[m.table] > 0) return 'ready';
  if (m.scoreKey && data.scores[m.scoreKey]) return 'partial';
  return m.extends ? 'partial' : 'empty';
}
