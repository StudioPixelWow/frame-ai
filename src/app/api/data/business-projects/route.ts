/**
 * GET  /api/data/business-projects — list all business projects
 * POST /api/data/business-projects — create a new business project
 *
 * Storage: Supabase "business_projects" table with FLAT columns.
 * Expected schema:
 *   id, project_name, client_id, project_type, description,
 *   agreement_signed, project_status, start_date, end_date,
 *   assigned_manager_id, budget, progress, contract_signed,
 *   contract_signed_at, created_at, updated_at
 *
 * Unknown columns are auto-dropped and the request is retried, so partial
 * schemas still succeed. The id returned by POST is the id that the GET
 * route (and the detail page) will find.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole, getRequestRole, getRequestClientId, getRequestEmployeeId } from '@/lib/auth/api-guard';
import { insertTimelineEvent } from '@/lib/timeline';
import { ensureBusinessProjectColumns } from '@/lib/db/ensure-columns';

const TABLE = 'business_projects';

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `bpr_${ts}_${rand}`;
}

// Row shape is intentionally open — some deployments use service_type,
// others use project_type. Map defensively below.
type Row = Record<string, unknown> & { id: string };

function rowToProject(r: Row) {
  const serviceType = (r.service_type as string) || (r.project_type as string) || '';
  return {
    id: r.id,
    projectName: (r.project_name as string) ?? '',
    clientId: (r.client_id as string) ?? '',
    projectType: serviceType,           // frontend reads projectType
    serviceType,                        // also expose serviceType for new callsites
    description: (r.description as string) ?? '',
    agreementSigned: (r.agreement_signed as boolean) ?? false,
    contractSigned: (r.contract_signed as boolean) ?? false,
    contractSignedAt: (r.contract_signed_at as string) ?? null,
    budget: Number(r.budget) || 0,
    projectStatus: (r.project_status as string) ?? 'not_started',
    progress: Number(r.progress) || 0,
    startDate: (r.start_date as string) ?? null,
    endDate: (r.end_date as string) ?? null,
    assignedManagerId: (r.assigned_manager_id as string) ?? null,
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

/** Coerce empty / non-string values to null so we never send "" into a FK column. */
function nullIfEmpty(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
}

function toInsert(body: Record<string, unknown>, id: string, now: string): Record<string, unknown> {
  const svc = nullIfEmpty(body.serviceType ?? body.projectType);
  return {
    id,
    project_name: (body.projectName ?? body.name ?? '') as string,
    client_id: nullIfEmpty(body.clientId),
    // write both for schema tolerance — drop-column fallback removes whichever doesn't exist.
    service_type: svc,
    project_type: svc,
    description: (body.description ?? '') as string,
    agreement_signed: (body.agreementSigned ?? false) as boolean,
    budget: typeof body.budget === 'number' ? body.budget : (Number(body.budget) || 0),
    project_status: (body.projectStatus ?? body.status ?? 'not_started') as string,
    start_date: nullIfEmpty(body.startDate),
    end_date: nullIfEmpty(body.endDate),
    // FK to employees(id) — empty string would violate the constraint, force null.
    assigned_manager_id: nullIfEmpty(body.assignedManagerId),
    created_at: now,
    updated_at: now,
  };
}

const SELECT_COLUMNS =
  'id, project_name, client_id, project_type, description, agreement_signed, project_status, start_date, end_date, assigned_manager_id, budget, progress, created_at, updated_at';

function parseBadColumn(msg: string): string | null {
  const m = msg.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
  return m?.[1] || m?.[2] || null;
}

export async function GET(req: NextRequest) {
  await ensureBusinessProjectColumns();
  try {
    const sb = getSupabase();
    const role = getRequestRole(req);
    let query = sb.from(TABLE).select('*').order('id');

    // Clients only see their own projects
    if (role === 'client') {
      const clientId = getRequestClientId(req);
      if (clientId) {
        query = query.eq('client_id', clientId);
      } else {
        return NextResponse.json([]); // no client ID → empty list
      }
    }

    // Employees only see projects they are assigned to manage
    if (role === 'employee') {
      const employeeId = getRequestEmployeeId(req);
      if (employeeId) {
        query = query.eq('assigned_manager_id', employeeId);
      } else {
        return NextResponse.json([]); // no employee ID → empty list
      }
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('[API] GET /api/data/business-projects supabase error:', error);
      return NextResponse.json({ error: error.message, code: (error as any).code ?? null }, { status: 500 });
    }
    return NextResponse.json((rows ?? []).map((r) => rowToProject(r as Row)));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/business-projects error:', msg);
    return NextResponse.json({ error: `Failed to fetch business projects: ${msg}` }, { status: 500 });
  }
}

/* ── Milestone auto-generation from templates ─────────────────────────── */

const MILESTONES_TABLE = 'business_project_milestones';
const TEMPLATES_TABLE = 'business_project_milestone_templates';

function milestoneId(i: number): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `mil_${ts}_${i}_${rand}`;
}

/**
 * Fetch template rows matching service_type, insert milestones for the project.
 *
 * Milestones go into public.business_project_milestones.
 * Required per-row columns: id, business_project_id, title, status, sort_order.
 *
 * Returns a detailed result: { inserted, templatesFound, error? }.
 * Errors are NO LONGER swallowed — they're propagated so the POST caller can
 * decide what to do (we surface them in the response + server logs).
 */
async function seedMilestonesFromTemplates(
  sb: ReturnType<typeof getSupabase>,
  projectId: string,
  serviceType: string | null,
  now: string
): Promise<{ inserted: number; templatesFound: number; error?: string; details?: unknown }> {
  if (!serviceType) {
    return { inserted: 0, templatesFound: 0, error: 'service_type missing; cannot match templates' };
  }

  // 1. Fetch templates by exact service_type.
  const { data: templates, error: tErr } = await sb
    .from(TEMPLATES_TABLE)
    .select('*')
    .eq('service_type', serviceType);
  if (tErr) {
    console.error('[seedMilestones] templates fetch error:', tErr);
    return { inserted: 0, templatesFound: 0, error: `templates fetch failed: ${tErr.message}`, details: tErr };
  }

  const tmpls = Array.isArray(templates) ? templates : [];
  console.log(`[seedMilestones] service_type="${serviceType}" matched ${tmpls.length} template(s)`);
  if (tmpls.length === 0) {
    return { inserted: 0, templatesFound: 0 };
  }

  // Sort by sort_order / order_index / position if present on the templates.
  tmpls.sort((a: any, b: any) => {
    const ao = a?.sort_order ?? a?.order_index ?? a?.position ?? 0;
    const bo = b?.sort_order ?? b?.order_index ?? b?.position ?? 0;
    return Number(ao) - Number(bo);
  });

  // 2. Build milestone rows. Keys match public.business_project_milestones.
  const rows = tmpls.map((t: any, i: number) => ({
    id: milestoneId(i),
    business_project_id: projectId,
    title: t?.title ?? t?.name ?? `שלב ${i + 1}`,
    description: t?.description ?? '',
    due_date: null,
    assigned_employee_id: null,
    status: 'pending',
    sort_order: typeof t?.sort_order === 'number' ? t.sort_order : i,
    created_at: now,
    updated_at: now,
  }));

  // 3. Insert. If an OPTIONAL column isn't in the real schema drop it and
  //    retry — BUT refuse to drop business_project_id, title, status, or
  //    sort_order since those are required by the user's contract.
  const REQUIRED = new Set(['id', 'business_project_id', 'title', 'status', 'sort_order']);
  let insertRows: Record<string, unknown>[] = rows;
  let lastErr: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await sb.from(MILESTONES_TABLE).insert(insertRows);
    if (!error) {
      console.log(`[seedMilestones] ✅ inserted ${insertRows.length} milestones for project=${projectId} service=${serviceType}`);
      return { inserted: insertRows.length, templatesFound: tmpls.length };
    }
    lastErr = error as any;
    const m = error.message.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
    const bad = m?.[1] || m?.[2];
    if (!bad) break;
    if (REQUIRED.has(bad)) {
      console.error(`[seedMilestones] schema mismatch on REQUIRED column "${bad}" — refusing to drop`);
      break;
    }
    console.warn(`[seedMilestones] dropping optional milestone column "${bad}" and retrying`);
    insertRows = insertRows.map((row) => {
      const { [bad]: _d, ...rest } = row;
      void _d;
      return rest;
    });
  }

  console.error('[seedMilestones] insert failed:', lastErr);
  return {
    inserted: 0,
    templatesFound: tmpls.length,
    error: `milestones insert failed: ${lastErr?.message ?? 'unknown'}`,
    details: lastErr,
  };
}

/* ── Auto-create deposit + final payments (50/50 split) ──────────────── */

const PAYMENTS_TABLE = 'business_project_payments';

/**
 * Ensure the payments table exists and has the new columns.
 * Mirrors the ensureTable() in project-payments/route.ts.
 */
const PAYMENTS_DDL = `
CREATE TABLE IF NOT EXISTS ${PAYMENTS_TABLE} (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_project_id  TEXT NOT NULL,
  client_id            TEXT DEFAULT '',
  title                TEXT DEFAULT '',
  amount               NUMERIC DEFAULT 0,
  due_date             DATE,
  status               TEXT DEFAULT 'pending',
  description          TEXT DEFAULT '',
  milestone_id         TEXT,
  payment_type         TEXT DEFAULT 'custom',
  is_due               BOOLEAN DEFAULT false,
  is_paid              BOOLEAN DEFAULT false,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);
`;

const PAYMENTS_ALTERS = [
  `ALTER TABLE ${PAYMENTS_TABLE} ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'custom'`,
  `ALTER TABLE ${PAYMENTS_TABLE} ADD COLUMN IF NOT EXISTS is_due BOOLEAN DEFAULT false`,
  `ALTER TABLE ${PAYMENTS_TABLE} ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false`,
];

let _paymentsTableReady = false;
async function ensurePaymentsTable(sb: ReturnType<typeof getSupabase>): Promise<void> {
  if (_paymentsTableReady) return;
  try {
    const { error } = await sb.rpc('exec_sql', { query: PAYMENTS_DDL });
    if (!error) {
      for (const alter of PAYMENTS_ALTERS) {
        await sb.rpc('exec_sql', { query: alter }).catch(() => {});
      }
      _paymentsTableReady = true;
      console.log('[seedPayments] ✅ payments table ensured');
      return;
    }
    console.warn('[seedPayments] exec_sql DDL failed:', error.message);
  } catch (e) {
    console.warn('[seedPayments] exec_sql not available:', e);
  }

  // Fallback: probe if table exists
  const { error: probe } = await sb.from(PAYMENTS_TABLE).select('id').limit(1);
  if (!probe) {
    for (const alter of PAYMENTS_ALTERS) {
      try { await sb.rpc('exec_sql', { query: alter }); } catch { /* ignore */ }
    }
    _paymentsTableReady = true;
    console.log('[seedPayments] ✅ payments table exists (probe OK)');
  } else {
    console.error('[seedPayments] ❌ payments table does not exist and cannot be created. Error:', probe.message);
  }
}

/**
 * Create two payment rows for a new project: 50% deposit (due immediately)
 * and 50% final (due when project is submitted).
 *
 * IMPORTANT: The id column is UUID with auto-gen — do NOT send a custom id.
 */
async function seedPayments(
  sb: ReturnType<typeof getSupabase>,
  projectId: string,
  clientId: string | null,
  budget: number,
  now: string,
): Promise<{ inserted: number; error?: string }> {
  console.log(`[seedPayments] called with projectId=${projectId} clientId=${clientId} budget=${budget}`);

  if (!budget || budget <= 0) {
    console.log(`[seedPayments] ⏭️ budget is ${budget}, skipping payment creation`);
    return { inserted: 0, error: 'budget is 0 or missing; skipping payment creation' };
  }

  // Step 1: Ensure the payments table + columns exist
  await ensurePaymentsTable(sb);

  // Step 2: Deduplication — skip if payments already exist for this project
  const { data: existing, error: dedupErr } = await sb
    .from(PAYMENTS_TABLE)
    .select('id')
    .eq('business_project_id', projectId)
    .limit(1);
  if (dedupErr) {
    console.error(`[seedPayments] ❌ dedup query failed:`, dedupErr.message);
    // If the table doesn't exist even after ensure, bail out
    return { inserted: 0, error: `dedup query failed: ${dedupErr.message}` };
  }
  if (existing && existing.length > 0) {
    console.log(`[seedPayments] ⏭️ payments already exist for project=${projectId}, skipping`);
    return { inserted: 0, error: 'payments already exist (dedup)' };
  }

  // Step 3: Build the two payment rows
  // NOTE: Do NOT include `id` — the column is UUID with DEFAULT gen_random_uuid()
  const deposit = Math.round(budget * 0.5 * 100) / 100;
  const finalAmt = Math.round((budget - deposit) * 100) / 100;

  const depositRow: Record<string, unknown> = {
    business_project_id: projectId,
    client_id: clientId ?? '',
    title: 'מקדמה (50%)',
    amount: deposit,
    due_date: now.slice(0, 10),
    status: 'pending',
    description: 'מקדמה — 50% מתקציב הפרויקט',
    payment_type: 'deposit',
    is_due: true,
    is_paid: false,
    created_at: now,
    updated_at: now,
  };

  const finalRow: Record<string, unknown> = {
    business_project_id: projectId,
    client_id: clientId ?? '',
    title: 'תשלום סופי (50%)',
    amount: finalAmt,
    due_date: null,
    status: 'pending',
    description: 'תשלום סופי — 50% בהגשת הפרויקט',
    payment_type: 'final',
    is_due: false,
    is_paid: false,
    created_at: now,
    updated_at: now,
  };

  console.log(`[seedPayments] deposit payload:`, JSON.stringify(depositRow));
  console.log(`[seedPayments] final payload:`, JSON.stringify(finalRow));

  // Step 4: Insert both rows. Retry with column-dropping on schema mismatch.
  let insertRows: Record<string, unknown>[] = [depositRow, finalRow];
  let lastErr: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 8; attempt++) {
    console.log(`[seedPayments] insert attempt ${attempt + 1}, columns: ${Object.keys(insertRows[0]).join(',')}`);
    const { data: insertedData, error } = await sb.from(PAYMENTS_TABLE).insert(insertRows).select('id');

    if (!error) {
      const ids = (insertedData || []).map((r: any) => r.id);
      console.log(`[seedPayments] ✅ SUCCESS — created 2 payments for project=${projectId}:`);
      console.log(`[seedPayments]   deposit: ₪${deposit}, id=${ids[0] || '?'}`);
      console.log(`[seedPayments]   final:   ₪${finalAmt}, id=${ids[1] || '?'}`);
      return { inserted: 2 };
    }

    lastErr = error as any;
    const errCode = (error as any)?.code ?? '';
    console.error(`[seedPayments] attempt ${attempt + 1} failed: code=${errCode} message=${error.message}`);

    // If the table itself doesn't exist, bail immediately
    if (errCode === '42P01' || error.message.includes('does not exist') && error.message.includes('relation')) {
      console.error(`[seedPayments] ❌ table "${PAYMENTS_TABLE}" does not exist. Cannot create payments.`);
      break;
    }

    // Try to identify and drop unknown columns
    const m = error.message.match(
      /column .*?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i,
    );
    const bad = m?.[1] || m?.[2];
    if (!bad) {
      console.error(`[seedPayments] ❌ unrecoverable error (not a column issue): ${error.message}`);
      break;
    }

    console.warn(`[seedPayments] dropping unknown column "${bad}" and retrying`);
    insertRows = insertRows.map((row) => {
      const copy = { ...row };
      delete copy[bad];
      return copy;
    });
  }

  console.error(`[seedPayments] ❌ FAILED to create payments for project=${projectId}. Last error: ${lastErr?.message ?? 'unknown'}`);
  return { inserted: 0, error: lastErr?.message ?? 'unknown' };
}

export async function POST(req: NextRequest) {
  // Only admin and employee can create projects
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

  await ensureBusinessProjectColumns();
  try {
    const sb = getSupabase();
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const now = new Date().toISOString();
    const id = generateId();

    let insertRow = toInsert(body, id, now);
    let selectList = SELECT_COLUMNS;

    console.log(`[API] POST /api/data/business-projects inserting id=${id} cols=${Object.keys(insertRow).join(',')}`);

    let inserted: Row | null = null;
    let lastErr: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const { data, error } = await sb.from(TABLE).insert(insertRow).select(selectList).single();
      if (!error) { inserted = data as Row; break; }
      lastErr = error as any;
      const bad = parseBadColumn(error.message);
      if (!bad) break;
      if (bad in insertRow) {
        console.warn(`[API] POST /api/data/business-projects dropping unknown insert column "${bad}"`);
        const { [bad]: _d, ...rest } = insertRow;
        void _d;
        insertRow = rest;
      } else if (selectList.includes(bad)) {
        console.warn(`[API] POST /api/data/business-projects dropping unknown select column "${bad}"`);
        selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
      } else {
        break;
      }
    }

    if (!inserted) {
      const code = (lastErr as any)?.code ?? null;
      const hint =
        code === '42P01'
          ? `Run: CREATE TABLE IF NOT EXISTS ${TABLE} ( id TEXT PRIMARY KEY, project_name TEXT, client_id TEXT, project_type TEXT, description TEXT, agreement_signed BOOLEAN, project_status TEXT, start_date DATE, end_date DATE, assigned_manager_id TEXT, budget NUMERIC DEFAULT 0, progress NUMERIC DEFAULT 0, contract_signed BOOLEAN DEFAULT false, contract_signed_at TIMESTAMPTZ, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ );`
          : null;
      console.error('[API] POST /api/data/business-projects insert error:', lastErr);
      return NextResponse.json({ error: lastErr?.message ?? 'Insert failed', code, hint }, { status: 500 });
    }

    // Verify read-back so we guarantee the detail page will find it.
    const { data: verify, error: verifyErr } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (verifyErr || !verify) {
      console.error('[API] POST /api/data/business-projects verify failed', verifyErr);
      return NextResponse.json({ error: verifyErr?.message ?? 'Not persisted', projectId: id }, { status: 500 });
    }

    // Fire-and-forget timeline event for project creation
    const projectName = (body.projectName ?? body.name ?? '') as string;
    insertTimelineEvent(id, 'project_created', `פרויקט "${projectName}" נוצר`);

    // Auto-generate milestones from templates matching service_type.
    const verifyRow = verify as Row;
    const svc = (verifyRow.service_type as string) || (verifyRow.project_type as string) || null;
    const seed = await seedMilestonesFromTemplates(sb, id, svc, now);

    // Auto-create deposit + final payments (50/50 split)
    const budgetVal = Number(verifyRow.budget) || 0;
    const clientIdVal = (verifyRow.client_id as string) || null;
    console.log(`[API] POST business-projects — about to seed payments. project=${id} budget=${budgetVal} (raw=${verifyRow.budget}) client=${clientIdVal}`);
    const paymentSeed = await seedPayments(sb, id, clientIdVal, budgetVal, now);
    console.log(`[API] POST business-projects — payment seed result: inserted=${paymentSeed.inserted} error=${paymentSeed.error ?? 'none'}`);

    // Fire-and-forget timeline for payments
    if (paymentSeed.inserted > 0) {
      insertTimelineEvent(id, 'payment_created', `תשלומים נוצרו אוטומטית: מקדמה 50% + תשלום סופי 50%`);
    }

    console.log(
      `[API] POST /api/data/business-projects ✅ persisted id=${id} service=${svc} templates=${seed.templatesFound} milestones=${seed.inserted}${seed.error ? ` error="${seed.error}"` : ''} payments=${paymentSeed.inserted}${paymentSeed.error ? ` payErr="${paymentSeed.error}"` : ''}`
    );

    return NextResponse.json(
      {
        ...rowToProject(verifyRow),
        _milestones: {
          serviceType: svc,
          templatesFound: seed.templatesFound,
          inserted: seed.inserted,
          error: seed.error,
        },
        _payments: {
          inserted: paymentSeed.inserted,
          error: paymentSeed.error,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/business-projects fatal:', msg);
    return NextResponse.json({ error: `Failed to create business project: ${msg}` }, { status: 500 });
  }
}
