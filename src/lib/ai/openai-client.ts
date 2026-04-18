/**
 * OpenAI integration for PixelFrameAI
 * Uses the OpenAI Chat Completions API
 */

import { aiSettings, clientKnowledge } from '@/lib/db/collections';
import { getSupabase } from '@/lib/db/store';
import type { ClientResearch } from '@/lib/db/schema';
import { ensureSeeded } from '@/lib/db/seed';

export interface AIGenerationResult {
  success: boolean;
  data?: unknown;
  error?: string;
  errorType?: 'missing_api_key' | 'network_error' | 'invalid_payload' | 'provider_failure' | 'parse_error';
}

async function getSettings() {
  await ensureSeeded();
  const all = aiSettings.getAll();
  return all.length > 0 ? all[0] : null;
}

export async function getClientKnowledgeContext(clientId: string): Promise<string> {
  await ensureSeeded();
  let knowledge: Awaited<ReturnType<typeof clientKnowledge.getAllAsync>>[number] | undefined;
  try {
    const allKnowledge = await clientKnowledge.getAllAsync();
    knowledge = allKnowledge.find(k => k.clientId === clientId);
  } catch {
    // Table may not exist yet
    return '';
  }
  if (!knowledge) return '';

  const parts: string[] = [];
  if (knowledge.businessContext) parts.push(`הקשר עסקי: ${knowledge.businessContext}`);
  if (knowledge.toneAndStyle) parts.push(`טון וסגנון: ${knowledge.toneAndStyle}`);
  if (knowledge.audienceProfile) parts.push(`קהל יעד: ${knowledge.audienceProfile}`);
  if (knowledge.websiteSummary) parts.push(`אתר אינטרנט: ${knowledge.websiteSummary}`);
  if (knowledge.facebookInsights) parts.push(`תובנות פייסבוק: ${knowledge.facebookInsights}`);
  if (knowledge.instagramInsights) parts.push(`תובנות אינסטגרם: ${knowledge.instagramInsights}`);
  if (knowledge.previousContentThemes && knowledge.previousContentThemes.length > 0) parts.push(`נושאים קודמים: ${knowledge.previousContentThemes.join(', ')}`);
  if (knowledge.approvedCaptionStyles && knowledge.approvedCaptionStyles.length > 0) parts.push(`סגנונות כיתוב מאושרים: ${knowledge.approvedCaptionStyles.join(', ')}`);
  if (knowledge.topPerformingFormats && knowledge.topPerformingFormats.length > 0) parts.push(`פורמטים מובילים: ${knowledge.topPerformingFormats.join(', ')}`);
  if (knowledge.pastCampaigns && knowledge.pastCampaigns.length > 0) parts.push(`קמפיינים קודמים: ${knowledge.pastCampaigns.join(', ')}`);
  if (knowledge.seasonalPatterns) parts.push(`דפוסים עונתיים: ${knowledge.seasonalPatterns}`);

  // Automatically append research context if available
  const researchCtx = await getClientResearchContext(clientId);
  if (researchCtx) {
    parts.push(researchCtx);
  }

  return parts.join('\n');
}

export async function getClientResearchContext(clientId: string): Promise<string> {
  // Load from Supabase (single source of truth)
  let latest: ClientResearch | null = null;
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('client_research')
      .select('client_brain')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data && (data as Record<string, unknown>).client_brain) {
      latest = JSON.parse((data as Record<string, unknown>).client_brain as string) as ClientResearch;
    }
  } catch (err) {
    console.error('[openai-client] Failed to load research from Supabase:', err);
  }
  if (!latest || latest.status !== 'complete') return '';

  const parts: string[] = [];
  parts.push('--- חקר לקוח AI ---');

  // Identity
  if (latest.identity) {
    parts.push(`מה הלקוח מוכר באמת: ${latest.identity.whatTheySell}`);
    parts.push(`מיצוב: ${latest.identity.positioning}`);
    parts.push(`טון: ${latest.identity.tone}`);
    parts.push(`ערך ייחודי: ${latest.identity.uniqueValue}`);
    parts.push(`קהל יעד: ${latest.identity.targetAudience}`);
  }

  // Audience deep dive
  if (latest.audience) {
    if (latest.audience.primary) parts.push(`קהל עיקרי: ${latest.audience.primary}`);
    if (latest.audience.secondary) parts.push(`קהל משני: ${latest.audience.secondary}`);
    if (latest.audience.painPoints && latest.audience.painPoints.length > 0) {
      parts.push(`נקודות כאב: ${latest.audience.painPoints.join(', ')}`);
    }
  }

  // Weaknesses — so AI avoids repeating them
  if (latest.weaknesses && latest.weaknesses.length > 0) {
    parts.push(`חולשות שזוהו (${latest.weaknesses.length}): ${latest.weaknesses.map(w => w.area + ' — ' + w.description).join('; ')}`);
  }

  // Competitor insights — what works
  if (latest.competitorSummary) {
    if (latest.competitorSummary.doMoreOf?.length > 0) {
      parts.push(`מה עובד למתחרים: ${latest.competitorSummary.doMoreOf.join(', ')}`);
    }
    if (latest.competitorSummary.contentTypesPerforming?.length > 0) {
      parts.push(`סוגי תוכן מצליחים בשוק: ${latest.competitorSummary.contentTypesPerforming.join(', ')}`);
    }
  }

  // Opportunities
  if (latest.opportunities && latest.opportunities.length > 0) {
    parts.push(`הזדמנויות שזוהו: ${latest.opportunities.map(o => o.title).join(', ')}`);
  }

  // Recommended content angles
  if (latest.recommendedContentAngles && latest.recommendedContentAngles.length > 0) {
    parts.push(`זוויות תוכן מומלצות: ${latest.recommendedContentAngles.join(', ')}`);
  }

  // Recommended campaign concepts
  if (latest.recommendedCampaignConcepts && latest.recommendedCampaignConcepts.length > 0) {
    parts.push(`קונספטים לקמפיינים: ${latest.recommendedCampaignConcepts.map(c => c.name + ' (' + c.goal + ')').join('; ')}`);
  }

  // Action plan highlights
  if (latest.actionPlan) {
    if (latest.actionPlan.thingsToStop?.length > 0) {
      parts.push(`דברים להפסיק: ${latest.actionPlan.thingsToStop.map(t => t.action).join(', ')}`);
    }
  }

  return parts.join('\n');
}

export async function generateWithAI(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<AIGenerationResult> {
  // Prefer env var (server-side, works on Vercel). Fall back to DB-stored settings for local dev.
  console.log("OPENAI KEY EXISTS:", !!process.env.OPENAI_API_KEY);
  const envKey = process.env.OPENAI_API_KEY || '';
  const settings = await getSettings();
  const apiKey = envKey || settings?.apiKey || '';
  const model = settings?.defaultModel || 'gpt-4.1';

  if (!apiKey) {
    return {
      success: false,
      error: 'Missing OpenAI API key. Set OPENAI_API_KEY in environment variables.',
      errorType: 'missing_api_key',
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4000,
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
      return {
        success: false,
        error: `OpenAI API error (${response.status}): ${errorMessage}`,
        errorType: 'provider_failure',
      };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'Empty response from OpenAI',
        errorType: 'provider_failure',
      };
    }

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(content);
      return { success: true, data: parsed };
    } catch {
      // Return as raw text if not JSON
      return { success: true, data: content };
    }
  } catch (error) {
    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown'}`,
      errorType: 'network_error',
    };
  }
}
