import { NextRequest, NextResponse } from 'next/server';
import { invoices } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/invoicing — List all invoices
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const docType = searchParams.get('docType');

    let all = await invoices.getAllAsync();

    if (clientId) all = all.filter((inv: any) => inv.clientId === clientId);
    if (status) all = all.filter((inv: any) => inv.status === status);
    if (docType) all = all.filter((inv: any) => String(inv.docType) === docType);

    // Sort by date descending
    all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(all);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 });
  }
}

// POST /api/invoicing — Create a new invoice
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { clientId, clientName, docType, items, description, remarks, currency, dueDate, paymentMethod } = body;

    if (!clientId || !clientName || !docType || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields: clientId, clientName, docType, items' }, { status: 400 });
    }

    const VAT_RATE = 0.18;
    const subtotal = items.reduce((sum: number, item: any) =>
      sum + (item.unitPrice * item.quantity), 0);
    const vatAmount = items.reduce((sum: number, item: any) =>
      sum + (item.vatType === 1 ? item.unitPrice * item.quantity * VAT_RATE : 0), 0);
    const total = subtotal + vatAmount;

    const invoice = await invoices.createAsync({
      clientId,
      clientName,
      greenInvoiceDocId: null,
      greenInvoiceNumber: null,
      greenInvoicePdfUrl: null,
      docType,
      status: 'draft',
      description: description || '',
      remarks: remarks || '',
      currency: currency || 'ILS',
      subtotal: Math.round(subtotal * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      vatRate: VAT_RATE,
      items: items.map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatType: item.vatType ?? 1,
        total: Math.round(item.unitPrice * item.quantity * (item.vatType === 1 ? 1 + VAT_RATE : 1) * 100) / 100,
      })),
      paymentMethod: paymentMethod || null,
      paidAt: null,
      dueDate: dueDate || null,
      isRecurring: body.isRecurring || false,
      recurringFrequency: body.recurringFrequency || null,
      linkedPaymentId: body.linkedPaymentId || null,
      linkedPodcastSessionId: body.linkedPodcastSessionId || null,
    } as any);

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('[INVOICING] Create error:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
