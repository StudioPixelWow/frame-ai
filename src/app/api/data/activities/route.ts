/**
 * GET /api/data/activities - Get all activities
 * POST /api/data/activities - Create a new activity log entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { activities } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { getRequestRole, getRequestClientId } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  ensureSeeded();
  try {
    const all = activities.getAll();
    const role = getRequestRole(req);
    if (role === 'client') {
      const clientId = getRequestClientId(req);
      if (!clientId) return NextResponse.json([]);
      // For clients: only return activities that belong to this client
      // Activities can link to a client via entityId (when type=client) or clientId field
      const filtered = all.filter((a: any) =>
        a.clientId === clientId || (a.type === 'client' && a.entityId === clientId)
      );
      return NextResponse.json(filtered);
    }
    return NextResponse.json(all);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = activities.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 400 }
    );
  }
}
