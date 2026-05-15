/**
 * GET  /api/receipts — List all receipts (with optional filters)
 * POST /api/receipts — Upload and scan a receipt image
 */

import { NextRequest, NextResponse } from 'next/server';
import { scannedReceipts } from '@/lib/db';
import { scanReceipt } from '@/lib/receipts/receipt-scanner';
import type { ScannedReceipt } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/* ── GET — List / filter receipts ───────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const month = searchParams.get('month');    // 1-12
    const year = searchParams.get('year');       // e.g. 2026

    let all = await scannedReceipts.getAllAsync();

    if (status) {
      all = all.filter((r: ScannedReceipt) => r.status === status);
    }
    if (category) {
      all = all.filter((r: ScannedReceipt) => r.category === category);
    }
    if (month) {
      const m = parseInt(month, 10);
      all = all.filter((r: ScannedReceipt) => r.fiscalMonth === m);
    }
    if (year) {
      const y = parseInt(year, 10);
      all = all.filter((r: ScannedReceipt) => r.fiscalYear === y);
    }

    // Sort newest first
    all.sort(
      (a: ScannedReceipt, b: ScannedReceipt) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(all);
  } catch (error) {
    console.error('[RECEIPTS] GET error:', error);
    return NextResponse.json({ error: 'Failed to load receipts' }, { status: 500 });
  }
}

/* ── POST — Scan a receipt image and save ───────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: imageUrl (Supabase storage URL)' },
        { status: 400 }
      );
    }

    // Run OCR + classification
    const scanResult = await scanReceipt(imageUrl);

    if (!scanResult.success) {
      return NextResponse.json(
        { error: scanResult.error },
        { status: 422 }
      );
    }

    const { data } = scanResult;

    // Persist to Supabase
    const receipt = await scannedReceipts.createAsync({
      vendorName: data.vendorName,
      vendorTaxId: data.vendorTaxId,
      receiptDate: data.receiptDate,
      receiptNumber: data.receiptNumber,
      subtotal: data.subtotal,
      vatAmount: data.vatAmount,
      total: data.total,
      currency: data.currency,
      category: data.category,
      categoryConfidence: data.categoryConfidence,
      isDeductible: data.isDeductible,
      deductionPercentage: data.deductionPercentage,
      imageUrl,
      ocrText: data.ocrText,
      status: 'pending_review',
      notes: '',
      approvedBy: null,
      fiscalMonth: data.fiscalMonth,
      fiscalYear: data.fiscalYear,
      linkedInvoiceId: null,
    } as Omit<ScannedReceipt, 'id'>);

    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    console.error('[RECEIPTS] POST error:', error);
    return NextResponse.json({ error: 'Failed to scan receipt' }, { status: 500 });
  }
}

/* ── PUT — Update receipt status (approve/reject) ───────────────────────── */

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, approvedBy } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: id, status' },
        { status: 400 }
      );
    }

    const validStatuses: string[] = ['pending_review', 'approved', 'rejected', 'sent_to_accountant'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await scannedReceipts.updateAsync(id, {
      status,
      approvedBy: approvedBy ?? null,
    } as Partial<ScannedReceipt>);

    if (!updated) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[RECEIPTS] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update receipt' }, { status: 500 });
  }
}
