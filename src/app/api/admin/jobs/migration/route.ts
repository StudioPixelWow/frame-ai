/**
 * Admin: DB Migration for Job Runner Tables
 *
 * POST /api/admin/jobs/migration
 *
 * Creates the scheduled_jobs and job_runs tables if they don't exist.
 * Uses exec_sql RPC.
 * Auth: admin role only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

function isAdmin(req: NextRequest): boolean {
  const role = req.headers.get('x-app-role');
  return role === 'admin';
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const supabase = getSupabase();

    const { error } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS scheduled_jobs (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          data JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS job_runs (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          data JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `,
    });

    if (error) {
      console.error('[ADMIN/JOBS] Migration error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify PostgREST to reload schema cache
    try {
      await supabase.rpc('exec_sql', { query: "NOTIFY pgrst, 'reload schema';" });
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      success: true,
      message: 'Tables scheduled_jobs and job_runs created successfully',
      tables: ['scheduled_jobs', 'job_runs'],
      migratedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[ADMIN/JOBS] Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
