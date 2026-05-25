/**
 * POST /api/onboarding/generate — Auto-generate 36 onboarding tasks for a new client.
 *
 * Body: { clientId: string, clientName: string }
 * Returns: the created task objects (camelCase).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { generateOnboardingTasks } from '@/lib/onboarding/onboarding-templates';

/* ── helpers ─────────────────────────────────────────────────────────── */

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `task_${ts}_${rand}`;
}

type Row = Record<string, unknown> & { id: string };

function rowToTask(r: Row) {
  const assignee = (r.assignee_id as string) || null;
  return {
    id: r.id,
    title: (r.title as string) ?? '',
    description: (r.description as string) ?? '',
    status: (r.status as string) ?? 'open',
    priority: (r.priority as string) ?? 'medium',
    clientId: (r.client_id as string) ?? null,
    clientName: (r.client_name as string) ?? '',
    assigneeIds: assignee ? [assignee] : [],
    dueDate: (r.due_date as string) ?? null,
    tags: [] as string[],
    files: [] as string[],
    notes: (r.notes as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

/* ── POST ────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, clientName } = body as { clientId: string; clientName: string };

    if (!clientId || !clientName) {
      return NextResponse.json(
        { error: 'clientId and clientName are required' },
        { status: 400 },
      );
    }

    const tasks = generateOnboardingTasks(clientId, clientName);
    const now = new Date().toISOString();

    // Map to snake_case DB rows
    const rows: Record<string, unknown>[] = tasks.map((task) => {
      const id = generateId();
      const row: Record<string, unknown> = {
        id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        notes: task.notes,
        created_at: now,
        updated_at: now,
      };

      // Only set nullable columns when provided — avoids FK violations
      if (task.clientId) row.client_id = task.clientId;
      if (task.clientName) row.client_name = task.clientName;
      if (task.dueDate) row.due_date = task.dueDate;

      return row;
    });

    const sb = getSupabase();
    const { data: inserted, error: insertErr } = await sb
      .from('tasks')
      .insert(rows)
      .select('*');

    if (insertErr) {
      console.error('[API] POST /api/onboarding/generate FAILED:', insertErr);
      return NextResponse.json(
        { error: (insertErr as { message: string }).message ?? 'Batch insert failed' },
        { status: 400 },
      );
    }

    const result = (inserted ?? []).map((r: Record<string, unknown>) =>
      rowToTask(r as unknown as Row),
    );

    console.log(
      `[API] POST /api/onboarding/generate ✅ created ${result.length} tasks for client ${clientId}`,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/onboarding/generate error:', msg);
    return NextResponse.json(
      { error: `Failed to generate onboarding tasks: ${msg}` },
      { status: 400 },
    );
  }
}
