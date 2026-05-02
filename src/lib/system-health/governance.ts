/**
 * Governance Rules
 *
 * Enforces:
 * - No execution without approval
 * - No duplicate actions
 * - No action on low-confidence data
 * - No action if platform disconnected
 * - No budget change without admin approval
 */

import type { GovernanceRule, ValidationResult } from './types';

// ── Governance Rules ──

export const GOVERNANCE_RULES: GovernanceRule[] = [
  {
    id: 'gov_no_exec_without_approval',
    name: 'אין ביצוע ללא אישור',
    description: 'כל פעולה חיצונית דורשת אישור מנהל או לקוח לפני ביצוע',
    isActive: true,
    category: 'execution',
  },
  {
    id: 'gov_no_duplicate_actions',
    name: 'אין פעולות כפולות',
    description: 'המערכת לא תיצור פעולה זהה עבור אותו לקוח ב-24 שעות',
    isActive: true,
    category: 'safety',
  },
  {
    id: 'gov_no_low_confidence',
    name: 'סף ביטחון מינימלי',
    description: 'פעולות עם ביטחון מתחת ל-30% לא ייווצרו',
    isActive: true,
    category: 'data',
  },
  {
    id: 'gov_platform_connected',
    name: 'חיבור פלטפורמה נדרש',
    description: 'פעולה חיצונית לא תבוצע ללא חיבור פעיל לפלטפורמה',
    isActive: true,
    category: 'execution',
  },
  {
    id: 'gov_budget_admin_only',
    name: 'שינוי תקציב — מנהל בלבד',
    description: 'שינויי תקציב דורשים אישור מנהל מערכת',
    isActive: true,
    category: 'approval',
  },
  {
    id: 'gov_max_actions_per_day',
    name: 'מגבלת פעולות יומית',
    description: 'מקסימום 8 פעולות ללקוח ביום',
    isActive: true,
    category: 'safety',
  },
  {
    id: 'gov_autopilot_failure_pause',
    name: 'השהיית אוטופיילוט בכישלון',
    description: 'אוטופיילוט יושהה אוטומטית לאחר 5 כישלונות רצופים',
    isActive: true,
    category: 'safety',
  },
];

// ── Validate Action ──

export interface ActionValidationInput {
  actionType: string;
  clientId: string;
  confidence: number;
  riskLevel: string;
  requiresPlatform: boolean;
  isPlatformConnected: boolean;
  hasApproval: boolean;
  isBudgetChange: boolean;
  isAdmin: boolean;
}

export function validateAction(input: ActionValidationInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rule: No execution without approval
  if (!input.hasApproval && input.requiresPlatform) {
    errors.push('לא ניתן לבצע פעולה חיצונית ללא אישור');
  }

  // Rule: No low confidence
  if (input.confidence < 30) {
    errors.push('ביטחון נמוך מדי — נדרש מינימום 30%');
  } else if (input.confidence < 50) {
    warnings.push('ביטחון בינוני — כדאי לבדוק לפני ביצוע');
  }

  // Rule: Platform must be connected
  if (input.requiresPlatform && !input.isPlatformConnected) {
    errors.push('נדרש חיבור לפלטפורמה — חסרה הרשאה או חיבור');
  }

  // Rule: Budget changes need admin
  if (input.isBudgetChange && !input.isAdmin) {
    errors.push('שינוי תקציב דורש אישור מנהל');
  }

  // Risk warnings
  if (input.riskLevel === 'high') {
    warnings.push('פעולה בסיכון גבוה — מומלץ לבדוק היטב');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Validate Data ──

export interface DataValidationInput {
  entityType: string;
  entityId: string;
  requiredFields: string[];
  data: Record<string, unknown>;
}

export function validateData(input: DataValidationInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  for (const field of input.requiredFields) {
    const val = input.data[field];
    if (val === undefined || val === null || val === '') {
      errors.push(`שדה חובה חסר: ${field}`);
    }
  }

  // Check ID format
  if (!input.entityId || input.entityId.trim() === '') {
    errors.push('מזהה ישות חסר');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
