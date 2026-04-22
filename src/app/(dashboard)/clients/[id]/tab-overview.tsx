"use client";

import { useState } from "react";
import type { Client, Employee } from "@/lib/db/schema";

const CLIENT_TYPE_LABELS: Record<string, { label: string; color: string; emoji?: string }> = {
  marketing: { label: "מרקטינג", color: "#00B5FE" },
  branding: { label: "ברנדינג", color: "#00B5FE" },
  websites: { label: "אתרים", color: "#22c55e" },
  hosting: { label: "הוסטינג", color: "#f59e0b" },
  podcast: { label: "פודקאסט", color: "#CCFF00", emoji: "🎙️" },
  lead: { label: "ליד", color: "#94a3b8", emoji: "🔗" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "פעיל", color: "#22c55e" },
  inactive: { label: "לא פעיל", color: "#f59e0b" },
  prospect: { label: "פוטנציאלי", color: "#a1a1aa" },
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  current: "#22c55e",
  overdue: "#ef4444",
  pending: "#f59e0b",
  none: "#6b7280",
};

const GANTT_STATUS_COLORS: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "#6b7280" },
  approved: { label: "מאושר", color: "#22c55e" },
  sent_to_client: { label: "נשלח ללקוח", color: "#38bdf8" },
  client_approved: { label: "אושר על ידי לקוח", color: "#10b981" },
  none: { label: "לא יוצר", color: "#9ca3af" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2);
}

interface TabOverviewProps {
  client: Client;
  assignedManager?: Employee;
  color: string;
  onUpdateClient?: (updates: Partial<Client>) => Promise<void>;
  employees?: Employee[];
  onNavigateTab?: (tab: string) => void;
}

export default function TabOverview({ client, assignedManager, color, onUpdateClient, employees = [], onNavigateTab }: TabOverviewProps) {
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const TEAM_MEMBERS = ["טל זטלמן", "מאיה זטלמן", "נועם בוברין", "מיכאלה"];

  const handleAssignEmployee = async (employeeId: string) => {
    if (!onUpdateClient) return;
    setIsUpdating(true);
    try {
      await onUpdateClient({ assignedManagerId: employeeId });
      setIsAssigneeDropdownOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1.5rem",
        marginBottom: "2rem",
      }}
    >
      {/* Left Column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Identity Card */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            קובץ זהות
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: client.logoUrl ? "0.5rem" : "50%",
                background: client.logoUrl ? "transparent" : `${color}20`,
                border: client.logoUrl ? "none" : `2px solid ${color}40`,
                color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.9rem",
                flexShrink: 0,
                backgroundImage: client.logoUrl ? `url(${client.logoUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {!client.logoUrl && initials(client.name)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--foreground)" }}>
                {client.name}
              </div>
              {client.company && (
                <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                  {client.company}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            {client.clientType && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--foreground-muted)" }}>סוג:</span>
                <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                  {CLIENT_TYPE_LABELS[client.clientType]?.label}
                </span>
              </div>
            )}
            {client.businessField && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--foreground-muted)" }}>תחום:</span>
                <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                  {client.businessField}
                </span>
              </div>
            )}
            {client.status && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--foreground-muted)" }}>סטטוס:</span>
                <span style={{ fontWeight: 500, color: STATUS_LABELS[client.status]?.color }}>
                  {STATUS_LABELS[client.status]?.label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Business Summary */}
        {(client.marketingGoals || client.keyMarketingMessages) && (
          <div
            className="agd-card"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
            }}
          >
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
              סיכום עסקי
            </h3>

            {client.marketingGoals && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
                  יעדי מרקטינג
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--foreground)", lineHeight: "1.5" }}>
                  {client.marketingGoals}
                </div>
              </div>
            )}

            {client.keyMarketingMessages && (
              <div style={{ borderTop: client.marketingGoals ? "1px solid var(--border)" : "none", paddingTop: client.marketingGoals ? "1rem" : 0 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
                  מסרים מרקטינגיים עיקריים
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--foreground)", lineHeight: "1.5" }}>
                  {client.keyMarketingMessages}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Assigned Responsible Employee */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            position: "relative",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            עובד אחראי
          </h3>

          {assignedManager ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: `${color}20`,
                    border: `2px solid ${color}40`,
                    color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    flexShrink: 0,
                  }}
                >
                  {initials(assignedManager.name)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--foreground)" }}>
                    {assignedManager.name}
                  </div>
                  {assignedManager.email && (
                    <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                      {assignedManager.email}
                    </div>
                  )}
                </div>
              </div>
              {onUpdateClient && (
                <button
                  onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "var(--foreground)",
                    cursor: "pointer",
                    transition: "all 150ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--accent)";
                    (e.currentTarget as HTMLElement).style.color = "white";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                    (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  }}
                >
                  שנה עובד
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{
                padding: "0.75rem",
                background: "#f59e0b15",
                border: "1px solid #f59e0b30",
                borderRadius: "0.5rem",
                color: "#f59e0b",
                fontSize: "0.8rem",
                fontWeight: 500,
              }}>
                ⚠️ לא הוקצה עובד אחראי
              </div>
              {onUpdateClient && (
                <button
                  onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                  className="mod-btn-primary"
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.6rem 0.75rem",
                    width: "100%",
                  }}
                >
                  הקצה עובד
                </button>
              )}
            </div>
          )}

          {/* Assignee Dropdown */}
          {isAssigneeDropdownOpen && onUpdateClient && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                marginTop: "0.5rem",
                minWidth: "200px",
                zIndex: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              {employees.length > 0 ? (
                employees.filter(e => TEAM_MEMBERS.includes(e.name)).map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => handleAssignEmployee(emp.id)}
                    disabled={isUpdating}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "0.75rem 1rem",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      textAlign: "right",
                      cursor: isUpdating ? "not-allowed" : "pointer",
                      color: "var(--foreground)",
                      fontSize: "0.85rem",
                      transition: "background 150ms",
                    }}
                    onMouseEnter={(e) => {
                      if (!isUpdating) {
                        (e.currentTarget as HTMLElement).style.background = "var(--accent-muted)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {emp.name}
                  </button>
                ))
              ) : (
                <div style={{ padding: "0.75rem 1rem", color: "var(--foreground-muted)", fontSize: "0.8rem" }}>
                  אין עובדים זמינים
                </div>
              )}
            </div>
          )}
        </div>

        {/* External Links Section */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            קישורים חיצוניים
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {client.websiteUrl && (
              <a
                href={client.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid #00B5FE30",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: "var(--foreground)",
                  transition: "all 150ms",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#00B5FE10";
                  (e.currentTarget as HTMLElement).style.borderColor = "#00B5FE50";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#00B5FE30";
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>🌐</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground)" }}>אתר</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", wordBreak: "break-all" }}>
                    {client.websiteUrl}
                  </div>
                </div>
                <span style={{ fontSize: "1rem", opacity: 0.6 }}>↗</span>
              </a>
            )}

            {client.facebookPageUrl && (
              <a
                href={client.facebookPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid #1877F230",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: "var(--foreground)",
                  transition: "all 150ms",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#1877F210";
                  (e.currentTarget as HTMLElement).style.borderColor = "#1877F250";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#1877F230";
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>📘</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground)" }}>Facebook</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", wordBreak: "break-all" }}>
                    {client.facebookPageUrl}
                  </div>
                </div>
                <span style={{ fontSize: "1rem", opacity: 0.6 }}>↗</span>
              </a>
            )}

            {client.instagramProfileUrl && (
              <a
                href={client.instagramProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid #E4405F30",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: "var(--foreground)",
                  transition: "all 150ms",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#E4405F10";
                  (e.currentTarget as HTMLElement).style.borderColor = "#E4405F50";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#E4405F30";
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>📷</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground)" }}>Instagram</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", wordBreak: "break-all" }}>
                    {client.instagramProfileUrl}
                  </div>
                </div>
                <span style={{ fontSize: "1rem", opacity: 0.6 }}>↗</span>
              </a>
            )}

            {client.tiktokProfileUrl && (
              <a
                href={client.tiktokProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid #69C9D030",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: "var(--foreground)",
                  transition: "all 150ms",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#69C9D010";
                  (e.currentTarget as HTMLElement).style.borderColor = "#69C9D050";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#69C9D030";
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>🎵</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground)" }}>TikTok</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", wordBreak: "break-all" }}>
                    {client.tiktokProfileUrl}
                  </div>
                </div>
                <span style={{ fontSize: "1rem", opacity: 0.6 }}>↗</span>
              </a>
            )}

            {!client.websiteUrl && !client.facebookPageUrl && !client.instagramProfileUrl && !client.tiktokProfileUrl && (
              <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", textAlign: "center", padding: "1rem" }}>
                אין קישורים חיצוניים מוגדרים
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Financial Summary */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            סיכום כספי
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {client.retainerAmount > 0 && (
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.35rem" }}>
                  ריטיינר
                </div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)" }}>
                  ₪{client.retainerAmount.toLocaleString()}
                </div>
                {client.retainerDay > 0 && (
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                    תאריך תשלום: ה-{client.retainerDay} בחודש
                  </div>
                )}
              </div>
            )}

            {client.nextPaymentDate && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.35rem" }}>
                  התשלום הבא
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: PAYMENT_STATUS_COLORS[client.paymentStatus] || PAYMENT_STATUS_COLORS.none,
                    }}
                  />
                  <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--foreground)" }}>
                    {formatDate(client.nextPaymentDate)}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    padding: "0.25rem 0.5rem",
                    borderRadius: 4,
                    background: `${PAYMENT_STATUS_COLORS[client.paymentStatus] || PAYMENT_STATUS_COLORS.none}15`,
                    color: PAYMENT_STATUS_COLORS[client.paymentStatus] || PAYMENT_STATUS_COLORS.none,
                    border: `1px solid ${PAYMENT_STATUS_COLORS[client.paymentStatus] || PAYMENT_STATUS_COLORS.none}30`,
                    display: "inline-block",
                    marginTop: "0.35rem",
                  }}
                >
                  {client.paymentStatus === "current"
                    ? "עדכני"
                    : client.paymentStatus === "overdue"
                      ? "חריג"
                      : client.paymentStatus === "pending"
                        ? "ממתין"
                        : "לא חל"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Planning Summary */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            סיכום תכנון
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {client.monthlyGanttStatus && client.monthlyGanttStatus !== "none" && (
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.35rem" }}>
                  גאנט חודשי
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "0.35rem 0.75rem",
                    borderRadius: 4,
                    background: `${GANTT_STATUS_COLORS[client.monthlyGanttStatus]?.color}15`,
                    color: GANTT_STATUS_COLORS[client.monthlyGanttStatus]?.color,
                    border: `1px solid ${GANTT_STATUS_COLORS[client.monthlyGanttStatus]?.color}30`,
                    display: "inline-block",
                  }}
                >
                  {GANTT_STATUS_COLORS[client.monthlyGanttStatus]?.label}
                </div>
              </div>
            )}

            {client.annualGanttStatus && client.annualGanttStatus !== "none" && (
              <div style={{ borderTop: client.monthlyGanttStatus && client.monthlyGanttStatus !== "none" ? "1px solid var(--border)" : "none", paddingTop: client.monthlyGanttStatus && client.monthlyGanttStatus !== "none" ? "1rem" : 0 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.35rem" }}>
                  גאנט שנתי
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "0.35rem 0.75rem",
                    borderRadius: 4,
                    background: `${GANTT_STATUS_COLORS[client.annualGanttStatus]?.color}15`,
                    color: GANTT_STATUS_COLORS[client.annualGanttStatus]?.color,
                    border: `1px solid ${GANTT_STATUS_COLORS[client.annualGanttStatus]?.color}30`,
                    display: "inline-block",
                  }}
                >
                  {GANTT_STATUS_COLORS[client.annualGanttStatus]?.label}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div
          className="agd-card"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
            פעולות מהירות
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              className="mod-btn-primary"
              style={{
                fontSize: "0.8rem",
                padding: "0.6rem 0.75rem",
                width: "100%",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
              }}
              onClick={() => onNavigateTab?.("content")}
            >
              📋 תוכן חדש
            </button>
            <button
              className="mod-btn-ghost"
              style={{
                fontSize: "0.8rem",
                padding: "0.6rem 0.75rem",
                width: "100%",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
              }}
              onClick={() => onNavigateTab?.("content")}
            >
              📅 גאנט חודשי
            </button>
            <button
              className="mod-btn-ghost"
              style={{
                fontSize: "0.8rem",
                padding: "0.6rem 0.75rem",
                width: "100%",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
              }}
              onClick={() => onNavigateTab?.("content")}
            >
              📆 גאנט שנתי
            </button>
            <button
              className="mod-btn-ghost"
              style={{
                fontSize: "0.8rem",
                padding: "0.6rem 0.75rem",
                width: "100%",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
              }}
              onClick={() => onNavigateTab?.("tasks")}
            >
              ✓ משימה חדשה
            </button>
            {client.portalEnabled && (
              <button
                className="mod-btn-ghost"
                style={{
                  fontSize: "0.8rem",
                  padding: "0.6rem 0.75rem",
                  width: "100%",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.375rem",
                }}
              >
                🌐 פורטל לקוח
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
