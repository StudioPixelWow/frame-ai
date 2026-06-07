/**
 * GEO Authority Center — the canonical registry of the 15 authority modules.
 *
 * Each module maps to the existing engine(s)/route(s) that power it, plus the
 * sub-score it primarily drives. The UI renders these cards; the score engine
 * uses `subScore` to attribute issues. `resolveStatus` derives a live status
 * from the plan data so the user sees what's actually populated.
 */

export type SubScoreKey =
  | 'topical' | 'entity' | 'citation' | 'internalLinking' | 'brand'
  | 'schema' | 'contentDepth' | 'aiReadiness' | 'eeat';

export type ModuleStatus = 'ready' | 'partial' | 'empty';

export interface GeoModule {
  id: string;
  num: number;
  name: string;
  nameHe: string;
  icon: string;
  descHe: string;
  subScore: SubScoreKey;
  /** existing engine files / api routes that implement this module (for the audit) */
  engines: string[];
  /** POST action this module runs (handled by the authority route), if any */
  action?: string;
}

export const GEO_MODULES: GeoModule[] = [
  {
    id: 'content_authority', num: 1, name: 'GEO Content Authority Manager', nameHe: 'מנהל סמכות תוכן',
    icon: '🏛️', subScore: 'contentDepth',
    descHe: 'מזהה עמודים חלשים ומחזק FAQ, ישויות, E-E-A-T, סמנטיקה והרחבת תוכן.',
    engines: ['authority-reinforcement-engine.ts', 'geo-content-generator.ts', 'content-refresh-engine.ts'],
    action: 'content_authority',
  },
  {
    id: 'internal_linking', num: 2, name: 'Internal Linking Authority Agent', nameHe: 'סוכן קישורים פנימיים',
    icon: '🔗', subScore: 'internalLinking',
    descHe: 'מזהה עמודים מבודדים, עמודי כסף והזדמנויות לקישורים פנימיים עם Anchor מתאים.',
    engines: ['internal-linking-engine.ts'],
    action: 'internal_linking',
  },
  {
    id: 'citation_builder', num: 3, name: 'AI Citation Builder', nameHe: 'בונה ציטוטים ל-AI',
    icon: '📚', subScore: 'citation',
    descHe: 'מוסיף מקורות, מחקרים, נתונים וציטוטים כדי להפוך עמודים לבני-ציטוט במנועי AI.',
    engines: ['geo-authority/engines/citation-builder.ts (חדש)', 'eeat-engine.ts'],
    action: 'citation_builder',
  },
  {
    id: 'brand_mention', num: 4, name: 'Brand Mention Agent', nameHe: 'סוכן אזכורי מותג',
    icon: '🏷️', subScore: 'brand',
    descHe: 'בודק הופעת שם המותג/המומחה בהקשרים מקצועיים ומחזק את הקשר מותג↔שירותים.',
    engines: ['geo-authority/engines/brand-mention.ts (חדש)', 'authority-reinforcement-engine.ts'],
    action: 'brand_mention',
  },
  {
    id: 'faq_generator', num: 5, name: 'GEO FAQ Generator', nameHe: 'מחולל FAQ',
    icon: '❓', subScore: 'aiReadiness',
    descHe: 'יוצר שאלות ותשובות לפי כוונת חיפוש, People-Also-Ask ושאלות לקוח אמיתיות.',
    engines: ['faq-schema-engine.ts', 'generate-questions/route.ts'],
    action: 'faq_generator',
  },
  {
    id: 'entity_expansion', num: 6, name: 'Entity Expansion Agent', nameHe: 'סוכן הרחבת ישויות',
    icon: '🧩', subScore: 'entity',
    descHe: 'מזהה ומרחיב ישויות: אנשים, חברות, שירותים, ערים, מושגים ומונחים סמנטיים.',
    engines: ['semantic-entity-graph.ts', 'semantic-intelligence.ts'],
    action: 'entity_expansion',
  },
  {
    id: 'competitor_hunter', num: 7, name: 'Competitor Authority Hunter', nameHe: 'צייד סמכות מתחרים',
    icon: '🎯', subScore: 'topical',
    descHe: 'מזהה נושאים ושאלות שמתחרים מכסים ואנחנו לא, ומייצר המלצות לעמודים/מאמרים.',
    engines: ['competitor-engine.ts', '[planId]/competitors/route.ts'],
    action: 'competitor_hunter',
  },
  {
    id: 'content_gap', num: 8, name: 'GEO Content Gap Finder', nameHe: 'מאתר פערי תוכן',
    icon: '🕳️', subScore: 'topical',
    descHe: 'מזהה פערי תוכן מ-Google, שאלות AI, מתחרים ו-PAA ומייצר טיוטות לתוכן חסר.',
    engines: ['gap-analysis.ts', '[planId]/content-gaps/route.ts'],
    action: 'content_gap',
  },
  {
    id: 'semantic_optimizer', num: 9, name: 'Semantic SEO Optimizer', nameHe: 'אופטימייזר סמנטי',
    icon: '🔬', subScore: 'contentDepth',
    descHe: 'בודק כיסוי סמנטי, NLP, ישויות חסרות, מבנה כותרות ועומק תוכן לכל עמוד.',
    engines: ['semantic-intelligence.ts', 'hebrew-nlp.ts'],
    action: 'semantic_optimizer',
  },
  {
    id: 'knowledge_graph', num: 10, name: 'Knowledge Graph Builder', nameHe: 'בונה גרף ידע',
    icon: '🕸️', subScore: 'entity',
    descHe: 'בונה מפת ידע: מותג, שירותים, אנשי מפתח, אזורים וקשרים — כולל Schema מתאים.',
    engines: ['semantic-entity-graph.ts'],
    action: 'knowledge_graph',
  },
  {
    id: 'schema_automation', num: 11, name: 'Schema Automation Agent', nameHe: 'סוכן Schema אוטומטי',
    icon: '🏗️', subScore: 'schema',
    descHe: 'מוסיף Schema לפי סוג עמוד (Organization, LocalBusiness, FAQ, Service…) עם בדיקת תקינות.',
    engines: ['geo-authority/engines/schema-automation.ts (חדש)', 'faq-schema-engine.ts'],
    action: 'schema_automation',
  },
  {
    id: 'ai_answer_optimizer', num: 12, name: 'AI Answer Optimizer', nameHe: 'אופטימייזר תשובות AI',
    icon: '🤖', subScore: 'aiReadiness',
    descHe: 'בודק אם מנוע AI היה בוחר בעמוד כמקור, ומשפר מבנה תשובה, פסקאות, טבלאות ו-Summary.',
    engines: ['geo-visibility-optimizer.ts', 'geo-booster.ts'],
    action: 'ai_answer_optimizer',
  },
  {
    id: 'topical_authority', num: 13, name: 'Topical Authority Manager', nameHe: 'מנהל סמכות נושאית',
    icon: '📈', subScore: 'topical',
    descHe: 'בונה ומנהל Topic Clusters: עמוד אב, עמודי משנה, קישורים וציון סמכות לכל נושא.',
    engines: ['topic-cluster-builder.ts'],
    action: 'topical_authority',
  },
  {
    id: 'geo_monitoring', num: 14, name: 'GEO Monitoring Agent', nameHe: 'סוכן ניטור GEO',
    icon: '📡', subScore: 'aiReadiness',
    descHe: 'מנטר לאורך זמן אם המותג מופיע בתשובות AI, באילו שאלות, מול אילו מתחרים — דוח שבועי.',
    engines: ['visibility-engine.ts', 'serp-movement-monitor.ts', 'gsc-intelligence-engine.ts'],
    action: 'geo_monitoring',
  },
  {
    id: 'authority_score', num: 15, name: 'AI Authority Score Agent', nameHe: 'סוכן ציון סמכות',
    icon: '🏆', subScore: 'eeat',
    descHe: 'נותן ציון 0–100 לכל עמוד ולאתר לפי 8 ממדים, עם בעיות והמלצות פעולה.',
    engines: ['geo-authority/authority-score.ts (חדש)', 'strategic-scoring.ts'],
    action: 'recompute',
  },
];

export function getModule(id: string): GeoModule | undefined {
  return GEO_MODULES.find((m) => m.id === id);
}

/**
 * Derive a live status for each module from the plan, so the UI shows what's
 * actually populated vs. what still needs a run.
 */
export function resolveStatus(moduleId: string, plan: any): ModuleStatus {
  const has = (v: any) => Array.isArray(v) ? v.length > 0 : !!v;
  const scan = plan?.websiteScan;
  switch (moduleId) {
    case 'content_authority': return has(plan?.scannedPages) ? 'partial' : 'empty';
    case 'internal_linking': return has(plan?.scannedPages) ? 'partial' : 'empty';
    case 'citation_builder': return 'empty';
    case 'brand_mention': return has(scan) ? 'partial' : 'empty';
    case 'faq_generator': return has(plan?.aiKeywords) || has(plan?.clientKeywords) ? 'partial' : 'empty';
    case 'entity_expansion': return has(scan?.websiteFacts) ? 'partial' : 'empty';
    case 'competitor_hunter': return has(plan?.competitors) ? 'ready' : 'empty';
    case 'content_gap': return has(plan?.contentGaps) ? 'ready' : 'empty';
    case 'semantic_optimizer': return has(plan?.scannedPages) ? 'partial' : 'empty';
    case 'knowledge_graph': return has(scan?.websiteFacts) ? 'partial' : 'empty';
    case 'schema_automation': return has(scan) ? 'partial' : 'empty';
    case 'ai_answer_optimizer': return has(plan?.visibilityResults) ? 'partial' : 'empty';
    case 'topical_authority': return has(plan?.aiKeywords) ? 'partial' : 'empty';
    case 'geo_monitoring': return has(plan?.visibilityResults) ? 'ready' : 'empty';
    case 'authority_score': return 'ready';
    default: return 'empty';
  }
}
