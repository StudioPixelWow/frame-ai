"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type ConnectionStatus =
  | "connected"
  | "needs_reauth"
  | "missing_permissions"
  | "partially_connected"
  | "sync_error"
  | "not_connected";

type ConnectionCategory = "meta" | "tracking" | "crm" | "messaging";

interface ConnectionPermission {
  name: string;
  granted: boolean;
}

interface Connection {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ConnectionCategory;
  status: ConnectionStatus;
  lastSync: string | null;
  permissions: ConnectionPermission[];
  accountLabel: string | null;
  actionLabel: string;
  actionVariant: "primary" | "warning" | "ghost";
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; color: string; bg: string; borderColor: string; dot: string }
> = {
  connected: {
    label: "מחובר",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    borderColor: "rgba(34,197,94,0.25)",
    dot: "🟢",
  },
  needs_reauth: {
    label: "דורש אימות מחדש",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    borderColor: "rgba(245,158,11,0.25)",
    dot: "🟡",
  },
  missing_permissions: {
    label: "הרשאות חסרות",
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    borderColor: "rgba(249,115,22,0.25)",
    dot: "🟠",
  },
  partially_connected: {
    label: "מחובר חלקית",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    borderColor: "rgba(59,130,246,0.25)",
    dot: "🔵",
  },
  sync_error: {
    label: "שגיאת סנכרון",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.25)",
    dot: "🔴",
  },
  not_connected: {
    label: "לא מחובר",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.06)",
    borderColor: "rgba(107,114,128,0.2)",
    dot: "⚪",
  },
};

const CATEGORY_LABELS: Record<ConnectionCategory, string> = {
  meta: "Meta / פרסום",
  tracking: "מעקב והמרות",
  crm: "CRM ונתונים",
  messaging: "הודעות והתראות",
};

// ── Mock Data Layer ──────────────────────────────────────────────────────────
// Structured to match future real architecture.
// When OAuth is wired, replace this with useData<Connection>('connections').

// TODO: Replace with real API integration when connection management backend is built.
// These represent the external service connections the agency needs (Meta BM, Pixel, etc.).
// For now, mock data shows the UI structure. When ready, migrate to useData<Connection>('connections').
function getMockConnections(): Connection[] {
  return [
    {
      id: "meta-bm",
      name: "Meta Business Manager",
      description: "גישה מרכזית לכל חשבונות הפרסום, דפים ונכסים",
      icon: "🏢",
      category: "meta",
      status: "connected",
      lastSync: new Date(Date.now() - 12 * 60000).toISOString(),
      permissions: [
        { name: "ads_management", granted: true },
        { name: "business_management", granted: true },
        { name: "pages_read_engagement", granted: true },
      ],
      accountLabel: "Studio Pixel BM · 1234567890",
      actionLabel: "הגדרות",
      actionVariant: "ghost",
    },
    {
      id: "ad-account",
      name: "Ad Account",
      description: "חשבון פרסום לניהול קמפיינים, תקציבים וקהלים",
      icon: "💳",
      category: "meta",
      status: "connected",
      lastSync: new Date(Date.now() - 8 * 60000).toISOString(),
      permissions: [
        { name: "ads_management", granted: true },
        { name: "ads_read", granted: true },
      ],
      accountLabel: "act_9876543210",
      actionLabel: "הגדרות",
      actionVariant: "ghost",
    },
    {
      id: "fb-page",
      name: "Facebook Page",
      description: "דף עסקי לפרסום תוכן אורגני וממומן",
      icon: "📘",
      category: "meta",
      status: "needs_reauth",
      lastSync: new Date(Date.now() - 3 * 86400000).toISOString(),
      permissions: [
        { name: "pages_manage_posts", granted: true },
        { name: "pages_read_engagement", granted: false },
        { name: "pages_messaging", granted: false },
      ],
      accountLabel: "Studio Pixel · דף עסקי",
      actionLabel: "אמת מחדש",
      actionVariant: "warning",
    },
    {
      id: "ig-profile",
      name: "Instagram Profile",
      description: "פרופיל עסקי לפרסום, סטוריז וניתוח נתונים",
      icon: "📸",
      category: "meta",
      status: "connected",
      lastSync: new Date(Date.now() - 25 * 60000).toISOString(),
      permissions: [
        { name: "instagram_basic", granted: true },
        { name: "instagram_content_publish", granted: true },
        { name: "instagram_manage_insights", granted: true },
      ],
      accountLabel: "@studiopixel",
      actionLabel: "הגדרות",
      actionVariant: "ghost",
    },
    {
      id: "pixel",
      name: "Pixel / Dataset",
      description: "מעקב אירועים באתר — PageView, Lead, Purchase",
      icon: "📍",
      category: "tracking",
      status: "missing_permissions",
      lastSync: new Date(Date.now() - 7 * 86400000).toISOString(),
      permissions: [
        { name: "ads_management", granted: true },
        { name: "ads_read", granted: true },
        { name: "custom_audience", granted: false },
      ],
      accountLabel: "Pixel #11223344",
      actionLabel: "עדכן הרשאות",
      actionVariant: "warning",
    },
    {
      id: "capi",
      name: "Conversion API",
      description: "שליחת אירועי המרה מצד השרת — מגביר דיוק ואופטימיזציה",
      icon: "🔗",
      category: "tracking",
      status: "not_connected",
      lastSync: null,
      permissions: [],
      accountLabel: null,
      actionLabel: "חבר עכשיו",
      actionVariant: "primary",
    },
    {
      id: "lead-forms",
      name: "Lead Forms",
      description: "טפסי לידים מקמפיינים — סנכרון אוטומטי ל-CRM",
      icon: "📝",
      category: "crm",
      status: "partially_connected",
      lastSync: new Date(Date.now() - 2 * 3600000).toISOString(),
      permissions: [
        { name: "leads_retrieval", granted: true },
        { name: "pages_manage_metadata", granted: false },
      ],
      accountLabel: "3 טפסים פעילים",
      actionLabel: "סנכרן טפסים",
      actionVariant: "primary",
    },
    {
      id: "crm",
      name: "CRM",
      description: "סנכרון לידים, לקוחות וסטטוסים עם מערכת ה-CRM",
      icon: "🗂️",
      category: "crm",
      status: "sync_error",
      lastSync: new Date(Date.now() - 45 * 60000).toISOString(),
      permissions: [
        { name: "read_contacts", granted: true },
        { name: "write_contacts", granted: true },
        { name: "webhooks", granted: false },
      ],
      accountLabel: "PixelFrameAI CRM",
      actionLabel: "תקן סנכרון",
      actionVariant: "warning",
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business",
      description: "שליחת הודעות אוטומטיות — אישורים, תזכורות, עדכונים",
      icon: "💬",
      category: "messaging",
      status: "not_connected",
      lastSync: null,
      permissions: [],
      accountLabel: null,
      actionLabel: "חבר עכשיו",
      actionVariant: "primary",
    },
    {
      id: "email",
      name: "Email Notifications",
      description: "התראות מייל על שינויי סטטוס, לידים חדשים ודוחות",
      icon: "📧",
      category: "messaging",
      status: "connected",
      lastSync: new Date(Date.now() - 5 * 60000).toISOString(),
      permissions: [
        { name: "send_email", granted: true },
        { name: "read_templates", granted: true },
      ],
      accountLabel: "tal.pixeld@gmail.com",
      actionLabel: "הגדרות",
      actionVariant: "ghost",
    },
  ];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  return "ערב טוב";
}

function getDateLabel(): string {
  return new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KPICard({
  value,
  label,
  icon,
  color,
}: {
  value: number;
  label: string;
  icon: string;
  color: string;
}) {
  return (
    <div
      className="premium-card"
      style={{ textAlign: "center", padding: "1.25rem 1rem", minWidth: 0 }}
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
    </div>
  );
}

function PermissionDot({ granted }: { granted: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: granted ? "#22c55e" : "#ef4444",
        flexShrink: 0,
      }}
    />
  );
}

function ConnectionCard({
  connection,
  onAction,
}: {
  connection: Connection;
  onAction: (id: string) => void;
}) {
  const config = STATUS_CONFIG[connection.status];
  const grantedCount = connection.permissions.filter((p) => p.granted).length;
  const totalPerms = connection.permissions.length;

  return (
    <div
      className="premium-card"
      style={{
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        borderRight: `3px solid ${config.color}`,
        transition: "border-color 200ms, box-shadow 200ms",
      }}
    >
      {/* Header: icon + name + status badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{ fontSize: "1.5rem" }}>{connection.icon}</span>
          <div>
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "var(--foreground)",
                lineHeight: 1.2,
              }}
            >
              {connection.name}
            </div>
            {connection.accountLabel && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--foreground-muted)",
                  marginTop: "0.15rem",
                  direction: "ltr",
                  textAlign: "right",
                }}
              >
                {connection.accountLabel}
              </div>
            )}
          </div>
        </div>

        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: config.color,
            background: config.bg,
            border: `1px solid ${config.borderColor}`,
            padding: "0.2rem 0.5rem",
            borderRadius: "0.25rem",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {config.dot} {config.label}
        </span>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--foreground-muted)",
          lineHeight: 1.5,
        }}
      >
        {connection.description}
      </div>

      {/* Permissions bar */}
      {totalPerms > 0 && (
        <div>
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              color: "var(--foreground-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "0.375rem",
            }}
          >
            הרשאות ({grantedCount}/{totalPerms})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {connection.permissions.map((p) => (
              <span
                key={p.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: "0.65rem",
                  padding: "0.15rem 0.4rem",
                  borderRadius: "0.2rem",
                  background: p.granted
                    ? "rgba(34,197,94,0.08)"
                    : "rgba(239,68,68,0.08)",
                  color: p.granted ? "#22c55e" : "#ef4444",
                  border: `1px solid ${p.granted ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  direction: "ltr",
                }}
              >
                <PermissionDot granted={p.granted} />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer: last sync + action */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "auto",
          paddingTop: "0.5rem",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontSize: "0.68rem",
            color: "var(--foreground-muted)",
          }}
        >
          סנכרון אחרון: {formatTimeAgo(connection.lastSync)}
        </div>
        <button
          onClick={() => onAction(connection.id)}
          className={
            connection.actionVariant === "primary"
              ? "mod-btn-primary"
              : connection.actionVariant === "warning"
                ? "mod-btn-primary"
                : "mod-btn-ghost"
          }
          style={{
            padding: "0.35rem 0.75rem",
            fontSize: "0.72rem",
            fontWeight: 600,
            borderRadius: "0.375rem",
            cursor: "pointer",
            ...(connection.actionVariant === "warning"
              ? {
                  background: "rgba(245,158,11,0.15)",
                  color: "#f59e0b",
                  border: "1px solid rgba(245,158,11,0.3)",
                }
              : {}),
          }}
        >
          {connection.actionLabel}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const [connections] = useState<Connection[]>(getMockConnections);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // ── KPIs ────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total = connections.length;
    const healthy = connections.filter(
      (c) => c.status === "connected"
    ).length;
    const issues = connections.filter(
      (c) =>
        c.status === "needs_reauth" ||
        c.status === "missing_permissions" ||
        c.status === "sync_error"
    ).length;
    const missing = connections.filter(
      (c) => c.status === "not_connected"
    ).length;
    return { total, healthy, issues, missing };
  }, [connections]);

  // ── Critical issues for warning banner ────────────────────────────────

  const criticalIssues = useMemo(() => {
    return connections.filter(
      (c) =>
        c.status === "sync_error" ||
        c.status === "needs_reauth" ||
        c.status === "missing_permissions"
    );
  }, [connections]);

  // ── Filtered + grouped connections ────────────────────────────────────

  const filteredConnections = useMemo(() => {
    if (categoryFilter === "all") return connections;
    return connections.filter((c) => c.category === categoryFilter);
  }, [connections, categoryFilter]);

  const groupedConnections = useMemo(() => {
    const groups = new Map<ConnectionCategory, Connection[]>();
    for (const conn of filteredConnections) {
      if (!groups.has(conn.category)) {
        groups.set(conn.category, []);
      }
      groups.get(conn.category)!.push(conn);
    }
    return groups;
  }, [filteredConnections]);

  // ── Action handler (placeholder — will wire to real OAuth later) ──────

  const handleAction = useCallback((connectionId: string) => {
    console.log(`[Connections] Action triggered for: ${connectionId}`);
    // Future: open OAuth flow, settings modal, or re-sync
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

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
            🔌 חיבורים ואינטגרציות
          </h1>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
            {getGreeting()} · {getDateLabel()}
          </p>
        </div>
      </div>

      {/* ═══ Critical Warning Banner ═══ */}
      {criticalIssues.length > 0 && (
        <div
          style={{
            padding: "1rem 1.25rem",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "#ef4444",
                marginBottom: "0.2rem",
              }}
            >
              {criticalIssues.length} חיבורים דורשים טיפול
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--foreground-muted)",
                lineHeight: 1.5,
              }}
            >
              {criticalIssues.map((c) => c.name).join(", ")} —{" "}
              {criticalIssues.some((c) => c.status === "sync_error")
                ? "שגיאות סנכרון עלולות לגרום לאובדן נתונים"
                : "יש לעדכן הרשאות או לאמת מחדש"}
            </div>
          </div>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              background: "rgba(239,68,68,0.12)",
              color: "#ef4444",
              padding: "0.25rem 0.625rem",
              borderRadius: "0.25rem",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {criticalIssues.length} בעיות
          </span>
        </div>
      )}

      {/* ═══ KPI Row ═══ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        <KPICard
          icon="🔌"
          label="סה״כ חיבורים"
          value={kpis.total}
          color="#38bdf8"
        />
        <KPICard
          icon="✅"
          label="תקינים"
          value={kpis.healthy}
          color="#22c55e"
        />
        <KPICard
          icon="⚠️"
          label="דורשים טיפול"
          value={kpis.issues}
          color={kpis.issues > 0 ? "#f59e0b" : "#22c55e"}
        />
        <KPICard
          icon="🔇"
          label="לא מחוברים"
          value={kpis.missing}
          color={kpis.missing > 0 ? "#6b7280" : "#22c55e"}
        />
      </div>

      {/* ═══ Category Filter ═══ */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={() => setCategoryFilter("all")}
          className={categoryFilter === "all" ? "mod-btn-primary" : "mod-btn-ghost"}
          style={{
            padding: "0.4rem 0.875rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          הכל ({connections.length})
        </button>
        {(Object.keys(CATEGORY_LABELS) as ConnectionCategory[]).map((cat) => {
          const count = connections.filter((c) => c.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={
                categoryFilter === cat ? "mod-btn-primary" : "mod-btn-ghost"
              }
              style={{
                padding: "0.4rem 0.875rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* ═══ Connection Cards by Category ═══ */}
      {Array.from(groupedConnections.entries()).map(([category, conns]) => (
        <div key={category}>
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--foreground)",
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                width: "3px",
                height: "16px",
                borderRadius: "2px",
                background: "var(--accent)",
                display: "inline-block",
              }}
            />
            {CATEGORY_LABELS[category]}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "1rem",
            }}
          >
            {conns.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                onAction={handleAction}
              />
            ))}
          </div>
        </div>
      ))}

      {/* ═══ Empty state ═══ */}
      {filteredConnections.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            color: "var(--foreground-muted)",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔌</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.25rem" }}>
            אין חיבורים בקטגוריה זו
          </div>
          <div style={{ fontSize: "0.75rem" }}>
            נסה לבחור קטגוריה אחרת
          </div>
        </div>
      )}

      {/* ═══ Footer note ═══ */}
      <div
        style={{
          textAlign: "center",
          padding: "1rem",
          fontSize: "0.7rem",
          color: "var(--foreground-muted)",
          opacity: 0.6,
        }}
      >
        חיבורים מנוהלים באופן מאובטח · OAuth 2.0 · הנתונים נשמרים בשרתי Supabase
      </div>
    </main>
  );
}
