/**
 * POST /api/ai/orchestrate-insights
 *
 * Server-side orchestration for all AI insight generators.
 * Builds context ONCE, then generates each section in controlled sequence.
 * Each result is persisted to app_client_insights.
 *
 * Request: { clientId: string, sections?: InsightSection[], force?: boolean }
 * - sections: which sections to generate (default: all)
 * - force: regenerate even if persisted data exists
 *
 * Response: { results: Record<section, { status, error? }> }
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildClientInsightContext } from '@/lib/ai/insight-context';
import type { InsightContext } from '@/lib/ai/insight-context';
import { clientInsights, creativeDNA } from '@/lib/db/collections';
import type { ClientInsight, InsightSection, CreativeDNA } from '@/lib/db/schema';
import { generateWithAI, getClientKnowledgeContext } from '@/lib/ai/openai-client';

const ALL_SECTIONS: InsightSection[] = [
  'client_brain',
  'brand_weakness',
  'customer_profile',
  'trend_engine',
  'competitor_insights',
  'creative_dna',
];

type SectionResult = { status: 'ready' | 'error' | 'skipped'; error?: string };

// ============================================================================
// GENERATORS — each takes InsightContext and returns a payload or throws
// ============================================================================

async function generateBrandWeakness(ctx: InsightContext): Promise<unknown> {
  const brainContext = ctx.clientBrain
    ? `
שם העסק: ${ctx.clientName}
תחום: ${ctx.businessField}
סוג: ${ctx.businessType}
סיכום עסקי: ${ctx.clientBrain.businessSummary || ''}
טון קול: ${ctx.clientBrain.toneOfVoice || ''}
קהל יעד: ${ctx.clientBrain.audienceProfile || ''}
נקודות מכירה: ${(ctx.clientBrain.keySellingPoints || []).join(', ')}
`
    : `שם העסק: ${ctx.clientName}\nתחום: ${ctx.businessField}\nסוג: ${ctx.businessType}`;

  const systemPrompt = `אתה מנתח מותגים ושיווק דיגיטלי בכיר. נתח את החולשות העסקיות והשיווקיות של הלקוח.\n\nהחזר מערך JSON בפורמט:\n[{"title":"...","area":"...","description":"...","severity":"high|medium|low","fixSuggestions":["..."],"messagingImprovement":"..."}]\n\nהחזר JSON בלבד, ללא טקסט נוסף.`;
  const userPrompt = `נתח חולשות עסקיות ושיווקיות עבור:\n${brainContext}\n${ctx.researchSummary ? `\nהקשר מחקר:\n${ctx.researchSummary}` : ''}`;

  const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.7 });
  if (!result.success) throw new Error(result.error || 'AI generation failed');
  const data = result.data;
  return Array.isArray(data) ? data : (data as { weaknesses?: unknown })?.weaknesses || [];
}

async function generateCustomerProfile(ctx: InsightContext): Promise<unknown> {
  const systemPrompt = `אתה מומחה לפילוח שוק ופרופיל קהל יעד. צור 3-4 סגמנטים של קהל יעד.\n\nהחזר מערך JSON בפורמט:\n[{"name":"...","ageRange":"...","interests":["..."],"behaviors":["..."],"painPoints":["..."],"color":"#hex"}]\n\nהחזר JSON בלבד.`;
  const userPrompt = `צור פרופיל קהל יעד עבור:\nשם: ${ctx.clientName}\nתחום: ${ctx.businessField}\nסוג: ${ctx.businessType}\nמטרות שיווק: ${ctx.marketingGoals || 'לא צוין'}\nפלטפורמות: ${ctx.platforms.join(', ') || 'לא צוין'}\n${ctx.researchSummary ? `\nהקשר מחקר:\n${ctx.researchSummary}` : ''}`;

  const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.7 });
  if (!result.success) throw new Error(result.error || 'AI generation failed');
  const data = result.data;
  return Array.isArray(data) ? data : (data as { segments?: unknown })?.segments || [];
}

async function generateTrendEngine(ctx: InsightContext): Promise<unknown> {
  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const monthName = monthNames[ctx.currentMonth - 1] || '';

  const systemPrompt = `אתה מומחה טרנדים בשיווק דיגיטלי ורשתות חברתיות. זהה 3-5 טרנדים רלוונטיים.\n\nהחזר מערך JSON בפורמט:\n[{"title":"...","trendName":"...","relevanceScore":0.85,"urgency":"high|medium|low","contentIdeas":["..."]}]\n\nהחזר JSON בלבד.`;
  const userPrompt = `זהה טרנדים רלוונטיים עבור ${monthName} ${ctx.currentYear}:\nעסק: ${ctx.clientName}\nתחום: ${ctx.businessField}\nסוג: ${ctx.businessType}\nפלטפורמות: ${ctx.platforms.join(', ') || 'לא צוין'}\n${ctx.researchSummary ? `\nהקשר מחקר:\n${ctx.researchSummary}` : ''}`;

  const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.8 });
  if (!result.success) throw new Error(result.error || 'AI generation failed');
  const data = result.data;
  return Array.isArray(data) ? data : (data as { trendSuggestions?: unknown })?.trendSuggestions || [];
}

async function generateCompetitorInsights(ctx: InsightContext): Promise<unknown> {
  const competitorList = ctx.competitors.length > 0
    ? ctx.competitors.map(c => c.name).join(', ')
    : 'מתחרים כלליים בתחום';

  const systemPrompt = `אתה מנתח תחרותי בתחום השיווק הדיגיטלי. נתח את הנוף התחרותי.\n\nהחזר JSON בפורמט:\n{"doMoreOf":["..."],"avoid":["..."],"opportunities":["..."]}\n\nהחזר JSON בלבד.`;
  const userPrompt = `נתח נוף תחרותי עבור:\nעסק: ${ctx.clientName}\nתחום: ${ctx.businessField}\nסוג: ${ctx.businessType}\nמתחרים: ${competitorList}\nפלטפורמות: ${ctx.platforms.join(', ') || 'לא צוין'}\n${ctx.researchSummary ? `\nהקשר מחקר:\n${ctx.researchSummary}` : ''}`;

  const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.7 });
  if (!result.success) throw new Error(result.error || 'AI generation failed');
  return result.data;
}

async function generateCreativeDNA(ctx: InsightContext): Promise<unknown> {
  const knowledgeContext = await getClientKnowledgeContext(ctx.clientId);

  const systemPrompt = `אתה מומחה לאסטרטגיית תוכן ומיתוג. צור "DNA יצירתי" ייחודי לעסק.\n\nהחזר JSON בפורמט:\n{"contentPillars":["..."],"toneAttributes":["..."],"visualStyle":"...","audiencePersonas":[{"name":"...","description":"..."}],"doMoreOf":["..."],"avoid":["..."],"uniqueAngles":["..."]}\n\nהחזר JSON בלבד.`;
  const userPrompt = `צור DNA יצירתי עבור:\nשם: ${ctx.clientName}\nתחום: ${ctx.businessField}\nסוג: ${ctx.businessType}\nמסרים שיווקיים: ${ctx.keyMarketingMessages || 'לא צוין'}\nפלטפורמות: ${ctx.platforms.join(', ') || 'לא צוין'}\n${knowledgeContext ? `\nהקשר ידע:\n${knowledgeContext}` : ''}\n${ctx.researchSummary ? `\nהקשר מחקר:\n${ctx.researchSummary}` : ''}`;

  const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.8 });
  if (!result.success) throw new Error(result.error || 'AI generation failed');
  return result.data;
}

// ============================================================================
// PERSISTENCE HELPER
// ============================================================================

async function persistInsight(clientId: string, section: InsightSection, payload: unknown): Promise<void> {
  const now = new Date().toISOString();
  try {
    let existing: ClientInsight | null = null;
    try {
      const all = await clientInsights.getAllAsync();
      existing = all.find(i => i.clientId === clientId && i.section === section) || null;
    } catch { /* table may not exist */ }

    if (existing) {
      await clientInsights.updateAsync(existing.id, {
        payload,
        status: 'ready' as const,
        error: undefined,
        generatedAt: now,
        updatedAt: now,
      });
    } else {
      await clientInsights.createAsync({
        clientId,
        section,
        payload,
        status: 'ready' as const,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      } as Omit<ClientInsight, 'id'> as ClientInsight);
    }
    console.log(`[orchestrate] Persisted ${section} for ${clientId}`);
  } catch (err) {
    console.error(`[orchestrate] Failed to persist ${section}:`, err instanceof Error ? err.message : err);
  }
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, sections, force } = body as {
      clientId: string;
      sections?: InsightSection[];
      force?: boolean;
    };

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    const requestedSections = (sections && sections.length > 0) ? sections : ALL_SECTIONS;
    console.log(`[orchestrate] Starting for clientId=${clientId}, sections=${requestedSections.join(',')}, force=${!!force}`);

    // Step 1: Build context
    const ctxResult = await buildClientInsightContext(clientId);
    if (!ctxResult.valid) {
      console.error(`[orchestrate] Context build failed: ${ctxResult.error}`);
      return NextResponse.json({
        error: ctxResult.error,
        missingFields: ctxResult.missingFields,
      }, { status: 400 });
    }

    const ctx = ctxResult.data;

    // Step 2: Check which sections need generation
    let existingInsights: Record<string, ClientInsight> = {};
    if (!force) {
      try {
        const all = await clientInsights.getAllAsync();
        for (const item of all.filter(i => i.clientId === clientId)) {
          existingInsights[item.section] = item;
        }
      } catch { /* table may not exist */ }
    }

    // Step 3: Generate each section in sequence
    const results: Record<string, SectionResult> = {};

    // Map section -> generator
    const generators: Record<InsightSection, (ctx: InsightContext) => Promise<unknown>> = {
      client_brain: async () => {
        // client_brain is handled by /api/ai/client-brain, skip in orchestration
        return null;
      },
      brand_weakness: generateBrandWeakness,
      customer_profile: generateCustomerProfile,
      trend_engine: generateTrendEngine,
      competitor_insights: generateCompetitorInsights,
      creative_dna: generateCreativeDNA,
    };

    for (const section of requestedSections) {
      // Skip client_brain — it has its own dedicated route with different logic
      if (section === 'client_brain') {
        results[section] = { status: 'skipped', error: 'Handled by /api/ai/client-brain' };
        continue;
      }

      // Skip if already persisted and not forced
      if (!force && existingInsights[section]?.status === 'ready' && existingInsights[section]?.payload) {
        console.log(`[orchestrate] Skipping ${section} — already persisted`);
        results[section] = { status: 'ready' };
        continue;
      }

      // Check prerequisites
      if (section === 'competitor_insights' && ctx.competitors.length === 0 && !ctx.researchExists) {
        console.log(`[orchestrate] Skipping ${section} — no competitors and no research`);
        results[section] = { status: 'skipped', error: 'No competitor data available' };
        continue;
      }

      try {
        console.log(`[orchestrate] Generating ${section}...`);
        const generator = generators[section];
        const payload = await generator(ctx);
        await persistInsight(clientId, section, payload);

        // Creative DNA also needs to be persisted to its dedicated table (app_creative_dna)
        // so that /api/ai/creative-dna GET can find it
        if (section === 'creative_dna' && payload) {
          try {
            const now = new Date().toISOString();
            const allDna = await creativeDNA.getAllAsync();
            const existing = allDna.find((d: CreativeDNA) => d.clientId === clientId);
            if (existing) {
              await creativeDNA.updateAsync(existing.id, { ...payload as object, clientId, updatedAt: now });
            } else {
              await creativeDNA.createAsync({ ...payload as object, clientId, createdAt: now, updatedAt: now } as Omit<CreativeDNA, 'id'> as CreativeDNA);
            }
            console.log(`[orchestrate] Also persisted creative_dna to app_creative_dna`);
          } catch (dnaErr) {
            console.warn(`[orchestrate] Failed to dual-write creative_dna:`, dnaErr instanceof Error ? dnaErr.message : dnaErr);
          }
        }

        results[section] = { status: 'ready' };
        console.log(`[orchestrate] ✅ ${section} complete`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[orchestrate] ❌ ${section} failed: ${errorMsg}`);
        results[section] = { status: 'error', error: errorMsg };
        // Persist error state
        try {
          await persistInsight(clientId, section, null);
        } catch { /* ignore */ }
      }
    }

    console.log(`[orchestrate] Complete. Results: ${JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.status])))}`);
    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (error) {
    console.error('[orchestrate] Fatal error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
