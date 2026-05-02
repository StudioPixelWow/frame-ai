/**
 * Auto Variation Generator
 *
 * When creative fatigue or weak ad is detected, generates multiple
 * alternative copy sets for draft ad creation.
 *
 * Produces:
 *   - 3 primary text options
 *   - 3 headline options
 *   - 3 CTA options
 *   - Explanation per variation
 *
 * Deterministic (rules-based). Creates draft ads internally.
 * NEVER auto-publishes to Meta.
 */

import type { Ad } from '@/lib/db/schema';
import type { AutoCampaignFinding } from '@/lib/db/schema';

// ── Types ────────────────────────────────────────────────────────────

export interface AutoVariationSet {
  findingId: string;
  sourceAdId: string;
  sourceAdName: string;
  campaignId: string;
  adSetId: string;
  variations: AutoVariation[];
  createdAt: string;
}

export interface AutoVariation {
  index: number;
  strategy: AutoVariationStrategy;
  primaryText: string;
  headline: string;
  description: string;
  ctaType: string;
  explanation: string;
  confidence: number;
}

export type AutoVariationStrategy =
  | 'urgency'
  | 'benefit_focus'
  | 'social_proof'
  | 'question_hook'
  | 'short_punch'
  | 'emotional';

const STRATEGY_CONFIG: Record<AutoVariationStrategy, {
  label: string;
  icon: string;
  priority: number;
}> = {
  urgency:       { label: 'דחיפות', icon: '⏰', priority: 1 },
  benefit_focus: { label: 'מיקוד בתועלת', icon: '✨', priority: 2 },
  social_proof:  { label: 'הוכחה חברתית', icon: '👥', priority: 3 },
  question_hook: { label: 'שאלה פותחת', icon: '❓', priority: 4 },
  short_punch:   { label: 'קצר ואפקטיבי', icon: '💥', priority: 5 },
  emotional:     { label: 'רגשי', icon: '❤️', priority: 6 },
};

// ── Hebrew copy building blocks ──────────────────────────────────────

const URGENCY_PREFIXES = [
  'מוגבל! ', 'רק היום — ', 'הזדמנות אחרונה: ', 'עד גמר המלאי: ',
  'בלעדי לשבוע הזה: ', 'מבצע מיוחד — ',
];

const BENEFIT_PREFIXES = [
  'גלה איך ', 'הדרך הפשוטה ל', 'הפתרון שחיכית לו: ', 'סוף סוף — ',
  'בדיוק מה שחיפשת: ', 'השיטה שעובדת: ',
];

const SOCIAL_PROOF_PHRASES = [
  'מעל 1,000 לקוחות מרוצים', 'הצטרף לאלפים שכבר', 'מדורג #1 בתחום',
  '95% שביעות רצון', 'ההמלצה של המומחים', 'הבחירה של אנשי מקצוע',
];

const QUESTION_HOOKS = [
  'מתי בפעם האחרונה', 'מה אם יש דרך טובה יותר?', 'עדיין מתלבט?',
  'רוצה לדעת את הסוד?', 'שאלת את עצמך פעם', 'למה לשלם יותר?',
];

const EMOTIONAL_PHRASES = [
  'תדמיין את זה — ', 'החלום שלך מתגשם: ', 'הרגע שהכל משתנה — ',
  'בוא נדבר על מה שבאמת חשוב: ', 'הגיע הזמן לשנות: ',
];

const CTA_OPTIONS = [
  'LEARN_MORE', 'SIGN_UP', 'SHOP_NOW', 'CONTACT_US', 'GET_OFFER',
  'APPLY_NOW', 'SUBSCRIBE', 'BOOK_NOW',
];

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'למידע נוסף', SIGN_UP: 'הרשמה', SHOP_NOW: 'קנה עכשיו',
  CONTACT_US: 'צור קשר', GET_OFFER: 'קבל הצעה', APPLY_NOW: 'הגש מועמדות',
  SUBSCRIBE: 'הירשם', BOOK_NOW: 'הזמן עכשיו',
};

// ── Core generation ──────────────────────────────────────────────────

function selectStrategies(ad: Ad, findingType: string): AutoVariationStrategy[] {
  // Pick 3 strategies based on finding type and ad data
  const strategies: AutoVariationStrategy[] = [];

  if (findingType === 'creative_fatigue') {
    // Fatigued ads need fresh approaches
    strategies.push('urgency', 'question_hook', 'emotional');
  } else if (findingType === 'budget_waste') {
    // Wasteful ads need benefit-focused copy
    strategies.push('benefit_focus', 'social_proof', 'short_punch');
  } else if (findingType === 'weak_audience') {
    // Weak audience = need stronger hooks
    strategies.push('question_hook', 'social_proof', 'urgency');
  } else {
    // Default: try diverse strategies
    strategies.push('benefit_focus', 'urgency', 'emotional');
  }

  return strategies.slice(0, 3);
}

function deterministic(seed: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % max;
}

function generatePrimaryText(
  ad: Ad,
  strategy: AutoVariationStrategy,
  index: number,
): string {
  const original = ad.primaryText || '';
  const seed = `${ad.id}_${strategy}_${index}`;

  // Extract core message (remove prefixes, trim)
  const core = original.replace(/^[^֐-׿]*/, '').trim() || 'הפתרון המושלם עבורך';

  switch (strategy) {
    case 'urgency': {
      const prefix = URGENCY_PREFIXES[deterministic(seed, URGENCY_PREFIXES.length)];
      return `${prefix}${core}`;
    }
    case 'benefit_focus': {
      const prefix = BENEFIT_PREFIXES[deterministic(seed, BENEFIT_PREFIXES.length)];
      return `${prefix}${core.toLowerCase()}`;
    }
    case 'social_proof': {
      const proof = SOCIAL_PROOF_PHRASES[deterministic(seed, SOCIAL_PROOF_PHRASES.length)];
      return `${proof} — ${core}`;
    }
    case 'question_hook': {
      const q = QUESTION_HOOKS[deterministic(seed, QUESTION_HOOKS.length)];
      return `${q}\n\n${core}`;
    }
    case 'short_punch': {
      // Shorten to first sentence + CTA
      const firstSentence = core.split(/[.!?]/)[0] || core;
      return firstSentence.substring(0, 80).trim() + '.';
    }
    case 'emotional': {
      const emotion = EMOTIONAL_PHRASES[deterministic(seed, EMOTIONAL_PHRASES.length)];
      return `${emotion}${core}`;
    }
    default:
      return core;
  }
}

function generateHeadline(
  ad: Ad,
  strategy: AutoVariationStrategy,
  index: number,
): string {
  const original = ad.headline || ad.name || '';
  const seed = `hl_${ad.id}_${strategy}_${index}`;

  switch (strategy) {
    case 'urgency':
      return `${original} — מוגבל!`.substring(0, 40);
    case 'benefit_focus':
      return `למה ${original}?`.substring(0, 40);
    case 'social_proof':
      return `הבחירה #1: ${original}`.substring(0, 40);
    case 'question_hook':
      return `מכירים את ${original}?`.substring(0, 40);
    case 'short_punch':
      return original.split(' ').slice(0, 3).join(' ');
    case 'emotional':
      return `${original} — הגיע הזמן`.substring(0, 40);
    default:
      return original;
  }
}

function selectCTA(
  ad: Ad,
  strategy: AutoVariationStrategy,
  index: number,
): string {
  const seed = `cta_${ad.id}_${strategy}_${index}`;
  // Avoid recommending the same CTA as original
  const filtered = CTA_OPTIONS.filter(c => c !== ad.ctaType);
  if (filtered.length === 0) return 'LEARN_MORE';
  return filtered[deterministic(seed, filtered.length)];
}

function generateExplanation(
  strategy: AutoVariationStrategy,
  original: Ad,
): string {
  const config = STRATEGY_CONFIG[strategy];
  const explanations: Record<AutoVariationStrategy, string> = {
    urgency: `שימוש ב${config.label} — יצירת תחושת מוגבלות מעודדת פעולה מהירה יותר. מתאים כשהקהל ראה את המודעה מספר פעמים.`,
    benefit_focus: `${config.label} — העברת המסר מתיאור מוצר לתיאור תועלת ללקוח. מגדיל שיעור קליקים בממוצע 15-25%.`,
    social_proof: `${config.label} — הוספת עדויות ונתונים שמחזקים אמינות. מפחית חסמי החלטה.`,
    question_hook: `${config.label} — פתיחה בשאלה מעוררת סקרנות ומגדילה engagement ב-20%.`,
    short_punch: `${config.label} — קיצור הטקסט מעלה קריאות ומתאים לפיד מהיר. מומלץ כשהטקסט המקורי ארוך.`,
    emotional: `${config.label} — פנייה לרגש מעודדת חיבור עמוק יותר עם המוצר. מתאים לקהל שכבר מכיר את המותג.`,
  };
  return explanations[strategy] || `אסטרטגיית ${config.label}`;
}

// ── Main export ──────────────────────────────────────────────────────

export function generateAutoVariations(
  ad: Ad,
  finding: AutoCampaignFinding,
): AutoVariationSet {
  const strategies = selectStrategies(ad, finding.type);

  const variations: AutoVariation[] = strategies.map((strategy, i) => ({
    index: i + 1,
    strategy,
    primaryText: generatePrimaryText(ad, strategy, i),
    headline: generateHeadline(ad, strategy, i),
    description: ad.description || '',
    ctaType: selectCTA(ad, strategy, i),
    explanation: generateExplanation(strategy, ad),
    confidence: Math.max(40, finding.confidence - 10 + i * 5),
  }));

  return {
    findingId: finding.id,
    sourceAdId: ad.id,
    sourceAdName: ad.name,
    campaignId: finding.campaignId,
    adSetId: finding.adSetId || ad.adSetId,
    variations,
    createdAt: new Date().toISOString(),
  };
}

export { STRATEGY_CONFIG, CTA_LABELS };
