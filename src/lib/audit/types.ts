/**
 * PixelManageAI — Audit Log Types
 */

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  source: 'system' | 'user' | 'ai' | 'automation';
  userId: string | null;
  createdAt: string;
}

export type AuditAction =
  | 'event_emitted'
  | 'automation_executed'
  | 'automation_approved'
  | 'automation_rejected'
  | 'ai_decision_made'
  | 'lead_scored'
  | 'lead_assigned'
  | 'message_sent'
  | 'task_auto_created'
  | 'campaign_optimized'
  | 'rule_created'
  | 'rule_toggled';
