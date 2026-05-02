/**
 * Client Profitability Model
 *
 * Per client:
 * - Total spend (from ads)
 * - Total leads
 * - CPL
 * - Retainer amount (from client)
 * - Profitability indicator
 * - Warning if inefficient
 *
 * Shows "אין מספיק נתונים" when data missing.
 */

import type { Client, Campaign, Ad, Lead } from '@/lib/db/schema';

// ── Types ──

export type ProfitabilityLevel = 'profitable' | 'break_even' | 'inefficient' | 'critical' | 'no_data';

export interface ClientProfitability {
  clientId: string;
  clientName: string;
  // Financial
  totalSpend: number;
  totalLeads: number;
  cpl: number;
  retainerAmount: number;
  estimatedRevenue: number;      // retainer × months active
  estimatedProfit: number;       // revenue - spend
  roi: number;                   // profit / spend (percentage)
  // Assessment
  level: ProfitabilityLevel;
  levelLabel: string;
  levelColor: string;
  warning: string | null;
  // Details
  activeCampaigns: number;
  totalAds: number;
  spendPerCampaign: number;
  leadsPerCampaign: number;
  hasEnoughData: boolean;
}

const LEVEL_META: Record<ProfitabilityLevel, { label: string; color: string }> = {
  profitable: { label: 'רווחי', color: '#22c55e' },
  break_even: { label: 'איזון', color: '#f59e0b' },
  inefficient: { label: 'לא יעיל', color: '#f97316' },
  critical: { label: 'הפסדי', color: '#ef4444' },
  no_data: { label: 'אין מספיק נתונים', color: '#6b7280' },
};

export { LEVEL_META as PROFITABILITY_LEVEL_META };

// ── Core ──

export function computeClientProfitability(
  client: Client,
  campaigns: Campaign[],
  ads: Ad[],
  leads: Lead[],
): ClientProfitability {
  const clientCampaigns = campaigns.filter(c => c.clientId === client.id);
  const clientAds = ads.filter(a => clientCampaigns.some(c => c.id === a.campaignId));
  const clientLeads = leads.filter(l => l.clientId === client.id);

  const totalSpend = clientAds.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = clientLeads.length;
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const activeCampaigns = clientCampaigns.filter(c => c.status === 'active').length;
  const retainer = client.retainerAmount || 0;

  // Estimate revenue: retainer × months since client created (min 1)
  const monthsActive = Math.max(1, Math.ceil(
    (Date.now() - new Date(client.createdAt || Date.now()).getTime()) / (30 * 86400000)
  ));
  const estimatedRevenue = retainer * monthsActive;
  const estimatedProfit = estimatedRevenue - totalSpend;
  const roi = totalSpend > 0 ? ((estimatedProfit / totalSpend) * 100) : 0;

  if (totalSpend === 0 && totalLeads === 0 && clientCampaigns.length === 0) {
    return {
      clientId: client.id, clientName: client.name,
      totalSpend: 0, totalLeads: 0, cpl: 0, retainerAmount: retainer,
      estimatedRevenue, estimatedProfit, roi: 0,
      level: 'no_data', levelLabel: LEVEL_META.no_data.label, levelColor: LEVEL_META.no_data.color,
      warning: null, activeCampaigns: 0, totalAds: 0,
      spendPerCampaign: 0, leadsPerCampaign: 0, hasEnoughData: false,
    };
  }

  // Determine profitability level
  let level: ProfitabilityLevel;
  let warning: string | null = null;

  if (retainer > 0 && totalSpend > 0) {
    // We have both retainer and spend — compare
    if (estimatedProfit > 0 && roi > 20) {
      level = 'profitable';
    } else if (estimatedProfit >= 0) {
      level = 'break_even';
      warning = 'הלקוח על סף הרווחיות — שקלו להגדיל ריטיינר או להקטין הוצאה';
    } else {
      level = roi < -50 ? 'critical' : 'inefficient';
      warning = `הלקוח בהפסד של ₪${Math.abs(estimatedProfit).toLocaleString('he-IL')} — נדרשת התאמה`;
    }
  } else if (totalSpend > 0 && totalLeads > 0) {
    // No retainer — evaluate by CPL
    if (cpl <= 50) {
      level = 'profitable';
    } else if (cpl <= 120) {
      level = 'break_even';
    } else {
      level = 'inefficient';
      warning = `CPL גבוה: ₪${cpl.toFixed(0)} — יש לבדוק טירגוט ומודעות`;
    }
  } else if (totalSpend > 0 && totalLeads === 0) {
    level = 'critical';
    warning = `הוצאה של ₪${totalSpend.toLocaleString('he-IL')} ללא לידים — נדרשת בדיקה דחופה`;
  } else {
    level = 'break_even';
  }

  return {
    clientId: client.id,
    clientName: client.name,
    totalSpend,
    totalLeads,
    cpl,
    retainerAmount: retainer,
    estimatedRevenue,
    estimatedProfit,
    roi,
    level,
    levelLabel: LEVEL_META[level].label,
    levelColor: LEVEL_META[level].color,
    warning,
    activeCampaigns,
    totalAds: clientAds.length,
    spendPerCampaign: clientCampaigns.length > 0 ? totalSpend / clientCampaigns.length : 0,
    leadsPerCampaign: clientCampaigns.length > 0 ? totalLeads / clientCampaigns.length : 0,
    hasEnoughData: true,
  };
}

/**
 * Compute profitability for all clients.
 */
export function computeAllProfitability(
  clients: Client[],
  campaigns: Campaign[],
  ads: Ad[],
  leads: Lead[],
): ClientProfitability[] {
  return clients
    .filter(c => c.status === 'active')
    .map(c => computeClientProfitability(c, campaigns, ads, leads))
    .sort((a, b) => {
      if (!a.hasEnoughData && b.hasEnoughData) return 1;
      if (a.hasEnoughData && !b.hasEnoughData) return -1;
      return a.roi - b.roi; // worst ROI first
    });
}
