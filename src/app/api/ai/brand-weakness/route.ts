import { NextRequest, NextResponse } from 'next/server';
import { getApiKeys } from '@/lib/db/api-keys';
import type { ClientKnowledge } from '@/lib/db/schema';

interface BrandWeaknessRequest {
  clientId: string;
  clientBrain: ClientKnowledge;
}

interface WeaknessAnalysis {
  area: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  impact: string;
  fixSuggestions: string[];
  messagingImprovement: string;
  creativeDirection: string;
}

interface BrandWeaknessResponse {
  weaknesses: WeaknessAnalysis[];
  overallScore: number;
  debug: {
    latencyMs: number;
    fallback: boolean;
  };
}

// ============================================================================
// FALLBACK GENERATOR
// ============================================================================

function generateFallbackAnalysis(clientBrain: ClientKnowledge): BrandWeaknessResponse {
  console.log('[brand-weakness] Generating fallback analysis (no OpenAI key)');

  const weaknesses: WeaknessAnalysis[] = [
    {
      area: 'קידום דיגיטלי',
      description: 'נוכחות חלשה ברשתות חברתיות עם תדירות פרסום נמוכה',
      severity: 'high',
      impact: 'ירידה בחשיפה הבעלויה ודעה ציבורית נמוכה',
      fixSuggestions: [
        'הגברת תדירות הפרסום ל-4-5 פעמים בשבוע',
        'יצירת קלנדר תוכן שנתי מתוכנן',
        'שימוש בסטורי ובתוכן חי לשיפור ההשתתפות',
      ],
      messagingImprovement: 'חזור לחדשנות וערך ייחודי של המותג במקום להיות גנרי וקר',
      creativeDirection: 'ויזואלים חמים, אנושיים, קהילתיים — צבעים בהירים וטונים אופטימיים',
    },
    {
      area: 'מהימנות וחברתית',
      description: 'חסר תומכים וטסטימוניאלים מהקהל הקיים',
      severity: 'medium',
      impact: 'ירידה בהמרות ובערך החיים של הקהל הקיים',
      fixSuggestions: [
        'אסוף טסטימוניאלים מ-5-10 לקוחות קיימים',
        'יצור סרטונים קצרים של מקרי שימוש של לקוחות',
        'פרסום ביקורות וציונים על הפלטפורמות הרלוונטיות',
      ],
      messagingImprovement: 'הוסף "הוכחה חברתית" לכל קמפיין שיווקי',
      creativeDirection: 'סרטונים אמיתיים של לקוחות — פחות עריכה, יותר אמינות',
    },
    {
      area: 'CTA וניתוב המרות',
      description: 'קריאות לפעולה ורור אבל עדין ולא ברורות מספיק',
      severity: 'medium',
      impact: 'תנועה נמוכה וירידה בקצב ההמרה',
      fixSuggestions: [
        'הפוך CTAs לברורות, ישירות, וממולכות',
        'שתמש בפרודוקטיוטית: "קרא עד סוף", "הזמן עכשיו", "צפה ב-60 שניות"',
        'בדוק A/B של CTAs שונים ופעילות קצות שונות',
      ],
      messagingImprovement: 'עבור מ-"למד עוד" ל-"בואו נפתור את הבעיה שלך בחודש הבא"',
      creativeDirection: 'ברור, אגרסיבי, מוטבע בתוכן — לא מסוג ניתור מרחוק',
    },
  ];

  return {
    weaknesses,
    overallScore: 62,
    debug: { latencyMs: 0, fallback: true },
  };
}

// ============================================================================
// BUILD AI PROMPTS
// ============================================================================

function buildSystemPromptHebrew(): string {
  return `אתה אסטרטג משיווק בכיר בעל ניסיון של 15+ שנים בזיהוי וטיפול בחולשות תחרותיות.

המטלה שלך: לנתח את "מוח ברייִן" של לקוח ולהצביע על חולשות משיווקיות קריטיות עם הצעות פעולה קונקרטיות.

אתה מתמחה ב:
1. זיהוי פערים ממשיים בהשיווק
2. הערכת השפעה של כל חולשה על ביצועים
3. הצעת שדרוג משיווקי מעשיים וממולכים
4. יצירת כיווני יצירה חדשים ועדכוניים

תמיד עני בעברית, עם טון בוטח אך בונה.`;
}

function buildUserPromptHebrew(clientBrain: ClientKnowledge): string {
  const sellingPointsStr = clientBrain.keySellingPoints?.join(', ') || 'לא צוין';
  const topicsStr = clientBrain.topPerformingTopics?.join(', ') || 'לא צוין';
  const failedStr = clientBrain.failedPatterns?.join(', ') || 'לא צוין';
  const idealCustomer = clientBrain.idealCustomer
    ? `גיל: ${clientBrain.idealCustomer.ageRange}, עניינים: ${clientBrain.idealCustomer.interests?.join(', ')}`
    : 'לא צוין';

  return `## ניתוח חולשות משיווקיות - "אודיט מוח ברייִן"

### פרופיל העסק:
- **סיכום:** ${clientBrain.businessSummary}
- **טון קול:** ${clientBrain.toneOfVoice}
- **קהל יעד:** ${clientBrain.audienceProfile}
- **נקודות מכירה:** ${sellingPointsStr}
- **אישיות מותג:** ${clientBrain.brandPersonality}
- **יתרון תחרותי:** ${clientBrain.competitiveAdvantage}

### ביצועים קודמים:
- **נושאים בעלי ביצוע גבוה:** ${topicsStr}
- **דפוסים שנכשלו:** ${failedStr}
- **פרופיל קהל אידיאלי:** ${idealCustomer}

### בעיות ידועות:
${clientBrain.weaknesses?.map((w, i) => `${i + 1}. ${w.description} (${w.severity})`).join('\n') || 'לא צוינו'}

---

## דרישת הפלט

החזר JSON בדיוק כזה, עם **לפחות 3 חולשות חדשות או משופרות**:

\`\`\`json
{
  "weaknesses": [
    {
      "area": "תחום החולשה (למשל: קידום דיגיטלי, מהימנות, טון קול)",
      "description": "תיאור ברור של החולשה",
      "severity": "low|medium|high",
      "impact": "ההשפעה על עסק וביצועים",
      "fixSuggestions": [
        "הצעה קונקרטית לתיקון 1",
        "הצעה קונקרטית לתיקון 2",
        "הצעה קונקרטית לתיקון 3"
      ],
      "messagingImprovement": "כיצד לשדרג את ההודעה המרכזית",
      "creativeDirection": "כיווןיצירה חדש או מעדכן (צבעים, סגנון, סוג תוכן)"
    },
    ...
  ],
  "overallScore": 0-100
}
\`\`\`

דרישות קריטיות:
1. JSON תקין בלבד
2. כל התשובות בעברית
3. לפחות 3 חולשות שונות (מינימום 1 גבוה)
4. fixSuggestions: קונקרטי, לא גנרי — תן צעדים מעשיים
5. creativeDirection: סגנון, טון, צבעים, או סוג תוכן חדש
6. overallScore: 0-100 כאשר 100 = אין חולשות
7. לא להציע כלים או רישום — לתמקד בשיווק וקיום ערך`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[brand-weakness] POST: Received request');

  try {
    const body = await req.json();
    const request = body as BrandWeaknessRequest;

    // Validate
    if (!request.clientId || !request.clientBrain) {
      console.log('[brand-weakness] POST: Missing clientId or clientBrain');
      return NextResponse.json(
        { error: 'Missing clientId or clientBrain' },
        { status: 400 }
      );
    }

    console.log(`[brand-weakness] POST: Analyzing for client=${request.clientId}`);

    // Check for OpenAI
    const apiKeys = getApiKeys();
    if (!apiKeys.openai) {
      console.log('[brand-weakness] POST: No OpenAI key, using fallback');
      const fallback = generateFallbackAnalysis(request.clientBrain);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        { ...fallback, debug: { ...fallback.debug, latencyMs: latency } },
        { status: 200 }
      );
    }

    // Call OpenAI
    console.log('[brand-weakness] POST: Calling OpenAI API');
    const systemPrompt = buildSystemPromptHebrew();
    const userPrompt = buildUserPromptHebrew(request.clientBrain);

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
        max_tokens: 2500,
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
      console.log(`[brand-weakness] POST: OpenAI error (${response.status}): ${errorMessage}`);

      const fallback = generateFallbackAnalysis(request.clientBrain);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        { ...fallback, debug: { ...fallback.debug, latencyMs: latency } },
        { status: 200 }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      console.log('[brand-weakness] POST: Empty OpenAI response');
      const fallback = generateFallbackAnalysis(request.clientBrain);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        { ...fallback, debug: { ...fallback.debug, latencyMs: latency } },
        { status: 200 }
      );
    }

    // Parse response
    let parsed: { weaknesses: WeaknessAnalysis[]; overallScore: number };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.log('[brand-weakness] POST: Failed to parse OpenAI response, using fallback');
      const fallback = generateFallbackAnalysis(request.clientBrain);
      const latency = Date.now() - startTime;
      return NextResponse.json(
        { ...fallback, debug: { ...fallback.debug, latencyMs: latency } },
        { status: 200 }
      );
    }

    const latency = Date.now() - startTime;
    console.log(`[brand-weakness] POST: Success (${latency}ms, ${parsed.weaknesses?.length || 0} weaknesses)`);

    return NextResponse.json(
      {
        weaknesses: parsed.weaknesses || [],
        overallScore: parsed.overallScore || 50,
        debug: { latencyMs: latency, fallback: false },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[brand-weakness] POST error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}
