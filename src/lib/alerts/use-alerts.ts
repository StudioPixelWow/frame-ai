'use client';

/**
 * React hook for consuming operational alerts and AI insights.
 * Uses the consolidated dashboard-data endpoint (1 API call instead of 8).
 */

import { useMemo } from 'react';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { computeAlerts, countAlertsByCategory, countAlertsBySeverity } from './engine';
import type { OperationalAlert, AlertCategory, AlertSeverity } from './engine';
import { computeInsights } from '@/lib/ai/insights';
import type { ManagementInsight } from '@/lib/ai/insights';

export interface UseAlertsReturn {
  alerts: OperationalAlert[];
  insights: ManagementInsight[];
  totalAlerts: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  byCategory: Record<AlertCategory, number>;
  bySeverity: Record<AlertSeverity, number>;
  loading: boolean;
}

export function useOperationalAlerts(): UseAlertsReturn {
  const { data: dashData, loading } = useDashboardData();

  // Safe fallbacks — never let undefined reach .filter/.map/.reduce
  const clients = dashData.clients ?? [];
  const leads = dashData.leads ?? [];
  const employees = dashData.employees ?? [];
  const employeeTasks = dashData.employeeTasks ?? [];
  const payments = dashData.payments ?? [];
  const ganttItems = dashData.ganttItems ?? [];
  const approvals = dashData.approvals ?? [];
  const projectPayments = dashData.projectPayments ?? [];

  const alerts = useMemo(() => {
    if (loading) return [];
    return computeAlerts({
      clients,
      leads,
      employees,
      employeeTasks,
      payments,
      ganttItems,
      approvals,
      projectPayments,
    });
  }, [clients, leads, employees, employeeTasks, payments, ganttItems, approvals, projectPayments, loading]);

  const insights = useMemo(() => {
    if (loading) return [];
    return computeInsights({
      clients,
      leads,
      employees,
      employeeTasks,
      payments,
      ganttItems,
      projectPayments,
    });
  }, [clients, leads, employees, employeeTasks, payments, ganttItems, projectPayments, loading]);

  const byCategory = useMemo(() => countAlertsByCategory(alerts), [alerts]);
  const bySeverity = useMemo(() => countAlertsBySeverity(alerts), [alerts]);

  return {
    alerts,
    insights,
    totalAlerts: alerts.length,
    criticalCount: bySeverity.critical,
    warningCount: bySeverity.warning,
    infoCount: bySeverity.info,
    byCategory,
    bySeverity,
    loading,
  };
}
