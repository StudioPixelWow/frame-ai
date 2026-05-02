/**
 * System Health + QA + Governance — Types
 */

// ── System Status ──

export type SystemStatus = 'healthy' | 'warning' | 'critical';

export const SYSTEM_STATUS_META: Record<SystemStatus, { label: string; icon: string; color: string; bg: string }> = {
  healthy: { label: 'המערכת פועלת בצורה תקינה', icon: '✅', color: '#16a34a', bg: 'rgba(34,197,94,0.06)' },
  warning: { label: 'נמצאו אזהרות שדורשות תשומת לב', icon: '⚠️', color: '#ca8a04', bg: 'rgba(202,138,4,0.06)' },
  critical: { label: 'נמצאו בעיות שדורשות טיפול מיידי', icon: '🔴', color: '#dc2626', bg: 'rgba(220,38,38,0.06)' },
};

// ── Error Types ──

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorSource = 'api' | 'campaign' | 'sync' | 'autopilot' | 'action' | 'db' | 'validation' | 'system';

export const ERROR_SOURCE_META: Record<ErrorSource, { label: string; icon: string }> = {
  api: { label: 'API', icon: '🌐' },
  campaign: { label: 'קמפיינים', icon: '📢' },
  sync: { label: 'סנכרון', icon: '🔄' },
  autopilot: { label: 'אוטופיילוט', icon: '🤖' },
  action: { label: 'פעולות', icon: '⚡' },
  db: { label: 'מסד נתונים', icon: '💾' },
  validation: { label: 'ולידציה', icon: '🛡️' },
  system: { label: 'מערכת', icon: '⚙️' },
};

export const SEVERITY_META: Record<ErrorSeverity, { label: string; icon: string; color: string }> = {
  low: { label: 'נמוכה', icon: '🟢', color: '#16a34a' },
  medium: { label: 'בינונית', icon: '🟡', color: '#ca8a04' },
  high: { label: 'גבוהה', icon: '🟠', color: '#ea580c' },
  critical: { label: 'קריטית', icon: '🔴', color: '#dc2626' },
};

// ── Data Structures ──

export interface SystemError {
  id: string;
  type: string;
  source: ErrorSource;
  message: string;
  stack: string | null;
  severity: ErrorSeverity;
  clientId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export interface SystemAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: ErrorSeverity;
  source: ErrorSource;
  clientId: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
}

export interface GovernanceRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  category: 'execution' | 'approval' | 'safety' | 'data';
}

export interface HealthCheckResult {
  name: string;
  status: SystemStatus;
  message: string;
  details: Record<string, unknown>;
  checkedAt: string;
}

export interface SystemHealthDashboard {
  overallStatus: SystemStatus;
  statusMessage: string;
  checks: HealthCheckResult[];
  recentErrors: SystemError[];
  activeAlerts: SystemAlert[];
  governanceRules: GovernanceRule[];
  stats: {
    totalErrors24h: number;
    criticalErrors24h: number;
    failedActions24h: number;
    failedSyncs24h: number;
    autopilotIssues24h: number;
    resolvedErrors24h: number;
  };
}

// ── Validation ──

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Alert Types ──

export type AlertType =
  | 'repeated_failures'
  | 'system_error'
  | 'sync_broken'
  | 'high_risk_client'
  | 'autopilot_shutdown'
  | 'governance_violation'
  | 'slow_performance'
  | 'data_integrity';

export const ALERT_TYPE_META: Record<AlertType, { label: string; icon: string }> = {
  repeated_failures: { label: 'כישלונות חוזרים', icon: '🔁' },
  system_error: { label: 'שגיאת מערכת', icon: '⚠️' },
  sync_broken: { label: 'סנכרון שבור', icon: '🔗' },
  high_risk_client: { label: 'לקוח בסיכון', icon: '🚨' },
  autopilot_shutdown: { label: 'אוטופיילוט הופסק', icon: '⏸️' },
  governance_violation: { label: 'הפרת מדיניות', icon: '🛡️' },
  slow_performance: { label: 'ביצועים איטיים', icon: '🐌' },
  data_integrity: { label: 'בעיית נתונים', icon: '💾' },
};
