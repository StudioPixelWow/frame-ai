/**
 * Campaign Action Engine
 *
 * Turns optimization recommendations into executable internal actions.
 * All actions go through approval flow — no direct Meta execution.
 *
 * Action types: 9 total
 * Status flow: pending → approval_required → approved → executed
 *              pending → rejected
 *              any → failed (on error)
 */

import type { Ad, AdSet, Campaign } from '@/lib/db/schema';
import type { Recommendation, RecommendationType } from './engine';

// ── Action Types ───────────────────────────────────────────────────────

export type CampaignActionType =
  | 'duplicate_ad'
  | 'create_variation'
  | 'pause_ad'
  | 'resume_ad'
  | 'increase_budget'
  | 'decrease_budget'
  | 'test_new_audience'
  | 'create_new_adset'
  | 'mark_for_review';

export type CampaignActionStatus =
  | 'pending'
  | 'approval_required'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed';

export type CampaignActionObjectType = 'campaign' | 'adset' | 'ad';

export interface CampaignActionPayload {
  // For duplicate_ad / create_variation
  originalAdId?: string;
  newPrimaryText?: string;
  newHeadline?: string;
  newDescription?: string;
  newCtaType?: string;
  newMediaSuggestion?: string;
  variationExplanation?: string; // "מה השתנה ולמה"
  variationStrategy?: string;

  // For pause_ad / resume_ad
  adIdToPause?: string;
  adIdToResume?: string;

  // For increase_budget / decrease_budget
  currentBudget?: number;
  newBudget?: number;
  budgetChangePercent?: number;

  // For test_new_audience / create_new_adset
  adSetId?: string;
  newAdSetName?: string;
  newInterests?: string[];
  newGeoLocations?: string[];
  newAgeRange?: { min: number; max: number };

  // For mark_for_review
  reviewReason?: string;
  reviewPriority?: 'low' | 'medium' | 'high';
}

export interface CampaignAction {
  id: string;
  type: CampaignActionType;
  title: string;
  objectType: CampaignActionObjectType;
  objectId: string;
  objectName: string;
  campaignId: string;
  campaignName: string;
  adSetId: string | null;
  adId: string | null;
  clientId: string;
  clientName: string;
  recommendationId: string | null;
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
  failedReason: string | null;
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
  resume_ad: {
    icon: '▶️',
    label: 'חידוש מודעה',
    color: '#22c55e',
    description: 'חידוש הרצת מודעה מושהית',
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
  create_new_adset: {
    icon: '📦',
    label: 'יצירת סדרת מודעות',
    color: '#6366f1',
    description: 'יצירת סדרת מודעות חדשה בקמפיין',
  },
  mark_for_review: {
    icon: '🔍',
    label: 'סימון לבדיקה',
    color: '#a855f7',
    description: 'סימון פריט לבדיקה ידנית',
  },
};

export const ACTION_STATUS_META: Record<CampaignActionStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  pending: { label: 'ממתין', color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' },
  approval_required: { label: 'ממתין לאישור', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  approved: { label: 'מאושר', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  rejected: { label: 'נדחה', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  executed: { label: 'בוצע', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  failed: { label: 'נכשל', color: '#dc2626', bgColor: 'rgba(220,38,38,0.1)' },
};

// ── Action Builders ────────────────────────────────────────────────────

let _actionCounter = 0;
function genActionId(): string {
  _actionCounter++;
  return `act_${Date.now()}_${_actionCounter}`;
}

function baseAction(
  type: CampaignActionType,
  title: string,
  objectType: CampaignActionObjectType,
  objectId: string,
  objectName: string,
  campaign: Campaign,
  clientId: string,
  clientName: string,
  adSetId: string | null,
  adId: string | null,
  sourceRec?: Recommendation | null,
): Omit<CampaignAction, 'payload' | 'description' | 'previewBefore' | 'previewAfter'> {
  const now = new Date().toISOString();
  return {
    id: genActionId(),
    type,
    title,
    objectType,
    objectId,
    objectName,
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    adSetId,
    adId,
    clientId,
    clientName,
    recommendationId: sourceRec?.id || null,
    status: 'pending',
    sourceRecommendationId: sourceRec?.id || null,
    sourceRecommendationType: sourceRec?.type || null,
    createdBy: 'system',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    executedAt: null,
    failedReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Build a "duplicate ad" action.
 */
export function buildDuplicateAdAction(
  ad: Ad,
  campaign: Campaign,
  clientId: string,
  clientName: string,
  sourceRec?: Recommendation | null,
): CampaignAction {
  return {
    ...baseAction('duplicate_ad', `שכפול: ${ad.headline || ad.name}`, 'ad', ad.id, ad.headline || ad.name, campaign, clientId, clientName, ad.adSetId || null, ad.id, sourceRec),
    payload: { originalAdId: ad.id },
    description: `שכפול מודעה "${ad.headline || ad.name}" בקמפיין "${campaign.campaignName}"`,
    previewBefore: `מודעה: ${ad.headline || ad.name}\nטקסט: ${ad.primaryText?.substring(0, 80) || '—'}`,
    previewAfter: `עותק חדש של המודעה יווצר בסטטוס טיוטה`,
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
    explanation?: string;
    strategy?: string;
  },
  sourceRec?: Recommendation | null,
): CampaignAction {
  return {
    ...baseAction('create_variation', `וריאציה: ${ad.headline || ad.name}`, 'ad', ad.id, ad.headline || ad.name, campaign, clientId, clientName, ad.adSetId || null, ad.id, sourceRec),
    payload: {
      originalAdId: ad.id,
      newPrimaryText: variation.newPrimaryText,
      newHeadline: variation.newHeadline,
      newDescription: variation.newDescription,
      newCtaType: variation.newCtaType,
      newMediaSuggestion: variation.newMediaSuggestion,
      variationExplanation: variation.explanation,
      variationStrategy: variation.strategy,
    },
    description: `יצירת וריאציה ל-"${ad.headline || ad.name}" בקמפיין "${campaign.campaignName}"`,
    previewBefore: `כותרת: ${ad.headline || '—'}\nטקסט: ${ad.primaryText?.substring(0, 80) || '—'}`,
    previewAfter: `כותרת: ${variation.newHeadline}\nטקסט: ${variation.newPrimaryText.substring(0, 80)}`,
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
  return {
    ...baseAction('pause_ad', `השהייה: ${ad.headline || ad.name}`, 'ad', ad.id, ad.headline || ad.name, campaign, clientId, clientName, ad.adSetId || null, ad.id, sourceRec),
    payload: { adIdToPause: ad.id },
    description: `השהיית מודעה "${ad.headline || ad.name}" בקמפיין "${campaign.campaignName}"`,
    previewBefore: `סטטוס: ${ad.status}`,
    previewAfter: `סטטוס: paused`,
  };
}

/**
 * Build a "resume ad" action.
 */
export function buildResumeAdAction(
  ad: Ad,
  campaign: Campaign,
  clientId: string,
  clientName: string,
  sourceRec?: Recommendation | null,
): CampaignAction {
  return {
    ...baseAction('resume_ad', `חידוש: ${ad.headline || ad.name}`, 'ad', ad.id, ad.headline || ad.name, campaign, clientId, clientName, ad.adSetId || null, ad.id, sourceRec),
    payload: { adIdToResume: ad.id },
    description: `חידוש מודעה "${ad.headline || ad.name}" בקמפיין "${campaign.campaignName}"`,
    previewBefore: `סטטוס: ${ad.status}`,
    previewAfter: `סטטוס: active`,
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
  const currentBudget = objectType === 'campaign'
    ? (target as Campaign).budget
    : ((target as AdSet).dailyBudget || (target as AdSet).lifetimeBudget || 0);
  const multiplier = direction === 'increase' ? (1 + percentChange / 100) : (1 - percentChange / 100);
  const newBudget = Math.round(currentBudget * multiplier);
  const targetName = objectType === 'campaign' ? (target as Campaign).campaignName : (target as AdSet).name;
  const adSetId = objectType === 'adset' ? target.id : null;

  return {
    ...baseAction(
      direction === 'increase' ? 'increase_budget' : 'decrease_budget',
      `${direction === 'increase' ? 'הגדלת' : 'הקטנת'} תקציב: ${targetName}`,
      objectType, target.id, targetName, campaign, clientId, clientName, adSetId, null, sourceRec,
    ),
    payload: { currentBudget, newBudget, budgetChangePercent: percentChange },
    description: `${direction === 'increase' ? 'הגדלת' : 'הקטנת'} תקציב ב-${percentChange}% — מ-₪${currentBudget} ל-₪${newBudget}`,
    previewBefore: `תקציב: ₪${currentBudget.toLocaleString()}`,
    previewAfter: `תקציב: ₪${newBudget.toLocaleString()} (${direction === 'increase' ? '+' : '-'}${percentChange}%)`,
  };
}

/**
 * Build a "create new adset" action.
 */
export function buildCreateNewAdSetAction(
  campaign: Campaign,
  clientId: string,
  clientName: string,
  adSetName: string,
  targeting: { interests?: string[]; geoLocations?: string[]; ageRange?: { min: number; max: number } },
  sourceRec?: Recommendation | null,
): CampaignAction {
  return {
    ...baseAction('create_new_adset', `סדרת מודעות חדשה: ${adSetName}`, 'campaign', campaign.id, campaign.campaignName, campaign, clientId, clientName, null, null, sourceRec),
    payload: {
      newAdSetName: adSetName,
      newInterests: targeting.interests,
      newGeoLocations: targeting.geoLocations,
      newAgeRange: targeting.ageRange,
    },
    description: `יצירת סדרת מודעות "${adSetName}" בקמפיין "${campaign.campaignName}"`,
    previewBefore: `קמפיין: ${campaign.campaignName}`,
    previewAfter: `סדרת מודעות חדשה: ${adSetName}`,
  };
}

/**
 * Build a "mark for review" action.
 */
export function buildMarkForReviewAction(
  objectType: CampaignActionObjectType,
  objectId: string,
  objectName: string,
  campaign: Campaign,
  clientId: string,
  clientName: string,
  reason: string,
  priority: 'low' | 'medium' | 'high',
  adSetId?: string | null,
  adId?: string | null,
  sourceRec?: Recommendation | null,
): CampaignAction {
  return {
    ...baseAction('mark_for_review', `בדיקה: ${objectName}`, objectType, objectId, objectName, campaign, clientId, clientName, adSetId || null, adId || null, sourceRec),
    payload: { reviewReason: reason, reviewPriority: priority },
    description: `סימון "${objectName}" לבדיקה — ${reason}`,
    previewBefore: `פריט: ${objectName}`,
    previewAfter: `סומן לבדיקה (${priority === 'high' ? 'דחוף' : priority === 'medium' ? 'בינוני' : 'נמוך'})`,
  };
}

/**
 * Map a recommendation action string to CampaignActionType.
 */
export function recActionToActionType(action: string): CampaignActionType | null {
  switch (action) {
    case 'create_variation': return 'create_variation';
    case 'mark_for_review': return 'mark_for_review';
    case 'send_to_approval': return null; // Meta action — wraps another action
    case 'ignore': return null;
    default: return null;
  }
}
