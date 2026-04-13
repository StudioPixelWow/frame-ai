/**
 * OpenAI integration for PixelFrameAI
 * Uses the OpenAI Chat Completions API
 */

import { aiSettings, clientKnowledge, clientResearch } from '@/lib/db/collections';
import { ensureSeeded } from '@/lib/db/seed';

export interface AIGenerationResult {
  success: boolean;
  data?: unknown;
  error?: string;
  errorType?: 'missing_api_key' | 'network_error' | 'invalid_payload' | 'provider_failure' | 'parse_error';
}

function getSettings() {
  ensureSeeded();
  const all = aiSettings.getAll();
  return all.length > 0 ? all[0] : null;
}

export function getClientKnowledgeContext(clientId: string): string {
  ensureSeeded();
  const knowledge = clientKnowledge.getAll().find(k => k.clientId === clientId);
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
  const researchCtx = getClientResearchContext(clientId);
  if (researchCtx) {
    parts.push(researchCtx);
  }

  return parts.join('\n');
}

export function getClientResearchContext(clientId: string): string {
  ensureSeeded();
  const research = clientResearch.query(r => r.clientId === clientId);
  const latest = research.length > 0 ? research[research.length - 1] : null;
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
  const settings = getSettings();

  if (!settings || !settings.apiKey) {
    return {
      success: false,
      error: 'Missing OpenAI API key. Go to Settings → AI to configure.',
      errorType: 'missing_api_key',
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.defaultModel || 'gpt-4.1',
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
