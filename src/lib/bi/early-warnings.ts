/**
 * Early Warning System
 *
 * Triggers alerts when:
 * - CPL rising fast
 * - No leads for X days
 * - CTR drop
 * - Spend high with no results
 *
 * All based on REAL data.
 */

import type { Client, Campaign, Ad, Lead } from '@/lib/db/schema';

// ── Types ──

export type WarningSeverity = 'critical' | 'high' | 'medium' | 'low';
export type WarningType =
  | 'cpl_rising'
  | 'no_leads'
  | 'ctr_drop'
  | 'spend_no_results'
  | 'budget_depleted'
  | 'stale_campaign'
  | 'frequency_high';

export interface EarlyWarning {
  id: string;
  type: WarningType;
  severity: WarningSeverity;
  clientId: string;
  clientName: string;
  campaignId?: string;
  campaignName?: string;
  title: string;
  detail: string;
  actionSuggestion: string;
  detectedAt: string;
}

const WARNING_META: Record<WarningType, { icon: string; label: string }> = {
  cpl_rising: { icon: '📈', label: 'עלייה ב-CPL' },
  no_leads: { icon: '🚫', label: 'אין לידים' },
  ctr_drop: { icon: '📉', label: 'ירידה ב-CTR' },
  spend_no_results: { icon: '🔥', label: 'הוצאה ללא תוצאות' },
  budget_depleted: { icon: '💸', label: 'תקציב נגמר' },
  stale_campaign: { icon: '⏸️', label: 'קמפיין רדום' },
  frequency_high: { icon: '🔄', label: 'תדירות גבוהה' },
};

export { WARNING_META };

export interface EarlyWarningsResult {
  warnings: EarlyWarning[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  hasEnoughData: boolean;
}

// ── Core ──

export function detectEarlyWarnings(
  clients: Client[],
  campaigns: Campaign[],
  ads: Ad[],
  leads: Lead[],
): EarlyWarningsResult {
  const warnings: EarlyWarning[] = [];
  const now = Date.now();
  const day = 86400000;

  const activeClients = clients.filter(c => c.status === 'active');

  for (const client of activeClients) {
    const clientCampaigns = campaigns.filter(c => c.clientId === client.id);
    const clientAds = ads.filter(a => clientCampaigns.some(c => c.id === a.campaignId));
    const clientLeads = leads.filter(l => l.clientId === client.id);

    // ── 1. No leads for 7+ days ──
    if (clientLeads.length > 0) {
      const latestLead = clientLeads
        .map(l => new Date(l.createdAt).getTime())
        .reduce((a, b) => Math.max(a, b), 0);
      const daysSinceLead = Math.floor((now - latestLead) / day);

      if (daysSinceLead >= 14) {
        warnings.push({
          id: `no_leads_${client.id}`,
          type: 'no_leads',
          severity: 'critical',
          clientId: client.id,
          clientName: client.name,
          title: `${client.name} — אין לידים ${daysSinceLead} ימים`,
          detail: `הליד האחרון נכנס לפני ${daysSinceLead} ימים`,
          actionSuggestion: 'בדקו שהקמפיינים פעילים ושהטירגוט תואם',
          detectedAt: new Date().toISOString(),
        });
      } else if (daysSinceLead >= 7) {
        warnings.push({
          id: `no_leads_${client.id}`,
          type: 'no_leads',
          severity: 'high',
          clientId: client.id,
          clientName: client.name,
          title: `${client.name} — אין לידים ${daysSinceLead} ימים`,
          detail: `הליד האחרון נכנס לפני ${daysSinceLead} ימים`,
          actionSuggestion: 'שקלו לרענן את הקריאייטיבים',
          detectedAt: new Date().toISOString(),
        });
      }
    } else if (clientCampaigns.some(c => c.status === 'active')) {
      // Active campaigns but zero leads ever
      warnings.push({
        id: `zero_leads_${client.id}`,
        type: 'no_leads',
        severity: 'high',
        clientId: client.id,
        clientName: client.name,
        title: `${client.name} — אפס לידים`,
        detail: 'קמפיינים פעילים אבל אין לידים כלל',
        actionSuggestion: 'בדקו טופס לידים, טירגוט, ואת הקריאייטיב',
        detectedAt: new Date().toISOString(),
      });
    }

    // ── 2. Spend with no results ──
    for (const campaign of clientCampaigns.filter(c => c.status === 'active')) {
      const campaignAds = clientAds.filter(a => a.campaignId === campaign.id);
      const campaignSpend = campaignAds.reduce((s, a) => s + (a.spend || 0), 0);
      const campaignLeads = campaignAds.reduce((s, a) => s + (a.leads || 0), 0);

      if (campaignSpend > 200 && campaignLeads === 0) {
        warnings.push({
          id: `spend_no_results_${campaign.id}`,
          type: 'spend_no_results',
          severity: campaignSpend > 500 ? 'critical' : 'high',
          clientId: client.id,
          clientName: client.name,
          campaignId: campaign.id,
          campaignName: campaign.campaignName || campaign.clientName,
          title: `₪${campaignSpend.toLocaleString('he-IL')} הוצאה ללא לידים`,
          detail: `קמפיין "${campaign.campaignName}" — הוצאה ללא תוצאות`,
          actionSuggestion: 'עצרו את הקמפיין ושנו טירגוט או קריאייטיב',
          detectedAt: new Date().toISOString(),
        });
      }

      // ── 3. CTR drop — ads with impressions but very low CTR ──
      const lowCtrAds = campaignAds.filter(a => {
        const imp = a.impressions || 0;
        const clicks = a.clicks || 0;
        const ctr = imp > 0 ? (clicks / imp) * 100 : 0;
        return imp >= 500 && ctr < 0.3;
      });

      if (lowCtrAds.length >= 2) {
        warnings.push({
          id: `ctr_drop_${campaign.id}`,
          type: 'ctr_drop',
          severity: 'medium',
          clientId: client.id,
          clientName: client.name,
          campaignId: campaign.id,
          campaignName: campaign.campaignName,
          title: `CTR נמוך מאוד בקמפיין "${campaign.campaignName}"`,
          detail: `${lowCtrAds.length} מודעות עם CTR מתחת ל-0.3%`,
          actionSuggestion: 'החליפו קריאייטיב — הקהל לא מגיב',
          detectedAt: new Date().toISOString(),
        });
      }

      // ── 4. High frequency ──
      const highFreq = campaignAds.filter(a => (a.frequency || 0) > 3);
      if (highFreq.length >= 2) {
        const avgFreq = highFreq.reduce((s, a) => s + (a.frequency || 0), 0) / highFreq.length;
        warnings.push({
          id: `frequency_high_${campaign.id}`,
          type: 'frequency_high',
          severity: avgFreq > 5 ? 'high' : 'medium',
          clientId: client.id,
          clientName: client.name,
          campaignId: campaign.id,
          campaignName: campaign.campaignName,
          title: `תדירות גבוהה: ${avgFreq.toFixed(1)}`,
          detail: 'אנשים רואים את המודעה יותר מדי — יעילות יורדת',
          actionSuggestion: 'הרחיבו את קהל היעד או החליפו קריאייטיב',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // ── 5. Stale campaigns ──
    const staleCampaigns = clientCampaigns.filter(c => {
      if (c.status !== 'draft' && c.status !== 'paused') return false;
      const updated = new Date(c.updatedAt || c.createdAt).getTime();
      return (now - updated) > 14 * day;
    });

    if (staleCampaigns.length >= 2) {
      warnings.push({
        id: `stale_${client.id}`,
        type: 'stale_campaign',
        severity: 'low',
        clientId: client.id,
        clientName: client.name,
        title: `${staleCampaigns.length} קמפיינים רדומים`,
        detail: 'טיוטות או מושהים שלא עודכנו 14+ ימים',
        actionSuggestion: 'הפעילו או מחקו — הם תופסים שטח',
        detectedAt: new Date().toISOString(),
      });
    }

    // ── 6. CPL rising — compare if we have enough lead data ──
    if (clientLeads.length >= 4) {
      const sorted = [...clientLeads].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const half = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, half);
      const secondHalf = sorted.slice(half);

      const totalSpend = clientAds.reduce((s, a) => s + (a.spend || 0), 0);
      // Rough split: assume spend is proportional to time
      const cpl1 = firstHalf.length > 0 ? (totalSpend * 0.5) / firstHalf.length : 0;
      const cpl2 = secondHalf.length > 0 ? (totalSpend * 0.5) / secondHalf.length : 0;

      if (cpl1 > 0 && cpl2 > cpl1 * 1.5) {
        warnings.push({
          id: `cpl_rising_${client.id}`,
          type: 'cpl_rising',
          severity: cpl2 > cpl1 * 2 ? 'critical' : 'high',
          clientId: client.id,
          clientName: client.name,
          title: `CPL עולה אצל ${client.name}`,
          detail: `CPL עלה מ-₪${cpl1.toFixed(0)} ל-₪${cpl2.toFixed(0)} (עלייה של ${Math.round(((cpl2 - cpl1) / cpl1) * 100)}%)`,
          actionSuggestion: 'בדקו תחרות, עייפות קהל, ושינויי אלגוריתם',
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  // Sort by severity
  const severityOrder: Record<WarningSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    warnings,
    criticalCount: warnings.filter(w => w.severity === 'critical').length,
    highCount: warnings.filter(w => w.severity === 'high').length,
    mediumCount: warnings.filter(w => w.severity === 'medium').length,
    hasEnoughData: activeClients.length > 0,
  };
}
