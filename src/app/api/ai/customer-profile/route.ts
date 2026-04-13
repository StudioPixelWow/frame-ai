import { NextRequest, NextResponse } from 'next/server';
import { getApiKeys } from '@/lib/db/api-keys';
import type { ClientKnowledge } from '@/lib/db/schema';

interface CustomerProfileRequest {
  clientId: string;
  businessType: string;
  businessField: string;
  existingData?: string | ClientKnowledge;
}

interface IdealCustomer {
  ageRange: string;
  gender: 'mixed' | 'male' | 'female';
  interests: string[];
  behaviors: string[];
  painPoints: string[];
  primarySegment: string;
  secondarySegment: string;
  contentPreferences: string[];
  bestPlatforms: string[];
}

interface CustomerProfileResponse {
  idealCustomer: IdealCustomer;
  debug: {
    latencyMs: number;
    fallback: boolean;
  };
}

// ============================================================================
// FALLBACK GENERATOR
// ============================================================================

function generateFallbackProfile(req: CustomerProfileRequest): CustomerProfileResponse {
  console.log('[customer-profile] Generating fallback profile (no OpenAI key)');

  const profile: IdealCustomer = {
    ageRange: '25-55',
    gender: 'mixed',
    interests: [
      'שיפור איכות החיים',
      'פתרונות חדשניים',
      'קנייה מודעת',
      'תוכן חינוכי',
      'ערך למחיר',
    ],
    behaviors: [
      'קורא ביקורות לפני קנייה',
      'בודק מחירים על פלטפורמות מרובות',
      'מפריע בעדכונים חברתיים',
      'משתתף בקהילות מקוונות',
      'מחפש תוכן חינוכי ומעשי',
    ],
    painPoints: [
      'מחירים גבוהים וחוסר שקיפות',
      'איכות שירות לא עקבית',
      'קושי בקבלת החלטות מושכלות',
      'חוסר בשירות אישי',
      'ממוצע זמן ממוצה וטיולים',
    ],
    primarySegment: 'מקצוענים משכילים וקבלני החלטות',
    secondarySegment: 'יזמים וחובבי עסקים',
    contentPreferences: [
      'סרטונים קצרים חינוכיים',
      'טסטימוניאלים אמיתיים',
      'טיפים וטריקים עملים',
      'השוואות וניתוחים',
      'סיפורי הצלחה קהילתיים',
    ],
    bestPlatforms: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok'],
  };

  return {
    idealCustomer: profile,
    debug: { latencyMs: 0, fallback: true },
  };
}

// ============================================================================
// BUILD AI PROMPTS
// ============================================================================

function buildSystemPromptHebrew(): string {
  return `אתה אסטרטג משיווק בעל ניסיון עמוק בהגדרת קהלים יעד ויצירת פרופילי אדם מפורטים.

המטלה שלך: להגדיר פרופיל קהל אידיאלי ברור וממוקד עבור לקוח עסקי בישראל.

אתה מתמחה ב:
1. הבנת מוטיבציות ודחיפות של ממלכי קנייה
2. זיהוי בעיות ודכאונות ספציפיים
3. הגדרת סוגי תוכן שמהדים עם קהל מסוים
4. הערכת הפלטפורמות הטובות ביותר לקהל זה

תמיד אתה ממוקד, ספציפי, וגנט עם טון מעשי.`;
}

function buildUserPromptHebrew(req: CustomerProfileRequest): string {
  let existingContext = '';

  if (typeof req.existingData === 'string') {
    existingContext = `\n### נתונים קיימים:\n${req.existingData}`;
  } else if (req.existingData && typeof req.existingData === 'object') {
    const brain = req.existingData as any;
    existingContext = `\n### מידע קיים מ-ClientBrain:
- **קהל יעד:** ${brain.audienceProfile || 'לא צוין'}
- **אישיות מותג:** ${brain.brandPersonality || 'לא צוין'}
- **נקודות מכירה:** ${brain.keySellingPoints?.join(', ') || 'לא צוין'}
- **טון קול:** ${brain.toneOfVoice || 'לא צוין'}`;
  }

  return `## בקשה להגדרת פרופיל קהל אידיאלי (Ideal Customer Profile)

### ממידע העסק:
- **סוג עסק:** ${req.businessType}
- **תחום עסקי:** ${req.businessField}
- **ClientId:** ${req.clientId}
${existingContext}

---

## דרישת הפלט

החזר JSON בדיוק כזה:

\`\`\`json
{
  "ageRange": "טווח גיל (למשל: 25-45)",
  "gender": "mixed|male|female",
  "interests": [
    "עניין 1",
    "עניין 2",
    "עניין 3",
    "עניין 4",
    "עניין 5"
  ],
  "behaviors": [
    "התנהגות 1",
    "התנהגות 2",
    "התנהגות 3",
    "התנהגות 4",
    "התנהגות 5"
  ],
  "painPoints": [
    "בעיה 1",
    "בעיה 2",
    "בעיה 3",
    "בעיה 4",
    "בעיה 5"
  ],
  "primarySegment": "הסגמנט עיקרי (למשל: 'מנהלים בכירים')",
  "secondarySegment": "סגמנט משני",
  "contentPreferences": [
    "סוג תוכן 1 (למשל: 'סרטונים קצרים חינוכיים')",
    "סוג תוכן 2",
    "סוג תוכן 3",
    "סוג תוכן 4",
    "סוג תוכן 5"
  ],
  "bestPlatforms": [
    "פלטפורמה 1 (Facebook, Instagram, TikTok, LinkedIn וכו')",
    "פלטפורמה 2",
    "פלטפורמה 3",
    "פלטפורמה 4"
  ]
}
\`\`\`

דרישות קריטיות:
1. JSON תקין בלבד
2. כל התשובות בעברית
3. interests, behaviors, painPoints: לפחות 4 פריטים כל אחד, ספציפי וקונקרטי
4. contentPreferences: התאם לתוכן שממלכי היעד הזה צורכים בפועל
5. bestPlatforms: בחר מתוך Facebook, Instagram, TikTok, LinkedIn, YouTube, WhatsApp
6. primarySegment ו- secondarySegment: תיאור ברור ודלק של סוגי אנשים
7. gender: רק mixed, male, או female
8. לא להציע טכנולוגיה או כלים — לתמקד בהבנה האנושית של קהל היעד`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[customer-profile] POST: Received request');

  try {
    const body = await req.json();
    const request = body as CustomerProfileRequest;

    // Validate
    if (!request.clientId || !request.businessType || !request.businessField) {
      console.log('[customer-profile] POST: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: clientId, businessType, businessField' },
        { status: 400 }
      );
    }

    console.log(`[customer-profile] POST: Generating profile for client=${request.clientId}`);

    // Check for OpenAI
    const apiKeys = getApiKeys();
    if (!apiKeys.openai) {
      console.log('[customer-profile] POST: No OpenAI key, using fallback');
      const fallback = generateFallbackProfile(request);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        { ...fallback, debug: { ...fallback.debug, latencyMs: latency } },
        { status: 200 }
      );
    }

    // Call OpenAI
    console.log('[customer-profile] POST: Calling OpenAI API');
    const systemPrompt = buildSystemPromptHebrew();
    const userPrompt = buildUserPromptHebrew(request);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeys.openai}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody?.error?.message || response.statusText;
      } catch {
        errorMessage = await response.text();
      }
      console.log(`[customer-profile] POST: OpenAI error (${response.status}): ${errorMessage}`);

      const fallback = generateFallbackProfile(request);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        { ...fallback, debug: { ...fallback.debug, latencyMs: latency } },
        { status: 200 }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      console.log('[customer-profile] POST: Empty OpenAI response');
      const fallback = generateFallbackProfile(request);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        { ...fallback, debug: { ...fallback.debug, latencyMs: latency } },
        { status: 200 }
      );
    }

    // Parse response
    let parsed: IdealCustomer;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.log('[customer-profile] POST: Failed to parse OpenAI response, using fallback');
      const fallback = generateFallbackProfile(request);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        { ...fallback, debug: { ...fallback.debug, latencyMs: latency } },
        { status: 200 }
      );
    }

    const latency = Date.now() - startTime;
    console.log(`[customer-profile] POST: Success (${latency}ms)`);

    return NextResponse.json(
      {
        idealCustomer: parsed,
        debug: { latencyMs: latency, fallback: false },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[customer-profile] POST error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}
