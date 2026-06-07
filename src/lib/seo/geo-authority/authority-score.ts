/**
 * AI Authority Score engine (module #15).
 *
 * Computes a 0-100 authority score for a site (or page) from the REAL data
 * already captured on the SeoPlan (website scan, scanned pages, competitors,
 * content gaps, AI-visibility results, keywords, WordPress connection…), broken
 * into 8 weighted sub-scores. Each weak signal becomes an issue + a concrete,
 * module-attributed recommendation. Deterministic and quota-free (no AI call
 * required), so it always runs.
 */

import type { SubScoreKey } from './modules';

export interface AuthorityIssue {
  moduleId: string;
  subScore: SubScoreKey;
  severity: 'high' | 'medium' | 'low';
  text: string;
}

export interface AuthorityRecommendation {
  moduleId: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  relatedPage?: string;
  estimatedImpact: string;
}

export interface AuthorityResult {
  overall: number;
  subScores: Record<SubScoreKey, number>;
  issues: AuthorityIssue[];
  recommendations: AuthorityRecommendation[];
}

const WEIGHTS: Record<SubScoreKey, number> = {
  topical: 0.16,
  contentDepth: 0.14,
  aiReadiness: 0.16,
  entity: 0.12,
  internalLinking: 0.10,
  citation: 0.08,
  brand: 0.08,
  schema: 0.08,
  eeat: 0.08,
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const factVal = (f: any, k: string) => (f?.[k]?.value ?? f?.[k]);

export function computeAuthorityScore(plan: any): AuthorityResult {
  const scan = plan?.websiteScan || {};
  const facts = scan?.websiteFacts || {};
  const pages = arr(plan?.scannedPages);
  const competitors = arr(plan?.competitors);
  const gaps = arr(plan?.contentGaps);
  const vis = arr(plan?.visibilityResults).length ? arr(plan?.visibilityResults) : arr(plan?.baselineAiQueries);
  const keywords = [...arr(plan?.aiKeywords), ...arr(plan?.clientKeywords)];

  const issues: AuthorityIssue[] = [];
  const recs: AuthorityRecommendation[] = [];
  const add = (moduleId: string, subScore: SubScoreKey, severity: AuthorityIssue['severity'], text: string,
               rec: Omit<AuthorityRecommendation, 'moduleId'> | null) => {
    issues.push({ moduleId, subScore, severity, text });
    if (rec) recs.push({ moduleId, ...rec });
  };

  /* ── Topical authority: keyword coverage + clusters + competitor gaps ── */
  let topical = 30;
  topical += Math.min(40, keywords.length * 3);
  topical += Math.min(15, gaps.length * 0); // gaps reduce headroom but mean we know them
  if (keywords.length < 5) add('topical_authority', 'topical', 'high', 'כיסוי מילות מפתח נמוך — פחות מ-5 ביטויים מנוטרים.', {
    title: 'הרחב סל מילות מפתח ובנה Topic Clusters', description: 'הוסף ביטויי ליבה + עמודי אב/משנה כדי לבנות סמכות נושאית.', priority: 'high', estimatedImpact: '+12 Topical',
  });
  if (competitors.length === 0) add('competitor_hunter', 'topical', 'medium', 'לא נסרקו מתחרים — אין מיפוי נושאים שמתחרים מכסים ואנחנו לא.', {
    title: 'הרץ Competitor Authority Hunter', description: 'סרוק מתחרים כדי לאתר נושאים/שאלות שחסרים אצלנו.', priority: 'medium', estimatedImpact: '+8 Topical',
  });
  topical = clamp(topical);

  /* ── Content depth: avg word count of scanned pages ── */
  let contentDepth = 35;
  if (pages.length) {
    const wc = pages.map((p: any) => p.wordCount || p.words || (p.content ? String(p.content).split(/\s+/).length : 0));
    const avg = wc.reduce((a: number, b: number) => a + b, 0) / Math.max(1, wc.length);
    contentDepth = clamp(20 + Math.min(70, avg / 12)); // ~840 words → ~90
    const thin = pages.filter((p: any, i: number) => (wc[i] || 0) < 300);
    if (thin.length) add('content_authority', 'contentDepth', 'high', `${thin.length} עמודים דקים (פחות מ-300 מילים).`, {
      title: 'חזק עמודים דקים בתוכן מעמיק', description: 'הרחב את העמודים הדקים עם הסברים, דוגמאות, FAQ וישויות.', priority: 'high', relatedPage: thin[0]?.url, estimatedImpact: '+10 Content Depth',
    });
  } else {
    add('content_authority', 'contentDepth', 'medium', 'לא נסרקו עמודים — אין נתוני עומק תוכן.', {
      title: 'סרוק את עמודי האתר', description: 'הרץ סריקת אתר כדי למדוד עומק תוכן לכל עמוד.', priority: 'medium', estimatedImpact: '+15 Content Depth',
    });
  }

  /* ── AI readiness: AI-visibility hit-rate + FAQ presence ── */
  let aiReadiness = 25;
  if (vis.length) {
    const found = vis.filter((v: any) => v.found).length;
    aiReadiness = clamp(15 + (found / vis.length) * 80);
    if (found / vis.length < 0.4) add('ai_answer_optimizer', 'aiReadiness', 'high', `המותג מופיע רק ב-${found}/${vis.length} משאילתות ה-AI.`, {
      title: 'שפר מבנה תשובה לעמודי מפתח', description: 'הוסף הגדרות ברורות, פסקאות קצרות, טבלאות ו-Summary בני-שליפה.', priority: 'high', estimatedImpact: '+14 AI Readiness',
    });
  } else {
    add('geo_monitoring', 'aiReadiness', 'high', 'אין תוצאות נראות AI — לא ידוע אם המותג מצוטט.', {
      title: 'הרץ סריקת נראות AI', description: 'בדוק אם המותג מופיע בתשובות ChatGPT/Perplexity/Google AI.', priority: 'high', estimatedImpact: '+18 AI Readiness',
    });
  }

  /* ── Entity coverage: detected facts + entity richness ── */
  let entity = 30;
  if (factVal(facts, 'detected_industry')) entity += 15;
  if (factVal(facts, 'detected_location')) entity += 15;
  if (arr(scan?.entities).length || arr(facts?.entities).length) entity += 25;
  entity = clamp(entity);
  if (entity < 60) add('entity_expansion', 'entity', 'medium', 'כיסוי ישויות חלקי — חסרים אנשים/שירותים/מונחים מקושרים.', {
    title: 'הרחב ישויות ובנה גרף ידע', description: 'הוסף ישויות מקצועיות (אנשים, שירותים, ערים, מונחים) וקשר ביניהן.', priority: 'medium', estimatedImpact: '+10 Entity',
  });

  /* ── Internal linking ── */
  let internalLinking = 30;
  if (pages.length) {
    const linked = pages.filter((p: any) => (p.internalLinks || p.outlinks || 0) > 0).length;
    const orphans = pages.length - linked;
    internalLinking = clamp(25 + (linked / pages.length) * 70);
    if (orphans > 0) add('internal_linking', 'internalLinking', 'medium', `${orphans} עמודים מבודדים (ללא קישורים פנימיים).`, {
      title: 'הוסף קישורים פנימיים לעמודים מבודדים', description: 'חבר עמודי יתום לעמודי כסף עם Anchor Text מתאים.', priority: 'medium', relatedPage: (pages.find((p: any) => !(p.internalLinks || p.outlinks)) || {}).url, estimatedImpact: '+9 Internal Linking',
    });
  } else {
    internalLinking = 35;
  }

  /* ── Citation potential (external sources / references) ── */
  let citation = 25;
  const withSources = pages.filter((p: any) => (p.externalLinks || p.references || 0) > 0).length;
  if (pages.length) citation = clamp(20 + (withSources / pages.length) * 60);
  add('citation_builder', 'citation', citation < 50 ? 'medium' : 'low', 'מעט מקורות/ציטוטים חיצוניים — פוגע בבר-ציטוטיות במנועי AI.', {
    title: 'הוסף מקורות, נתונים וציטוטים', description: 'שבץ מחקרים, נתונים ו-References אמינים בעמודי מפתח.', priority: citation < 50 ? 'medium' : 'low', estimatedImpact: '+8 Citation',
  });

  /* ── Brand presence ── */
  let brand = 40;
  const brandName = plan?.clientName || plan?.businessProfile?.businessName;
  if (brandName && JSON.stringify(scan).includes(brandName)) brand += 30;
  brand = clamp(brand);
  if (brand < 60) add('brand_mention', 'brand', 'medium', 'נוכחות מותג חלשה בהקשרים מקצועיים באתר.', {
    title: 'חזק אזכורי מותג טבעיים', description: 'שלב את שם המותג/המומחה בהקשרי שירות לאורך העמודים, באופן אחיד.', priority: 'medium', estimatedImpact: '+7 Brand',
  });

  /* ── Schema ── */
  const hasSchema = factVal(facts, 'has_schema');
  let schema = hasSchema ? 70 : 25;
  if (!hasSchema) add('schema_automation', 'schema', 'high', 'לא זוהה Schema באתר — נתונים מובנים חסרים.', {
    title: 'הוסף Schema אוטומטי לפי סוג עמוד', description: 'צור Organization/LocalBusiness/FAQ/Service JSON-LD עם בדיקת תקינות.', priority: 'high', estimatedImpact: '+12 Schema',
  });
  schema = clamp(schema);

  /* ── E-E-A-T ── */
  let eeat = 30;
  if (factVal(facts, 'has_ssl')) eeat += 15;
  if (factVal(facts, 'has_sitemap')) eeat += 10;
  if (factVal(facts, 'has_author') || factVal(facts, 'has_about')) eeat += 20;
  if (hasSchema) eeat += 10;
  eeat = clamp(eeat);
  if (eeat < 60) add('authority_score', 'eeat', 'medium', 'אותות E-E-A-T חלקיים (מחבר/תאריכים/אודות/Schema).', {
    title: 'חזק אותות E-E-A-T', description: 'הוסף מחבר+ביו, תאריכי פרסום/עדכון גלויים, עמוד אודות ו-Schema.', priority: 'medium', estimatedImpact: '+8 E-E-A-T',
  });

  const subScores: Record<SubScoreKey, number> = {
    topical, contentDepth, aiReadiness, entity, internalLinking, citation, brand, schema, eeat,
  };

  let overall = 0;
  for (const k of Object.keys(WEIGHTS) as SubScoreKey[]) overall += subScores[k] * WEIGHTS[k];
  overall = clamp(overall);

  // Sort recommendations by priority for a sensible action order.
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => rank[a.priority] - rank[b.priority]);

  return { overall, subScores, issues, recommendations: recs };
}

export const SUB_SCORE_LABELS: Record<SubScoreKey, string> = {
  topical: 'Topical Authority',
  contentDepth: 'Content Depth',
  aiReadiness: 'AI Readiness',
  entity: 'Entity Coverage',
  internalLinking: 'Internal Linking',
  citation: 'Citation Potential',
  brand: 'Brand Presence',
  schema: 'Schema Quality',
  eeat: 'E-E-A-T',
};
