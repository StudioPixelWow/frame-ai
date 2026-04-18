/**
 * POST /api/ai/generate-content-ideas
 * Generates 25 strategic content ideas for an existing client research record.
 * Used when research exists but contentIdeas25 is missing (legacy data).
 */

import { NextRequest, NextResponse } from 'next/server';
import { clients } from '@/lib/db';
import { clientResearch } from '@/lib/db/collections';
import { ensureSeeded } from '@/lib/db/seed';
import { getSupabase } from '@/lib/db/store';
import { generateWithAI } from '@/lib/ai/openai-client';
import type { ClientResearch } from '@/lib/db';

export async function POST(req: NextRequest) {
  await ensureSeeded();

  try {
    const body = await req.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    const client = clients.getById(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 400 });
    }

    // Try Supabase first (persistent), fallback to JsonStore
    let research: ClientResearch | null = null;
    try {
      const sb = getSupabase();
      const { data: sbRow } = await sb
        .from('client_research')
        .select('client_brain')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sbRow && (sbRow as Record<string, unknown>).client_brain) {
        research = JSON.parse((sbRow as Record<string, unknown>).client_brain as string) as ClientResearch;
        console.log(`[GenerateIdeas] Research loaded from Supabase for ${clientId}`);
      }
    } catch (err) {
      console.warn('[GenerateIdeas] Supabase load failed, trying JsonStore:', err);
    }
    if (!research) {
      const existing = clientResearch.query((r: ClientResearch) => r.clientId === clientId);
      if (existing.length > 0) {
        research = existing[existing.length - 1];
        console.log(`[GenerateIdeas] Research loaded from JsonStore for ${clientId}`);
      }
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

    const systemPrompt = `אתה אסטרטג תוכן ישראלי ברמה הגבוהה ביותר.
אתה מקבל מידע על עסק וחקר לקוח שכבר בוצע, ואתה צריך לייצר בדיוק 25 רעיונות תוכן אסטרטגיים.

כללים:
1. בדיוק 25 רעיונות — לא 5, לא 10, לא 20. בדיוק 25.
2. כל רעיון הוא כיוון אסטרטגי, לא פוסט מוגמר.
3. כל רעיון חייב להיות ספציפי לעסק הזה — לא גנרי.
4. מגוון קטגוריות: weakness, opportunity, audience, competitor, trend, seasonal, brand, engagement.
5. עברית בלבד.
6. החזר JSON תקין בלבד — בלי markdown, בלי backticks, בלי הסברים.`;

    const userPrompt = `## נתוני העסק והחקר:
${researchContext}

## מטרות שיווקיות:
${client.marketingGoals || '(לא הוגדר)'}

## מסרים שיווקיים:
${client.keyMarketingMessages || '(לא הוגדר)'}

## השב בפורמט JSON בדיוק — מערך של 25 אובייקטים:

[
  { "id": "idea_1", "title": "כותרת קצרה וחזקה", "explanation": "זווית אסטרטגית — משפט אחד", "category": "weakness" },
  { "id": "idea_2", "title": "...", "explanation": "...", "category": "opportunity" },
  { "id": "idea_3", "title": "...", "explanation": "...", "category": "audience" },
  ...
  { "id": "idea_25", "title": "...", "explanation": "...", "category": "brand" }
]

חובה: בדיוק 25 פריטים. id מ-idea_1 עד idea_25.
קטגוריות אפשריות: weakness, opportunity, audience, competitor, trend, seasonal, brand, engagement.`;

    console.log(`[GenerateIdeas] Generating 25 ideas for client: ${client.name} (${clientId})`);

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

      if (parsed && parsed.length >= 20) {
        ideas = parsed.map((item: any, idx: number) => ({
          id: item.id || `idea_${idx + 1}`,
          title: item.title || `רעיון ${idx + 1}`,
          explanation: item.explanation || '',
          category: item.category || 'brand',
        }));
        console.log(`[GenerateIdeas] ✅ Attempt ${attempt + 1}: got ${ideas.length} ideas`);
        break;
      } else {
        console.warn(`[GenerateIdeas] Attempt ${attempt + 1}: only ${parsed?.length ?? 0} ideas (need 20+)`);
      }
    }

    // Pad to 25 if we got close but not enough
    while (ideas.length < 25 && ideas.length > 0) {
      const idx = ideas.length + 1;
      ideas.push({
        id: `idea_${idx}`,
        title: `רעיון תוכן ${idx} — ${client.businessField}`,
        explanation: `זווית תוכן נוספת שמתמקדת בערך הייחודי של ${client.name}`,
        category: ['weakness', 'opportunity', 'audience', 'competitor', 'trend', 'seasonal', 'brand', 'engagement'][idx % 8],
      });
    }

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

    // Save to JsonStore
    try {
      clientResearch.update(research.id, updatedResearch);
    } catch { /* JsonStore may not have this record */ }

    // Save to Supabase (persistent)
    let sbSaved = false;
    try {
      const sb = getSupabase();
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

    console.log(`[GenerateIdeas] ✅ Saved ${ideas.length} ideas to research ${research.id}, supabase=${sbSaved}`);

    return NextResponse.json({
      success: true,
      data: updatedResearch,
      ideasCount: ideas.length,
      persisted: sbSaved,
    });

  } catch (error) {
    console.error('[GenerateIdeas] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
