/**
 * GET /api/portal/my-tasks?clientId=…
 *
 * Returns the tasks a client submitted via the portal. Reads from the
 * employee-tasks JSONB store (which always persists, regardless of the flat
 * `tasks` table's columns) and returns ONLY portal-submitted requests
 * (tagged 'בקשת לקוח' / portal marker) for this client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { employeeTasks } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  ensureSeeded();
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ tasks: [] });
  try {
    const all = (await employeeTasks.getAllAsync()) as any[];
    const tasks = all
      .filter((t) => t.clientId === clientId && (
        (Array.isArray(t.tags) && t.tags.includes('בקשת לקוח')) ||
        String(t.notes || '').includes('מהלקוח דרך הפורטל')
      ))
      .map((t) => ({
        id: t.id, title: t.title, description: t.description || '',
        status: t.status || 'new', dueDate: t.dueDate || null,
        createdAt: t.createdAt || null, files: t.files || [], submittedFiles: t.submittedFiles || [],
        tags: t.tags || [],
      }))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return NextResponse.json({ tasks });
  } catch (e) {
    return NextResponse.json({ tasks: [], error: e instanceof Error ? e.message : 'failed' });
  }
}
