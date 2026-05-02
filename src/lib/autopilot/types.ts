/**
 * Autopilot Types
 *
 * Autonomous Growth System — controlled autonomy.
 * No live actions without approval.
 */

// ── Autonomy Modes ──

export type AutonomyMode =
  | 'recommend_only'      // suggestions only, no actions
  | 'approval_required'   // prepare actions → send to approval (DEFAULT)
  | 'safe_internal'       // create drafts/tasks/content only (no external)
  | 'full_auto';          // LOCKED — visible but disabled

export const AUTONOMY_MODE_META: Record<AutonomyMode, {
  label: string;
  description: string;
  icon: string;
  color: string;
  locked: boolean;
}> = {
  recommend_only: {
    label: 'המלצה בלבד',
    description: 'המערכת תציע המלצות בלבד — ללא פעולות',
    icon: '💡',
    color: '#2563eb',
    locked: false,
  },
  approval_required: {
    label: 'אישור נדרש',
    description: 'המערכת מכינה פעולות ושולחת לאישור',
    icon: '🔒',
    color: '#16a34a',
    locked: false,
  },
  safe_internal: {
    label: 'פעולות פנימיות בלבד',
    description: 'טיוטות, משימות ותוכן בלבד — ללא ביצוע חיצוני',
    icon: '🛡️',
    color: '#ca8a04',
    locked: false,
  },
  full_auto: {
    label: 'אוטומטי מלא',
    description: 'מצב אוטומטי מלא ייפתח רק לאחר אישור והרשאות',
    icon: '⚡',
    color: '#9ca3af',
    locked: true,
  },
};

// ── Client Goals ──

export type ClientGoal =
  | 'increase_leads'
  | 'reduce_cpl'
  | 'improve_quality'
  | 'increase_content'
  | 'improve_stability';

export const CLIENT_GOAL_META: Record<ClientGoal, { label: string; icon: string }> = {
  increase_leads: { label: 'הגדלת לידים', icon: '📈' },
  reduce_cpl: { label: 'הורדת עלות ליד', icon: '💰' },
  improve_quality: { label: 'שיפור איכות', icon: '⭐' },
  increase_content: { label: 'הגדלת תוכן', icon: '📝' },
  improve_stability: { label: 'שיפור יציבות', icon: '🎯' },
};

// ── Action Types ──

export type AutopilotActionType =
  | 'create_campaign_draft'
  | 'create_adset_draft'
  | 'create_ad_variation'
  | 'duplicate_winning_ad'
  | 'create_content_idea'
  | 'create_gantt_item'
  | 'create_video_ad_from_asset'
  | 'create_podcast_campaign'
  | 'suggest_budget_change'
  | 'suggest_platform_shift'
  | 'flag_tracking_issue'
  | 'generate_client_report'
  | 'create_internal_task';

export const ACTION_TYPE_META: Record<AutopilotActionType, {
  label: string;
  icon: string;
  isInternal: boolean;
  defaultApprover: 'admin' | 'client' | 'both' | 'internal_auto';
}> = {
  create_campaign_draft: { label: 'טיוטת קמפיין', icon: '📋', isInternal: true, defaultApprover: 'admin' },
  create_adset_draft: { label: 'טיוטת אד-סט', icon: '📂', isInternal: true, defaultApprover: 'admin' },
  create_ad_variation: { label: 'וריאציית מודעה', icon: '🎨', isInternal: true, defaultApprover: 'admin' },
  duplicate_winning_ad: { label: 'שכפול מודעה מנצחת', icon: '🏆', isInternal: false, defaultApprover: 'admin' },
  create_content_idea: { label: 'רעיון תוכן', icon: '💡', isInternal: true, defaultApprover: 'internal_auto' },
  create_gantt_item: { label: 'משימה ללוח', icon: '📅', isInternal: true, defaultApprover: 'internal_auto' },
  create_video_ad_from_asset: { label: 'מודעת וידאו', icon: '🎬', isInternal: true, defaultApprover: 'admin' },
  create_podcast_campaign: { label: 'קמפיין פודקאסט', icon: '🎙️', isInternal: true, defaultApprover: 'admin' },
  suggest_budget_change: { label: 'שינוי תקציב', icon: '💸', isInternal: false, defaultApprover: 'admin' },
  suggest_platform_shift: { label: 'מעבר פלטפורמה', icon: '🔄', isInternal: false, defaultApprover: 'both' },
  flag_tracking_issue: { label: 'בעיית מעקב', icon: '🚨', isInternal: true, defaultApprover: 'internal_auto' },
  generate_client_report: { label: 'דוח ללקוח', icon: '📊', isInternal: true, defaultApprover: 'internal_auto' },
  create_internal_task: { label: 'משימה פנימית', icon: '✏️', isInternal: true, defaultApprover: 'internal_auto' },
};

// ── Action Status ──

export type AutopilotActionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'blocked'
  | 'executed'
  | 'failed';

export const ACTION_STATUS_META: Record<AutopilotActionStatus, {
  label: string;
  icon: string;
  color: string;
}> = {
  draft: { label: 'טיוטה', icon: '📝', color: '#6b7280' },
  pending_approval: { label: 'ממתין לאישור', icon: '⏳', color: '#ca8a04' },
  approved: { label: 'אושר', icon: '✅', color: '#16a34a' },
  blocked: { label: 'חסום', icon: '🚫', color: '#dc2626' },
  executed: { label: 'בוצע', icon: '🎯', color: '#2563eb' },
  failed: { label: 'נכשל', icon: '❌', color: '#dc2626' },
};

// ── Activity Types ──

export type ActivityType =
  | 'scan_started'
  | 'scan_completed'
  | 'opportunity_detected'
  | 'decision_made'
  | 'action_created'
  | 'approval_requested'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'execution_failed'
  | 'learning_updated'
  | 'autopilot_paused'
  | 'autopilot_resumed'
  | 'mode_changed';

// ── Data Structures ──

export interface AutopilotSettings {
  id: string;
  clientId: string;
  clientName: string;
  mode: AutonomyMode;
  goals: ClientGoal[];
  isActive: boolean;
  isPaused: boolean;
  maxActionsPerDay: number;
  lastScanAt: string | null;
  lastScanResult: string | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutopilotRun {
  id: string;
  clientId: string | null; // null = all clients
  status: 'running' | 'completed' | 'failed';
  triggeredBy: 'manual' | 'scheduled' | 'system';
  clientsScanned: number;
  opportunitiesFound: number;
  actionsCreated: number;
  approvalsSent: number;
  errors: string[];
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface AutopilotAction {
  id: string;
  runId: string;
  clientId: string;
  clientName: string;
  actionType: AutopilotActionType;
  title: string;
  reason: string;
  expectedImpact: string;
  confidence: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  approver: 'admin' | 'client' | 'both' | 'internal_auto';
  status: AutopilotActionStatus;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  payload: Record<string, unknown>;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  executedAt: string | null;
  failedReason: string | null;
  beforeMetrics: Record<string, number>;
  afterMetrics: Record<string, number>;
  outcome: 'improved' | 'no_change' | 'declined' | 'too_early' | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutopilotActivityLog {
  id: string;
  runId: string | null;
  clientId: string | null;
  actionId: string | null;
  activityType: ActivityType;
  title: string;
  details: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Dashboard Types ──

export interface AutopilotDashboardData {
  kpis: {
    clientsMonitored: number;
    actionsToday: number;
    approvalsPending: number;
    executedThisWeek: number;
    successRate: number;
  };
  highRiskClients: Array<{
    clientId: string;
    clientName: string;
    reason: string;
    severity: string;
  }>;
  recentActions: AutopilotAction[];
  pendingApprovals: AutopilotAction[];
  recentActivity: AutopilotActivityLog[];
  clientSummaries: Array<{
    clientId: string;
    clientName: string;
    mode: AutonomyMode;
    isActive: boolean;
    isPaused: boolean;
    lastScanAt: string | null;
    pendingActions: number;
    totalActions: number;
  }>;
}

export interface ClientAutopilotData {
  settings: AutopilotSettings | null;
  recentActions: AutopilotAction[];
  pendingApprovals: AutopilotAction[];
  recentActivity: AutopilotActivityLog[];
  opportunities: number;
  executedCount: number;
  successRate: number;
}
