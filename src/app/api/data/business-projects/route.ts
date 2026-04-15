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

/** Fetch template rows matching service_type, insert milestones for the project.
 *  Never throws — any failure is logged and the create still succeeds. */
async function seedMilestonesFromTemplates(
  sb: ReturnType<typeof getSupabase>,
  projectId: string,
  serviceType: string | null,
  now: string
): Promise<number> {
  if (!serviceType) return 0;
  try {
    const { data: templates, error: tErr } = await sb
      .from(TEMPLATES_TABLE)
      .select('*')
      .eq('service_type', serviceType);
    if (tErr) {
      console.warn('[seedMilestones] templates read error:', tErr.message);
      return 0;
    }
    const tmpls = Array.isArray(templates) ? templates : [];
    if (tmpls.length === 0) return 0;

    // Sort by order_index / position / sort_order if present
    tmpls.sort((a: any, b: any) => {
      const ao = a?.order_index ?? a?.position ?? a?.sort_order ?? 0;
      const bo = b?.order_index ?? b?.position ?? b?.sort_order ?? 0;
      return Number(ao) - Number(bo);
    });

    const rows = tmpls.map((t: any, i: number) => ({
      id: milestoneId(i),
      project_id: projectId,
      title: t?.title ?? t?.name ?? `שלב ${i + 1}`,
      description: t?.description ?? '',
      due_date: null,
      assigned_employee_id: null,
      status: 'pending',
      files: [],
      notes: '',
      created_at: now,
      updated_at: now,
    }));

    // Drop-unknown-column retry loop so we're schema-tolerant.
    let insertRows: Record<string, unknown>[] = rows;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { error } = await sb.from(MILESTONES_TABLE).insert(insertRows);
      if (!error) {
        console.log(`[seedMilestones] ✅ inserted ${insertRows.length} milestones for project=${projectId} service=${serviceType}`);
        return insertRows.length;
      }
      const m = error.message.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
      const bad = m?.[1] || m?.[2];
      if (!bad) {
        console.warn('[seedMilestones] insert error:', error.message);
        return 0;
      }
      console.warn(`[seedMilestones] dropping unknown milestone column "${bad}"`);
      insertRows = insertRows.map((row) => {
        const { [bad]: _d, ...rest } = row;
        void _d;
        return rest;
      });
    }
    return 0;
  } catch (e) {
    console.warn('[seedMilestones] unexpected error:', e instanceof Error ? e.message : e);
    return 0;
  }
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
    const seeded = await seedMilestonesFromTemplates(sb, id, svc, now);

    console.log(`[API] POST /api/data/business-projects ✅ persisted id=${id} milestones=${seeded}`);
    return NextResponse.json(rowToProject(verifyRow), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] POST /api/data/business-projects fatal:', msg);
    return NextResponse.json({ error: `Failed to create business project: ${msg}` }, { status: 500 });
  }
}
