import { NextRequest, NextResponse } from 'next/server';
import { accountantDocuments } from '@/lib/db';

export async function GET() {
  try {
    const docs = accountantDocuments.getAll();
    return NextResponse.json(docs);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[accountant-documents] GET error:', msg);
    return NextResponse.json({ error: `Failed to fetch: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const created = accountantDocuments.create(body);
    console.log('[accountant-documents] Created:', created.id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[accountant-documents] POST error:', msg);
    return NextResponse.json({ error: `Failed to create: ${msg}` }, { status: 400 });
  }
}
