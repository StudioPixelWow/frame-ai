/**
 * PixelManageAI — Event System Types
 */

export type SystemEventType =
  | 'lead_created'
  | 'lead_status_changed'
  | 'lead_not_responded'
  | 'lead_assigned'
  | 'lead_unassigned'
  | 'lead_no_response_timeout'
  | 'campaign_performance_drop'
  | 'creative_fatigue_detected'
  | 'competitor_shift_detected'
  | 'campaign_issue_detected'
  | 'deal_closed'
  | 'deal_lost'
  | 'task_created'
  | 'task_completed'
  | 'payment_overdue'
  | 'client_created'
  | 'client_inactive'
  | 'approval_pending'
  | 'manual_trigger';

export interface SystemEvent {
  id: string;
  type: SystemEventType;
  payload: Record<string, unknown>;
  entityType: 'lead' | 'campaign' | 'client' | 'task' | 'payment' | 'approval' | 'automation' | 'system';
  entityId: string | null;
  source: 'system' | 'user' | 'ai' | 'automation';
  processed: boolean;
  createdAt: string;
}

export interface EventHandler {
  type: SystemEventType;
  handler: (event: SystemEvent) => Promise<void>;
}
