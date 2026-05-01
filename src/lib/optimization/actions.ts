/**
 * Campaign Action Engine
 *
 * Turns optimization recommendations into executable internal actions.
 * All actions go through approval flow — no direct Meta execution.
 */

import type { Ad, AdSet, Campaign } from '@/lib/db/schema';
import type { Recommendation, RecommendationType } from './engine';

// ── Action Types ───────────────────────────────────────────────────────

export type CampaignActionType =
  | 'duplicate_ad'
  | 'create_variation'
  | 'pause_ad'
  | 'increase_budget'
  | 'decrease_budget'
  | 'test_new_audience';

export type CampaignActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed';

export type CampaignActionObjectType = 'campaign' | 'adset' | 'ad';

export interface CampaignActionPayload {
  // For duplicate_ad / create_variation
  originalAdId?: string;
  newPrimaryText?: string;
  newHeadline?: string;
  newDescription?: string;
  newCtaType?: string;
  newMediaSuggestion?: string;

  // For pause_ad
  adIdToPause?: string;

  // For increase_budget / decrease_budget
  currentBudget?: number;
  newBudget?: number;
  budgetChangePercent?: number;

  // For test_new_audience
  adSetId?: string;
  newInterests?: string[];
  newGeoLocations?: string[];
  newAgeRange?: { min: number; max: number };
}

export interface CampaignAction {
  id: string;
  type: CampaignActionType;
  objectType: CampaignActionObjectType;
  objectId: string;
  objectName: string;
  campaignId: string;
  campaignName: string;
  clientId: string;
  clientName: string;
  payload: CampaignActionPayload;
  status: CampaignActionStatus;
  sourceRecommendationId: string | null;
  sourceRecommendationType: RecommendationType | null;
  description: string;
  previewBefore: string;
  previewAfter: string;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── UI Metadata ────────────────────────────────────────────────────────

export const ACTION_TYPE_META: Record<CampaignActionType, {
  icon: string;
  label: string;
  color: string;
  description: string;
}> = {
  duplicate_ad: {
    icon: '📋',
    label: 'שכפול מודעה',
    color: '#3b82f6',
    description: 'יצירת עותק זהה של המודעה',
  },
  create_variation: {
    icon: '🎨',
    label: 'יצירת וריאציה',
    color: '#8b5cf6',
    description: 'יצירת גרסה חדשה עם טקסט/כותרת שונים',
  },
  pause_ad: {
    icon: '⏸',
    label: 'השהיית מודעה',
    color: '#f59e0b',
    description: 'הפסקת הרצת המודעה',
  },
  increase_budget: {
    icon: '📈',
    label: 'הגדלת תקציב',
    color: '#22c55e',
    description: 'הגדלת תקציב הקמפיין או סדרת המודעות',
  },
  decrease_budget: {
    icon: '📉',
    label: 'הקטנת תקציב',
    color: '#ef4444',
    description: 'הקטנת תקציב לחיסכון',
  },
  test_new_audience: {
    icon: '🎯',
    label: 'בדיקת קהל חדש',
    color: '#0ea5e9',
    description: 'יצירת סדרת מודעות עם קהל יעד שונה',
  },
};

export const ACTION_STATUS_META: Record<CampaignActionStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  pending: { label: 'ממתין לאישור', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  approved: { label: 'מאושר', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  rejected: { label: 'נדחה', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  executed: { label: 'בוצע', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
};

// ── Action Builders ────────────────────────────────────────────────────

let _actionCounter = 0;
function genActionId(): string {
  _actionCounter++;
  return `act_${Date.now()}_${_actionCounter}`;
}

/**
 * Build a "duplicate ad" action from a recommendation or manual trigger.
 */
export function buildDuplicateAdAction(
  ad: Ad,
  campaign: Campaign,
  clientId: string,
  clientName: string,
  sourceRec?: Recommendation | null,
): CampaignAction {
  const now = new Date().toISOString();
  return {
    id: genActionId(),
    type: 'duplicate_ad',
    objectType: 'ad',
    objectId: ad.id,
    objectName: ad.headline || ad.name,
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    clientId,
    clientName,
    payload: {
      originalAdId: ad.id,
    },
    status: 'pending',
    sourceRecommendationId: sourceRec?.id || null,
    sourceRecommendationType: sourceRec?.type || null,
    description: `שכפול מודעה "${ad.headline || ad.name}" בקמפיין "${campaign.campaignName}"`,
    previewBefore: `מודעה: ${ad.headline || ad.name}\nטקסט: ${ad.primaryText?.substring(0, 80) || '—'}`,
    previewAfter: `עותק חדש של המודעה יווצר בסטטוס טיוטה`,
    createdBy: 'system',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    executedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Build a "create variation" action with new text suggestions.
 */
export function buildCreateVariationAction(
  ad: Ad,
  campaign: Campaign,
  clientId: string,
  clientName: string,
  variation: {
    newPrimaryText: string;
    newHeadline: string;
    newDescription?: string;
    newCtaType?: string;
    newMediaSuggestion?: string;
  },
  sourceRec?: Recommendation | null,
): CampaignAction {
  const now = new Date().toISOString();
  return {
    id: genActionId(),
    type: 'create_variation',
    objectType: 'ad',
    objectId: ad.id,
    objectName: ad.headline || ad.name,
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    clientId,
    clientName,
    payload: {
      originalAdId: ad.id,
      newPrimaryText: variation.newPrimaryText,
      newHeadline: variation.newHeadline,
      newDescription: variation.newDescription,
      newCtaType: variation.newCtaType,
      newMediaSuggestion: variation.newMediaSuggestion,
    },
    status: 'pending',
    sourceRecommendationId: sourceRec?.id || null,
    sourceRecommendationType: sourceRec?.type || null,
    description: `יצירת וריאציה ל-"${ad.headline || ad.name}" בקמפיין "${campaign.campaignName}"`,
    previewBefore: `כותרת: ${ad.headline || '—'}\nטקסט: ${ad.primaryText?.substring(0, 80) || '—'}`,
    previewAfter: `כותרת: ${variation.newHeadline}\nטקסט: ${variation.newPrimaryText.substring(0, 80)}`,
    createdBy: 'system',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    executedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Build a "pause ad" action.
 */
export function buildPauseAdAction(
  ad: Ad,
  campaign: Campaign,
  clientId: string,
  clientName: string,
  sourceRec?: Recommendation | null,
): CampaignAction {
  const now = new Date().toISOString();
  return {
    id: genActionId(),
    type: 'pause_ad',
    objectType: 'ad',
    objectId: ad.id,
    objectName: ad.headline || ad.name,
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    clientId,
    clientName,
    payload: {
      adIdToPause: ad.id,
    },
    status: 'pending',
    sourceRecommendationId: sourceRec?.id || null,
    sourceRecommendationType: sourceRec?.type || null,
    description: `השהיית מודעה "${ad.headline || ad.name}" בקמפיין "${campaign.campaignName}"`,
    previewBefore: `סטטוס: ${ad.status}`,
    previewAfter: `סטטוס: paused`,
    createdBy: 'system',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    executedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Build a "change budget" action.
 */
export function buildBudgetChangeAction(
  target: Campaign | AdSet,
  objectType: 'campaign' | 'adset',
  campaign: Campaign,
  clientId: string,
  clientName: string,
  direction: 'increase' | 'decrease',
  percentChange: number,
  sourceRec?: Recommendation | null,
): CampaignAction {
  const now = new Date().toISOString();
  const currentBudget = objectType === 'campaign'
    ? (target as Campaign).budget
    : ((target as AdSet).dailyBudget || (target as AdSet).lifetimeBudget || 0);
  const multiplier = direction === 'increase' ? (1 + percentChange / 100) : (1 - percentChange / 100);
  const newBudget = Math.round(currentBudget * multiplier);

  return {
    id: genActionId(),
    type: direction === 'increase' ? 'increase_budget' : 'decrease_budget',
    objectType,
    objectId: target.id,
    objectName: objectType === 'campaign' ? (target as Campaign).campaignName : (target as AdSet).name,
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    clientId,
    clientName,
    payload: {
      currentBudget,
      newBudget,
      budgetChangePercent: percentChange,
    },
    status: 'pending',
    sourceRecommendationId: sourceRec?.id || null,
    sourceRecommendationType: sourceRec?.type || null,
    description: `${direction === 'increase' ? 'הגדלת' : 'הקטנת'} תקציב ב-${percentChange}% — מ-₪${currentBudget} ל-₪${newBudget}`,
    previewBefore: `תקציב: ₪${currentBudget.toLocaleString()}`,
    previewAfter: `תקציב: ₪${newBudget.toLocaleString()} (${direction === 'increase' ? '+' : '-'}${percentChange}%)`,
    createdBy: 'system',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    executedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Map a recommendation action string to CampaignActionType.
 */
export function recActionToActionType(action: string): CampaignActionType | null {
  switch (action) {
    case 'create_variation': return 'create_variation';
    case 'mark_for_review': return null; // Not an action type, just a UI state
    case 'send_to_approval': return null; // Meta action — wraps another action
    case 'ignore': return null;
    default: return null;
  }
}
