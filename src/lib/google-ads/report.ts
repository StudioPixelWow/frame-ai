/**
 * Report orchestrator — pulls data, analyzes, writes positive copy, builds the
 * premium HTML, and persists the report (+ insights, recommendations, logs).
 * Never throws a client-facing error: failures are logged internally only.
 */

import { getClientById } from '@/lib/db/client-helpers';
import { getSupabase } from '@/lib/db/store';
import {
  googleAdsReports, googleAdsConnections, getConnectionForClient, logGoogleAds,
  type GoogleAdsReport, type GoogleAdsReportType,
} from './db';
import { fetchAdsData, googleAdsConfigured, buildManualAdsData, type AdsData, type ManualAdsInput } from './provider';
import { parseGoogleAdsCsvFiles, type CsvFile } from './csv-import';
import { analyze } from './insights';
import { buildExecutiveSummary } from './positive-language';
import { buildReportHtml } from './report-html';

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function computePeriods(type: GoogleAdsReportType, customFrom?: string, customTo?: string) {
  const today = new Date();
  let from: Date, to: Date;
  if (type === 'custom' && customFrom && customTo) {
    from = new Date(customFrom); to = new Date(customTo);
  } else if (type === 'monthly') {
    // previous full calendar month
    const firstThis = new Date(today.getFullYear(), today.getMonth(), 1);
    to = new Date(firstThis.getTime() - 86400000);
    from = new Date(to.getFullYear(), to.getMonth(), 1);
  } else {
    // weekly: last 7 days ending yesterday
    to = new Date(today.getTime() - 86400000);
    from = new Date(to.getTime() - 6 * 86400000);
  }
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  return { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo) };
}

function periodLabel(from: string, to: string): string {
  const f = new Date(from), t = new Date(to);
  if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
    return `${f.getDate()}–${t.getDate()} ב${HE_MONTHS[t.getMonth()]} ${t.getFullYear()}`;
  }
  return `${f.getDate()} ב${HE_MONTHS[f.getMonth()]} – ${t.getDate()} ב${HE_MONTHS[t.getMonth()]} ${t.getFullYear()}`;
}

const TYPE_HE: Record<GoogleAdsReportType, string> = { weekly: 'שבועי', monthly: 'חודשי', custom: 'מותאם' };

export interface GenerateOptions {
  clientId: string;
  type: GoogleAdsReportType;
  customFrom?: string;
  customTo?: string;
  manual?: ManualAdsInput;   // manual entry path (no API)
  csvFiles?: CsvFile[];      // CSV upload path (no API)
  baseUrl?: string;
}

export async function generateGoogleAdsReport(opts: GenerateOptions): Promise<GoogleAdsReport> {
  const { clientId, type } = opts;
  const client = await getClientById(clientId);
  if (!client) throw new Error('client_not_found');

  const { from, to, prevFrom, prevTo } = computePeriods(type, opts.customFrom, opts.customTo);

  let data: AdsData;
  let isDemo = false;
  if (opts.csvFiles && opts.csvFiles.length) {
    // CSV upload — full data parsed from the Google Ads export, no API.
    const { data: parsed, warnings } = parseGoogleAdsCsvFiles(opts.csvFiles);
    data = parsed;
    await logGoogleAds(clientId, 'info', `Report generated from ${opts.csvFiles.length} uploaded CSV file(s). ${warnings.join(' ')}`.trim());
  } else if (opts.manual) {
    // Manual entry — real numbers typed by the manager, no API.
    data = buildManualAdsData(opts.manual);
    await logGoogleAds(clientId, 'info', 'Report generated from manual data entry (no API).');
  } else {
    const conn = await getConnectionForClient(clientId);
    isDemo = !(conn && conn.status === 'connected' && googleAdsConfigured());
    if (isDemo) await logGoogleAds(clientId, 'info', 'No live Google Ads connection — generating demo report from sample data.');
    data = await fetchAdsData(conn, clientId, from, to, prevFrom, prevTo);
  }
  const analysis = analyze(data);
  const reportTypeHe = TYPE_HE[type];
  const { summary, closing, short } = await buildExecutiveSummary((client as any).name, data, analysis, reportTypeHe);

  const html = buildReportHtml({
    clientName: (client as any).name,
    brandColor: (client as any).color || '#00B5FE',
    clientLogoUrl: (client as any).logoUrl || undefined,
    reportTypeHe,
    periodLabel: periodLabel(from, to),
    data, deltas: analysis.deltas,
    insights: analysis.insights, recommendations: analysis.recommendations,
    summary, closing, isDemo,
  });

  const now = new Date().toISOString();
  const created = await googleAdsReports.createAsync({
    clientId, clientName: (client as any).name, reportType: type,
    dateFrom: from, dateTo: to, previousDateFrom: prevFrom, previousDateTo: prevTo,
    status: 'created',
    htmlUrl: '', pdfUrl: '',
    jsonData: { current: data.current, previous: data.previous, deltas: analysis.deltas, optimizationScore: data.optimizationScore, isMock: data.isMock, html },
    summaryText: short,
    insights: analysis.insights, recommendations: analysis.recommendations,
    isDemo,
    createdAt: now, sentAt: null, viewedAt: null,
  } as Omit<GoogleAdsReport, 'id'>);

  // Now that we have the id, set the URLs and persist.
  const htmlUrl = `/api/google-ads/reports/${created.id}?format=html`;
  await googleAdsReports.updateAsync(created.id, { htmlUrl, pdfUrl: htmlUrl } as Partial<GoogleAdsReport>);
  created.htmlUrl = htmlUrl; created.pdfUrl = htmlUrl;

  await logGoogleAds(clientId, 'success', `Report ${created.id} (${type}) generated for ${from}..${to}.`, created.id);
  return created;
}

/**
 * Cron worker — generates a report for EVERY active client that has a valid
 * Google Ads connection, one after another (a simple queue). Clients without a
 * valid connection are SKIPPED with an internal-only log (never shown to client).
 */
export async function runGoogleAdsCron(type: 'weekly' | 'monthly'): Promise<{ generated: number; skipped: number; failed: number; total: number }> {
  const sb = getSupabase();
  let clients: any[] = [];
  try {
    const { data } = await sb.from('clients').select('id, name, status').eq('status', 'active').order('id');
    clients = data || [];
  } catch (e) {
    console.error('[google-ads cron] failed to load clients:', e instanceof Error ? e.message : e);
  }

  // Map of clientId → connected
  let connectedIds = new Set<string>();
  try {
    const conns = await googleAdsConnections.getAllAsync();
    connectedIds = new Set(conns.filter((c) => c.status === 'connected').map((c) => c.clientId));
  } catch { /* none */ }

  let generated = 0, skipped = 0, failed = 0;
  for (const cl of clients) {
    if (!connectedIds.has(cl.id)) {
      skipped++;
      await logGoogleAds(cl.id, 'skip', `Skipped ${type} report — no valid Google Ads connection.`);
      continue;
    }
    try {
      await generateGoogleAdsReport({ clientId: cl.id, type });
      generated++;
    } catch (e) {
      failed++;
      await logGoogleAds(cl.id, 'error', `${type} report generation failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`[google-ads cron:${type}] generated=${generated} skipped=${skipped} failed=${failed} total=${clients.length}`);
  return { generated, skipped, failed, total: clients.length };
}
