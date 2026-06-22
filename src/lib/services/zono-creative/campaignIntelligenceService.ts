/**
 * Campaign Intelligence Service — intelligence explanations for campaign assets
 *
 * Provides Hebrew labels, intelligence notes, and asset manifests
 * for the PIXEL Campaign Factory.
 *
 * Server-side only.
 */
import type {
  CampaignAssetFormat,
  CampaignFactoryType,
  CampaignDNA,
} from '@/lib/db/schema';

/* ── Campaign Type Labels (Hebrew) ───────────────────────────────────── */

const CAMPAIGN_TYPE_LABELS: Record<CampaignFactoryType, string> = {
  lead_generation: 'קמפיין לידים',
  brand_awareness: 'מודעות מותגית',
  launch_campaign: 'קמפיין השקה',
  sales_campaign: 'קמפיין מכירות',
  project_marketing: 'שיווק פרויקט',
  real_estate_project_launch: 'השקת פרויקט נדל"ן',
  property_marketing: 'שיווק נכס',
  holiday_campaign: 'קמפיין חג',
  recruitment_campaign: 'קמפיין גיוס',
  event_campaign: 'קמפיין אירוע',
  website_traffic: 'תנועה לאתר',
  remarketing: 'רימרקטינג',
  custom: 'קמפיין מותאם',
};

/* ── Asset Format Labels (Hebrew) ────────────────────────────────────── */

const ASSET_FORMAT_LABELS: Record<CampaignAssetFormat, string> = {
  feed_post: 'פוסט פיד',
  story: 'סטורי',
  carousel: 'קרוסלה',
  reel_cover: 'כיסוי ריל',
  banner: 'באנר',
  website_hero: 'גיבור אתר',
  email_header: 'כותרת אימייל',
  google_display: 'מודעת גוגל',
  property_story: 'סטורי נכס',
  property_carousel: 'קרוסלת נכס',
  seller_recruitment: 'גיוס מוכרים',
  buyer_recruitment: 'גיוס קונים',
  project_awareness: 'מודעות פרויקט',
  neighborhood_content: 'תוכן שכונתי',
  developer_asset: 'נכס יזם',
};

/* ── Base Intelligence Notes per Format ──────────────────────────────── */

const FORMAT_INTELLIGENCE: Record<CampaignAssetFormat, string> = {
  feed_post: 'פוסט פיד ליצירת מעורבות עם קהל היעד הראשי',
  story: 'סטורי ליצירת דחיפות וקריאה לפעולה מהירה',
  carousel: 'קרוסלה לטיפול בהתנגדויות ושכנוע מעמיק',
  reel_cover: 'כיסוי ריל למשיכת תשומת לב בגלילה',
  banner: 'באנר לתמיכה בתנועה חוזרת',
  website_hero: 'תמונת גיבור לאתר ליצירת רושם ראשון חזק',
  email_header: 'כותרת אימייל להעלאת שיעור פתיחה',
  google_display: 'מודעת תצוגה בגוגל להגעה לקהל רחב',
  property_story: 'סטורי נכס עם דגש על חוויית מגורים',
  property_carousel: 'קרוסלת נכס להצגת פרטים ותמונות',
  seller_recruitment: 'נכס גיוס מוכרים — הצגת ערך לבעלי נכסים',
  buyer_recruitment: 'נכס גיוס קונים — משיכת רוכשים פוטנציאליים',
  project_awareness: 'מודעות לפרויקט — הכרת המותג והחזון',
  neighborhood_content: 'תוכן שכונתי — סיפור המקום והסביבה',
  developer_asset: 'נכס יזם — חיזוק מותג היזם והחברה',
};

/* ── Campaign Type Context Enrichment ────────────────────────────────── */

const CAMPAIGN_TYPE_CONTEXT: Record<CampaignFactoryType, string> = {
  lead_generation: 'ממוקד המרות ואיסוף פרטים',
  brand_awareness: 'ממוקד חשיפה וחיבור רגשי למותג',
  launch_campaign: 'ממוקד הגעה מקסימלית וייצור באזז',
  sales_campaign: 'ממוקד מכירות ישירות ודחיפות',
  project_marketing: 'ממוקד הצגת פרויקט ובניית אמון',
  real_estate_project_launch: 'ממוקד השקת פרויקט וייצור ביקוש ראשוני',
  property_marketing: 'ממוקד הצגת נכס ומשיכת מתעניינים',
  holiday_campaign: 'ממוקד חיבור רגשי לחג ומבצעים עונתיים',
  recruitment_campaign: 'ממוקד גיוס עובדים והצגת ערך מעסיק',
  event_campaign: 'ממוקד מילוי מקומות ויצירת ציפייה',
  website_traffic: 'ממוקד הבאת תנועה איכותית לאתר',
  remarketing: 'ממוקד חזרה ללקוחות שכבר הביעו עניין',
  custom: 'מותאם אישית למטרות הקמפיין',
};

/* ── Public API ───────────────────────────────────────────────────────── */

/**
 * Get intelligence explanation for a specific campaign asset.
 * Combines format purpose + campaign type context + DNA emotional angle.
 */
export function getAssetIntelligence(
  format: CampaignAssetFormat,
  campaignType: CampaignFactoryType,
  campaignDna: CampaignDNA,
  index: number,
): string {
  const baseNote = FORMAT_INTELLIGENCE[format] ?? 'נכס קמפיין';
  const typeContext = CAMPAIGN_TYPE_CONTEXT[campaignType] ?? '';
  const emotional = campaignDna.emotionalAngle
    ? ` | זווית רגשית: ${campaignDna.emotionalAngle}`
    : '';
  const urgencyTag = campaignDna.urgency >= 70 ? ' | דחיפות גבוהה' : '';
  const indexLabel = index > 0 ? ` (וריאציה ${index + 1})` : '';

  return `${baseNote}${indexLabel} — ${typeContext}${emotional}${urgencyTag}`;
}

/**
 * Get Hebrew label for a campaign type.
 */
export function getCampaignTypeLabel(type: CampaignFactoryType): string {
  return CAMPAIGN_TYPE_LABELS[type] ?? type;
}

/**
 * Get Hebrew label for an asset format.
 */
export function getCampaignAssetFormatLabel(format: CampaignAssetFormat): string {
  return ASSET_FORMAT_LABELS[format] ?? format;
}

/**
 * Get the standard asset manifest for a given campaign type + industry.
 * Returns the list of assets to generate with count and purpose.
 */
export function getStandardAssetManifest(
  campaignType: CampaignFactoryType,
  industry: string,
): Array<{ format: CampaignAssetFormat; count: number; purpose: string }> {
  // Base manifest — standard for all campaign types
  const manifest: Array<{ format: CampaignAssetFormat; count: number; purpose: string }> = [
    { format: 'feed_post', count: 3, purpose: 'פוסטי פיד למעורבות עם קהל יעד ראשי' },
    { format: 'story', count: 3, purpose: 'סטוריז ליצירת דחיפות וקריאה לפעולה' },
    { format: 'carousel', count: 1, purpose: 'קרוסלה לטיפול בהתנגדויות ושכנוע' },
    { format: 'reel_cover', count: 1, purpose: 'כיסוי ריל למשיכת תשומת לב' },
    { format: 'banner', count: 1, purpose: 'באנר לקמפיין רשת המדיה' },
    { format: 'website_hero', count: 1, purpose: 'תמונת גיבור לאתר' },
    { format: 'email_header', count: 1, purpose: 'כותרת לניוזלטר/אימייל מרקטינג' },
    { format: 'google_display', count: 1, purpose: 'מודעת גוגל דיספליי' },
  ];

  // Real estate additions
  const isRealEstate = industry.includes('נדל') ||
    industry.toLowerCase().includes('real_estate') ||
    industry.toLowerCase().includes('real estate') ||
    campaignType === 'real_estate_project_launch' ||
    campaignType === 'property_marketing';

  if (isRealEstate) {
    manifest.push(
      { format: 'property_story', count: 1, purpose: 'סטורי נכס עם דגש על חוויית מגורים' },
      { format: 'property_carousel', count: 1, purpose: 'קרוסלת נכס להצגת פרטים ותמונות' },
      { format: 'seller_recruitment', count: 1, purpose: 'גיוס בעלי נכסים למכירה' },
      { format: 'buyer_recruitment', count: 1, purpose: 'משיכת קונים פוטנציאליים' },
    );
  }

  // Event campaign additions
  if (campaignType === 'event_campaign') {
    manifest.push(
      { format: 'project_awareness', count: 1, purpose: 'מודעות לאירוע והזמנה' },
    );
  }

  // Real estate project launch additions
  if (campaignType === 'real_estate_project_launch') {
    manifest.push(
      { format: 'project_awareness', count: 1, purpose: 'מודעות לפרויקט — הכרת המותג' },
      { format: 'neighborhood_content', count: 1, purpose: 'תוכן שכונתי — סיפור המקום' },
      { format: 'developer_asset', count: 1, purpose: 'חיזוק מותג היזם' },
    );
  }

  return manifest;
}
