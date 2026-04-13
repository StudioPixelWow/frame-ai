import { NextRequest, NextResponse } from 'next/server';
import { businessProjects } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }<{ id: string }> }) {
  ensureSeeded();
  try {
    const { id } = params;
    const item = businessProjects.getById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }<{ id: string }> }) {
  ensureSeeded();
  try {
    const { id } = params;
    const body = await req.json();
    const updated = businessProjects.update(id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }<{ id: string }> }) {
  ensureSeeded();
  try {
    const { id } = params;
    const deleted = businessProjects.delete(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
