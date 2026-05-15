/**
 * Israeli Paid Ads Benchmarks
 * Industry-specific CPC, CPM, CTR, CPL data for Israeli market across Meta, Google, TikTok
 * Data sourced from industry averages — update quarterly
 */

// ===== Types =====

export interface IndustryBenchmark {
  industry: string;
  industryHebrew: string;
  platforms: {
    meta: PlatformMetrics;
    google: PlatformMetrics;
    tiktok: PlatformMetrics;
  };
}

export interface PlatformMetrics {
  avgCPC: number;        // ₪ — Average Cost Per Click
  avgCPM: number;        // ₪ — Average Cost Per 1000 Impressions
  avgCTR: number;        // % — Average Click-Through Rate
  avgCPL: number;        // ₪ — Average Cost Per Lead
  avgConversionRate: number; // % — Landing page conversion rate
  minDailyBudget: number;   // ₪ — Recommended minimum daily budget
}

export interface SeasonalModifier {
  month: number;
  label: string;
  labelHebrew: string;
  modifier: number; // Multiplier: 1.0 = baseline, 1.3 = 30% higher costs
  note: string;
}

// ===== Israeli Industry Benchmarks =====

export const ISRAELI_BENCHMARKS: IndustryBenchmark[] = [
  {
    industry: 'ecommerce',
    industryHebrew: 'מסחר אלקטרוני',
    platforms: {
      meta: { avgCPC: 2.80, avgCPM: 42, avgCTR: 1.2, avgCPL: 35, avgConversionRate: 3.5, minDailyBudget: 80 },
      google: { avgCPC: 3.50, avgCPM: 55, avgCTR: 3.8, avgCPL: 28, avgConversionRate: 4.2, minDailyBudget: 100 },
      tiktok: { avgCPC: 1.80, avgCPM: 28, avgCTR: 0.9, avgCPL: 45, avgConversionRate: 2.0, minDailyBudget: 60 },
    },
  },
  {
    industry: 'real_estate',
    industryHebrew: 'נדל"ן',
    platforms: {
      meta: { avgCPC: 4.50, avgCPM: 65, avgCTR: 0.8, avgCPL: 85, avgConversionRate: 2.0, minDailyBudget: 150 },
      google: { avgCPC: 8.00, avgCPM: 90, avgCTR: 4.5, avgCPL: 120, avgConversionRate: 3.0, minDailyBudget: 200 },
      tiktok: { avgCPC: 2.50, avgCPM: 35, avgCTR: 0.6, avgCPL: 95, avgConversionRate: 1.2, minDailyBudget: 80 },
    },
  },
  {
    industry: 'saas_tech',
    industryHebrew: 'טכנולוגיה / SaaS',
    platforms: {
      meta: { avgCPC: 5.20, avgCPM: 72, avgCTR: 0.7, avgCPL: 110, avgConversionRate: 2.5, minDailyBudget: 120 },
      google: { avgCPC: 12.00, avgCPM: 110, avgCTR: 3.2, avgCPL: 150, avgConversionRate: 3.8, minDailyBudget: 250 },
      tiktok: { avgCPC: 3.00, avgCPM: 40, avgCTR: 0.5, avgCPL: 130, avgConversionRate: 1.0, minDailyBudget: 100 },
    },
  },
  {
    industry: 'healthcare',
    industryHebrew: 'בריאות ורפואה',
    platforms: {
      meta: { avgCPC: 3.80, avgCPM: 55, avgCTR: 0.9, avgCPL: 65, avgConversionRate: 2.8, minDailyBudget: 100 },
      google: { avgCPC: 6.50, avgCPM: 80, avgCTR: 4.0, avgCPL: 55, avgConversionRate: 4.5, minDailyBudget: 150 },
      tiktok: { avgCPC: 2.20, avgCPM: 32, avgCTR: 0.7, avgCPL: 75, avgConversionRate: 1.5, minDailyBudget: 70 },
    },
  },
  {
    industry: 'education',
    industryHebrew: 'חינוך והכשרה',
    platforms: {
      meta: { avgCPC: 2.50, avgCPM: 38, avgCTR: 1.1, avgCPL: 40, avgConversionRate: 3.2, minDailyBudget: 70 },
      google: { avgCPC: 4.00, avgCPM: 60, avgCTR: 3.5, avgCPL: 45, avgConversionRate: 3.8, minDailyBudget: 100 },
      tiktok: { avgCPC: 1.50, avgCPM: 25, avgCTR: 1.0, avgCPL: 50, avgConversionRate: 2.2, minDailyBudget: 50 },
    },
  },
  {
    industry: 'restaurants_food',
    industryHebrew: 'מסעדות ומזון',
    platforms: {
      meta: { avgCPC: 1.80, avgCPM: 30, avgCTR: 1.5, avgCPL: 25, avgConversionRate: 4.0, minDailyBudget: 50 },
      google: { avgCPC: 2.80, avgCPM: 45, avgCTR: 5.0, avgCPL: 20, avgConversionRate: 5.5, minDailyBudget: 60 },
      tiktok: { avgCPC: 1.20, avgCPM: 20, avgCTR: 1.8, avgCPL: 30, avgConversionRate: 2.5, minDailyBudget: 40 },
    },
  },
  {
    industry: 'legal',
    industryHebrew: 'עורכי דין ומשפט',
    platforms: {
      meta: { avgCPC: 6.00, avgCPM: 78, avgCTR: 0.6, avgCPL: 120, avgConversionRate: 2.0, minDailyBudget: 150 },
      google: { avgCPC: 15.00, avgCPM: 130, avgCTR: 3.0, avgCPL: 180, avgConversionRate: 3.5, minDailyBudget: 300 },
      tiktok: { avgCPC: 3.50, avgCPM: 45, avgCTR: 0.4, avgCPL: 150, avgConversionRate: 0.8, minDailyBudget: 100 },
    },
  },
  {
    industry: 'beauty_cosmetics',
    industryHebrew: 'יופי וקוסמטיקה',
    platforms: {
      meta: { avgCPC: 2.00, avgCPM: 35, avgCTR: 1.4, avgCPL: 30, avgConversionRate: 3.8, minDailyBudget: 60 },
      google: { avgCPC: 3.20, avgCPM: 50, avgCTR: 4.2, avgCPL: 35, avgConversionRate: 4.0, minDailyBudget: 80 },
      tiktok: { avgCPC: 1.00, avgCPM: 18, avgCTR: 2.0, avgCPL: 28, avgConversionRate: 3.0, minDailyBudget: 40 },
    },
  },
  {
    industry: 'fitness_wellness',
    industryHebrew: 'כושר ובריאות',
    platforms: {
      meta: { avgCPC: 2.30, avgCPM: 38, avgCTR: 1.3, avgCPL: 35, avgConversionRate: 3.5, minDailyBudget: 60 },
      google: { avgCPC: 3.80, avgCPM: 55, avgCTR: 4.0, avgCPL: 40, avgConversionRate: 4.2, minDailyBudget: 90 },
      tiktok: { avgCPC: 1.30, avgCPM: 22, avgCTR: 1.6, avgCPL: 35, avgConversionRate: 2.5, minDailyBudget: 45 },
    },
  },
  {
    industry: 'automotive',
    industryHebrew: 'רכב',
    platforms: {
      meta: { avgCPC: 3.50, avgCPM: 52, avgCTR: 0.9, avgCPL: 75, avgConversionRate: 2.2, minDailyBudget: 120 },
      google: { avgCPC: 7.00, avgCPM: 85, avgCTR: 3.8, avgCPL: 90, avgConversionRate: 3.5, minDailyBudget: 180 },
      tiktok: { avgCPC: 2.00, avgCPM: 30, avgCTR: 0.8, avgCPL: 80, avgConversionRate: 1.5, minDailyBudget: 70 },
    },
  },
];

// ===== Seasonal Modifiers (Israeli Market) =====

export const SEASONAL_MODIFIERS: SeasonalModifier[] = [
  { month: 1, label: 'January', labelHebrew: 'ינואר', modifier: 0.85, note: 'אחרי חגים — תקציבים נמוכים, תחרות נמוכה' },
  { month: 2, label: 'February', labelHebrew: 'פברואר', modifier: 0.90, note: 'עונה שקטה — הזדמנות לעלויות נמוכות' },
  { month: 3, label: 'March', labelHebrew: 'מרץ', modifier: 1.10, note: 'לפני פסח — עליית ביקוש' },
  { month: 4, label: 'April', labelHebrew: 'אפריל', modifier: 1.25, note: 'פסח + חופשות — תחרות גבוהה בקמעונאות' },
  { month: 5, label: 'May', labelHebrew: 'מאי', modifier: 1.05, note: 'יום העצמאות + ל"ג בעומר' },
  { month: 6, label: 'June', labelHebrew: 'יוני', modifier: 1.15, note: 'תחילת קיץ — עלייה בתיירות וקמעונאות' },
  { month: 7, label: 'July', labelHebrew: 'יולי', modifier: 1.10, note: 'חופש גדול — ביקוש בבילוי ומזון' },
  { month: 8, label: 'August', labelHebrew: 'אוגוסט', modifier: 1.15, note: 'חזרה ללימודים — ביקוש בחינוך וקניות' },
  { month: 9, label: 'September', labelHebrew: 'ספטמבר', modifier: 1.35, note: 'ראש השנה — שיא התחרות' },
  { month: 10, label: 'October', labelHebrew: 'אוקטובר', modifier: 1.20, note: 'סוכות + שמחת תורה — ביקוש גבוה' },
  { month: 11, label: 'November', labelHebrew: 'נובמבר', modifier: 1.30, note: 'Black Friday — שיא מסחר אלקטרוני' },
  { month: 12, label: 'December', labelHebrew: 'דצמבר', modifier: 1.10, note: 'חנוכה — ביקוש במתנות ובילוי' },
];

// ===== Israeli Ad Regulations =====

export const ISRAELI_AD_REGULATIONS = {
  generalRules: [
    { rule: 'חובת סימון פרסומת', description: 'כל פרסומת חייבת להיות מזוהה כפרסומת בצורה ברורה', law: 'חוק הגנת הצרכן' },
    { rule: 'איסור פרסומת מטעה', description: 'אסור לפרסם מידע שקרי או מטעה על מוצר או שירות', law: 'חוק הגנת הצרכן, סעיף 2' },
    { rule: 'איסור ספאם', description: 'שליחת הודעות פרסומיות רק למי שנתן הסכמה מפורשת', law: 'תיקון 40 לחוק התקשורת' },
    { rule: 'הגנת פרטיות', description: 'שימוש במידע אישי למטרות פרסום דורש הסכמה', law: 'חוק הגנת הפרטיות' },
    { rule: 'פרסום אלכוהול', description: 'אסור לפרסם משקאות אלכוהוליים לקטינים', law: 'חוק הגבלת הפרסומת של אלכוהול' },
    { rule: 'פרסום תרופות', description: 'פרסום תרופות מרשם אסור לציבור הרחב', law: 'פקודת הרוקחים' },
    { rule: 'פרסום מזון', description: 'חובת סימון תזונתי בפרסום מוצרי מזון', law: 'תקנות הגנת הצרכן' },
  ],
  platformSpecific: {
    meta: [
      'חובת סימון "ממומן" בכל פוסט פרסומי',
      'אסור targeting לפי מוצא אתני, דת או מגדר בנושאי דיור ותעסוקה',
      'מגבלת 20% טקסט בתמונות פרסומיות (בוטל אך עדיין משפיע על הגעה)',
    ],
    google: [
      'חובת ציון "מודעה" בתוצאות חיפוש',
      'הגבלות על מילות מפתח רפואיות ומשפטיות',
      'חובת דף נחיתה תואם לתוכן המודעה',
    ],
    tiktok: [
      'חובת סימון תוכן ממומן בפורמט ברור',
      'אסור פרסום לקטינים מתחת לגיל 13',
      'הגבלות על תוכן שמעודד התנהגות מסוכנת',
    ],
  },
  vatRate: 0.18,
  currency: 'ILS',
  currencySymbol: '₪',
};

// ===== Benchmark Comparison Engine =====

export interface BenchmarkComparison {
  metric: string;
  metricHebrew: string;
  actual: number;
  benchmark: number;
  difference: number;
  percentDiff: number;
  status: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  statusHebrew: string;
  suggestion: string;
}

/**
 * Compare actual campaign metrics against Israeli benchmarks
 */
export function compareToIsraeliBenchmarks(
  industry: string,
  platform: 'meta' | 'google' | 'tiktok',
  actual: { cpc?: number; cpm?: number; ctr?: number; cpl?: number; conversionRate?: number }
): BenchmarkComparison[] {
  const benchmark = ISRAELI_BENCHMARKS.find(b => b.industry === industry);
  if (!benchmark) return [];

  const platformMetrics = benchmark.platforms[platform];
  const results: BenchmarkComparison[] = [];

  const statusLabels: Record<string, string> = {
    excellent: 'מצוין',
    good: 'טוב',
    average: 'ממוצע',
    below_average: 'מתחת לממוצע',
    poor: 'חלש',
  };

  // CPC — lower is better
  if (actual.cpc !== undefined) {
    const diff = actual.cpc - platformMetrics.avgCPC;
    const pctDiff = (diff / platformMetrics.avgCPC) * 100;
    const status = pctDiff <= -20 ? 'excellent' : pctDiff <= -5 ? 'good' : pctDiff <= 10 ? 'average' : pctDiff <= 25 ? 'below_average' : 'poor';
    results.push({
      metric: 'CPC', metricHebrew: 'עלות לקליק',
      actual: actual.cpc, benchmark: platformMetrics.avgCPC,
      difference: diff, percentDiff: pctDiff,
      status, statusHebrew: statusLabels[status],
      suggestion: status === 'poor' ? 'מומלץ לשפר את הטרגוט או לשנות את הקריאייטיב' : '',
    });
  }

  // CTR — higher is better
  if (actual.ctr !== undefined) {
    const diff = actual.ctr - platformMetrics.avgCTR;
    const pctDiff = (diff / platformMetrics.avgCTR) * 100;
    const status = pctDiff >= 20 ? 'excellent' : pctDiff >= 5 ? 'good' : pctDiff >= -10 ? 'average' : pctDiff >= -25 ? 'below_average' : 'poor';
    results.push({
      metric: 'CTR', metricHebrew: 'אחוז הקלקה',
      actual: actual.ctr, benchmark: platformMetrics.avgCTR,
      difference: diff, percentDiff: pctDiff,
      status, statusHebrew: statusLabels[status],
      suggestion: status === 'poor' ? 'מומלץ לבדוק את הכותרות ואת התמונות — אולי לא מספיק מושכות' : '',
    });
  }

  // CPM — lower is better
  if (actual.cpm !== undefined) {
    const diff = actual.cpm - platformMetrics.avgCPM;
    const pctDiff = (diff / platformMetrics.avgCPM) * 100;
    const status = pctDiff <= -20 ? 'excellent' : pctDiff <= -5 ? 'good' : pctDiff <= 10 ? 'average' : pctDiff <= 25 ? 'below_average' : 'poor';
    results.push({
      metric: 'CPM', metricHebrew: 'עלות ל-1000 חשיפות',
      actual: actual.cpm, benchmark: platformMetrics.avgCPM,
      difference: diff, percentDiff: pctDiff,
      status, statusHebrew: statusLabels[status],
      suggestion: status === 'poor' ? 'ייתכן שהקהל צר מדי — נסה להרחיב את הטרגוט' : '',
    });
  }

  // CPL — lower is better
  if (actual.cpl !== undefined) {
    const diff = actual.cpl - platformMetrics.avgCPL;
    const pctDiff = (diff / platformMetrics.avgCPL) * 100;
    const status = pctDiff <= -20 ? 'excellent' : pctDiff <= -5 ? 'good' : pctDiff <= 10 ? 'average' : pctDiff <= 25 ? 'below_average' : 'poor';
    results.push({
      metric: 'CPL', metricHebrew: 'עלות לליד',
      actual: actual.cpl, benchmark: platformMetrics.avgCPL,
      difference: diff, percentDiff: pctDiff,
      status, statusHebrew: statusLabels[status],
      suggestion: status === 'poor' ? 'מומלץ לבדוק את דף הנחיתה ואת התאמת המסר לקהל היעד' : '',
    });
  }

  // Conversion Rate — higher is better
  if (actual.conversionRate !== undefined) {
    const diff = actual.conversionRate - platformMetrics.avgConversionRate;
    const pctDiff = (diff / platformMetrics.avgConversionRate) * 100;
    const status = pctDiff >= 20 ? 'excellent' : pctDiff >= 5 ? 'good' : pctDiff >= -10 ? 'average' : pctDiff >= -25 ? 'below_average' : 'poor';
    results.push({
      metric: 'Conversion Rate', metricHebrew: 'אחוז המרה',
      actual: actual.conversionRate, benchmark: platformMetrics.avgConversionRate,
      difference: diff, percentDiff: pctDiff,
      status, statusHebrew: statusLabels[status],
      suggestion: status === 'poor' ? 'בדוק את חווית דף הנחיתה — מהירות טעינה, CTA ברור, טופס קצר' : '',
    });
  }

  return results;
}

/**
 * Get seasonal cost modifier for current month
 */
export function getSeasonalModifier(month?: number): SeasonalModifier {
  const m = month || new Date().getMonth() + 1;
  return SEASONAL_MODIFIERS.find(s => s.month === m) || SEASONAL_MODIFIERS[0];
}

/**
 * Calculate recommended budget for Israeli market
 */
export function calculateRecommendedBudget(
  industry: string,
  platform: 'meta' | 'google' | 'tiktok',
  targetLeadsPerMonth: number
): { dailyBudget: number; monthlyBudget: number; estimatedCPL: number; seasonalNote: string } {
  const benchmark = ISRAELI_BENCHMARKS.find(b => b.industry === industry);
  if (!benchmark) {
    return { dailyBudget: 100, monthlyBudget: 3000, estimatedCPL: 50, seasonalNote: '' };
  }

  const metrics = benchmark.platforms[platform];
  const seasonal = getSeasonalModifier();
  const adjustedCPL = metrics.avgCPL * seasonal.modifier;
  const monthlyBudget = Math.ceil(adjustedCPL * targetLeadsPerMonth);
  const dailyBudget = Math.max(metrics.minDailyBudget, Math.ceil(monthlyBudget / 30));

  return {
    dailyBudget,
    monthlyBudget,
    estimatedCPL: Math.round(adjustedCPL),
    seasonalNote: seasonal.note,
  };
}
