import { NextRequest, NextResponse } from 'next/server';
import {
  ok,
  err,
  loadPlan,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';
import { enrichActivity, getWeeklySummary } from '@/lib/seo/seo-activity-tracker';
import type { ActivityEntry, ActivityCategory, WeeklySummary } from '@/lib/seo/seo-activity-tracker';
import type { SEOActionEntry, ActionStatus } from '@/lib/seo/seo-action-log';

// ── Types ───────────────────────────────────────────────────────────────────

interface TimelineResponse {
  view: 'timeline';
  entries: ActivityEntry[];
  total: number;
  filtered: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: ActivityStats;
}

interface SummaryResponse {
  view: 'summary';
  weeklySummaries: WeeklySummary[];
  stats: ActivityStats;
  total: number;
}

interface ActivityStats {
  totalActions: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  byDate: Record<string, number>;
  completionRate: number;
  avgActionsPerDay: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildStats(entries: ActivityEntry[]): ActivityStats {
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byDate: Record<string, number> = {};

  for (const entry of entries) {
    // By category
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;

    // By status
    byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;

    // By date (day only)
    const dateKey = entry.date.slice(0, 10);
    byDate[dateKey] = (byDate[dateKey] || 0) + 1;
  }

  const completed = entries.filter(e => e.status === 'completed').length;
  const completionRate = entries.length > 0
    ? Math.round((completed / entries.length) * 100)
    : 0;

  const uniqueDays = Object.keys(byDate).length;
  const avgActionsPerDay = uniqueDays > 0
    ? Math.round((entries.length / uniqueDays) * 10) / 10
    : 0;

  return {
    totalActions: entries.length,
    byCategory,
    byStatus,
    byDate,
    completionRate,
    avgActionsPerDay,
  };
}

function getWeekBoundaries(entries: ActivityEntry[]): { start: string; end: string }[] {
  if (entries.length === 0) return [];

  // Find date range
  const dates = entries.map(e => e.date).sort();
  const earliest = new Date(dates[0]);
  const latest = new Date(dates[dates.length - 1]);

  const weeks: { start: string; end: string }[] = [];
  const current = new Date(earliest);
  // Align to Monday
  current.setDate(current.getDate() - ((current.getDay() + 6) % 7));

  while (current <= latest) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    weeks.push({
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
    });

    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

// ── GET — Activity center with rich filtering ──────────────────────────────

async function _GET(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);
  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  const url = new URL(req.url);
  const categoryFilter = url.searchParams.get('category') as ActivityCategory | null;
  const statusFilter = url.searchParams.get('status') as ActionStatus | null;
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const search = url.searchParams.get('search');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
  const view = (url.searchParams.get('view') || 'timeline') as 'timeline' | 'summary';

  // Build enriched activity entries from plan.actionLog
  const actionLog: SEOActionEntry[] = Array.isArray((plan as any).actionLog)
    ? (plan as any).actionLog
    : [];

  let entries: ActivityEntry[] = actionLog.map(entry =>
    enrichActivity(entry, (plan as any).clientId, plan.clientName, plan.websiteUrl)
  );

  const totalBeforeFilters = entries.length;

  // Apply filters
  if (categoryFilter) {
    entries = entries.filter(e => e.category === categoryFilter);
  }
  if (statusFilter) {
    entries = entries.filter(e => e.status === statusFilter);
  }
  if (dateFrom) {
    entries = entries.filter(e => e.date >= dateFrom);
  }
  if (dateTo) {
    entries = entries.filter(e => e.date <= dateTo);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    entries = entries.filter(e =>
      e.description.toLowerCase().includes(searchLower) ||
      (e.pageTitle && e.pageTitle.toLowerCase().includes(searchLower)) ||
      (e.pageUrl && e.pageUrl.toLowerCase().includes(searchLower)) ||
      e.module.toLowerCase().includes(searchLower) ||
      e.seoReason.toLowerCase().includes(searchLower)
    );
  }

  // Build stats from filtered entries
  const stats = buildStats(entries);

  // Summary view — return weekly/monthly summaries
  if (view === 'summary') {
    const weeks = getWeekBoundaries(entries);
    const weeklySummaries = weeks.map(week =>
      getWeeklySummary(entries, planId, week.start, week.end)
    ).filter(s => s.totalActions > 0);

    const response: SummaryResponse = {
      view: 'summary',
      weeklySummaries,
      stats,
      total: totalBeforeFilters,
    };

    return ok(response);
  }

  // Timeline view (default) — return paginated entries
  // Sort by date descending (newest first)
  entries.sort((a, b) => b.date.localeCompare(a.date));

  const totalFiltered = entries.length;
  const totalPages = Math.ceil(totalFiltered / pageSize);
  const offset = (page - 1) * pageSize;
  const paginated = entries.slice(offset, offset + pageSize);

  const response: TimelineResponse = {
    view: 'timeline',
    entries: paginated,
    total: totalBeforeFilters,
    filtered: totalFiltered,
    page,
    pageSize,
    totalPages,
    stats,
  };

  return ok(response);
}

export const GET = withErrorBoundary(_GET);
