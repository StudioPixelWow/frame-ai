/**
 * GET  /api/data/client-notifications — List notifications for client
 * POST /api/data/client-notifications — Create notification (admin/employee only)
 * PATCH /api/data/client-notifications — Mark notification(s) as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientNotifications } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get('x-app-role') || req.headers.get('x-user-role') || 'viewer';
    const headerClientId = req.headers.get('x-app-client-id') || req.headers.get('x-client-id');

    const all = await clientNotifications.getAllAsync();

    // Client scoping — clients only see their own notifications
    if (role === 'client' && headerClientId) {
      const scoped = all.filter(n => n.clientId === headerClientId);
      return NextResponse.json(scoped);
    }

    // Admin/employee — filter by query param if provided
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId');
    if (clientId) {
      return NextResponse.json(all.filter(n => n.clientId === clientId));
    }

    return NextResponse.json(all);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-app-role') || req.headers.get('x-user-role') || 'viewer';
    if (role === 'client') {
      return NextResponse.json({ error: 'לקוחות לא יכולים ליצור התראות' }, { status: 403 });
    }

    const body = await req.json();
    const notification = await clientNotifications.createAsync({
      ...body,
      read: false,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, read } = body as { ids: string[]; read: boolean };

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    const results = await Promise.all(
      ids.map(id => clientNotifications.updateAsync(id, { read }))
    );

    return NextResponse.json({ updated: results.filter(Boolean).length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
