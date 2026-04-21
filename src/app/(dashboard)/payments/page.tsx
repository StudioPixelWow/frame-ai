"use client";

import { useState } from "react";
import { usePayments, useClients } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { SmartHint } from "@/components/ui/smart-hint";
import type { Payment } from "@/lib/db/schema";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  paid: { label: "שולם", color: "#22c55e" },
  pending: { label: "ממתין", color: "#fbbf24" },
  overdue: { label: "בפיגור", color: "#f87171" },
  msg_sent: { label: "הודעה נשלחה", color: "#a78bfa" },
  draft: { label: "טיוטה", color: "#6b7280" },
  write_off: { label: "מחיקה", color: "#52525b" },
};

const TYPE_LABELS: Record<string, string> = {
  invoice: "חשבונית",
  retainer: "ריטיינר",
  milestone: "אבן דרך",
  expense: "הוצאה",
};

export default function PaymentsPage() {
  const { data: payments, loading, create, update, remove } = usePayments();
  const { data: clients } = useClients();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const [form, setForm] = useState({
    clientId: "", clientName: "", invoiceNo: "", type: "invoice" as Payment["type"],
    amount: 0, status: "pending" as Payment["status"], dueDate: "",
    description: "", paidAt: null as string | null,
  });

  const openCreate = () => {
    setEditingPayment(null);
    setForm({ clientId: "", clientName: "", invoiceNo: "", type: "invoice", amount: 0, status: "pending", dueDate: "", description: "", paidAt: null });
    setModalOpen(true);
  };

  const openEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setForm({
      clientId: payment.clientId, clientName: payment.clientName,
      invoiceNo: payment.invoiceNo, type: payment.type, amount: payment.amount,
      status: payment.status, dueDate: payment.dueDate, description: payment.description,
      paidAt: payment.paidAt,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.description.trim()) { toast("תיאור הוא שדה חובה", "error"); return; }
    const client = clients.find((c) => c.id === form.clientId);
    const payload = { ...form, clientName: client?.name || form.clientName };
    try {
      if (editingPayment) {
        await update(editingPayment.id, payload);
        toast("התשלום עודכן", "success");
      } else {
        await create(payload);
        toast("תשלום חדש נוצר", "success");
      }
      setModalOpen(false);
    } catch {
      toast("שגיאה בשמירה", "error");
    }
  };

  const handleMarkPaid = async (payment: Payment) => {
    await update(payment.id, { status: "paid", paidAt: new Date().toISOString() });
    toast("סומן כשולם", "success");
  };

  // KPI computation
  const totalRevenue = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter((p) => p.status === "overdue").reduce((s, p) => s + p.amount, 0);
  const totalAll = payments.reduce((s, p) => s + p.amount, 0);

  // Smart hints data
  const overduePayments = payments.filter((p) => p.status === "overdue");
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const overduCount = overduePayments.length;
  const pendingCount = pendingPayments.length;

  const kpis = [
    { label: "סה״כ הכנסות", value: totalRevenue, color: "#34d399" },
    { label: "ממתין לתשלום", value: totalPending, color: "#fbbf24" },
    { label: "בפיגור", value: totalOverdue, color: "#f87171" },
    { label: "סה״כ", value: totalAll, color: "#a78bfa" },
  ];

  // Filter
  const filtered = payments.filter((p) => {
    if (activeTab === "invoices" && p.type !== "invoice") return false;
    if (activeTab === "retainers" && p.type !== "retainer") return false;
    if (activeTab === "expenses" && p.type !== "expense") return false;
    if (search) {
      const q = search.toLowerCase();
      return p.clientName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.invoiceNo.toLowerCase().includes(q);
    }
    return true;
  });

  const tableTotal = filtered.reduce((s, p) => s + p.amount, 0);

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-8 pay-page">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 className="mod-page-title">💳 תשלומים וחשבוניות</h1>
          </div>
          <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={openCreate}>+ חשבונית חדשה</button>
        </div>

        {/* KPI */}
        <div className="pay-kpi-row ux-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} className="agd-card ux-card ux-light-sweep ux-stagger-item" style={{ padding: "1rem" }}>
              <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)", marginBottom: "0.35rem" }}>{kpi.label}</p>
              <p style={{ fontSize: "1.35rem", fontWeight: 700, color: kpi.color }}>₪{kpi.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Smart Hints */}
        {(overduCount > 0 || pendingCount > 0) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {overduCount > 0 && (
              <SmartHint type="warning" text={`יש ${overduCount} תשלומים בפיגור — תזכורת גבייה יכולה לשפר תזרים`} dismissible />
            )}
            {pendingCount > 0 && (
              <SmartHint type="ai" text={`יש ${pendingCount} חשבוניות ממתינות — שליחת תזכורות אוטומטיות יכולה לזרז תשלום`} dismissible />
            )}
          </div>
        )}

        {/* Tabs + Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.35rem", borderBottom: "1px solid var(--border)", flex: 1 }}>
            {[
              { id: "all", label: "הכל" },
              { id: "invoices", label: "חשבוניות" },
              { id: "retainers", label: "ריטיינרים" },
              { id: "expenses", label: "הוצאות" },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`pay-tab ${activeTab === tab.id ? "active" : ""}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <input className="mod-search" placeholder="🔍 חיפוש..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        </div>

        {/* Table */}
        {loading ? (
          <div className="mod-empty"><div>טוען...</div></div>
        ) : filtered.length === 0 ? (
          <div className="mod-empty">
            <div className="mod-empty-icon">💳</div>
            <div>אין תשלומים להצגה</div>
          </div>
        ) : (
          <div className="pay-table" style={{ borderRadius: "0.75rem", border: "1px solid var(--border)", overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
              <thead>
                <tr className="ux-table-header" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-raised)", textAlign: "right", color: "var(--foreground-muted)" }}>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>מס׳ חשבונית</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>לקוח</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>תיאור</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>סוג</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>סכום</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>תאריך</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>סטטוס</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => {
                  const st = STATUS_MAP[payment.status] || STATUS_MAP.pending;
                  return (
                    <tr key={payment.id} className="ux-table-row" style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{payment.invoiceNo}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--foreground-muted)" }}>{payment.clientName}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--foreground-muted)" }}>{payment.description}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--foreground-muted)" }}>{TYPE_LABELS[payment.type] || payment.type}</td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>₪{payment.amount.toLocaleString()}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "var(--foreground-muted)" }}>
                        {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString("he-IL") : "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span className="pay-badge" style={{ background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}30`, padding: "0.15rem 0.5rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 600 }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <button className="mod-btn-ghost ux-btn" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }} onClick={() => openEdit(payment)}>✏️</button>
                          {payment.status !== "paid" && (
                            <button className="mod-btn-ghost ux-btn" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", color: "#22c55e" }} onClick={() => handleMarkPaid(payment)}>✓ שולם</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Aggregate */}
        <div className="agd-card ux-card ux-light-sweep" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)", marginBottom: "0.2rem" }}>סה״כ סכום בטבלה</p>
            <p style={{ fontSize: "1.15rem", fontWeight: 700 }}>₪{tableTotal.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingPayment ? "עריכת תשלום" : "תשלום חדש"} footer={
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between" }}>
          <div>
            {editingPayment && (
              <button className="mod-btn-ghost ux-btn" style={{ color: "#f87171", fontSize: "0.75rem" }} onClick={async () => {
                await remove(editingPayment.id);
                setModalOpen(false);
                toast("התשלום נמחק", "info");
              }}>🗑 מחיקה</button>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="mod-btn-ghost ux-btn" onClick={() => setModalOpen(false)}>ביטול</button>
            <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={handleSave}>{editingPayment ? "שמור" : "צור תשלום"}</button>
          </div>
        </div>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>מספר חשבונית</label>
            <input className="form-input" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} placeholder="INV-001" dir="ltr" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>לקוח</label>
              <select className="form-select" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                <option value="">בחר לקוח</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>סוג</label>
              <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Payment["type"] })}>
                <option value="invoice">חשבונית</option>
                <option value="retainer">ריטיינר</option>
                <option value="milestone">אבן דרך</option>
                <option value="expense">הוצאה</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>סכום ₪</label>
              <input className="form-input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} dir="ltr" />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>סטטוס</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Payment["status"] })}>
                <option value="draft">טיוטה</option>
                <option value="pending">ממתין</option>
                <option value="msg_sent">הודעה נשלחה</option>
                <option value="paid">שולם</option>
                <option value="overdue">בפיגור</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>תאריך יעד</label>
            <input className="form-input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} dir="ltr" />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>תיאור *</label>
            <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="תיאור התשלום..." rows={2} style={{ resize: "vertical" }} />
          </div>
        </div>
      </Modal>
    </main>
  );
}
