/**
 * POST /api/data/project-notifications/generate
 *
 * Scans all business projects and milestones to generate notifications for:
 * 1. Overdue milestones (dueDate past, status != approved)
 * 2. Milestones without assignee
 * 3. Projects with no activity for X days (default 7)
 *
 * Projects and milestones are fetched from Supabase (via internal API).
 * Notifications are stored in JsonStore (file-based).
 *
 * De-duplicates: won't create a notification if an identical unread one exists.
 * Returns: { created: number, total: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectNotifications } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { getSupabase } from '@/lib/db/store';
import type { ProjectNotification } from '@/lib/db/schema';

const INACTIVITY_DAYS = 7;

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Check if an identical unread notification already exists */
function isDuplicate(
  existing: ProjectNotification[],
  type: string,
  projectId: string,
  milestoneId: string | null
): boolean {
  return existing.some(
    (n) =>
      n.type === type &&
      n.projectId === projectId &&
      n.milestoneId === milestoneId &&
      !n.isRead
  );
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const now = new Date();
    const nowStr = now.toISOString();
    const existing = projectNotifications.getAll();

    // Optional: custom inactivity threshold from request body
    let inactivityDays = INACTIVITY_DAYS;
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.inactivityDays && typeof body.inactivityDays === 'number') {
        inactivityDays = body.inactivityDays;
      }
    } catch { /* no body is fine */ }

    // Fetch projects and milestones from Supabase
    const sb = getSupabase();
    const { data: projectRows } = await sb
      .from('business_projects')
      .select('*');
    const { data: milestoneRows } = await sb
      .from('business_project_milestones')
      .select('*');

    const projects: any[] = projectRows || [];
    const milestones: any[] = milestoneRows || [];

    let created = 0;

    for (const project of projects) {
      const projectId = project.id;
      const projectName = project.project_name || project.name || project.title || projectId;
      const projectStatus = project.project_status || project.status || 'not_started';

      // Skip completed projects
      if (projectStatus === 'completed') continue;

      const projectMilestoneList = milestones.filter(
        (m: any) => (m.business_project_id || m.project_id) === projectId
      );

      // ── 1. Overdue milestones ──
      for (const ms of projectMilestoneList) {
        const msId = ms.id;
        const msStatus = ms.status || 'pending';
        const msTitle = ms.title || 'אבן דרך';
        if (msStatus === 'approved') continue;
        if (!ms.due_date) continue;

        const due = new Date(ms.due_date);
        if (due < now) {
          if (!isDuplicate(existing, 'milestone_overdue', projectId, msId)) {
            const daysLate = daysBetween(due, now);
            projectNotifications.create({
              type: 'milestone_overdue',
              severity: daysLate > 7 ? 'critical' : 'warning',
              message: `אבן דרך "${msTitle}" בפרויקט "${projectName}" באיחור של ${daysLate} ימים`,
              projectId,
              milestoneId: msId,
              isRead: false,
              linkHref: `/business-projects/${projectId}`,
              createdAt: nowStr,
              updatedAt: nowStr,
            } as any);
            created++;
            existing.push({
              id: '_temp',
              type: 'milestone_overdue',
              projectId,
              milestoneId: msId,
              isRead: false,
            } as any);
          }
        }
      }

      // ── 2. No assignee on milestones ──
      for (const ms of projectMilestoneList) {
        const msId = ms.id;
        const msStatus = ms.status || 'pending';
        const msTitle = ms.title || 'אבן דרך';
        if (msStatus === 'approved') continue;
        const assignee = ms.assignee_id || ms.assigned_employee_id;
        if (!assignee) {
          if (!isDuplicate(existing, 'no_assignee', projectId, msId)) {
            projectNotifications.create({
              type: 'no_assignee',
              severity: 'warning',
              message: `אבן דרך "${msTitle}" בפרויקט "${projectName}" ללא עובד מוקצה`,
              projectId,
              milestoneId: msId,
              isRead: false,
              linkHref: `/business-projects/${projectId}`,
              createdAt: nowStr,
              updatedAt: nowStr,
            } as any);
            created++;
            existing.push({
              id: '_temp',
              type: 'no_assignee',
              projectId,
              milestoneId: msId,
              isRead: false,
            } as any);
          }
        }
      }

      // ── 3. No activity for X days ──
      const projectUpdated = project.updated_at || project.created_at;
      let lastActivity = projectUpdated ? new Date(projectUpdated) : new Date(0);

      for (const ms of projectMilestoneList) {
        const msUpdated = ms.updated_at || ms.created_at;
        if (msUpdated) {
          const msDate = new Date(msUpdated);
          if (msDate > lastActivity) lastActivity = msDate;
        }
      }

      const inactiveDays = daysBetween(lastActivity, now);
      if (inactiveDays >= inactivityDays) {
        if (!isDuplicate(existing, 'inactivity', projectId, null)) {
          projectNotifications.create({
            type: 'inactivity',
            severity: inactiveDays > 14 ? 'critical' : 'warning',
            message: `פרויקט "${projectName}" ללא פעילות ${inactiveDays} ימים`,
            projectId,
            milestoneId: null,
            isRead: false,
            linkHref: `/business-projects/${projectId}`,
            createdAt: nowStr,
            updatedAt: nowStr,
          } as any);
          created++;
          existing.push({
            id: '_temp',
            type: 'inactivity',
            projectId,
            milestoneId: null,
            isRead: false,
          } as any);
        }
      }
    }

    const total = projectNotifications.getAll().length;
    return NextResponse.json({ created, total }, { status: 200 });
  } catch (error: any) {
    console.error('[project-notifications/generate] error:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to generate notifications' },
      { status: 500 }
    );
  }
}
