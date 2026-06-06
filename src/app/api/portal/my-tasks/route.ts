/**
 * GET /api/portal/my-tasks?clientId=…
 *
 * Returns the tasks a client submitted via the portal, with their status and
 * (when finished) the approved deliverable for preview.
 *
 * A portal request is persisted in TWO places that are linked only by
 * title+clientId (they do NOT share an id):
 *   • the employee-tasks JSONB store (what the responsible employee works on)
 *   • the flat `tasks` table (what the manager board / approvals read)
 * The employee uploads the deliverable on one side, the manager approves on the
 * other — so we MERGE both records here. That way the client always sees the
 * approved file regardless of which side it was attached to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { employeeTasks } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

// Status rank — higher = further along. Used to pick the most-advanced status
// across the two stores so a completed task never shows as "new".
const RANK: Record<string, number> = {
  new: 0, pending: 0, in_progress: 1, under_review: 2,
  returned: 1, approved: 3, completed: 4,
};
const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '_');

export async function GET(req: NextRequest) {
  ensureSeeded();
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ tasks: [] });
  try {
    // ── Employee-task mirrors (portal-submitted only) ──
    const all = (await employeeTasks.getAllAsync()) as any[];
    const portal = all.filter((t) => t.clientId === clientId && (
      (Array.isArray(t.tags) && t.tags.includes('בקשת לקוח')) ||
      String(t.notes || '').includes('מהלקוח דרך הפורטל')
    ));

    // ── Matching global `tasks` rows for this client (source of truth for the
    //    manager board + approvals; may hold the approved deliverable) ──
    let globalRows: any[] = [];
    try {
      const sb = getSupabase();
      const { data } = await sb.from('tasks').select('*').eq('client_id', clientId);
      globalRows = Array.isArray(data) ? data : [];
    } catch { /* best-effort — fall back to employee store only */ }
    const globalByTitle = new Map<string, any>();
    for (const g of globalRows) {
      const key = String(g.title || '').trim();
      // Prefer the most recently updated row per title.
      const prev = globalByTitle.get(key);
      if (!prev || new Date(g.updated_at || 0) > new Date(prev.updated_at || 0)) globalByTitle.set(key, g);
    }

    const splitFiles = (files: string[]) => {
      const adapted = files.filter((f) => f.startsWith('🎨'));
      const refs = files.filter((f) => !f.startsWith('🎨'));
      return { adapted, refs };
    };

    const tasks = portal.map((t) => {
      const g = globalByTitle.get(String(t.title || '').trim());

      // Collect every file from both stores.
      const empFiles: string[] = Array.isArray(t.files) ? t.files : [];
      const empSubmitted: string[] = Array.isArray(t.submittedFiles) ? t.submittedFiles : [];
      const gFiles: string[] = g && Array.isArray(g.files) ? g.files : [];
      const gSubmitted: string[] = g && Array.isArray(g.submitted_files) ? g.submitted_files : [];

      const empSplit = splitFiles(empFiles);
      const gSplit = splitFiles(gFiles);

      // Deliverable = everything the team produced/approved: explicit submissions
      // (both stores) + any 🎨-adapted outputs.
      const deliverableSet = new Map<string, string>();
      for (const f of [...empSubmitted, ...gSubmitted, ...empSplit.adapted, ...gSplit.adapted]) {
        if (f) deliverableSet.set(f, f);
      }
      // Reference = the client's helper files (non-🎨) from both stores.
      const referenceSet = new Map<string, string>();
      for (const f of [...empSplit.refs, ...gSplit.refs]) {
        if (f) referenceSet.set(f, f);
      }

      // Most-advanced status across both stores.
      const empStatus = norm(t.status || 'new');
      const gStatus = g ? norm(g.status || '') : '';
      const status = (RANK[gStatus] ?? -1) > (RANK[empStatus] ?? 0) ? gStatus : empStatus;

      return {
        id: t.id,
        title: t.title,
        description: t.description || (g && g.description) || '',
        status: status || 'new',
        dueDate: t.dueDate || (g && g.due_date) || null,
        createdAt: t.createdAt || (g && g.created_at) || null,
        completedAt: (status === 'completed' || status === 'approved') ? ((g && g.updated_at) || t.updatedAt || null) : null,
        referenceFiles: [...referenceSet.values()],
        deliverableFiles: [...deliverableSet.values()],
        tags: t.tags || [],
      };
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return NextResponse.json({ tasks });
  } catch (e) {
    return NextResponse.json({ tasks: [], error: e instanceof Error ? e.message : 'failed' });
  }
}
