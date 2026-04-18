import { NextRequest, NextResponse } from 'next/server';
import { creativeDNA } from '@/lib/db/collections';
import { getApiKeys } from '@/lib/db/api-keys';
import type { CreativeDNA as CreativeDNAType } from '@/lib/db/schema';

interface CreativeDNARequest {
  clientId: string;
  clientData?: {
    name: string;
    businessField: string;
    clientType: string;
    brandVoice?: string;
    targetAudience?: string;
    keyMarketingMessages?: string;
    platforms?: string[];
  };
}

interface PatchRequest {
  clientId: string;
  updates: Partial<CreativeDNAType>;
}

// ============================================================================
// FALLBACK GENERATOR (No OpenAI)
// ============================================================================

function generateFallbackDNA(clientId: string): Omit<CreativeDNAType, 'id'> {
  console.log('[creative-dna] Generating fallback DNA (no OpenAI key)');

  const now = new Date().toISOString();

  return {
    clientId,
    toneOfVoice: 'מקצועי, חם ויידידותי',
    sellingStyle: 'educative ממוקד ערך',
    visualStyle: 'מינימליסטי מודרני',
    hookTypes: ['שאלה', 'סטטיסטיקה', 'סיפור'],
    contentTypes: ['post', 'story', 'reel', 'carousel'],
    audienceStyle: 'פנייה ישירה וקלוזה',
    doNotUsePatterns: [
      'ז"א מדי טכני',
      'מדי מכירה ישירה',
      'שפה מלומדת מדי',
    ],
    preferredEmojis: ['✨', '💡', '🎯'],
    hashtagStrategy: '3-5 hashtags ממוקדים, אין generics',
    colorPalette: ['#1a1a2e', '#00B5FE', '#ffffff'],
    photographyStyle: 'תאורה טבעית, חום וקרוב',
    graphicStyle: 'טיפוגרפיה בולדת, צורות גיאומטריות',
    generatedBy: 'ai',
    lastGeneratedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// BUILD AI PROMPTS
// ============================================================================

function buildSystemPromptHebrew(): string {
  return `אתה מומחה אסטרטגיית יצירתית ובנייה של DNA יצירתי למותגים.

המטלה שלך: ליצור פרופיל מלא של "DNA יצירתי" (Creative DNA) עבור לקוח עסקי. זה הוא מקביל יצירתי לתפקידו של המוח - הוא שולט בכל החלטות היצירה והתוכן של המותג.

אתה מתמחה ב:
1. הגדרת טון קול עקבי וחזוי
2. הגדרת דפוסי מכירה והעברת ערך
3. הגדרת סגנון ויזואלי וגרפי
4. הגדרת סוגי תוכן וחוקים יצירתיים
5. זיהוי מה שלא לעשות ואזהרות יצירתיות
6. אסטרטגיה גדולה של emojis וhashtagים

תמיד ענה בעברית, מדויק ופרקטי.`;
}

function buildUserPromptHebrew(req: CreativeDNARequest): string {
  const clientData = req.clientData;
  const sourcesList = [];

  if (clientData?.name) sourcesList.push(`שם לקוח: ${clientData.name}`);
  if (clientData?.businessField) sourcesList.push(`תחום: ${clientData.businessField}`);
  if (clientData?.clientType) sourcesList.push(`סוג: ${clientData.clientType}`);
  if (clientData?.brandVoice) sourcesList.push(`טון ברנד קיים: ${clientData.brandVoice}`);
  if (clientData?.targetAudience) sourcesList.push(`קהל יעד: ${clientData.targetAudience}`);
  if (clientData?.keyMarketingMessages) sourcesList.push(`מסרים עיקריים: ${clientData.keyMarketingMessages}`);
  if (clientData?.platforms?.length) sourcesList.push(`פלטפורמות: ${clientData.platforms.join(', ')}`);

  return `## בקשה ליצירת DNA יצירתי לקלינט

${sourcesList.length > 0 ? sourcesList.join('\n') : '(מידע מינימלי זמין)'}

---

## דרישת הפלט

החזר ב-JSON בדיוק כזה:

\`\`\`json
{
  "toneOfVoice": "תיאור של טון הקול של המותג (כ-1 משפט)",
  "sellingStyle": "סגנון המכירה (soft-sell, direct-response, educational, etc)",
  "visualStyle": "סגנון ויזואלי כללי (כ-1 משפט)",
  "hookTypes": ["סוג hook 1", "סוג hook 2", "סוג hook 3"],
  "contentTypes": ["post", "story", "reel", "carousel", "live"],
  "audienceStyle": "איך לפנות לקהל היעד",
  "doNotUsePatterns": ["דפוס לא לעשות 1", "דפוס לא לעשות 2", "דפוס לא לעשות 3"],
  "preferredEmojis": ["emoji1", "emoji2", "emoji3"],
  "hashtagStrategy": "אסטרטגיית hashtag",
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "photographyStyle": "סגנון צילום",
  "graphicStyle": "סגנון גרפי"
}
\`\`\`

דרישות קריטיות:
1. JSON תקין בלבד
2. כל התשובות בעברית
3. hookTypes: לפחות 3 סוגים
4. contentTypes: בחר מ-post, story, reel, carousel, live - לפחות 2
5. doNotUsePatterns: לפחות 3 דפוסים שלא לעשות
6. preferredEmojis: בדיוק 3-5 emojis
7. colorPalette: בדיוק 3 צבעים בקוד hex
8. כל הטקסט בעברית נקיה וברורה`;
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

    console.log(`[creative-dna] GET: Fetching DNA for clientId=${clientId}`);

    const dna = creativeDNA.getAll().find(d => d.clientId === clientId);

    if (!dna) {
      console.log(`[creative-dna] GET: No DNA found for clientId=${clientId}`);
      return NextResponse.json(
        { error: 'No CreativeDNA found for this client' },
        { status: 404 }
      );
    }

    console.log(`[creative-dna] GET: Found DNA record ${dna.id}`);
    return NextResponse.json({ success: true, data: dna }, { status: 200 });
  } catch (error) {
    console.error('[creative-dna] GET error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch creative DNA: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[creative-dna] POST: Received request');

  try {
    const body = await req.json();
    const request = body as CreativeDNARequest;

    if (!request.clientId) {
      console.log('[creative-dna] POST: Missing clientId');
      return NextResponse.json(
        { error: 'Missing required field: clientId' },
        { status: 400 }
      );
    }

    console.log(`[creative-dna] POST: Processing for client=${request.clientId}`);

    // Check if DNA already exists
    const existing = creativeDNA.getAll().find(d => d.clientId === request.clientId);

    // Get API keys
    const apiKeys = getApiKeys();
    const hasOpenAi = !!apiKeys.openai;

    if (!hasOpenAi) {
      console.log('[creative-dna] POST: No OpenAI key, using fallback generator');
      const fallbackData = generateFallbackDNA(request.clientId);
      const dna = existing
        ? creativeDNA.update(existing.id, fallbackData) as CreativeDNAType
        : creativeDNA.create(fallbackData) as CreativeDNAType;
      const latency = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: dna,
        debug: { latencyMs: latency, fallback: true },
      }, { status: 200 });
    }

    // Call OpenAI
    console.log('[creative-dna] POST: Calling OpenAI API');
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
      console.log(`[creative-dna] POST: OpenAI error (${response.status}): ${errorMessage}`);

      // Fall back to deterministic generation
      const fallbackData = generateFallbackDNA(request.clientId);
      const dna = existing
        ? creativeDNA.update(existing.id, fallbackData) as CreativeDNAType
        : creativeDNA.create(fallbackData) as CreativeDNAType;
      const latency = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: dna,
        debug: { latencyMs: latency, fallback: true, openaiError: errorMessage },
      }, { status: 200 });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      console.log('[creative-dna] POST: Empty OpenAI response');
      const fallbackData = generateFallbackDNA(request.clientId);
      const dna = existing
        ? creativeDNA.update(existing.id, fallbackData) as CreativeDNAType
        : creativeDNA.create(fallbackData) as CreativeDNAType;
      const latency = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: dna,
        debug: { latencyMs: latency, fallback: true, reason: 'empty_response' },
      }, { status: 200 });
    }

    // Parse response
    let parsed: {
      toneOfVoice: string;
      sellingStyle: string;
      visualStyle: string;
      hookTypes: string[];
      contentTypes: string[];
      audienceStyle: string;
      doNotUsePatterns: string[];
      preferredEmojis: string[];
      hashtagStrategy: string;
      colorPalette: string[];
      photographyStyle: string;
      graphicStyle: string;
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.log('[creative-dna] POST: Failed to parse OpenAI response, using fallback');
      const fallbackData = generateFallbackDNA(request.clientId);
      const dna = existing
        ? creativeDNA.update(existing.id, fallbackData) as CreativeDNAType
        : creativeDNA.create(fallbackData) as CreativeDNAType;
      const latency = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: dna,
        debug: { latencyMs: latency, fallback: true, reason: 'parse_error' },
      }, { status: 200 });
    }

    // Build the CreativeDNA object
    const now = new Date().toISOString();
    const dnaData: Omit<CreativeDNAType, 'id'> = {
      clientId: request.clientId,
      toneOfVoice: parsed.toneOfVoice || '',
      sellingStyle: parsed.sellingStyle || '',
      visualStyle: parsed.visualStyle || '',
      hookTypes: Array.isArray(parsed.hookTypes) ? parsed.hookTypes : [],
      contentTypes: Array.isArray(parsed.contentTypes) ? parsed.contentTypes : [],
      audienceStyle: parsed.audienceStyle || '',
      doNotUsePatterns: Array.isArray(parsed.doNotUsePatterns) ? parsed.doNotUsePatterns : [],
      preferredEmojis: Array.isArray(parsed.preferredEmojis) ? parsed.preferredEmojis : [],
      hashtagStrategy: parsed.hashtagStrategy || '',
      colorPalette: Array.isArray(parsed.colorPalette) ? parsed.colorPalette : [],
      photographyStyle: parsed.photographyStyle || '',
      graphicStyle: parsed.graphicStyle || '',
      generatedBy: 'ai',
      lastGeneratedAt: now,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    // Save or update
    let dna: CreativeDNAType;
    if (existing) {
      console.log(`[creative-dna] POST: Updating existing DNA ${existing.id}`);
      dna = creativeDNA.update(existing.id, dnaData) as CreativeDNAType;
    } else {
      console.log('[creative-dna] POST: Creating new DNA record');
      dna = creativeDNA.create(dnaData) as CreativeDNAType;
    }

    const latency = Date.now() - startTime;
    console.log(`[creative-dna] POST: Success (${latency}ms)`);

    return NextResponse.json({
      success: true,
      data: dna,
      debug: { latencyMs: latency, fallback: false },
    }, { status: 200 });
  } catch (error) {
    console.error('[creative-dna] POST error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const startTime = Date.now();
  console.log('[creative-dna] PATCH: Received request');

  try {
    const body = await req.json();
    const request = body as PatchRequest;

    if (!request.clientId || !request.updates) {
      console.log('[creative-dna] PATCH: Missing clientId or updates');
      return NextResponse.json(
        { error: 'Missing required fields: clientId, updates' },
        { status: 400 }
      );
    }

    console.log(`[creative-dna] PATCH: Processing for client=${request.clientId}`);

    // Find existing DNA
    const existing = creativeDNA.getAll().find(d => d.clientId === request.clientId);

    if (!existing) {
      console.log(`[creative-dna] PATCH: No DNA found for clientId=${request.clientId}`);
      return NextResponse.json(
        { error: 'No CreativeDNA found for this client' },
        { status: 404 }
      );
    }

    // Merge updates
    const updated = creativeDNA.update(existing.id, {
      ...request.updates,
      generatedBy: 'manual',
      updatedAt: new Date().toISOString(),
    }) as CreativeDNAType;

    const latency = Date.now() - startTime;
    console.log(`[creative-dna] PATCH: Success (${latency}ms)`);

    return NextResponse.json({
      success: true,
      data: updated,
      debug: { latencyMs: latency },
    }, { status: 200 });
  } catch (error) {
    console.error('[creative-dna] PATCH error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}
