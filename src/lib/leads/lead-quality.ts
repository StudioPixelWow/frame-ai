/**
 * Lead Quality & Attribution Engine
 *
 * Central module for:
 * 1. Computing lead quality scores (0–100)
 * 2. Generating quality labels (גבוהה/בינונית/נמוכה)
 * 3. Response time calculations
 * 4. Funnel status configuration (expanded)
 * 5. Campaign-to-lead insights
 *
 * No external deps — works purely on Lead + Campaign data.
 */

import type { Lead, LeadStatus, Campaign } from "@/lib/db/schema";

// ══════════════════════════════════════════════════════════════════════════════
// EXPANDED FUNNEL STATUSES
// ══════════════════════════════════════════════════════════════════════════════

export type ExtendedLeadStatus =
  | "new"
  | "assigned"
  | "contacted"
  | "no_answer"
  | "interested"
  | "proposal_sent"
  | "negotiation"
  | "meeting_set"
  | "won"
  | "lost"
  | "not_relevant"
  | "duplicate";

export interface FunnelStage {
  id: ExtendedLeadStatus;
  label: string;
  color: string;
  borderColor: string;
  icon: string;
  order: number;
  /** Active funnel stages (not terminal) */
  isActive: boolean;
  /** Terminal = won/lost/not_relevant/duplicate */
  isTerminal: boolean;
}

export const FUNNEL_STAGES: FunnelStage[] = [
  { id: "new",           label: "חדש",           color: "#3b82f6", borderColor: "#3b82f6", icon: "✨", order: 0, isActive: true,  isTerminal: false },
  { id: "assigned",      label: "שויך",          color: "#6366f1", borderColor: "#6366f1", icon: "👤", order: 1, isActive: true,  isTerminal: false },
  { id: "contacted",     label: "נוצר קשר",      color: "#f59e0b", borderColor: "#f59e0b", icon: "📞", order: 2, isActive: true,  isTerminal: false },
  { id: "no_answer",     label: "לא ענה",         color: "#f97316", borderColor: "#f97316", icon: "📵", order: 3, isActive: true,  isTerminal: false },
  { id: "interested",    label: "מתעניין",        color: "#06b6d4", borderColor: "#06b6d4", icon: "💡", order: 4, isActive: true,  isTerminal: false },
  { id: "proposal_sent", label: "נשלחה הצעה",     color: "#a855f7", borderColor: "#a855f7", icon: "📋", order: 5, isActive: true,  isTerminal: false },
  { id: "negotiation",   label: 'במו"מ',          color: "#ec4899", borderColor: "#ec4899", icon: "🤝", order: 6, isActive: true,  isTerminal: false },
  { id: "meeting_set",   label: "נקבעה פגישה",    color: "#14b8a6", borderColor: "#14b8a6", icon: "📅", order: 7, isActive: true,  isTerminal: false },
  { id: "won",           label: "נסגר",           color: "#22c55e", borderColor: "#22c55e", icon: "🏆", order: 8, isActive: false, isTerminal: true },
  { id: "lost",          label: "אבוד",           color: "#ef4444", borderColor: "#ef4444", icon: "❌", order: 9, isActive: false, isTerminal: true },
  { id: "not_relevant",  label: "לא רלוונטי",     color: "#6b7280", borderColor: "#6b7280", icon: "🚫", order: 10, isActive: false, isTerminal: true },
  { id: "duplicate",     label: "כפול",           color: "#9ca3af", borderColor: "#9ca3af", icon: "📄", order: 11, isActive: false, isTerminal: true },
];

export const FUNNEL_STAGE_MAP: Record<string, FunnelStage> = {};
for (const s of FUNNEL_STAGES) {
  FUNNEL_STAGE_MAP[s.id] = s;
}

/** Get stage config for any status string, fallback to "new" */
export function getStage(status: string): FunnelStage {
  return FUNNEL_STAGE_MAP[status] || FUNNEL_STAGES[0];
}

// ══════════════════════════════════════════════════════════════════════════════
// LEAD QUALITY SCORING
// ══════════════════════════════════════════════════════════════════════════════

export type QualityLevel = "high" | "medium" | "low";

export interface QualityResult {
  score: number;       // 0-100
  level: QualityLevel;
  label: string;       // Hebrew label
  color: string;
  breakdown: QualityBreakdown;
}

export interface QualityBreakdown {
  responseTime: number;      // max 25 — how fast was the lead responded to
  progression: number;       // max 30 — how far in funnel
  completeness: number;      // max 20 — how much info we have
  engagement: number;        // max 25 — source quality + notes + follow-ups
}

/** Status progression score */
const STATUS_PROGRESSION: Record<string, number> = {
  new: 0,
  assigned: 4,
  contacted: 8,
  no_answer: 6,
  interested: 14,
  proposal_sent: 18,
  negotiation: 22,
  meeting_set: 26,
  won: 30,
  lost: 10,
  not_relevant: 2,
  duplicate: 0,
};

/** Higher quality sources */
const SOURCE_QUALITY: Record<string, number> = {
  "המלצה": 10,
  "ישירות": 8,
  "אתר אינטרנט": 7,
  "LinkedIn": 6,
  "קמפיין מיוחד": 5,
  "רשתות חברתיות": 4,
  "פייסבוק": 4,
  "אירוע": 6,
};

/**
 * Compute quality score for a single lead.
 */
export function computeLeadQuality(lead: Lead): QualityResult {
  const breakdown: QualityBreakdown = { responseTime: 0, progression: 0, completeness: 0, engagement: 0 };
  const now = Date.now();

  // ── Response Time (max 25) ──
  // Based on how quickly the lead moved from "new" to next status
  const created = lead.createdAt ? new Date(lead.createdAt).getTime() : 0;
  const updated = lead.updatedAt ? new Date(lead.updatedAt).getTime() : 0;

  if (created > 0 && lead.status !== "new") {
    // Has progressed — estimate response time from created→updated
    const responseHours = updated > created ? (updated - created) / 3600000 : 0;
    if (responseHours < 1) breakdown.responseTime = 25;
    else if (responseHours < 4) breakdown.responseTime = 22;
    else if (responseHours < 12) breakdown.responseTime = 18;
    else if (responseHours < 24) breakdown.responseTime = 14;
    else if (responseHours < 48) breakdown.responseTime = 10;
    else if (responseHours < 72) breakdown.responseTime = 6;
    else breakdown.responseTime = 2;
  } else if (created > 0 && lead.status === "new") {
    // Still new — penalize based on age
    const ageHours = (now - created) / 3600000;
    if (ageHours < 2) breakdown.responseTime = 20;
    else if (ageHours < 6) breakdown.responseTime = 15;
    else if (ageHours < 24) breakdown.responseTime = 10;
    else if (ageHours < 48) breakdown.responseTime = 5;
    else breakdown.responseTime = 0;
  }

  // ── Progression (max 30) ──
  breakdown.progression = STATUS_PROGRESSION[lead.status] ?? 0;

  // ── Completeness (max 20) ──
  if (lead.fullName && lead.fullName.trim().length > 1) breakdown.completeness += 4;
  if (lead.email && lead.email.trim().length > 3) breakdown.completeness += 4;
  if (lead.phone && lead.phone.trim().length > 5) breakdown.completeness += 3;
  if (lead.company && lead.company.trim().length > 1) breakdown.completeness += 3;
  if (lead.source && lead.source.trim().length > 0) breakdown.completeness += 3;
  if ((lead.proposalAmount || 0) > 0) breakdown.completeness += 3;

  // ── Engagement (max 25) ──
  // Source quality (0-10)
  breakdown.engagement += SOURCE_QUALITY[lead.source] ?? 3;

  // Has notes (0-5)
  if (lead.notes && lead.notes.trim().length > 10) breakdown.engagement += 5;
  else if (lead.notes && lead.notes.trim().length > 0) breakdown.engagement += 2;

  // Has follow-up set (0-5)
  if (lead.followUpAt) breakdown.engagement += 5;

  // Has assignee (0-5)
  if (lead.assigneeId) breakdown.engagement += 5;

  const rawScore = breakdown.responseTime + breakdown.progression + breakdown.completeness + breakdown.engagement;
  const score = Math.min(100, Math.max(0, rawScore));

  const level: QualityLevel = score >= 65 ? "high" : score >= 35 ? "medium" : "low";
  const label = level === "high" ? "גבוהה" : level === "medium" ? "בינונית" : "נמוכה";
  const color = level === "high" ? "#22c55e" : level === "medium" ? "#f59e0b" : "#ef4444";

  return { score, level, label, color, breakdown };
}

// ══════════════════════════════════════════════════════════════════════════════
// RESPONSE TIME HELPERS
// ══════════════════════════════════════════════════════════════════════════════

export interface ResponseTimeInfo {
  hours: number;
  label: string;
  color: string;
  isOverdue: boolean;
}

export function getResponseTime(lead: Lead): ResponseTimeInfo {
  const now = Date.now();
  const created = lead.createdAt ? new Date(lead.createdAt).getTime() : 0;
  if (!created) return { hours: 0, label: "-", color: "#6b7280", isOverdue: false };

  if (lead.status === "new") {
    // Still new — show time waiting
    const hours = (now - created) / 3600000;
    if (hours < 1) return { hours, label: "פחות משעה", color: "#22c55e", isOverdue: false };
    if (hours < 4) return { hours, label: `${Math.round(hours)} שעות`, color: "#22c55e", isOverdue: false };
    if (hours < 12) return { hours, label: `${Math.round(hours)} שעות`, color: "#f59e0b", isOverdue: false };
    if (hours < 24) return { hours, label: `${Math.round(hours)} שעות`, color: "#f59e0b", isOverdue: true };
    if (hours < 48) return { hours, label: "יום+", color: "#ef4444", isOverdue: true };
    return { hours, label: `${Math.round(hours / 24)} ימים`, color: "#ef4444", isOverdue: true };
  }

  // Already progressed — show time it took
  const updated = lead.updatedAt ? new Date(lead.updatedAt).getTime() : created;
  const hours = (updated - created) / 3600000;
  if (hours < 1) return { hours, label: "< שעה", color: "#22c55e", isOverdue: false };
  if (hours < 24) return { hours, label: `${Math.round(hours)} שעות`, color: "#22c55e", isOverdue: false };
  return { hours, label: `${Math.round(hours / 24)} ימים`, color: "#f59e0b", isOverdue: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN ↔ LEAD INSIGHTS
// ══════════════════════════════════════════════════════════════════════════════

export interface CampaignLeadInsight {
  campaignId: string;
  campaignName: string;
  clientId: string | null;
  leadCount: number;
  highQualityCount: number;
  wonCount: number;
  avgQualityScore: number;
  totalValue: number;
}

/**
 * Build campaign → lead insights map.
 */
export function buildCampaignLeadInsights(
  leads: Lead[],
  campaigns: Campaign[]
): CampaignLeadInsight[] {
  // Group leads by campaignId
  const byCampaign: Record<string, Lead[]> = {};
  for (const l of leads) {
    if (l.campaignId) {
      if (!byCampaign[l.campaignId]) byCampaign[l.campaignId] = [];
      byCampaign[l.campaignId].push(l);
    }
  }

  const insights: CampaignLeadInsight[] = [];

  for (const c of campaigns) {
    const cLeads = byCampaign[c.id] || [];
    if (cLeads.length === 0) {
      insights.push({
        campaignId: c.id,
        campaignName: c.campaignName || "ללא שם",
        clientId: c.clientId,
        leadCount: 0,
        highQualityCount: 0,
        wonCount: 0,
        avgQualityScore: 0,
        totalValue: 0,
      });
      continue;
    }

    let totalScore = 0;
    let highCount = 0;
    let wonCount = 0;
    let totalVal = 0;

    for (const l of cLeads) {
      const q = computeLeadQuality(l);
      totalScore += q.score;
      if (q.level === "high") highCount++;
      if (l.status === "won") wonCount++;
      totalVal += l.proposalAmount || 0;
    }

    insights.push({
      campaignId: c.id,
      campaignName: c.campaignName || "ללא שם",
      clientId: c.clientId,
      leadCount: cLeads.length,
      highQualityCount: highCount,
      wonCount,
      avgQualityScore: Math.round(totalScore / cLeads.length),
      totalValue: totalVal,
    });
  }

  return insights;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMAND CENTER LEAD HIGHLIGHTS
// ══════════════════════════════════════════════════════════════════════════════

export interface LeadHighlight {
  icon: string;
  text: string;
  count: number;
  severity: "high" | "medium" | "low";
}

export function generateLeadHighlights(leads: Lead[], campaigns: Campaign[]): LeadHighlight[] {
  const highlights: LeadHighlight[] = [];
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const safeLeads = leads || [];

  // Leads today
  const leadsToday = safeLeads.filter(
    (l) => l.createdAt && new Date(l.createdAt).getTime() >= todayStart.getTime()
  );
  if (leadsToday.length > 0) {
    highlights.push({
      icon: "✨",
      text: `${leadsToday.length} לידים חדשים היום`,
      count: leadsToday.length,
      severity: "low",
    });
  }

  // Unassigned leads (not new — they're expected to be unassigned)
  const unassigned = safeLeads.filter(
    (l) => !l.assigneeId && l.status !== "new" && l.status !== "won" && l.status !== "not_relevant" && l.status !== "lost" && l.status !== "duplicate"
  );
  if (unassigned.length > 0) {
    highlights.push({
      icon: "👤",
      text: `${unassigned.length} לידים ללא שיוך`,
      count: unassigned.length,
      severity: unassigned.length > 5 ? "high" : "medium",
    });
  }

  // Slow response leads (new for > 24h)
  const slowResponse = safeLeads.filter((l) => {
    if (l.status !== "new" || !l.createdAt) return false;
    return (now - new Date(l.createdAt).getTime()) > 24 * 3600000;
  });
  if (slowResponse.length > 0) {
    highlights.push({
      icon: "🐌",
      text: `${slowResponse.length} לידים חדשים ללא מענה מעל 24 שעות`,
      count: slowResponse.length,
      severity: "high",
    });
  }

  // High quality leads
  const highQuality = safeLeads.filter((l) => {
    if (l.status === "won" || l.status === "not_relevant" || l.status === "lost" || l.status === "duplicate") return false;
    return computeLeadQuality(l).level === "high";
  });
  if (highQuality.length > 0) {
    highlights.push({
      icon: "⭐",
      text: `${highQuality.length} לידים באיכות גבוהה בטיפול`,
      count: highQuality.length,
      severity: "low",
    });
  }

  // Campaigns with zero leads
  const insights = buildCampaignLeadInsights(safeLeads, campaigns || []);
  const activeCampaignsNoLeads = insights.filter((i) => {
    const c = (campaigns || []).find((cc) => cc.id === i.campaignId);
    return c && (c.status === "active" || c.status === "scheduled") && i.leadCount === 0;
  });
  if (activeCampaignsNoLeads.length > 0) {
    highlights.push({
      icon: "📊",
      text: `${activeCampaignsNoLeads.length} קמפיינים פעילים ללא לידים`,
      count: activeCampaignsNoLeads.length,
      severity: "medium",
    });
  }

  return highlights;
}

// ══════════════════════════════════════════════════════════════════════════════
// QUALITY LABELS (for UI)
// ══════════════════════════════════════════════════════════════════════════════

export const QUALITY_LABELS: Record<QualityLevel, string> = {
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
};

export const QUALITY_COLORS: Record<QualityLevel, string> = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
};
