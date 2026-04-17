/**
 * GET    /api/data/business-projects/[id] — get one business project
 * PUT    /api/data/business-projects/[id] — partial update
 * DELETE /api/data/business-projects/[id] — delete one business project
 *
 * Storage: Supabase "business_projects" table (same as list route).
 * The id that the POST route returned is the id this route looks up here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { requireRole, getRequestRole, getRequestClientId, getRequestEmployeeId } from '@/lib/auth/api-guard';
import { insertTimelineEvent } from '@/lib/timeline';
import { ensureBusinessProjectColumns } from '@/lib/db/ensure-columns';

const TABLE = 'business_projects';

type Row = Record<string, unknown> & { id: string };

function rowToProject(r: Row) {
  const serviceType = (r.service_type as string) || (r.project_type as string) || '';
  return {
    id: r.id,
    projectName: (r.project_name as string) ?? '',
    clientId: (r.client_id as string) ?? '',
    projectType: serviceType,
    serviceType,
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

function nullIfEmpty(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
}

// Columns that are foreign keys / nullable strings: must coerce '' → null.
const NULLABLE_STRING_COLS = new Set([
  'client_id',
  'assigned_manager_id',
  'start_date',
  'end_date',
  'project_type',
  'contract_signed_at',
]);

function toUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // Handle service_type / project_type from either key, write to both for tolerance.
  const svc = body.serviceType !== undefined ? body.serviceType : body.projectType;
  if (svc !== undefined) {
    out.service_type = nullIfEmpty(svc);
    out.project_type = nullIfEmpty(svc);
  }
  const map: Array<[string, string]> = [
    ['projectName', 'project_name'],
    ['name', 'project_name'],
    ['clientId', 'client_id'],
    ['description', 'description'],
    ['agreementSigned', 'agreement_signed'],
    ['contractSigned', 'contract_signed'],
    ['contractSignedAt', 'contract_signed_at'],
    ['projectStatus', 'project_status'],
    ['status', 'project_status'],
    ['startDate', 'start_date'],
    ['endDate', 'end_date'],
    ['assignedManagerId', 'assigned_manager_id'],
    ['progress', 'progress'],
    ['budget', 'budget'],
  ];
  for (const [k, dbKey] of map) {
    if (body[k] !== undefined) {
      out[dbKey] = NULLABLE_STRING_COLS.has(dbKey) ? nullIfEmpty(body[k]) : body[k];
    }
  }
  out.updated_at = new Date().toISOString();
  return out;
}

const SELECT_COLUMNS =
  'id, project_name, client_id, project_type, description, agreement_signed, project_status, start_date, end_date, assigned_manager_id, budget, progress, created_at, updated_at';

function parseBadColumn(msg: string): string | null {
  const m = msg.match(/column .*?\.?['"]?([a-z_]+)['"]? (?:does not exist|of .* does not exist)|Could not find the '([^']+)' column/i);
  return m?.[1] || m?.[2] || null;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await ensureBusinessProjectColumns();
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found', projectId: id }, { status: 404 });

    // Clients can only view their own projects
    const role = getRequestRole(req);
    if (role === 'client') {
      const clientId = getRequestClientId(req);
      if ((data as any).client_id !== clientId) {
        return NextResponse.json({ error: 'אין גישה לפרויקט זה' }, { status: 403 });
      }
    }

    // Employees can only view projects assigned to them
    if (role === 'employee') {
      const employeeId = getRequestEmployeeId(req);
      if (employeeId && (data as any).assigned_manager_id !== employeeId) {
        return NextResponse.json({ error: 'אין גישה לפרויקט זה' }, { status: 403 });
      }
    }

    return NextResponse.json(rowToProject(data as Row));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] GET /api/data/business-projects/[id] error:', msg);
    return NextResponse.json({ error: `Failed to fetch: ${msg}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Only admin and employee can update projects
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

  await ensureBusinessProjectColumns();
  try {
    const { id } = await context.params;
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { /* noop */ }

    const sb = getSupabase();
    let updateRow = toUpdate(body);
    let selectList = SELECT_COLUMNS;

    let updated: Row | null = null;
    let lastErr: { message: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const { data, error } = await sb.from(TABLE).update(updateRow).eq('id', id).select('*').maybeSingle();
      if (!error) { updated = (data as Row) ?? null; break; }
      lastErr = error as any;
      const bad = parseBadColumn(error.message);
      if (!bad) break;
      if (bad in updateRow) {
        const { [bad]: _d, ...rest } = updateRow;
        void _d;
        updateRow = rest;
      } else if (selectList.includes(bad)) {
        selectList = selectList.split(',').map((s) => s.trim()).filter((c) => c !== bad).join(', ');
      } else {
        break;
      }
    }

    if (lastErr && !updated) {
      console.error('[API] PUT /api/data/business-projects/[id] supabase error:', lastErr);
      return NextResponse.json({ error: lastErr.message, code: (lastErr as any).code ?? null }, { status: 400 });
    }
    if (!updated) return NextResponse.json({ error: 'Not found', projectId: id }, { status: 404 });

    // ── Timeline events (fire-and-forget) ──
    if (body.contractSigned !== undefined) {
      const signed = body.contractSigned as boolean;
      insertTimelineEvent(id, 'project_edited', signed ? 'חוזה סומן כחתום' : 'חוזה סומן כלא חתום');
    }
    if (body.projectStatus !== undefined) {
      const statusLabels: Record<string, string> = {
        not_started: 'לא התחיל', in_progress: 'בתהליך', awaiting_approval: 'ממתין לאישור',
        waiting_for_client: 'בהמתנה ללקוח', completed: 'הושלם',
      };
      const label = statusLabels[body.projectStatus as string] || (body.projectStatus as string);
      insertTimelineEvent(id, 'project_edited', `סטטוס פרויקט שונה ל: ${label}`);
    }
    if (body.projectName !== undefined || body.description !== undefined || body.serviceType !== undefined || body.budget !== undefined) {
      const changes: string[] = [];
      if (body.projectName !== undefined) changes.push('שם');
      if (body.description !== undefined) changes.push('תיאור');
      if (body.serviceType !== undefined) changes.push('סוג');
      if (body.budget !== undefined) changes.push(`תקציב: ₪${Number(body.budget).toLocaleString('he-IL')}`);
      if (changes.length > 0 && body.projectStatus === undefined && body.contractSigned === undefined) {
        insertTimelineEvent(id, 'project_edited', `פרויקט עודכן: ${changes.join(', ')}`);
      }
    }

    // ── Mark final payment as due when project reaches submission ──
    const newStatus = body.projectStatus as string | undefined;
    if (newStatus === 'awaiting_approval' || newStatus === 'completed') {
      try {
        const { error: payErr } = await sb
          .from('business_project_payments')
          .update({ is_due: true, updated_at: new Date().toISOString() })
          .eq('business_project_id', id)
          .eq('payment_type', 'final')
          .eq('is_due', false);
        if (payErr) {
          console.warn(`[API] PUT /api/data/business-projects/[id] failed to mark final payment due:`, payErr.message);
        } else {
          console.log(`[API] PUT /api/data/business-projects/[id] ✅ final payment marked as due for project=${id}`);
          insertTimelineEvent(id, 'payment_created', 'תשלום סופי סומן כמגיע לתשלום');
        }
      } catch (e) {
        console.warn('[API] PUT final-payment-due error:', e);
      }
    }

    return NextResponse.json(rowToProject(updated));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] PUT /api/data/business-projects/[id] error:', msg);
    return NextResponse.json({ error: `Failed to update: ${msg}` }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  // Only admin can delete projects
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { error } = await sb.from(TABLE).delete().eq('id', id);
    if (error) {
      console.error('[API] DELETE /api/data/business-projects/[id] supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] DELETE /api/data/business-projects/[id] error:', msg);
    return NextResponse.json({ error: `Failed to delete: ${msg}` }, { status: 500 });
  }
}
