/**
 * Client Similarity Engine
 *
 * Finds similar clients based on industry, performance patterns, and knowledge overlap.
 * Used to surface "what worked for similar clients" recommendations.
 *
 * No AI API calls. All scoring is deterministic.
 */

import type { KnowledgeItem } from '@/lib/db/schema';

// ── Types ──

export interface ClientSimilarityResult {
  clientId: string;
  clientName: string;
  industry: string;
  similarClients: SimilarClient[];
}

export interface SimilarClient {
  clientId: string;
  clientName: string;
  industry: string;
  similarityScore: number; // 0-100
  sharedKnowledge: SharedKnowledgeItem[];
  matchReasons: string[];
}

export interface SharedKnowledgeItem {
  itemId: string;
  title: string;
  type: string;
  confidenceScore: number;
}

// ── Main similarity finder ──

export function findSimilarClients(
  targetClientId: string,
  allItems: KnowledgeItem[],
): ClientSimilarityResult {
  // Get target client's items
  const targetItems = allItems.filter(i => i.clientId === targetClientId);
  if (targetItems.length === 0) {
    const targetName = '';
    return { clientId: targetClientId, clientName: targetName, industry: '', similarClients: [] };
  }

  const targetIndustry = targetItems[0]?.industry || '';
  const targetName = targetItems[0]?.clientName || '';
  const targetTags = new Set(targetItems.flatMap(i => i.tags));
  const targetTypes = new Set(targetItems.map(i => i.type));

  // Find all other clients
  const otherClientIds = new Set(
    allItems
      .filter(i => i.clientId && i.clientId !== targetClientId)
      .map(i => i.clientId!)
  );

  const similarClients: SimilarClient[] = [];

  for (const otherId of otherClientIds) {
    const otherItems = allItems.filter(i => i.clientId === otherId);
    if (otherItems.length === 0) continue;

    const otherIndustry = otherItems[0]?.industry || '';
    const otherName = otherItems[0]?.clientName || '';
    const otherTags = new Set(otherItems.flatMap(i => i.tags));
    const otherTypes = new Set(otherItems.map(i => i.type));

    // Score similarity
    let score = 0;
    const reasons: string[] = [];

    // Same industry = big bonus
    if (targetIndustry && otherIndustry && targetIndustry === otherIndustry) {
      score += 40;
      reasons.push(`אותו תחום: ${targetIndustry}`);
    }

    // Tag overlap
    const sharedTags = [...targetTags].filter(t => otherTags.has(t));
    const tagOverlap = targetTags.size > 0 ? sharedTags.length / targetTags.size : 0;
    const tagScore = Math.round(tagOverlap * 25);
    if (tagScore > 5) {
      score += tagScore;
      reasons.push(`${sharedTags.length} תגיות משותפות`);
    }

    // Knowledge type overlap
    const sharedTypes = [...targetTypes].filter(t => otherTypes.has(t));
    const typeOverlap = targetTypes.size > 0 ? sharedTypes.length / targetTypes.size : 0;
    const typeScore = Math.round(typeOverlap * 20);
    if (typeScore > 5) {
      score += typeScore;
      reasons.push(`${sharedTypes.length} סוגי ידע משותפים`);
    }

    // Platform overlap
    const targetPlatforms = new Set(targetItems.map(i => i.platform).filter(Boolean));
    const otherPlatforms = new Set(otherItems.map(i => i.platform).filter(Boolean));
    const sharedPlatforms = [...targetPlatforms].filter(p => otherPlatforms.has(p));
    if (sharedPlatforms.length > 0) {
      score += Math.min(15, sharedPlatforms.length * 5);
      reasons.push(`פלטפורמות משותפות: ${sharedPlatforms.join(', ')}`);
    }

    if (score < 20) continue; // Not similar enough

    // Find shared knowledge (cross-client items that apply to both)
    const crossItems = allItems.filter(
      i => i.clientId === null && i.industry === targetIndustry && i.type === 'pattern'
    );

    const sharedKnowledge: SharedKnowledgeItem[] = crossItems
      .slice(0, 5)
      .map(item => ({
        itemId: item.id,
        title: item.title,
        type: item.type,
        confidenceScore: item.confidenceScore,
      }));

    // Also include high-confidence items from the other client
    const otherHighConfidence = otherItems
      .filter(i => i.confidenceScore >= 60)
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 5)
      .map(item => ({
        itemId: item.id,
        title: item.title,
        type: item.type,
        confidenceScore: item.confidenceScore,
      }));

    sharedKnowledge.push(...otherHighConfidence);

    similarClients.push({
      clientId: otherId,
      clientName: otherName,
      industry: otherIndustry,
      similarityScore: Math.min(100, score),
      sharedKnowledge: sharedKnowledge.slice(0, 8),
      matchReasons: reasons,
    });
  }

  // Sort by similarity score
  similarClients.sort((a, b) => b.similarityScore - a.similarityScore);

  return {
    clientId: targetClientId,
    clientName: targetName,
    industry: targetIndustry,
    similarClients: similarClients.slice(0, 10),
  };
}

// ── Get knowledge suggestions for a client based on similar clients ──

export function getKnowledgeSuggestions(
  targetClientId: string,
  allItems: KnowledgeItem[],
): KnowledgeSuggestion[] {
  const similarity = findSimilarClients(targetClientId, allItems);
  const suggestions: KnowledgeSuggestion[] = [];

  const targetItemTitles = new Set(
    allItems.filter(i => i.clientId === targetClientId).map(i => i.title.substring(0, 40))
  );

  for (const similar of similarity.similarClients) {
    for (const shared of similar.sharedKnowledge) {
      // Skip if target client already has similar knowledge
      if (targetItemTitles.has(shared.title.substring(0, 40))) continue;

      suggestions.push({
        fromClientId: similar.clientId,
        fromClientName: similar.clientName,
        similarityScore: similar.similarityScore,
        knowledgeItemId: shared.itemId,
        title: shared.title,
        type: shared.type,
        confidenceScore: shared.confidenceScore,
        reason: `עבד ב-${similar.clientName} (דמיון ${similar.similarityScore}%)`,
      });
    }
  }

  // Sort by confidence * similarity
  suggestions.sort((a, b) =>
    (b.confidenceScore * b.similarityScore) - (a.confidenceScore * a.similarityScore)
  );

  return suggestions.slice(0, 15);
}

export interface KnowledgeSuggestion {
  fromClientId: string;
  fromClientName: string;
  similarityScore: number;
  knowledgeItemId: string;
  title: string;
  type: string;
  confidenceScore: number;
  reason: string;
}
