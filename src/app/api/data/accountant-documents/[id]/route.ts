import { NextRequest, NextResponse } from 'next/server';
import { accountantDocuments } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  ensureSeeded();
  try {
    const item = accountantDocuments.getById(params.id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  ensureSeeded();
  try {
    const body = await req.json();
    const updated = accountantDocuments.update(params.id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  ensureSeeded();
  try {
    const deleted = accountantDocuments.delete(params.id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
