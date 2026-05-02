/**
 * Cross-Client Insights Engine
 *
 * Analyzes data across ALL clients to detect:
 * - Common winning patterns
 * - Industry differences
 * - Campaign trends
 *
 * Uses real data — returns empty when insufficient.
 */

import type { Client, Campaign, Ad, Lead } from '@/lib/db/schema';

// ── Types ──

export interface CrossClientInsight {
  id: string;
  category: 'pattern' | 'industry' | 'trend' | 'benchmark';
  title: string;
  detail: string;
  severity: 'info' | 'positive' | 'warning';
  affectedClients: string[];
}

export interface IndustryBenchmark {
  industry: string;
  clientCount: number;
  avgCpl: number;
  avgCtr: number;
  totalLeads: number;
  totalSpend: number;
}

export interface CrossClientResult {
  insights: CrossClientInsight[];
  industryBenchmarks: IndustryBenchmark[];
  globalAvgCpl: number;
  globalAvgCtr: number;
  totalActiveClients: number;
  totalActiveCampaigns: number;
  hasEnoughData: boolean;
}

// ── Core ──

export function analyzeCrossClient(
  clients: Client[],
  campaigns: Campaign[],
  ads: Ad[],
  leads: Lead[],
): CrossClientResult {
  const activeClients = clients.filter(c => c.status === 'active');
  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  if (activeClients.length < 2) {
    return {
      insights: [],
      industryBenchmarks: [],
      globalAvgCpl: 0,
      globalAvgCtr: 0,
      totalActiveClients: activeClients.length,
      totalActiveCampaigns: activeCampaigns.length,
      hasEnoughData: false,
    };
  }

  const insights: CrossClientInsight[] = [];

  // ── Per-client aggregates ──
  const clientStats = activeClients.map(client => {
    const cCampaigns = campaigns.filter(c => c.clientId === client.id);
    const cAds = ads.filter(a => cCampaigns.some(c => c.id === a.campaignId));
    const cLeads = leads.filter(l => l.clientId === client.id);
    const totalSpend = cAds.reduce((s, a) => s + (a.spend || 0), 0);
    const totalImpressions = cAds.reduce((s, a) => s + (a.impressions || 0), 0);
    const totalClicks = cAds.reduce((s, a) => s + (a.clicks || 0), 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpl = cLeads.length > 0 ? totalSpend / cLeads.length : 0;

    return {
      clientId: client.id,
      clientName: client.name,
      industry: client.businessField || 'כללי',
      totalSpend,
      totalLeads: cLeads.length,
      cpl,
      ctr,
      campaigns: cCampaigns.length,
      activeCampaigns: cCampaigns.filter(c => c.status === 'active').length,
    };
  });

  // ── Global averages ──
  const totalSpendAll = clientStats.reduce((s, c) => s + c.totalSpend, 0);
  const totalLeadsAll = clientStats.reduce((s, c) => s + c.totalLeads, 0);
  const globalAvgCpl = totalLeadsAll > 0 ? totalSpendAll / totalLeadsAll : 0;

  const ctrClients = clientStats.filter(c => c.ctr > 0);
  const globalAvgCtr = ctrClients.length > 0
    ? ctrClients.reduce((s, c) => s + c.ctr, 0) / ctrClients.length
    : 0;

  // ── Industry benchmarks ──
  const industryMap = new Map<string, { clients: string[]; totalSpend: number; totalLeads: number; totalCtr: number; ctrCount: number }>();

  for (const cs of clientStats) {
    const ind = cs.industry || 'כללי';
    const existing = industryMap.get(ind) || { clients: [], totalSpend: 0, totalLeads: 0, totalCtr: 0, ctrCount: 0 };
    existing.clients.push(cs.clientId);
    existing.totalSpend += cs.totalSpend;
    existing.totalLeads += cs.totalLeads;
    if (cs.ctr > 0) { existing.totalCtr += cs.ctr; existing.ctrCount++; }
    industryMap.set(ind, existing);
  }

  const industryBenchmarks: IndustryBenchmark[] = Array.from(industryMap.entries()).map(([industry, data]) => ({
    industry,
    clientCount: data.clients.length,
    avgCpl: data.totalLeads > 0 ? data.totalSpend / data.totalLeads : 0,
    avgCtr: data.ctrCount > 0 ? data.totalCtr / data.ctrCount : 0,
    totalLeads: data.totalLeads,
    totalSpend: data.totalSpend,
  }));

  // ── Detect patterns ──

  // 1. Clients with CPL much higher than average
  if (globalAvgCpl > 0) {
    const highCpl = clientStats.filter(c => c.cpl > 0 && c.cpl > globalAvgCpl * 1.5);
    if (highCpl.length > 0) {
      insights.push({
        id: 'high_cpl_outliers',
        category: 'pattern',
        title: `${highCpl.length} לקוחות עם CPL גבוה מהממוצע`,
        detail: `ממוצע כללי: ₪${globalAvgCpl.toFixed(0)}, לקוחות אלו מעל ₪${(globalAvgCpl * 1.5).toFixed(0)}`,
        severity: 'warning',
        affectedClients: highCpl.map(c => c.clientId),
      });
    }
  }

  // 2. Clients with no leads
  const noLeads = clientStats.filter(c => c.totalLeads === 0 && c.totalSpend > 0);
  if (noLeads.length > 0) {
    insights.push({
      id: 'zero_leads',
      category: 'pattern',
      title: `${noLeads.length} לקוחות עם הוצאה ללא לידים`,
      detail: `סך הוצאה מבוזבזת: ₪${noLeads.reduce((s, c) => s + c.totalSpend, 0).toLocaleString('he-IL')}`,
      severity: 'warning',
      affectedClients: noLeads.map(c => c.clientId),
    });
  }

  // 3. Best performing industry
  const industriesWithData = industryBenchmarks.filter(ib => ib.totalLeads > 0 && ib.clientCount >= 2);
  if (industriesWithData.length >= 2) {
    const best = industriesWithData.sort((a, b) => a.avgCpl - b.avgCpl)[0];
    insights.push({
      id: 'best_industry',
      category: 'industry',
      title: `תחום "${best.industry}" הכי יעיל`,
      detail: `CPL ממוצע ₪${best.avgCpl.toFixed(0)}, ${best.totalLeads} לידים מ-${best.clientCount} לקוחות`,
      severity: 'positive',
      affectedClients: industryMap.get(best.industry)?.clients || [],
    });
  }

  // 4. High CTR pattern
  const highCtrClients = clientStats.filter(c => c.ctr >= 2);
  if (highCtrClients.length >= 2) {
    insights.push({
      id: 'high_ctr_pattern',
      category: 'pattern',
      title: `${highCtrClients.length} לקוחות עם מעורבות גבוהה`,
      detail: `CTR מעל 2% — הקריאייטיבים שלהם עובדים`,
      severity: 'positive',
      affectedClients: highCtrClients.map(c => c.clientId),
    });
  }

  // 5. Inactive clients
  const inactive = clientStats.filter(c => c.activeCampaigns === 0 && c.campaigns > 0);
  if (inactive.length > 0) {
    insights.push({
      id: 'inactive_campaigns',
      category: 'trend',
      title: `${inactive.length} לקוחות ללא קמפיין פעיל`,
      detail: 'לקוחות עם קמפיינים שעצרו — שקלו להפעיל מחדש או ליצור חדשים',
      severity: 'warning',
      affectedClients: inactive.map(c => c.clientId),
    });
  }

  // 6. Rising stars — best ROI
  const stars = clientStats
    .filter(c => c.totalLeads >= 3 && c.cpl > 0 && c.cpl < globalAvgCpl * 0.7)
    .sort((a, b) => a.cpl - b.cpl);

  if (stars.length > 0) {
    insights.push({
      id: 'rising_stars',
      category: 'trend',
      title: `${stars.length} לקוחות "כוכבים עולים"`,
      detail: `CPL מתחת ל-70% מהממוצע — שקלו להגדיל תקציב`,
      severity: 'positive',
      affectedClients: stars.map(c => c.clientId),
    });
  }

  return {
    insights,
    industryBenchmarks,
    globalAvgCpl,
    globalAvgCtr,
    totalActiveClients: activeClients.length,
    totalActiveCampaigns: activeCampaigns.length,
    hasEnoughData: true,
  };
}
