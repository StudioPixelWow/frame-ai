/**
 * Weekly Summary Engine
 *
 * Generates deterministic Hebrew weekly summaries per client, covering:
 * leads, tasks, campaigns, and payments for the past 7 days.
 */

import { getSupabase } from '@/lib/db/store';
import { getClientById } from '@/lib/db/client-helpers';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface WeeklySummary {
  clientId: string;
  clientName: string;
  weekStart: string; // ISO date
  weekEnd: string;
  // Lead metrics
  newLeadsCount: number;
  totalLeadsCount: number;
  leadsConvertedCount: number;
  leadsByStatus: Record<string, number>;
  // Task metrics
  tasksCompletedCount: number;
  tasksOpenCount: number;
  tasksOverdueCount: number;
  // Campaign metrics
  activeCampaignsCount: number;
  campaignsSummary: Array<{ name: string; status: string; platform: string }>;
  // Financial
  totalPaymentsDue: number;
  totalPaymentsReceived: number;
  // Highlights
  highlights: string[];       // Deterministic Hebrew bullet points
  recommendations: string[];  // Deterministic Hebrew recommendations
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Get the Monday 00:00 of the current week (ISO week). */
function getWeekBounds(): { weekStart: string; weekEnd: string; weekStartDate: Date; weekEndDate: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  // Shift so Monday=0 (ISO standard)
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
    weekStartDate: monday,
    weekEndDate: sunday,
  };
}

/** Extract a value from SupabaseCrud JSONB data row. */
function dataField(row: { id: string; data: unknown }, field: string): unknown {
  const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return (d as Record<string, unknown>)?.[field];
}

function dataFields(row: { id: string; data: unknown }): Record<string, unknown> {
  const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return (d as Record<string, unknown>) ?? {};
}

// ═══════════════════════════════════════════════════════════════════════
// HIGHLIGHT GENERATION (deterministic, Hebrew)
// ═══════════════════════════════════════════════════════════════════════

function generateHighlights(summary: Omit<WeeklySummary, 'highlights' | 'recommendations' | 'generatedAt'>): string[] {
  const h: string[] = [];

  if (summary.newLeadsCount > 0) {
    h.push(`נכנסו ${summary.newLeadsCount} לידים חדשים השבוע`);
  }
  if (summary.leadsConvertedCount > 0) {
    h.push(`${summary.leadsConvertedCount} לידים הומרו ללקוחות`);
  }
  if (summary.tasksCompletedCount > 0) {
    h.push(`הושלמו ${summary.tasksCompletedCount} משימות השבוע`);
  }
  if (summary.tasksOverdueCount > 0) {
    h.push(`${summary.tasksOverdueCount} משימות באיחור`);
  }
  if (summary.activeCampaignsCount > 0) {
    h.push(`${summary.activeCampaignsCount} קמפיינים פעילים כרגע`);
  }
  if (summary.totalPaymentsReceived > 0) {
    h.push(`התקבלו תשלומים בסך ₪${summary.totalPaymentsReceived.toLocaleString('he-IL')}`);
  }
  if (summary.totalPaymentsDue > 0) {
    h.push(`תשלומים ממתינים בסך ₪${summary.totalPaymentsDue.toLocaleString('he-IL')}`);
  }

  if (h.length === 0) {
    h.push('אין פעילות משמעותית השבוע');
  }

  return h;
}

function generateRecommendations(summary: Omit<WeeklySummary, 'highlights' | 'recommendations' | 'generatedAt'>): string[] {
  const r: string[] = [];

  if (summary.tasksOverdueCount > 0) {
    r.push(`יש לטפל ב-${summary.tasksOverdueCount} משימות באיחור בהקדם`);
  }
  if (summary.newLeadsCount > 0 && summary.leadsConvertedCount === 0) {
    r.push('לידים חדשים נכנסו אך אף אחד לא הומר — מומלץ לבצע מעקב');
  }
  if (summary.totalPaymentsDue > 0) {
    r.push('ישנם תשלומים ממתינים — מומלץ לשלוח תזכורת ללקוח');
  }
  if (summary.activeCampaignsCount === 0) {
    r.push('אין קמפיינים פעילים — מומלץ לתכנן קמפיין חדש');
  }
  if (summary.tasksOpenCount > 5) {
    r.push(`ישנן ${summary.tasksOpenCount} משימות פתוחות — מומלץ לתעדף`);
  }
  if (summary.totalLeadsCount > 10 && summary.leadsConvertedCount < 2) {
    r.push('יחס המרה נמוך — מומלץ לבדוק את תהליך המכירה');
  }

  return r;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN: generate summary for a single client
// ═══════════════════════════════════════════════════════════════════════

export async function generateWeeklySummary(clientId: string): Promise<WeeklySummary> {
  const sb = getSupabase();
  const { weekStart, weekEnd, weekStartDate, weekEndDate } = getWeekBounds();
  const weekStartISO = weekStartDate.toISOString();
  const weekEndISO = weekEndDate.toISOString();

  // 1. Client data
  const client = await getClientById(clientId);
  const clientName = client?.name ?? 'לקוח לא ידוע';

  // 2. Leads — SupabaseCrud stores data in JSONB `data` column
  //    Query all leads, then filter in JS since JSONB queries are complex.
  const { data: allLeadRows } = await sb
    .from('app_leads')
    .select('id, data, created_at')
    .order('created_at', { ascending: false });

  const clientLeads = (allLeadRows ?? []).filter((row) => {
    const d = dataFields(row);
    return d.clientId === clientId;
  });

  const newLeads = clientLeads.filter((row) => {
    const createdAt = row.created_at as string;
    return createdAt >= weekStartISO && createdAt <= weekEndISO;
  });

  const leadsConvertedCount = clientLeads.filter((row) => {
    const d = dataFields(row);
    return d.status === 'won' && d.convertedAt && (d.convertedAt as string) >= weekStartISO;
  }).length;

  const leadsByStatus: Record<string, number> = {};
  for (const row of clientLeads) {
    const status = (dataField(row, 'status') as string) || 'unknown';
    leadsByStatus[status] = (leadsByStatus[status] || 0) + 1;
  }

  // 3. Tasks (client tasks)
  const { data: allTaskRows } = await sb
    .from('app_client_tasks')
    .select('id, data, created_at')
    .order('created_at', { ascending: false });

  const clientTasks = (allTaskRows ?? []).filter((row) => {
    const d = dataFields(row);
    return d.clientId === clientId;
  });

  const now = new Date();
  const tasksCompletedCount = clientTasks.filter((row) => {
    const d = dataFields(row);
    const updatedAt = (d.updatedAt as string) || '';
    return d.status === 'done' && updatedAt >= weekStartISO;
  }).length;

  const tasksOpenCount = clientTasks.filter((row) => {
    const d = dataFields(row);
    return d.status !== 'done';
  }).length;

  const tasksOverdueCount = clientTasks.filter((row) => {
    const d = dataFields(row);
    return d.status !== 'done' && d.dueDate && new Date(d.dueDate as string) < now;
  }).length;

  // 4. Campaigns
  const { data: allCampaignRows } = await sb
    .from('app_campaigns')
    .select('id, data, created_at')
    .order('created_at', { ascending: false });

  const clientCampaigns = (allCampaignRows ?? []).filter((row) => {
    const d = dataFields(row);
    return d.clientId === clientId;
  });

  const activeCampaigns = clientCampaigns.filter((row) => {
    const d = dataFields(row);
    return d.status === 'active' || d.status === 'in_progress';
  });

  const campaignsSummary = activeCampaigns.map((row) => {
    const d = dataFields(row);
    return {
      name: (d.campaignName as string) || 'ללא שם',
      status: (d.status as string) || 'unknown',
      platform: (d.platform as string) || 'unknown',
    };
  });

  // 5. Payments
  const { data: allPaymentRows } = await sb
    .from('app_payments')
    .select('id, data, created_at')
    .order('created_at', { ascending: false });

  const clientPayments = (allPaymentRows ?? []).filter((row) => {
    const d = dataFields(row);
    return d.clientId === clientId;
  });

  const totalPaymentsDue = clientPayments
    .filter((row) => {
      const d = dataFields(row);
      return d.status === 'pending' || d.status === 'overdue' || d.status === 'msg_sent';
    })
    .reduce((sum, row) => sum + (Number(dataField(row, 'amount')) || 0), 0);

  const totalPaymentsReceived = clientPayments
    .filter((row) => {
      const d = dataFields(row);
      return d.status === 'paid' && d.paidAt && (d.paidAt as string) >= weekStartISO;
    })
    .reduce((sum, row) => sum + (Number(dataField(row, 'amount')) || 0), 0);

  // 6. Compile partial summary
  const partial = {
    clientId,
    clientName,
    weekStart,
    weekEnd,
    newLeadsCount: newLeads.length,
    totalLeadsCount: clientLeads.length,
    leadsConvertedCount,
    leadsByStatus,
    tasksCompletedCount,
    tasksOpenCount,
    tasksOverdueCount,
    activeCampaignsCount: activeCampaigns.length,
    campaignsSummary,
    totalPaymentsDue,
    totalPaymentsReceived,
  };

  // 7. Generate Hebrew highlights & recommendations
  const highlights = generateHighlights(partial);
  const recommendations = generateRecommendations(partial);

  return {
    ...partial,
    highlights,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// BATCH: generate summaries for all active clients
// ═══════════════════════════════════════════════════════════════════════

export async function generateAllWeeklySummaries(): Promise<WeeklySummary[]> {
  const sb = getSupabase();

  // Fetch all active clients
  const { data: clientRows, error } = await sb
    .from('clients')
    .select('id, name, status')
    .eq('status', 'active');

  if (error) {
    console.error('[weekly-summary] Failed to fetch clients:', error.message);
    return [];
  }

  const activeClients = clientRows ?? [];
  console.log(`[weekly-summary] Generating summaries for ${activeClients.length} active clients`);

  const summaries: WeeklySummary[] = [];

  for (const client of activeClients) {
    try {
      const summary = await generateWeeklySummary(client.id);
      summaries.push(summary);
    } catch (err) {
      console.error(`[weekly-summary] Error for client ${client.id}:`, err);
    }
  }

  return summaries;
}
