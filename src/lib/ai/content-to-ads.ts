/**
 * AI Content → Campaign Ad Engine
 *
 * Takes source content (gantt ideas, podcast, video, recommendations)
 * and generates 3–5 ad variations with:
 *   - Primary text, headline, CTA, hook (first 3 seconds)
 *   - Platform fit (Meta / TikTok / etc.)
 *   - Angle (emotional / direct / curiosity / authority)
 *   - AI explanation of why this variation was generated
 *
 * All generated ads are saved as DRAFT — NEVER auto-published.
 */

import type { Ad } from '@/lib/db/schema';

// ── Types ──

export type ContentSourceType = 'gantt_idea' | 'podcast' | 'video' | 'recommendation' | 'winning_ad' | 'manual';

export type AdAngle = 'emotional' | 'direct' | 'curiosity' | 'authority';

export type PlatformFit = 'meta' | 'tiktok' | 'instagram' | 'linkedin' | 'general';

export interface ContentSource {
  type: ContentSourceType;
  title: string;
  description: string;
  keywords?: string[];
  businessField?: string;
  clientName?: string;
  /** If based on winning ad — reference it */
  referenceAdId?: string;
  referenceAdText?: string;
}

export interface GeneratedAdVariation {
  /** Unique temp ID */
  tempId: string;
  /** Human-readable angle label */
  angle: AdAngle;
  angleLabel: string;
  /** Ad content */
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  hook: string;
  /** Platform recommendations */
  platformFit: PlatformFit[];
  /** AI explanation (client-friendly Hebrew) */
  aiExplanation: string;
  /** Source reference */
  sourceType: ContentSourceType;
  sourceTitle: string;
}

export interface ContentToAdsResult {
  variations: GeneratedAdVariation[];
  sourceType: ContentSourceType;
  sourceTitle: string;
  generatedAt: string;
}

// ── Angle metadata ──

export const ANGLE_META: Record<AdAngle, { label: string; icon: string; description: string }> = {
  emotional: { label: 'רגשי', icon: '❤️', description: 'פונה ללב — יוצר חיבור רגשי' },
  direct: { label: 'ישיר', icon: '🎯', description: 'מגיע לעניין — ברור ונחרץ' },
  curiosity: { label: 'סקרנות', icon: '🔍', description: 'מעורר עניין — רוצים לדעת עוד' },
  authority: { label: 'סמכות', icon: '🏆', description: 'מבסס אמון — מציג מומחיות' },
};

export const PLATFORM_META: Record<PlatformFit, { label: string; icon: string }> = {
  meta: { label: 'Meta', icon: '📘' },
  tiktok: { label: 'TikTok', icon: '🎵' },
  instagram: { label: 'Instagram', icon: '📸' },
  linkedin: { label: 'LinkedIn', icon: '💼' },
  general: { label: 'כללי', icon: '🌐' },
};

// ── CTA Bank ──

const CTA_BANK = {
  lead_gen: ['קבלו הצעה', 'השאירו פרטים', 'רוצים לשמוע עוד?', 'בואו נדבר', 'למידע נוסף'],
  ecommerce: ['לרכישה', 'קנו עכשיו', 'הזמינו היום', 'לצפייה בחנות'],
  awareness: ['למידע נוסף', 'גלו עוד', 'הכירו אותנו', 'ראו בעצמכם'],
  general: ['למידע נוסף', 'צרו קשר', 'הצטרפו אלינו', 'בואו להתחיל'],
};

// ── Core generation engine ──

function generateId(): string {
  return `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate 3–5 ad variations from source content.
 * Uses deterministic rules to create human-quality variations.
 * In production, replace/enhance with real AI (GPT/Claude).
 */
export function generateAdVariations(source: ContentSource): ContentToAdsResult {
  const variations: GeneratedAdVariation[] = [];
  const angles: AdAngle[] = ['emotional', 'direct', 'curiosity', 'authority'];
  const title = source.title;
  const desc = source.description;
  const biz = source.businessField || 'העסק שלך';
  const client = source.clientName || '';
  const keywords = source.keywords || [];
  const keyStr = keywords.slice(0, 3).join(', ');

  // Generate variations for each angle
  for (let i = 0; i < Math.min(angles.length, 4); i++) {
    const angle = angles[i];
    const v = buildVariation(angle, title, desc, biz, client, keyStr, source);
    variations.push(v);
  }

  // Add a bonus variation — "hook-first" for short-form video
  if (desc.length > 20) {
    variations.push(buildHookVariation(title, desc, biz, source));
  }

  return {
    variations,
    sourceType: source.type,
    sourceTitle: source.title,
    generatedAt: new Date().toISOString(),
  };
}

function buildVariation(
  angle: AdAngle,
  title: string,
  desc: string,
  biz: string,
  client: string,
  keywords: string,
  source: ContentSource,
): GeneratedAdVariation {
  const meta = ANGLE_META[angle];

  let primaryText = '';
  let headline = '';
  let hook = '';
  let cta = CTA_BANK.general[Math.floor(Math.random() * CTA_BANK.general.length)];
  let platforms: PlatformFit[] = ['meta', 'instagram'];
  let explanation = '';

  switch (angle) {
    case 'emotional':
      primaryText = `יש רגעים שמשנים הכל.\n${desc.slice(0, 120)}\nאנחנו כאן כדי שזה יקרה גם אצלך.`;
      headline = `${title.slice(0, 40)} — הזמן שלך הגיע`;
      hook = `מה אם הייתם יכולים ${title.toLowerCase().slice(0, 30)}...?`;
      explanation = 'נוצר בגישה רגשית — יוצר חיבור אישי עם הקורא';
      break;

    case 'direct':
      primaryText = `${title}.\n${desc.slice(0, 100)}\n${keywords ? `מתמחים ב: ${keywords}` : ''}\nצרו קשר עוד היום.`;
      headline = title.slice(0, 45);
      hook = `${title} — כל מה שצריך לדעת`;
      cta = 'השאירו פרטים';
      explanation = 'נוצר בגישה ישירה — מגיע לעניין בלי עיגולים';
      break;

    case 'curiosity':
      primaryText = `רוב ${biz === 'העסק שלך' ? 'האנשים' : `בעלי עסקים ב${biz}`} לא יודעים את זה...\n${desc.slice(0, 100)}\nרוצים לגלות?`;
      headline = `סוד ש${biz === 'העסק שלך' ? 'אף אחד' : `רוב ה${biz}`} לא מספרים`;
      hook = `עצרו — מה שאתם עומדים לשמוע ישנה לכם את...`;
      platforms = ['meta', 'instagram', 'tiktok'];
      explanation = 'נוצר בגישת סקרנות — גורם לקורא לרצות לדעת עוד';
      break;

    case 'authority':
      primaryText = `עם ניסיון של שנים ${biz !== 'העסק שלך' ? `בתחום ${biz}` : ''}, אנחנו יודעים בדיוק מה עובד.\n${desc.slice(0, 100)}\nהצטרפו ללקוחות המרוצים שלנו.`;
      headline = `${biz !== 'העסק שלך' ? `מומחים ב${biz}` : 'המומחים'} — ${title.slice(0, 25)}`;
      hook = `למה מאות לקוחות בוחרים בנו?`;
      cta = 'גלו למה';
      platforms = ['meta', 'linkedin'];
      explanation = 'נוצר בגישת סמכות — מבסס אמון ומומחיות';
      break;
  }

  // Source-specific explanation
  if (source.type === 'winning_ad') {
    explanation = `נוצר על בסיס מודעה שמביאה תוצאות טובות — ${meta.description}`;
  } else if (source.type === 'podcast') {
    explanation = `נוצר מתוכן פודקאסט — ${meta.description}`;
  } else if (source.type === 'gantt_idea') {
    explanation = `נוצר מרעיון תוכן מלוח התוכנית — ${meta.description}`;
  }

  return {
    tempId: generateId(),
    angle,
    angleLabel: meta.label,
    primaryText: primaryText.trim(),
    headline,
    description: desc.slice(0, 90),
    cta,
    hook,
    platformFit: platforms,
    aiExplanation: explanation,
    sourceType: source.type,
    sourceTitle: source.title,
  };
}

function buildHookVariation(title: string, desc: string, biz: string, source: ContentSource): GeneratedAdVariation {
  return {
    tempId: generateId(),
    angle: 'curiosity',
    angleLabel: 'הוק — וידאו קצר',
    primaryText: `⏱️ 3 שניות.\nזה כל מה שצריך כדי להבין למה ${title} משנה את הכללים.\n${desc.slice(0, 80)}`,
    headline: `${title.slice(0, 35)} — ב-3 שניות`,
    description: desc.slice(0, 60),
    cta: 'צפו עכשיו',
    hook: `עצרו הכל. מה שאני עומד/ת לספר לכם על ${title.slice(0, 25)}...`,
    platformFit: ['tiktok', 'instagram'],
    aiExplanation: 'נוצר כהוק לוידאו קצר — אופטימלי ל-TikTok ו-Reels',
    sourceType: source.type,
    sourceTitle: source.title,
  };
}

/**
 * Convert generated variations to draft Ad records for saving.
 */
export function variationsToAds(
  variations: GeneratedAdVariation[],
  campaignId: string,
  adSetId: string,
): Partial<Ad>[] {
  return variations.map(v => ({
    name: `[AI] ${v.angleLabel} — ${v.sourceTitle.slice(0, 30)}`,
    adSetId,
    status: 'draft' as const,
    primaryText: v.primaryText,
    headline: v.headline,
    description: v.description,
    cta: v.cta,
    // Store metadata in the ad record
    aiGenerated: true,
    aiAngle: v.angle,
    aiExplanation: v.aiExplanation,
    aiSourceType: v.sourceType,
    aiSourceTitle: v.sourceTitle,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}
