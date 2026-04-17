/**
 * GET  /api/data/project-payments           — list payments (filter via ?project_id= or ?client_id=)
 * POST /api/data/project-payments           — create a new payment
 *
 * Backed by Supabase table: public.business_project_payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { insertTimelineEvent } from '@/lib/timeline';

const TABLE = 'business_project_payments';

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  client_id     TEXT DEFAULT '',
  title         TEXT DEFAULT '',
  amount        NUMERIC DEFAULT 0,
  due_date      DATE,
  status        TEXT DEFAULT 'pending',
  description   TEXT DEFAULT '',
  milestone_id  TEXT,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
`;

type Row = Record<string, unknown> & { id: string };

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `ppy_${ts}_${rand}`;
}

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

/* ── Auto-create table ───────────────────────────────── */
let _tableReady = false;
async function ensureTable(sb: ReturnType<typeof getSupabase>) {
  if (_tableReady) return;
  try {
    const { error } = await sb.rpc('exec_sql', { query: TABLE_DDL });
    if (!error) { _tableReady = true; return; }
  } catch { /* rpc not available */ }

  const { error: probe } = await sb.from(TABLE).select('id').limit(1);
  if (!probe) { _tableReady = true; return; }

  const code = (probe as any)?.code ?? '';
  if (code === '42P01' || probe.message?.includes('does not exist')) {
    console.error(
      `[project-payments] ❌ Table "${TABLE}" does not exist!\n` +
      `Run this SQL in Supabase Dashboard → SQL Editor:\n\n${TABLE_DDL}`
    );
  }
}

/* ── GET ─────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase();
    await ensureTable(sb);

    const url = new URL(req.url);
    const projectId = url.searchParams.get('project_id') || url.searchParams.get('projectId');
    const clientId = url.searchParams.get('client_id') || url.searchParams.get('clientId');

    let q = sb.from(TABLE).select('*').order('due_date', { ascending: true });
    if (projectId) q = q.eq('project_id', projectId);
    if (clientId) q = q.eq('client_id', clientId);

    const { data: rows, error } = await q;
    if (error) {
      const code = (error as any)?.code ?? '';
      if (code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([]);
      }
      console.error('[project-payments] GET error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json((rows ?? []).map((r) => rowToPayment(r as Row)));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── POST ────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();
    await ensureTable(sb);

    const body = await req.json();
    const now = new Date().toISOString();
    const insertRow: Record<string, unknown> = {
      id: generateId(),
      project_id: body.projectId ?? '',
      client_id: body.clientId ?? '',
      title: body.title ?? '',
      amount: Number(body.amount ?? 0),
      due_date: body.dueDate || null,
      status: body.status ?? 'pending',
      description: body.description ?? '',
      milestone_id: body.milestoneId || null,
      paid_at: body.paidAt || null,
      created_at: now,
      updated_at: now,
    };

    // Retry loop — auto-drop unknown columns
    let inserted: Row | null = null;
    let lastErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await sb.from(TABLE).insert(insertRow).select('*').single();
      if (!error) { inserted = data as Row; break; }
      lastErr = error;

      const code = (error as any)?.code ?? '';
      if (code === '42P01') {
        console.error(`[project-payments] ❌ Table missing. Run:\n${TABLE_DDL}`);
        break;
      }
      const m = error.message.match(/column .*?['"]?([a-z_]+)['"]? (?:does not exist)/i);
      const bad = m?.[1];
      if (bad && bad in insertRow) {
        console.warn(`[project-payments] dropping unknown col "${bad}"`);
        delete insertRow[bad];
      } else { break; }
    }

    if (!inserted) {
      console.error('[project-payments] insert error:', lastErr);
      return NextResponse.json({ error: lastErr?.message ?? 'Insert failed' }, { status: 500 });
    }

    console.log(`[project-payments] ✅ created id=${inserted.id} project=${body.projectId}`);

    // Fire-and-forget timeline event
    const projectId = body.projectId as string;
    if (projectId) {
      const title = (body.title as string) || 'תשלום';
      const amount = Number(body.amount ?? 0);
      insertTimelineEvent(
        projectId,
        'payment_created',
        `תשלום חדש נוסף: "${title}" — ₪${amount.toLocaleString('he-IL')}`,
      );
    }

    return NextResponse.json(rowToPayment(inserted), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
