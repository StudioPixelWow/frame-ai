/**
 * Google Ads Reports — data layer.
 * Uses the app's SupabaseCrud generic tables (id + data jsonb, auto-created),
 * consistent with the rest of the system. Each documented "column" lives inside
 * the `data` payload of its table.
 */

import { SupabaseCrud } from '@/lib/db/store';

export type GoogleAdsReportType = 'weekly' | 'monthly' | 'custom';
export type GoogleAdsReportStatus = 'created' | 'sent' | 'viewed' | 'failed';

export interface GoogleAdsConnection {
  id: string;
  clientId: string;
  customerId: string;        // Google Ads customer id (123-456-7890 without dashes)
  refreshToken: string;
  status: 'connected' | 'disconnected' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface GoogleAdsReportInsight {
  insightType: string;       // leading_campaign | strong_audience | strong_region | strong_device | quality_terms | period_improvement
  title: string;
  description: string;
  metricName?: string;
  metricValue?: string;
  comparisonValue?: string;
  trend?: 'up' | 'flat' | 'opportunity';
  priority: number;          // 1 = highest
}

export interface GoogleAdsReportRecommendation {
  title: string;
  description: string;
  actionType: string;        // strengthen | expand | refine | creative | landing
  priority: number;
}

export interface GoogleAdsReport {
  id: string;
  clientId: string;
  clientName: string;
  reportType: GoogleAdsReportType;
  dateFrom: string;
  dateTo: string;
  previousDateFrom: string;
  previousDateTo: string;
  status: GoogleAdsReportStatus;
  htmlUrl: string;           // route that serves the standalone HTML report
  pdfUrl: string;            // same route (print → PDF)
  jsonData: any;             // raw aggregated metrics + period comparison
  summaryText: string;       // short positive summary (for email / WhatsApp)
  insights: GoogleAdsReportInsight[];
  recommendations: GoogleAdsReportRecommendation[];
  isDemo?: boolean;
  createdAt: string;
  sentAt: string | null;
  viewedAt: string | null;
}

export interface GoogleAdsReportLog {
  id: string;
  clientId: string;
  reportId: string | null;
  logType: 'info' | 'skip' | 'error' | 'success';
  message: string;           // INTERNAL ONLY — never shown to the client
  createdAt: string;
}

export const googleAdsConnections = new SupabaseCrud<GoogleAdsConnection>('app_google_ads_connections', 'gac');
export const googleAdsReports = new SupabaseCrud<GoogleAdsReport>('app_google_ads_reports', 'gar');
export const googleAdsReportLogs = new SupabaseCrud<GoogleAdsReportLog>('app_google_ads_report_logs', 'gal');

/** Internal-only log (visible to the system admin, never surfaced to clients). */
export async function logGoogleAds(clientId: string, logType: GoogleAdsReportLog['logType'], message: string, reportId: string | null = null) {
  try {
    await googleAdsReportLogs.createAsync({
      clientId, reportId, logType, message, createdAt: new Date().toISOString(),
    } as Omit<GoogleAdsReportLog, 'id'>);
  } catch { /* logging must never throw */ }
  console.log(`[google-ads][${logType}] client=${clientId} ${message}`);
}

export async function getConnectionForClient(clientId: string): Promise<GoogleAdsConnection | null> {
  try {
    const all = await googleAdsConnections.getAllAsync();
    return all.find((c) => c.clientId === clientId) || null;
  } catch { return null; }
}

export async function listReportsForClient(clientId: string): Promise<GoogleAdsReport[]> {
  try {
    const all = await googleAdsReports.getAllAsync();
    return all
      .filter((r) => r.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch { return []; }
}
