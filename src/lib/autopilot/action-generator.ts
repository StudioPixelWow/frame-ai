/**
 * Action Generator
 *
 * Converts diagnostic results into concrete autopilot actions.
 * Actions are aligned with client goals.
 * All actions include: reason, expected impact, confidence, risk level, related entity.
 */

import type { AutopilotAction, AutopilotActionType, AutopilotSettings, ClientGoal } from './types';
import { ACTION_TYPE_META } from './types';

// ── Diagnostic Result ──

export interface DiagnosticResult {
  type: string;
  title: string;
  reason: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  relatedEntities: Array<{ type: string; id: string; name: string }>;
  alignedGoals: ClientGoal[];
}

// ── Action Templates ──

interface ActionTemplate {
  diagnosticType: string;
  actionType: AutopilotActionType;
  titleTemplate: (diag: DiagnosticResult) => string;
  reasonTemplate: (diag: DiagnosticResult) => string;
  impactTemplate: (diag: DiagnosticResult) => string;
  riskLevel: 'low' | 'medium' | 'high';
  confidenceBoost: number; // added to diagnostic confidence
  requiresEntity: boolean;
}

const ACTION_TEMPLATES: ActionTemplate[] = [
  {
    diagnosticType: 'weak_creative',
    actionType: 'create_ad_variation',
    titleTemplate: () => 'יצירת וריאציות חדשות למודעות חלשות',
    reasonTemplate: (d) => d.reason,
    impactTemplate: () => 'שיפור CTR צפוי של 20-40%',
    riskLevel: 'low',
    confidenceBoost: 5,
    requiresEntity: true,
  },
  {
    diagnosticType: 'scalable_winner',
    actionType: 'duplicate_winning_ad',
    titleTemplate: (d) => `שכפול ${d.relatedEntities.length} מודעות מנצחות`,
    reasonTemplate: (d) => d.reason,
    impactTemplate: () => 'הגדלת חשיפה ולידים ב-15-30%',
    riskLevel: 'low',
    confidenceBoost: 10,
    requiresEntity: true,
  },
  {
    diagnosticType: 'lead_decline',
    actionType: 'create_campaign_draft',
    titleTemplate: () => 'טיוטת קמפיין חדש לעצירת ירידה',
    reasonTemplate: (d) => d.reason,
    impactTemplate: () => 'חידוש תנועת לידים תוך 3-5 ימים',
    riskLevel: 'medium',
    confidenceBoost: 0,
    requiresEntity: false,
  },
  {
    diagnosticType: 'lead_decline',
    actionType: 'create_content_idea',
    titleTemplate: () => 'רעיונות תוכן חדשים להגברת עניין',
    reasonTemplate: () => 'מגוון תוכן חדש יכול לחדש את העניין של הקהל',
    impactTemplate: () => 'שיפור מעורבות ב-10-20%',
    riskLevel: 'low',
    confidenceBoost: 5,
    requiresEntity: false,
  },
  {
    diagnosticType: 'high_cpl',
    actionType: 'suggest_budget_change',
    titleTemplate: () => 'ייעול הקצאת תקציב',
    reasonTemplate: (d) => d.reason,
    impactTemplate: () => 'הפחתת עלות ליד ב-15-25%',
    riskLevel: 'medium',
    confidenceBoost: 0,
    requiresEntity: false,
  },
  {
    diagnosticType: 'high_cpl',
    actionType: 'create_ad_variation',
    titleTemplate: () => 'יצירת מודעות חדשות לשיפור המרה',
    reasonTemplate: () => 'מודעות חדשות עם גישה שונה יכולות להוריד עלות',
    impactTemplate: () => 'הפחתת CPL ב-10-20%',
    riskLevel: 'low',
    confidenceBoost: -5,
    requiresEntity: false,
  },
  {
    diagnosticType: 'low_content',
    actionType: 'create_content_idea',
    titleTemplate: () => 'יצירת רעיונות תוכן חדשים',
    reasonTemplate: (d) => d.reason,
    impactTemplate: () => 'הרחבת מגוון תוכן פרסומי',
    riskLevel: 'low',
    confidenceBoost: 10,
    requiresEntity: false,
  },
  {
    diagnosticType: 'low_content',
    actionType: 'create_gantt_item',
    titleTemplate: () => 'משימת יצירת תוכן חדש',
    reasonTemplate: () => 'הוספת משימה ליצירת חומרים פרסומיים',
    impactTemplate: () => 'הכנת תוכן מגוון תוך שבוע',
    riskLevel: 'low',
    confidenceBoost: 15,
    requiresEntity: false,
  },
  {
    diagnosticType: 'no_campaigns',
    actionType: 'create_campaign_draft',
    titleTemplate: () => 'טיוטת קמפיין ראשון',
    reasonTemplate: (d) => d.reason,
    impactTemplate: () => 'תחילת פעילות פרסומית',
    riskLevel: 'medium',
    confidenceBoost: 0,
    requiresEntity: false,
  },
  {
    diagnosticType: 'spend_no_leads',
    actionType: 'flag_tracking_issue',
    titleTemplate: () => 'בדיקת מעקב — תקציב ללא לידים',
    reasonTemplate: (d) => d.reason,
    impactTemplate: () => 'זיהוי ותיקון בעיית מעקב',
    riskLevel: 'high',
    confidenceBoost: 10,
    requiresEntity: false,
  },
  {
    diagnosticType: 'spend_no_leads',
    actionType: 'create_internal_task',
    titleTemplate: () => 'בדיקת פיקסל ומעקב המרות',
    reasonTemplate: () => 'תקציב מושקע ללא לידים — יש לבדוק הגדרות מעקב',
    impactTemplate: () => 'תיקון מעקב = התחלת רישום לידים',
    riskLevel: 'low',
    confidenceBoost: 15,
    requiresEntity: false,
  },
  {
    diagnosticType: 'positive_trend',
    actionType: 'generate_client_report',
    titleTemplate: () => 'דוח ביצועים חיובי ללקוח',
    reasonTemplate: (d) => d.reason,
    impactTemplate: () => 'חיזוק אמון הלקוח',
    riskLevel: 'low',
    confidenceBoost: 15,
    requiresEntity: false,
  },
];

// ── Generate Actions ──

export function generateAutopilotActions(
  diagnostics: DiagnosticResult[],
  settings: AutopilotSettings
): AutopilotAction[] {
  const actions: AutopilotAction[] = [];

  for (const diag of diagnostics) {
    // Check goal alignment
    const goalAligned = diag.alignedGoals.length === 0 ||
      diag.alignedGoals.some(g => settings.goals.includes(g));

    if (!goalAligned && settings.goals.length > 0) continue;

    // Find matching templates
    const templates = ACTION_TEMPLATES.filter(t => t.diagnosticType === diag.type);

    for (const template of templates) {
      const meta = ACTION_TYPE_META[template.actionType];
      const confidence = Math.max(0, Math.min(100, diag.confidence + template.confidenceBoost));

      // Skip low-confidence actions
      if (confidence < 30) continue;

      const entity = template.requiresEntity && diag.relatedEntities.length > 0
        ? diag.relatedEntities[0]
        : null;

      const action: AutopilotAction = {
        id: `apa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        runId: '',
        clientId: settings.clientId,
        clientName: settings.clientName,
        actionType: template.actionType,
        title: template.titleTemplate(diag),
        reason: template.reasonTemplate(diag),
        expectedImpact: template.impactTemplate(diag),
        confidence,
        riskLevel: template.riskLevel,
        approver: meta?.defaultApprover || 'admin',
        status: 'draft',
        relatedEntityType: entity?.type || null,
        relatedEntityId: entity?.id || null,
        payload: {
          diagnosticType: diag.type,
          relatedEntities: diag.relatedEntities,
          severity: diag.severity,
        },
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        executedAt: null,
        failedReason: null,
        beforeMetrics: {},
        afterMetrics: {},
        outcome: null,
        createdAt: '',
        updatedAt: '',
      };

      actions.push(action);
    }
  }

  // Sort by confidence descending
  return actions.sort((a, b) => b.confidence - a.confidence);
}
