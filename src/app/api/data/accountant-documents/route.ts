import { NextRequest, NextResponse } from 'next/server';
import { accountantDocuments } from '@/lib/db';

export async function GET() {
  try {
    console.log('[accountant-documents] GET — fetching all from Supabase...');
    const docs = await accountantDocuments.getAllAsync();
    console.log(`[accountant-documents] GET — returned ${docs.length} documents`);
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
    console.log('[accountant-documents] POST — payload:', JSON.stringify(body).slice(0, 500));

    // Validate required fields for month association
    if (!body.period || !body.year) {
      console.warn('[accountant-documents] POST — missing period or year, adding defaults');
      if (!body.period) body.period = 'jan-feb';
      if (!body.year) body.year = new Date().getFullYear();
    }

    const created = await accountantDocuments.createAsync(body);
    console.log('[accountant-documents] POST — created:', created.id, 'period:', created.period, 'year:', created.year);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[accountant-documents] POST error:', msg);
    return NextResponse.json({ error: `Failed to create: ${msg}` }, { status: 400 });
  }
}
