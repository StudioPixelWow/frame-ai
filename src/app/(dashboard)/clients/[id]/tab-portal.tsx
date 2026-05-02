"use client";
import { useState, useCallback } from "react";
import { usePortalUsers, usePortalComments, useClientEmailLogs, useClients } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/lib/db/schema";
import UserAccessSection from "@/components/user-access-section";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${formatDate(dateStr)}, ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

function timeSince(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "היום";
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
  return `לפני ${Math.floor(days / 30)} חודשים`;
}

interface TabPortalProps {
  client: Client;
}

export default function TabPortal({ client }: TabPortalProps) {
  const { data: portalUsers, update: updatePortalUser } = usePortalUsers();
  const { data: portalComments } = usePortalComments();
  const { data: emailLogs } = useClientEmailLogs();
  const { update: updateClient } = useClients();
  const toast = useToast();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: client.email,
    authMethod: "password" as "password" | "magic_link",
    password: "",
    confirmPassword: "",
  });
  const [showConfirmDisable, setShowConfirmDisable] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const portalUser = portalUsers?.find((pu) => pu.clientId === client.id);
  const clientPortalComments = portalComments?.filter((pc) => pc.clientId === client.id) || [];
  const portalEmailLogs = emailLogs?.filter((el) => el.clientId === client.id && el.emailType.includes("portal")) || [];

  const portalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/client-portal`
    : "/client-portal";

  // Copy to clipboard helper
  const copyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast(`${fieldName} הועתק בהצלחה`, "success");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast("שגיאה בהעתקה", "error");
    }
  }, [toast]);

  // Generate random password
  const generatePassword = useCallback(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let pwd = "";
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  }, []);

  // Create portal account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) { toast("נא להזין כתובת דוא״ל", "error"); return; }

    let password = formData.password;
    if (formData.authMethod === "password") {
      if (!password) {
        password = generatePassword();
      } else if (password !== formData.confirmPassword) {
        toast("הסיסמאות אינן תואמות", "error");
        return;
      }
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/portal/create-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          email: formData.email,
          loginMethod: formData.authMethod,
          password: password || undefined,
        }),
      });

      if (response.ok) {
        setGeneratedPassword(password || null);
        toast("חשבון הפורטל נוצר בהצלחה!", "success");
        setShowCreateForm(false);
        setFormData({ email: client.email, authMethod: "password", password: "", confirmPassword: "" });
      } else {
        const error = await response.json();
        toast(error.error || "שגיאה ביצירת החשבון", "error");
      }
    } catch {
      toast("שגיאה ביצירת החשבון", "error");
    } finally {
      setIsCreating(false);
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    const newPass = generatePassword();
    setGeneratedPassword(newPass);
    if (portalUser) {
      try {
        await updatePortalUser(portalUser.id, { passwordHash: newPass, updatedAt: new Date().toISOString() });
        toast("סיסמה חדשה נוצרה! העתק אותה ושלח ללקוח", "success");
      } catch {
        toast("שגיאה באיפוס הסיסמה", "error");
      }
    }
  };

  // Send login email (mock)
  const handleSendLoginEmail = async () => {
    setSendingEmail(true);
    try {
      await fetch(`/api/clients/${client.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailType: "portal_login",
          subject: `פרטי התחברות לפורטל — סטודיו פיקסל`,
          recipientEmail: portalUser?.email || client.email,
        }),
      });
      toast("פרטי ההתחברות נשלחו בדוא״ל (מוק)", "success");
    } catch {
      toast("שגיאה בשליחת המייל", "error");
    } finally {
      setSendingEmail(false);
    }
  };

  // Send WhatsApp (mock)
  const handleSendWhatsApp = async () => {
    setSendingWhatsApp(true);
    setTimeout(() => {
      toast("פרטי ההתחברות נשלחו בווטסאפ (מוק)", "success");
      setSendingWhatsApp(false);
    }, 800);
  };

  // Disable portal
  const handleDisablePortal = async () => {
    try {
      await updateClient(client.id, { portalEnabled: false });
      toast("הפורטל הושבת בהצלחה", "success");
      setShowConfirmDisable(false);
    } catch {
      toast("שגיאה בהשבתת הפורטל", "error");
    }
  };

  // Enable portal
  const handleEnablePortal = async () => {
    try {
      await updateClient(client.id, { portalEnabled: true });
      toast("הפורטל הופעל!", "success");
    } catch {
      toast("שגיאה בהפעלת הפורטל", "error");
    }
  };

  // Auto-generate password for the form
  const handleAutoGenerate = () => {
    const pwd = generatePassword();
    setFormData(prev => ({ ...prev, password: pwd, confirmPassword: pwd }));
  };

  const hasPortalAccess = client.portalEnabled && portalUser;
  const noAccessYet = !portalUser;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ═══ SYSTEM ACCESS (AUTH) ═══ */}
      <UserAccessSection
        entityType="client"
        entityId={client.id}
        entityEmail={client.email}
        entityName={client.name}
      />

      {/* ═══ PORTAL LOGIN CREDENTIALS SECTION ═══ */}
      {hasPortalAccess ? (
        <div style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "2px solid #22c55e30",
          borderRadius: "0.75rem",
          position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "#22c55e15", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.25rem",
            }}>🟢</div>
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
                פרטי התחברות לפורטל לקוח
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", margin: "0.15rem 0 0" }}>
                הפורטל פעיל — הלקוח יכול להיכנס ולראות את המידע שלו
              </p>
            </div>
          </div>

          {/* Credentials Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {/* Portal URL */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.875rem 1rem", background: "var(--background)", borderRadius: "0.5rem",
              border: "1px solid var(--border)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  כתובת הפורטל
                </div>
                <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--accent)", direction: "ltr", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {portalUrl}
                </div>
              </div>
              <button onClick={() => copyToClipboard(portalUrl, "קישור")} style={{
                padding: "0.4rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border)",
                background: copiedField === "קישור" ? "#22c55e15" : "var(--surface-raised)",
                color: copiedField === "קישור" ? "#22c55e" : "var(--foreground)",
                cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, marginRight: "0.75rem",
                transition: "all 150ms", flexShrink: 0,
              }}>
                {copiedField === "קישור" ? "✓ הועתק" : "📋 העתק"}
              </button>
            </div>

            {/* Email / Username */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.875rem 1rem", background: "var(--background)", borderRadius: "0.5rem",
              border: "1px solid var(--border)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  שם משתמש (דוא״ל)
                </div>
                <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--foreground)" }}>
                  {portalUser.email}
                </div>
              </div>
              <button onClick={() => copyToClipboard(portalUser.email, "דוא״ל")} style={{
                padding: "0.4rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border)",
                background: copiedField === "דוא״ל" ? "#22c55e15" : "var(--surface-raised)",
                color: copiedField === "דוא״ל" ? "#22c55e" : "var(--foreground)",
                cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, marginRight: "0.75rem",
                transition: "all 150ms", flexShrink: 0,
              }}>
                {copiedField === "דוא״ל" ? "✓ הועתק" : "📋 העתק"}
              </button>
            </div>

            {/* Password */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.875rem 1rem", background: "var(--background)", borderRadius: "0.5rem",
              border: "1px solid var(--border)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  סיסמה
                </div>
                <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--foreground)", fontFamily: showPassword ? "inherit" : "monospace" }}>
                  {showPassword
                    ? (generatedPassword || portalUser.passwordHash || "demo")
                    : "••••••••••"
                  }
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, marginRight: "0.75rem" }}>
                <button onClick={() => setShowPassword(!showPassword)} style={{
                  padding: "0.4rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)",
                  background: "var(--surface-raised)", color: "var(--foreground)",
                  cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, transition: "all 150ms",
                }}>
                  {showPassword ? "🙈" : "👁️"}
                </button>
                <button onClick={() => copyToClipboard(generatedPassword || portalUser.passwordHash || "demo", "סיסמה")} style={{
                  padding: "0.4rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border)",
                  background: copiedField === "סיסמה" ? "#22c55e15" : "var(--surface-raised)",
                  color: copiedField === "סיסמה" ? "#22c55e" : "var(--foreground)",
                  cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, transition: "all 150ms",
                }}>
                  {copiedField === "סיסמה" ? "✓ הועתק" : "📋 העתק"}
                </button>
              </div>
            </div>

            {/* Login Status Row */}
            <div style={{
              display: "flex", gap: "1rem", flexWrap: "wrap",
              padding: "0.875rem 1rem", background: "var(--background)", borderRadius: "0.5rem",
              border: "1px solid var(--border)",
            }}>
              <div style={{ flex: 1, minWidth: "140px" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  סטטוס חשבון
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: portalUser.isActive ? "#22c55e" : "#ef4444",
                    boxShadow: portalUser.isActive ? "0 0 6px #22c55e60" : "none",
                  }} />
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: portalUser.isActive ? "#22c55e" : "#ef4444" }}>
                    {portalUser.isActive ? "פעיל" : "מושבת"}
                  </span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: "140px" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  כניסה אחרונה
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground)" }}>
                  {portalUser.lastLoginAt
                    ? `${formatDateTime(portalUser.lastLoginAt)} (${timeSince(portalUser.lastLoginAt)})`
                    : "טרם התחבר"
                  }
                </div>
              </div>
              <div style={{ flex: 1, minWidth: "140px" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                  נוצר
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--foreground)" }}>
                  {formatDate(portalUser.createdAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Generated password banner */}
          {generatedPassword && (
            <div style={{
              marginTop: "1rem", padding: "1rem", borderRadius: "0.5rem",
              background: "#f59e0b10", border: "1px solid #f59e0b30",
            }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f59e0b", margin: "0 0 0.5rem 0" }}>
                ⚠️ סיסמה זמנית חדשה — העתק ושלח ללקוח
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <code style={{
                  flex: 1, padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
                  background: "var(--background)", border: "1px solid var(--border)",
                  fontSize: "1rem", fontWeight: 700, letterSpacing: "0.05em",
                  color: "var(--foreground)",
                }}>
                  {generatedPassword}
                </code>
                <button onClick={() => copyToClipboard(generatedPassword, "סיסמה חדשה")} style={{
                  padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none",
                  background: "#f59e0b", color: "white",
                  cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, flexShrink: 0,
                }}>
                  {copiedField === "סיסמה חדשה" ? "✓ הועתק!" : "📋 העתק סיסמה"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : noAccessYet ? (
        /* ═══ NO ACCESS YET — CTA ═══ */
        <div style={{
          padding: "2.5rem",
          backgroundColor: "var(--surface-raised)",
          border: "2px dashed var(--border)",
          borderRadius: "0.75rem",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔐</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem", color: "var(--foreground)" }}>
            אין גישת פורטל ללקוח זה
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--foreground-muted)", marginBottom: "1.5rem", maxWidth: "400px", marginLeft: "auto", marginRight: "auto" }}>
            צור חשבון גישה כדי שהלקוח יוכל לראות את התוכנית, לאשר תכנים ולצפות בקבצים שלו.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: "0.875rem 2rem", borderRadius: "0.75rem", border: "none",
              background: "var(--accent)", color: "white",
              cursor: "pointer", fontSize: "1rem", fontWeight: 700,
              transition: "all 200ms ease",
              boxShadow: "0 4px 12px rgba(0,181,254,0.3)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
          >
            🔑 צור גישה ללקוח
          </button>
        </div>
      ) : (
        /* Portal disabled but user exists */
        <div style={{
          padding: "2rem", backgroundColor: "var(--surface-raised)",
          border: "2px solid #ef444430", borderRadius: "0.75rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ fontSize: "1.5rem" }}>🔴</div>
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
                הפורטל מושבת
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", margin: "0.15rem 0 0" }}>
                הלקוח לא יכול להיכנס כרגע. ניתן להפעיל מחדש.
              </p>
            </div>
          </div>
          <button onClick={handleEnablePortal} style={{
            padding: "0.625rem 1.25rem", borderRadius: "0.5rem", border: "none",
            background: "#22c55e", color: "white", cursor: "pointer",
            fontSize: "0.875rem", fontWeight: 700,
          }}>
            🟢 הפעל פורטל מחדש
          </button>
        </div>
      )}

      {/* ═══ ACTIONS CARD ═══ */}
      {hasPortalAccess && (
        <div style={{
          padding: "1.5rem", backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)", borderRadius: "0.75rem",
        }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem", color: "var(--foreground)" }}>
            פעולות מהירות
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.625rem" }}>
            <button onClick={handleResetPassword} style={{
              padding: "0.5rem 1rem", borderRadius: "0.5rem",
              border: "1px solid var(--border)", background: "var(--background)",
              color: "var(--foreground)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
              transition: "all 150ms",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
            >
              🔄 איפוס סיסמה
            </button>

            <button onClick={handleSendLoginEmail} disabled={sendingEmail} style={{
              padding: "0.5rem 1rem", borderRadius: "0.5rem",
              border: "1px solid var(--border)", background: "var(--background)",
              color: "var(--foreground)", cursor: sendingEmail ? "not-allowed" : "pointer",
              fontSize: "0.8rem", fontWeight: 600, opacity: sendingEmail ? 0.5 : 1,
              transition: "all 150ms",
            }}
            onMouseEnter={e => { if (!sendingEmail) (e.currentTarget as HTMLElement).style.borderColor = "#22c55e"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
            >
              {sendingEmail ? "⏳ שולח..." : "📧 שלח פרטי גישה במייל"}
            </button>

            <button onClick={handleSendWhatsApp} disabled={sendingWhatsApp} style={{
              padding: "0.5rem 1rem", borderRadius: "0.5rem",
              border: "1px solid #25D36630", background: "#25D36608",
              color: "#25D366", cursor: sendingWhatsApp ? "not-allowed" : "pointer",
              fontSize: "0.8rem", fontWeight: 600, opacity: sendingWhatsApp ? 0.5 : 1,
              transition: "all 150ms",
            }}>
              {sendingWhatsApp ? "⏳ שולח..." : "💬 שלח בווטסאפ"}
            </button>

            <button onClick={() => copyToClipboard(
              `שלום ${client.name},\n\nהנה פרטי ההתחברות לפורטל הלקוח שלך:\n\nכתובת: ${portalUrl}\nדוא״ל: ${portalUser.email}\nסיסמה: ${generatedPassword || portalUser.passwordHash || "demo"}\n\nבברכה,\nסטודיו פיקסל`,
              "כל הפרטים"
            )} style={{
              padding: "0.5rem 1rem", borderRadius: "0.5rem",
              border: "1px solid var(--accent)30", background: "var(--accent)08",
              color: "var(--accent)", cursor: "pointer",
              fontSize: "0.8rem", fontWeight: 600, transition: "all 150ms",
            }}>
              {copiedField === "כל הפרטים" ? "✓ הועתק!" : "📝 העתק כל הפרטים כהודעה"}
            </button>

            <div style={{ flex: "1 0 100%", borderTop: "1px solid var(--border)", margin: "0.25rem 0" }} />

            <button onClick={() => setShowConfirmDisable(true)} style={{
              padding: "0.5rem 1rem", borderRadius: "0.5rem",
              border: "1px solid #ef444430", background: "transparent",
              color: "#ef4444", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
            }}>
              🚫 השבת פורטל
            </button>
          </div>
        </div>
      )}

      {/* ═══ ACCESS SCOPE ═══ */}
      <div style={{
        padding: "1.5rem", backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)", borderRadius: "0.75rem",
      }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem", color: "var(--foreground)" }}>
          מה הלקוח רואה בפורטל
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
          {[
            { icon: "📅", label: "לוח תוכן (גאנט)", desc: "כל התכנים המתוכננים", ok: true },
            { icon: "✅", label: "אישורים", desc: "אישור / בקשת שינויים", ok: true },
            { icon: "📂", label: "קבצים משותפים", desc: "כל הקבצים (לא חשבונאי)", ok: true },
            { icon: "🚀", label: "פרויקטים", desc: "סטטוס ואבני דרך", ok: true },
            { icon: "🎯", label: "לידים", desc: "לידים שהתקבלו", ok: true },
            { icon: "📣", label: "קמפיינים", desc: "סיכום ביצועים", ok: true },
            { icon: "📋", label: "פעילות אחרונה", desc: "ציר זמן עדכונים", ok: true },
            { icon: "🔒", label: "הנהלת חשבונות", desc: "מוסתר מהלקוח", ok: false },
            { icon: "🔒", label: "עומס עבודה / רווח", desc: "מוסתר מהלקוח", ok: false },
            { icon: "🔒", label: "הערות פנימיות", desc: "מוסתר מהלקוח", ok: false },
          ].map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: "0.65rem",
              padding: "0.625rem 0.75rem", borderRadius: "0.5rem",
              background: item.ok ? "#22c55e08" : "#ef444408",
              border: `1px solid ${item.ok ? "#22c55e20" : "#ef444420"}`,
            }}>
              <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: item.ok ? "var(--foreground)" : "#9ca3af" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ CREATE FORM ═══ */}
      {showCreateForm && (
        <div style={{
          padding: "2rem", backgroundColor: "var(--surface-raised)",
          border: "2px solid var(--accent)", borderRadius: "0.75rem",
        }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1.25rem", color: "var(--foreground)" }}>
            צור גישה חדשה ללקוח
          </h3>
          <form onSubmit={handleCreateAccount} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Email */}
            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>
                כתובת דוא״ל
              </label>
              <input type="email" value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                style={{
                  width: "100%", padding: "0.625rem 0.875rem", backgroundColor: "var(--background)",
                  border: "1px solid var(--border)", borderRadius: "0.5rem", color: "var(--foreground)", fontSize: "0.875rem",
                }} />
            </div>

            {/* Auth method */}
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>שיטת אימות</label>
              <div style={{ display: "flex", gap: "1rem" }}>
                {[
                  { value: "password", label: "סיסמה" },
                  { value: "magic_link", label: "קישור קסם" },
                ].map(opt => (
                  <label key={opt.value} style={{
                    display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer",
                    padding: "0.5rem 1rem", borderRadius: "0.5rem",
                    border: `1px solid ${formData.authMethod === opt.value ? "var(--accent)" : "var(--border)"}`,
                    background: formData.authMethod === opt.value ? "var(--accent)08" : "transparent",
                    fontSize: "0.85rem", fontWeight: 500,
                  }}>
                    <input type="radio" name="authMethod" value={opt.value}
                      checked={formData.authMethod === opt.value}
                      onChange={e => setFormData(prev => ({ ...prev, authMethod: e.target.value as any }))}
                      style={{ display: "none" }}
                    />
                    <span style={{
                      width: 14, height: 14, borderRadius: "50%", border: "2px solid",
                      borderColor: formData.authMethod === opt.value ? "var(--accent)" : "var(--border)",
                      background: formData.authMethod === opt.value ? "var(--accent)" : "transparent",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Password fields */}
            {formData.authMethod === "password" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>סיסמה</label>
                  <button type="button" onClick={handleAutoGenerate} style={{
                    padding: "0.25rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--accent)30",
                    background: "var(--accent)08", color: "var(--accent)",
                    cursor: "pointer", fontSize: "0.72rem", fontWeight: 700,
                  }}>
                    🎲 ייצר אוטומטי
                  </button>
                </div>
                <input type="text" value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="השאר ריק לייצור אוטומטי"
                  style={{
                    width: "100%", padding: "0.625rem 0.875rem", backgroundColor: "var(--background)",
                    border: "1px solid var(--border)", borderRadius: "0.5rem", color: "var(--foreground)",
                    fontSize: "0.875rem", fontFamily: "monospace",
                  }} />
              </div>
            )}

            {/* Submit */}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button type="submit" disabled={isCreating} style={{
                padding: "0.75rem 1.5rem", fontSize: "0.9rem", fontWeight: 700, borderRadius: "0.5rem",
                border: "none", cursor: isCreating ? "not-allowed" : "pointer",
                backgroundColor: "var(--accent)", color: "white", opacity: isCreating ? 0.7 : 1,
              }}>
                {isCreating ? "⏳ יוצר..." : "🔑 צור חשבון"}
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)} style={{
                padding: "0.75rem 1.5rem", fontSize: "0.9rem", fontWeight: 600, borderRadius: "0.5rem",
                border: "1px solid var(--border)", cursor: "pointer",
                backgroundColor: "transparent", color: "var(--foreground)",
              }}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ DISABLE CONFIRM MODAL ═══ */}
      {showConfirmDisable && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000,
        }} onClick={() => setShowConfirmDisable(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: "var(--surface-raised)", border: "1px solid var(--border)",
            borderRadius: "0.75rem", padding: "2rem", maxWidth: "420px", width: "90%",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: "2rem", textAlign: "center", marginBottom: "0.75rem" }}>⚠️</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, textAlign: "center", marginBottom: "0.5rem", color: "var(--foreground)" }}>
              להשבית את הפורטל?
            </h3>
            <p style={{ color: "var(--foreground-muted)", fontSize: "0.875rem", textAlign: "center", marginBottom: "1.5rem" }}>
              הלקוח לא יוכל להיכנס ולצפות במידע שלו. ניתן להפעיל שוב בכל עת.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button onClick={() => setShowConfirmDisable(false)} style={{
                padding: "0.625rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, borderRadius: "0.5rem",
                border: "1px solid var(--border)", cursor: "pointer",
                backgroundColor: "transparent", color: "var(--foreground)",
              }}>ביטול</button>
              <button onClick={handleDisablePortal} style={{
                padding: "0.625rem 1.5rem", fontSize: "0.875rem", fontWeight: 700, borderRadius: "0.5rem",
                border: "none", cursor: "pointer", backgroundColor: "#ef4444", color: "white",
              }}>השבת פורטל</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PORTAL ACTIVITY ═══ */}
      {clientPortalComments.length > 0 && (
        <div style={{
          padding: "1.5rem", backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)", borderRadius: "0.75rem",
        }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem", color: "var(--foreground)" }}>
            💬 פעילות לקוח בפורטל
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {clientPortalComments.slice(0, 5).map(comment => (
              <div key={comment.id} style={{
                padding: "0.875rem", backgroundColor: "var(--background)", borderRadius: "0.5rem",
                borderRight: `3px solid ${comment.action === "approve" ? "#22c55e" : comment.action === "request_changes" ? "#f59e0b" : "#00B5FE"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: comment.comment ? "0.4rem" : 0 }}>
                  <span style={{
                    padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.7rem", fontWeight: 600,
                    background: comment.action === "approve" ? "#22c55e15" : comment.action === "request_changes" ? "#f59e0b15" : "#00B5FE15",
                    color: comment.action === "approve" ? "#22c55e" : comment.action === "request_changes" ? "#f59e0b" : "#00B5FE",
                  }}>
                    {comment.action === "approve" ? "✓ אישור" : comment.action === "request_changes" ? "⚠ שינויים" : "💬 תגובה"}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>{formatDate(comment.createdAt)}</span>
                </div>
                {comment.comment && (
                  <p style={{ fontSize: "0.85rem", color: "var(--foreground)", margin: 0 }}>{comment.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ EMAIL LOG ═══ */}
      {portalEmailLogs.length > 0 && (
        <div style={{
          padding: "1.5rem", backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)", borderRadius: "0.75rem",
        }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem", color: "var(--foreground)" }}>
            📧 היסטוריית מיילים
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "right", padding: "0.625rem", color: "var(--foreground-muted)", fontWeight: 500 }}>נושא</th>
                  <th style={{ textAlign: "right", padding: "0.625rem", color: "var(--foreground-muted)", fontWeight: 500 }}>נמען</th>
                  <th style={{ textAlign: "right", padding: "0.625rem", color: "var(--foreground-muted)", fontWeight: 500 }}>תאריך</th>
                  <th style={{ textAlign: "right", padding: "0.625rem", color: "var(--foreground-muted)", fontWeight: 500 }}>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {portalEmailLogs.slice(0, 5).map((log, idx) => (
                  <tr key={log.id} style={{ borderBottom: idx < Math.min(5, portalEmailLogs.length) - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "0.625rem", color: "var(--foreground)" }}>{log.subject}</td>
                    <td style={{ padding: "0.625rem", color: "var(--foreground-muted)", fontSize: "0.8rem" }}>{log.recipientEmail}</td>
                    <td style={{ padding: "0.625rem", color: "var(--foreground)" }}>{formatDate(log.sentAt)}</td>
                    <td style={{ padding: "0.625rem" }}>
                      <span style={{
                        padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.68rem", fontWeight: 600,
                        background: log.status === "sent" ? "#22c55e15" : log.status === "failed" ? "#ef444415" : "#f59e0b15",
                        color: log.status === "sent" ? "#22c55e" : log.status === "failed" ? "#ef4444" : "#f59e0b",
                      }}>
                        {log.status === "sent" ? "✓ נשלח" : log.status === "failed" ? "✕ נכשל" : "⏳ ממתין"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
