/**
 * Creative Concept Generation Prompts
 * Server-side only — never import in client components.
 */

import { ENTITY_TYPE_LABELS } from './aiMarketingDNAProvider';

/* ── Concept Type Labels (Hebrew) ─────────────────────────────────── */

export const CONCEPT_TYPE_LABELS: Record<string, string> = {
  luxury_lifestyle: 'לייף סטייל יוקרתי',
  investment_opportunity: 'הזדמנות השקעה',
  neighborhood_story: 'סיפור שכונה',
  dream_home: 'בית חלומות',
  family_living: 'מגורי משפחות',
  exclusive_listing: 'נכס בלעדי',
  premium_penthouse: 'פנטהאוז פרימיום',
  garden_apartment: 'דירת גן',
  first_home: 'דירה ראשונה',
  upgrade_your_life: 'שדרוג איכות חיים',
  seller_recruitment: 'גיוס מוכרים',
  buyer_recruitment: 'גיוס קונים',
  project_launch: 'השקת פרויקט',
  pre_sale: 'מכירה מוקדמת',
  authority_agent: 'סוכן סמכותי',
  neighborhood_expert: 'מומחה שכונה',
  developer_prestige: 'יוקרת יזם',
  community_living: 'חיי קהילה',
  location_advantage: 'יתרון מיקום',
  urban_lifestyle: 'לייף סטייל עירוני',
  beach_lifestyle: 'לייף סטייל חוף',
  high_roi: 'תשואה גבוהה',
  future_appreciation: 'עליית ערך עתידית',
};

/* ── Property Type Labels ─────────────────────────────────────────── */

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'דירה',
  penthouse: 'פנטהאוז',
  garden_apartment: 'דירת גן',
  duplex: 'דופלקס',
  villa: 'וילה',
  office: 'משרד',
  commercial: 'מסחרי',
  project: 'פרויקט',
};

export const AUDIENCE_LABELS: Record<string, string> = {
  investor: 'משקיע',
  upgrader: 'משדרג דיור',
  first_home_buyer: 'רוכש דירה ראשונה',
  luxury_buyer: 'רוכש יוקרה',
  family: 'משפחה',
  retiree: 'גמלאי',
};

/* ── System Prompt ─────────────────────────────────────────────────── */

export function buildConceptSystemPrompt(entityType: string, entityName: string): string {
  const entityLabel = ENTITY_TYPE_LABELS[entityType] || entityType;

  return `אתה אסטרטג שיווק נדל"ן ישראלי בכיר, מומחה Meta Ads, ומומחה המרת לידים.

תפקידך: לייצר קונספטים שיווקיים עבור ${entityLabel}: "${entityName}".

כל קונספט הוא כיוון שיווקי אסטרטגי — לא מודעה מוגמרת.
קונספט = רעיון מרכזי + זווית שיווקית + טריגר רגשי + Hook ויזואלי + Hook קופי + המלצת CTA + קהל יעד.

חשוב:
- כל קונספט חייב להיות רלוונטי לשוק הנדל"ן הישראלי
- השפה חייבת להיות עברית שיווקית חזקה
- כל קונספט חייב להיות שונה מהאחרים
- התבסס על ה-DNA השיווקי שקיבלת
- אם יש מידע על שכונה/עיר/פרויקט — השתמש בו
- קונספטים צריכים לעבוד ב-Meta Ads (Facebook + Instagram)

סוגי קונספטים אפשריים:
${Object.entries(CONCEPT_TYPE_LABELS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

סוגי נכסים:
${Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

סוגי קהלים:
${Object.entries(AUDIENCE_LABELS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

ענה ב-JSON בלבד. החזר מערך של 4-8 קונספטים בפורמט הבא:
{
  "concepts": [
    {
      "title": "כותרת הקונספט בעברית (קצרה, חזקה, שיווקית)",
      "concept_type": "אחד מסוגי הקונספטים למעלה (באנגלית, snake_case)",
      "description": "תיאור הקונספט — 2-3 משפטים",
      "marketing_angle": "הזווית השיווקית — FOMO, בלעדיות, הזדמנות, יוקרה, קהילה וכו'",
      "emotional_trigger": "הטריגר הרגשי — פחד מהפסד, גאווה, ביטחון, חלום וכו'",
      "visual_hook": "תיאור ה-Hook הויזואלי — מה התמונה/וידאו צריכים להראות",
      "copy_hook": "משפט הפתיחה לקופי — המשפט הראשון שתופס את העין",
      "recommended_layout": "סוג הלייאאוט המומלץ — hero image, split, carousel, story וכו'",
      "recommended_cta_style": "סגנון CTA מומלץ — לתיאום צפייה, להשאיר פרטים, WhatsApp וכו'",
      "recommended_audience": "קהל יעד מומלץ — investor, upgrader, first_home_buyer, luxury_buyer, family, retiree",
      "confidence_score": 75,
      "reasoning": "למה ZONO חושב שהקונספט הזה מתאים — 1-2 משפטים"
    }
  ]
}

חוקים לציון ביטחון (confidence_score):
- 85-95: DNA חזק + מידע מקומי + דפוסים מאושרים רלוונטיים
- 70-84: DNA טוב + התאמה כללית
- 50-69: מידע חלקי, קונספט כללי יותר
- מתחת ל-50: אין מספיק מידע, ניחוש`;
}

/* ── User Prompt ────────────────────────────────────────────────────── */

export interface ConceptUserPromptParams {
  entityType: string;
  entityName: string;
  entityId: string;
  dnaSummary: string;
  dnaScores: Record<string, number>;
  approvedPatterns: string[];
  rejectedPatterns: string[];
  preferredAngles: string[];
  rejectedAngles: string[];
  targetAudiences: string[];
  realEstatePositioning: string;
  propertyMarketingStyle: string;
  projectMarketingStyle: string;
  agentMarketingStyle: string;
  neighborhoodStyle: string;
  feedbackSummary: string;
}

export function buildConceptUserPrompt(params: ConceptUserPromptParams): string {
  const entityLabel = ENTITY_TYPE_LABELS[params.entityType] || params.entityType;

  const scoreLines = Object.entries(params.dnaScores)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `  ${k}: ${v}/100`)
    .join('\n');

  return `צור קונספטים שיווקיים עבור ${entityLabel}: "${params.entityName}"

=== DNA שיווקי ===
${params.dnaSummary || 'אין סיכום DNA זמין'}

=== ציונים ===
${scoreLines || 'אין ציונים זמינים'}

=== מיצוב נדל"ן ===
${params.realEstatePositioning || 'לא הוגדר'}

=== דפוסים מאושרים ===
${params.approvedPatterns.length > 0 ? params.approvedPatterns.join(', ') : 'אין'}

=== דפוסים שנדחו ===
${params.rejectedPatterns.length > 0 ? params.rejectedPatterns.join(', ') : 'אין'}

=== זוויות שיווק מועדפות ===
${params.preferredAngles.length > 0 ? params.preferredAngles.join(', ') : 'אין'}

=== זוויות שיווק שנדחו ===
${params.rejectedAngles.length > 0 ? params.rejectedAngles.join(', ') : 'אין'}

=== קהלי יעד ===
${params.targetAudiences.length > 0 ? params.targetAudiences.join(', ') : 'לא הוגדרו'}

=== סגנון שיווק נכס ===
${params.propertyMarketingStyle || 'לא הוגדר'}

=== סגנון שיווק פרויקט ===
${params.projectMarketingStyle || 'לא הוגדר'}

=== סגנון שיווק סוכן ===
${params.agentMarketingStyle || 'לא הוגדר'}

=== סגנון סיפור שכונה ===
${params.neighborhoodStyle || 'לא הוגדר'}

=== משוב קודם ===
${params.feedbackSummary || 'אין משוב זמין'}

=== הנחיות ===
1. צור 4-8 קונספטים שונים
2. כל קונספט מסוג אחר (concept_type)
3. התבסס על ה-DNA והציונים
4. אם יש דפוסים מאושרים — העדף אותם
5. אם יש דפוסים שנדחו — הימנע מהם
6. הקונספטים צריכים להיות מגוונים — מיקס של רגשי, עסקי, ומקומי
7. החזר JSON בלבד, ללא טקסט נוסף`;
}
