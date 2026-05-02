/**
 * Client-safe metadata constants for auto-monitor findings.
 * Separated from auto-monitor.ts to avoid pulling in server-only
 * dependencies (fs via store.ts) into client components.
 */

import type { AutoFindingType, AutoFindingSeverity } from '@/lib/db/schema';

export const FINDING_TYPE_META: Record<AutoFindingType, {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
}> = {
  creative_fatigue: { icon: '🎨', label: 'שחיקת קריאייטיב', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  budget_waste: { icon: '💸', label: 'בזבוז תקציב', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  scale_opportunity: { icon: '📈', label: 'הזדמנות להרחבה', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  weak_audience: { icon: '🎯', label: 'קהל חלש', color: '#f97316', bgColor: 'rgba(249,115,22,0.1)' },
  winning_ad: { icon: '🏆', label: 'מודעה מובילה', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  tracking_issue: { icon: '🔍', label: 'בעיית מדידה', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)' },
};

export const SEVERITY_META: Record<AutoFindingSeverity, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  low: { label: 'נמוכה', color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' },
  medium: { label: 'בינונית', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  high: { label: 'גבוהה', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  critical: { label: 'קריטית', color: '#dc2626', bgColor: 'rgba(220,38,38,0.15)' },
};
