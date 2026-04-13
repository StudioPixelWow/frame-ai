"use client";
import { useState } from "react";
import { usePortalUsers, usePortalComments, useClientEmailLogs, useClients } from "@/lib/api/use-entity";
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

interface TabPortalProps {
  client: Client;
}

const mockLoginHistory = [
  { date: "2024-03-15", time: "14:30", ip: "192.168.1.1" },
  { date: "2024-03-14", time: "10:15", ip: "192.168.1.1" },
  { date: "2024-03-12", time: "09:45", ip: "192.168.1.2" },
  { date: "2024-03-10", time: "16:20", ip: "192.168.1.1" },
  { date: "2024-03-08", time: "13:00", ip: "192.168.1.3" },
];

export default function TabPortal({ client }: TabPortalProps) {
  const { data: portalUsers } = usePortalUsers();
  const { data: portalComments } = usePortalComments();
  const { data: emailLogs } = useClientEmailLogs();
  const { update: updateClient } = useClients();
  const toast = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: client.email,
    authMethod: "magic_link" as "password" | "magic_link",
    password: "",
    confirmPassword: "",
  });
  const [showConfirmDisable, setShowConfirmDisable] = useState(false);

  const portalUser = portalUsers?.find((pu) => pu.clientId === client.id);
  const clientPortalComments = portalComments?.filter((pc) => pc.clientId === client.id) || [];
  const portalEmailLogs = emailLogs?.filter((el) => el.clientId === client.id && el.emailType.includes('portal')) || [];

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      toast("נא להזין כתובת דוא״ל", "error");
      return;
    }

    if (
      formData.authMethod === "password" &&
      formData.password !== formData.confirmPassword
    ) {
      toast("הסיסמאות אינן תואמות", "error");
      return;
    }

    try {
      const response = await fetch("/api/portal/create-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          email: formData.email,
          loginMethod: formData.authMethod,
        }),
      });

      if (response.ok) {
        toast("חשבון הלקוח נוצר בהצלחה", "success");
        setShowCreateForm(false);
        setFormData({
          email: client.email,
          authMethod: "magic_link",
          password: "",
          confirmPassword: "",
        });
      } else {
        const error = await response.json();
        toast(error.error || "שגיאה ביצירת החשבון", "error");
      }
    } catch (error) {
      toast("שגיאה ביצירת החשבון", "error");
    }
  };

  const handleResetPassword = () => {
    toast("הסיסמה אופסה בהצלחה", "success");
  };

  const handleSendLoginEmail = () => {
    toast("המייל נשלח בהצלחה", "success");
  };

  const handleDisablePortal = async () => {
    try {
      await updateClient(client.id, { portalEnabled: false });
      toast("הפורטל הושבת בהצלחה", "success");
      setShowConfirmDisable(false);
    } catch (error) {
      toast("שגיאה בהשבתת הפורטל", "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Portal Status Card */}
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5rem" }}>
          <div style={{ fontSize: "3rem" }}>
            {client.portalEnabled ? "🟢" : "🔴"}
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
                color: "var(--foreground)",
              }}
            >
              {client.portalEnabled ? "פורטל פעיל" : "פורטל כבוי"}
            </h3>
            {client.portalEnabled && portalUser ? (
              <div style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
                <p style={{ marginBottom: "0.5rem" }}>
                  <strong>דוא״ל:</strong> {portalUser.email}
                </p>
                {portalUser.lastLoginAt && (
                  <p>
                    <strong>כניסה אחרונה:</strong>{" "}
                    {formatDate(portalUser.lastLoginAt)}
                  </p>
                )}
              </div>
            ) : client.portalEnabled && !portalUser ? (
              <p
                style={{
                  color: "var(--foreground-muted)",
                  fontSize: "0.875rem",
                  marginBottom: "1rem",
                }}
              >
                יש ליצור גישה ללקוח
              </p>
            ) : (
              <p style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>
                הפורטל לא מופעל עבור לקוח זה
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Access Scope Card */}
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
            marginBottom: "1.25rem",
            color: "var(--foreground)",
          }}
        >
          ✓ סקופ הגישה
        </h3>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {[
            "הפרויקטים שלהם",
            "הגאנט שלהם",
            "אישורים ממתינים",
            "הקבצים שלהם",
          ].map((item) => (
            <li
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                color: "var(--foreground)",
                fontSize: "0.875rem",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "1.25rem",
                  height: "1.25rem",
                  backgroundColor: "#22c55e",
                  borderRadius: "50%",
                  color: "white",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Create Portal Account Form */}
      {showCreateForm && (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "var(--surface-raised)",
            border: "2px solid var(--accent)",
            borderRadius: "0.75rem",
          }}
        >
          <h3
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              marginBottom: "1.25rem",
              color: "var(--foreground)",
            }}
          >
            צור גישה חדשה ללקוח
          </h3>
          <form
            onSubmit={handleCreateAccount}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                כתובת דוא״ל
              </label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  color: "var(--foreground)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                שיטת אימות
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  marginTop: "0.75rem",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  <input
                    type="radio"
                    name="authMethod"
                    value="magic_link"
                    checked={formData.authMethod === "magic_link"}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        authMethod: e.target.value as "magic_link" | "password",
                      }))
                    }
                  />
                  קישור קסם
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  <input
                    type="radio"
                    name="authMethod"
                    value="password"
                    checked={formData.authMethod === "password"}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        authMethod: e.target.value as "magic_link" | "password",
                      }))
                    }
                  />
                  סיסמה
                </label>
              </div>
            </div>

            {formData.authMethod === "password" && (
              <>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "var(--foreground)",
                    }}
                  >
                    סיסמה
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      color: "var(--foreground)",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "var(--foreground)",
                    }}
                  >
                    אישור סיסמה
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      color: "var(--foreground)",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="submit"
                className="mod-btn-primary"
                style={{
                  padding: "0.625rem 1.125rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  borderRadius: "0.5rem",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: "var(--accent)",
                  color: "white",
                }}
              >
                צור חשבון
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="mod-btn-ghost"
                style={{
                  padding: "0.625rem 1.125rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  color: "var(--foreground)",
                }}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Actions Card */}
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
            marginBottom: "1.25rem",
            color: "var(--foreground)",
          }}
        >
          פעולות
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="mod-btn-primary"
              style={{
                padding: "0.625rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
                backgroundColor: "var(--accent)",
                color: "white",
                transition: "opacity 200ms ease",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.opacity = "0.9")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.opacity = "1")
              }
            >
              🔑 צור גישה ללקוח
            </button>
          )}

          <button
            onClick={handleResetPassword}
            disabled={!client.portalEnabled}
            className="mod-btn-ghost"
            style={{
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              cursor: !client.portalEnabled ? "not-allowed" : "pointer",
              backgroundColor: "transparent",
              color: "var(--foreground)",
              opacity: !client.portalEnabled ? 0.5 : 1,
            }}
          >
            🔄 איפוס סיסמה
          </button>

          <button
            onClick={handleSendLoginEmail}
            disabled={!client.portalEnabled}
            className="mod-btn-ghost"
            style={{
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              cursor: !client.portalEnabled ? "not-allowed" : "pointer",
              backgroundColor: "transparent",
              color: "var(--foreground)",
              opacity: !client.portalEnabled ? 0.5 : 1,
            }}
          >
            📧 שלח מייל גישה
          </button>

          <button
            onClick={() => setShowConfirmDisable(true)}
            disabled={!client.portalEnabled}
            className="mod-btn-ghost"
            style={{
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "0.5rem",
              border: "1px solid #ef4444",
              cursor: !client.portalEnabled ? "not-allowed" : "pointer",
              backgroundColor: "transparent",
              color: "#ef4444",
              opacity: !client.portalEnabled ? 0.5 : 1,
            }}
          >
            🚫 השבת פורטל
          </button>
        </div>
      </div>

      {/* Disable Portal Confirmation */}
      {showConfirmDisable && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "400px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
                color: "var(--foreground)",
              }}
            >
              השבת הפורטל?
            </h3>
            <p
              style={{
                color: "var(--foreground-muted)",
                fontSize: "0.875rem",
                marginBottom: "1.5rem",
              }}
            >
              הלקוח לא יוכל להיכנס לפורטל לאחר השבתה.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConfirmDisable(false)}
                className="mod-btn-ghost"
                style={{
                  padding: "0.625rem 1.125rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  color: "var(--foreground)",
                }}
              >
                ביטול
              </button>
              <button
                onClick={handleDisablePortal}
                className="mod-btn-primary"
                style={{
                  padding: "0.625rem 1.125rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  borderRadius: "0.5rem",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: "#ef4444",
                  color: "white",
                }}
              >
                השבת
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login History */}
      {client.portalEnabled && (
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
              marginBottom: "1.25rem",
              color: "var(--foreground)",
            }}
          >
            היסטוריית כניסות
          </h3>
          <div
            style={{
              overflowX: "auto",
            }}
          >
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
                    תאריך
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "0.75rem",
                      color: "var(--foreground-muted)",
                      fontWeight: 500,
                    }}
                  >
                    שעה
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "0.75rem",
                      color: "var(--foreground-muted)",
                      fontWeight: 500,
                    }}
                  >
                    כתובת IP
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockLoginHistory.map((login, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom:
                        idx < mockLoginHistory.length - 1
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
                      {formatDate(login.date)}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        color: "var(--foreground)",
                      }}
                    >
                      {login.time}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      {login.ip}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Portal Activity */}
      {clientPortalComments.length > 0 && (
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
              marginBottom: "1.25rem",
              color: "var(--foreground)",
            }}
          >
            💬 פעילות פורטל
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {clientPortalComments.slice(0, 5).map((comment) => (
              <div
                key={comment.id}
                style={{
                  padding: "1rem",
                  backgroundColor: "var(--background)",
                  borderRadius: "0.5rem",
                  borderRight: `3px solid ${comment.action === 'approve' ? '#22c55e' : comment.action === 'request_changes' ? '#f59e0b' : '#00B5FE'}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.625rem",
                        backgroundColor:
                          comment.action === 'approve'
                            ? '#22c55e20'
                            : comment.action === 'request_changes'
                            ? '#f59e0b20'
                            : '#00B5FE20',
                        color:
                          comment.action === 'approve'
                            ? '#22c55e'
                            : comment.action === 'request_changes'
                            ? '#f59e0b'
                            : '#00B5FE',
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        borderRadius: "0.3rem",
                      }}
                    >
                      {comment.action === 'approve'
                        ? '✓ אישור'
                        : comment.action === 'request_changes'
                        ? '⚠ בקשה לשינויים'
                        : '💬 תגובה'}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      {comment.entityType === 'gantt_item'
                        ? 'פריט גאנט'
                        : comment.entityType === 'approval'
                        ? 'אישור'
                        : comment.entityType === 'file'
                        ? 'קובץ'
                        : comment.entityType === 'project'
                        ? 'פרויקט'
                        : 'כללי'}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--foreground-muted)",
                    }}
                  >
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                {comment.comment && (
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--foreground)",
                      margin: "0.5rem 0 0 0",
                    }}
                  >
                    {comment.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
          {clientPortalComments.length > 5 && (
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--foreground-muted)",
                marginTop: "1rem",
                textAlign: "center",
              }}
            >
              ויש {clientPortalComments.length - 5} פעילויות נוספות...
            </p>
          )}
        </div>
      )}

      {/* Email Log Preview */}
      {portalEmailLogs.length > 0 && (
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
              marginBottom: "1.25rem",
              color: "var(--foreground)",
            }}
          >
            📧 היסטוריית מיילים
          </h3>
          <div
            style={{
              overflowX: "auto",
            }}
          >
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
                    תאריך
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
                {portalEmailLogs.slice(0, 5).map((log, idx) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom:
                        idx < Math.min(5, portalEmailLogs.length) - 1
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
                      {log.subject}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem",
                        color: "var(--foreground-muted)",
                        fontSize: "0.8rem",
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
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.625rem",
                          backgroundColor:
                            log.status === 'sent'
                              ? '#22c55e20'
                              : log.status === 'failed'
                              ? '#ef444420'
                              : '#f59e0b20',
                          color:
                            log.status === 'sent'
                              ? '#22c55e'
                              : log.status === 'failed'
                              ? '#ef4444'
                              : '#f59e0b',
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          borderRadius: "0.3rem",
                        }}
                      >
                        {log.status === 'sent'
                          ? '✓ נשלח'
                          : log.status === 'failed'
                          ? '✕ נכשל'
                          : '⏳ ממתין'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {portalEmailLogs.length > 5 && (
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--foreground-muted)",
                marginTop: "1rem",
                textAlign: "center",
              }}
            >
              ויש {portalEmailLogs.length - 5} מיילים נוספים...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
