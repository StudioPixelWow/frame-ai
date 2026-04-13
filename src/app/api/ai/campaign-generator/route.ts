import { NextRequest, NextResponse } from 'next/server';
import { generateWithAI, getClientResearchContext } from '@/lib/ai/openai-client';
import { getApiKeys } from '@/lib/db/api-keys';
import { getRelevantHolidays, getHolidaysForMonth } from '@/lib/israeli-holidays';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ClientBrain {
  toneOfVoice?: string;
  sellingPoints?: string[];
  audienceProfile?: string;
}

interface CampaignGeneratorRequest {
  clientId: string;
  clientName: string;
  businessType: string;
  targetAudience: string;
  marketingGoals: string[];
  month: number;
  year: number;
  platforms: Array<'facebook' | 'instagram' | 'tiktok'>;
  itemCount: number;
  clientBrain?: ClientBrain;
}

interface Campaign {
  id: string;
  name: string;
  coreIdea: string;
  messagingAngle: string;
  targetAudience: string;
  funnelStage: 'awareness' | 'engagement' | 'conversion';
}

interface ContentItem {
  campaignId: string;
  funnelStage: 'awareness' | 'engagement' | 'conversion';
  title: string;
  hook: string;
  mainMessage: string;
  cta: string;
  visualConcept: string;
  platform: 'facebook' | 'instagram' | 'tiktok';
  format: 'image' | 'video' | 'reel' | 'carousel' | 'story';
  dayOfMonth: number;
  holidayTag: string | null;
}

interface CampaignGeneratorResponse {
  campaigns: Campaign[];
  contentItems: ContentItem[];
  debug: {
    latencyMs: number;
    itemCount: number;
    campaignCount: number;
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateRequest(body: unknown): { valid: true; data: CampaignGeneratorRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const req = body as Record<string, unknown>;

  if (!req.clientId || typeof req.clientId !== 'string') {
    return { valid: false, error: 'clientId is required and must be a string' };
  }
  if (!req.clientName || typeof req.clientName !== 'string') {
    return { valid: false, error: 'clientName is required and must be a string' };
  }
  if (!req.businessType || typeof req.businessType !== 'string') {
    return { valid: false, error: 'businessType is required and must be a string' };
  }
  if (!req.targetAudience || typeof req.targetAudience !== 'string') {
    return { valid: false, error: 'targetAudience is required and must be a string' };
  }
  if (!Array.isArray(req.marketingGoals) || req.marketingGoals.length === 0) {
    return { valid: false, error: 'marketingGoals must be a non-empty array' };
  }
  if (!req.month || typeof req.month !== 'number' || req.month < 1 || req.month > 12) {
    return { valid: false, error: 'month must be a number between 1 and 12' };
  }
  if (!req.year || typeof req.year !== 'number' || req.year < 2024 || req.year > 2030) {
    return { valid: false, error: 'year must be a number between 2024 and 2030' };
  }
  if (!Array.isArray(req.platforms) || req.platforms.length === 0) {
    return { valid: false, error: 'platforms must be a non-empty array' };
  }
  if (!req.itemCount || typeof req.itemCount !== 'number' || req.itemCount < 15 || req.itemCount > 30) {
    return { valid: false, error: 'itemCount must be a number between 15 and 30' };
  }

  return {
    valid: true,
    data: {
      clientId: req.clientId as string,
      clientName: req.clientName as string,
      businessType: req.businessType as string,
      targetAudience: req.targetAudience as string,
      marketingGoals: req.marketingGoals as string[],
      month: req.month as number,
      year: req.year as number,
      platforms: req.platforms as Array<'facebook' | 'instagram' | 'tiktok'>,
      itemCount: req.itemCount as number,
      clientBrain: req.clientBrain as ClientBrain | undefined,
    },
  };
}

// ============================================================================
// FALLBACK GENERATOR (No OpenAI)
// ============================================================================

function generateFallbackCampaigns(req: CampaignGeneratorRequest): CampaignGeneratorResponse {
  console.log('[campaign-generator] Generating fallback campaigns (no OpenAI key)');

  const campaigns: Campaign[] = [
    {
      id: 'camp-awareness',
      name: 'קמפיין מודעות',
      coreIdea: 'הכרות ראשונה עם המותג',
      messagingAngle: 'ערך ייחודי וחדשנות',
      targetAudience: req.targetAudience,
      funnelStage: 'awareness',
    },
    {
      id: 'camp-engagement',
      name: 'קמפיין אנגייג\'מנט',
      coreIdea: 'בנייה יחסים עם הקהל',
      messagingAngle: 'משפחה וקהילה',
      targetAudience: req.targetAudience,
      funnelStage: 'engagement',
    },
    {
      id: 'camp-conversion',
      name: 'קמפיין המרה',
      coreIdea: 'הדחף הסופי להרכישה',
      messagingAngle: 'דחיפות וערך מיידי',
      targetAudience: req.targetAudience,
      funnelStage: 'conversion',
    },
  ];

  const holidays = getRelevantHolidays(req.month, req.businessType);
  const contentItems: ContentItem[] = [];
  let dayCounter = 1;

  for (let i = 0; i < req.itemCount; i++) {
    const campIdx = Math.floor((i / req.itemCount) * 3);
    const campaign = campaigns[campIdx];
    const platform = req.platforms[i % req.platforms.length];
    const funnelStage = campaign.funnelStage;
    const holiday = holidays[i % (holidays.length || 1)] || null;

    const formats: Array<'image' | 'video' | 'reel' | 'carousel' | 'story'> =
      platform === 'instagram' ? ['reel', 'carousel', 'story'] :
      platform === 'tiktok' ? ['video'] :
      ['image', 'carousel'];

    contentItems.push({
      campaignId: campaign.id,
      funnelStage: funnelStage,
      title: `תוכן ${funnelStage} - ${i + 1}`,
      hook: 'שנו את המשחק היום',
      mainMessage: `גלה כיצד ${req.clientName} יכול לעזור לך`,
      cta: 'קרא עוד',
      visualConcept: 'רקע נקי, צבע כחול בהיר, לוגו ממותג בפינה',
      platform: platform,
      format: formats[i % formats.length],
      dayOfMonth: (dayCounter % 28) + 1,
      holidayTag: holiday ? holiday.hebrewName : null,
    });

    dayCounter++;
  }

  return {
    campaigns,
    contentItems: contentItems.slice(0, req.itemCount),
    debug: {
      latencyMs: 0,
      itemCount: contentItems.length,
      campaignCount: 3,
    },
  };
}

// ============================================================================
// AI PROMPT CONSTRUCTION
// ============================================================================

function buildSystemPrompt(clientBrain?: ClientBrain): string {
  let prompt = `אתה אסטרטג מיתוג עליון בדרגה ראשונה עם ניסיון של 15+ שנים בשיווק דיגיטלי בישראל.

אתה מומחה בעיצוב קמפיינים שמניבים תוצאות ממשיות: מודעות, אנגייג'מנט והמרות.

כללי היצירה שלך:
1. יצור 3 קמפיינים ליבה: אחד לתודעה, אחד לאנגייג'מנט, ואחד להמרה
2. כל קמפיין צריך לכסות זווית מסרים שונה לחלוטין - אין חזרות או דמיון
3. כל פריט תוכן צריך להיות ייחודי בעצמו - אין שניים שהם "כמו זה"
4. הטון: בעיזה רם, שחוקי, בעל ערך - לא גנרי, לא שטוח
5. חוקים: המוד, צבע וגוון לא יתרחשו בתוכן דומה - זה קשוח

לגבי תוכן ויזואלי:
- הוראות ויזואליות חייבות להיות דיוק תל אביבי: צבעים נוזלים, עומקים קונקרטיים, מרקמים, טקסטורות
- לא תיאור גנרי כמו "צבע כחול" - זה תהיה "כחול לרוגן כהה עם הוורוזה זהב מתכתית 3D"
- כל ראי חזקתי חייב לכלול: רקע, צבעים, עצמים, זווית מצלמה, מצב רוח

לגבי Hooks:
- 5-10 מילים בעברית שעוצרות גלילה בעזה
- השתמש בדחיפות: שאלות, סתירות, פרטים מפתיעים
- בעדיפות: "איך?", "למה?", "כמה?", "לא יש לך..."

CTAs:
- ברור והוראה מיידית: "הזמן עכשיו", "צפה בדקה אחת", "שתף עם חברים"
- מניע דחיפות: דירוגים מוגבלים, סקרים, או קריאות יעילות

פיזור תוכן:
- ~40% מודעות (ריחוק רחוק, חדש, "למה אתה צריך")
- ~30% אנגייג'מנט (סיפורים, תביעות קהילה, חוויות)
- ~30% המרה (מחירים, הנחות, הוכחה חברתית, דחיפות)`;

  if (clientBrain) {
    if (clientBrain.toneOfVoice) {
      prompt += `\n\nטון הקול של המותג: ${clientBrain.toneOfVoice}`;
    }
    if (clientBrain.sellingPoints && clientBrain.sellingPoints.length > 0) {
      prompt += `\nנקודות מכירה חזקות: ${clientBrain.sellingPoints.join(', ')}`;
    }
    if (clientBrain.audienceProfile) {
      prompt += `\nפרופיל קהל יעד: ${clientBrain.audienceProfile}`;
    }
  }

  return prompt;
}

function buildUserPrompt(req: CampaignGeneratorRequest, holidays: ReturnType<typeof getRelevantHolidays>): string {
  let prompt = `## בקשה להרכיב קמפיין מיתוג

**לקוח:** ${req.clientName}
**סוג עסק:** ${req.businessType}
**קהל יעד:** ${req.targetAudience}
**מטרות שיווק:** ${req.marketingGoals.join(', ')}
**חודש:** ${req.month} / ${req.year}
**פלטפורמות:** ${req.platforms.join(', ')}
**מספר פריטי תוכן:** ${req.itemCount}

${holidays.length > 0 ? `**חגים/אירועים רלוונטיים:** ${holidays.map(h => `${h.hebrewName} (יום ~${h.approximateDay})`).join(', ')}` : ''}

## דרישה ליציאה

ה-JSON שלהלן, בדיוק כזה:

\`\`\`json
{
  "campaigns": [
    {
      "id": "camp-1",
      "name": "שם קמפיין בעברית",
      "coreIdea": "מה הרעיון המרכזי",
      "messagingAngle": "זווית המסרים",
      "targetAudience": "קהל יעד ספציפי לקמפיין זה",
      "funnelStage": "awareness|engagement|conversion"
    },
    ... (3 campaigns total)
  ],
  "contentItems": [
    {
      "campaignId": "camp-1",
      "funnelStage": "awareness|engagement|conversion",
      "title": "כותרת ממוקדת",
      "hook": "5-10 words only in Hebrew, scroll-stopping",
      "mainMessage": "הערך/הכאב/הפתרון",
      "cta": "קריאה לפעולה ברורה",
      "visualConcept": "תיאור מדויק: רקע (צבע + טקסטורה), עצמים, קו צבע, מצב רוח. מינימום 20 מילים.",
      "platform": "facebook|instagram|tiktok",
      "format": "image|video|reel|carousel|story",
      "dayOfMonth": 1-31,
      "holidayTag": "שם חג או null"
    },
    ... (${req.itemCount} items total)
  ]
}
\`\`\`

דרישות קריטיות:
1. יוצא JSON תקין בלבד
2. כל ${req.itemCount} פריטים צריכים להיות ייחודיים - אין שנים אחד כמו השני
3. Hooks בעברית, 5-10 מילים כל אחד
4. Visual concepts מדויקים ולא גנריים (צבעים קונקרטיים, טקסטורות, מוד)
5. CTAs פעולה מיידית וברורה
6. חלוקה כמו שתואר: ~40% awareness, ~30% engagement, ~30% conversion
7. אם יש חגים, שלב אותם בתגים וברעיונות
8. פורמטים מגוונים: תמונות, סרטונים, קרוסלה, סטורי
9. פלטפורמות מגוונות בהתאם לרשימה שניתנה`;

  return prompt;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[campaign-generator] Received POST request');

  try {
    // Parse and validate request
    const body = await req.json();
    const validation = validateRequest(body);

    if (!validation.valid) {
      console.log(`[campaign-generator] Validation failed: ${validation.error}`);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const request = validation.data;
    console.log(`[campaign-generator] Valid request for client: ${request.clientId} (${request.itemCount} items)`);

    // Get holidays for the month
    const holidays = getRelevantHolidays(request.month, request.businessType);
    console.log(`[campaign-generator] Found ${holidays.length} relevant holidays for month ${request.month}`);

    // Check for OpenAI key
    const apiKeys = getApiKeys();
    if (!apiKeys.openai) {
      console.log('[campaign-generator] No OpenAI key available, using fallback generator');
      const fallback = generateFallbackCampaigns(request);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        {
          ...fallback,
          debug: {
            ...fallback.debug,
            latencyMs: latency,
          },
        },
        { status: 200 }
      );
    }

    // Build prompts with research context
    const researchContext = getClientResearchContext(request.clientId);
    let systemPrompt = buildSystemPrompt(request.clientBrain);
    if (researchContext) {
      systemPrompt += `\n\n${researchContext}`;
    }
    const userPrompt = buildUserPrompt(request, holidays);

    console.log('[campaign-generator] Calling OpenAI API');
    const aiResult = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.8,
      maxTokens: 6000,
    });

    if (!aiResult.success) {
      console.log(`[campaign-generator] OpenAI error: ${aiResult.error}`);
      // Fall back to deterministic generation
      const fallback = generateFallbackCampaigns(request);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        {
          ...fallback,
          debug: {
            ...fallback.debug,
            latencyMs: latency,
          },
        },
        { status: 200 }
      );
    }

    // Parse AI response
    let parsed: { campaigns: Campaign[]; contentItems: ContentItem[] };
    if (typeof aiResult.data === 'string') {
      // Try to extract JSON from the string
      const jsonMatch = aiResult.data.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('[campaign-generator] Could not extract JSON from AI response, using fallback');
        const fallback = generateFallbackCampaigns(request);
        const latency = Date.now() - startTime;
        return NextResponse.json(
          {
            ...fallback,
            debug: {
              ...fallback.debug,
              latencyMs: latency,
            },
          },
          { status: 200 }
        );
      }
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      parsed = aiResult.data as { campaigns: Campaign[]; contentItems: ContentItem[] };
    }

    // Validate and clean response
    if (!Array.isArray(parsed.campaigns) || !Array.isArray(parsed.contentItems)) {
      console.log('[campaign-generator] Invalid response structure, using fallback');
      const fallback = generateFallbackCampaigns(request);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        {
          ...fallback,
          debug: {
            ...fallback.debug,
            latencyMs: latency,
          },
        },
        { status: 200 }
      );
    }

    // Ensure we have the right number of items
    const contentItems = parsed.contentItems.slice(0, request.itemCount);

    // Add day of month if missing
    const itemsWithDays = contentItems.map((item, idx) => ({
      ...item,
      dayOfMonth: item.dayOfMonth || ((idx % 28) + 1),
    }));

    const latency = Date.now() - startTime;
    console.log(`[campaign-generator] Success: ${parsed.campaigns.length} campaigns, ${itemsWithDays.length} items (${latency}ms)`);

    const response: CampaignGeneratorResponse = {
      campaigns: parsed.campaigns,
      contentItems: itemsWithDays,
      debug: {
        latencyMs: latency,
        itemCount: itemsWithDays.length,
        campaignCount: parsed.campaigns.length,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[campaign-generator] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}
