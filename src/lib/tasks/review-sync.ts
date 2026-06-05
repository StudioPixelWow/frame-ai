/**
 * Task-review sync — fires when a task changes review state.
 *
 * On "sent for review" (status → under_review):
 *   1. Creates an Approval record so the approvals screen shows it.
 *   2. Emails the manager (the configured Gmail account) that a task awaits review.
 *
 * On approve / return:
 *   Updates the matching Approval record so the approvals screen stays in sync.
 *
 * All best-effort: failures are logged, never break the task update itself.
 */

import { approvals } from '@/lib/db/collections';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://frame-ai-delta.vercel.app';

export async function onTaskSentForReview(task: { id: string; title?: string; clientName?: string }) {
  // 1) Approval record (so /approvals shows it)
  try {
    const all = (await approvals.getAllAsync()) as any[];
    const exists = all.find((a) => a.taskId === task.id && a.status === 'pending_approval');
    if (!exists) {
      await approvals.createAsync({
        type: 'task',
        title: task.title || 'משימה',
        clientName: task.clientName || '',
        status: 'pending_approval',
        taskId: task.id,
      } as any);
    }
  } catch (e) {
    console.warn('[review-sync] approval record failed:', e instanceof Error ? e.message : e);
  }

  // 2) Email the manager
  try {
    const { sendEmail, getSenderEmail } = await import('@/lib/email/email-service');
    const to = await getSenderEmail();
    if (to) {
      await sendEmail({
        to,
        subject: `📤 משימה חדשה ממתינה לבדיקה: ${task.title || 'משימה'}`,
        html: `
          <div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px">
            <h2 style="margin:0 0 8px;color:#0f172a">📤 משימה הוגשה לבדיקה</h2>
            <p style="font-size:15px;color:#334155;margin:0 0 4px"><b>${task.title || 'משימה'}</b></p>
            ${task.clientName ? `<p style="font-size:13px;color:#64748b;margin:0 0 16px">לקוח: ${task.clientName}</p>` : ''}
            <a href="${APP_URL}/tasks" style="display:inline-block;background:#00B5FE;color:#fff;font-weight:700;padding:10px 22px;border-radius:10px;text-decoration:none">בדוק ואשר ←</a>
            <p style="font-size:11px;color:#94a3b8;margin-top:18px">PixelManageAI · התראה אוטומטית</p>
          </div>`,
      });
      console.log(`[review-sync] review email sent to ${to} for task ${task.id}`);
    } else {
      console.warn('[review-sync] no sender email configured — skipping notification');
    }
  } catch (e) {
    console.warn('[review-sync] email failed:', e instanceof Error ? e.message : e);
  }
}

export async function onTaskReviewResolved(taskId: string, resolution: 'approved' | 'returned') {
  try {
    const all = (await approvals.getAllAsync()) as any[];
    const rec = all.find((a) => a.taskId === taskId && a.status === 'pending_approval');
    if (rec) {
      await approvals.updateAsync(rec.id, {
        status: resolution === 'approved' ? 'approved' : 'needs_changes',
      } as any);
    }
  } catch (e) {
    console.warn('[review-sync] resolve failed:', e instanceof Error ? e.message : e);
  }
}
