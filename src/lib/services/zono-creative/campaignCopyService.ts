/**
 * Campaign Copy Service — Generates all copy for a campaign using AI
 *
 * Builds a structured prompt for GPT-4.1, requesting Hebrew marketing copy
 * across all asset types. Falls back to deterministic mock copy if AI is unavailable.
 *
 * Server-side only.
 */
import type {
  CampaignCopySet,
  CampaignDNA,
  CampaignFactoryType,
} from '@/lib/db/schema';
import { generateWithAI } from '@/lib/ai/openai-client';

/* ── Campaign Type Names (for prompt context) ────────────────────────── */

const CAMPAIGN_TYPE_NAMES: Record<CampaignFactoryType, string> = {
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
  custom: 'קמפיין מותאם אישית',
};

/* ── AI Copy Generation ──────────────────────────────────────────────── */

interface ParsedCopyResponse {
  headlines: string[];
  subHeadlines: string[];
  ctaVariations: string[];
  offerVariations: string[];
  socialCaptions: string[];
  storyCaptions: string[];
  carouselSlidesCopy: string[];
  bannerCopy: string[];
  websiteHeroCopy: string[];
  emailSubjectIdeas: string[];
}

function buildSystemPrompt(): string {
  return `אתה קופירייטר מקצועי לקמפיינים שיווקיים בעברית.
אתה מתמחה בכתיבת קופי שיווקי ממיר, מדויק ומותאם לפלטפורמות דיגיטליות.

כללים:
- כל התוצרים בעברית בלבד
- כותרות קצרות, חדות, ממוקדות
- קריאות לפעולה ברורות ודוחפות
- כיתובים לרשתות חברתיות עם אימוג'ים מתאימים
- התאמה מדויקת לסוג הקמפיין ולקהל היעד
- שימוש בטריגרים רגשיים מתאימים
- הימנעות מקלישאות ומניסוחים שחוקים

אתה מחזיר תשובה בפורמט JSON בלבד, ללא טקסט נוסף.`;
}

function buildUserPrompt(params: {
  campaignType: CampaignFactoryType;
  campaignDna: CampaignDNA;
  title: string;
  objective: string;
  targetAudience: string;
  offer: string;
  mainMessage: string;
  industry: string;
  clientName: string;
  brandStyleType?: string;
}): string {
  const {
    campaignType,
    campaignDna,
    title,
    objective,
    targetAudience,
    offer,
    mainMessage,
    industry,
    clientName,
    brandStyleType,
  } = params;

  const campaignTypeName = CAMPAIGN_TYPE_NAMES[campaignType] ?? campaignType;

  return `צור קופי שיווקי מלא לקמפיין הבא:

═══ פרטי הקמפיין ═══
שם הקמפיין: ${title}
סוג הקמפיין: ${campaignTypeName}
מטרה: ${objective}
קהל יעד: ${targetAudience}
הצעת ערך: ${offer}
מסר מרכזי: ${mainMessage}
תחום: ${industry}
שם הלקוח/מותג: ${clientName}
${brandStyleType ? `סגנון מותגי: ${brandStyleType}` : ''}

═══ DNA קמפיין ═══
דחיפות: ${campaignDna.urgency}/100
רמת CTA: ${campaignDna.ctaLevel}/100
אגרסיביות מכירתית: ${campaignDna.salesAggressiveness}/100
עוצמה ויזואלית: ${campaignDna.visualIntensity}/100
זווית רגשית: ${campaignDna.emotionalAngle}
טון דיבור: ${campaignDna.toneOfVoice}
מילות מפתח: ${campaignDna.moodKeywords.join(', ')}

═══ מה לייצר (JSON) ═══
החזר JSON עם המבנה הבא בדיוק:
{
  "headlines": ["5 כותרות ראשיות שונות"],
  "subHeadlines": ["5 כותרות משנה שונות"],
  "ctaVariations": ["5 טקסטים לכפתורי קריאה לפעולה"],
  "offerVariations": ["3 ניסוחים שונים של ההצעה"],
  "socialCaptions": ["3 כיתובים לפוסטים ברשתות חברתיות עם אימוג'ים"],
  "storyCaptions": ["3 כיתובים קצרים לסטוריז"],
  "carouselSlidesCopy": ["5 טקסטים לשקופיות קרוסלה"],
  "bannerCopy": ["3 שילובי כותרת+תת-כותרת לבאנרים"],
  "websiteHeroCopy": ["2 טקסטים לסקשן גיבור באתר"],
  "emailSubjectIdeas": ["3 נושאים לאימייל"]
}

חשוב: החזר JSON תקין בלבד, בלי טקסט לפני או אחרי.`;
}

function isValidCopyResponse(data: unknown): data is ParsedCopyResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.headlines) &&
    Array.isArray(obj.subHeadlines) &&
    Array.isArray(obj.ctaVariations) &&
    Array.isArray(obj.offerVariations) &&
    Array.isArray(obj.socialCaptions) &&
    Array.isArray(obj.storyCaptions) &&
    Array.isArray(obj.carouselSlidesCopy) &&
    Array.isArray(obj.bannerCopy) &&
    Array.isArray(obj.websiteHeroCopy) &&
    Array.isArray(obj.emailSubjectIdeas)
  );
}

/* ── Mock Copy Fallback ──────────────────────────────────────────────── */

function generateMockCopy(params: {
  campaignType: CampaignFactoryType;
  offer: string;
  mainMessage: string;
  targetAudience: string;
  clientName: string;
}): ParsedCopyResponse {
  const { campaignType, offer, mainMessage, targetAudience, clientName } = params;

  // Type-specific mock templates
  const mocksByType: Record<string, Partial<ParsedCopyResponse>> = {
    lead_generation: {
      headlines: [
        `${mainMessage} — הזדמנות שלא חוזרת`,
        `${offer} | מוגבל למצטרפים החדשים`,
        `הגיע הזמן ל${mainMessage}`,
        `${clientName} מציע: ${offer}`,
        `רוצים ${mainMessage}? הנה ההזדמנות`,
      ],
      ctaVariations: ['השאירו פרטים עכשיו', 'קבלו הצעה חינם', 'בואו נדבר', 'לפרטים נוספים', 'רוצה לשמוע עוד?'],
    },
    sales_campaign: {
      headlines: [
        `🔥 ${offer} — רק היום!`,
        `מבצע מטורף: ${mainMessage}`,
        `${clientName} — ${offer} לזמן מוגבל`,
        `הנחה מיוחדת על ${mainMessage}`,
        `לא תמצאו יותר זול — ${offer}`,
      ],
      ctaVariations: ['קנו עכשיו', 'לרכישה מיידית', 'תפסו את המבצע', 'הזמינו היום', 'מנצלים את ההנחה'],
    },
    brand_awareness: {
      headlines: [
        `מכירים את ${clientName}?`,
        `${mainMessage} — הסיפור שלנו`,
        `${clientName}: ערכים שמדברים`,
        `למה ${clientName}? כי ${mainMessage}`,
        `גלו את ${clientName}`,
      ],
      ctaVariations: ['למדו עוד', 'גלו את הסיפור שלנו', 'הצטרפו לקהילה', 'בואו להכיר', 'עקבו אחרינו'],
    },
    launch_campaign: {
      headlines: [
        `🚀 ${mainMessage} — סוף סוף כאן!`,
        `${clientName} משיק: ${offer}`,
        `חדש! ${mainMessage}`,
        `ההשקה הגדולה של ${clientName}`,
        `${offer} — הראשונים ליהנות`,
      ],
      ctaVariations: ['הירשמו להשקה', 'היו הראשונים', 'גלו את החדש', 'הצטרפו עכשיו', 'אל תפספסו'],
    },
    remarketing: {
      headlines: [
        `עדיין חושבים על ${mainMessage}?`,
        `ההצעה עדיין מחכה לכם — ${offer}`,
        `חזרנו עם הצעה טובה עוד יותר`,
        `${clientName} — זוכרים אותנו?`,
        `לא סגרתם? הנה סיבה לחזור`,
      ],
      ctaVariations: ['חזרו אלינו', 'סגרו עכשיו', 'ההצעה עדיין בתוקף', 'השלימו את הרכישה', 'בואו נסגור'],
    },
  };

  const typeSpecific = mocksByType[campaignType] ?? {};

  return {
    headlines: typeSpecific.headlines ?? [
      `${mainMessage}`,
      `${clientName} — ${offer}`,
      `${mainMessage} | ${clientName}`,
      `הגיע הזמן ל${mainMessage}`,
      `${offer} — ההזדמנות שלכם`,
    ],
    subHeadlines: [
      `${offer} — הצעה מיוחדת ל${targetAudience}`,
      `${mainMessage} שישנה לכם את החיים`,
      `${clientName} מביא את הפתרון המושלם`,
      `מיועד במיוחד ל${targetAudience}`,
      `הזדמנות חד-פעמית — ${offer}`,
    ],
    ctaVariations: typeSpecific.ctaVariations ?? [
      'צרו קשר עכשיו',
      'לפרטים נוספים',
      'הצטרפו אלינו',
      'התחילו היום',
      'בואו נדבר',
    ],
    offerVariations: [
      offer,
      `${offer} — במיוחד בשבילכם`,
      `${offer} לזמן מוגבל`,
    ],
    socialCaptions: [
      `✨ ${mainMessage}\n\n${offer}\n\n👇 לפרטים נוספים לחצו על הקישור`,
      `🔥 ${clientName} מציג: ${mainMessage}\n\n💡 ${offer}\n\nתייגו חבר שצריך לדעת! 👇`,
      `💪 ${mainMessage}\n\n🎯 מיועד ל${targetAudience}\n\n${offer}\n\nלינק בביו 🔗`,
    ],
    storyCaptions: [
      `${mainMessage} ⬆️ לפרטים`,
      `${offer} 🔥 החליקו למעלה`,
      `${clientName} | ${mainMessage}`,
    ],
    carouselSlidesCopy: [
      `שקופית 1: ${mainMessage}`,
      `שקופית 2: למה ${clientName}?`,
      `שקופית 3: ${offer}`,
      `שקופית 4: מה אומרים הלקוחות`,
      `שקופית 5: ${typeSpecific.ctaVariations?.[0] ?? 'צרו קשר עכשיו'} 👇`,
    ],
    bannerCopy: [
      `${mainMessage} | ${typeSpecific.ctaVariations?.[0] ?? 'לפרטים'}`,
      `${offer} — ${clientName}`,
      `${clientName}: ${mainMessage}`,
    ],
    websiteHeroCopy: [
      `${mainMessage}\n${offer}`,
      `${clientName} — ${mainMessage}\nההזדמנות שחיכיתם לה`,
    ],
    emailSubjectIdeas: [
      `${mainMessage} — ${clientName}`,
      `הצעה מיוחדת: ${offer}`,
      `${clientName}: משהו חדש מחכה לכם`,
    ],
  };
}

/* ── Main Export ──────────────────────────────────────────────────────── */

/**
 * Generate full campaign copy set using AI (or mock fallback).
 * Returns a CampaignCopySet without id/campaignId/clientId — the orchestrator adds those.
 */
export async function generateCampaignCopy(params: {
  campaignType: CampaignFactoryType;
  campaignDna: CampaignDNA;
  title: string;
  objective: string;
  targetAudience: string;
  offer: string;
  mainMessage: string;
  industry: string;
  clientName: string;
  brandStyleType?: string;
}): Promise<Omit<CampaignCopySet, 'id' | 'campaignId' | 'clientId'>> {
  const {
    campaignType,
    campaignDna,
    title,
    objective,
    targetAudience,
    offer,
    mainMessage,
    industry,
    clientName,
    brandStyleType,
  } = params;

  const now = new Date().toISOString();

  // Attempt AI generation
  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({
      campaignType,
      campaignDna,
      title,
      objective,
      targetAudience,
      offer,
      mainMessage,
      industry,
      clientName,
      brandStyleType,
    });

    const result = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.8,
      maxTokens: 4000,
    });

    if (result.success && result.data) {
      // generateWithAI auto-parses JSON — data is already an object if JSON was valid
      const parsed = typeof result.data === 'string'
        ? (() => { try { return JSON.parse(result.data as string); } catch { return null; } })()
        : result.data;

      if (parsed && isValidCopyResponse(parsed)) {
        console.log('[campaignCopyService] AI copy generated successfully');
        return {
          headlines: parsed.headlines,
          subHeadlines: parsed.subHeadlines,
          ctaVariations: parsed.ctaVariations,
          offerVariations: parsed.offerVariations,
          socialCaptions: parsed.socialCaptions,
          storyCaptions: parsed.storyCaptions,
          carouselSlidesCopy: parsed.carouselSlidesCopy,
          bannerCopy: parsed.bannerCopy,
          websiteHeroCopy: parsed.websiteHeroCopy,
          emailSubjectIdeas: parsed.emailSubjectIdeas,
          createdAt: now,
        };
      }

      console.warn('[campaignCopyService] AI response failed validation, falling back to mock');
    } else {
      console.warn('[campaignCopyService] AI generation failed:', result.error, '— falling back to mock');
    }
  } catch (err) {
    console.warn('[campaignCopyService] AI error, falling back to mock:', err);
  }

  // Fallback: deterministic mock copy
  console.log('[campaignCopyService] Using mock copy generation');
  const mock = generateMockCopy({
    campaignType,
    offer,
    mainMessage,
    targetAudience,
    clientName,
  });

  return {
    ...mock,
    createdAt: now,
  };
}
