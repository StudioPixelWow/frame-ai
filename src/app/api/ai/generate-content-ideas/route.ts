/**
 * POST /api/ai/generate-content-ideas
 * Generates 25 strategic content ideas for an existing client research record.
 * Used when research exists but contentIdeas25 is missing (legacy data).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded } from '@/lib/db/seed';
import { getSupabase, ensureTable } from '@/lib/db/store';
import { generateWithAI } from '@/lib/ai/openai-client';
import { getClientById } from '@/lib/db/client-helpers';
import { getHolidaysForMonth } from '@/lib/israeli-holidays';
import type { ClientResearch } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  await ensureSeeded();

  try {
    const body = await req.json();
    const { clientId, keepIdeaIds } = body as { clientId?: string; keepIdeaIds?: string[] };

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    // keepIdeaIds: array of idea IDs the user selected to keep
    const idsToKeep = new Set(Array.isArray(keepIdeaIds) ? keepIdeaIds : []);

    const client = await getClientById(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 400 });
    }

    // Ensure table exists, then load research from Supabase
    await ensureTable('client_research', `
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
    `);
    let research: ClientResearch | null = null;
    const sb = getSupabase();
    const { data: sbRow, error: sbError } = await sb
      .from('client_research')
      .select('client_brain')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sbError) {
      console.error('[GenerateIdeas] Supabase load failed:', sbError.message);
      return NextResponse.json({ error: 'Failed to load research from database' }, { status: 500 });
    }
    if (sbRow && (sbRow as Record<string, unknown>).client_brain) {
      research = JSON.parse((sbRow as Record<string, unknown>).client_brain as string) as ClientResearch;
      console.log(`[GenerateIdeas] Research loaded from Supabase for ${clientId}`);
    }
    if (!research) {
      return NextResponse.json({ error: 'No research found — run full research first' }, { status: 404 });
    }

    // Build context from existing research
    const contextParts: string[] = [];
    if (research.identity) {
      contextParts.push(`עסק: ${client.name}`);
      contextParts.push(`תחום: ${client.businessField}`);
      contextParts.push(`מוכרים: ${research.identity.whatTheySell}`);
      contextParts.push(`מיצוב: ${research.identity.positioning}`);
      contextParts.push(`טון: ${research.identity.tone}`);
      contextParts.push(`ערך ייחודי: ${research.identity.uniqueValue}`);
      contextParts.push(`קהל: ${research.identity.targetAudience}`);
    }
    if (research.audience?.painPoints?.length > 0) {
      contextParts.push(`נקודות כאב: ${research.audience.painPoints.join(', ')}`);
    }
    if (research.weaknesses?.length > 0) {
      contextParts.push(`חולשות: ${research.weaknesses.map(w => w.area + ': ' + w.description).join('; ')}`);
    }
    if (research.opportunities?.length > 0) {
      contextParts.push(`הזדמנויות: ${research.opportunities.map(o => o.title + ': ' + o.description).join('; ')}`);
    }
    if (research.competitors?.length > 0) {
      contextParts.push(`מתחרים: ${research.competitors.map(c => c.name).join(', ')}`);
    }
    if (research.strategicNotes?.trim()) {
      contextParts.push(`הערות אסטרטגיות: ${research.strategicNotes.trim()}`);
    }

    const researchContext = contextParts.join('\n');

    // === RTM: Build temporal context (current date, season, upcoming holidays) ===
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const dateStr = `${currentDay} ב${hebrewMonths[currentMonth - 1]} ${currentYear}`;

    // Determine Hebrew season
    let season = 'חורף';
    if (currentMonth >= 3 && currentMonth <= 5) season = 'אביב';
    else if (currentMonth >= 6 && currentMonth <= 8) season = 'קיץ';
    else if (currentMonth >= 9 && currentMonth <= 11) season = 'סתיו';

    // Gather upcoming holidays for next 3 months
    const upcomingHolidays: string[] = [];
    for (let offset = 0; offset <= 2; offset++) {
      const m = ((currentMonth - 1 + offset) % 12) + 1;
      const y = currentMonth + offset > 12 ? currentYear + 1 : currentYear;
      const holidays = getHolidaysForMonth(m, y);
      for (const h of holidays) {
        // Skip holidays that already passed this month
        if (offset === 0 && h.approximateDay < currentDay) continue;
        upcomingHolidays.push(`${h.hebrewName} (${h.approximateDay} ב${hebrewMonths[h.month - 1]} ${y})`);
      }
    }

    const temporalContext = [
      `תאריך נוכחי: ${dateStr}`,
      `עונה: ${season}`,
      upcomingHolidays.length > 0
        ? `חגים וארועים קרובים (3 חודשים הבאים): ${upcomingHolidays.join(', ')}`
        : 'אין חגים מיוחדים ב-3 החודשים הקרובים',
    ].join('\n');

    // Preserve kept ideas from the existing research (must be before prompts)
    const existingIdeas = research.contentIdeas25 || [];
    const keptIdeas = idsToKeep.size > 0
      ? existingIdeas.filter((i: any) => idsToKeep.has(i.id))
      : [];
    const neededCount = 25 - keptIdeas.length;

    const systemPrompt = `אתה אסטרטג תוכן ישראלי ברמה הגבוהה ביותר.
אתה מקבל מידע על עסק וחקר לקוח שכבר בוצע, ואתה צריך לייצר בדיוק ${neededCount} רעיונות תוכן אסטרטגיים.

כללים:
1. בדיוק ${neededCount} רעיונות — לא יותר ולא פחות.
2. כל רעיון הוא כיוון אסטרטגי, לא פוסט מוגמר.
3. כל רעיון חייב להיות ספציפי לעסק הזה — לא גנרי.
4. מגוון קטגוריות: weakness, opportunity, audience, competitor, trend, seasonal, brand, engagement.
5. עברית בלבד.
6. החזר JSON תקין בלבד — בלי markdown, בלי backticks, בלי הסברים.
7. כל רעיון בקטגוריות seasonal ו-trend חייב להתייחס לתקופה הנוכחית בלבד — ${hebrewMonths[currentMonth - 1]} ${currentYear} והחודשים הקרובים. אסור בשום אופן להתייחס לחגים שעברו, לעונות שלא רלוונטיות, או לשנים קודמות.
8. השנה הנוכחית היא ${currentYear}. אל תזכיר שנים אחרות.`;

    const userPrompt = `## הקשר זמני (RTM — Real-Time Marketing):
${temporalContext}

## נתוני העסק והחקר:
${researchContext}

## מטרות שיווקיות:
${client.marketingGoals || '(לא הוגדר)'}

## מסרים שיווקיים:
${client.keyMarketingMessages || '(לא הוגדר)'}

## השב בפורמט JSON בדיוק — מערך של ${neededCount} אובייקטים:

[
  { "id": "new_1", "title": "כותרת קצרה וחזקה", "explanation": "זווית אסטרטגית — משפט אחד", "category": "weakness" },
  { "id": "new_2", "title": "...", "explanation": "...", "category": "opportunity" },
  ...
  { "id": "new_${neededCount}", "title": "...", "explanation": "...", "category": "brand" }
]

חובה: בדיוק ${neededCount} פריטים. id מ-new_1 עד new_${neededCount}.
קטגוריות אפשריות: weakness, opportunity, audience, competitor, trend, seasonal, brand, engagement.
חשוב: רעיונות עונתיים חייבים להתבסס על התקופה הנוכחית והחגים הקרובים שמפורטים למעלה. אסור להתייחס לפסח, ראש השנה, או כל חג שלא מופיע ברשימת החגים הקרובים.
${keptIdeas.length > 0 ? `\nחשוב: הרעיונות הבאים כבר נבחרו ונשמרים — אל תייצר רעיונות דומים או זהים:\n${keptIdeas.map((i: any) => `- ${i.title}`).join('\n')}` : ''}`;

    console.log(`[GenerateIdeas] Generating ${neededCount} ideas for client: ${client.name} (${clientId}), keeping ${keptIdeas.length}`);

    const MAX_ATTEMPTS = 3;
    let ideas: Array<{ id: string; title: string; explanation: string; category: string }> = [];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const result = await generateWithAI(systemPrompt, userPrompt, {
        temperature: attempt === 0 ? 0.8 : 0.6,
        maxTokens: 6000,
      });

      if (!result.success || !result.data) {
        console.warn(`[GenerateIdeas] Attempt ${attempt + 1} failed: ${result.error}`);
        continue;
      }

      // Parse the result
      let parsed: unknown[] | null = null;

      if (Array.isArray(result.data)) {
        parsed = result.data;
      } else if (typeof result.data === 'string') {
        try {
          const match = result.data.match(/\[[\s\S]*\]/);
          if (match) parsed = JSON.parse(match[0]);
        } catch { /* ignore */ }
      } else if (typeof result.data === 'object' && result.data !== null) {
        // Might be wrapped in an object like { contentIdeas25: [...] }
        const obj = result.data as Record<string, unknown>;
        if (Array.isArray(obj.contentIdeas25)) parsed = obj.contentIdeas25;
        else if (Array.isArray(obj.ideas)) parsed = obj.ideas;
        else {
          // Try to find any array property
          for (const key of Object.keys(obj)) {
            if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length >= 10) {
              parsed = obj[key] as unknown[];
              break;
            }
          }
        }
      }

      const minAcceptable = Math.max(Math.floor(neededCount * 0.8), 1);
      if (parsed && parsed.length >= minAcceptable) {
        ideas = parsed.slice(0, neededCount).map((item: any, idx: number) => ({
          id: item.id || `new_${idx + 1}`,
          title: item.title || `רעיון ${idx + 1}`,
          explanation: item.explanation || '',
          category: item.category || 'brand',
        }));
        console.log(`[GenerateIdeas] ✅ Attempt ${attempt + 1}: got ${ideas.length} new ideas (needed ${neededCount})`);
        break;
      } else {
        console.warn(`[GenerateIdeas] Attempt ${attempt + 1}: only ${parsed?.length ?? 0} ideas (need ${minAcceptable}+)`);
      }
    }

    // Pad new ideas to neededCount if we got close but not enough
    while (ideas.length < neededCount && ideas.length > 0) {
      const idx = ideas.length + 1;
      ideas.push({
        id: `new_${idx}`,
        title: `רעיון תוכן ${idx} — ${client.businessField}`,
        explanation: `זווית תוכן נוספת שמתמקדת בערך הייחודי של ${client.name}`,
        category: ['weakness', 'opportunity', 'audience', 'competitor', 'trend', 'seasonal', 'brand', 'engagement'][idx % 8],
      });
    }

    // Merge kept ideas + new ideas, then re-index to idea_1..idea_25
    const mergedIdeas = [...keptIdeas, ...ideas].map((idea: any, idx: number) => ({
      ...idea,
      id: `idea_${idx + 1}`,
    }));
    ideas = mergedIdeas;

    if (ideas.length === 0) {
      // Complete fallback — generate deterministic ideas
      const categories = ['weakness', 'opportunity', 'audience', 'competitor', 'trend', 'seasonal', 'brand', 'engagement'];
      const angles = research.recommendedContentAngles || [];
      const weaknesses = research.weaknesses || [];
      const opportunities = research.opportunities || [];
      const painPoints = research.audience?.painPoints || [];

      for (let i = 0; i < 25; i++) {
        let title = '';
        let explanation = '';
        const cat = categories[i % categories.length];

        if (i < angles.length) {
          title = angles[i].split('—')[0]?.trim() || angles[i].substring(0, 50);
          explanation = angles[i];
        } else if (i < angles.length + weaknesses.length) {
          const w = weaknesses[i - angles.length];
          title = `תיקון: ${w.area}`;
          explanation = w.recommendation || w.description;
        } else if (i < angles.length + weaknesses.length + opportunities.length) {
          const o = opportunities[i - angles.length - weaknesses.length];
          title = o.title;
          explanation = o.description;
        } else if (i < angles.length + weaknesses.length + opportunities.length + painPoints.length) {
          const pp = painPoints[i - angles.length - weaknesses.length - opportunities.length];
          title = `פתרון לכאב: ${pp.substring(0, 40)}`;
          explanation = pp;
        } else {
          title = `רעיון ${i + 1}: ${client.businessField}`;
          explanation = `תוכן שמחזק את המיצוב של ${client.name} בשוק`;
        }

        ideas.push({
          id: `idea_${i + 1}`,
          title,
          explanation,
          category: cat,
        });
      }
      console.log(`[GenerateIdeas] ⚠️ Used deterministic fallback — ${ideas.length} ideas`);
    }

    // Patch the ideas into existing research
    const updatedResearch: ClientResearch = {
      ...research,
      contentIdeas25: ideas as ClientResearch['contentIdeas25'],
      updatedAt: new Date().toISOString(),
    };

    // Save to Supabase (single source of truth)
    let sbSaved = false;
    try {
      const { error } = await sb
        .from('client_research')
        .upsert({
          id: updatedResearch.id,
          client_id: updatedResearch.clientId,
          client_brain: JSON.stringify(updatedResearch),
          summary: JSON.stringify(updatedResearch.identity ?? {}),
          customer_profile: JSON.stringify(updatedResearch.audience ?? {}),
          trend_engine: JSON.stringify(updatedResearch.opportunities ?? []),
          competitor_analysis: JSON.stringify({
            competitors: updatedResearch.competitors ?? [],
            competitorSummary: updatedResearch.competitorSummary ?? {},
          }),
          brand_weakness: JSON.stringify(updatedResearch.weaknesses ?? []),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      sbSaved = !error;
      if (error) console.error('[GenerateIdeas] Supabase save failed:', error.message);
    } catch (err) {
      console.error('[GenerateIdeas] Supabase save exception:', err);
    }

    if (!sbSaved) {
      console.error(`[GenerateIdeas] ⚠️ Supabase persistence FAILED for research ${research.id}`);
      return NextResponse.json({
        error: 'Ideas generated but failed to persist to database',
      }, { status: 500 });
    }

    console.log(`[GenerateIdeas] ✅ Saved ${ideas.length} ideas to research ${research.id}`);

    return NextResponse.json({
      success: true,
      data: updatedResearch,
      ideasCount: ideas.length,
      persisted: true,
    });

  } catch (error) {
    console.error('[GenerateIdeas] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
