/**
 * GET  /api/data/milestone-files          — list files (filter via ?milestone_id=)
 * POST /api/data/milestone-files          — upload file to Supabase Storage + insert metadata row
 *
 * Storage:
 *   - File bytes → Supabase Storage bucket "milestone-files"
 *   - Metadata   → public.business_project_milestone_files
 *
 * Table columns: id, milestone_id, file_name, file_url, file_size, content_type,
 *                created_at, updated_at
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'business_project_milestone_files';
const BUCKET = 'milestone-files';

type Row = Record<string, unknown> & { id: string };

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `mf_${ts}_${rand}`;
}

function rowToFile(r: Row) {
  return {
    id: r.id,
    milestoneId: (r.milestone_id as string) ?? '',
    fileName: (r.file_name as string) ?? '',
    fileUrl: (r.file_url as string) ?? '',
    fileSize: (r.file_size as number) ?? 0,
    contentType: (r.content_type as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  };
}

/**
 * Ensure the storage bucket exists. Supabase returns an error if
 * the bucket already exists — we simply ignore that.
 */
async function ensureBucket(sb: ReturnType<typeof getSupabase>) {
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024, // 50 MB
  });
  if (error && !error.message?.includes('already exists')) {
    console.warn('[milestone-files] bucket creation warning:', error.message);
  }
}

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase();
    const url = new URL(req.url);
    const milestoneId = url.searchParams.get('milestone_id') || url.searchParams.get('milestoneId');

    let q = sb.from(TABLE).select('*').order('created_at', { ascending: false });
    if (milestoneId) q = q.eq('milestone_id', milestoneId);

    const { data: rows, error } = await q;
    if (error) {
      console.error('[API] GET /api/data/milestone-files error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json((rows ?? []).map((r) => rowToFile(r as Row)));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabase();
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const milestoneId = formData.get('milestoneId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!milestoneId) {
      return NextResponse.json({ error: 'milestoneId is required' }, { status: 400 });
    }

    // 1. Ensure storage bucket exists.
    await ensureBucket(sb);

    // 2. Upload file bytes to Supabase Storage.
    const fileId = generateId();
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
    const storagePath = `${milestoneId}/${fileId}${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadErr) {
      console.error('[milestone-files] storage upload error:', uploadErr);
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
    }

    // 3. Get the public URL.
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl ?? '';

    // 4. Insert metadata row into the DB table.
    const now = new Date().toISOString();
    const insertRow: Record<string, unknown> = {
      id: fileId,
      milestone_id: milestoneId,
      file_name: file.name,
      file_url: publicUrl,
      file_size: buffer.length,
      content_type: file.type || 'application/octet-stream',
      created_at: now,
      updated_at: now,
    };

    // Retry loop: auto-drop unknown columns.
    let inserted: Row | null = null;
    let lastErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await sb.from(TABLE).insert(insertRow).select('*').single();
      if (!error) { inserted = data as Row; break; }
      lastErr = error;
      const m = error.message.match(/column .*?['"]?([a-z_]+)['"]? (?:does not exist)/i);
      const bad = m?.[1];
      if (bad && bad in insertRow) {
        console.warn(`[milestone-files] dropping unknown column "${bad}"`);
        delete insertRow[bad];
      } else {
        break;
      }
    }

    if (!inserted) {
      console.error('[milestone-files] insert error:', lastErr);
      return NextResponse.json({ error: lastErr?.message ?? 'Insert failed' }, { status: 500 });
    }

    console.log(`[milestone-files] ✅ uploaded id=${fileId} milestone=${milestoneId} name="${file.name}" size=${buffer.length}`);
    return NextResponse.json(rowToFile(inserted), { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[milestone-files] POST fatal:', msg);
    return NextResponse.json({ error: `Failed to upload: ${msg}` }, { status: 500 });
  }
}
