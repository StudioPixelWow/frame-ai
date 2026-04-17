/**
 * Shared utility for deriving project progress and status from milestones.
 *
 * This is the SINGLE SOURCE OF TRUTH for how milestone data maps to
 * project-level progress and status.  Used by:
 *   - business-projects list page
 *   - business-projects dashboard page
 *   - business-projects detail page (inline version kept for backwards compat)
 */

import type { ProjectMilestone } from '@/lib/db/schema';

export type DerivedProjectStatus =
  | 'not_started'
  | 'in_progress'
  | 'awaiting_approval'
  | 'waiting_for_client'
  | 'completed';

export interface MilestoneCounts {
  total: number;
  pending: number;
  inProgress: number;
  submitted: number;
  approved: number;
  returned: number;
}

export interface DerivedProjectData {
  progress: number;           // 0–100
  status: DerivedProjectStatus;
  counts: MilestoneCounts;
}

/** Count milestones per status bucket. */
export function countMilestones(milestones: ProjectMilestone[]): MilestoneCounts {
  return {
    total: milestones.length,
    pending: milestones.filter(m => m.status === 'pending').length,
    inProgress: milestones.filter(m => m.status === 'in_progress').length,
    submitted: milestones.filter(m => m.status === 'submitted').length,
    approved: milestones.filter(m => m.status === 'approved').length,
    returned: milestones.filter(m => m.status === 'returned').length,
  };
}

/** Progress: approved / total, rounded to integer 0–100. */
export function deriveProgress(counts: MilestoneCounts): number {
  if (counts.total === 0) return 0;
  return Math.round((counts.approved / counts.total) * 100);
}

/**
 * Status: derived entirely from milestone states.
 * Falls back to `fallbackStatus` when there are no milestones.
 */
export function deriveStatus(
  counts: MilestoneCounts,
  fallbackStatus: string = 'not_started',
): DerivedProjectStatus {
  const { total, approved, submitted, inProgress, returned, pending } = counts;

  if (total === 0) return (fallbackStatus as DerivedProjectStatus) || 'not_started';
  if (approved === total) return 'completed';
  if (submitted > 0 && inProgress === 0 && pending === 0 && returned === 0) return 'awaiting_approval';
  if (returned > 0) return 'waiting_for_client';
  if (inProgress > 0 || approved > 0 || submitted > 0) return 'in_progress';
  return 'not_started';
}

/** All-in-one: derive progress + status from a list of milestones. */
export function deriveProjectData(
  milestones: ProjectMilestone[],
  fallbackStatus?: string,
): DerivedProjectData {
  const counts = countMilestones(milestones);
  return {
    progress: deriveProgress(counts),
    status: deriveStatus(counts, fallbackStatus),
    counts,
  };
}

/* ── Display helpers ── */

export const STATUS_COLORS: Record<DerivedProjectStatus, string> = {
  not_started: '#6b7280',
  in_progress: '#f59e0b',
  awaiting_approval: '#8b5cf6',
  waiting_for_client: '#f97316',
  completed: '#22c55e',
};

export const STATUS_LABELS: Record<DerivedProjectStatus, string> = {
  not_started: 'לא התחיל',
  in_progress: 'בתהליך',
  awaiting_approval: 'ממתין לאישור',
  waiting_for_client: 'בהמתנה ללקוח',
  completed: 'הושלם',
};

export function progressColor(pct: number): string {
  if (pct <= 30) return '#ef4444';
  if (pct <= 70) return '#f59e0b';
  return '#22c55e';
}
