/**
 * GET /api/data/client-email-logs/[id] - Get a single client email log
 * PUT /api/data/client-email-logs/[id] - Update a client email log
 * DELETE /api/data/client-email-logs/[id] - Delete a client email log
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientEmailLogs } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const clientEmailLog = clientEmailLogs.getById(params.id);
    if (!clientEmailLog) {
      return NextResponse.json({ error: 'Client email log not found' }, { status: 404 });
    }
    return NextResponse.json(clientEmailLog);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch client email log' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const body = await req.json();
    const updated = clientEmailLogs.update(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Client email log not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update client email log' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const deleted = clientEmailLogs.delete(params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Client email log not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete client email log' },
      { status: 500 }
    );
  }
}
