import { NextRequest, NextResponse } from 'next/server';
import { clientKnowledge } from '@/lib/db/collections';
import { getApiKeys } from '@/lib/db/api-keys';
import type { ClientKnowledge as ClientKnowledgeType } from '@/lib/db/schema';

interface ClientBrainRequest {
  clientId: string;
  clientName: string;
  businessType: string;
  businessField: string;
  websiteUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  existingContent?: string;
  industryType: string;
}

interface WeaknessItem {
  description: string;
  severity: 'low' | 'medium' | 'high';
  impact: string;
  fixSuggestion: string;
}

interface IdealCustomerProfile {
  ageRange: string;
  interests: string[];
  behaviors: string[];
  painPoints: string[];
  primarySegment: string;
  secondarySegment: string;
}

// ============================================================================
// FALLBACK GENERATOR (No OpenAI)
// ============================================================================

function generateFallbackProfile(req: ClientBrainRequest): Omit<ClientKnowledgeType, 'id'> {
  console.log('[client-brain] Generating fallback profile (no OpenAI key)');

  const businessKey = `${req.businessType}_${req.businessField}`.toLowerCase().replace(/\s+/g, '_');

  const fallbackData: Omit<ClientKnowledgeType, 'id'> = {
    clientId: req.clientId,
    businessSummary: `עסק מסוג ${req.businessType} בתחום ${req.businessField}. עיסוק בשיווק ופיתוח עסקי.`,
    toneOfVoice: 'מקצועי, חם ויידידותי. טון בעל ערך מעשי.',
    audienceProfile: `קהל יעד עובדים בתחום ${req.businessField}, המחפשים פתרונות איכותיים ו-עלות-אפקטיבית.`,
    keySellingPoints: [
      `כמו ניסיון רב בתחום ${req.businessField}`,
      'שירות אישי וקשוב',
      'מחירים תחרותיים',
      'איכות גבוהה',
    ],
    brandPersonality: 'מקצועי, אמין, בעל ערך, וקהילתי',
    competitiveAdvantage: `ניסיון עמוק בתחום ${req.businessField} עם הבנה מעמיקה של צרכי הקהל המקומי.`,
    winningContentPatterns: [
      'סיפורי הצלחה וטסטימוניאלים',
      'טיפים מעשיים וחינוכיים',
      'השוואות ערך',
    ],
    failedPatterns: [
      'גנרי ולא ממוקד',
      'יותר מדי מכירה ישירה',
      'תוכן חסר ערך',
    ],
    topPerformingTopics: [
      'פתרונות לבעיות נפוצות',
      'טיפים וטריקים בתחום',
      'סיפורי קהילה',
    ],
    websiteUrl: req.websiteUrl || '',
    facebookUrl: req.facebookUrl || '',
    instagramUrl: req.instagramUrl || '',
    sourcesAnalyzed: [
      req.websiteUrl ? 'Website' : '',
      req.facebookUrl ? 'Facebook' : '',
      req.instagramUrl ? 'Instagram' : '',
    ].filter(Boolean),
    weaknesses: [
      {
        description: 'עלויות הצגה גבוהות',
        severity: 'medium',
        impact: 'ROI נמוך על קמפיינים ממולכים',
        fixSuggestion: 'עדכן התמקדות ודיוק של קהל היעד וטסטציה שליטה A/B',
      },
      {
        description: 'עדיין לא בנויה קהילה חזקה',
        severity: 'medium',
        impact: 'התערבות נמוכה וקושי בתעמוד',
        fixSuggestion: 'בנה תוכן קהילתי ותגובות פעילות לתגובות',
      },
    ],
    idealCustomer: {
      ageRange: '25-55',
      interests: ['פתרונות עסקיים', 'שיפור יעילות', 'אוטומציה'],
      behaviors: ['מחפש ערך', 'קורא ביקורות', 'בודק מחירים'],
      painPoints: ['עלויות גבוהות', 'זמן ממוצה', 'פתרונות לא שמעותיים'],
      primarySegment: 'ממלכי עסקים וקבלני משנה',
      secondarySegment: 'מנהלים וקובעי החלטות',
    },
    lastAnalyzedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return fallbackData;
}

// ============================================================================
// BUILD AI PROMPTS
// ============================================================================

function buildSystemPromptHebrew(): string {
  return `אתה אסטרטג משיווק וקבלנות עיסקית בדרגה ראשונה עם ניסיון של 15+ שנים בשיווק דיגיטלי בישראל.

המטלה שלך: לנתח לקוחות עסקיים והוצר פרופיל מוח ברייִן קליניק המושקל, שיתמוך באסטרטגיה שיווקית משלהם.

אתה מתמחה ב:
1. הבנת ערך ייחודי וכלי תחרות
2. זיהוי דפוסי תוכן המניבים תוצאות
3. הגדרת קהל יעד בדיוק ודיוק
4. זיהוי נקודות חולשה ופתרונות מעשיים
5. יצירת אסטרטגיות משיווק מוגבלות מבחינת תקציב

תמיד ענה בעברית, עם שמות ממוקומים וטון חם אך מקצועי.`;
}

function buildUserPromptHebrew(req: ClientBrainRequest): string {
  const sourcesList = [];
  if (req.websiteUrl) sourcesList.push(`אתר אינטרנט: ${req.websiteUrl}`);
  if (req.facebookUrl) sourcesList.push(`פייסבוק: ${req.facebookUrl}`);
  if (req.instagramUrl) sourcesList.push(`אינסטגרם: ${req.instagramUrl}`);
  if (req.existingContent) sourcesList.push(`תוכן קודם: ${req.existingContent.slice(0, 200)}`);

  return `## בקשה לניתוח ויצירת פרופיל "מוח ברייִן" קלינטי

**לקוח:** ${req.clientName}
**סוג עסק:** ${req.businessType}
**תחום עסקי:** ${req.businessField}
**סוג תעשייה:** ${req.industryType}

### מקורות זמינים:
${sourcesList.length > 0 ? sourcesList.join('\n') : '(אין מקורות חיצוניים)'}

---

## דרישת הפלט

החזר ב-JSON בדיוק כזה:

\`\`\`json
{
  "businessSummary": "סיכום של העסק ב-2-3 משפטים",
  "toneOfVoice": "טון קול המותג (כ-1 משפט)",
  "audienceProfile": "תיאור קהל היעד הראשוני",
  "keySellingPoints": ["נקודה 1", "נקודה 2", "נקודה 3", "נקודה 4"],
  "brandPersonality": "תיאור דמות המותג (כ-1-2 משפטים)",
  "competitiveAdvantage": "מה ייחודי ותחרותי",
  "winningContentPatterns": ["דפוס 1 שעובד", "דפוס 2 שעובד", "דפוס 3"],
  "topPerformingTopics": ["נושא 1", "נושא 2", "נושא 3"],
  "failedPatterns": ["דפוס שלא עובד 1", "דפוס שלא עובד 2"],
  "weaknesses": [
    {
      "description": "תיאור נקודה חלושה",
      "severity": "low|medium|high",
      "impact": "ההשפעה על ביצועים",
      "fixSuggestion": "הצעה לתיקון"
    },
    ...
  ],
  "idealCustomer": {
    "ageRange": "טווח גיל",
    "interests": ["עניין 1", "עניין 2", ...],
    "behaviors": ["התנהגות 1", "התנהגות 2", ...],
    "painPoints": ["בעיה 1", "בעיה 2", ...],
    "primarySegment": "הסגמנט העיקרי",
    "secondarySegment": "הסגמנט המשני"
  }
}
\`\`\`

דרישות קריטיות:
1. JSON תקין בלבד
2. כל התשובות בעברית
3. keySellingPoints: לפחות 3, עד 5 נקודות קנייה ברורות
4. weaknesses: לפחות 2, עד 4 נקודות חלושות עם מתן פתרונות
5. ideALCustomer: פרטים קונקרטיים ולא גנריים
6. לא להציע כלים או טכנולוגיה — לתמקד בהבנת העסק וקהל היעד
7. idealCustomer.interests, behaviors, painPoints: חייב להיות מובן וקונקרטי למשימה העסקית`;
}

// ============================================================================
// MAIN HANDLERS
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing clientId query parameter' },
        { status: 400 }
      );
    }

    console.log(`[client-brain] GET: Fetching knowledge for clientId=${clientId}`);

    let allKnowledge: ClientKnowledgeType[];
    try {
      allKnowledge = await clientKnowledge.getAllAsync();
    } catch (dbError) {
      const msg = dbError instanceof Error ? dbError.message : '';
      if (msg.includes('does not exist') || msg.includes('relation')) {
        console.warn('[client-brain] GET: Table not found, returning 404. Run /api/data/migrate-collections.');
        return NextResponse.json(
          { error: 'No ClientKnowledge found (table not initialized)' },
          { status: 404 }
        );
      }
      throw dbError;
    }

    const knowledge = allKnowledge.find(k => k.clientId === clientId);

    if (!knowledge) {
      console.log(`[client-brain] GET: No knowledge found for clientId=${clientId}`);
      return NextResponse.json(
        { error: 'No ClientKnowledge found for this client' },
        { status: 404 }
      );
    }

    console.log(`[client-brain] GET: Found knowledge record ${knowledge.id}`);
    return NextResponse.json({ success: true, data: knowledge }, { status: 200 });
  } catch (error) {
    console.error('[client-brain] GET error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch client knowledge: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[client-brain] POST: Received request');

  try {
    let body: Partial<ClientBrainRequest> = {};
    try {
      body = (await req.json()) as Partial<ClientBrainRequest>;
    } catch {
      console.warn('[client-brain] Invalid or empty JSON body');
    }
    const request = body as ClientBrainRequest;

    // Validate required fields — log exact missing fields
    const missing: string[] = [];
    if (!request?.clientId) missing.push('clientId');
    if (!request?.clientName) missing.push('clientName');
    if (!request?.businessType) missing.push('businessType');
    if (!request?.businessField) missing.push('businessField');
    if (!request?.industryType) missing.push('industryType');
    if (missing.length > 0) {
      console.warn(`[client-brain] POST: Missing fields: ${missing.join(', ')}`);
      return NextResponse.json(
        { error: 'Missing required fields: clientId, clientName, businessType, businessField, industryType', missing },
        { status: 400 }
      );
    }

    console.log(`[client-brain] POST: Processing for client=${request.clientId} (${request.clientName})`);

    // Check if knowledge already exists (async — Supabase)
    let existing: ClientKnowledgeType | null = null;
    try {
      const allKnowledge = await clientKnowledge.getAllAsync();
      existing = allKnowledge.find(k => k.clientId === request.clientId) || null;
    } catch (dbError) {
      console.warn('[client-brain] POST: getAllAsync failed (table may not exist), will attempt create:', dbError instanceof Error ? dbError.message : dbError);
    }

    // Get API keys
    const apiKeys = getApiKeys();
    const hasOpenAi = !!apiKeys.openai;

    if (!hasOpenAi) {
      console.log('[client-brain] POST: No OpenAI key, using fallback generator');
      const fallbackData = generateFallbackProfile(request);
      const knowledge = await clientKnowledge.createAsync(fallbackData);
      const latency = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: knowledge,
        debug: { latencyMs: latency, fallback: true },
      }, { status: 200 });
    }

    // Call OpenAI
    console.log('[client-brain] POST: Calling OpenAI API');
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
        max_tokens: 3000,
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
      console.log(`[client-brain] POST: OpenAI error (${response.status}): ${errorMessage}`);

      // Fall back to deterministic generation
      const fallbackData = generateFallbackProfile(request);
      const knowledge = await clientKnowledge.createAsync(fallbackData);
      const latency = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: knowledge,
        debug: { latencyMs: latency, fallback: true, openaiError: errorMessage },
      }, { status: 200 });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      console.log('[client-brain] POST: Empty OpenAI response');
      const fallbackData = generateFallbackProfile(request);
      const knowledge = await clientKnowledge.createAsync(fallbackData);
      const latency = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: knowledge,
        debug: { latencyMs: latency, fallback: true, reason: 'empty_response' },
      }, { status: 200 });
    }

    // Parse response
    let parsed: {
      businessSummary: string;
      toneOfVoice: string;
      audienceProfile: string;
      keySellingPoints: string[];
      brandPersonality: string;
      competitiveAdvantage: string;
      winningContentPatterns: string[];
      topPerformingTopics: string[];
      failedPatterns: string[];
      weaknesses: WeaknessItem[];
      idealCustomer: IdealCustomerProfile;
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.log('[client-brain] POST: Failed to parse OpenAI response, using fallback');
      const fallbackData = generateFallbackProfile(request);
      const knowledge = await clientKnowledge.createAsync(fallbackData);
      const latency = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: knowledge,
        debug: { latencyMs: latency, fallback: true, reason: 'parse_error' },
      }, { status: 200 });
    }

    // Build the ClientKnowledge object — every array/object field guarded
    const safeIdeal = parsed?.idealCustomer && typeof parsed.idealCustomer === 'object'
      ? {
          ageRange: parsed.idealCustomer?.ageRange ?? '',
          interests: Array.isArray(parsed.idealCustomer?.interests) ? parsed.idealCustomer.interests : [],
          behaviors: Array.isArray(parsed.idealCustomer?.behaviors) ? parsed.idealCustomer.behaviors : [],
          painPoints: Array.isArray(parsed.idealCustomer?.painPoints) ? parsed.idealCustomer.painPoints : [],
          primarySegment: parsed.idealCustomer?.primarySegment ?? '',
          secondarySegment: parsed.idealCustomer?.secondarySegment ?? '',
        }
      : null;

    const knowledgeData: Omit<ClientKnowledgeType, 'id'> = {
      clientId: request.clientId,
      businessSummary: parsed?.businessSummary || '',
      toneOfVoice: parsed?.toneOfVoice || '',
      audienceProfile: parsed?.audienceProfile || '',
      keySellingPoints: Array.isArray(parsed?.keySellingPoints) ? parsed.keySellingPoints : [],
      brandPersonality: parsed?.brandPersonality || '',
      competitiveAdvantage: parsed?.competitiveAdvantage || '',
      winningContentPatterns: Array.isArray(parsed?.winningContentPatterns) ? parsed.winningContentPatterns : [],
      failedPatterns: Array.isArray(parsed?.failedPatterns) ? parsed.failedPatterns : [],
      topPerformingTopics: Array.isArray(parsed?.topPerformingTopics) ? parsed.topPerformingTopics : [],
      websiteUrl: request.websiteUrl || '',
      facebookUrl: request.facebookUrl || '',
      instagramUrl: request.instagramUrl || '',
      sourcesAnalyzed: [
        request.websiteUrl ? 'Website' : '',
        request.facebookUrl ? 'Facebook' : '',
        request.instagramUrl ? 'Instagram' : '',
      ].filter(Boolean),
      weaknesses: Array.isArray(parsed?.weaknesses) ? parsed.weaknesses : [],
      idealCustomer: safeIdeal,
      lastAnalyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save or update (async — Supabase-durable)
    let knowledge: ClientKnowledgeType;
    if (existing) {
      console.log(`[client-brain] POST: Updating existing knowledge ${existing.id}`);
      const updated = await clientKnowledge.updateAsync(existing.id, {
        ...knowledgeData,
        updatedAt: new Date().toISOString(),
      });
      if (!updated) throw new Error('Failed to update client knowledge in Supabase');
      knowledge = updated;
    } else {
      console.log('[client-brain] POST: Creating new knowledge record');
      knowledge = await clientKnowledge.createAsync(knowledgeData);
    }

    const latency = Date.now() - startTime;
    console.log(`[client-brain] POST: Success (${latency}ms)`);

    return NextResponse.json({
      success: true,
      data: knowledge,
      debug: { latencyMs: latency, fallback: false },
    }, { status: 200 });
  } catch (error) {
    console.error('[client-brain] POST error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}
