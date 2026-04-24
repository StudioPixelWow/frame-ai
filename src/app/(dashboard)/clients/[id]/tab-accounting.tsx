"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePayments } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import type { Client, Payment } from "@/lib/db/schema";

interface TabAccountingProps {
  client: Client;
}

const PAYMENT_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  invoice: { label: "חשבונית", icon: "📄" },
  retainer: { label: "ריטיינר", icon: "🔄" },
  milestone: { label: "מילוסטון", icon: "🎯" },
  expense: { label: "הוצאה", icon: "💰" },
};

const PAYMENT_STATUS_INFO: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  draft: { label: "טיוטה", color: "#6b7280", bg: "#f3f4f6", icon: "✏️" },
  pending: { label: "ממתין", color: "#b45309", bg: "#fef3c7", icon: "⏳" },
  msg_sent: { label: "הודעה נשלחה", color: "#0369a1", bg: "#f0f9ff", icon: "📧" },
  paid: { label: "שולם", color: "#065f46", bg: "#d1fae5", icon: "✅" },
  overdue: { label: "באיחור", color: "#991b1b", bg: "#fee2e2", icon: "⚠️" },
  write_off: { label: "ביטול", color: "#6b7280", bg: "#f3f4f6", icon: "❌" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Compute the next retainer payment date from the billing day. */
function computeNextPaymentDate(retainerDay: number): string | null {
  if (!retainerDay || retainerDay < 1 || retainerDay > 28) return null;
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), retainerDay);
  // If today is past the billing day this month, next is next month
  if (now.getTime() > thisMonth.getTime()) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, retainerDay);
    return next.toISOString().split('T')[0];
  }
  return thisMonth.toISOString().split('T')[0];
}

/** Compute payment status from retainer and payment history. */
function computePaymentStatus(
  retainerAmount: number,
  retainerDay: number,
  payments: Payment[]
): "current" | "overdue" | "pending" | "none" {
  if (!retainerAmount || retainerAmount <= 0) return "none";
  // Check if there's a pending/overdue retainer payment
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), retainerDay || 1);
  const paidThisMonth = payments.some(
    (p) => p.status === "paid" && p.paidAt && new Date(p.paidAt).getMonth() === now.getMonth() && new Date(p.paidAt).getFullYear() === now.getFullYear()
  );
  if (paidThisMonth) return "current";
  if (now.getTime() > thisMonth.getTime()) return "overdue";
  return "pending";
}

export default function TabAccounting({ client }: TabAccountingProps) {
  const { data: allPayments, loading } = usePayments();
  const router = useRouter();
  const toast = useToast();
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  const payments = (allPayments || [])
    .filter((p) => p.clientId === client.id)
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  const overduePayments = payments.filter((p) => p.status === "overdue");

  // Compute next payment date and status from retainer fields
  const computedNextDate = client.retainerAmount > 0
    ? computeNextPaymentDate(client.retainerDay)
    : (client.nextPaymentDate || null);
  const computedPaymentStatus = client.retainerAmount > 0
    ? computePaymentStatus(client.retainerAmount, client.retainerDay, payments)
    : (client.paymentStatus || "none");
  const daysUntilNextPayment = computedNextDate ? daysUntil(computedNextDate) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Overdue Alert */}
      {overduePayments.length > 0 && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: "0.75rem",
            padding: "1rem",
            display: "flex",
            gap: "1rem",
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>⚠️</div>
          <div>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#991b1b", margin: "0 0 0.25rem 0" }}>
              {overduePayments.length} תשלום{overduePayments.length > 1 ? "ים" : ""} באיחור
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#7f1d1d", margin: 0 }}>
              יש תשלומים שעברו את תאריך הגבייה. אנא פעל בהקדם.
            </p>
          </div>
        </div>
      )}

      {/* Financial Summary Card */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: `1px solid var(--border)`,
          borderRadius: "0.75rem",
          padding: "2rem",
        }}
      >
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "1.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          סיכום פיננסי
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem" }}>
          {/* Monthly Retainer */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ריטיינר חודשי
            </div>
            <div
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                color: "var(--foreground)",
                marginBottom: "0.5rem",
              }}
            >
              {client.retainerAmount > 0 ? `₪${client.retainerAmount.toLocaleString("he-IL")}` : "ללא ריטיינר"}
            </div>
            {client.retainerAmount > 0 && (
              <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                בעד {client.retainerDay} של החודש
              </div>
            )}
          </div>

          {/* Next Payment */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              התשלום הבא
            </div>
            <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.5rem" }}>
              {computedNextDate ? formatDate(computedNextDate) : "לא נקבע"}
            </div>
            {daysUntilNextPayment !== null && daysUntilNextPayment > 0 && (
              <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                עוד {daysUntilNextPayment} ימים
              </div>
            )}
          </div>

          {/* Payment Status */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              סטטוס תשלום
            </div>
            <div
              style={{
                fontSize: "0.875rem",
                padding: "0.5rem 0.75rem",
                background:
                  computedPaymentStatus === "current"
                    ? "#d1fae5"
                    : computedPaymentStatus === "overdue"
                      ? "#fee2e2"
                      : computedPaymentStatus === "pending"
                        ? "#fef3c7"
                        : "#f3f4f6",
                color:
                  computedPaymentStatus === "current"
                    ? "#065f46"
                    : computedPaymentStatus === "overdue"
                      ? "#991b1b"
                      : computedPaymentStatus === "pending"
                        ? "#b45309"
                        : "#6b7280",
                borderRadius: "0.375rem",
                fontWeight: 600,
                width: "fit-content",
              }}
            >
              {computedPaymentStatus === "current"
                ? "✅ עדכני"
                : computedPaymentStatus === "overdue"
                  ? "⚠️ באיחור"
                  : computedPaymentStatus === "pending"
                    ? "⏳ ממתין"
                    : "⭕ לא קבוע"}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Type Info */}
      {client.clientType === "hosting" && (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1e293b", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            💻 מחזור אחסון שנתי
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.5rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                תאריך חידוש
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#1e293b" }}>
                {computedNextDate ? formatDate(computedNextDate) : "לא נקבע"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                עלות שנתית
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#1e293b" }}>
                ₪{(client.retainerAmount * 12).toLocaleString("he-IL")}
              </div>
            </div>
          </div>
        </div>
      )}

      {(client.clientType === "branding" || client.clientType === "websites") && (
        <div
          style={{
            background: "#fafaf0",
            border: "1px solid #e7e5e4",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#292524", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            🏗️ תשלומים מקושרים לפרויקט
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#57534e", margin: 0 }}>
            תשלומים עבור לקוח זה מקושרים לפרויקטים וקבוצות. עיין בהיסטוריית התשלומים למטה להצגת כל התשלומים.
          </p>
        </div>
      )}

      {/* Payment History */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--foreground-muted)", margin: 0 }}>
            היסטוריית תשלומים
          </h3>
          <button
            className="mod-btn-ghost"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
            }}
          >
            📊 גרף תשלומים
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--foreground-muted)" }}>
            טוען היסטוריה...
          </div>
        ) : payments.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 2rem",
              background: "var(--surface-raised)",
              borderRadius: "0.75rem",
              border: `1px solid var(--border)`,
              color: "var(--foreground-muted)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
            <div style={{ marginBottom: "1.25rem" }}>אין היסטוריית תשלומים</div>
            <button
              className="mod-btn-primary"
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
              }}
            >
              ➕ צור תשלום ראשון
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid var(--border)` }}>
                  <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    מספר חשבונית
                  </th>
                  <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    סוג
                  </th>
                  <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    סכום
                  </th>
                  <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    סטטוס
                  </th>
                  <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    תאריך יעד
                  </th>
                  <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    תאריך תשלום
                  </th>
                  <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    style={{
                      borderBottom: `1px solid var(--border)`,
                      background: payment.status === "overdue" ? "rgba(254, 226, 226, 0.3)" : undefined,
                    }}
                  >
                    <td style={{ padding: "1rem", textAlign: "right", color: "var(--foreground)", fontWeight: 500 }}>
                      {payment.invoiceNo}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          fontSize: "0.8rem",
                          color: "var(--foreground-muted)",
                        }}
                      >
                        {PAYMENT_TYPE_LABELS[payment.type]?.icon} {PAYMENT_TYPE_LABELS[payment.type]?.label}
                      </div>
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right", color: "var(--foreground)", fontWeight: 600 }}>
                      ₪{payment.amount.toLocaleString("he-IL")}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          fontSize: "0.8rem",
                          padding: "0.375rem 0.625rem",
                          background: PAYMENT_STATUS_INFO[payment.status]?.bg,
                          color: PAYMENT_STATUS_INFO[payment.status]?.color,
                          borderRadius: "0.25rem",
                          fontWeight: 600,
                        }}
                      >
                        {PAYMENT_STATUS_INFO[payment.status]?.icon} {PAYMENT_STATUS_INFO[payment.status]?.label}
                      </div>
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right", color: "var(--foreground-muted)" }}>
                      {formatDate(payment.dueDate)}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right", color: payment.paidAt ? "var(--foreground)" : "var(--foreground-muted)" }}>
                      {payment.paidAt ? formatDate(payment.paidAt) : "—"}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        {payment.status === "pending" || payment.status === "overdue" ? (
                          <button
                            onClick={() => {
                              setSelectedPaymentId(payment.id);
                              setShowMarkPaidModal(true);
                            }}
                            className="mod-btn-ghost"
                            style={{
                              padding: "0.375rem 0.75rem",
                              fontSize: "0.75rem",
                            }}
                          >
                            ✅ שלום
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions Bar */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          className="mod-btn-ghost"
          disabled={sendingReminder}
          onClick={async () => {
            setSendingReminder(true);
            try {
              // Mock email send — structure ready for real email API
              await new Promise(resolve => setTimeout(resolve, 800));
              toast.success(`תזכורת גבייה נשלחה ל${client.name} (${client.email || "ללא אימייל"})`);
            } catch {
              toast.error("שגיאה בשליחת תזכורת");
            } finally {
              setSendingReminder(false);
            }
          }}
          style={{
            padding: "0.625rem 1.125rem",
            fontSize: "0.875rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            opacity: sendingReminder ? 0.6 : 1,
            cursor: sendingReminder ? "wait" : "pointer",
          }}
        >
          {sendingReminder ? "⏳ שולח..." : "📧 שלח תזכורת גבייה"}
        </button>
        <button
          className="mod-btn-ghost"
          onClick={() => router.push("/accounting")}
          style={{
            padding: "0.625rem 1.125rem",
            fontSize: "0.875rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            cursor: "pointer",
          }}
        >
          📊 פתח מודול הנהח״ש
        </button>
      </div>

      {/* Mark Paid Modal */}
      {showMarkPaidModal && selectedPaymentId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setShowMarkPaidModal(false)}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "450px",
              width: "90%",
              border: `1px solid var(--border)`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "1.5rem" }}>
              ✅ סמן כשולם
            </h2>

            <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--surface-raised)", borderRadius: "0.5rem", border: `1px solid var(--border)` }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                פרטי התשלום
              </div>
              {payments.length > 0 && selectedPaymentId && (
                <>
                  <div style={{ fontSize: "0.875rem", color: "var(--foreground)", marginBottom: "0.5rem" }}>
                    <strong>מס׳ חשבונית:</strong> {payments.find((p) => p.id === selectedPaymentId)?.invoiceNo}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--foreground)" }}>
                    <strong>סכום:</strong> ₪{payments.find((p) => p.id === selectedPaymentId)?.amount.toLocaleString("he-IL")}
                  </div>
                </>
              )}
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: "0.5rem" }}>
                תאריך התשלום
              </label>
              <input
                type="date"
                className="form-input"
                style={{
                  width: "100%",
                  padding: "0.625rem",
                  fontSize: "0.875rem",
                }}
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowMarkPaidModal(false)}
                className="mod-btn-ghost"
                style={{
                  padding: "0.625rem 1.125rem",
                  fontSize: "0.875rem",
                }}
              >
                ביטול
              </button>
              <button
                className="mod-btn-primary"
                style={{
                  padding: "0.625rem 1.125rem",
                  fontSize: "0.875rem",
                }}
              >
                ✅ סמן כשולם
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
