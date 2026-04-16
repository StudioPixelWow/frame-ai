/**
 * GET    /api/data/milestone-files/[id]
 * DELETE /api/data/milestone-files/[id]  — deletes from Storage + DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'business_project_milestone_files';
const BUCKET = 'milestone-files';

type Row = Record<string, unknown> & { id: string };

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

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rowToFile(data as Row));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();

    // 1. Fetch the row to get the storage path from file_url.
    const { data: row, error: fetchErr } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 2. Try to delete from Supabase Storage.
    const fileUrl = (row as any).file_url as string;
    if (fileUrl) {
      // Extract the storage path from the public URL.
      // Public URLs look like: https://<project>.supabase.co/storage/v1/object/public/milestone-files/<path>
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      const idx = fileUrl.indexOf(marker);
      if (idx >= 0) {
        const storagePath = decodeURIComponent(fileUrl.slice(idx + marker.length));
        const { error: removeErr } = await sb.storage.from(BUCKET).remove([storagePath]);
        if (removeErr) {
          console.warn(`[milestone-files] storage remove warning for "${storagePath}":`, removeErr.message);
        }
      }
    }

    // 3. Delete the metadata row.
    const { error: deleteErr } = await sb.from(TABLE).delete().eq('id', id);
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
