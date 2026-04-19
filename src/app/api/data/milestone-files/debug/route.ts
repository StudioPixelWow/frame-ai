/**
 * GET /api/data/milestone-files/debug
 *
 * Diagnostic endpoint — returns JSON showing:
 *   1. Whether the DB table exists
 *   2. Actual column names
 *   3. Whether the storage bucket exists
 *   4. A test insert + readback (cleaned up)
 *
 * Open in browser: http://localhost:3000/api/data/milestone-files/debug
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'business_project_milestone_files';
const BUCKET = 'project-files';

export const dynamic = 'force-dynamic';

export async function GET() {
  const diag: Record<string, unknown> = { timestamp: new Date().toISOString() };

  try {
    const sb = getSupabase();
    diag.supabaseOk = true;

    // ── 1. exec_sql RPC availability ──
    try {
      const { data, error } = await sb.rpc('exec_sql', { query: 'SELECT 1 AS ping' });
      diag.execSql = error ? { ok: false, error: error.message } : { ok: true, data };
    } catch (e: any) {
      diag.execSql = { ok: false, error: e?.message || 'exception' };
    }

    // ── 2. Table probe ──
    const { data: probeRows, error: probeErr } = await sb
      .from(TABLE)
      .select('*')
      .limit(3);

    if (probeErr) {
      diag.tableExists = false;
      diag.tableError = { message: probeErr.message, code: (probeErr as any)?.code };
    } else {
      diag.tableExists = true;
      diag.rowCount = (probeRows || []).length;
      if (probeRows && probeRows.length > 0) {
        diag.actualColumns = Object.keys(probeRows[0]);
        diag.sampleRow = probeRows[0];
      } else {
        diag.actualColumns = '(table is empty — columns unknown from probe)';

        // Try to discover columns via a test insert
        const testId = `diag_${Date.now()}`;
        const { data: insData, error: insErr } = await sb
          .from(TABLE)
          .insert({
            id: testId,
            milestone_id: '__diag__',
            file_name: 'diag.txt',
            file_url: 'https://example.com/diag.txt',
            file_size: 0,
            content_type: 'text/plain',
          })
          .select('*')
          .single();

        if (insErr) {
          diag.testInsert = { ok: false, error: insErr.message, code: (insErr as any)?.code };
        } else {
          diag.testInsert = { ok: true, returnedColumns: Object.keys(insData || {}), row: insData };
          // Clean up
          await sb.from(TABLE).delete().eq('id', testId);
          diag.testInsertCleanedUp = true;
        }
      }
    }

    // ── 3. Column info via exec_sql (if available) ──
    try {
      const { data: colData, error: colErr } = await sb.rpc('exec_sql', {
        query: `SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = '${TABLE}'
                ORDER BY ordinal_position`,
      });
      if (!colErr && colData) {
        diag.schemaColumns = colData;
      } else {
        diag.schemaColumns = colErr ? { error: colErr.message } : 'no data';
      }
    } catch {
      diag.schemaColumns = 'exec_sql not available';
    }

    // ── 4. Storage bucket ──
    const { data: buckets, error: buckErr } = await sb.storage.listBuckets();
    if (buckErr) {
      diag.bucket = { exists: false, error: buckErr.message };
    } else {
      const found = (buckets || []).find((b: any) => b.name === BUCKET);
      diag.bucket = found
        ? { exists: true, public: (found as any).public, fileSizeLimit: (found as any).file_size_limit }
        : { exists: false, availableBuckets: (buckets || []).map((b: any) => b.name) };
    }

    // ── 5. Expected vs actual column comparison ──
    const expectedCols = ['id', 'milestone_id', 'file_name', 'file_url', 'file_size', 'content_type', 'created_at', 'updated_at'];
    if (Array.isArray(diag.actualColumns)) {
      const actual = new Set(diag.actualColumns as string[]);
      diag.columnComparison = {
        expected: expectedCols,
        actual: diag.actualColumns,
        missingInDB: expectedCols.filter(c => !actual.has(c)),
        extraInDB: (diag.actualColumns as string[]).filter(c => !expectedCols.includes(c)),
      };
    }

  } catch (e: any) {
    diag.fatalError = e?.message || String(e);
  }

  return NextResponse.json(diag, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
