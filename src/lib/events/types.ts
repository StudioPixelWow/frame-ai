/**
 * PixelManageAI — Event System Types
 */

export type SystemEventType =
  | 'lead_created'
  | 'lead_status_changed'
  | 'lead_not_responded'
  | 'lead_assigned'
  | 'campaign_performance_drop'
  | 'creative_fatigue_detected'
  | 'competitor_shift_detected'
  | 'deal_closed'
  | 'deal_lost'
  | 'task_created'
  | 'task_completed'
  | 'payment_overdue'
  | 'client_created'
  | 'approval_pending';

export interface SystemEvent {
  id: string;
  type: SystemEventType;
  payload: Record<string, unknown>;
  entityType: 'lead' | 'campaign' | 'client' | 'task' | 'payment' | 'approval' | 'system';
  entityId: string | null;
  source: 'system' | 'user' | 'ai' | 'automation';
  processed: boolean;
  createdAt: string;
}

export interface EventHandler {
  type: SystemEventType;
  handler: (event: SystemEvent) => Promise<void>;
}
