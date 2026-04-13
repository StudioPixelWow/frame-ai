/**
 * GET /api/data/client-files/[id] - Get a single client file
 * PUT /api/data/client-files/[id] - Update a client file
 * DELETE /api/data/client-files/[id] - Delete a client file
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientFiles } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const clientFile = clientFiles.getById(params.id);
    if (!clientFile) {
      return NextResponse.json({ error: 'Client file not found' }, { status: 404 });
    }
    return NextResponse.json(clientFile);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch client file' },
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
    const updated = clientFiles.update(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Client file not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update client file' },
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
    const deleted = clientFiles.delete(params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Client file not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete client file' },
      { status: 500 }
    );
  }
}
