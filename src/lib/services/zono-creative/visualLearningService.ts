/**
 * Visual Learning Service — Client feedback learning loop
 *
 * Tracks client preferences via approve/reject/favorite actions on generated
 * visuals. Stores learning weights in the brand style profile and uses them
 * to improve future generation prompts.
 *
 * Server-side only.
 */
import type { VisualLearningWeights } from '@/lib/db/schema';
import { brandStyleProfiles } from '@/lib/db/collections';

/* ── Constants ─────────────────────────────────────────────────────── */

const MAX_APPROVED_STYLES = 20;
const MAX_REJECTED_STYLES = 20;
const MAX_FAVORITE_PATTERNS = 15;
const APPROVE_BOOST = 1;
const REJECT_PENALTY = -1;
const FAVORITE_BOOST = 3;

/* ── Default Weights ───────────────────────────────────────────────── */

function createDefaultWeights(): VisualLearningWeights {
  return {
    approvedStyles: [],
    rejectedStyles: [],
    favoritePatterns: [],
    approvalRate: 0,
    totalGenerated: 0,
    totalApproved: 0,
    totalRejected: 0,
    stylePreferences: {},
    lastUpdated: new Date().toISOString(),
  };
}

/* ── Helpers ────────────────────────────────────────────────────────── */

/** Extract style keywords from asset metadata */
function extractStyleKeywords(metadata: Record<string, any>): string[] {
  const keywords: string[] = [];

  if (metadata.promptUsed) {
    // Extract key descriptive terms from prompt
    const prompt = String(metadata.promptUsed);
    const styleTerms = prompt.match(/\b(luxury|modern|minimal|dramatic|warm|cool|premium|clean|bold|soft|elegant|vibrant|muted|bright|dark|natural|studio)\b/gi);
    if (styleTerms) keywords.push(...styleTerms.map((t: string) => t.toLowerCase()));
  }

  if (metadata.revisedPrompt) {
    const revised = String(metadata.revisedPrompt);
    const styleTerms = revised.match(/\b(luxury|modern|minimal|dramatic|warm|cool|premium|clean|bold|soft|elegant|vibrant|muted|bright|dark|natural|studio)\b/gi);
    if (styleTerms) keywords.push(...styleTerms.map((t: string) => t.toLowerCase()));
  }

  if (metadata.assetType) {
    keywords.push(String(metadata.assetType));
  }

  if (metadata.lightingStyle) {
    keywords.push(String(metadata.lightingStyle));
  }

  if (metadata.compositionStyle) {
    keywords.push(String(metadata.compositionStyle));
  }

  return [...new Set(keywords)];
}

/** Add items to an array with max capacity, removing oldest first */
function addWithCap(arr: string[], items: string[], maxLen: number): string[] {
  const combined = [...new Set([...arr, ...items])];
  if (combined.length > maxLen) {
    return combined.slice(combined.length - maxLen);
  }
  return combined;
}

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Get learning weights for a client from their brand style profile metadata.
 * Returns null if no weights have been saved yet.
 */
export async function getClientLearningWeights(
  clientId: string,
): Promise<VisualLearningWeights | null> {
  try {
    const profiles = await brandStyleProfiles.queryAsync(
      (p) => p.clientId === clientId && p.profileStatus === 'active',
    );

    if (profiles.length === 0) return null;

    const profile = profiles[0];
    const metadata = (profile as any).visualLearningWeights;
    if (!metadata) return null;

    return metadata as VisualLearningWeights;
  } catch (err) {
    console.error('[visualLearningService] Error loading learning weights:', err);
    return null;
  }
}

/**
 * Update learning weights based on a client action on a visual asset.
 *
 * @param clientId - Client ID
 * @param action - The feedback action: approve, reject, favorite, or variation
 * @param assetMetadata - Metadata from the visual asset (includes prompt, style, etc.)
 */
export async function updateLearningWeights(
  clientId: string,
  action: 'approve' | 'reject' | 'favorite' | 'variation',
  assetMetadata: Record<string, any>,
): Promise<void> {
  try {
    // Load existing weights
    const existing = await getClientLearningWeights(clientId);
    const weights = existing ?? createDefaultWeights();

    // Extract style keywords from the asset
    const styleKeywords = extractStyleKeywords(assetMetadata);

    // Update counters
    weights.totalGenerated = (weights.totalGenerated || 0) + (action === 'variation' ? 0 : 0);

    switch (action) {
      case 'approve':
        weights.totalApproved++;
        weights.approvedStyles = addWithCap(
          weights.approvedStyles,
          styleKeywords,
          MAX_APPROVED_STYLES,
        );
        // Boost style preferences
        for (const keyword of styleKeywords) {
          weights.stylePreferences[keyword] =
            (weights.stylePreferences[keyword] ?? 0) + APPROVE_BOOST;
        }
        break;

      case 'reject':
        weights.totalRejected++;
        weights.rejectedStyles = addWithCap(
          weights.rejectedStyles,
          styleKeywords,
          MAX_REJECTED_STYLES,
        );
        // Penalize style preferences
        for (const keyword of styleKeywords) {
          weights.stylePreferences[keyword] =
            (weights.stylePreferences[keyword] ?? 0) + REJECT_PENALTY;
        }
        break;

      case 'favorite':
        weights.totalApproved++;
        weights.favoritePatterns = addWithCap(
          weights.favoritePatterns,
          styleKeywords,
          MAX_FAVORITE_PATTERNS,
        );
        weights.approvedStyles = addWithCap(
          weights.approvedStyles,
          styleKeywords,
          MAX_APPROVED_STYLES,
        );
        // Strong boost for favorites
        for (const keyword of styleKeywords) {
          weights.stylePreferences[keyword] =
            (weights.stylePreferences[keyword] ?? 0) + FAVORITE_BOOST;
        }
        break;

      case 'variation':
        // Variation requests don't change approval counts,
        // but signal interest in the style direction
        for (const keyword of styleKeywords) {
          weights.stylePreferences[keyword] =
            (weights.stylePreferences[keyword] ?? 0) + 0.5;
        }
        break;
    }

    // Recalculate approval rate
    const totalReviewed = weights.totalApproved + weights.totalRejected;
    weights.approvalRate = totalReviewed > 0
      ? Math.round((weights.totalApproved / totalReviewed) * 100)
      : 0;

    weights.lastUpdated = new Date().toISOString();

    // Save back to brand style profile
    const profiles = await brandStyleProfiles.queryAsync(
      (p) => p.clientId === clientId && p.profileStatus === 'active',
    );

    if (profiles.length > 0) {
      await brandStyleProfiles.updateAsync(profiles[0].id, {
        visualLearningWeights: weights,
      } as any);
    }
  } catch (err) {
    console.error('[visualLearningService] Error updating learning weights:', err);
  }
}

/**
 * Apply accumulated learning weights to modify a base prompt.
 * Injects emphasis and avoidance directives based on feedback history.
 *
 * @param basePrompt - The original generation prompt
 * @param weights - The client's learning weights
 * @returns Modified prompt with learning adjustments
 */
export function applyLearningToPrompt(
  basePrompt: string,
  weights: VisualLearningWeights,
): string {
  const additions: string[] = [];
  const avoidances: string[] = [];

  // Find strongly preferred styles (score > 2)
  const strongPreferences = Object.entries(weights.stylePreferences)
    .filter(([, score]) => score > 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([keyword]) => keyword);

  if (strongPreferences.length > 0) {
    additions.push(`strongly emphasize: ${strongPreferences.join(', ')}`);
  }

  // Favorite patterns get highest priority
  if (weights.favoritePatterns.length > 0) {
    const favorites = weights.favoritePatterns.slice(0, 3).join(', ');
    additions.push(`client favorites: ${favorites}`);
  }

  // Strongly rejected styles (score < -2)
  const strongRejections = Object.entries(weights.stylePreferences)
    .filter(([, score]) => score < -2)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 5)
    .map(([keyword]) => keyword);

  if (strongRejections.length > 0) {
    avoidances.push(`avoid: ${strongRejections.join(', ')}`);
  }

  // Build modified prompt
  let modifiedPrompt = basePrompt;

  if (additions.length > 0) {
    modifiedPrompt += `. ${additions.join('. ')}`;
  }

  if (avoidances.length > 0) {
    modifiedPrompt += `. ${avoidances.join('. ')}`;
  }

  return modifiedPrompt;
}
