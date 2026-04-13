'use client';

/**
 * React hook for consuming operational alerts and AI insights.
 * Pulls from all data hooks and computes alerts in real-time.
 */

import { useMemo } from 'react';
import {
  useClients,
  useLeads,
  useEmployees,
  useEmployeeTasks,
  usePayments,
  useClientGanttItems,
  useApprovals,
  useProjectPayments,
} from '@/lib/api/use-entity';
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
  const { data: clients, loading: l1 } = useClients();
  const { data: leads, loading: l2 } = useLeads();
  const { data: employees, loading: l3 } = useEmployees();
  const { data: employeeTasks, loading: l4 } = useEmployeeTasks();
  const { data: payments, loading: l5 } = usePayments();
  const { data: ganttItems, loading: l6 } = useClientGanttItems();
  const { data: approvals, loading: l7 } = useApprovals();
  const { data: projectPayments, loading: l8 } = useProjectPayments();

  const loading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8;

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
