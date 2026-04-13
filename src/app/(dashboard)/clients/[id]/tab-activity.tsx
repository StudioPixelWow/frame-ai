"use client";
import { useState } from "react";
import { useActivities, useClientEmailLogs } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/lib/db/schema";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = [
    "ינו",
    "פבר",
    "מרץ",
    "אפר",
    "מאי",
    "יונ",
    "יול",
    "אוג",
    "ספט",
    "אוק",
    "נוב",
    "דצמ",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "עכשיו";
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays === 1) return "אתמול";
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return formatDate(dateStr);
}

const EMAIL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  gantt_approval: { label: "אישור גאנט", color: "#8b5cf6" },
  weekly_update: { label: "עדכון שבועי", color: "#3b82f6" },
  payment_reminder: { label: "תזכורת תשלום", color: "#f59e0b" },
  portal_login: { label: "גישה לפורטל", color: "#00B5FE" },
  general: { label: "כללי", color: "#a1a1aa" },
};

const EMAIL_STATUS_COLORS: Record<string, string> = {
  sent: "#22c55e",
  failed: "#ef4444",
  pending: "#f59e0b",
};

interface TabActivityProps {
  client: Client;
}

export default function TabActivity({ client }: TabActivityProps) {
  const { data: activities } = useActivities();
  const { data: emailLogs, create: createEmailLog } = useClientEmailLogs();
  const toast = useToast();
  const [showEmailHistory, setShowEmailHistory] = useState(false);

  const handleSendEmail = async (type: string, label: string) => {
    try {
      await createEmailLog({
        clientId: client.id,
        emailType: type,
        subject: label,
        recipientEmail: client.email,
        status: "sent",
      } as any);
      toast(`${label} נשלח בהצלחה`, "success");
    } catch {
      toast("שגיאה בשליחת אימייל", "error");
    }
  };

  const clientActivities = activities
    ?.filter(
      (a) =>
        a.entityId === client.id || a.description?.includes(client.name)
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const clientEmailLogs = emailLogs?.filter((el) => el.clientId === client.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Email Actions Bar */}
      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            marginBottom: "1rem",
            color: "var(--foreground-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          שלח מייל ללקוח
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <button
            onClick={() => handleSendEmail("gantt_approval", "📧 מייל אישור גאנט")}
            className="mod-btn-ghost"
            style={{
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              cursor: "pointer",
              backgroundColor: "transparent",
              color: "var(--foreground)",
              transition: "all 200ms ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "var(--accent)";
              (e.target as HTMLElement).style.color = "white";
              (e.target as HTMLElement).style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "transparent";
              (e.target as HTMLElement).style.color = "var(--foreground)";
              (e.target as HTMLElement).style.borderColor = "var(--border)";
            }}
          >
            📧 אישור גאנט
          </button>

          <button
            onClick={() => handleSendEmail("weekly_update", "📊 מייל עדכון שבועי")}
            className="mod-btn-ghost"
            style={{
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              cursor: "pointer",
              backgroundColor: "transparent",
              color: "var(--foreground)",
              transition: "all 200ms ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "var(--accent)";
              (e.target as HTMLElement).style.color = "white";
              (e.target as HTMLElement).style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "transparent";
              (e.target as HTMLElement).style.color = "var(--foreground)";
              (e.target as HTMLElement).style.borderColor = "var(--border)";
            }}
          >
            📊 עדכון שבועי
          </button>

          <button
            onClick={() =>
              handleSendEmail(
                "payment_reminder",
                "💰 מייל תזכורת תשלום"
              )
            }
            className="mod-btn-ghost"
            style={{
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              cursor: "pointer",
              backgroundColor: "transparent",
              color: "var(--foreground)",
              transition: "all 200ms ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "var(--accent)";
              (e.target as HTMLElement).style.color = "white";
              (e.target as HTMLElement).style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "transparent";
              (e.target as HTMLElement).style.color = "var(--foreground)";
              (e.target as HTMLElement).style.borderColor = "var(--border)";
            }}
          >
            💰 תזכורת תשלום
          </button>

          <button
            onClick={() =>
              handleSendEmail("portal_login", "🔑 מייל גישה לפורטל")
            }
            className="mod-btn-ghost"
            style={{
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              cursor: "pointer",
              backgroundColor: "transparent",
              color: "var(--foreground)",
              transition: "all 200ms ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "var(--accent)";
              (e.target as HTMLElement).style.color = "white";
              (e.target as HTMLElement).style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "transparent";
              (e.target as HTMLElement).style.color = "var(--foreground)";
              (e.target as HTMLElement).style.borderColor = "var(--border)";
            }}
          >
            🔑 גישה לפורטל
          </button>
        </div>
      </div>

      {/* Activity Timeline */}
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            marginBottom: "1.5rem",
            color: "var(--foreground)",
          }}
        >
          ציר הזמן של הפעילויות
        </h3>

        {(!clientActivities || clientActivities.length === 0) ? (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--foreground-muted)",
              fontSize: "0.875rem",
            }}
          >
            אין פעילות עדיין
          </div>
        ) : (
          <div
            style={{
              position: "relative",
              paddingLeft: "2rem",
            }}
          >
            {clientActivities.map((activity, idx) => (
              <div
                key={activity.id}
                style={{
                  position: "relative",
                  marginBottom: idx < clientActivities.length - 1 ? "2rem" : 0,
                }}
              >
                {/* Timeline dot */}
                <div
                  style={{
                    position: "absolute",
                    width: "0.75rem",
                    height: "0.75rem",
                    backgroundColor: "var(--accent)",
                    borderRadius: "50%",
                    left: "-1.375rem",
                    top: "0.25rem",
                    border: "3px solid var(--surface-raised)",
                  }}
                />

                {/* Timeline line */}
                {idx < clientActivities.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      width: "2px",
                      backgroundColor: "var(--border)",
                      left: "-1.125rem",
                      top: "1.75rem",
                      bottom: "-2rem",
                    }}
                  />
                )}

                {/* Activity content */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span style={{ fontSize: "1.25rem" }}>{activity.icon}</span>
                    <div style={{ flex: 1 }}>
                      <h4
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: 600,
                          color: "var(--foreground)",
                          margin: 0,
                        }}
                      >
                        {activity.title}
                      </h4>
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--foreground-muted)",
                      margin: "0 0 0.5rem 2.25rem",
                    }}
                  >
                    {activity.description}
                  </p>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--foreground-subtle)",
                      margin: "0 0 0 2.25rem",
                    }}
                  >
                    {getRelativeTime(activity.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Log */}
      {clientEmailLogs && clientEmailLogs.length > 0 && (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
          }}
        >
          <button
            onClick={() => setShowEmailHistory(!showEmailHistory)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              width: "100%",
              padding: "0",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--foreground)",
              marginBottom: showEmailHistory ? "1.5rem" : 0,
              transition: "color 200ms ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = "var(--foreground)";
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>
              {showEmailHistory ? "▼" : "▶"}
            </span>
            📬 היסטוריית מיילים
          </button>

          {showEmailHistory && (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.875rem",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "0.75rem",
                        color: "var(--foreground-muted)",
                        fontWeight: 500,
                      }}
                    >
                      סוג
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "0.75rem",
                        color: "var(--foreground-muted)",
                        fontWeight: 500,
                      }}
                    >
                      נושא
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "0.75rem",
                        color: "var(--foreground-muted)",
                        fontWeight: 500,
                      }}
                    >
                      נמען
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "0.75rem",
                        color: "var(--foreground-muted)",
                        fontWeight: 500,
                      }}
                    >
                      תאריך שליחה
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "0.75rem",
                        color: "var(--foreground-muted)",
                        fontWeight: 500,
                      }}
                    >
                      סטטוס
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientEmailLogs.map((log, idx) => {
                    const typeInfo =
                      EMAIL_TYPE_LABELS[log.emailType] ||
                      EMAIL_TYPE_LABELS.general;

                    return (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom:
                            idx < clientEmailLogs.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                        }}
                      >
                        <td
                          style={{
                            padding: "0.75rem",
                            color: "var(--foreground)",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.25rem 0.625rem",
                              backgroundColor: `${typeInfo.color}20`,
                              color: typeInfo.color,
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {typeInfo.label}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            color: "var(--foreground)",
                          }}
                        >
                          {log.subject}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            color: "var(--foreground-muted)",
                            fontSize: "0.8125rem",
                          }}
                        >
                          {log.recipientEmail}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            color: "var(--foreground)",
                          }}
                        >
                          {formatDate(log.sentAt)}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            color: "var(--foreground)",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.25rem 0.625rem",
                              backgroundColor: `${EMAIL_STATUS_COLORS[log.status] || EMAIL_STATUS_COLORS.pending}20`,
                              color:
                                EMAIL_STATUS_COLORS[log.status] ||
                                EMAIL_STATUS_COLORS.pending,
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {log.status === "sent" && "נשלח"}
                            {log.status === "failed" && "נכשל"}
                            {log.status === "pending" && "בהמתנה"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
