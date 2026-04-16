/**
 * GET    /api/data/project-payments/[id]
 * PUT    /api/data/project-payments/[id]
 * DELETE /api/data/project-payments/[id]
 *
 * Backed by Supabase table: public.business_project_payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'business_project_payments';

type Row = Record<string, unknown> & { id: string };

function rowToPayment(r: Row) {
  return {
    id: r.id,
    projectId: (r.project_id as string) ?? '',
    clientId: (r.client_id as string) ?? '',
    title: (r.title as string) ?? '',
    amount: Number(r.amount ?? 0),
    dueDate: (r.due_date as string) ?? '',
    status: (r.status as string) ?? 'pending',
    description: (r.description as string) ?? '',
    milestoneId: (r.milestone_id as string) ?? null,
    paidAt: (r.paid_at as string) ?? null,
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

/** Map camelCase body keys → snake_case DB columns for UPDATE */
function toUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    projectId: 'project_id',
    clientId: 'client_id',
    title: 'title',
    amount: 'amount',
    dueDate: 'due_date',
    status: 'status',
    description: 'description',
    milestoneId: 'milestone_id',
    paidAt: 'paid_at',
  };
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, val] of Object.entries(body)) {
    const col = map[key];
    if (col) out[col] = val;
  }
  return out;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rowToPayment(data as Row));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const body = await req.json();
    const updates = toUpdate(body);

    // Retry loop — auto-drop unknown columns
    let updated: Row | null = null;
    let lastErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await sb.from(TABLE).update(updates).eq('id', id).select('*').single();
      if (!error) { updated = data as Row; break; }
      lastErr = error;

      const code = (error as any)?.code ?? '';
      if (code === '42P01') break;

      const m = error.message.match(/column .*?['"]?([a-z_]+)['"]? (?:does not exist)/i);
      const bad = m?.[1];
      if (bad && bad in updates) {
        console.warn(`[project-payments] dropping unknown col "${bad}"`);
        delete updates[bad];
      } else { break; }
    }

    if (!updated) {
      console.error('[project-payments] update error:', lastErr);
      return NextResponse.json({ error: lastErr?.message ?? 'Update failed' }, { status: 500 });
    }

    console.log(`[project-payments] ✅ updated id=${id}`);
    return NextResponse.json(rowToPayment(updated));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { error } = await sb.from(TABLE).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
