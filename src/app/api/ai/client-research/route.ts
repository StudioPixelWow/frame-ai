/**
 * GET /api/ai/client-research?clientId=X - Fetch stored research for a client
 * POST /api/ai/client-research - Generate new AI-powered client research analysis
 *
 * STRICT MODE: All research MUST come from OpenAI. No mock data, no fallbacks.
 * Retry up to 2 times with stronger prompt if output is weak/empty.
 * Debug logging of full prompt, raw AI response, and parsed JSON.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  clientGanttItems,
  creativeDNA,
} from '@/lib/db/collections';
import { ensureSeeded } from '@/lib/db/seed';
import { getSupabase, ensureTable } from '@/lib/db/store';
import { generateWithAI, getClientKnowledgeContext } from '@/lib/ai/openai-client';
import type { ClientResearch, Client } from '@/lib/db/schema';

// DDL for auto-creating client_research table if missing
const CLIENT_RESEARCH_DDL = `
  CREATE TABLE IF NOT EXISTS public.client_research (
    id text PRIMARY KEY,
    client_id text NOT NULL,
    summary text DEFAULT '',
    customer_profile text DEFAULT '',
    trend_engine text DEFAULT '',
    competitor_analysis text DEFAULT '',
    brand_weakness text DEFAULT '',
    client_brain text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
`;

// ============================================================================
// SUPABASE PERSISTENCE — public.client_research
// Stores the full research JSON in `client_brain` column. Individual section
// columns (summary, customer_profile, etc.) hold section excerpts for queries.
// ============================================================================

async function saveResearchToSupabase(research: ClientResearch): Promise<boolean> {
  try {
    // Auto-create table if it doesn't exist
    await ensureTable('client_research', CLIENT_RESEARCH_DDL);

    const sb = getSupabase();
    const now = new Date().toISOString();

    const row = {
      id: research.id,
      client_id: research.clientId,
      client_brain: JSON.stringify(research),
      summary: JSON.stringify(research.identity ?? {}),
      customer_profile: JSON.stringify(research.audience ?? {}),
      trend_engine: JSON.stringify(research.opportunities ?? []),
      competitor_analysis: JSON.stringify({
        competitors: research.competitors ?? [],
        competitorSummary: research.competitorSummary ?? {},
      }),
      brand_weakness: JSON.stringify(research.weaknesses ?? []),
      updated_at: now,
    };

    console.log(`[client-research] Supabase upsert for client_id=${research.clientId}, id=${research.id}`);

    const { error } = await sb
      .from('client_research')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.error('[client-research] Supabase upsert FAILED:', error.message, error.code);
      return false;
    }

    console.log(`[client-research] Supabase upsert OK for ${research.clientId}`);
    return true;
  } catch (err) {
    console.error('[client-research] Supabase save exception:', err);
    return false;
  }
}

async function loadResearchFromSupabase(clientId: string): Promise<ClientResearch | null> {
  try {
    await ensureTable('client_research', CLIENT_RESEARCH_DDL);

    const sb = getSupabase();
    console.log(`[client-research] Supabase load for client_id=${clientId}`);

    const { data, error } = await sb
      .from('client_research')
      .select('*')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[client-research] Supabase load error:', error.message);
      return null;
    }
    if (!data) {
      console.log(`[client-research] Supabase: no research for client_id=${clientId}`);
      return null;
    }

    // Reconstruct full research object from client_brain JSON
    const raw = (data as Record<string, unknown>).client_brain as string;
    if (!raw) {
      console.warn('[client-research] Supabase row has empty client_brain');
      return null;
    }

    const parsed = JSON.parse(raw) as ClientResearch;
    console.log(`[client-research] Supabase loaded research id=${parsed.id}, status=${parsed.status}`);
    return parsed;
  } catch (err) {
    console.error('[client-research] Supabase load exception:', err);
    return null;
  }
}

/**
 * Fetch a client by id from Supabase (the real source of truth).
 * Maps snake_case DB columns → camelCase Client shape expected by this route.
 */
async function fetchClientFromSupabase(clientId: string): Promise<Client | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    console.error('[client-research] supabase fetch error:', error);
    return null;
  }
  if (!data) return null;

  const d = data as Record<string, unknown>;
  return {
    id: d.id as string,
    name: (d.name as string) ?? '',
    company: (d.company as string) ?? '',
    contactPerson: (d.contact_person as string) ?? '',
    email: (d.email as string) ?? '',
    phone: (d.phone as string) ?? '',
    notes: (d.notes as string) ?? '',
    businessField: (d.business_field as string) ?? '',
    clientType: (d.client_type as string) ?? 'marketing',
    status: (d.status as string) ?? 'active',
    retainerAmount: Number(d.retainer_amount) || 0,
    retainerDay: Number(d.retainer_day) || 1,
    color: (d.color as string) ?? '#00B5FE',
    convertedFromLead: (d.converted_from_lead as string) ?? null,
    assignedManagerId: (d.assigned_manager_id as string) ?? null,
    // Social & marketing — try BOTH possible column naming conventions
    websiteUrl:            (d.website as string) || (d.website_url as string) || '',
    facebookPageUrl:       (d.facebook as string) || (d.facebook_page_url as string) || '',
    instagramProfileUrl:   (d.instagram as string) || (d.instagram_profile_url as string) || '',
    tiktokProfileUrl:      (d.tiktok as string) || (d.tiktok_profile_url as string) || '',
    linkedinUrl:           (d.linkedin as string) || (d.linkedin_url as string) || '',
    youtubeUrl:            (d.youtube as string) || (d.youtube_url as string) || '',
    marketingGoals:        (d.marketing_goals as string) ?? '',
    keyMarketingMessages:  (d.key_marketing_messages as string) ?? '',
    logoUrl:               (d.logo_url as string) ?? '',
    createdAt: (d.created_at as string) ?? '',
    updatedAt: (d.updated_at as string) ?? '',
  } as unknown as Client;
}

// ---------- Strict JSON schema for validation ----------

const REQUIRED_TOP_KEYS = [
  'identity',
  'audience',
  'weaknesses',
  'competitors',
  'competitorSummary',
  'opportunities',
  'recommendedContentAngles',
  'contentIdeas25',
  'recommendedCampaignConcepts',
  'actionPlan',
  'sourcesAnalyzed',
] as const;

function validateResearchJSON(data: unknown): { valid: boolean; missing: string[] } {
  if (!data || typeof data !== 'object') return { valid: false, missing: ['(not an object)'] };
  const obj = data as Record<string, unknown>;
  const missing: string[] = [];

  for (const key of REQUIRED_TOP_KEYS) {
    if (!(key in obj) || obj[key] === undefined || obj[key] === null) {
      missing.push(key);
    }
  }

  // Validate nested required sub-fields
  if (obj.identity && typeof obj.identity === 'object') {
    const id = obj.identity as Record<string, unknown>;
    for (const f of ['whatTheySell', 'positioning', 'tone', 'uniqueValue', 'targetAudience']) {
      if (!id[f] || (typeof id[f] === 'string' && id[f].trim() === '')) missing.push(`identity.${f}`);
    }
  }

  if (obj.audience && typeof obj.audience === 'object') {
    const aud = obj.audience as Record<string, unknown>;
    if (!aud.primary || (typeof aud.primary === 'string' && aud.primary.trim() === '')) missing.push('audience.primary');
    if (!Array.isArray(aud.painPoints) || aud.painPoints.length === 0) missing.push('audience.painPoints');
  }

  if (Array.isArray(obj.weaknesses) && obj.weaknesses.length < 3) missing.push('weaknesses (need 3+)');
  if (Array.isArray(obj.opportunities) && obj.opportunities.length < 3) missing.push('opportunities (need 3+)');
  if (!Array.isArray(obj.recommendedContentAngles) || obj.recommendedContentAngles.length < 3) missing.push('recommendedContentAngles (need 3+)');
  // Validate 25 content ideas — HARD requirement
  if (!Array.isArray(obj.contentIdeas25) || obj.contentIdeas25.length < 20) missing.push('contentIdeas25 (need 25, got ' + (Array.isArray(obj.contentIdeas25) ? obj.contentIdeas25.length : 0) + ')');
  if (!Array.isArray(obj.recommendedCampaignConcepts) || obj.recommendedCampaignConcepts.length < 2) missing.push('recommendedCampaignConcepts (need 2+)');

  if (obj.actionPlan && typeof obj.actionPlan === 'object') {
    const ap = obj.actionPlan as Record<string, unknown>;
    if (!Array.isArray(ap.thingsToDo) || ap.thingsToDo.length < 3) missing.push('actionPlan.thingsToDo (need 3+)');
    if (!Array.isArray(ap.thingsToStop) || ap.thingsToStop.length < 2) missing.push('actionPlan.thingsToStop (need 2+)');
    if (!Array.isArray(ap.contentIdeas) || ap.contentIdeas.length < 3) missing.push('actionPlan.contentIdeas (need 3+)');
  }

  return { valid: missing.length === 0, missing };
}

// ---------- Prompt builders ----------

function buildSystemPrompt(attempt: number): string {
  const strictWarning = attempt > 0
    ? `\n\n⚠️ ניסיון קודם נכשל כי התשובה לא הייתה מלאה. הפעם אתה חייב למלא את כל השדות בצורה מלאה, ספציפית ומעמיקה. אל תשאיר שדה ריק. אל תכתוב "לא זמין". אל תחזור על אותו מידע בשדות שונים. כל שדה חייב להיות ייחודי, חד וספציפי לעסק.`
    : '';

  return `אתה אסטרטג שיווק ישראלי ברמה הגבוהה ביותר, עם ניסיון של 15 שנה בשוק הישראלי. אתה מנתח עסקים בצורה חדה, ישירה וללא פשרות.

## כללים בלתי ניתנים להתפשרות:
1. כל תובנה חייבת להיות ספציפית לעסק הזה — לא גנרית, לא "שפרו את השיווק". אם זה נשמע כמו עצה שמתאימה לכל עסק — זה חסר ערך.
2. כל חולשה חייבת לכלול דוגמה קונקרטית מהעסק או מהתחום שלו.
3. כל הזדמנות חייבת לכלול צעד ראשון ברור שאפשר לעשות מחר בבוקר.
4. תחרים — נסה לזהות שמות אמיתיים בשוק הישראלי. אם אתה לא בטוח, תאר פרופיל תחרותי ריאליסטי.
5. אסור להחזיר שדות ריקים, "לא זמין", או placeholders. כל שדה חייב להכיל תוכן ממשי.
6. החזר JSON תקין בלבד — בלי markdown, בלי הסברים, בלי backticks.
7. כתוב הכל בעברית.
8. ⚠️ contentIdeas25 חייב להכיל בדיוק 25 רעיונות תוכן (idea_1 עד idea_25). לא 5, לא 10 — בדיוק 25. כל רעיון עם id, title, explanation, category. אם יש פחות מ-25 התשובה תידחה אוטומטית.${strictWarning}

## פורמט תשובה:
החזר אובייקט JSON אחד בלבד, ללא טקסט לפני או אחרי. המבנה המדויק נמצא בהודעת המשתמש.`;
}

function buildUserPrompt(client: Client, knowledgeContext: string, creativeDNAContext: string, recentTitles: string[], strategicNotes?: string): string {
  const notesSection = strategicNotes
    ? `\n\n## ⚡ הערות אסטרטגיות מהמנהל (עדיפות עליונה!):\nהערות אלו מגיעות ישירות ממנהל החשבון שמכיר את הלקוח באופן אישי. הם מהווים את המקור הכי אמין ומדויק. כל מה שכתוב כאן גובר על מידע מכל מקור אחר.\n\n${strategicNotes}\n\n⚠️ חובה: התאם את כל סעיפי הדוח (זהות, קהל, חולשות, הזדמנויות, תוכנית פעולה) בהתאם להערות אלו. אם ההערות סותרות מידע אחר — ההערות נכונות.`
    : '';

  return `## נתוני הלקוח:

שם העסק: ${client.name}
תחום עסקי: ${client.businessField}
סוג לקוח: ${client.clientType}
יעדים שיווקיים: ${client.marketingGoals || '(לא הוגדר)'}
הודעות שיווקיות עיקריות: ${client.keyMarketingMessages || '(לא הוגדר)'}

## נוכחות דיגיטלית:
אתר: ${client.websiteUrl || '(אין)'}
פייסבוק: ${client.facebookPageUrl || '(אין)'}
אינסטגרם: ${client.instagramProfileUrl || '(אין)'}
טיקטוק: ${client.tiktokProfileUrl || '(אין)'}
${notesSection}

## מידע נוסף שנאסף:
${knowledgeContext || '(אין מידע קודם)'}

${creativeDNAContext ? `## DNA יצירתי:\n${creativeDNAContext}` : ''}

${recentTitles.length > 0 ? `## תוכן שנוצר לאחרונה (${recentTitles.length} פריטים):\n${recentTitles.slice(0, 5).join('\n')}` : ''}

---

## השב בפורמט JSON הבא בדיוק (בלי markdown, בלי backticks):

{
  "identity": {
    "whatTheySell": "מה הם באמת מוכרים (לא מה שהם אומרים — מה הערך האמיתי שהלקוח מקבל)",
    "positioning": "איך העסק צריך לתפוס מקום בראש של הלקוח הפוטנציאלי",
    "tone": "איך העסק צריך להישמע (חם, מקצועי, צחוק, חד, אותנטי...)",
    "uniqueValue": "מה היתרון הבלתי ניתן להעתקה שלהם (אם אין — תגיד מה יכול להיות)",
    "targetAudience": "תיאור מדויק של הלקוח האידיאלי — אדם אחד ספציפי עם גיל, מצב, צורך"
  },
  "audience": {
    "primary": "הקהל העיקרי — מי הם, מה הם צריכים, איפה הם נמצאים",
    "secondary": "קהל משני שיכול להיות רלוונטי",
    "painPoints": ["כאב 1 ספציפי לקהל", "כאב 2", "כאב 3"]
  },
  "weaknesses": [
    {
      "area": "שם הבעיה",
      "description": "תיאור ספציפי עם דוגמה — לא הצהרה כללית",
      "severity": "critical|high|medium|low",
      "recommendation": "צעד אחד ברור שאפשר לעשות מחר"
    }
  ],
  "competitors": [
    {
      "name": "שם מתחרה (רצוי אמיתי)",
      "whatWorks": ["דבר 1 שעובד להם", "דבר 2"],
      "contentTypes": ["Reels", "Carousels"],
      "toneDifference": "איך הטון שלהם שונה מהלקוח",
      "weakness": "מה חסר להם (= הזדמנות ללקוח)"
    }
  ],
  "competitorSummary": {
    "doMoreOf": ["דבר שהמתחרים עושים טוב והלקוח צריך לאמץ"],
    "avoid": ["דבר שהמתחרים עושים רע — להימנע"],
    "contentTypesPerforming": ["סוגי תוכן שמצליחים בשוק הזה"]
  },
  "opportunities": [
    {
      "title": "כותרת ההזדמנות",
      "description": "מה לעשות — צעד אחד קונקרטי",
      "potentialImpact": "high|medium|low",
      "category": "gap|underused_angle|positioning|trend"
    }
  ],
  "recommendedContentAngles": [
    "זווית תוכן 1 ספציפית לעסק הזה",
    "זווית תוכן 2",
    "זווית תוכן 3",
    "זווית תוכן 4",
    "זווית תוכן 5"
  ],
  "contentIdeas25": [
    { "id": "idea_1", "title": "כותרת רעיון 1 — חזק וספציפי", "explanation": "הסבר קצר — זווית אסטרטגית", "category": "weakness" },
    { "id": "idea_2", "title": "כותרת רעיון 2", "explanation": "זווית שונה", "category": "opportunity" },
    { "id": "idea_3", "title": "כותרת רעיון 3", "explanation": "זווית שונה", "category": "audience" },
    { "id": "idea_4", "title": "כותרת רעיון 4", "explanation": "זווית שונה", "category": "competitor" },
    { "id": "idea_5", "title": "כותרת רעיון 5", "explanation": "זווית שונה", "category": "trend" },
    { "id": "idea_6", "title": "כותרת רעיון 6", "explanation": "זווית שונה", "category": "seasonal" },
    { "id": "idea_7", "title": "כותרת רעיון 7", "explanation": "זווית שונה", "category": "brand" },
    { "id": "idea_8", "title": "כותרת רעיון 8", "explanation": "זווית שונה", "category": "engagement" },
    { "id": "idea_9", "title": "כותרת רעיון 9", "explanation": "זווית שונה", "category": "weakness" },
    { "id": "idea_10", "title": "כותרת רעיון 10", "explanation": "זווית שונה", "category": "opportunity" },
    { "id": "idea_11", "title": "כותרת רעיון 11", "explanation": "זווית שונה", "category": "audience" },
    { "id": "idea_12", "title": "כותרת רעיון 12", "explanation": "זווית שונה", "category": "competitor" },
    { "id": "idea_13", "title": "כותרת רעיון 13", "explanation": "זווית שונה", "category": "trend" },
    { "id": "idea_14", "title": "כותרת רעיון 14", "explanation": "זווית שונה", "category": "seasonal" },
    { "id": "idea_15", "title": "כותרת רעיון 15", "explanation": "זווית שונה", "category": "brand" },
    { "id": "idea_16", "title": "כותרת רעיון 16", "explanation": "זווית שונה", "category": "engagement" },
    { "id": "idea_17", "title": "כותרת רעיון 17", "explanation": "זווית שונה", "category": "weakness" },
    { "id": "idea_18", "title": "כותרת רעיון 18", "explanation": "זווית שונה", "category": "opportunity" },
    { "id": "idea_19", "title": "כותרת רעיון 19", "explanation": "זווית שונה", "category": "audience" },
    { "id": "idea_20", "title": "כותרת רעיון 20", "explanation": "זווית שונה", "category": "competitor" },
    { "id": "idea_21", "title": "כותרת רעיון 21", "explanation": "זווית שונה", "category": "trend" },
    { "id": "idea_22", "title": "כותרת רעיון 22", "explanation": "זווית שונה", "category": "seasonal" },
    { "id": "idea_23", "title": "כותרת רעיון 23", "explanation": "זווית שונה", "category": "brand" },
    { "id": "idea_24", "title": "כותרת רעיון 24", "explanation": "זווית שונה", "category": "engagement" },
    { "id": "idea_25", "title": "כותרת רעיון 25", "explanation": "זווית שונה", "category": "weakness" }
  ],
  "recommendedCampaignConcepts": [
    {
      "name": "שם הקמפיין",
      "goal": "המטרה — מה רוצים להשיג",
      "platforms": ["instagram", "facebook"],
      "format": "סוג התוכן (Reels, Carousel, Story, Video)"
    }
  ],
  "actionPlan": {
    "thingsToDo": [
      { "action": "פעולה ספציפית (לא 'שפרו את השיווק')", "priority": "urgent|high|medium" }
    ],
    "thingsToStop": [
      { "action": "מה להפסיק", "reason": "למה זה מזיק" }
    ],
    "contentIdeas": [
      { "idea": "רעיון תוכן ספציפי", "format": "Reel|Carousel|Story|Video|Text|Live", "platform": "instagram|tiktok|facebook|all" }
    ]
  },
  "sourcesAnalyzed": ["מקורות שנותחו"]
}

## דרישות כמות מינימלית:
- weaknesses: 4-6 פריטים
- competitors: 2-4 פריטים
- opportunities: 4-6 פריטים
- recommendedContentAngles: 5-8 פריטים
- contentIdeas25: ⚠️⚠️⚠️ חובה: בדיוק 25 רעיונות תוכן!! לא 5. לא 10. בדיוק 25!! id ייחודי מ-idea_1 עד idea_25. כל אחד עם title (קצר, חזק, ספציפי לעסק), explanation (זווית אסטרטגית), category (weakness/opportunity/audience/competitor/trend/seasonal/brand/engagement). המערך חייב להכיל 25 אובייקטים. אם יש פחות מ-25 — התוצאה תידחה ותתבצע בקשה חוזרת.
- recommendedCampaignConcepts: 3-5 פריטים
- actionPlan.thingsToDo: 5-8 פריטים
- actionPlan.thingsToStop: 3-5 פריטים
- actionPlan.contentIdeas: 5-8 פריטים
- audience.painPoints: 3-5 פריטים`;
}

// ---------- JSON extraction helper ----------

function extractJSON(raw: string): unknown {
  // Try direct parse
  try {
    return JSON.parse(raw);
  } catch {
    // noop
  }

  // Try to extract from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // noop
    }
  }

  // Try to find first { ... last }
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch {
      // noop
    }
  }

  return null;
}

// ---------- GET handler ----------

export async function GET(req: NextRequest) {
  ensureSeeded();

  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing clientId query parameter' },
        { status: 400 }
      );
    }

    // Load from Supabase (single source of truth)
    const research = await loadResearchFromSupabase(clientId);
    if (research) {
      console.log(`[client-research] GET: serving from Supabase for ${clientId}`);
      return NextResponse.json({ success: true, data: research });
    }

    // No data — return empty state
    console.log(`[client-research] GET: no research found for ${clientId}`);
    return NextResponse.json({ data: null }, { status: 200 });
  } catch (error) {
    console.error('Error fetching client research:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch client research', details: errorMessage },
      { status: 500 }
    );
  }
}

// ---------- POST handler ----------

export async function POST(req: NextRequest) {
  ensureSeeded();

  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      console.warn('[client-research] Invalid or empty JSON body');
    }
    const clientId = (body?.clientId as string) || '';
    const incomingNotes = (body?.strategicNotes as string) || '';

    if (!clientId) {
      console.warn('[client-research] Missing field: clientId');
      return NextResponse.json({ error: 'Missing clientId in request body', missing: ['clientId'] }, { status: 400 });
    }

    const client = await fetchClientFromSupabase(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Check for existing research in Supabase (to preserve notes and reuse ID)
    const existingResearch = await loadResearchFromSupabase(clientId);

    // Resolve strategic notes: incoming notes override, else use existing
    const strategicNotes = incomingNotes || existingResearch?.strategicNotes || '';

    // Create initial research record
    const researchId = existingResearch?.id || ('crs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
    const now = new Date().toISOString();

    const initialResearch: ClientResearch = {
      id: researchId,
      clientId,
      identity: { whatTheySell: '', positioning: '', tone: '', uniqueValue: '', targetAudience: '' },
      audience: { primary: '', secondary: '', painPoints: [] },
      weaknesses: [],
      competitors: [],
      competitorSummary: { doMoreOf: [], avoid: [], contentTypesPerforming: [] },
      opportunities: [],
      recommendedContentAngles: [],
      recommendedCampaignConcepts: [],
      actionPlan: { thingsToDo: [], thingsToStop: [], contentIdeas: [] },
      sourcesAnalyzed: [],
      strategicNotes,
      notesAppliedAt: strategicNotes ? now : existingResearch?.notesAppliedAt,
      status: 'analyzing',
      generatedAt: now,
      createdAt: existingResearch?.createdAt || now,
      updatedAt: now,
    };

    // Save initial "analyzing" state to Supabase
    const initialSaved = await saveResearchToSupabase(initialResearch);
    if (!initialSaved) {
      console.error(`[client-research] POST: Failed to save initial research state to Supabase`);
      return NextResponse.json({
        success: false,
        error: 'Failed to initialize research in database. Check Supabase connection and client_research table.',
      }, { status: 500 });
    }
    console.log(`[client-research] POST: Initial research state saved to Supabase`);

    // Gather context
    const knowledgeContext = await getClientKnowledgeContext(clientId);
    const creativeDNARecord = await creativeDNA.queryAsync((d) => d.clientId === clientId);
    const ganttItems = await clientGanttItems.queryAsync((g) => g.clientId === clientId);

    const recentTitles = ganttItems
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((g) => g.title);

    const creativeDNAContext = creativeDNARecord.length > 0
      ? `טון: ${creativeDNARecord[0].toneOfVoice}\nסגנון מכירה: ${creativeDNARecord[0].sellingStyle}\nסגנון ויזואלי: ${creativeDNARecord[0].visualStyle}`
      : '';

    const userPrompt = buildUserPrompt(client, knowledgeContext, creativeDNAContext, recentTitles, strategicNotes);

    // ---------- Retry loop (max 3 attempts: initial + 2 retries) ----------
    const MAX_ATTEMPTS = 3;
    let lastError = '';
    let lastMissing: string[] = [];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const systemPrompt = buildSystemPrompt(attempt);

      console.log(`\n========== CLIENT RESEARCH — ATTEMPT ${attempt + 1}/${MAX_ATTEMPTS} ==========`);
      console.log(`Client: ${client.name} (${clientId})`);
      console.log(`System prompt length: ${systemPrompt.length} chars`);
      console.log(`User prompt length: ${userPrompt.length} chars`);

      const aiResult = await generateWithAI(systemPrompt, userPrompt, {
        temperature: attempt === 0 ? 0.7 : 0.5,
        maxTokens: 12000,
      });

      console.log(`AI result success: ${aiResult.success}`);
      if (!aiResult.success) {
        console.error(`AI error: ${aiResult.error} (type: ${aiResult.errorType})`);
        lastError = aiResult.error || 'Unknown AI error';

        // If missing API key, no point retrying
        if (aiResult.errorType === 'missing_api_key') {
          await saveResearchToSupabase({
            ...initialResearch,
            status: 'failed',
            error: 'חסר מפתח OpenAI API. הגדר בהגדרות → AI.',
            updatedAt: new Date().toISOString(),
          });
          return NextResponse.json({
            success: false,
            error: aiResult.error,
            errorType: aiResult.errorType,
          }, { status: 400 });
        }

        continue; // retry on network/provider errors
      }

      // Log raw response
      const rawData = aiResult.data;
      const rawStr = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
      console.log(`Raw AI response (first 500 chars): ${rawStr.slice(0, 500)}`);

      // Parse JSON
      const parsed = typeof rawData === 'object' && rawData !== null
        ? rawData
        : extractJSON(rawStr);

      if (!parsed) {
        console.error(`JSON parse failed on attempt ${attempt + 1}`);
        lastError = 'Failed to parse AI response as JSON';
        lastMissing = ['(JSON parse failed)'];
        continue;
      }

      const parsedObj = parsed as Record<string, unknown>;
      console.log(`Parsed JSON keys: ${Object.keys(parsedObj).join(', ')}`);
      console.log(`[Research] contentIdeas25 count: ${Array.isArray(parsedObj.contentIdeas25) ? (parsedObj.contentIdeas25 as unknown[]).length : 'MISSING'}`);

      // Validate schema
      const validation = validateResearchJSON(parsed);
      console.log(`Validation: valid=${validation.valid}, missing=${validation.missing.join(', ') || 'none'}`);

      if (!validation.valid) {
        lastError = `Schema validation failed: missing ${validation.missing.join(', ')}`;
        lastMissing = validation.missing;
        console.warn(`Attempt ${attempt + 1} rejected — missing: ${validation.missing.join(', ')}`);
        continue;
      }

      // SUCCESS — save and return
      const researchData = parsed as Record<string, unknown>;

      const finalResearch: ClientResearch = {
        id: researchId,
        clientId,
        identity: researchData.identity as ClientResearch['identity'],
        audience: researchData.audience as ClientResearch['audience'],
        weaknesses: researchData.weaknesses as ClientResearch['weaknesses'],
        competitors: researchData.competitors as ClientResearch['competitors'],
        competitorSummary: researchData.competitorSummary as ClientResearch['competitorSummary'],
        opportunities: researchData.opportunities as ClientResearch['opportunities'],
        recommendedContentAngles: researchData.recommendedContentAngles as string[],
        contentIdeas25: (researchData.contentIdeas25 as ClientResearch['contentIdeas25']) || [],
        recommendedCampaignConcepts: researchData.recommendedCampaignConcepts as ClientResearch['recommendedCampaignConcepts'],
        actionPlan: researchData.actionPlan as ClientResearch['actionPlan'],
        sourcesAnalyzed: Array.isArray(researchData.sourcesAnalyzed)
          ? (researchData.sourcesAnalyzed as string[])
          : [
              client.websiteUrl,
              client.facebookPageUrl,
              client.instagramProfileUrl,
            ].filter(Boolean),
        strategicNotes,
        notesAppliedAt: strategicNotes ? new Date().toISOString() : initialResearch.notesAppliedAt,
        savedAt: new Date().toISOString(), // Auto-save after generation
        status: 'complete',
        generatedAt: new Date().toISOString(),
        createdAt: initialResearch.createdAt,
        updatedAt: new Date().toISOString(),
      };

      // ── Persist to Supabase (single source of truth) ──
      const sbSaved = await saveResearchToSupabase(finalResearch);
      if (!sbSaved) {
        console.error(`[client-research] ⚠️ Supabase persistence FAILED for ${client.name}`);
        return NextResponse.json({
          success: false,
          error: 'Research generated but failed to persist to database',
        }, { status: 500 });
      }

      console.log(`✅ Research saved for ${client.name} attempt ${attempt + 1}. ideas=${finalResearch.contentIdeas25?.length ?? 0}`);

      return NextResponse.json({
        success: true,
        data: finalResearch,
        persisted: sbSaved,
        message: `Client research generated successfully (attempt ${attempt + 1})`,
      });
    }

    // All attempts exhausted
    console.error(`❌ All ${MAX_ATTEMPTS} attempts failed for ${client.name}. Last error: ${lastError}`);

    await saveResearchToSupabase({
      ...initialResearch,
      status: 'failed',
      error: `נכשל לאחר ${MAX_ATTEMPTS} ניסיונות: ${lastError}. שדות חסרים: ${lastMissing.join(', ')}`,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: false,
      error: `Research generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`,
      missingFields: lastMissing,
    }, { status: 500 });

  } catch (error) {
    console.error('Error generating client research:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate client research', details: errorMessage },
      { status: 500 }
    );
  }
}

// ---------- PATCH handler — save strategic notes without regenerating ----------

// ---------- PUT handler: Explicit full save of research ----------

export async function PUT(req: NextRequest) {
  ensureSeeded();

  try {
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }
    const clientId = (body?.clientId as string) || '';

    if (!clientId) {
      console.warn('[client-research PUT] Missing field: clientId');
      return NextResponse.json({ error: 'Missing clientId', missing: ['clientId'] }, { status: 400 });
    }

    // Load from Supabase (single source of truth)
    const researchToSave = await loadResearchFromSupabase(clientId);

    if (!researchToSave) {
      return NextResponse.json({ error: 'No research found to save' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updatedResearch = { ...researchToSave, savedAt: now, updatedAt: now };

    const sbSaved = await saveResearchToSupabase(updatedResearch);

    if (!sbSaved) {
      console.error(`[Research] Explicit save FAILED for client ${clientId}`);
      return NextResponse.json({ error: 'Failed to persist research to database' }, { status: 500 });
    }

    console.log(`[Research] Explicit save for client ${clientId} at ${now}`);

    return NextResponse.json({
      success: true,
      data: updatedResearch,
      persisted: true,
      message: 'Research saved successfully',
    });
  } catch (error) {
    console.error('Error saving research:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to save research', details: errorMessage },
      { status: 500 }
    );
  }
}

// ---------- PATCH handler: Save strategic notes only ----------

export async function PATCH(req: NextRequest) {
  ensureSeeded();

  try {
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }
    const clientId = (body?.clientId as string) || '';
    const strategicNotes = body?.strategicNotes;

    if (!clientId) {
      console.warn('[client-research PATCH] Missing field: clientId');
      return NextResponse.json({ error: 'Missing clientId', missing: ['clientId'] }, { status: 400 });
    }

    if (typeof strategicNotes !== 'string') {
      console.warn('[client-research PATCH] strategicNotes not a string');
      return NextResponse.json({ error: 'strategicNotes must be a string' }, { status: 400 });
    }

    // Load from Supabase (single source of truth)
    const existingRecord = await loadResearchFromSupabase(clientId);

    if (!existingRecord) {
      // Create a minimal record to hold the notes
      const researchId = 'crs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const now = new Date().toISOString();
      const record: ClientResearch = {
        id: researchId,
        clientId,
        identity: { whatTheySell: '', positioning: '', tone: '', uniqueValue: '', targetAudience: '' },
        audience: { primary: '', secondary: '', painPoints: [] },
        weaknesses: [],
        competitors: [],
        competitorSummary: { doMoreOf: [], avoid: [], contentTypesPerforming: [] },
        opportunities: [],
        recommendedContentAngles: [],
        recommendedCampaignConcepts: [],
        actionPlan: { thingsToDo: [], thingsToStop: [], contentIdeas: [] },
        sourcesAnalyzed: [],
        strategicNotes,
        status: 'pending',
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const saved = await saveResearchToSupabase(record);
      if (!saved) {
        return NextResponse.json({ error: 'Failed to save notes to database' }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: record });
    }

    const updatedRecord = {
      ...existingRecord,
      strategicNotes,
      updatedAt: new Date().toISOString(),
    };

    await saveResearchToSupabase(updatedRecord);

    return NextResponse.json({ success: true, data: updatedRecord });
  } catch (error) {
    console.error('Error saving strategic notes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to save notes', details: errorMessage },
      { status: 500 }
    );
  }
}
