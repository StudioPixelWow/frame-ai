/**
 * Report Data Aggregation Engine
 *
 * Collects real data from existing collections and structures it
 * into ReportData objects for each report type.
 *
 * Rules:
 *   - NEVER invents fake data
 *   - If metrics are 0, they are shown as 0 (not hidden)
 *   - If insufficient data exists, sets hasEnoughData = false
 *   - All text in Hebrew
 */

import type {
  Campaign, AdSet, Ad, Lead,
  CampaignAction, CampaignActionApproval,
  AutoCampaignFinding,
  ReportData, ReportType, ReportMode,
  ReportCampaignSummary, ReportAdSetSummary, ReportAdPerformance,
} from '@/lib/db/schema';
import {
  campaigns, adSets, ads, leads,
  campaignActions, campaignActionApprovals,
  autoCampaignFindings,
} from '@/lib/db';

// ── Helpers ──────────────────────────────────────────────────────────

function inRange(dateStr: string, start: string, end: string): boolean {
  const d = new Date(dateStr).getTime();
  return d >= new Date(start).getTime() && d <= new Date(end).getTime();
}

function formatCurrency(n: number): string {
  if (!n) return '₪0';
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 });
}

// ── Campaign Report ──────────────────────────────────────────────────

export async function generateCampaignReportData(
  campaignId: string,
  periodStart: string,
  periodEnd: string,
  mode: ReportMode,
): Promise<ReportData> {
  const campaign = await campaigns.getByIdAsync(campaignId);
  if (!campaign) {
    return emptyReportData('הקמפיין לא נמצא');
  }

  const campaignAdSets = (await adSets.getAllAsync()).filter(as => as.campaignId === campaignId);
  const asIds = new Set(campaignAdSets.map(as => as.id));
  const campaignAds = (await ads.getAllAsync()).filter(a => a.campaignId === campaignId || asIds.has(a.adSetId));
  const campaignLeads = (await leads.getAllAsync()).filter(l => l.campaignId === campaignId);

  // Actions
  const allActions = (await campaignActions.getAllAsync()).filter(a => a.campaignId === campaignId);
  const executedActions = allActions.filter(a => a.status === 'executed');
  const pendingActs = allActions.filter(a => a.status === 'pending' || a.status === 'approval_required');

  // Findings (internal only)
  const findings = mode === 'internal'
    ? (await autoCampaignFindings.getAllAsync()).filter(f => f.campaignId === campaignId)
    : [];

  // Metrics
  const totalSpend = campaignAds.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = campaignLeads.length || campaignAds.reduce((s, a) => s + (a.leads || 0), 0);
  const totalImpressions = campaignAds.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = campaignAds.reduce((s, a) => s + (a.clicks || 0), 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Best performing ad
  const bestAd = campaignAds
    .filter(a => a.impressions > 0)
    .sort((a, b) => {
      const scoreA = (a.leads * 10) + (a.ctr * 5) - (a.cpl || 999);
      const scoreB = (b.leads * 10) + (b.ctr * 5) - (b.cpl || 999);
      return scoreB - scoreA;
    })[0] || null;

  // Weak points
  const weakPoints: string[] = [];
  if (avgCtr < 1 && totalImpressions > 1000) weakPoints.push('CTR נמוך — מתחת ל-1%');
  if (avgCpl > 100 && totalLeads > 0) weakPoints.push(`עלות לליד גבוהה — ${formatCurrency(avgCpl)}`);
  const pausedAds = campaignAds.filter(a => a.status === 'paused').length;
  if (pausedAds > 0) weakPoints.push(`${pausedAds} מודעות מושהות`);
  if (totalImpressions === 0 && totalSpend > 0) weakPoints.push('הוצאה קיימת ללא חשיפות — בדקו מדידה');

  // Recommendations from findings
  const recommendations = findings.map(f => f.reason);

  const hasEnoughData = totalImpressions > 0 || totalLeads > 0 || totalSpend > 0;

  return {
    campaignSummary: {
      id: campaign.id,
      name: campaign.campaignName,
      status: campaign.status,
      platform: campaign.platform,
      spend: totalSpend,
      leads: totalLeads,
      cpl: avgCpl,
      ctr: avgCtr,
      adSetsCount: campaignAdSets.length,
      adsCount: campaignAds.length,
    },
    adSetSummaries: campaignAdSets.map(as => {
      const asAds = campaignAds.filter(a => a.adSetId === as.id);
      const spend = asAds.reduce((s, a) => s + (a.spend || 0), 0);
      const ld = asAds.reduce((s, a) => s + (a.leads || 0), 0);
      return {
        id: as.id,
        name: as.name,
        status: as.status,
        spend,
        leads: ld,
        cpl: ld > 0 ? spend / ld : 0,
        adsCount: asAds.length,
      };
    }),
    adPerformance: campaignAds.map(a => ({
      id: a.id,
      name: a.name,
      headline: a.headline || '',
      status: a.status,
      impressions: a.impressions || 0,
      clicks: a.clicks || 0,
      spend: a.spend || 0,
      leads: a.leads || 0,
      ctr: a.ctr || 0,
      cpl: a.cpl || 0,
    })),
    totalSpend,
    totalLeads,
    totalImpressions,
    totalClicks,
    avgCpl,
    avgCtr,
    bestPerformingAd: bestAd ? {
      name: bestAd.name,
      headline: bestAd.headline || '',
      ctr: bestAd.ctr || 0,
      leads: bestAd.leads || 0,
      cpl: bestAd.cpl || 0,
    } : null,
    weakPoints,
    recommendations,
    actionsTaken: executedActions.map(a => a.title),
    pendingActions: pendingActs.map(a => a.title),
    hasEnoughData,
  };
}

// ── Client Monthly Report ────────────────────────────────────────────

export async function generateClientMonthlyReportData(
  clientId: string,
  periodStart: string,
  periodEnd: string,
  mode: ReportMode,
): Promise<ReportData> {
  // All campaigns for this client
  const clientCampaigns = (await campaigns.getAllAsync()).filter(c => c.clientId === clientId);
  const cmpIds = new Set(clientCampaigns.map(c => c.id));

  const clientAdSets = (await adSets.getAllAsync()).filter(as => cmpIds.has(as.campaignId));
  const asIds = new Set(clientAdSets.map(as => as.id));
  const clientAds = (await ads.getAllAsync()).filter(a => cmpIds.has(a.campaignId) || asIds.has(a.adSetId));
  const clientLeads = (await leads.getAllAsync()).filter(l => l.campaignId && cmpIds.has(l.campaignId));

  // Actions in period
  const allActions = (await campaignActions.getAllAsync()).filter(a => a.clientId === clientId);
  const periodActions = allActions.filter(a => inRange(a.createdAt, periodStart, periodEnd));
  const executedActions = periodActions.filter(a => a.status === 'executed');
  const pendingActs = allActions.filter(a => a.status === 'pending' || a.status === 'approval_required');

  // Approvals
  const allApprovals = (await campaignActionApprovals.getAllAsync()).filter(ap => ap.clientId === clientId);
  const approvedCount = allApprovals.filter(ap => ap.status === 'approved' && inRange(ap.createdAt, periodStart, periodEnd)).length;
  const pendingApprovals = allApprovals.filter(ap => ap.status === 'pending').length;

  // Metrics
  const totalSpend = clientAds.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = clientLeads.length || clientAds.reduce((s, a) => s + (a.leads || 0), 0);
  const totalImpressions = clientAds.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = clientAds.reduce((s, a) => s + (a.clicks || 0), 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Best ad
  const bestAd = clientAds
    .filter(a => a.impressions > 0)
    .sort((a, b) => {
      const scoreA = (a.leads * 10) + (a.ctr * 5) - (a.cpl || 999);
      const scoreB = (b.leads * 10) + (b.ctr * 5) - (b.cpl || 999);
      return scoreB - scoreA;
    })[0] || null;

  // Weak points
  const weakPoints: string[] = [];
  if (avgCtr < 1 && totalImpressions > 1000) weakPoints.push('CTR ממוצע נמוך');
  if (avgCpl > 100 && totalLeads > 0) weakPoints.push(`עלות לליד גבוהה — ${formatCurrency(avgCpl)}`);
  const activeCampaigns = clientCampaigns.filter(c => c.status === 'active');
  if (activeCampaigns.length === 0) weakPoints.push('אין קמפיינים פעילים');

  // Next month recommendations
  const nextMonth: string[] = [];
  if (bestAd && bestAd.leads > 3) nextMonth.push(`הרחיבו את המודעה "${bestAd.name}" — ביצועים חזקים`);
  if (avgCpl > 80) nextMonth.push('בצעו A/B testing על קריאייטיבים חדשים להורדת CPL');
  if (pendingActs.length > 0) nextMonth.push(`אשרו ${pendingActs.length} פעולות ממתינות`);
  if (weakPoints.length === 0 && totalLeads > 0) nextMonth.push('ביצועים יציבים — שקלו הגדלת תקציב');

  // Executive summary
  let executiveSummary = '';
  if (totalLeads > 0) {
    executiveSummary = `במהלך התקופה הופקו ${totalLeads} לידים עם הוצאה כוללת של ${formatCurrency(totalSpend)}.`;
    if (avgCpl > 0) executiveSummary += ` עלות ממוצעת לליד: ${formatCurrency(avgCpl)}.`;
    if (executedActions.length > 0) executiveSummary += ` בוצעו ${executedActions.length} פעולות אופטימיזציה.`;
  } else if (totalImpressions > 0) {
    executiveSummary = `הקמפיינים הפעילים צברו ${totalImpressions.toLocaleString()} חשיפות.`;
    if (totalSpend > 0) executiveSummary += ` הוצאה כוללת: ${formatCurrency(totalSpend)}.`;
  } else {
    executiveSummary = 'לא קיימים מספיק נתונים להפקת סיכום מנהלים.';
  }

  const hasEnoughData = totalImpressions > 0 || totalLeads > 0 || clientCampaigns.length > 0;

  return {
    totalSpend,
    totalLeads,
    totalImpressions,
    totalClicks,
    avgCpl,
    avgCtr,
    bestPerformingAd: bestAd ? {
      name: bestAd.name,
      headline: bestAd.headline || '',
      ctr: bestAd.ctr || 0,
      leads: bestAd.leads || 0,
      cpl: bestAd.cpl || 0,
    } : null,
    weakPoints,
    recommendations: [],
    actionsTaken: executedActions.map(a => a.title),
    pendingActions: pendingActs.map(a => a.title),
    campaignsActive: activeCampaigns.length,
    approvalsCompleted: approvedCount,
    approvalsPending: pendingApprovals,
    nextMonthRecommendations: nextMonth,
    executiveSummary,
    hasEnoughData,
  };
}

// ── Internal Manager Report ──────────────────────────────────────────

export async function generateManagerReportData(
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ReportData> {
  // Get the base monthly data first
  const base = await generateClientMonthlyReportData(clientId, periodStart, periodEnd, 'internal');

  // Findings for this client
  const findings = (await autoCampaignFindings.getAllAsync()).filter(f => f.clientId === clientId);
  const budgetWasteFindings = findings.filter(f => f.type === 'budget_waste');
  const criticalFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'high');

  // Client health assessment
  let clientHealth = 'טוב';
  if (criticalFindings.length > 3) clientHealth = 'דורש טיפול דחוף';
  else if (criticalFindings.length > 0) clientHealth = 'דורש תשומת לב';
  else if (base.totalLeads === 0 && base.totalSpend > 100) clientHealth = 'בעייתי — הוצאה ללא לידים';

  // Budget waste risks
  const budgetWasteRisks = budgetWasteFindings.map(f =>
    `${f.campaignName || 'קמפיין'}: ${f.reason}`
  );

  // Pending approvals
  const allActions = (await campaignActions.getAllAsync()).filter(a => a.clientId === clientId);
  const pendingApprovalActions = allActions.filter(a => a.status === 'approval_required' || a.status === 'pending');

  // Automation actions taken
  const autoActions = allActions.filter(a => a.createdBy === 'auto_monitor');

  // Employee follow-ups
  const followUps: string[] = [];
  if (pendingApprovalActions.length > 5) followUps.push(`${pendingApprovalActions.length} פעולות ממתינות — יש לטפל בהן`);
  if (base.totalLeads === 0 && base.campaignsActive && base.campaignsActive > 0) {
    followUps.push('קמפיינים פעילים ללא לידים — דרוש בדיקה');
  }
  if (budgetWasteRisks.length > 0) followUps.push('זוהו סיכוני בזבוז תקציב — ראו פירוט');

  return {
    ...base,
    clientHealth,
    budgetWasteRisks,
    automationActions: autoActions.map(a => a.title),
    employeeFollowUps: followUps,
    pendingActions: pendingApprovalActions.map(a => a.title),
  };
}

// ── Empty Report Fallback ────────────────────────────────────────────

function emptyReportData(reason?: string): ReportData {
  return {
    totalSpend: 0,
    totalLeads: 0,
    totalImpressions: 0,
    totalClicks: 0,
    avgCpl: 0,
    avgCtr: 0,
    bestPerformingAd: null,
    weakPoints: reason ? [reason] : [],
    recommendations: [],
    actionsTaken: [],
    pendingActions: [],
    hasEnoughData: false,
  };
}

// ── Report Type Metadata ─────────────────────────────────────────────

export const REPORT_TYPE_META: Record<string, { label: string; icon: string; description: string }> = {
  campaign: { label: 'דוח קמפיין', icon: '📊', description: 'ביצועים, מודעות, לידים ופעולות של קמפיין בודד' },
  client_monthly: { label: 'דוח חודשי ללקוח', icon: '📋', description: 'סיכום חודשי — קמפיינים, תוצאות, המלצות' },
  internal_manager: { label: 'דוח מנהל פנימי', icon: '🔒', description: 'בריאות לקוח, סיכונים, פעולות אוטומציה' },
};
