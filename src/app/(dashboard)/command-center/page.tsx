"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useClients,
  useCampaigns,
  useLeads,
  usePayments,
} from "@/lib/api/use-entity";
import { useOperationalAlerts } from "@/lib/alerts/use-alerts";
import { SkeletonKPIRow, SkeletonGrid } from "@/components/ui/skeleton";
import type {
  Campaign,
  Lead,
  Client,
  CampaignStatus,
  CampaignPlatform,
  CampaignType,
} from "@/lib/db/schema";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "טיוטה",
  in_progress: "בתהליך",
  waiting_approval: "ממתין לאישור",
  approved: "מאושר",
  scheduled: "מתוזמן",
  active: "פעיל",
  completed: "הושלם",
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "#6b7280",
  in_progress: "#3b82f6",
  waiting_approval: "#f59e0b",
  approved: "#10b981",
  scheduled: "#8b5cf6",
  active: "#22c55e",
  completed: "#00B5FE",
};

/** Sort priority: active first, then in-progress, etc. Error/unknown pushed to end. */
const STATUS_ORDER: Record<string, number> = {
  active: 0,
  in_progress: 1,
  scheduled: 2,
  waiting_approval: 3,
  approved: 4,
  draft: 5,
  completed: 7,
};

const PLATFORM_LABELS: Record<CampaignPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  multi_platform: "מולטי-פלטפורמה",
};

const PLATFORM_ICONS: Record<CampaignPlatform, string> = {
  facebook: "📘",
  instagram: "📸",
  tiktok: "🎵",
  multi_platform: "🌐",
};

const TYPE_LABELS: Record<CampaignType, string> = {
  paid_social: "ממומן",
  organic_social: "אורגני",
  lead_gen: "לידים",
  awareness: "מודעות",
  remarketing: "רימרקטינג",
  podcast_promo: "קידום פודקאסט",
  custom: "מותאם",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getDateLabel(): string {
  return new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  return "ערב טוב";
}

/**
 * Health Score MVP — computes 0-100 from available campaign data.
 *
 * Factors (max 100):
 *   Status weight   40pt
 *   Budget present  15pt
 *   Dates defined   15pt  (8 start + 7 end)
 *   Creative linked 10pt
 *   Has leads       10pt
 *   Has caption     10pt
 */
function computeHealthScore(campaign: Campaign, campaignLeads: Lead[]): number {
  let score = 0;

  // Status weight (max 40)
  const statusScores: Record<CampaignStatus, number> = {
    active: 40,
    scheduled: 35,
    approved: 30,
    in_progress: 25,
    waiting_approval: 20,
    completed: 35,
    draft: 10,
  };
  score += statusScores[campaign.status] ?? 10;

  // Budget defined (max 15)
  if (campaign.budget > 0) score += 15;

  // Has start + end date (max 15)
  if (campaign.startDate) score += 8;
  if (campaign.endDate) score += 7;

  // Has creative attached (max 10)
  if (
    campaign.linkedClientFileId ||
    campaign.linkedVideoProjectId ||
    campaign.externalMediaUrl
  ) {
    score += 10;
  }

  // Has leads flowing (max 10)
  if (campaignLeads.length > 0) score += 10;

  // Has caption / content (max 10)
  if (campaign.caption && campaign.caption.trim().length > 10) score += 10;

  return Math.min(100, Math.max(0, score));
}

function getHealthColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function getHealthLabel(score: number): string {
  if (score >= 80) return "מצוין";
  if (score >= 60) return "טוב";
  if (score >= 40) return "דורש תשומת לב";
  return "קריטי";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KPICard({
  value,
  label,
  icon,
  color,
  subtext,
}: {
  value: string | number;
  label: string;
  icon: string;
  color: string;
  subtext?: string;
}) {
  return (
    <div
      className="premium-card"
      style={{
        textAlign: "center",
        padding: "1.25rem 1rem",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{icon}</div>
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color,
          lineHeight: 1,
          marginBottom: "0.35rem",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.72rem",
          color: "var(--foreground-muted)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      {subtext && (
        <div
          style={{
            fontSize: "0.68rem",
            color: "var(--foreground-muted)",
            marginTop: "0.25rem",
            opacity: 0.7,
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  severity,
  title,
  description,
  time,
}: {
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  time?: string;
}) {
  const colors = {
    critical: {
      bg: "rgba(239,68,68,0.08)",
      border: "rgba(239,68,68,0.25)",
      icon: "🔴",
      text: "#ef4444",
    },
    warning: {
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.25)",
      icon: "🟡",
      text: "#f59e0b",
    },
    info: {
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.25)",
      icon: "🔵",
      text: "#3b82f6",
    },
  };
  const c = colors[severity];

  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "0.5rem",
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>{c.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.825rem",
            fontWeight: 600,
            color: "var(--foreground)",
            marginBottom: "0.15rem",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--foreground-muted)",
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      </div>
      {time && (
        <span
          style={{
            fontSize: "0.65rem",
            color: "var(--foreground-muted)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {time}
        </span>
      )}
    </div>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = getHealthColor(score);
  return (
    <div
      style={{
        width: "100%",
        height: "6px",
        borderRadius: "3px",
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${score}%`,
          height: "100%",
          borderRadius: "3px",
          background: color,
          transition: "width 0.5s ease",
        }}
      />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const { data: clients, loading: l1 } = useClients();
  const { data: campaigns, loading: l2 } = useCampaigns();
  const { data: leads, loading: l3 } = useLeads();
  const { data: payments, loading: l4 } = usePayments();
  const {
    alerts,
    criticalCount,
    warningCount,
    infoCount,
    loading: l5,
  } = useOperationalAlerts();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const loading = l1 || l2 || l3 || l4 || l5;
  const isInitialLoad =
    loading && campaigns.length === 0 && clients.length === 0;

  // ── KPI Calculations ──────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const activeClients = clients.filter((c) => c.status === "active");
    const activeCampaigns = campaigns.filter(
      (c) =>
        c.status === "active" ||
        c.status === "scheduled" ||
        c.status === "in_progress"
    );
    const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
    const activeBudget = activeCampaigns.reduce(
      (sum, c) => sum + (c.budget || 0),
      0
    );

    // Leads this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const leadsThisMonth = leads.filter(
      (l) => new Date(l.createdAt) >= monthStart
    );

    // CPL: active budget / leads this month (or total leads as fallback)
    const leadCount = leadsThisMonth.length || leads.length || 1;
    const cpl = activeBudget > 0 ? activeBudget / leadCount : 0;

    // Conversion rate: won / total
    const wonLeads = leads.filter((l) => l.status === "won");
    const conversionRate =
      leads.length > 0
        ? ((wonLeads.length / leads.length) * 100).toFixed(1)
        : "0";

    return {
      activeClients: activeClients.length,
      totalClients: clients.length,
      activeCampaigns: activeCampaigns.length,
      totalCampaigns: campaigns.length,
      totalBudget,
      activeBudget,
      leadsThisMonth: leadsThisMonth.length,
      totalLeads: leads.length,
      cpl,
      conversionRate,
      wonLeads: wonLeads.length,
    };
  }, [clients, campaigns, leads]);

  // ── Campaign rows with health scores ──────────────────────────────────────

  const campaignRows = useMemo(() => {
    return campaigns
      .map((campaign) => {
        const campaignLeads = leads.filter(
          (l) => l.campaignId === campaign.id
        );
        const client = clients.find((c) => c.id === campaign.clientId);
        const healthScore = computeHealthScore(campaign, campaignLeads);
        return {
          campaign,
          client,
          campaignLeads,
          healthScore,
          clientName: campaign.clientName || client?.name || "—",
        };
      })
      .filter((row) => {
        if (statusFilter !== "all" && row.campaign.status !== statusFilter)
          return false;
        if (platformFilter !== "all" && row.campaign.platform !== platformFilter)
          return false;
        return true;
      })
      .sort((a, b) => {
        const sa = STATUS_ORDER[a.campaign.status] ?? 99;
        const sb = STATUS_ORDER[b.campaign.status] ?? 99;
        if (sa !== sb) return sa - sb;
        // Within same status: worst health first (needs attention)
        return a.healthScore - b.healthScore;
      });
  }, [campaigns, leads, clients, statusFilter, platformFilter]);

  // ── Average health score ──────────────────────────────────────────────────

  const avgHealth = useMemo(() => {
    if (campaignRows.length === 0) return 0;
    const sum = campaignRows.reduce((s, r) => s + r.healthScore, 0);
    return Math.round(sum / campaignRows.length);
  }, [campaignRows]);

  // ── Campaign alerts (from operational alerts + campaign-specific checks) ──

  const campaignAlerts = useMemo(() => {
    const result: Array<{
      severity: "critical" | "warning" | "info";
      title: string;
      description: string;
    }> = [];

    // Pull campaign-relevant items from operational alerts
    alerts.slice(0, 5).forEach((a) => {
      result.push({
        severity: a.severity as "critical" | "warning" | "info",
        title: a.title,
        description: a.description || "",
      });
    });

    // Campaign-specific: active/scheduled without budget
    campaigns
      .filter(
        (c) =>
          (c.status === "active" || c.status === "scheduled") &&
          (!c.budget || c.budget === 0)
      )
      .forEach((c) => {
        result.push({
          severity: "warning",
          title: `קמפיין ללא תקציב: ${c.campaignName}`,
          description: `סטטוס ${STATUS_LABELS[c.status] || c.status} בלי תקציב מוגדר`,
        });
      });

    // Campaign-specific: active without creative
    campaigns
      .filter(
        (c) =>
          c.status === "active" &&
          !c.linkedClientFileId &&
          !c.linkedVideoProjectId &&
          !c.externalMediaUrl
      )
      .forEach((c) => {
        result.push({
          severity: "warning",
          title: `קמפיין ללא קריאטיב: ${c.campaignName}`,
          description: `קמפיין פעיל ללא מדיה מצורפת`,
        });
      });

    // Low health scores on active campaigns
    campaignRows
      .filter((r) => r.healthScore < 40 && r.campaign.status === "active")
      .forEach((r) => {
        result.push({
          severity: "critical",
          title: `ציון בריאות נמוך: ${r.campaign.campaignName}`,
          description: `ציון ${r.healthScore}/100 — ${getHealthLabel(r.healthScore)}`,
        });
      });

    // Deduplicate by title
    const seen = new Set<string>();
    return result.filter((a) => {
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });
  }, [alerts, campaigns, campaignRows]);

  // ── Loading state — Skeleton matching dashboard pattern ───────────────────

  if (isInitialLoad) {
    return (
      <main
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "2rem 1.5rem",
          direction: "rtl",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        <div>
          <div
            className="skeleton"
            style={{ width: 260, height: 32, borderRadius: "0.5rem", marginBottom: "0.5rem" }}
          />
          <div
            className="skeleton"
            style={{ width: 180, height: 16, borderRadius: "0.25rem" }}
          />
        </div>
        <SkeletonKPIRow count={7} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem",
          }}
        >
          <SkeletonGrid count={1} columns="1fr" />
          <SkeletonGrid count={1} columns="1fr" />
        </div>
        <SkeletonGrid count={1} columns="1fr" />
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "2rem 1.5rem",
        direction: "rtl",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      {/* ═══ Header ═══ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "var(--foreground)",
              marginBottom: "0.25rem",
              letterSpacing: "-0.02em",
            }}
          >
            📡 מרכז שליטה — קמפיינים
          </h1>
          <p
            style={{
              color: "var(--foreground-muted)",
              fontSize: "0.875rem",
            }}
          >
            {getGreeting()} · {getDateLabel()}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link
            href="/campaign-builder"
            className="mod-btn-primary"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontWeight: 700,
            }}
          >
            🚀 צור קמפיין
          </Link>
          <Link
            href="/campaigns"
            className="mod-btn-ghost"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            📣 כל הקמפיינים
          </Link>
          <Link
            href="/leads"
            className="mod-btn-ghost"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            🎯 לידים
          </Link>
        </div>
      </div>

      {/* ═══ KPI Row ═══ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
        }}
      >
        <KPICard
          icon="👤"
          label="לקוחות פעילים"
          value={kpis.activeClients}
          color="#38bdf8"
          subtext={`מתוך ${kpis.totalClients}`}
        />
        <KPICard
          icon="📣"
          label="קמפיינים פעילים"
          value={kpis.activeCampaigns}
          color="#a78bfa"
          subtext={`מתוך ${kpis.totalCampaigns}`}
        />
        <KPICard
          icon="💰"
          label="תקציב פעיל"
          value={formatCurrency(kpis.activeBudget)}
          color="#22c55e"
          subtext={`סה״כ ${formatCurrency(kpis.totalBudget)}`}
        />
        <KPICard
          icon="🎯"
          label="לידים החודש"
          value={kpis.leadsThisMonth}
          color="#34d399"
          subtext={`סה״כ ${kpis.totalLeads}`}
        />
        <KPICard
          icon="📊"
          label="עלות לליד"
          value={kpis.cpl > 0 ? formatCurrency(kpis.cpl) : "—"}
          color="#f59e0b"
          subtext="ממוצע"
        />
        <KPICard
          icon="🏆"
          label="שיעור המרה"
          value={`${kpis.conversionRate}%`}
          color="#ec4899"
          subtext={`${kpis.wonLeads} נסגרו`}
        />
        <KPICard
          icon="❤️‍🩹"
          label="בריאות ממוצעת"
          value={avgHealth}
          color={getHealthColor(avgHealth)}
          subtext={getHealthLabel(avgHealth)}
        />
      </div>

      {/* ═══ Alerts + Status Breakdown row ═══ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
        {/* Alerts Panel */}
        <div
          className="premium-card"
          style={{ padding: "1.25rem", maxHeight: "400px", overflow: "hidden" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span style={{ fontSize: "1.125rem" }}>🚨</span>
              <span
                style={{
                  fontSize: "0.925rem",
                  fontWeight: 700,
                  color: "var(--foreground)",
                }}
              >
                התראות
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {criticalCount > 0 && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    background: "rgba(239,68,68,0.15)",
                    color: "#ef4444",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "0.25rem",
                  }}
                >
                  {criticalCount} קריטי
                </span>
              )}
              {warningCount > 0 && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    background: "rgba(245,158,11,0.15)",
                    color: "#f59e0b",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "0.25rem",
                  }}
                >
                  {warningCount} אזהרה
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              maxHeight: "320px",
              overflowY: "auto",
            }}
          >
            {campaignAlerts.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "var(--foreground-muted)",
                  fontSize: "0.85rem",
                }}
              >
                ✅ אין התראות — הכל תקין
              </div>
            ) : (
              campaignAlerts.slice(0, 10).map((a, i) => (
                <AlertRow
                  key={i}
                  severity={a.severity}
                  title={a.title}
                  description={a.description}
                />
              ))
            )}
          </div>
        </div>

        {/* Campaign Status & Platform Breakdown */}
        <div className="premium-card" style={{ padding: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            <span style={{ fontSize: "1.125rem" }}>📊</span>
            <span
              style={{
                fontSize: "0.925rem",
                fontWeight: 700,
                color: "var(--foreground)",
              }}
            >
              פילוח קמפיינים
            </span>
          </div>

          {/* Status breakdown */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "var(--foreground-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "0.75rem",
              }}
            >
              לפי סטטוס
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {(Object.keys(STATUS_LABELS) as CampaignStatus[])
                .filter((key) => {
                  const count = campaigns.filter(
                    (c) => c.status === key
                  ).length;
                  return count > 0;
                })
                .map((key) => {
                  const count = campaigns.filter(
                    (c) => c.status === key
                  ).length;
                  const pct =
                    campaigns.length > 0
                      ? (count / campaigns.length) * 100
                      : 0;
                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                      }}
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: STATUS_COLORS[key] || "#6b7280",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--foreground)",
                          flex: 1,
                        }}
                      >
                        {STATUS_LABELS[key]}
                      </span>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "var(--foreground)",
                        }}
                      >
                        {count}
                      </span>
                      <div
                        style={{
                          width: "60px",
                          height: "4px",
                          borderRadius: "2px",
                          background: "var(--surface)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            borderRadius: "2px",
                            background: STATUS_COLORS[key] || "#6b7280",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Platform breakdown */}
          <div>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "var(--foreground-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "0.75rem",
              }}
            >
              לפי פלטפורמה
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {(Object.keys(PLATFORM_LABELS) as CampaignPlatform[]).map(
                (key) => {
                  const count = campaigns.filter(
                    (c) => c.platform === key
                  ).length;
                  if (count === 0) return null;
                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.375rem 0.75rem",
                        borderRadius: "0.375rem",
                        background: "var(--surface-raised)",
                        border: "1px solid var(--border)",
                        fontSize: "0.8rem",
                      }}
                    >
                      <span>{PLATFORM_ICONS[key]}</span>
                      <span style={{ fontWeight: 600 }}>{count}</span>
                      <span style={{ color: "var(--foreground-muted)" }}>
                        {PLATFORM_LABELS[key]}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Campaign Table ═══ */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        {/* Table Header + Filters */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span style={{ fontSize: "1.125rem" }}>📋</span>
            <span
              style={{
                fontSize: "0.925rem",
                fontWeight: 700,
                color: "var(--foreground)",
              }}
            >
              כל הקמפיינים ({campaignRows.length})
            </span>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "0.375rem 0.625rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                background: "var(--surface-raised)",
                color: "var(--foreground)",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              <option value="all">כל הסטטוסים</option>
              {(Object.keys(STATUS_LABELS) as CampaignStatus[]).map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABELS[key]}
                </option>
              ))}
            </select>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              style={{
                padding: "0.375rem 0.625rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                background: "var(--surface-raised)",
                color: "var(--foreground)",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              <option value="all">כל הפלטפורמות</option>
              {(Object.keys(PLATFORM_LABELS) as CampaignPlatform[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {PLATFORM_LABELS[key]}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* Table body or empty state */}
        {campaignRows.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 2rem",
              color: "var(--foreground-muted)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
            <div style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
              אין קמפיינים תואמים
            </div>
            <div style={{ fontSize: "0.75rem" }}>
              נסה לשנות את הפילטרים או{" "}
              <Link
                href="/campaigns"
                style={{ color: "var(--accent)", textDecoration: "none" }}
              >
                צור קמפיין חדש
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.8rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    textAlign: "right",
                  }}
                >
                  {["בריאות", "קמפיין", "לקוח", "פלטפורמה", "סטטוס", "תקציב", "לידים"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "0.625rem 0.5rem",
                          fontWeight: 600,
                          color: "var(--foreground-muted)",
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {campaignRows.map((row) => (
                  <tr
                    key={row.campaign.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      transition: "background 150ms",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "var(--surface-raised)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* Health Score */}
                    <td style={{ padding: "0.625rem 0.5rem", width: "90px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: getHealthColor(row.healthScore),
                            minWidth: "28px",
                          }}
                        >
                          {row.healthScore}
                        </span>
                        <div style={{ flex: 1 }}>
                          <HealthBar score={row.healthScore} />
                        </div>
                      </div>
                    </td>

                    {/* Campaign Name + Type */}
                    <td style={{ padding: "0.625rem 0.5rem" }}>
                      <Link
                        href={`/campaigns/${row.campaign.id}`}
                        style={{
                          color: "var(--foreground)",
                          textDecoration: "none",
                          fontWeight: 600,
                          fontSize: "0.825rem",
                        }}
                      >
                        {row.campaign.campaignName || "ללא שם"}
                      </Link>
                      {row.campaign.campaignType && (
                        <div
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--foreground-muted)",
                            marginTop: "0.1rem",
                          }}
                        >
                          {TYPE_LABELS[row.campaign.campaignType] ||
                            row.campaign.campaignType}
                        </div>
                      )}
                    </td>

                    {/* Client */}
                    <td style={{ padding: "0.625rem 0.5rem" }}>
                      {row.client ? (
                        <Link
                          href={`/clients/${row.client.id}`}
                          style={{
                            color: "var(--foreground)",
                            textDecoration: "none",
                            fontSize: "0.8rem",
                          }}
                        >
                          {row.clientName}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--foreground-muted)" }}>
                          {row.clientName}
                        </span>
                      )}
                    </td>

                    {/* Platform */}
                    <td style={{ padding: "0.625rem 0.5rem" }}>
                      <span style={{ fontSize: "0.8rem" }}>
                        {PLATFORM_ICONS[row.campaign.platform] || "📱"}{" "}
                        {PLATFORM_LABELS[row.campaign.platform] ||
                          row.campaign.platform}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: "0.625rem 0.5rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          color: "#fff",
                          background:
                            STATUS_COLORS[row.campaign.status] || "#6b7280",
                        }}
                      >
                        {STATUS_LABELS[row.campaign.status] ||
                          row.campaign.status}
                      </span>
                    </td>

                    {/* Budget */}
                    <td
                      style={{
                        padding: "0.625rem 0.5rem",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        color:
                          row.campaign.budget > 0
                            ? "var(--foreground)"
                            : "var(--foreground-muted)",
                      }}
                    >
                      {row.campaign.budget > 0
                        ? formatCurrency(row.campaign.budget)
                        : "—"}
                    </td>

                    {/* Leads */}
                    <td style={{ padding: "0.625rem 0.5rem" }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            row.campaignLeads.length > 0
                              ? "#22c55e"
                              : "var(--foreground-muted)",
                        }}
                      >
                        {row.campaignLeads.length}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ Clients with Active Campaigns ═══ */}
      <div className="premium-card" style={{ padding: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "1.125rem" }}>👤</span>
          <span
            style={{
              fontSize: "0.925rem",
              fontWeight: 700,
              color: "var(--foreground)",
            }}
          >
            לקוחות עם קמפיינים
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {(() => {
            // Group campaigns by client
            const clientMap = new Map<
              string,
              {
                client: Client | undefined;
                campaigns: typeof campaignRows;
                totalBudget: number;
                totalLeads: number;
              }
            >();
            for (const row of campaignRows) {
              const cid = row.campaign.clientId;
              if (!clientMap.has(cid)) {
                clientMap.set(cid, {
                  client: row.client,
                  campaigns: [],
                  totalBudget: 0,
                  totalLeads: 0,
                });
              }
              const entry = clientMap.get(cid)!;
              entry.campaigns.push(row);
              entry.totalBudget += row.campaign.budget || 0;
              entry.totalLeads += row.campaignLeads.length;
            }

            const entries = Array.from(clientMap.entries()).sort(
              (a, b) => b[1].totalBudget - a[1].totalBudget
            );

            if (entries.length === 0) {
              return (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--foreground-muted)",
                  }}
                >
                  אין לקוחות עם קמפיינים תואמים
                </div>
              );
            }

            return entries.map(([cid, data]) => {
              const avgScore =
                data.campaigns.length > 0
                  ? Math.round(
                      data.campaigns.reduce((s, r) => s + r.healthScore, 0) /
                        data.campaigns.length
                    )
                  : 0;
              return (
                <div
                  key={cid}
                  style={{
                    padding: "0.875rem",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Link
                      href={
                        data.client ? `/clients/${data.client.id}` : "#"
                      }
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "var(--foreground)",
                        textDecoration: "none",
                      }}
                    >
                      {data.client?.name ||
                        data.campaigns[0]?.clientName ||
                        "—"}
                    </Link>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: getHealthColor(avgScore),
                        background: `${getHealthColor(avgScore)}15`,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "0.25rem",
                      }}
                    >
                      {avgScore}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      fontSize: "0.72rem",
                      color: "var(--foreground-muted)",
                    }}
                  >
                    <span>📣 {data.campaigns.length} קמפיינים</span>
                    <span>🎯 {data.totalLeads} לידים</span>
                  </div>

                  <div
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--foreground)",
                    }}
                  >
                    {formatCurrency(data.totalBudget)}
                  </div>

                  <HealthBar score={avgScore} />
                </div>
              );
            });
          })()}
        </div>
      </div>
    </main>
  );
}
