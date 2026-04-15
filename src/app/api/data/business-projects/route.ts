/**
 * GET  /api/data/business-projects — list all business projects
 * POST /api/data/business-projects — create a new business project
 *
 * Storage: Supabase "business_projects" table with FLAT columns.
 * Expected schema:
 *   id, project_name, client_id, project_type, description,
 *   agreement_signed, project_status, start_date, end_date,
 *   assigned_manager_id, created_at, updated_at
 *
 * Unknown columns are auto-dropped and the request is retried, so partial
 * schemas still succeed. The id returned by POST is the id that the GET
 * route (and the detail page) will find.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

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
    projectStatus: (r.project_status as string) ?? 'not_started',
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
  'id, project_name, client_id, project_type, description, agreement_signed, project_status, start_date, end_date, assigned_manager_id, created_at, updated_at';

function parseBadColumn(msg: string): string | null {
  const m = msg.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
  return m?.[1] || m?.[2] || null;
}

export async function GET() {
  try {
    const sb = getSupabase();
    const { data: rows, error } = await sb.from(TABLE).select('*').order('id');
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

export async function POST(req: NextRequest) {
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
          ? `Run: CREATE TABLE IF NOT EXISTS ${TABLE} ( id TEXT PRIMARY KEY, project_name TEXT, client_id TEXT, project_type TEXT, description TEXT, agreement_signed BOOLEAN, project_status TEXT, start_date DATE, end_date DATE, assigned_manager_id TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ );`
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

    // Auto-generate milestones from templates matching service_type.
    const verifyRow = verify as Row;
    const svc = (verifyRow.service_type as string) || (verifyRow.project_type as string) || null;
    const seed = await seedMilestonesFromTemplates(sb, id, svc, now);

    console.log(
      `[API] POST /api/data/business-projects ✅ persisted id=${id} service=${svc} templates=${seed.templatesFound} milestones=${seed.inserted}${seed.error ? ` error="${seed.error}"` : ''}`
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
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/business-projects fatal:', msg);
    return NextResponse.json({ error: `Failed to create business project: ${msg}` }, { status: 500 });
  }
}
