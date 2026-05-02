'use client';

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useAuditLog } from "@/lib/api/use-entity";
import type { AuditLog } from "@/lib/db/schema";

// Hebrew labels for audit actions
const ACTION_TO_HEBREW: Record<string, string> = {
  create: "יצירה",
  update: "עדכון",
  delete: "מחיקה",
  read: "צפייה",
  login: "כניסה",
  logout: "יציאה",
  export: "ייצוא",
  import: "ייבוא",
  approve: "אישור",
  reject: "דחייה",
  submit: "הגשה",
  download: "הורדה",
  share: "שיתוף",
  invite: "הזמנה",
  remove_access: "ביטול גישה",
  change_settings: "שינוי הגדרות",
  authenticate: "אימות",
};

// Hebrew labels for entity types
const ENTITY_TYPE_TO_HEBREW: Record<string, string> = {
  lead: "ליד",
  client: "לקוח",
  campaign: "קמפיין",
  task: "משימה",
  payment: "תשלום",
  project: "פרויקט",
  approval: "אישור",
  system: "מערכת",
  user: "משתמש",
  employee: "עובד",
  automation: "אוטומציה",
  email: "אימייל",
  file: "קובץ",
};

// Result badge colors
const RESULT_COLORS: Record<string, { bg: string; text: string }> = {
  success: {
    bg: "rgba(34, 197, 94, 0.1)",
    text: "#16a34a",
  },
  failure: {
    bg: "rgba(239, 68, 68, 0.1)",
    text: "#dc2626",
  },
};

const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const auditDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (auditDate.getTime() === today.getTime()) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `היום ${hours}:${minutes}`;
  }

  if (auditDate.getTime() === yesterday.getTime()) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `אתמול ${hours}:${minutes}`;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

function getActionIcon(action: string): string {
  const icons: Record<string, string> = {
    create: "➕",
    update: "✏️",
    delete: "🗑️",
    read: "👁️",
    login: "🔓",
    logout: "🔐",
    export: "📤",
    import: "📥",
    approve: "✅",
    reject: "❌",
    submit: "📩",
    download: "⬇️",
    share: "🔗",
    invite: "👥",
    remove_access: "🚫",
    change_settings: "⚙️",
    authenticate: "🛡️",
  };
  return icons[action] || "📝";
}

function ChangesViewer({ changes }: { changes: Record<string, { old: unknown; new: unknown }> }) {
  if (!changes || Object.keys(changes).length === 0) {
    return (
      <div style={{ color: "var(--foreground-muted)", fontSize: "0.8125rem" }}>
        אין שינויים
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => (
        <div key={field} style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.8125rem" }}>
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{field}:</span>
          <span style={{ color: "var(--foreground-muted)" }}>
            {String(oldVal)} →
          </span>
          <span style={{ color: "var(--accent)", fontWeight: 500 }}>
            {String(newVal)}
          </span>
        </div>
      ))}
    </div>
  );
}

function AuditLogRow({ log, isExpanded, onToggle }: { log: AuditLog; isExpanded: boolean; onToggle: () => void }) {
  const actionHebrew = ACTION_TO_HEBREW[log.action] || log.action;
  const entityTypeHebrew = ENTITY_TYPE_TO_HEBREW[log.entityType] || log.entityType;
  const resultColor = RESULT_COLORS[log.result];

  return (
    <>
      <div
        onClick={onToggle}
        style={{
          padding: "1rem",
          border: "1px solid var(--border)",
          borderRadius: "0.5rem",
          background: "var(--surface)",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.background = "var(--surface-variant)";
          }
        }}
        onMouseLeave={(e) => {
          if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.background = "var(--surface)";
          }
        }}
      >
        {/* Icon */}
        <div
          style={{
            fontSize: "1.25rem",
            flexShrink: 0,
            width: "2rem",
            height: "2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {getActionIcon(log.action)}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.25rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
              {log.userName}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--foreground-muted)" }}>
              {actionHebrew}
            </span>
            {log.entityName && (
              <span style={{ fontSize: "0.8125rem", color: "var(--accent)" }}>
                "{log.entityName}"
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--foreground-muted)" }}>
            {entityTypeHebrew}
            {log.entityId && ` • ${log.entityId}`}
          </div>
        </div>

        {/* Result badge */}
        <div
          style={{
            padding: "0.375rem 0.75rem",
            borderRadius: "0.375rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            background: resultColor.bg,
            color: resultColor.text,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {log.result === "success" ? "הצליח" : "כשל"}
        </div>

        {/* Time */}
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--foreground-muted)",
            whiteSpace: "nowrap",
            flexShrink: 0,
            minWidth: "120px",
            textAlign: "end",
          }}
        >
          {getRelativeTime(log.createdAt)}
        </div>

        {/* Expand indicator */}
        <div
          style={{
            fontSize: "0.875rem",
            color: "var(--foreground-muted)",
            flexShrink: 0,
            transition: "transform 0.2s ease",
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div
          style={{
            padding: "1rem",
            background: "var(--surface-variant)",
            borderLeft: "1px solid var(--border)",
            borderRight: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            borderRadius: "0 0 0.5rem 0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {/* User info */}
          <div>
            <h4 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
              פרטי משתמש
            </h4>
            <div style={{ fontSize: "0.8125rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <div>
                <span style={{ color: "var(--foreground-muted)" }}>אימייל: </span>
                <span style={{ color: "var(--foreground)" }}>{log.userEmail}</span>
              </div>
              {log.ipAddress && (
                <div>
                  <span style={{ color: "var(--foreground-muted)" }}>IP: </span>
                  <span style={{ color: "var(--foreground)" }}>{log.ipAddress}</span>
                </div>
              )}
            </div>
          </div>

          {/* Changes */}
          {Object.keys(log.changes).length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
                שינויים
              </h4>
              <ChangesViewer changes={log.changes} />
            </div>
          )}

          {/* Error message */}
          {log.errorMessage && (
            <div
              style={{
                padding: "0.75rem",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "0.375rem",
                fontSize: "0.8125rem",
                color: "#dc2626",
              }}
            >
              <span style={{ fontWeight: 600 }}>שגיאה: </span>
              {log.errorMessage}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function AuditLogPage() {
  const { data: auditLogs, loading } = useAuditLog();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Get unique action types and entity types from data
  const actionTypes = useMemo(() => {
    const types = new Set(auditLogs.map((log) => log.action));
    return Array.from(types).sort();
  }, [auditLogs]);

  const entityTypes = useMemo(() => {
    const types = new Set(auditLogs.map((log) => log.entityType));
    return Array.from(types).sort();
  }, [auditLogs]);

  // Filter audit logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const actionMatch = actionFilter === "all" || log.action === actionFilter;
      const entityTypeMatch = entityTypeFilter === "all" || log.entityType === entityTypeFilter;
      const resultMatch = resultFilter === "all" || log.result === resultFilter;
      const searchMatch =
        searchQuery === "" ||
        log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.entityName && log.entityName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        log.userAgent?.toLowerCase().includes(searchQuery.toLowerCase());

      return actionMatch && entityTypeMatch && resultMatch && searchMatch;
    });
  }, [auditLogs, actionFilter, entityTypeFilter, resultFilter, searchQuery]);

  const countText = `${filteredLogs.length} רשומות`;

  if (loading) {
    return (
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="pg" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="gact-pg-header">
            <div style={{ flex: 1 }}>
              <h1 className="gact-pg-title" style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.025em" }}>
                יומן ביקורת
              </h1>
              <p className="gact-pg-sub" style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                טוען רשומות ביקורת...
              </p>
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "3rem 2rem",
              color: "var(--foreground-muted)",
            }}
          >
            <p style={{ fontSize: "0.9375rem" }}>טוען נתונים...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="pg" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header */}
        <div className="gact-pg-header">
          <div style={{ flex: 1 }}>
            <h1 className="gact-pg-title" style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.025em" }}>
              יומן ביקורת
            </h1>
            <p className="gact-pg-sub" style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
              מעקב אחר כל הפעולות במערכת לצורך בקרה ועמידה בדרישות חוקיות
            </p>
          </div>
          <div
            className="gact-count-pill"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "9999px",
              padding: "0.5rem 1rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {countText}
          </div>
        </div>

        {/* Filter Chips - Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground-muted)", minWidth: "80px" }}>
              פעולה:
            </label>
            <div className="gact-chips ux-stagger" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", flex: 1 }}>
              <button
                className={`gact-chip ux-btn ${actionFilter === "all" ? "active" : ""}`}
                onClick={() => setActionFilter("all")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "9999px",
                  border: actionFilter === "all" ? "1px solid var(--foreground)" : "1px solid var(--border)",
                  background: actionFilter === "all" ? "var(--surface-raised)" : "transparent",
                  color: actionFilter === "all" ? "var(--foreground)" : "var(--foreground-muted)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                הכל
              </button>
              {actionTypes.map((action) => (
                <button
                  key={action}
                  className={`gact-chip ux-btn ${actionFilter === action ? "active" : ""}`}
                  onClick={() => setActionFilter(action)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "9999px",
                    border: actionFilter === action ? "1px solid var(--foreground)" : "1px solid var(--border)",
                    background: actionFilter === action ? "var(--surface-raised)" : "transparent",
                    color: actionFilter === action ? "var(--foreground)" : "var(--foreground-muted)",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {ACTION_TO_HEBREW[action] || action}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Chips - Entity Types */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground-muted)", minWidth: "80px" }}>
              סוג:
            </label>
            <div className="gact-chips ux-stagger" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", flex: 1 }}>
              <button
                className={`gact-chip ux-btn ${entityTypeFilter === "all" ? "active" : ""}`}
                onClick={() => setEntityTypeFilter("all")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "9999px",
                  border: entityTypeFilter === "all" ? "1px solid var(--foreground)" : "1px solid var(--border)",
                  background: entityTypeFilter === "all" ? "var(--surface-raised)" : "transparent",
                  color: entityTypeFilter === "all" ? "var(--foreground)" : "var(--foreground-muted)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                הכל
              </button>
              {entityTypes.map((type) => (
                <button
                  key={type}
                  className={`gact-chip ux-btn ${entityTypeFilter === type ? "active" : ""}`}
                  onClick={() => setEntityTypeFilter(type)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "9999px",
                    border: entityTypeFilter === type ? "1px solid var(--foreground)" : "1px solid var(--border)",
                    background: entityTypeFilter === type ? "var(--surface-raised)" : "transparent",
                    color: entityTypeFilter === type ? "var(--foreground)" : "var(--foreground-muted)",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {ENTITY_TYPE_TO_HEBREW[type] || type}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Chips - Result */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground-muted)", minWidth: "80px" }}>
              תוצאה:
            </label>
            <div className="gact-chips ux-stagger" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", flex: 1 }}>
              <button
                className={`gact-chip ux-btn ${resultFilter === "all" ? "active" : ""}`}
                onClick={() => setResultFilter("all")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "9999px",
                  border: resultFilter === "all" ? "1px solid var(--foreground)" : "1px solid var(--border)",
                  background: resultFilter === "all" ? "var(--surface-raised)" : "transparent",
                  color: resultFilter === "all" ? "var(--foreground)" : "var(--foreground-muted)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                הכל
              </button>
              <button
                className={`gact-chip ux-btn ${resultFilter === "success" ? "active" : ""}`}
                onClick={() => setResultFilter("success")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "9999px",
                  border: resultFilter === "success" ? "1px solid #16a34a" : "1px solid var(--border)",
                  background: resultFilter === "success" ? "rgba(34, 197, 94, 0.1)" : "transparent",
                  color: resultFilter === "success" ? "#16a34a" : "var(--foreground-muted)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                ✅ הצליח
              </button>
              <button
                className={`gact-chip ux-btn ${resultFilter === "failure" ? "active" : ""}`}
                onClick={() => setResultFilter("failure")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "9999px",
                  border: resultFilter === "failure" ? "1px solid #dc2626" : "1px solid var(--border)",
                  background: resultFilter === "failure" ? "rgba(239, 68, 68, 0.1)" : "transparent",
                  color: resultFilter === "failure" ? "#dc2626" : "var(--foreground-muted)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                ❌ כשל
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="gact-controls" style={{ display: "flex", gap: "1rem" }}>
          <div className="gact-search-wrap" style={{ flex: 1, position: "relative" }}>
            <span
              style={{
                position: "absolute",
                insetInlineStart: "1rem",
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.5,
                fontSize: "1rem",
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              className="gact-search ux-input"
              type="search"
              placeholder="חיפוש לפי שם משתמש, אימייל או שם ישות…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                paddingInlineStart: "2.5rem",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.875rem",
              }}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Audit Log List */}
        <div className="gact-feed ux-stagger" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filteredLogs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 2rem",
                color: "var(--foreground-muted)",
              }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📭</div>
              <p style={{ fontSize: "0.9375rem" }}>
                {auditLogs.length === 0 ? "אין רשומות ביקורת" : "אין רשומות התואמות לסינון הנוכחי"}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <AuditLogRow
                  log={log}
                  isExpanded={expandedId === log.id}
                  onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
