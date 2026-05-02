/**
 * Client Health Score Engine
 *
 * Computes a 0–100 health score per client based on REAL data:
 * - Lead trend (are leads coming in?)
 * - CPL trend (is CPL stable or rising?)
 * - Campaign activity (are campaigns running?)
 * - Engagement signals (CTR, spend efficiency)
 *
 * Returns "אין מספיק נתונים" when data is insufficient.
 */

import type { Client, Campaign, Ad, Lead } from '@/lib/db/schema';

// ── Types ──

export type ClientHealthStatus = 'healthy' | 'warning' | 'critical' | 'no_data';

export interface ClientHealthScore {
  clientId: string;
  clientName: string;
  score: number;
  status: ClientHealthStatus;
  statusLabel: string;
  statusColor: string;
  breakdown: {
    leadsTrend: { score: number; label: string; detail: string };
    cplTrend: { score: number; label: string; detail: string };
    campaignActivity: { score: number; label: string; detail: string };
    engagement: { score: number; label: string; detail: string };
  };
  hasEnoughData: boolean;
  lastUpdated: string;
}

// ── Status labels & colors ──

const STATUS_META: Record<ClientHealthStatus, { label: string; color: string }> = {
  healthy: { label: 'בריא', color: '#22c55e' },
  warning: { label: 'דורש תשומת לב', color: '#f59e0b' },
  critical: { label: 'קריטי', color: '#ef4444' },
  no_data: { label: 'אין מספיק נתונים', color: '#6b7280' },
};

export { STATUS_META as HEALTH_STATUS_META };

// ── Core computation ──

export function computeClientHealth(
  client: Client,
  campaigns: Campaign[],
  ads: Ad[],
  leads: Lead[],
): ClientHealthScore {
  const clientCampaigns = campaigns.filter(c => c.clientId === client.id);
  const clientAds = ads.filter(a => clientCampaigns.some(c => c.id === a.campaignId));
  const clientLeads = leads.filter(l => l.clientId === client.id);

  // Check if we have enough data
  const hasEnoughData = clientCampaigns.length > 0 && (clientAds.length > 0 || clientLeads.length > 0);

  if (!hasEnoughData) {
    return {
      clientId: client.id,
      clientName: client.name,
      score: 0,
      status: 'no_data',
      statusLabel: STATUS_META.no_data.label,
      statusColor: STATUS_META.no_data.color,
      breakdown: {
        leadsTrend: { score: 0, label: 'אין נתונים', detail: 'אין לידים בקמפיינים' },
        cplTrend: { score: 0, label: 'אין נתונים', detail: 'אין עלות ללקוח' },
        campaignActivity: { score: 0, label: 'אין נתונים', detail: 'אין קמפיינים פעילים' },
        engagement: { score: 0, label: 'אין נתונים', detail: 'אין נתוני חשיפה' },
      },
      hasEnoughData: false,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ── 1. Leads trend (0–30 pts) ──
  const leadsTrend = scoreLeadsTrend(clientLeads);

  // ── 2. CPL trend (0–25 pts) ──
  const cplTrend = scoreCplTrend(clientAds, clientLeads);

  // ── 3. Campaign activity (0–25 pts) ──
  const campaignActivity = scoreCampaignActivity(clientCampaigns);

  // ── 4. Engagement (0–20 pts) ──
  const engagement = scoreEngagement(clientAds);

  const totalScore = Math.round(
    leadsTrend.score + cplTrend.score + campaignActivity.score + engagement.score
  );
  const clampedScore = Math.max(0, Math.min(100, totalScore));

  const status: ClientHealthStatus =
    clampedScore >= 70 ? 'healthy' :
    clampedScore >= 40 ? 'warning' : 'critical';

  return {
    clientId: client.id,
    clientName: client.name,
    score: clampedScore,
    status,
    statusLabel: STATUS_META[status].label,
    statusColor: STATUS_META[status].color,
    breakdown: { leadsTrend, cplTrend, campaignActivity, engagement },
    hasEnoughData: true,
    lastUpdated: new Date().toISOString(),
  };
}

// ── Scoring functions ──

function scoreLeadsTrend(leads: Lead[]): { score: number; label: string; detail: string } {
  if (leads.length === 0) {
    return { score: 0, label: 'אין לידים', detail: 'לא נכנסו לידים עדיין' };
  }

  const now = Date.now();
  const day = 86400000;

  // Recent leads (last 7 days)
  const recent = leads.filter(l => {
    const d = new Date(l.createdAt).getTime();
    return (now - d) < 7 * day;
  });

  // Older leads (7–14 days ago)
  const older = leads.filter(l => {
    const d = new Date(l.createdAt).getTime();
    return (now - d) >= 7 * day && (now - d) < 14 * day;
  });

  if (recent.length === 0 && older.length === 0) {
    // All leads are very old
    return { score: 5, label: 'לידים ישנים', detail: `${leads.length} לידים — כולם לפני 14+ ימים` };
  }

  if (recent.length === 0) {
    return { score: 10, label: 'ירידה בלידים', detail: `0 לידים ב-7 ימים, ${older.length} בשבוע הקודם` };
  }

  // Trend: recent vs older
  const trend = older.length > 0 ? recent.length / older.length : 2;

  if (trend >= 1) {
    return { score: 30, label: 'עליה בלידים', detail: `${recent.length} לידים ב-7 ימים (עלייה של ${Math.round((trend - 1) * 100)}%)` };
  } else if (trend >= 0.5) {
    return { score: 20, label: 'לידים יציבים', detail: `${recent.length} לידים ב-7 ימים (ירידה קלה)` };
  } else {
    return { score: 10, label: 'ירידה חדה', detail: `${recent.length} לידים ב-7 ימים (ירידה של ${Math.round((1 - trend) * 100)}%)` };
  }
}

function scoreCplTrend(ads: Ad[], leads: Lead[]): { score: number; label: string; detail: string } {
  const totalSpend = ads.reduce((s, a) => s + (a.spend || 0), 0);
  const totalLeads = leads.length;

  if (totalSpend === 0 || totalLeads === 0) {
    if (totalSpend === 0) return { score: 12, label: 'אין הוצאה', detail: 'אין הוצאה מדווחת' };
    return { score: 5, label: 'הוצאה ללא לידים', detail: `₪${totalSpend.toLocaleString('he-IL')} הוצאה, 0 לידים` };
  }

  const cpl = totalSpend / totalLeads;

  if (cpl <= 30) {
    return { score: 25, label: 'CPL מצוין', detail: `₪${cpl.toFixed(0)} לליד — יעילות גבוהה` };
  } else if (cpl <= 80) {
    return { score: 20, label: 'CPL סביר', detail: `₪${cpl.toFixed(0)} לליד — ממוצע` };
  } else if (cpl <= 150) {
    return { score: 12, label: 'CPL גבוה', detail: `₪${cpl.toFixed(0)} לליד — יקר` };
  } else {
    return { score: 5, label: 'CPL מאוד גבוה', detail: `₪${cpl.toFixed(0)} לליד — דורש אופטימיזציה דחופה` };
  }
}

function scoreCampaignActivity(campaigns: Campaign[]): { score: number; label: string; detail: string } {
  const active = campaigns.filter(c => c.status === 'active');
  const total = campaigns.length;

  if (total === 0) {
    return { score: 0, label: 'אין קמפיינים', detail: 'לא נוצרו קמפיינים' };
  }

  const ratio = active.length / total;

  if (active.length >= 2 && ratio >= 0.5) {
    return { score: 25, label: 'פעילות גבוהה', detail: `${active.length}/${total} קמפיינים פעילים` };
  } else if (active.length >= 1) {
    return { score: 18, label: 'פעילות בינונית', detail: `${active.length}/${total} קמפיינים פעילים` };
  } else {
    // No active campaigns — check drafts/paused
    const drafts = campaigns.filter(c => c.status === 'draft').length;
    const paused = campaigns.filter(c => c.status === 'paused').length;
    if (drafts > 0 || paused > 0) {
      return { score: 8, label: 'מושהה', detail: `${drafts} טיוטות, ${paused} מושהים — אין פעיל` };
    }
    return { score: 3, label: 'לא פעיל', detail: 'כל הקמפיינים הושלמו או בארכיון' };
  }
}

function scoreEngagement(ads: Ad[]): { score: number; label: string; detail: string } {
  const withImpressions = ads.filter(a => (a.impressions || 0) > 0);

  if (withImpressions.length === 0) {
    return { score: 0, label: 'אין חשיפות', detail: 'אין נתוני חשיפה מדווחים' };
  }

  const totalImpressions = withImpressions.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = withImpressions.reduce((s, a) => s + (a.clicks || 0), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  if (avgCtr >= 2) {
    return { score: 20, label: 'מעורבות גבוהה', detail: `CTR ${avgCtr.toFixed(1)}% — מצוין` };
  } else if (avgCtr >= 1) {
    return { score: 14, label: 'מעורבות סבירה', detail: `CTR ${avgCtr.toFixed(1)}% — ממוצע` };
  } else if (avgCtr > 0) {
    return { score: 7, label: 'מעורבות נמוכה', detail: `CTR ${avgCtr.toFixed(1)}% — צריך שיפור` };
  } else {
    return { score: 3, label: 'אין קליקים', detail: 'חשיפות ללא קליקים' };
  }
}

/**
 * Compute health scores for all clients at once.
 */
export function computeAllClientHealth(
  clients: Client[],
  campaigns: Campaign[],
  ads: Ad[],
  leads: Lead[],
): ClientHealthScore[] {
  return clients
    .filter(c => c.status === 'active')
    .map(c => computeClientHealth(c, campaigns, ads, leads))
    .sort((a, b) => {
      // No data last, then by score ascending (worst first)
      if (a.status === 'no_data' && b.status !== 'no_data') return 1;
      if (b.status === 'no_data' && a.status !== 'no_data') return -1;
      return a.score - b.score;
    });
}
