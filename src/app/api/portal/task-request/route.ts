/**
 * POST /api/portal/task-request
 * Body: { clientId, title, type, description, files[], dueDate }
 *
 * A client submits a task request from the portal. It:
 *   1. Creates an employee task on the client's board, auto-assigned to the
 *      client's account manager (the right person), with the desired due date.
 *   2. Emails the system manager with the full request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { employeeTasks } from '@/lib/db';
import { getSupabase } from '@/lib/db/store';
import { ensureTaskColumns } from '@/lib/db/ensure-task-columns';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  social: 'סושיאל', website: 'אתר', campaign: 'קמפיין', design: 'עיצוב גרפי',
  video: 'וידאו', content: 'תוכן', other: 'אחר',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, title, type, description, files, dueDate } = body || {};
    if (!clientId || !title?.trim()) {
      return NextResponse.json({ error: 'חסר לקוח או כותרת' }, { status: 400 });
    }

    // Resolve client name + account manager (the "appropriate employee").
    let clientName = '';
    let assigneeId = '';
    try {
      const sb = getSupabase();
      const { data: c } = await sb.from('clients').select('name, assigned_manager_id').eq('id', clientId).maybeSingle();
      clientName = (c as any)?.name || '';
      assigneeId = (c as any)?.assigned_manager_id || '';
    } catch { /* best-effort */ }

    const typeLabel = TYPE_LABELS[type] || type || 'אחר';
    const now = new Date().toISOString();
    const fileList: string[] = Array.isArray(files) ? files : [];
    const sb = getSupabase();
    const errors: string[] = [];

    // Make sure the optional columns exist before inserting.
    let presentCols: Set<string> | null = null;
    try { presentCols = await ensureTaskColumns(); } catch { /* fall back to core columns */ }

    // 1) GLOBAL task (the `tasks` table) — this is what the client card "משימות"
    //    tab and the manager board read. Without this it appears nowhere.
    const taskId = `tsk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const taskRow: Record<string, unknown> = {
      id: taskId, title: title.trim(), description: description || '',
      status: 'new', priority: 'medium', client_id: clientId,
      created_at: now, updated_at: now,
    };
    // Only set columns confirmed present (avoids "column does not exist" → silent fail).
    const has = (c: string) => !presentCols || presentCols.has(c);
    if (clientName && has('client_name')) taskRow.client_name = clientName;
    if (has('notes')) taskRow.notes = `נשלח מהלקוח דרך הפורטל · סוג: ${typeLabel}`;
    if (assigneeId) taskRow.assignee_id = assigneeId;
    if (dueDate && has('due_date')) taskRow.due_date = dueDate;
    if (fileList.length && has('files')) taskRow.files = fileList;

    const { error: taskErr } = await sb.from('tasks').insert(taskRow);
    if (taskErr) {
      errors.push(`tasks: ${taskErr.message}`);
      console.error('[portal task] tasks insert failed:', taskErr.message);
    }

    // 2) Mirror to employee-tasks so the responsible employee sees it on their board.
    let created: any = { id: taskId };
    try {
      created = await employeeTasks.createAsync({
        title: title.trim(), description: description || '',
        assignedEmployeeId: assigneeId || null, clientId, clientName,
        projectId: null, ganttItemId: null, dueDate: dueDate || null,
        status: 'new', priority: 'medium', files: fileList,
        tags: ['בקשת לקוח', typeLabel],
        notes: `נשלח מהלקוח דרך הפורטל · סוג: ${typeLabel}`,
        createdAt: now, updatedAt: now,
      } as any);
    } catch (e) { errors.push(`employee-task: ${e instanceof Error ? e.message : e}`); console.error('[portal task] employee-task mirror failed:', e); }

    // If NOTHING persisted, fail loudly so the client knows it wasn't saved.
    if (taskErr && errors.length >= 2) {
      return NextResponse.json({ error: `המשימה לא נשמרה: ${errors.join(' · ')}` }, { status: 500 });
    }

    // Email the system manager.
    try {
      const { sendEmail, getSenderEmail } = await import('@/lib/email/email-service');
      const to = await getSenderEmail();
      if (to) {
        const filesHtml = fileList.length
          ? `<p style="font-size:13px;color:#334155">קבצים מצורפים:</p><ul>${fileList.map((f) => { const i = f.indexOf('|'); const name = i === -1 ? f : f.slice(0, i); const url = i === -1 ? f : f.slice(i + 1); return `<li><a href="${url}">${name}</a></li>`; }).join('')}</ul>`
          : '';
        await sendEmail({
          to,
          subject: `📥 בקשת משימה חדשה מלקוח: ${clientName || ''} — ${title}`,
          html: `
            <div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px">
              <h2 style="margin:0 0 8px;color:#0f172a">📥 בקשת משימה חדשה מהפורטל</h2>
              <p style="font-size:15px;color:#0f172a;margin:0 0 4px"><b>${title}</b></p>
              <p style="font-size:13px;color:#64748b;margin:0 0 2px">לקוח: ${clientName || clientId}</p>
              <p style="font-size:13px;color:#64748b;margin:0 0 2px">סוג: ${typeLabel}</p>
              ${dueDate ? `<p style="font-size:13px;color:#64748b;margin:0 0 12px">תאריך הגשה רצוי: ${dueDate}</p>` : ''}
              ${description ? `<div style="font-size:14px;color:#334155;background:#f8fafc;border-radius:10px;padding:12px;margin:8px 0;white-space:pre-wrap">${description}</div>` : ''}
              ${filesHtml}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://frame-ai-delta.vercel.app'}/tasks" style="display:inline-block;background:#00B5FE;color:#fff;font-weight:700;padding:10px 22px;border-radius:10px;text-decoration:none;margin-top:10px">פתח בלוח המשימות ←</a>
            </div>`,
        });
      }
    } catch (e) {
      console.warn('[portal task-request] email failed:', e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ success: true, task: created, warnings: errors.length ? errors : undefined });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
