/**
 * Variation Engine — generates new ad text variations from originals + performance signals.
 *
 * Deterministic (rules-based) — no AI calls.
 * Produces new primary text, headline, description, CTA type suggestions.
 */

import type { Ad } from '@/lib/db/schema';

// ── Types ──────────────────────────────────────────────────────────────

export interface VariationSuggestion {
  newPrimaryText: string;
  newHeadline: string;
  newDescription: string;
  newCtaType: string;
  newMediaSuggestion: string;
  strategy: VariationStrategy;
  rationale: string;
}

export type VariationStrategy =
  | 'urgency'        // Add urgency / scarcity signals
  | 'benefit_focus'  // Lead with benefit instead of feature
  | 'social_proof'   // Add social proof elements
  | 'question_hook'  // Open with a question
  | 'short_punch'    // Shorten to punchy copy
  | 'emotional';     // Add emotional appeal

export interface PerformanceSignals {
  ctr: number;
  cpl: number;
  frequency: number;
  impressions: number;
  spend: number;
  leads: number;
}

// ── Strategy metadata for UI ──────────────────────────────────────────

export const VARIATION_STRATEGY_META: Record<VariationStrategy, {
  label: string;
  icon: string;
  description: string;
}> = {
  urgency: {
    label: 'דחיפות',
    icon: '⏰',
    description: 'הוספת אלמנטים של דחיפות ומחסור',
  },
  benefit_focus: {
    label: 'מיקוד בתועלת',
    icon: '🎯',
    description: 'הובלה עם תועלת במקום פיצ\'ר',
  },
  social_proof: {
    label: 'הוכחה חברתית',
    icon: '👥',
    description: 'הוספת אלמנטים של הוכחה חברתית',
  },
  question_hook: {
    label: 'שאלה פותחת',
    icon: '❓',
    description: 'פתיחה בשאלה שמושכת תשומת לב',
  },
  short_punch: {
    label: 'קצר וחד',
    icon: '⚡',
    description: 'קיצור לקופי תמציתי ואפקטיבי',
  },
  emotional: {
    label: 'רגשי',
    icon: '❤️',
    description: 'הוספת ערעור רגשי',
  },
};

// ── CTA rotation map ──────────────────────────────────────────────────

const CTA_ROTATION: Record<string, string[]> = {
  LEARN_MORE: ['SIGN_UP', 'GET_OFFER', 'CONTACT_US'],
  SIGN_UP: ['LEARN_MORE', 'GET_OFFER', 'SUBSCRIBE'],
  SHOP_NOW: ['GET_OFFER', 'LEARN_MORE', 'ORDER_NOW'],
  GET_OFFER: ['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP'],
  CONTACT_US: ['LEARN_MORE', 'SIGN_UP', 'SEND_MESSAGE'],
  SUBSCRIBE: ['SIGN_UP', 'LEARN_MORE', 'GET_OFFER'],
  SEND_MESSAGE: ['CONTACT_US', 'LEARN_MORE', 'SIGN_UP'],
  ORDER_NOW: ['SHOP_NOW', 'GET_OFFER', 'LEARN_MORE'],
  '': ['LEARN_MORE', 'SIGN_UP', 'CONTACT_US'],
};

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'למידע נוסף',
  SIGN_UP: 'הרשמה',
  GET_OFFER: 'קבלו הצעה',
  SHOP_NOW: 'קנו עכשיו',
  CONTACT_US: 'צרו קשר',
  SUBSCRIBE: 'הירשמו',
  SEND_MESSAGE: 'שלחו הודעה',
  ORDER_NOW: 'הזמינו עכשיו',
};

// ── Core: pick best strategy based on performance ────────────────────

export function pickStrategy(ad: Ad, signals: PerformanceSignals): VariationStrategy {
  // High frequency + low CTR → fatigue, try urgency or question hook
  if (signals.frequency > 3 && signals.ctr < 1.0) {
    return 'question_hook';
  }

  // Good impressions but bad CTR → copy isn't compelling
  if (signals.impressions > 1000 && signals.ctr < 0.8) {
    return 'short_punch';
  }

  // High CTR but high CPL → clicks but no conversion → benefit focus
  if (signals.ctr > 1.5 && signals.cpl > 100) {
    return 'benefit_focus';
  }

  // Very long primary text → try shortening
  if (ad.primaryText && ad.primaryText.length > 200) {
    return 'short_punch';
  }

  // Low spend efficiency → try emotional or social proof
  if (signals.spend > 0 && signals.leads === 0) {
    return 'social_proof';
  }

  // Good performance, just want a variation → urgency
  if (signals.ctr > 1.0) {
    return 'urgency';
  }

  // Default: emotional appeal
  return 'emotional';
}

// ── Strategy appliers ────────────────────────────────────────────────

function applyUrgency(ad: Ad): { primaryText: string; headline: string; description: string } {
  const urgencyPrefixes = [
    '🔥 הזדמנות אחרונה — ',
    '⏰ נשארו מקומות אחרונים! ',
    '🚀 רק השבוע — ',
    '💥 מבצע מוגבל בזמן: ',
  ];
  const prefix = urgencyPrefixes[Math.floor(Math.random() * urgencyPrefixes.length)];

  return {
    primaryText: prefix + (ad.primaryText || ''),
    headline: ad.headline ? `אל תפספסו: ${ad.headline}` : 'הזדמנות שלא חוזרת',
    description: ad.description ? `${ad.description} — פועלים עכשיו!` : 'מקומות מוגבלים, הירשמו עכשיו',
  };
}

function applyBenefitFocus(ad: Ad): { primaryText: string; headline: string; description: string } {
  const text = ad.primaryText || '';
  // Try to extract what comes after "אנחנו" / "שלנו" and flip to "אתם תקבלו"
  const benefitOpener = '✅ מה תקבלו?\n';

  return {
    primaryText: benefitOpener + text,
    headline: ad.headline ? `הנה מה שתקבלו: ${ad.headline}` : 'התוצאות מדברות בעד עצמן',
    description: ad.description || 'גלו את היתרונות שמחכים לכם',
  };
}

function applySocialProof(ad: Ad): { primaryText: string; headline: string; description: string } {
  const socialPrefixes = [
    '📊 מאות לקוחות כבר נהנים — ',
    '⭐ 4.9/5 דירוג לקוחות — ',
    '🏆 הבחירה המובילה — ',
    '👥 הצטרפו לאלפים שכבר בחרו — ',
  ];
  const prefix = socialPrefixes[Math.floor(Math.random() * socialPrefixes.length)];

  return {
    primaryText: prefix + (ad.primaryText || ''),
    headline: ad.headline ? `${ad.headline} — כמו מאות לקוחות מרוצים` : 'הבחירה של לקוחות מרוצים',
    description: ad.description || 'הצטרפו לקהילה שלנו',
  };
}

function applyQuestionHook(ad: Ad): { primaryText: string; headline: string; description: string } {
  const questions = [
    '🤔 מכירים את ההרגשה ש',
    '💭 עדיין מתלבטים? ',
    '❓ רוצים לדעת איך ',
    '🎯 חיפשתם פתרון ל',
  ];
  const q = questions[Math.floor(Math.random() * questions.length)];

  return {
    primaryText: q + (ad.primaryText || '').replace(/^[^\w֐-׿]+/, '').substring(0, 60) + '?\n\n' + (ad.primaryText || ''),
    headline: ad.headline ? `${ad.headline}?` : 'התשובה שחיכיתם לה',
    description: ad.description || 'גלו עכשיו',
  };
}

function applyShortPunch(ad: Ad): { primaryText: string; headline: string; description: string } {
  const text = ad.primaryText || '';
  // Take first sentence or first 80 chars
  const firstSentence = text.split(/[.!\n]/)[0]?.trim() || text.substring(0, 80);

  return {
    primaryText: firstSentence + (firstSentence.endsWith('.') ? '' : '.'),
    headline: ad.headline
      ? ad.headline.split(' ').slice(0, 4).join(' ')
      : 'פשוט. מהיר. אפקטיבי.',
    description: '',
  };
}

function applyEmotional(ad: Ad): { primaryText: string; headline: string; description: string } {
  const emotionalOpeners = [
    '💡 דמיינו עולם שבו ',
    '🌟 הגיע הזמן לשינוי — ',
    '❤️ כי אתם ראויים ל',
    '✨ הסיפור שלכם מתחיל כאן — ',
  ];
  const opener = emotionalOpeners[Math.floor(Math.random() * emotionalOpeners.length)];

  return {
    primaryText: opener + (ad.primaryText || ''),
    headline: ad.headline ? `${ad.headline} — ההזדמנות שלכם` : 'הצעד הבא שלכם',
    description: ad.description || 'התחילו את המסע',
  };
}

// ── Main: generate a variation suggestion ────────────────────────────

export function generateVariation(
  ad: Ad,
  signals?: PerformanceSignals | null,
  forceStrategy?: VariationStrategy,
): VariationSuggestion {
  const perf: PerformanceSignals = signals || {
    ctr: ad.ctr,
    cpl: ad.cpl,
    frequency: ad.frequency,
    impressions: ad.impressions,
    spend: ad.spend,
    leads: ad.leads,
  };

  const strategy = forceStrategy || pickStrategy(ad, perf);

  // Apply strategy to generate text
  let result: { primaryText: string; headline: string; description: string };
  switch (strategy) {
    case 'urgency': result = applyUrgency(ad); break;
    case 'benefit_focus': result = applyBenefitFocus(ad); break;
    case 'social_proof': result = applySocialProof(ad); break;
    case 'question_hook': result = applyQuestionHook(ad); break;
    case 'short_punch': result = applyShortPunch(ad); break;
    case 'emotional': result = applyEmotional(ad); break;
    default: result = applyEmotional(ad);
  }

  // Rotate CTA
  const currentCta = ad.ctaType || '';
  const alternatives = CTA_ROTATION[currentCta] || CTA_ROTATION[''];
  const newCta = alternatives[0];

  // Media suggestion based on performance
  let mediaSuggestion = '';
  if (perf.ctr < 0.8 && perf.impressions > 500) {
    mediaSuggestion = 'שקלו להחליף את המדיה — CTR נמוך מצביע על חוסר התאמה ויזואלית';
  } else if (perf.frequency > 4) {
    mediaSuggestion = 'מומלץ להחליף קריאייטיב — תדירות גבוהה גורמת לשחיקת מודעות';
  } else if (ad.creativeType === 'image') {
    mediaSuggestion = 'שקלו וידאו — וידאו מניב בממוצע CTR גבוה ב-30%';
  }

  // Strategy rationale for UI
  const meta = VARIATION_STRATEGY_META[strategy];
  const ctaLabel = CTA_LABELS[newCta] || newCta;
  const rationale = buildRationale(strategy, perf, meta);

  return {
    newPrimaryText: result.primaryText,
    newHeadline: result.headline,
    newDescription: result.description,
    newCtaType: newCta,
    newMediaSuggestion: mediaSuggestion,
    strategy,
    rationale,
  };
}

function buildRationale(
  strategy: VariationStrategy,
  perf: PerformanceSignals,
  meta: { label: string },
): string {
  switch (strategy) {
    case 'urgency':
      return `הוספת דחיפות — CTR ${perf.ctr.toFixed(1)}% מצביע על פוטנציאל שיפור עם אלמנטים של מחסור`;
    case 'benefit_focus':
      return `מיקוד בתועלת — CPL ₪${perf.cpl.toFixed(0)} גבוה, הובלה עם ערך ללקוח יכולה לשפר המרות`;
    case 'social_proof':
      return `הוכחה חברתית — ${perf.leads} לידים ללא המרה, הוספת אמינות יכולה לעזור`;
    case 'question_hook':
      return `שאלה פותחת — תדירות ${perf.frequency.toFixed(1)} גבוהה, צריך לשבור את הדפוס`;
    case 'short_punch':
      return `קיצור הקופי — CTR ${perf.ctr.toFixed(1)}% נמוך, טקסט קצר יותר מושך תשומת לב`;
    case 'emotional':
      return `ערעור רגשי — שיפור חיבור רגשי עם הקהל`;
  }
}

// ── Generate multiple variations ─────────────────────────────────────

export function generateMultipleVariations(
  ad: Ad,
  signals?: PerformanceSignals | null,
  count: number = 3,
): VariationSuggestion[] {
  const strategies: VariationStrategy[] = [
    'urgency', 'benefit_focus', 'social_proof',
    'question_hook', 'short_punch', 'emotional',
  ];

  // Pick the best strategy first, then rotate others
  const best = pickStrategy(ad, signals || {
    ctr: ad.ctr, cpl: ad.cpl, frequency: ad.frequency,
    impressions: ad.impressions, spend: ad.spend, leads: ad.leads,
  });

  const ordered = [best, ...strategies.filter(s => s !== best)];
  const results: VariationSuggestion[] = [];

  for (let i = 0; i < Math.min(count, ordered.length); i++) {
    results.push(generateVariation(ad, signals, ordered[i]));
  }

  return results;
}
