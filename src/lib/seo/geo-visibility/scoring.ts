/**
 * AI Visibility scoring — 0-100 from measured run data.
 * Weights per spec: Mention 25, SoV 20, Citation 20, Position 10,
 * Recommendation 10, Topic coverage 10, Sentiment 5.
 */

export interface VisInputs {
  totalResponses: number;
  mentions: number;
  citations: number;
  weightedCitations?: number;      // sum of source_weight (primary/featured count more)
  competitorMentions: number;
  avgPosition: number | null;      // 1 = best
  recommendationLevels: string[];  // per mention
  topicsCovered: number;
  totalTopics: number;
  negativeSentiment: number;
}

const REC_WEIGHT: Record<string, number> = {
  top_recommendation: 1, strongly_recommended: 0.85, recommended: 0.7, neutrally_listed: 0.4, mentioned: 0.3, not_mentioned: 0,
};

export function calculateAIVisibilityScore(i: VisInputs): { value: number; explanation: string; factors: string[] } {
  const resp = Math.max(1, i.totalResponses);
  const mentionRate = i.mentions / resp;                                   // 25%
  const sov = (i.mentions + i.competitorMentions) > 0 ? i.mentions / (i.mentions + i.competitorMentions) : 0; // 20%
  // Citation component rewards STRONGER sources (primary/featured weigh more).
  const citEffective = i.weightedCitations != null ? i.weightedCitations : i.citations;
  const citationRate = Math.min(1, citEffective / resp);                   // 20%
  const positionScore = i.avgPosition ? Math.max(0, 1 - (i.avgPosition - 1) / 9) : 0; // 10% (1→1, 10→0)
  const recScore = i.recommendationLevels.length ? i.recommendationLevels.reduce((a, l) => a + (REC_WEIGHT[l] ?? 0), 0) / i.recommendationLevels.length : 0; // 10%
  const topicScore = i.totalTopics ? i.topicsCovered / i.totalTopics : 0;  // 10%
  const sentimentScore = 1 - (i.negativeSentiment / resp);                 // 5%

  const value = Math.round(
    mentionRate * 25 + sov * 20 + citationRate * 20 + positionScore * 10 +
    recScore * 10 + topicScore * 10 + Math.max(0, sentimentScore) * 5,
  );
  return {
    value: Math.max(0, Math.min(100, value)),
    explanation: `ציון נראות AI משוקלל מ-${i.totalResponses} תשובות שנמדדו.`,
    factors: [
      `Mention rate ${(mentionRate * 100).toFixed(0)}%`,
      `Share of AI Voice ${(sov * 100).toFixed(0)}%`,
      `Citation rate ${(citationRate * 100).toFixed(0)}%`,
      `Avg position ${i.avgPosition ? i.avgPosition.toFixed(1) : '—'}`,
      `Topic coverage ${(topicScore * 100).toFixed(0)}%`,
    ],
  };
}

/** Estimated monthly AI reach — clearly an ESTIMATE, not real user traffic. */
export function estimateAIReach(params: {
  queries: { estimated_search_volume?: number; priority?: number; business_importance_score?: number }[];
  mentionRate: number; citationRate: number; enginesCount: number;
}): number {
  const AI_USAGE_FACTOR = 0.18;      // share of searches that happen via AI assistants (assumption)
  const engineWeight = Math.min(1, 0.4 + params.enginesCount * 0.15);
  let base = 0;
  for (const q of params.queries) {
    const vol = q.estimated_search_volume || 50;
    const importance = (q.business_importance_score || 5) / 10;
    base += vol * importance;
  }
  const mentionProb = params.mentionRate * 0.8 + params.citationRate * 0.2;
  return Math.round(base * AI_USAGE_FACTOR * mentionProb * engineWeight);
}
