/**
 * Campaign Activity Log — records every action state change for traceability.
 * All entries persisted via campaignActivityLog collection.
 */

import { campaignActivityLog } from '@/lib/db';
import type { CampaignActivityType, CampaignActivityLog } from '@/lib/db/schema';

let _logCounter = 0;
function genLogId(): string {
  _logCounter++;
  return `clog_${Date.now()}_${_logCounter}`;
}

export async function logCampaignActivity(
  campaignId: string,
  clientId: string,
  activityType: CampaignActivityType,
  title: string,
  description: string,
  performedBy: string,
  actionId?: string | null,
  approvalId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<CampaignActivityLog | null> {
  try {
    const entry: CampaignActivityLog = {
      id: genLogId(),
      campaignId,
      clientId,
      actionId: actionId || null,
      approvalId: approvalId || null,
      activityType,
      title,
      description,
      performedBy,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    };
    return await campaignActivityLog.createAsync(entry);
  } catch (err) {
    console.error('[activity-log] Failed to log:', err);
    return null;
  }
}

/**
 * Get activity log entries for a campaign, sorted newest first.
 */
export async function getCampaignActivityEntries(
  campaignId: string,
  limit: number = 20,
): Promise<CampaignActivityLog[]> {
  try {
    const all = await campaignActivityLog.getAllAsync();
    return all
      .filter(e => e.campaignId === campaignId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  } catch {
    return [];
  }
}

export const ACTIVITY_TYPE_META: Record<CampaignActivityType, {
  icon: string;
  label: string;
  color: string;
}> = {
  recommendation_created: { icon: '💡', label: 'המלצה חדשה', color: '#8b5cf6' },
  action_generated: { icon: '⚡', label: 'פעולה נוצרה', color: '#3b82f6' },
  approval_requested: { icon: '📤', label: 'נשלח לאישור', color: '#f59e0b' },
  action_approved: { icon: '✅', label: 'פעולה אושרה', color: '#22c55e' },
  action_rejected: { icon: '❌', label: 'פעולה נדחתה', color: '#ef4444' },
  action_executed: { icon: '🚀', label: 'פעולה בוצעה', color: '#0ea5e9' },
  action_failed: { icon: '💥', label: 'פעולה נכשלה', color: '#dc2626' },
  draft_ad_created: { icon: '📝', label: 'טיוטת מודעה', color: '#6366f1' },
  ad_paused: { icon: '⏸', label: 'מודעה הושהתה', color: '#f59e0b' },
  ad_resumed: { icon: '▶️', label: 'מודעה חודשה', color: '#22c55e' },
  budget_changed: { icon: '💰', label: 'שינוי תקציב', color: '#10b981' },
  adset_created: { icon: '📦', label: 'סדרת מודעות', color: '#6366f1' },
  marked_for_review: { icon: '🔍', label: 'סומן לבדיקה', color: '#a855f7' },
};
