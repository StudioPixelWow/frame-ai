/**
 * Confidence & Decay System
 *
 * Manages knowledge item freshness:
 * - Decay: items lose relevance over time if not refreshed with new evidence
 * - Confidence: based on evidence strength (ad count, lead count, cross-client usage)
 * - Usage: items used more often get a small confidence boost
 *
 * No AI API calls. All calculations are deterministic.
 */

import type { KnowledgeItem } from '@/lib/db/schema';

// ── Config ──

export const DECAY_CONFIG = {
  /** Days before decay starts */
  gracePeriodDays: 14,
  /** Decay points per day after grace period */
  decayPerDay: 1.5,
  /** Maximum decay score */
  maxDecay: 95,
  /** Decay multiplier for failure-type items (they age faster) */
  failureDecayMultiplier: 1.5,
  /** Decay multiplier for cross-client patterns (they age slower) */
  crossClientDecayMultiplier: 0.6,
  /** Minimum confidence to stay "active" */
  minActiveConfidence: 15,
  /** Usage boost per use (max 5 points) */
  usageBoostPerUse: 1,
  /** Max usage boost */
  maxUsageBoost: 5,
};

// ── Apply decay to a single item ──

export function applyDecay(item: KnowledgeItem): number {
  const updatedAt = new Date(item.updatedAt).getTime();
  const now = Date.now();
  const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24);

  // Within grace period — no decay
  if (daysSinceUpdate <= DECAY_CONFIG.gracePeriodDays) {
    return 0;
  }

  const daysDecaying = daysSinceUpdate - DECAY_CONFIG.gracePeriodDays;
  let decayRate = DECAY_CONFIG.decayPerDay;

  // Adjust rate by type
  if (item.type === 'failure') {
    decayRate *= DECAY_CONFIG.failureDecayMultiplier;
  } else if (item.type === 'pattern') {
    decayRate *= DECAY_CONFIG.crossClientDecayMultiplier;
  }

  // Usage slows decay
  const usageReduction = Math.min(
    DECAY_CONFIG.maxUsageBoost,
    item.usageCount * DECAY_CONFIG.usageBoostPerUse
  );

  const rawDecay = daysDecaying * decayRate - usageReduction;
  return Math.min(DECAY_CONFIG.maxDecay, Math.max(0, Math.round(rawDecay)));
}

// ── Compute effective confidence (confidence minus decay) ──

export function effectiveConfidence(item: KnowledgeItem): number {
  const decay = item.decayScore || 0;
  return Math.max(0, item.confidenceScore - decay);
}

// ── Check if item is still "active" ──

export function isItemActive(item: KnowledgeItem): boolean {
  return effectiveConfidence(item) >= DECAY_CONFIG.minActiveConfidence;
}

// ── Get freshness label and color ──

export function getFreshnessInfo(item: KnowledgeItem): FreshnessInfo {
  const eff = effectiveConfidence(item);
  const decay = item.decayScore || 0;

  if (decay === 0) {
    return { label: 'טרי', color: '#10B981', icon: '🟢', level: 'fresh' };
  } else if (decay < 20) {
    return { label: 'עדכני', color: '#3B82F6', icon: '🔵', level: 'recent' };
  } else if (decay < 50) {
    return { label: 'מתיישן', color: '#F59E0B', icon: '🟡', level: 'aging' };
  } else if (eff >= DECAY_CONFIG.minActiveConfidence) {
    return { label: 'ישן', color: '#EF4444', icon: '🟠', level: 'old' };
  } else {
    return { label: 'פג תוקף', color: '#6B7280', icon: '⚫', level: 'expired' };
  }
}

export interface FreshnessInfo {
  label: string;
  color: string;
  icon: string;
  level: 'fresh' | 'recent' | 'aging' | 'old' | 'expired';
}

// ── Confidence label ──

export function getConfidenceInfo(score: number): ConfidenceInfo {
  if (score >= 80) return { label: 'גבוהה מאוד', color: '#10B981', level: 'very_high' };
  if (score >= 60) return { label: 'גבוהה', color: '#3B82F6', level: 'high' };
  if (score >= 40) return { label: 'בינונית', color: '#F59E0B', level: 'medium' };
  if (score >= 20) return { label: 'נמוכה', color: '#EF4444', level: 'low' };
  return { label: 'חלשה', color: '#6B7280', level: 'very_low' };
}

export interface ConfidenceInfo {
  label: string;
  color: string;
  level: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
}

// ── Display metadata for knowledge types ──

export const KNOWLEDGE_TYPE_META: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  hook: { label: 'הוק', icon: '🪝', color: '#F59E0B', bgColor: '#FEF3C7' },
  cta: { label: 'CTA', icon: '🎯', color: '#10B981', bgColor: '#D1FAE5' },
  visual: { label: 'ויזואלי', icon: '🎨', color: '#EC4899', bgColor: '#FCE7F3' },
  audience: { label: 'קהל', icon: '👥', color: '#8B5CF6', bgColor: '#EDE9FE' },
  content_angle: { label: 'זווית תוכן', icon: '📐', color: '#6366F1', bgColor: '#E0E7FF' },
  platform: { label: 'פלטפורמה', icon: '📊', color: '#3B82F6', bgColor: '#DBEAFE' },
  failure: { label: 'כישלון', icon: '⚠️', color: '#EF4444', bgColor: '#FEE2E2' },
  pattern: { label: 'תבנית', icon: '🔗', color: '#14B8A6', bgColor: '#CCFBF1' },
};
