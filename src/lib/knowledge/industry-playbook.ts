/**
 * Industry Playbook Engine
 *
 * Builds structured playbooks from knowledge items grouped by industry.
 * Each playbook aggregates winning hooks, CTAs, content angles, platforms,
 * audience notes, visual patterns, and failure patterns.
 *
 * No AI API calls. All aggregation is deterministic.
 */

import type { KnowledgeItem, IndustryPlaybook, PlaybookEntry } from '@/lib/db/schema';

// ── Build a playbook from knowledge items ──

export function buildPlaybookForIndustry(
  industry: string,
  items: KnowledgeItem[],
): Omit<IndustryPlaybook, 'id'> {
  const industryItems = items.filter(i => i.industry === industry);

  // Unique clients and campaigns
  const clientIds = new Set(industryItems.map(i => i.clientId).filter(Boolean));
  const campaignCount = industryItems.reduce((s, i) => {
    const c = (i.performanceMetrics as any)?.campaigns || (i.performanceMetrics as any)?.adCount || 0;
    return s + (typeof c === 'number' ? c : 0);
  }, 0);

  return {
    industry,
    topHooks: buildEntries(industryItems, 'hook', 10),
    bestCTAs: buildEntries(industryItems, 'cta', 10),
    winningContentAngles: buildEntries(industryItems, 'content_angle', 10),
    bestVisualPatterns: buildEntries(industryItems, 'visual', 10),
    bestPlatforms: buildEntries(industryItems, 'platform', 5),
    audienceNotes: buildEntries(industryItems, 'audience', 10),
    failurePatterns: buildEntries(industryItems, 'failure', 10),
    clientCount: clientIds.size,
    campaignCount,
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

// ── Build sorted entries for a single type ──

function buildEntries(
  items: KnowledgeItem[],
  type: string,
  limit: number,
): PlaybookEntry[] {
  return items
    .filter(i => i.type === type)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, limit)
    .map(item => ({
      text: item.summary || item.title,
      confidenceScore: item.confidenceScore,
      evidenceCount: countEvidence(item),
      sourceIds: item.sourceId ? [item.sourceId] : [],
    }));
}

function countEvidence(item: KnowledgeItem): number {
  const metrics = item.performanceMetrics || {};
  return (
    (typeof metrics.adCount === 'number' ? metrics.adCount : 0) +
    (typeof metrics.leads === 'number' ? metrics.leads : 0) +
    (typeof metrics.clientCount === 'number' ? metrics.clientCount : 0) ||
    1
  );
}

// ── Get playbook for a specific industry ──

export function getPlaybookSummary(playbook: IndustryPlaybook): PlaybookSummary {
  const totalEntries =
    playbook.topHooks.length +
    playbook.bestCTAs.length +
    playbook.winningContentAngles.length +
    playbook.bestVisualPatterns.length +
    playbook.bestPlatforms.length +
    playbook.audienceNotes.length +
    playbook.failurePatterns.length;

  const allEntries = [
    ...playbook.topHooks,
    ...playbook.bestCTAs,
    ...playbook.winningContentAngles,
    ...playbook.bestVisualPatterns,
    ...playbook.bestPlatforms,
    ...playbook.audienceNotes,
    ...playbook.failurePatterns,
  ];

  const avgConfidence = allEntries.length > 0
    ? allEntries.reduce((s, e) => s + e.confidenceScore, 0) / allEntries.length
    : 0;

  return {
    industry: playbook.industry,
    totalEntries,
    avgConfidence: Math.round(avgConfidence),
    clientCount: playbook.clientCount,
    campaignCount: playbook.campaignCount,
    sections: {
      hooks: playbook.topHooks.length,
      ctas: playbook.bestCTAs.length,
      contentAngles: playbook.winningContentAngles.length,
      visuals: playbook.bestVisualPatterns.length,
      platforms: playbook.bestPlatforms.length,
      audiences: playbook.audienceNotes.length,
      failures: playbook.failurePatterns.length,
    },
    lastUpdated: playbook.lastUpdated,
  };
}

export interface PlaybookSummary {
  industry: string;
  totalEntries: number;
  avgConfidence: number;
  clientCount: number;
  campaignCount: number;
  sections: {
    hooks: number;
    ctas: number;
    contentAngles: number;
    visuals: number;
    platforms: number;
    audiences: number;
    failures: number;
  };
  lastUpdated: string;
}

// ── Display metadata ──

export const PLAYBOOK_SECTION_META: Record<string, { label: string; icon: string; color: string }> = {
  topHooks: { label: 'הוקים מנצחים', icon: '🪝', color: '#F59E0B' },
  bestCTAs: { label: 'CTAs חזקים', icon: '🎯', color: '#10B981' },
  winningContentAngles: { label: 'זוויות תוכן', icon: '📐', color: '#6366F1' },
  bestVisualPatterns: { label: 'תבניות ויזואליות', icon: '🎨', color: '#EC4899' },
  bestPlatforms: { label: 'פלטפורמות', icon: '📊', color: '#3B82F6' },
  audienceNotes: { label: 'קהלים', icon: '👥', color: '#8B5CF6' },
  failurePatterns: { label: 'תבניות כישלון', icon: '⚠️', color: '#EF4444' },
};
