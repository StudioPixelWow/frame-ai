import { NextRequest, NextResponse } from 'next/server';
import { invoices } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/invoicing/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const all = await invoices.getAllAsync();
    const invoice = all.find((inv: any) => inv.id === id);
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 });
  }
}

// PUT /api/invoicing/[id] — Update invoice
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await invoices.updateAsync(id, {
      ...body,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

// DELETE /api/invoicing/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await invoices.deleteAsync(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
