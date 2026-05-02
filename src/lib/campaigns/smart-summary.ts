/**
 * Smart Campaign Summary Generator
 *
 * Produces a deterministic 1-line Hebrew summary per campaign
 * based on health score, alerts, structure, targeting, creative.
 * No AI API call — runs instantly on the client.
 */

import type { Campaign } from "@/lib/db/schema";
import { computeHealth, generateCampaignAlerts, type CampaignAlert, type HealthResult } from "./health-engine";

export interface SmartSummary {
  text: string;
  tone: "positive" | "warning" | "critical";
  icon: string;
}

/**
 * Generate a 1-line smart summary for a campaign.
 */
export function generateSmartSummary(campaign: Campaign): SmartSummary {
  const health = computeHealth(campaign);
  const alerts = generateCampaignAlerts(campaign);
  const highAlerts = alerts.filter((a) => a.severity === "high");
  const medAlerts = alerts.filter((a) => a.severity === "medium");

  // Check structural completeness
  const hasCreative = !!(campaign.linkedClientFileId || (campaign.externalMediaUrl && campaign.externalMediaUrl.length > 5));
  const hasCopy = !!(campaign.caption && campaign.caption.trim().length > 5);
  const hasBudget = !!(campaign.budget && campaign.budget > 0);
  const hasObjective = !!(campaign.objective && campaign.objective.trim().length > 3);
  const hasPlatform = !!campaign.platform;
  const hasTargeting = !!(campaign.objective && (campaign.objective.includes("מיקום:") || campaign.objective.includes("עניינים:")));
  const hasHeadline = !!(campaign.notes && campaign.notes.includes("כותרת:"));
  const hasDates = !!(campaign.startDate && campaign.endDate);

  // Completed campaigns
  if (campaign.status === "completed") {
    return { text: "הקמפיין הושלם בהצלחה", tone: "positive", icon: "✅" };
  }

  // Critical issues first
  if (highAlerts.length >= 3) {
    return { text: "הקמפיין דורש טיפול דחוף — מספר בעיות קריטיות", tone: "critical", icon: "🚨" };
  }

  // Active/scheduled but missing essentials
  if ((campaign.status === "active" || campaign.status === "scheduled") && !hasCreative) {
    return { text: "הקמפיין פעיל אך חסר קריאייטיב — לא ניתן לייצר ביצועים", tone: "critical", icon: "🚨" };
  }

  if ((campaign.status === "active" || campaign.status === "scheduled") && !hasCopy) {
    return { text: "הקמפיין פעיל ללא טקסט ראשי — המודעה לא תרוץ", tone: "critical", icon: "🚨" };
  }

  if ((campaign.status === "active" || campaign.status === "scheduled") && !hasBudget) {
    return { text: "הקמפיין פעיל ללא תקציב מוגדר", tone: "critical", icon: "💰" };
  }

  // Stale draft
  if (campaign.status === "draft") {
    const created = campaign.createdAt ? new Date(campaign.createdAt).getTime() : 0;
    const daysSinceCreate = created > 0 ? (Date.now() - created) / 86400000 : 0;
    if (daysSinceCreate > 14) {
      return { text: "טיוטה ישנה — שווה לקדם או לארכב", tone: "warning", icon: "⏰" };
    }
    if (daysSinceCreate > 7) {
      return { text: "טיוטה שלא עודכנה מעל שבוע", tone: "warning", icon: "⏰" };
    }
  }

  // Missing targeting
  if (!hasTargeting && campaign.status !== "draft") {
    if (!hasCreative && !hasCopy) {
      return { text: "הקמפיין לא מוכן לפרסום — חסרים קריאייטיב, טקסט וטרגוט", tone: "critical", icon: "🚫" };
    }
    return { text: "הקמפיין מוכן אך חסר קהל מוגדר", tone: "warning", icon: "🎯" };
  }

  // Health-based summaries
  if (health.score >= 80) {
    if (campaign.status === "active") {
      return { text: "הקמפיין במצב תקין ופעיל", tone: "positive", icon: "✅" };
    }
    if (campaign.status === "scheduled" || campaign.status === "approved") {
      return { text: "הקמפיין מוכן ומחכה להפעלה", tone: "positive", icon: "🟢" };
    }
    if (campaign.status === "waiting_approval") {
      return { text: "הקמפיין מוכן — ממתין לאישור", tone: "positive", icon: "⏳" };
    }
    return { text: "הקמפיין במצב טוב", tone: "positive", icon: "✅" };
  }

  if (health.score >= 50) {
    // Medium — find the main gap
    if (!hasCreative) {
      return { text: "הקמפיין כמעט מוכן — חסר קריאייטיב", tone: "warning", icon: "🖼️" };
    }
    if (!hasCopy) {
      return { text: "הקמפיין כמעט מוכן — חסר טקסט ראשי", tone: "warning", icon: "📝" };
    }
    if (!hasBudget) {
      return { text: "הקמפיין מתקדם אך חסר תקציב", tone: "warning", icon: "💰" };
    }
    if (!hasHeadline) {
      return { text: "הקמפיין במצב סביר — כותרת חדה תשפר ביצועים", tone: "warning", icon: "📰" };
    }
    if (medAlerts.length > 0) {
      return { text: `הקמפיין דורש תשומת לב — ${medAlerts.length} נקודות לשיפור`, tone: "warning", icon: "⚠️" };
    }
    return { text: "הקמפיין דורש השלמת פרטים", tone: "warning", icon: "⚠️" };
  }

  // Weak (< 50)
  if (!hasObjective && !hasCreative && !hasCopy) {
    return { text: "הקמפיין בשלב התחלתי — חסרים כל הפרטים המרכזיים", tone: "critical", icon: "🔴" };
  }
  if (!hasCreative && !hasCopy) {
    return { text: "הקמפיין חלש — חסרים קריאייטיב וטקסט", tone: "critical", icon: "🔴" };
  }

  return { text: "הקמפיין לא מוכן לפרסום — יש להשלים פרטים", tone: "critical", icon: "🔴" };
}
