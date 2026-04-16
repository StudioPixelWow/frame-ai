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

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  id            TEXT PRIMARY KEY,
  milestone_id  TEXT NOT NULL,
  file_name     TEXT NOT NULL DEFAULT '',
  file_url      TEXT NOT NULL DEFAULT '',
  file_size     INTEGER DEFAULT 0,
  content_type  TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
`;

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

/**
 * Ensure the DB table exists.
 * Strategy:
 *  1. exec_sql RPC (auto-creates if available)
 *  2. Probe SELECT (confirms table exists)
 *  3. If table missing, log DDL + return false so callers know
 */
let _tableReady = false;
async function ensureTable(sb: ReturnType<typeof getSupabase>): Promise<boolean> {
  if (_tableReady) return true;

  // 1. Try rpc-based auto-creation.
  try {
    const { error } = await sb.rpc('exec_sql', { query: TABLE_DDL });
    if (!error) {
      console.log(`[milestone-files] ✅ table "${TABLE}" ensured via exec_sql`);
      _tableReady = true;
      return true;
    }
    if (!error.message?.includes('function') && !error.message?.includes('does not exist')) {
      console.warn('[milestone-files] exec_sql warning:', error.message);
    }
  } catch {
    // rpc not available — fall through
  }

  // 2. Probe SELECT.
  const { error: probeErr } = await sb.from(TABLE).select('id').limit(1);
  if (!probeErr) {
    _tableReady = true;
    return true;
  }

  // 3. Table does not exist.
  const code = (probeErr as any)?.code ?? '';
  if (code === '42P01' || probeErr.message?.includes('does not exist')) {
    console.error(
      `[milestone-files] ❌ Table "${TABLE}" does not exist!\n` +
      `Run this SQL in Supabase Dashboard → SQL Editor:\n\n${TABLE_DDL}`
    );
  } else {
    console.error('[milestone-files] table probe error:', probeErr);
  }
  return false;
}

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase();

    // Auto-create table on first access; if missing, return []
    const tableOk = await ensureTable(sb);
    if (!tableOk) {
      console.warn('[milestone-files] GET → table not ready, returning []');
      return NextResponse.json([], { headers: NO_CACHE_HEADERS });
    }

    const url = new URL(req.url);
    const milestoneId = url.searchParams.get('milestone_id') || url.searchParams.get('milestoneId');

    let q = sb.from(TABLE).select('*').order('created_at', { ascending: false });
    if (milestoneId) q = q.eq('milestone_id', milestoneId);

    const { data: rows, error } = await q;
    if (error) {
      const code = (error as any)?.code ?? '';
      console.error(`[milestone-files] GET error (code=${code}):`, error.message);

      if (code === '42P01' || error.message?.includes('does not exist')) {
        // Reset table-ready flag so ensureTable retries next time
        _tableReady = false;
        return NextResponse.json([], { headers: NO_CACHE_HEADERS });
      }
      // If a specific column in order() doesn't exist, retry without ordering
      if (error.message?.includes('created_at')) {
        const { data: rows2, error: err2 } = await sb.from(TABLE).select('*');
        if (!err2 && rows2) {
          console.log(`[milestone-files] GET → ${rows2.length} files (no order)`);
          return NextResponse.json(rows2.map((r: Record<string, unknown>) => rowToFile(r as Row)), { headers: NO_CACHE_HEADERS });
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
    }

    const mapped = (rows ?? []).map((r: Record<string, unknown>) => rowToFile(r as Row));
    console.log(`[milestone-files GET] → ${mapped.length} files`, mapped.length > 0 ? { firstId: mapped[0].id, firstMilestoneId: mapped[0].milestoneId } : '(empty)');
    return NextResponse.json(mapped, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[milestone-files] GET fatal:', msg);
    return NextResponse.json({ error: `Failed to fetch: ${msg}` }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const log = (step: string, detail?: unknown) =>
    console.log(`[milestone-files POST] ${step}${detail !== undefined ? ' → ' + JSON.stringify(detail) : ''}`);

  try {
    const sb = getSupabase();
    log('1/7 parsing formData');
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    const milestoneId = formData.get('milestoneId') as string | null;

    log('2/7 validation', { hasFile: !!file, fileName: file?.name, fileSize: file?.size, milestoneId });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!milestoneId) {
      return NextResponse.json({ error: 'milestoneId is required' }, { status: 400 });
    }

    // 0. Ensure table and bucket exist.
    log('3/7 ensureTable');
    const tableOk = await ensureTable(sb);
    log('3/7 ensureTable result', { tableOk });
    if (!tableOk) {
      return NextResponse.json(
        { error: `Table "${TABLE}" does not exist. Check server logs for CREATE TABLE DDL.` },
        { status: 500 }
      );
    }
    log('3b/7 ensureBucket');
    await ensureBucket(sb);

    // 1. Upload file bytes to Supabase Storage.
    const fileId = generateId();
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
    const storagePath = `${milestoneId}/${fileId}${ext}`;

    log('4/7 reading file buffer');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    log('4/7 buffer ready', { bytes: buffer.length });

    log('5/7 storage upload', { bucket: BUCKET, path: storagePath, contentType: file.type });
    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadErr) {
      log('5/7 ❌ storage upload FAILED', { error: uploadErr.message });
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
    }
    log('5/7 ✅ storage upload OK');

    // 2. Get the public URL.
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl ?? '';
    log('6/7 publicUrl', { url: publicUrl.slice(0, 80) });

    // 3. Insert metadata row into the DB table.
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

    log('7/7 DB insert', { table: TABLE, columns: Object.keys(insertRow) });

    // Retry loop: auto-drop unknown columns.
    let inserted: Row | null = null;
    let lastErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await sb.from(TABLE).insert(insertRow).select('*').single();
      if (!error) {
        inserted = data as Row;
        log(`7/7 ✅ DB insert OK (attempt ${attempt + 1})`, { returnedColumns: Object.keys(data || {}) });
        break;
      }
      lastErr = error;
      const code = (error as any)?.code ?? '';
      log(`7/7 ❌ DB insert attempt ${attempt + 1} FAILED`, { code, msg: error.message });

      // If the table itself doesn't exist, break immediately.
      if (code === '42P01' || (error.message?.includes('relation') && error.message?.includes('does not exist'))) {
        _tableReady = false;
        console.error(
          `[milestone-files] ❌ Table "${TABLE}" does not exist!\n` +
          `Run this SQL in Supabase Dashboard → SQL Editor:\n\n${TABLE_DDL}`
        );
        break;
      }

      const m = error.message.match(/column .*?['"]?([a-z_]+)['"]? (?:does not exist)/i);
      const bad = m?.[1];
      if (bad && bad in insertRow) {
        log(`7/7 dropping unknown column "${bad}"`, { remainingCols: Object.keys(insertRow).filter(k => k !== bad) });
        delete insertRow[bad];
      } else {
        break;
      }
    }

    if (!inserted) {
      log('7/7 ❌ DB insert FINAL FAILURE', { lastErr: lastErr?.message });
      return NextResponse.json(
        { error: lastErr?.message ?? 'Insert failed — check server logs for CREATE TABLE DDL' },
        { status: 500 }
      );
    }

    const mapped = rowToFile(inserted);
    log(`DONE in ${Date.now() - t0}ms`, { id: mapped.id, milestoneId: mapped.milestoneId, fileName: mapped.fileName });
    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[milestone-files POST] FATAL (${Date.now() - t0}ms):`, msg);
    return NextResponse.json({ error: `Failed to upload: ${msg}` }, { status: 500 });
  }
}
