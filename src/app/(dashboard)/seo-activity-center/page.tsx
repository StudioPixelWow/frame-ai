"use client";
export const dynamic = "force-dynamic";

import React, { useState, useMemo, useCallback } from "react";
import { useData } from "@/lib/api/use-data";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

interface SeoActivityEntry {
  ts: string;
  action: string;
  actor: string;
  details?: string;
}

interface AutomationResult {
  taskId?: string;
  title?: string;
  category?: string;
  status?: string;
  description?: string;
  pageUrl?: string;
  pageTitle?: string;
  seoReason?: string;
  impact?: string;
  before?: string;
  after?: string;
  reversible?: boolean;
  module?: string;
  error?: string;
}

interface AutomationLogEntry {
  date: string;
  dayNumber: number;
  results: AutomationResult[];
  totalTasks: number;
  executedTasks: number;
  successfulTasks: number;
}

interface SeoPlan {
  id: string;
  clientId: string;
  clientName: string;
  websiteUrl: string;
  status: string;
  activityLog?: SeoActivityEntry[];
  automationLog?: AutomationLogEntry[];
  createdAt: string;
  updatedAt: string;
}

// Unified activity item for the timeline
interface ActivityItem {
  id: string;
  timestamp: string;
  category: string;
  status: "completed" | "pending" | "failed" | "in_progress";
  description: string;
  pageUrl?: string;
  pageTitle?: string;
  seoReason?: string;
  impact?: "critical" | "high" | "medium" | "low";
  before?: string;
  after?: string;
  reversible?: boolean;
  module?: string;
  actor?: string;
  dayNumber?: number;
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════

const C = {
  primary: "#00B5FE",
  primaryDark: "#0095D0",
  primaryLight: "#E6F7FF",
  accent: "#E8F401",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  text: "#1A1A2E",
  textSecondary: "#5A5A7A",
  textMuted: "#9A9AB0",
  border: "#E8EAF0",
  borderLight: "#F0F2F5",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
};

const STATUS_COLORS: Record<string, string> = {
  completed: C.success,
  pending: C.warning,
  failed: C.danger,
  in_progress: C.info,
};

const STATUS_LABELS: Record<string, string> = {
  completed: "הושלם",
  pending: "ממתין לאישור",
  failed: "נכשל",
  in_progress: "בביצוע",
};

const CATEGORY_ICONS: Record<string, string> = {
  linking: "🔗",
  content: "📝",
  meta: "🏷️",
  faq: "❓",
  geo: "🌍",
  technical: "🔧",
  strategic: "📊",
  conversion: "📞",
  local: "📍",
  image: "🖼️",
  general: "⚙️",
};

const CATEGORY_LABELS: Record<string, string> = {
  linking: "קישורים",
  content: "תוכן",
  meta: "מטא תגיות",
  faq: "שאלות נפוצות",
  geo: "GEO",
  technical: "טכני",
  strategic: "אסטרטגי",
  conversion: "המרות",
  local: "מקומי",
  image: "תמונות",
  general: "כללי",
};

const CATEGORY_BG: Record<string, string> = {
  linking: "#EFF6FF",
  content: "#F0FDF4",
  meta: "#FFF7ED",
  faq: "#FDF4FF",
  geo: "#ECFDF5",
  technical: "#F1F5F9",
  strategic: "#FEF3C7",
  conversion: "#FFF1F2",
  local: "#E0F2FE",
  image: "#F5F3FF",
  general: "#F3F4F6",
};

const IMPACT_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#FEE2E2", text: "#991B1B" },
  high: { bg: "#FEF3C7", text: "#92400E" },
  medium: { bg: "#DBEAFE", text: "#1E40AF" },
  low: { bg: "#F3F4F6", text: "#374151" },
};

const IMPACT_LABELS: Record<string, string> = {
  critical: "קריטי",
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
};

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}`;

  if (activityDate.getTime() === today.getTime()) return `היום ${time}`;
  if (activityDate.getTime() === yesterday.getTime()) return `אתמול ${time}`;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()} ${time}`;
}

function inferCategory(action: string, title?: string): string {
  const text = `${action} ${title || ""}`.toLowerCase();
  if (text.includes("link") || text.includes("קישור")) return "linking";
  if (text.includes("content") || text.includes("תוכן") || text.includes("article")) return "content";
  if (text.includes("meta") || text.includes("title") || text.includes("description")) return "meta";
  if (text.includes("faq") || text.includes("שאלות")) return "faq";
  if (text.includes("geo") || text.includes("visibility")) return "geo";
  if (text.includes("technical") || text.includes("speed") || text.includes("ssl")) return "technical";
  if (text.includes("strategic") || text.includes("keyword")) return "strategic";
  if (text.includes("conversion") || text.includes("cta")) return "conversion";
  if (text.includes("local") || text.includes("מקומי")) return "local";
  if (text.includes("image") || text.includes("תמונ")) return "image";
  return "general";
}

function inferStatus(result: AutomationResult): ActivityItem["status"] {
  if (result.status === "success" || result.status === "completed") return "completed";
  if (result.status === "failed" || result.status === "error") return "failed";
  if (result.status === "pending" || result.status === "waiting") return "pending";
  if (result.status === "running" || result.status === "in_progress") return "in_progress";
  if (result.error) return "failed";
  return "completed";
}

function inferImpact(result: AutomationResult): ActivityItem["impact"] {
  if (result.impact) {
    const imp = result.impact.toLowerCase();
    if (imp === "critical") return "critical";
    if (imp === "high") return "high";
    if (imp === "medium") return "medium";
    return "low";
  }
  return "medium";
}

function buildActivityItems(plan: SeoPlan): ActivityItem[] {
  const items: ActivityItem[] = [];

  // From activityLog
  if (plan.activityLog) {
    plan.activityLog.forEach((entry, idx) => {
      items.push({
        id: `activity-${plan.id}-${idx}`,
        timestamp: entry.ts,
        category: inferCategory(entry.action),
        status: "completed",
        description: entry.details || entry.action,
        actor: entry.actor,
        module: "activity-log",
      });
    });
  }

  // From automationLog
  if (plan.automationLog) {
    plan.automationLog.forEach((logEntry) => {
      logEntry.results.forEach((result, rIdx) => {
        items.push({
          id: `auto-${plan.id}-${logEntry.dayNumber}-${rIdx}`,
          timestamp: logEntry.date,
          category: inferCategory(result.category || "", result.title),
          status: inferStatus(result),
          description: result.description || result.title || "פעולת אוטומציה",
          pageUrl: result.pageUrl,
          pageTitle: result.pageTitle,
          seoReason: result.seoReason,
          impact: inferImpact(result),
          before: result.before,
          after: result.after,
          reversible: result.reversible,
          module: result.module || "automation",
          dayNumber: logEntry.dayNumber,
        });
      });
    });
  }

  // Sort by timestamp, most recent first
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items;
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function SeoActivityCenterPage() {
  const { data: plans, loading: plansLoading } = useData<SeoPlan>("seo-plans");

  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null);

  // Selected plan
  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  // Build unified activity list
  const allActivities = useMemo(
    () => (selectedPlan ? buildActivityItems(selectedPlan) : []),
    [selectedPlan]
  );

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return allActivities.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = `${item.description} ${item.pageTitle || ""} ${item.pageUrl || ""} ${item.seoReason || ""}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [allActivities, categoryFilter, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = allActivities.length;
    const completed = allActivities.filter((a) => a.status === "completed").length;
    const pending = allActivities.filter((a) => a.status === "pending").length;
    const failed = allActivities.filter((a) => a.status === "failed").length;
    return { total, completed, pending, failed };
  }, [allActivities]);

  // Category counts for sidebar chart
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allActivities.forEach((a) => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [allActivities]);

  const maxCategoryCount = useMemo(
    () => Math.max(...categoryCounts.map(([, c]) => c), 1),
    [categoryCounts]
  );

  // Pending approval items
  const pendingItems = useMemo(
    () => allActivities.filter((a) => a.status === "pending"),
    [allActivities]
  );

  // Quick stats
  const quickStats = useMemo(() => {
    const pagesImproved = new Set(allActivities.filter((a) => a.status === "completed" && a.pageUrl).map((a) => a.pageUrl)).size;
    const linksAdded = allActivities.filter((a) => a.status === "completed" && a.category === "linking").length;
    const faqsAdded = allActivities.filter((a) => a.status === "completed" && a.category === "faq").length;
    const metaUpdated = allActivities.filter((a) => a.status === "completed" && a.category === "meta").length;
    return { pagesImproved, linksAdded, faqsAdded, metaUpdated };
  }, [allActivities]);

  // Weekly summary
  const weeklySummary = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekItems = allActivities.filter((a) => new Date(a.timestamp) >= weekAgo);
    const weekCompleted = weekItems.filter((a) => a.status === "completed").length;
    const weekFailed = weekItems.filter((a) => a.status === "failed").length;
    return { total: weekItems.length, completed: weekCompleted, failed: weekFailed };
  }, [allActivities]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleRollback = useCallback((id: string) => {
    setRollbackConfirm(id);
  }, []);

  const confirmRollback = useCallback(() => {
    // In production this would call an API to rollback
    setRollbackConfirm(null);
  }, []);

  // ────────────────────────────────────────────────────────────
  // STYLES
  // ────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    direction: "rtl",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    background: C.bg,
    minHeight: "100vh",
    padding: "24px",
    color: C.text,
  };

  const headerStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
    borderRadius: "16px",
    padding: "28px 32px",
    marginBottom: "24px",
    color: "#fff",
  };

  const cardStyle: React.CSSProperties = {
    background: C.card,
    borderRadius: "12px",
    border: `1px solid ${C.border}`,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: "8px",
    border: `1px solid ${C.border}`,
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    color: C.text,
    direction: "rtl",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
    minWidth: "140px",
  };

  // ────────────────────────────────────────────────────────────
  // LOADING STATE
  // ────────────────────────────────────────────────────────────

  if (plansLoading) {
    return (
      <div style={pageStyle}>
        <div style={{ ...headerStyle, textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: 700 }}>⏳ טוען נתונים...</div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // PLAN SELECTOR (no plan selected)
  // ────────────────────────────────────────────────────────────

  if (!selectedPlanId || !selectedPlan) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: "28px", fontWeight: 800, marginBottom: "8px" }}>
            🎯 מרכז פעילות SEO/GEO
          </div>
          <div style={{ fontSize: "15px", opacity: 0.9 }}>
            מעקב בזמן אמת אחרי כל פעולות האוטומציה
          </div>
        </div>

        <div style={{ ...cardStyle, padding: "40px", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px", color: C.text }}>
            בחר תוכנית SEO/GEO
          </h2>
          <p style={{ color: C.textSecondary, marginBottom: "24px", fontSize: "15px" }}>
            בחר תוכנית מהרשימה כדי לצפות במרכז הפעילות שלה
          </p>

          {plans.length === 0 ? (
            <div style={{ padding: "24px", background: C.primaryLight, borderRadius: "10px", color: C.primaryDark }}>
              <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
                אין תוכניות SEO/GEO
              </div>
              <div style={{ fontSize: "14px" }}>
                צור תוכנית חדשה דרך עמוד SEO/GEO כדי להתחיל
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  style={{
                    ...cardStyle,
                    padding: "16px 20px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "all 0.2s",
                    border: `1px solid ${C.border}`,
                    background: C.card,
                    textAlign: "right",
                    width: "100%",
                    fontSize: "15px",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = C.primary;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px ${C.primaryLight}`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = C.border;
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: C.text, marginBottom: "4px" }}>
                      {plan.clientName}
                    </div>
                    <div style={{ fontSize: "13px", color: C.textMuted }}>
                      {plan.websiteUrl}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: plan.status === "active" ? "#D1FAE5" : plan.status === "draft" ? "#FEF3C7" : "#F3F4F6",
                      color: plan.status === "active" ? "#065F46" : plan.status === "draft" ? "#92400E" : "#374151",
                    }}
                  >
                    {plan.status === "active" ? "פעיל" : plan.status === "draft" ? "טיוטה" : plan.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // MAIN LAYOUT
  // ────────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      {/* ═══ HEADER ═══ */}
      <div style={headerStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 800, marginBottom: "6px" }}>
              🎯 מרכז פעילות SEO/GEO
            </div>
            <div style={{ fontSize: "15px", opacity: 0.9, marginBottom: "4px" }}>
              מעקב בזמן אמת אחרי כל פעולות האוטומציה
            </div>
            <div style={{ fontSize: "13px", opacity: 0.7 }}>
              {selectedPlan.clientName} — {selectedPlan.websiteUrl}
            </div>
          </div>
          <button
            onClick={() => setSelectedPlanId("")}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            ← החלף תוכנית
          </button>
        </div>

        {/* Stats Bar */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "20px",
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "סה״כ פעולות", value: stats.total, color: "#fff" },
            { label: "הושלמו", value: stats.completed, color: "#A7F3D0" },
            { label: "ממתינים לאישור", value: stats.pending, color: "#FDE68A" },
            { label: "נכשלו", value: stats.failed, color: "#FECACA" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(255,255,255,0.12)",
                borderRadius: "10px",
                padding: "12px 20px",
                minWidth: "130px",
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ fontSize: "28px", fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "13px", opacity: 0.85, marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ FILTER BAR ═══ */}
      <div
        style={{
          ...cardStyle,
          padding: "16px 20px",
          marginBottom: "24px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 600, color: C.textSecondary, marginLeft: "4px" }}>
          🔍 סינון:
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">כל הקטגוריות</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {CATEGORY_ICONS[key]} {label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">כל הסטטוסים</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="חיפוש חופשי..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: "180px" }}
        />

        {(categoryFilter !== "all" || statusFilter !== "all" || searchQuery) && (
          <button
            onClick={() => {
              setCategoryFilter("all");
              setStatusFilter("all");
              setSearchQuery("");
            }}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: `1px solid ${C.danger}`,
              background: "#FEF2F2",
              color: C.danger,
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            נקה סינון
          </button>
        )}

        <div style={{ fontSize: "13px", color: C.textMuted, marginRight: "auto" }}>
          {filteredActivities.length} תוצאות
        </div>
      </div>

      {/* ═══ CONTENT GRID ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px", alignItems: "start" }}>
        {/* ─── MAIN: Timeline Feed ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredActivities.length === 0 ? (
            <div style={{ ...cardStyle, padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
              <div style={{ fontSize: "18px", fontWeight: 600, color: C.text, marginBottom: "8px" }}>
                {allActivities.length === 0 ? "אין פעולות עדיין" : "אין תוצאות לסינון הנוכחי"}
              </div>
              <div style={{ fontSize: "14px", color: C.textMuted }}>
                {allActivities.length === 0
                  ? "ברגע שהאוטומציה תתחיל לעבוד, הפעולות יופיעו כאן"
                  : "נסה לשנות את הסינון כדי לראות תוצאות"}
              </div>
            </div>
          ) : (
            filteredActivities.map((item) => {
              const isExpanded = expandedId === item.id;
              const statusColor = STATUS_COLORS[item.status] || C.textMuted;
              const catIcon = CATEGORY_ICONS[item.category] || "⚙️";
              const catBg = CATEGORY_BG[item.category] || "#F3F4F6";
              const catLabel = CATEGORY_LABELS[item.category] || item.category;
              const impactStyle = item.impact ? IMPACT_COLORS[item.impact] : null;
              const impactLabel = item.impact ? IMPACT_LABELS[item.impact] : null;

              return (
                <div
                  key={item.id}
                  style={{
                    ...cardStyle,
                    padding: "18px 20px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    borderRight: `4px solid ${statusColor}`,
                  }}
                  onClick={() => toggleExpand(item.id)}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    {/* Status dot */}
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: statusColor,
                        marginTop: "5px",
                        flexShrink: 0,
                        boxShadow: `0 0 0 3px ${statusColor}22`,
                      }}
                    />

                    {/* Action icon */}
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        background: catBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        flexShrink: 0,
                      }}
                    >
                      {catIcon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                        <div style={{ fontWeight: 600, fontSize: "15px", color: C.text }}>
                          {item.description}
                        </div>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 600,
                            background: `${statusColor}18`,
                            color: statusColor,
                          }}
                        >
                          {STATUS_LABELS[item.status]}
                        </span>
                        {impactStyle && impactLabel && (
                          <span
                            style={{
                              padding: "2px 10px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: impactStyle.bg,
                              color: impactStyle.text,
                            }}
                          >
                            {impactLabel}
                          </span>
                        )}
                      </div>

                      {/* Page info */}
                      {(item.pageUrl || item.pageTitle) && (
                        <div style={{ fontSize: "13px", color: C.textSecondary, marginBottom: "4px" }}>
                          📄 {item.pageTitle || item.pageUrl}
                          {item.pageUrl && item.pageTitle && (
                            <span style={{ color: C.textMuted, marginRight: "6px", fontSize: "12px" }}>
                              ({item.pageUrl})
                            </span>
                          )}
                        </div>
                      )}

                      {/* SEO Reason */}
                      {item.seoReason && (
                        <div style={{ fontSize: "13px", color: C.info, marginBottom: "4px" }}>
                          💡 {item.seoReason}
                        </div>
                      )}

                      {/* Bottom meta */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "12px", color: C.textMuted }}>
                          🕐 {formatTimestamp(item.timestamp)}
                        </span>
                        <span
                          style={{
                            padding: "1px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            background: catBg,
                            color: C.textSecondary,
                            fontWeight: 500,
                          }}
                        >
                          {catLabel}
                        </span>
                        {item.module && (
                          <span style={{ fontSize: "11px", color: C.textMuted }}>
                            מודול: {item.module}
                          </span>
                        )}
                        {item.dayNumber !== undefined && (
                          <span style={{ fontSize: "11px", color: C.textMuted }}>
                            יום {item.dayNumber}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "12px",
                            color: C.textMuted,
                            marginRight: "auto",
                            cursor: "pointer",
                          }}
                        >
                          {isExpanded ? "▲ סגור" : "▼ פרטים"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ─── Expanded Details ─── */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: "16px",
                        paddingTop: "16px",
                        borderTop: `1px solid ${C.borderLight}`,
                      }}
                    >
                      {/* Before / After */}
                      {(item.before || item.after) && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                          <div
                            style={{
                              padding: "12px",
                              borderRadius: "8px",
                              background: "#FEF2F2",
                              border: "1px solid #FECACA",
                            }}
                          >
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "#991B1B", marginBottom: "6px" }}>
                              ❌ לפני
                            </div>
                            <div style={{ fontSize: "13px", color: "#7F1D1D", wordBreak: "break-word" }}>
                              {item.before || "—"}
                            </div>
                          </div>
                          <div
                            style={{
                              padding: "12px",
                              borderRadius: "8px",
                              background: "#F0FDF4",
                              border: "1px solid #BBF7D0",
                            }}
                          >
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "#166534", marginBottom: "6px" }}>
                              ✅ אחרי
                            </div>
                            <div style={{ fontSize: "13px", color: "#14532D", wordBreak: "break-word" }}>
                              {item.after || "—"}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actor */}
                      {item.actor && (
                        <div style={{ fontSize: "13px", color: C.textSecondary, marginBottom: "8px" }}>
                          👤 בוצע על ידי: <strong>{item.actor}</strong>
                        </div>
                      )}

                      {/* Rollback button */}
                      {item.reversible && item.status === "completed" && (
                        <div style={{ marginTop: "8px" }}>
                          {rollbackConfirm === item.id ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "13px", color: C.danger, fontWeight: 600 }}>
                                בטוח? פעולה זו תבטל את השינוי
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmRollback();
                                }}
                                style={{
                                  padding: "6px 16px",
                                  borderRadius: "6px",
                                  border: "none",
                                  background: C.danger,
                                  color: "#fff",
                                  cursor: "pointer",
                                  fontSize: "13px",
                                  fontWeight: 600,
                                }}
                              >
                                אישור ביטול
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRollbackConfirm(null);
                                }}
                                style={{
                                  padding: "6px 16px",
                                  borderRadius: "6px",
                                  border: `1px solid ${C.border}`,
                                  background: "#fff",
                                  color: C.textSecondary,
                                  cursor: "pointer",
                                  fontSize: "13px",
                                }}
                              >
                                ביטול
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRollback(item.id);
                              }}
                              style={{
                                padding: "6px 18px",
                                borderRadius: "6px",
                                border: `1px solid ${C.danger}`,
                                background: "#FEF2F2",
                                color: C.danger,
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: 600,
                              }}
                            >
                              ↩️ בטל פעולה
                            </button>
                          )}
                        </div>
                      )}

                      {/* No extra details */}
                      {!item.before && !item.after && !item.actor && !item.reversible && (
                        <div style={{ fontSize: "13px", color: C.textMuted, fontStyle: "italic" }}>
                          אין פרטים נוספים לפעולה זו
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ─── SIDEBAR (right in RTL) ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Weekly Summary */}
          <div style={{ ...cardStyle, padding: "20px" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "14px", color: C.text }}>
              📅 סיכום שבועי
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: C.textSecondary }}>סה״כ פעולות</span>
                <span style={{ fontWeight: 700, fontSize: "18px", color: C.text }}>{weeklySummary.total}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: C.textSecondary }}>הושלמו</span>
                <span style={{ fontWeight: 700, fontSize: "18px", color: C.success }}>{weeklySummary.completed}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: C.textSecondary }}>נכשלו</span>
                <span style={{ fontWeight: 700, fontSize: "18px", color: C.danger }}>{weeklySummary.failed}</span>
              </div>
              {weeklySummary.total > 0 && (
                <div style={{ marginTop: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", color: C.textMuted }}>שיעור הצלחה</span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: C.success }}>
                      {Math.round((weeklySummary.completed / weeklySummary.total) * 100)}%
                    </span>
                  </div>
                  <div style={{ height: "6px", borderRadius: "3px", background: C.borderLight }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: "3px",
                        background: C.success,
                        width: `${Math.round((weeklySummary.completed / weeklySummary.total) * 100)}%`,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Category Chart */}
          <div style={{ ...cardStyle, padding: "20px" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "14px", color: C.text }}>
              📊 פעולות לפי קטגוריה
            </div>
            {categoryCounts.length === 0 ? (
              <div style={{ fontSize: "13px", color: C.textMuted, textAlign: "center", padding: "12px" }}>
                אין נתונים להצגה
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {categoryCounts.map(([cat, count]) => (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                      <span style={{ fontSize: "13px", color: C.textSecondary }}>
                        {CATEGORY_ICONS[cat] || "⚙️"} {CATEGORY_LABELS[cat] || cat}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{count}</span>
                    </div>
                    <div style={{ height: "8px", borderRadius: "4px", background: C.borderLight }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: "4px",
                          background: C.primary,
                          width: `${(count / maxCategoryCount) * 100}%`,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approval Queue */}
          <div style={{ ...cardStyle, padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: C.text }}>
                ⏳ ממתינים לאישור
              </div>
              {pendingItems.length > 0 && (
                <span
                  style={{
                    padding: "2px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    background: "#FEF3C7",
                    color: "#92400E",
                  }}
                >
                  {pendingItems.length}
                </span>
              )}
            </div>
            {pendingItems.length === 0 ? (
              <div style={{ fontSize: "13px", color: C.textMuted, textAlign: "center", padding: "12px" }}>
                ✅ אין פעולות ממתינות לאישור
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pendingItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: "#FFFBEB",
                      border: "1px solid #FDE68A",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 600, color: C.text, marginBottom: "4px" }}>
                      {CATEGORY_ICONS[item.category] || "⚙️"} {item.description}
                    </div>
                    {item.pageTitle && (
                      <div style={{ fontSize: "12px", color: C.textMuted, marginBottom: "8px" }}>
                        📄 {item.pageTitle}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        style={{
                          flex: 1,
                          padding: "5px 0",
                          borderRadius: "6px",
                          border: "none",
                          background: C.success,
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        ✅ אשר
                      </button>
                      <button
                        style={{
                          flex: 1,
                          padding: "5px 0",
                          borderRadius: "6px",
                          border: `1px solid ${C.danger}`,
                          background: "#fff",
                          color: C.danger,
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        ❌ דחה
                      </button>
                    </div>
                  </div>
                ))}
                {pendingItems.length > 5 && (
                  <div style={{ fontSize: "12px", color: C.textMuted, textAlign: "center" }}>
                    ועוד {pendingItems.length - 5} פעולות...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div style={{ ...cardStyle, padding: "20px" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "14px", color: C.text }}>
              ⚡ סטטיסטיקות מהירות
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {[
                { label: "דפים שופרו", value: quickStats.pagesImproved, icon: "📄", color: C.info },
                { label: "קישורים נוספו", value: quickStats.linksAdded, icon: "🔗", color: C.primary },
                { label: "שאלות נפוצות", value: quickStats.faqsAdded, icon: "❓", color: "#8B5CF6" },
                { label: "מטא עודכנו", value: quickStats.metaUpdated, icon: "🏷️", color: C.warning },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background: `${s.color}0A`,
                    border: `1px solid ${s.color}20`,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "18px", marginBottom: "4px" }}>{s.icon}</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "2px" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
