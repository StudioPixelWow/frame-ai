/**
 * GET /api/data/meetings - Get all meetings
 * POST /api/data/meetings - Create a new meeting
 */

import { NextRequest, NextResponse } from 'next/server';
import { meetings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { getRequestRole, getRequestEmployeeId } from '@/lib/auth/api-guard';
import { getSupabase } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  ensureSeeded();
  try {
    const all = await meetings.getAllAsync();
    // Privacy: an employee sees only meetings they own OR that belong to one of
    // their assigned clients. Admin/manager see everything.
    const role = getRequestRole(req);
    if (role === 'employee') {
      const employeeId = getRequestEmployeeId(req);
      let myClientIds = new Set<string>();
      try {
        const sb = getSupabase();
        const { data } = await sb.from('clients').select('id').eq('assigned_manager_id', employeeId);
        myClientIds = new Set((data || []).map((c: any) => c.id));
      } catch { /* fall through — owner check still applies */ }
      const mine = (all as any[]).filter(
        (m) => m.ownerEmployeeId === employeeId || (m.clientId && myClientIds.has(m.clientId)),
      );
      return NextResponse.json(mine);
    }
    return NextResponse.json(all);
  } catch (error) {
    // Return empty array on transient errors — polling will retry
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    // Stamp the creator so the calendar can stay private per-user.
    const employeeId = getRequestEmployeeId(req);
    if (employeeId && !body.ownerEmployeeId) body.ownerEmployeeId = employeeId;
    const created = await meetings.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 400 }
    );
  }
}
