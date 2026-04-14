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
  const cb: any = clientBrain || {};
  const sellingPointsStr = Array.isArray(cb?.keySellingPoints) && cb.keySellingPoints.length > 0
    ? cb.keySellingPoints.join(', ') : 'לא צוין';
  const topicsStr = Array.isArray(cb?.topPerformingTopics) && cb.topPerformingTopics.length > 0
    ? cb.topPerformingTopics.join(', ') : 'לא צוין';
  const failedStr = Array.isArray(cb?.failedPatterns) && cb.failedPatterns.length > 0
    ? cb.failedPatterns.join(', ') : 'לא צוין';
  const interestsStr = Array.isArray(cb?.idealCustomer?.interests)
    ? cb.idealCustomer.interests.join(', ') : '';
  const idealCustomer = cb?.idealCustomer
    ? `גיל: ${cb.idealCustomer?.ageRange ?? ''}, עניינים: ${interestsStr}`
    : 'לא צוין';
  const weaknessesStr = Array.isArray(cb?.weaknesses) && cb.weaknesses.length > 0
    ? cb.weaknesses.map((w: any, i: number) => `${i + 1}. ${w?.description ?? ''} (${w?.severity ?? ''})`).join('\n')
    : 'לא צוינו';

  return `## ניתוח חולשות משיווקיות - "אודיט מוח ברייִן"

### פרופיל העסק:
- **סיכום:** ${cb?.businessSummary ?? ''}
- **טון קול:** ${cb?.toneOfVoice ?? ''}
- **קהל יעד:** ${cb?.audienceProfile ?? ''}
- **נקודות מכירה:** ${sellingPointsStr}
- **אישיות מותג:** ${cb?.brandPersonality ?? ''}
- **יתרון תחרותי:** ${cb?.competitiveAdvantage ?? ''}

### ביצועים קודמים:
- **נושאים בעלי ביצוע גבוה:** ${topicsStr}
- **דפוסים שנכשלו:** ${failedStr}
- **פרופיל קהל אידיאלי:** ${idealCustomer}

### בעיות ידועות:
${weaknessesStr}

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
    let body: Partial<BrandWeaknessRequest> = {};
    try {
      body = (await req.json()) as Partial<BrandWeaknessRequest>;
    } catch {
      console.warn('[brand-weakness] Invalid or empty JSON body');
    }
    const request = body as BrandWeaknessRequest;

    // Validate
    const missing: string[] = [];
    if (!request?.clientId) missing.push('clientId');
    if (!request?.clientBrain || typeof request.clientBrain !== 'object') missing.push('clientBrain');
    if (missing.length > 0) {
      console.warn(`[brand-weakness] POST: Missing fields: ${missing.join(', ')}`);
      return NextResponse.json(
        { error: 'Missing clientId or clientBrain', missing },
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
    const parsedWeaknesses: WeaknessAnalysis[] = Array.isArray(parsed?.weaknesses)
      ? parsed.weaknesses.map((w: any) => ({
          area: w?.area ?? '',
          description: w?.description ?? '',
          severity: (w?.severity === 'high' || w?.severity === 'low') ? w.severity : 'medium',
          impact: w?.impact ?? '',
          fixSuggestions: Array.isArray(w?.fixSuggestions) ? w.fixSuggestions : [],
          messagingImprovement: w?.messagingImprovement ?? '',
          creativeDirection: w?.creativeDirection ?? '',
        }))
      : [];
    console.log(`[brand-weakness] POST: Success (${latency}ms, ${parsedWeaknesses.length} weaknesses)`);

    return NextResponse.json(
      {
        weaknesses: parsedWeaknesses,
        overallScore: typeof parsed?.overallScore === 'number' ? parsed.overallScore : 50,
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
