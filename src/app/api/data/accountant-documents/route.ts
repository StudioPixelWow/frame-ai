import { NextRequest, NextResponse } from 'next/server';
import { accountantDocuments } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    const docs = await accountantDocuments.getAllAsync();
    return NextResponse.json(docs);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[accountant-documents] GET error:', msg);
    return NextResponse.json({ error: `Failed to fetch: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await accountantDocuments.createAsync(body);
    console.log('[accountant-documents] Created:', created.id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[accountant-documents] POST error:', msg);
    return NextResponse.json({ error: `Failed to create: ${msg}` }, { status: 400 });
  }
}
