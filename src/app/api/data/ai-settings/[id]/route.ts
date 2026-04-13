import { NextRequest, NextResponse } from 'next/server';
import { aiSettings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();

  try {
    const { id } = params;
    const setting = aiSettings.getById(id);

    if (!setting) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(setting);
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();

  try {
    const { id } = params;
    const body = await req.json();
    const updated = aiSettings.update(id, body);

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();

  try {
    const { id } = params;
    const deleted = aiSettings.delete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 400 });
  }
}