/**
 * Campaign Health & Alerts Engine
 *
 * Central module for:
 * 1. Computing campaign health scores (0–100)
 * 2. Generating smart alerts per campaign
 * 3. Aggregating alerts across all campaigns
 *
 * No external deps — works purely on Campaign data from the DB.
 */

import type { Campaign, CampaignStatus } from "@/lib/db/schema";

// ══════════════════════════════════════════════════════════════════════════════
// ISRAELI MARKET BENCHMARKS (CPC/CPM in ₪)
// ══════════════════════════════════════════════════════════════════════════════

export const ISRAELI_CPC_BENCHMARKS: Record<string, { min: number; max: number; label: string }> = {
  legal: { min: 35, max: 80, label: "משפטים" },
  ecommerce: { min: 3, max: 8, label: "מסחר אלקטרוני" },
  real_estate: { min: 15, max: 35, label: "נדל\"ן" },
  health: { min: 8, max: 20, label: "בריאות" },
  education: { min: 5, max: 15, label: "חינוך" },
  finance: { min: 20, max: 50, label: "פיננסים" },
  food: { min: 2, max: 6, label: "מזון" },
  fashion: { min: 3, max: 10, label: "אופנה" },
  tech: { min: 8, max: 25, label: "טכנולוגיה" },
  fitness: { min: 4, max: 12, label: "כושר" },
  beauty: { min: 3, max: 9, label: "יופי וטיפוח" },
  automotive: { min: 10, max: 30, label: "רכב" },
  general: { min: 5, max: 15, label: "כללי" },
};

export const ISRAELI_CPM_BENCHMARKS: Record<string, { min: number; max: number }> = {
  facebook: { min: 15, max: 45 },
  instagram: { min: 20, max: 55 },
  tiktok: { min: 10, max: 35 },
  google_search: { min: 25, max: 80 },
  google_display: { min: 5, max: 20 },
};

export const ISRAELI_BUDGET_ALLOCATION_BY_STAGE: Record<string, { google: number; meta: number; tiktok: number; test: number; other: number; label: string }> = {
  early: { google: 60, meta: 30, tiktok: 0, test: 10, other: 0, label: "שלב מוקדם" },
  growth: { google: 45, meta: 35, tiktok: 10, test: 10, other: 0, label: "צמיחה" },
  scale: { google: 35, meta: 30, tiktok: 15, test: 10, other: 10, label: "סקייל" },
};

export const ISRAELI_REGIONAL_CPC_MULTIPLIER: Record<string, number> = {
  tel_aviv: 1.5,
  center: 1.2,
  haifa: 1.0,
  south: 0.7,
  north: 0.75,
  jerusalem: 1.1,
};

export const ISRAELI_NEGATIVE_KEYWORDS = ["חינם", "קורס", "דרושים", "ויקיפדיה", "הורדה", "PDF"];

export const ISRAELI_REGULATION_CHECKLIST = [
  "חובה להציג מחיר כולל מע\"מ",
  "חובה לציין #פרסום בשיתופי פעולה עם משפיענים",
  "חובה לציין תנאי מבצע (תוקף, מלאי)",
  "איסור פרסום מטעה לפי חוק הגנת הצרכן",
];

/**
 * Get CPC benchmark for a given industry. Falls back to 'general'.
 */
export function getCPCBenchmark(industry?: string): { min: number; max: number; label: string } {
  if (!industry) return ISRAELI_CPC_BENCHMARKS.general;
  const key = industry.toLowerCase().replace(/[^a-z_]/g, "");
  return ISRAELI_CPC_BENCHMARKS[key] || ISRAELI_CPC_BENCHMARKS.general;
}

/**
 * Check if a campaign budget seems reasonable for the Israeli market.
 * Returns null if OK, or a warning string.
 */
export function checkBudgetVsBenchmark(dailyBudget: number, industry?: string, region?: string): string | null {
  const bench = getCPCBenchmark(industry);
  const regionMultiplier = region ? (ISRAELI_REGIONAL_CPC_MULTIPLIER[region] || 1.0) : 1.0;
  const effectiveMinCPC = bench.min * regionMultiplier;
  // If daily budget can't buy at least 5 clicks, it's too low
  const minReasonableBudget = effectiveMinCPC * 5;
  if (dailyBudget < minReasonableBudget) {
    return `תקציב יומי של ₪${dailyBudget} נמוך מדי לתחום ${bench.label} — מומלץ לפחות ₪${Math.ceil(minReasonableBudget)}/יום (CPC ממוצע: ₪${bench.min}-${bench.max})`;
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export type HealthLevel = "strong" | "attention" | "weak";

export type AlertSeverity = "high" | "medium" | "low";

export type AlertType =
  | "missing_creative"
  | "missing_copy"
  | "no_targeting"
  | "stale_draft"
  | "missing_budget"
  | "missing_headline"
  | "weak_structure"
  | "incomplete_updated"
  | "budget_too_low_il";

export interface HealthResult {
  score: number;
  level: HealthLevel;
  label: string;
  color: string;
  breakdown: HealthBreakdown;
}

export interface HealthBreakdown {
  structure: number;   // max 25
  creative: number;    // max 25
  targeting: number;   // max 20
  activity: number;    // max 30
}

export interface CampaignAlert {
  id: string;
  campaignId: string;
  clientId: string;
  campaignName: string;
  clientName: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  createdAt: string;
  resolved: boolean;
}

export interface AlertsSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  byType: Partial<Record<AlertType, number>>;
  byClient: Record<string, { clientName: string; count: number; highCount: number }>;
}

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH SCORE — UPGRADED
// ══════════════════════════════════════════════════════════════════════════════

const STATUS_ACTIVITY_BONUS: Partial<Record<CampaignStatus, number>> = {
  active: 12,
  scheduled: 10,
  approved: 8,
  waiting_approval: 6,
  in_progress: 4,
  completed: 12,
  draft: 0,
};

/**
 * Compute health score for a single campaign.
 *
 * Categories:
 *   Structure (25): objective, platform, budget, dates
 *   Creative  (25): creative file, primary text, headline
 *   Targeting (20): geo targeting in objective, interests in objective
 *   Activity  (30): status bonus, recency, stale penalty
 */
export function computeHealth(c: any): HealthResult {
  const breakdown: HealthBreakdown = { structure: 0, creative: 0, targeting: 0, activity: 0 };

  // ── Structure (max 25) ──
  if (c.objective && c.objective.trim().length > 3) breakdown.structure += 7;
  if (c.platform) breakdown.structure += 5;
  if (c.budget && c.budget > 0) breakdown.structure += 7;
  if (c.startDate) breakdown.structure += 3;
  if (c.endDate) breakdown.structure += 3;

  // ── Creative (max 25) ──
  if (c.linkedClientFileId || (c.externalMediaUrl && c.externalMediaUrl.length > 5)) breakdown.creative += 10;
  if (c.caption && c.caption.trim().length > 5) breakdown.creative += 10;
  const notesStr = c.notes || "";
  const hasHeadline = notesStr.includes("כותרת:");
  if (hasHeadline) breakdown.creative += 5;

  // ── Targeting (max 20) ──
  const objStr = c.objective || "";
  if (objStr.includes("מיקום:") || objStr.includes("מיקומי")) breakdown.targeting += 10;
  if (objStr.includes("עניינים:") || objStr.includes("תחומי עניין")) breakdown.targeting += 10;

  // ── Activity (max 30) ──
  // Status bonus (0–12)
  breakdown.activity += (STATUS_ACTIVITY_BONUS as any)[c.status] ?? 0;

  // Recency bonus (0–12): how recently updated
  const now = Date.now();
  const updated = c.updatedAt ? new Date(c.updatedAt).getTime() : (c.createdAt ? new Date(c.createdAt).getTime() : 0);
  if (updated > 0) {
    const daysSinceUpdate = (now - updated) / 86400000;
    if (daysSinceUpdate < 1) breakdown.activity += 12;
    else if (daysSinceUpdate < 3) breakdown.activity += 10;
    else if (daysSinceUpdate < 7) breakdown.activity += 7;
    else if (daysSinceUpdate < 14) breakdown.activity += 4;
    else if (daysSinceUpdate < 30) breakdown.activity += 2;
    // else 0
  }

  // Stale draft penalty (0 to -6)
  if (c.status === "draft") {
    const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    if (created > 0) {
      const daysSinceCreate = (now - created) / 86400000;
      if (daysSinceCreate > 14) breakdown.activity = Math.max(0, breakdown.activity - 6);
      else if (daysSinceCreate > 7) breakdown.activity = Math.max(0, breakdown.activity - 3);
    }
  }

  // Non-draft completed campaigns get a completion bonus
  if (c.status === "completed") breakdown.activity += 6;

  const rawScore = breakdown.structure + breakdown.creative + breakdown.targeting + breakdown.activity;
  const score = Math.min(100, Math.max(0, rawScore));

  const level: HealthLevel = score >= 80 ? "strong" : score >= 50 ? "attention" : "weak";
  const label = level === "strong" ? "תקין" : level === "attention" ? "דורש תשומת לב" : "חלש";
  const color = level === "strong" ? "#22c55e" : level === "attention" ? "#f59e0b" : "#ef4444";

  return { score, level, label, color, breakdown };
}

// ══════════════════════════════════════════════════════════════════════════════
// ALERTS ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const ALERT_MESSAGES: Record<AlertType, (name: string) => string> = {
  missing_creative: (n) => `הקמפיין "${n}" עדיין ללא קריאייטיב — לא ניתן לייצר ביצועים ללא מדיה`,
  missing_copy: (n) => `"${n}" חסר טקסט ראשי — המודעה לא תוכל לרוץ ללא קופי`,
  no_targeting: (n) => `"${n}" ללא הגדרת טרגוט — הקמפיין לא ממוקד`,
  stale_draft: (n) => `"${n}" בסטטוס טיוטה כבר מספר ימים — שווה לקדם או לארכב`,
  missing_budget: (n) => `"${n}" ללא תקציב מוגדר — הקמפיין לא מוכן להפעלה`,
  missing_headline: (n) => `"${n}" ללא כותרת — כותרת חדה משפרת CTR משמעותית`,
  weak_structure: (n) => `"${n}" עם ציון מבנה נמוך — חסרים פרטי בסיס חיוניים`,
  incomplete_updated: (n) => `"${n}" עודכן לאחרונה אך עדיין לא מוכן — חסרים פרטים`,
  budget_too_low_il: (n) => `"${n}" — התקציב נמוך מדי לשוק הישראלי, לא יספיק ליצור תנועה משמעותית`,
};

function makeAlertId(campaignId: string, type: AlertType): string {
  return `${campaignId}:${type}`;
}

/**
 * Generate alerts for a single campaign.
 */
export function generateCampaignAlerts(c: any): CampaignAlert[] {
  const alerts: CampaignAlert[] = [];
  const now = Date.now();
  const name = c.campaignName || "ללא שם";

  const push = (type: AlertType, severity: AlertSeverity) => {
    alerts.push({
      id: makeAlertId(c.id, type),
      campaignId: c.id,
      clientId: c.clientId,
      campaignName: name,
      clientName: c.clientName || "",
      type,
      severity,
      message: ALERT_MESSAGES[type](name),
      createdAt: new Date().toISOString(),
      resolved: false,
    });
  };

  // Skip completed campaigns — they're done
  if (c.status === "completed") return alerts;

  // 1. Missing creative
  const hasCreative = !!(c.linkedClientFileId || (c.externalMediaUrl && c.externalMediaUrl.length > 5));
  if (!hasCreative) {
    const sev = c.status === "active" || c.status === "scheduled" ? "high" : c.status === "draft" ? "low" : "medium";
    push("missing_creative", sev);
  }

  // 2. Missing copy
  const hasCopy = !!(c.caption && c.caption.trim().length > 5);
  if (!hasCopy) {
    const sev = c.status === "active" || c.status === "scheduled" ? "high" : "medium";
    push("missing_copy", sev);
  }

  // 3. No targeting
  const objStr = c.objective || "";
  const hasTargeting = objStr.includes("מיקום:") || objStr.includes("עניינים:");
  if (!hasTargeting) {
    push("no_targeting", c.status === "active" ? "high" : "low");
  }

  // 4. Stale draft
  if (c.status === "draft") {
    const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    if (created > 0) {
      const daysSinceCreate = (now - created) / 86400000;
      if (daysSinceCreate > 7) {
        push("stale_draft", daysSinceCreate > 14 ? "high" : "medium");
      }
    }
  }

  // 5. Missing budget
  if ((!c.budget || c.budget <= 0) && c.status !== "draft") {
    push("missing_budget", c.status === "active" || c.status === "scheduled" ? "high" : "medium");
  }

  // 5b. Budget too low for Israeli market (check daily budget against benchmarks)
  if (c.budget && c.budget > 0 && c.status !== "draft" && c.status !== "completed") {
    const budgetWarning = checkBudgetVsBenchmark(c.budget, c.industry || c.businessField);
    if (budgetWarning) {
      push("budget_too_low_il", c.status === "active" ? "high" : "medium");
    }
  }

  // 6. Missing headline
  const notesStr = c.notes || "";
  if (!notesStr.includes("כותרת:") && c.status !== "draft") {
    push("missing_headline", "low");
  }

  // 7. Weak structure
  const health = computeHealth(c);
  if (health.breakdown.structure < 12 && c.status !== "draft") {
    push("weak_structure", health.score < 30 ? "high" : "medium");
  }

  // 8. Recently updated but incomplete
  const updated = c.updatedAt ? new Date(c.updatedAt).getTime() : 0;
  if (updated > 0) {
    const daysSinceUpdate = (now - updated) / 86400000;
    if (daysSinceUpdate < 3 && health.score < 50 && c.status !== "draft") {
      push("incomplete_updated", "medium");
    }
  }

  return alerts;
}

/**
 * Generate alerts for ALL campaigns. Returns flat list sorted by severity.
 */
export function generateAllAlerts(campaigns: any[]): CampaignAlert[] {
  const allAlerts: CampaignAlert[] = [];
  for (const c of (campaigns ?? [])) {
    allAlerts.push(...generateCampaignAlerts(c));
  }

  // Sort: high > medium > low, then by campaignName
  const sevOrder: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };
  allAlerts.sort((a, b) => {
    const diff = sevOrder[a.severity] - sevOrder[b.severity];
    if (diff !== 0) return diff;
    return a.campaignName.localeCompare(b.campaignName);
  });

  return allAlerts;
}

/**
 * Aggregate alerts into a summary.
 */
export function summarizeAlerts(alerts: CampaignAlert[]): AlertsSummary {
  const safeAlerts = alerts ?? [];
  const summary: AlertsSummary = {
    total: safeAlerts.length,
    high: 0,
    medium: 0,
    low: 0,
    byType: {},
    byClient: {},
  };

  for (const a of safeAlerts) {
    if (a.severity === "high") summary.high++;
    else if (a.severity === "medium") summary.medium++;
    else summary.low++;

    summary.byType[a.type] = (summary.byType[a.type] || 0) + 1;

    if (!summary.byClient[a.clientId]) {
      summary.byClient[a.clientId] = { clientName: a.clientName, count: 0, highCount: 0 };
    }
    summary.byClient[a.clientId].count++;
    if (a.severity === "high") summary.byClient[a.clientId].highCount++;
  }

  return summary;
}

// ══════════════════════════════════════════════════════════════════════════════
// ALERT TYPE LABELS (for UI)
// ══════════════════════════════════════════════════════════════════════════════

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  missing_creative: "חסר קריאייטיב",
  missing_copy: "חסר קופי",
  no_targeting: "אין טרגוט",
  stale_draft: "טיוטה ישנה",
  missing_budget: "חסר תקציב",
  missing_headline: "חסר כותרת",
  weak_structure: "מבנה חלש",
  incomplete_updated: "עודכן אך לא מוכן",
  budget_too_low_il: "תקציב נמוך לשוק IL",
};

export const ALERT_TYPE_ICONS: Record<AlertType, string> = {
  missing_creative: "🖼️",
  missing_copy: "📝",
  no_targeting: "🎯",
  stale_draft: "⏰",
  missing_budget: "💰",
  missing_headline: "📰",
  weak_structure: "⚠️",
  incomplete_updated: "🔄",
  budget_too_low_il: "📉",
};

export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#6b7280",
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
};

// ══════════════════════════════════════════════════════════════════════════════
// HIGHLIGHT GENERATORS (for Command Center)
// ══════════════════════════════════════════════════════════════════════════════

export interface AlertHighlight {
  icon: string;
  text: string;
  count: number;
  severity: AlertSeverity;
}

export function generateHighlights(alerts: CampaignAlert[]): AlertHighlight[] {
  const highlights: AlertHighlight[] = [];
  const summary = summarizeAlerts(alerts);

  const weakStructureCount = summary.byType.weak_structure || 0;
  if (weakStructureCount > 0) {
    highlights.push({
      icon: "⚠️",
      text: `${weakStructureCount} קמפיינים עם בעיות מבנה`,
      count: weakStructureCount,
      severity: "high",
    });
  }

  const noCreativeCount = summary.byType.missing_creative || 0;
  if (noCreativeCount > 0) {
    highlights.push({
      icon: "🖼️",
      text: `${noCreativeCount} קמפיינים ללא קריאייטיב`,
      count: noCreativeCount,
      severity: "medium",
    });
  }

  const staleDraftCount = summary.byType.stale_draft || 0;
  if (staleDraftCount > 0) {
    highlights.push({
      icon: "⏰",
      text: `${staleDraftCount} קמפיינים במצב טיוטה יותר מדי זמן`,
      count: staleDraftCount,
      severity: "medium",
    });
  }

  const noBudgetCount = summary.byType.missing_budget || 0;
  if (noBudgetCount > 0) {
    highlights.push({
      icon: "💰",
      text: `${noBudgetCount} קמפיינים ללא תקציב מוגדר`,
      count: noBudgetCount,
      severity: "medium",
    });
  }

  const noCopyCount = summary.byType.missing_copy || 0;
  if (noCopyCount > 0) {
    highlights.push({
      icon: "📝",
      text: `${noCopyCount} קמפיינים ללא טקסט ראשי`,
      count: noCopyCount,
      severity: "low",
    });
  }

  const noTargetingCount = summary.byType.no_targeting || 0;
  if (noTargetingCount > 0) {
    highlights.push({
      icon: "🎯",
      text: `${noTargetingCount} קמפיינים ללא הגדרת טרגוט`,
      count: noTargetingCount,
      severity: "low",
    });
  }

  return highlights;
}
