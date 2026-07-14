/**
 * GET /api/data/dashboard-data
 *
 * Consolidated dashboard data endpoint.
 * Runs all dashboard queries in parallel via Promise.allSettled,
 * returning a single JSON response instead of 24+ separate API calls.
 * Each query has a try/catch with empty-array fallback so one failure
 * never breaks the whole dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

type TableQuery = {
  key: string;
  table: string;
  orderBy?: string;
};

const QUERIES: TableQuery[] = [
  { key: 'clients', table: 'clients', orderBy: 'id' },
  { key: 'tasks', table: 'tasks', orderBy: 'id' },
  { key: 'payments', table: 'app_payments', orderBy: 'id' },
  { key: 'leads', table: 'app_leads', orderBy: 'id' },
  { key: 'employees', table: 'employees', orderBy: 'id' },
  { key: 'campaigns', table: 'app_campaigns', orderBy: 'id' },
  { key: 'approvals', table: 'app_approvals', orderBy: 'id' },
  { key: 'podcastSessions', table: 'app_podcast_sessions', orderBy: 'id' },
  { key: 'meetings', table: 'app_meetings', orderBy: 'id' },
  { key: 'employeeTasks', table: 'app_employee_tasks', orderBy: 'id' },
  { key: 'businessProjects', table: 'projects', orderBy: 'id' },
  { key: 'ganttItems', table: 'app_client_gantt_items', orderBy: 'id' },
];

async function queryTable(
  supabase: ReturnType<typeof getSupabase>,
  q: TableQuery
): Promise<{ key: string; data: any[] }> {
  try {
    const { data, error } = await supabase
      .from(q.table)
      .select('*')
      .order(q.orderBy ?? 'id', { ascending: true });

    if (error) {
      console.error(`[dashboard-data] Error querying ${q.table}:`, error.message);
      return { key: q.key, data: [] };
    }

    return { key: q.key, data: data ?? [] };
  } catch (err: any) {
    console.error(`[dashboard-data] Exception querying ${q.table}:`, err?.message ?? err);
    return { key: q.key, data: [] };
  }
}

export async function GET(req: NextRequest) {
  const errors: string[] = [];

  try {
    const supabase = getSupabase();
    const role = req.headers.get('x-app-role') ?? 'admin';

    // Run all queries in parallel
    const results = await Promise.allSettled(
      QUERIES.map((q) => queryTable(supabase, q))
    );

    // Build the response object
    const response: Record<string, any> = {
      // Non-critical tables — return empty arrays
      socialPosts: [],
      activities: [],
      hosting: [],
      projectPayments: [],
    };

    results.forEach((result, index) => {
      const queryDef = QUERIES[index];
      if (result.status === 'fulfilled') {
        response[result.value.key] = result.value.data;
      } else {
        const reason = result.reason?.message ?? String(result.reason);
        console.error(`[dashboard-data] Promise rejected for ${queryDef.table}:`, reason);
        errors.push(`${queryDef.table}: ${reason}`);
        response[queryDef.key] = [];
      }
    });

    // Role-based filtering for clients
    if (role !== 'admin' && role !== 'manager') {
      // Non-admin/manager roles get all clients for now,
      // but could be filtered by assigned_manager_id if needed
    }

    // Add metadata
    response._meta = {
      fetchedAt: new Date().toISOString(),
      errors,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[dashboard-data] Fatal error:', err?.message ?? err);
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard data',
        details: err?.message ?? 'Unknown error',
        _meta: { fetchedAt: new Date().toISOString(), errors: [err?.message ?? 'Fatal error'] },
      },
      { status: 500 }
    );
  }
}
