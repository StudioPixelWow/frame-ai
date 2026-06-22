/**
 * Campaign DNA Service — Converts Brand DNA + Campaign Objective → Campaign DNA
 *
 * Maps each campaign type to base DNA values (urgency, CTA, visual intensity, etc.)
 * and enriches with brand colors, industry context, and emotional angles.
 *
 * Server-side only.
 */
import type { CampaignDNA, CampaignFactoryType } from '@/lib/db/schema';

/* ── Base DNA Presets per Campaign Type ──────────────────────────────── */

interface BaseDNAPreset {
  urgency: number;
  ctaLevel: number;
  salesAggressiveness: number;
  visualIntensity: number;
  emotionalAngle: string;
  toneOfVoice: string;
  contentHierarchy: string[];
  campaignIdentity: string;
  colorAccent: string;
  moodKeywords: string[];
}

const CAMPAIGN_DNA_PRESETS: Record<CampaignFactoryType, BaseDNAPreset> = {
  lead_generation: {
    urgency: 75,
    ctaLevel: 80,
    salesAggressiveness: 60,
    visualIntensity: 65,
    emotionalAngle: 'הזדמנות',
    toneOfVoice: 'מקצועי',
    contentHierarchy: ['הצעה', 'כותרת', 'CTA', 'תמונה'],
    campaignIdentity: 'קמפיין לידים ממוקד המרות',
    colorAccent: '#E94560',
    moodKeywords: ['דחיפות', 'הזדמנות', 'פעולה', 'מהיר'],
  },
  brand_awareness: {
    urgency: 20,
    ctaLevel: 30,
    salesAggressiveness: 15,
    visualIntensity: 80,
    emotionalAngle: 'השראה',
    toneOfVoice: 'חם ואישי',
    contentHierarchy: ['תמונה', 'כותרת', 'סיפור', 'CTA'],
    campaignIdentity: 'קמפיין מודעות מותגית ויזואלי',
    colorAccent: '#6C5CE7',
    moodKeywords: ['השראה', 'סיפור', 'חיבור', 'ערכים'],
  },
  launch_campaign: {
    urgency: 85,
    ctaLevel: 75,
    salesAggressiveness: 70,
    visualIntensity: 90,
    emotionalAngle: 'FOMO',
    toneOfVoice: 'אנרגטי',
    contentHierarchy: ['כותרת', 'תמונה', 'הצעה', 'CTA'],
    campaignIdentity: 'קמפיין השקה אנרגטי ודוחף',
    colorAccent: '#FF6B6B',
    moodKeywords: ['חדש', 'ראשון', 'בלעדי', 'מרגש', 'השקה'],
  },
  sales_campaign: {
    urgency: 90,
    ctaLevel: 95,
    salesAggressiveness: 90,
    visualIntensity: 75,
    emotionalAngle: 'דחיפות',
    toneOfVoice: 'דוחף למכירה',
    contentHierarchy: ['הצעה', 'CTA', 'כותרת', 'תמונה'],
    campaignIdentity: 'קמפיין מכירות אגרסיבי',
    colorAccent: '#FF4757',
    moodKeywords: ['מבצע', 'הנחה', 'עכשיו', 'מוגבל', 'חסכון'],
  },
  project_marketing: {
    urgency: 55,
    ctaLevel: 60,
    salesAggressiveness: 50,
    visualIntensity: 80,
    emotionalAngle: 'אמון',
    toneOfVoice: 'מקצועי',
    contentHierarchy: ['תמונה', 'כותרת', 'הצעה', 'CTA'],
    campaignIdentity: 'קמפיין שיווק פרויקט מקצועי',
    colorAccent: '#2ED573',
    moodKeywords: ['איכות', 'מקצועיות', 'אמינות', 'פרויקט'],
  },
  real_estate_project_launch: {
    urgency: 60,
    ctaLevel: 65,
    salesAggressiveness: 55,
    visualIntensity: 85,
    emotionalAngle: 'שייכות',
    toneOfVoice: 'פרימיום',
    contentHierarchy: ['תמונה', 'כותרת', 'הצעה', 'CTA'],
    campaignIdentity: 'השקת פרויקט נדל"ן פרימיום',
    colorAccent: '#C9A96E',
    moodKeywords: ['יוקרה', 'מגורים', 'חלום', 'פרימיום', 'בית'],
  },
  property_marketing: {
    urgency: 50,
    ctaLevel: 55,
    salesAggressiveness: 45,
    visualIntensity: 80,
    emotionalAngle: 'שייכות',
    toneOfVoice: 'פרימיום',
    contentHierarchy: ['תמונה', 'כותרת', 'פרטים', 'CTA'],
    campaignIdentity: 'שיווק נכס עם דגש ויזואלי',
    colorAccent: '#B8860B',
    moodKeywords: ['יוקרה', 'נוף', 'עיצוב', 'מיקום', 'השקעה'],
  },
  holiday_campaign: {
    urgency: 65,
    ctaLevel: 60,
    salesAggressiveness: 50,
    visualIntensity: 85,
    emotionalAngle: 'שייכות',
    toneOfVoice: 'נוסטלגי',
    contentHierarchy: ['תמונה', 'כותרת', 'הצעה', 'CTA'],
    campaignIdentity: 'קמפיין חג חגיגי ורגשי',
    colorAccent: '#FFA502',
    moodKeywords: ['חג', 'חגיגה', 'משפחה', 'שמחה', 'מתנות'],
  },
  recruitment_campaign: {
    urgency: 55,
    ctaLevel: 65,
    salesAggressiveness: 40,
    visualIntensity: 60,
    emotionalAngle: 'הזדמנות',
    toneOfVoice: 'חם ואישי',
    contentHierarchy: ['כותרת', 'הצעה', 'תמונה', 'CTA'],
    campaignIdentity: 'קמפיין גיוס עם ערך מעסיק',
    colorAccent: '#3742FA',
    moodKeywords: ['קריירה', 'צמיחה', 'צוות', 'הזדמנות', 'שינוי'],
  },
  event_campaign: {
    urgency: 80,
    ctaLevel: 85,
    salesAggressiveness: 45,
    visualIntensity: 85,
    emotionalAngle: 'FOMO',
    toneOfVoice: 'אנרגטי',
    contentHierarchy: ['כותרת', 'תמונה', 'פרטים', 'CTA'],
    campaignIdentity: 'קמפיין אירוע עם דחיפות',
    colorAccent: '#FF6348',
    moodKeywords: ['אירוע', 'חוויה', 'בלעדי', 'מפגש', 'לא לפספס'],
  },
  website_traffic: {
    urgency: 40,
    ctaLevel: 70,
    salesAggressiveness: 35,
    visualIntensity: 65,
    emotionalAngle: 'הזדמנות',
    toneOfVoice: 'מקצועי',
    contentHierarchy: ['כותרת', 'הצעה', 'CTA', 'תמונה'],
    campaignIdentity: 'קמפיין תנועה לאתר',
    colorAccent: '#1E90FF',
    moodKeywords: ['גילוי', 'תוכן', 'ערך', 'מידע', 'למידה'],
  },
  remarketing: {
    urgency: 80,
    ctaLevel: 85,
    salesAggressiveness: 75,
    visualIntensity: 60,
    emotionalAngle: 'דחיפות',
    toneOfVoice: 'חם ואישי',
    contentHierarchy: ['הצעה', 'כותרת', 'CTA', 'תמונה'],
    campaignIdentity: 'קמפיין רימרקטינג ממוקד',
    colorAccent: '#FF4757',
    moodKeywords: ['חזרה', 'תזכורת', 'מיוחד', 'עדיין', 'בשבילך'],
  },
  custom: {
    urgency: 50,
    ctaLevel: 50,
    salesAggressiveness: 50,
    visualIntensity: 70,
    emotionalAngle: 'אמון',
    toneOfVoice: 'מקצועי',
    contentHierarchy: ['כותרת', 'תמונה', 'הצעה', 'CTA'],
    campaignIdentity: 'קמפיין מותאם אישית',
    colorAccent: '#5352ED',
    moodKeywords: ['מותג', 'ערך', 'מקצועיות'],
  },
};

/* ── Industry Mood Enrichment ────────────────────────────────────────── */

const INDUSTRY_MOOD_MAP: Record<string, string[]> = {
  real_estate: ['יוקרה', 'מגורים', 'השקעה', 'חלום', 'פרימיום'],
  restaurant: ['טעם', 'חוויה', 'תיאבון', 'אותנטי', 'מפנק'],
  finance: ['אמון', 'ביטחון', 'יציבות', 'צמיחה', 'מקצועיות'],
  medical: ['בריאות', 'אכפתיות', 'מומחיות', 'אמון', 'שקט נפשי'],
  tech: ['חדשנות', 'עתידני', 'נקי', 'מודרני', 'פשוט'],
  fashion: ['סטייל', 'טרנד', 'ייחודי', 'ביטוי עצמי', 'אופנתי'],
  education: ['ידע', 'צמיחה', 'למידה', 'עתיד', 'מצוינות'],
  fitness: ['חוזק', 'מוטיבציה', 'שינוי', 'תוצאות', 'אנרגיה'],
  beauty: ['יופי', 'טיפוח', 'זוהר', 'עצמי', 'פרימיום'],
  ecommerce: ['נוחות', 'מבצע', 'חווית קנייה', 'משלוח', 'מגוון'],
};

/* ── Detect Industry Key ─────────────────────────────────────────────── */

function detectIndustryKey(industry: string): string {
  const lower = industry.toLowerCase();
  if (lower.includes('נדל') || lower.includes('real') || lower.includes('estate')) return 'real_estate';
  if (lower.includes('מסעד') || lower.includes('אוכל') || lower.includes('restaurant') || lower.includes('food')) return 'restaurant';
  if (lower.includes('פיננ') || lower.includes('finance') || lower.includes('בנק') || lower.includes('ביטוח')) return 'finance';
  if (lower.includes('רפוא') || lower.includes('medical') || lower.includes('בריאות') || lower.includes('רפואי')) return 'medical';
  if (lower.includes('טכנו') || lower.includes('tech') || lower.includes('הייטק') || lower.includes('סטארט')) return 'tech';
  if (lower.includes('אופנ') || lower.includes('fashion')) return 'fashion';
  if (lower.includes('חינוך') || lower.includes('education') || lower.includes('לימוד')) return 'education';
  if (lower.includes('כושר') || lower.includes('fitness') || lower.includes('ספורט')) return 'fitness';
  if (lower.includes('יופי') || lower.includes('beauty') || lower.includes('קוסמטי')) return 'beauty';
  if (lower.includes('ecommerce') || lower.includes('חנות') || lower.includes('מסחר')) return 'ecommerce';
  return 'general';
}

/* ── Main Export ──────────────────────────────────────────────────────── */

/**
 * Build Campaign DNA from campaign parameters + brand data.
 * Pure function — no DB or AI calls.
 */
export function buildCampaignDNA(params: {
  campaignType: CampaignFactoryType;
  objective: string;
  targetAudience: string;
  offer: string;
  mainMessage: string;
  industry: string;
  brandColors?: string[];
  brandStyleType?: string;
}): CampaignDNA {
  const {
    campaignType,
    industry,
    brandColors,
    brandStyleType,
  } = params;

  const preset = CAMPAIGN_DNA_PRESETS[campaignType] ?? CAMPAIGN_DNA_PRESETS.custom;

  // Use brand primary color as accent if available
  const colorAccent = brandColors?.[0] ?? preset.colorAccent;

  // Merge industry mood keywords with preset mood keywords
  const industryKey = detectIndustryKey(industry);
  const industryMoods = INDUSTRY_MOOD_MAP[industryKey] ?? [];
  const moodKeywords = [
    ...new Set([...preset.moodKeywords, ...industryMoods]),
  ];

  // Adjust tone if brand style type is specified
  let toneOfVoice = preset.toneOfVoice;
  if (brandStyleType) {
    const styleLower = brandStyleType.toLowerCase();
    if (styleLower.includes('יוקרה') || styleLower.includes('luxury') || styleLower.includes('premium')) {
      toneOfVoice = 'פרימיום';
    } else if (styleLower.includes('צעיר') || styleLower.includes('young') || styleLower.includes('אנרגטי')) {
      toneOfVoice = 'אנרגטי';
    } else if (styleLower.includes('חם') || styleLower.includes('warm') || styleLower.includes('אישי')) {
      toneOfVoice = 'חם ואישי';
    }
  }

  return {
    urgency: preset.urgency,
    emotionalAngle: preset.emotionalAngle,
    ctaLevel: preset.ctaLevel,
    visualIntensity: preset.visualIntensity,
    salesAggressiveness: preset.salesAggressiveness,
    contentHierarchy: preset.contentHierarchy,
    campaignIdentity: preset.campaignIdentity,
    toneOfVoice,
    colorAccent,
    moodKeywords,
  };
}
