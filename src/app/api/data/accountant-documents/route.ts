/**
 * GET /api/data/accountant-documents — fetch all files where category='accountant'
 * POST /api/data/accountant-documents — create a new accountant file in app_client_files
 *
 * Backed by the REAL app_client_files table (SupabaseCrud), filtered by category='accountant'.
 * No phantom table — uses the same persistent table as all other client files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientFiles } from '@/lib/db';

export async function GET() {
  try {
    console.log('[accountant-documents] GET — querying app_client_files where category=accountant');
    const all = await clientFiles.getAllAsync();
    const docs = all.filter((f: any) => f.category === 'accountant');
    console.log(`[accountant-documents] GET — total files: ${all.length}, accountant docs: ${docs.length}`);
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

    // Force category to 'accountant' regardless of what was sent
    body.category = 'accountant';

    // Ensure required fields have sensible defaults
    const now = new Date().toISOString();
    if (!body.createdAt) body.createdAt = now;
    if (!body.updatedAt) body.updatedAt = now;
    if (!body.fileType) body.fileType = 'document';

    // Map documentType → fileType for ClientFile compatibility
    // ClientFile.fileType: 'video' | 'image' | 'document' | 'pdf' | 'draft' | 'other'
    // We store the accounting sub-type (invoice/receipt/report/tax) in a 'documentType' field
    // and set ClientFile.fileType to 'document' or 'pdf' based on extension
    if (body.fileName) {
      const ext = body.fileName.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') body.fileType = 'pdf';
      else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) body.fileType = 'image';
      else body.fileType = 'document';
    }

    const created = await clientFiles.createAsync(body);
    console.log('[accountant-documents] POST — created in app_client_files:', created.id,
      'category:', (created as any).category,
      'period:', (created as any).period,
      'year:', (created as any).year);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[accountant-documents] POST error:', msg);
    return NextResponse.json({ error: `Failed to create: ${msg}` }, { status: 400 });
  }
}
