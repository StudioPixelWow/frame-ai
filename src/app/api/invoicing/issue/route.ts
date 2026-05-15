import { NextRequest, NextResponse } from 'next/server';
import { invoices } from '@/lib/db';
import {
  createDocument,
  checkConnection,
  type CreateDocumentParams,
  type GreenInvoiceDocType,
  PaymentType,
} from '@/lib/invoicing/green-invoice-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/invoicing/issue — Issue invoice via Green Invoice API
 * Takes an internal invoice ID, sends it to Green Invoice, and updates the record
 */
export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
    }

    // Check Green Invoice connection
    const conn = await checkConnection();
    if (!conn.connected) {
      return NextResponse.json({
        error: 'Green Invoice not connected',
        details: conn.error,
        setupRequired: true,
      }, { status: 503 });
    }

    // Load invoice
    const all = await invoices.getAllAsync();
    const invoice = all.find((inv: any) => inv.id === invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if ((invoice as any).greenInvoiceDocId) {
      return NextResponse.json({ error: 'Invoice already issued', greenInvoiceDocId: (invoice as any).greenInvoiceDocId }, { status: 409 });
    }

    // Map payment method
    const paymentTypeMap: Record<string, PaymentType> = {
      cash: PaymentType.CASH,
      cheque: PaymentType.CHEQUE,
      bank_transfer: PaymentType.BANK_TRANSFER,
      credit_card: PaymentType.CREDIT_CARD,
      bit: PaymentType.BIT,
      paybox: PaymentType.PAYBOX,
      other: PaymentType.OTHER,
    };

    // Build Green Invoice params
    const params: CreateDocumentParams = {
      type: (invoice as any).docType as GreenInvoiceDocType,
      client: {
        name: (invoice as any).clientName,
      },
      items: ((invoice as any).items || []).map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        vatType: item.vatType ?? 1,
      })),
      description: (invoice as any).description || '',
      remarks: (invoice as any).remarks || '',
      currency: (invoice as any).currency || 'ILS',
      dueDate: (invoice as any).dueDate ? new Date((invoice as any).dueDate) : undefined,
    };

    // Add payment for receipt types (210, 300)
    const docType = (invoice as any).docType;
    if ((docType === 210 || docType === 300) && (invoice as any).paymentMethod) {
      const pType = paymentTypeMap[(invoice as any).paymentMethod] || PaymentType.OTHER;
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      params.payment = [{
        type: pType,
        date: `${day}/${month}/${now.getFullYear()}`,
        price: (invoice as any).total,
      }];
    }

    // Issue via Green Invoice API
    const doc = await createDocument(params);

    // Update internal invoice with Green Invoice data
    await invoices.updateAsync(invoiceId, {
      greenInvoiceDocId: doc.id,
      greenInvoiceNumber: doc.number,
      greenInvoicePdfUrl: doc.url,
      status: docType === 210 || docType === 300 ? 'paid' : 'issued',
      paidAt: docType === 210 || docType === 300 ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    } as any);

    return NextResponse.json({
      success: true,
      greenInvoiceDocId: doc.id,
      documentNumber: doc.number,
      pdfUrl: doc.url,
      total: doc.total,
    });
  } catch (error) {
    console.error('[INVOICING] Issue error:', error);
    return NextResponse.json({
      error: 'Failed to issue invoice',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
