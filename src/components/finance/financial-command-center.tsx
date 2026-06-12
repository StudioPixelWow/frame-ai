"use client";

/**
 * Financial Command Center — the executive financial OS layer above the
 * accounting page. KPIs, Pixel AI CFO, action center, collections pipeline,
 * revenue-by-category, active retainers, hosting/domain renewals, risks.
 * Brand-consistent (turquoise/blue, light, RTL, rounded cards).
 */
import React, { useMemo } from "react";
import Link from "next/link";

const BRAND = "#00B5FE";
const card: React.CSSProperties = { background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.2rem" };
const cur = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;
const num = (v: any) => Number(v) || 0;

function Spark({ values, color = BRAND, w = 104, h = 30 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const v = values.length ? values : [0, 0];
  const max = Math.max(...v, 1), min = Math.min(...v, 0), span = max - min || 1;
  const pts = v.map((n, i) => `${(i / (v.length - 1 || 1)) * w},${h - ((n - min) / span) * (h - 4) - 2}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

interface Props { payments?: any[]; projectPayments?: any[]; clients?: any[]; hostingRecords?: any[]; }

export default function FinancialCommandCenter({ payments = [], projectPayments = [], clients = [], hostingRecords = [] }: Props) {
  const m = useMemo(() => {
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const all = [...payments, ...projectPayments];
    const isPaid = (p: any) => p.status === "paid";
    const isOpen = (p: any) => ["pending", "msg_sent", "overdue", "collection_needed"].includes(p.status) || (p.isDue && p.status !== "paid");
    const clientName = (id: string) => clients.find((c) => c.id === id)?.name || "—";

    const monthRevenue = all.filter((p) => isPaid(p) && p.paidAt && new Date(p.paidAt) >= mStart).reduce((s, p) => s + num(p.amount), 0);
    const recurring = clients.filter((c) => c.status === "active" && num(c.retainerAmount) > 0).reduce((s, c) => s + num(c.retainerAmount), 0);
    const outstanding = all.filter(isOpen).reduce((s, p) => s + num(p.amount), 0);
    const overdueItems = all.filter((p) => p.status === "overdue" || (p.dueDate && new Date(p.dueDate) < now && p.status !== "paid" && p.status !== "draft" && p.status !== "write_off"));
    const overdue = overdueItems.reduce((s, p) => s + num(p.amount), 0);

    const revSeries = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1), e = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0);
      return all.filter((p) => isPaid(p) && p.paidAt && new Date(p.paidAt) >= d && new Date(p.paidAt) <= e).reduce((s, p) => s + num(p.amount), 0);
    });

    // Action center: outstanding sorted by days overdue
    const action = overdueItems.map((p) => ({ id: p.id, name: p.clientName || clientName(p.clientId), amount: num(p.amount), days: p.dueDate ? Math.max(0, Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / 864e5)) : 0 }))
      .sort((a, b) => b.days - a.days).slice(0, 8);

    // Collections pipeline
    const stage = (sts: string[]) => { const items = all.filter((p) => sts.includes(p.status)); return { count: items.length, amount: items.reduce((s, p) => s + num(p.amount), 0) }; };
    const pipeline = [
      { label: "ממתין", color: "#94a3b8", ...stage(["draft", "pending"]) },
      { label: "נשלחה בקשה", color: "#f59e0b", ...stage(["msg_sent", "collection_needed"]) },
      { label: "באיחור", color: "#ef4444", ...stage(["overdue"]) },
      { label: "שולם", color: "#10b981", ...stage(["paid"]) },
    ];

    // Revenue by category (payment type + hosting)
    const byType = (t: string) => all.filter((p) => p.type === t && isPaid(p) && p.paidAt && new Date(p.paidAt) >= mStart).reduce((s, p) => s + num(p.amount), 0);
    const hostingRev = hostingRecords.filter((h) => h.status !== "cancelled").reduce((s, h) => s + num(h.yearlyPaymentAmount) / 12, 0);
    const categories = [
      { label: "ריטיינרים", value: byType("retainer") || recurring, color: BRAND },
      { label: "פרויקטים", value: byType("milestone") + projectPayments.filter(isPaid).reduce((s, p) => s + num(p.amount), 0), color: "#8b5cf6" },
      { label: "חשבוניות", value: byType("invoice"), color: "#f59e0b" },
      { label: "אחסון/דומיינים", value: hostingRev, color: "#10b981" },
    ].filter((c) => c.value > 0);
    const catTotal = categories.reduce((s, c) => s + c.value, 0) || 1;

    // Active retainers
    const retainers = clients.filter((c) => c.status === "active" && num(c.retainerAmount) > 0)
      .map((c) => ({ id: c.id, name: c.name, amount: num(c.retainerAmount), type: c.clientType })).sort((a, b) => b.amount - a.amount).slice(0, 8);

    // Hosting/domain renewals (next 45 days or flagged)
    const soon = new Date(now.getTime() + 45 * 864e5);
    const renewals = hostingRecords.filter((h) => h.status === "expiring_soon" || h.status === "overdue" || (h.nextPaymentDate && new Date(h.nextPaymentDate) <= soon && h.status !== "cancelled"))
      .map((h) => ({ id: h.id, domain: h.domainName, name: clientName(h.clientId), date: h.nextPaymentDate, amount: num(h.yearlyPaymentAmount), status: h.status }))
      .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()).slice(0, 8);

    // Risks
    const risks: { icon: string; text: string }[] = [];
    const bigOverdue = action.filter((a) => a.days >= 14);
    if (bigOverdue.length) risks.push({ icon: "🔴", text: `${bigOverdue.length} תשלומים בפיגור מעל 14 יום (${cur(bigOverdue.reduce((s, a) => s + a.amount, 0))})` });
    if (renewals.filter((r) => r.status === "overdue").length) risks.push({ icon: "🌐", text: `${renewals.filter((r) => r.status === "overdue").length} חידושי אחסון/דומיין באיחור` });
    const topClient = retainers[0];
    if (topClient && recurring > 0 && topClient.amount / recurring > 0.2) risks.push({ icon: "⚠️", text: `${topClient.name} מהווה ${Math.round((topClient.amount / recurring) * 100)}% מההכנסה הקבועה — ריכוז גבוה` });
    if (overdue > 0) risks.push({ icon: "💸", text: `${cur(overdue)} בפיגור גבייה כולל` });

    return { monthRevenue, recurring, outstanding, overdue, revSeries, action, pipeline, categories, catTotal, retainers, renewals, risks, overdueCount: overdueItems.length, topClient };
  }, [payments, projectPayments, clients, hostingRecords]);

  const insights: string[] = [];
  insights.push(`הכנסה החודש: ${cur(m.monthRevenue)} · הכנסה קבועה חודשית: ${cur(m.recurring)}`);
  if (m.overdueCount) insights.push(`${m.overdueCount} תשלומים בפיגור (${cur(m.overdue)}) — מומלץ לשלוח תזכורות`);
  if (m.renewals.length) insights.push(`${m.renewals.length} חידושי אחסון/דומיין קרובים`);
  if (m.topClient && m.recurring > 0) insights.push(`${m.topClient.name} = ${Math.round((m.topClient.amount / m.recurring) * 100)}% מההכנסה הקבועה`);

  const kpis = [
    { label: "הכנסה החודש", value: cur(m.monthRevenue), icon: "💰", color: "#10b981" },
    { label: "הכנסה קבועה", value: cur(m.recurring), icon: "🔁", color: BRAND },
    { label: "גבייה פתוחה", value: cur(m.outstanding), icon: "📥", color: "#f59e0b" },
    { label: "בפיגור", value: cur(m.overdue), icon: "🔴", color: "#ef4444" },
  ];
  const pipeMax = Math.max(...m.pipeline.map((p) => p.amount), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", direction: "rtl", marginBottom: "1.5rem" }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: "1rem" }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: "1.4rem" }}>{k.icon}</div>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--foreground)", lineHeight: 1 }}>{k.value}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>{k.label}</span>
              <Spark values={m.revSeries} color={k.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Pixel AI CFO */}
      <div style={{ borderRadius: 18, padding: "1.4rem", background: "linear-gradient(135deg,#eef2ff 0%,#f0f9ff 50%,#ecfeff 100%)", border: "1px solid #c7d2fe" }}>
        <div style={{ fontSize: "1.15rem", fontWeight: 900, background: "linear-gradient(90deg,#6366f1,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✨ Pixel AI CFO</div>
        <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 10 }}>סמנכ״ל הכספים הווירטואלי שלך</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {insights.map((t, i) => <div key={i} style={{ fontSize: "0.83rem", color: "#334155", background: "rgba(255,255,255,0.65)", borderRadius: 8, padding: "0.45rem 0.7rem" }}>💡 {t}</div>)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{ l: "צור חשבונית", h: "/accounting/invoicing" }, { l: "גבייה חכמה", h: "/accounting/timeline" }, { l: "קבלות", h: "/accounting/receipts" }, { l: "מסמכים", h: "/accounting/documents" }].map((q) => (
            <Link key={q.l} href={q.h} style={{ padding: "0.5rem 0.9rem", borderRadius: 10, border: "1px solid #c7d2fe", background: "rgba(255,255,255,0.7)", fontSize: "0.82rem", fontWeight: 700, color: "#4f46e5", textDecoration: "none" }}>{q.l}</Link>
          ))}
        </div>
      </div>

      {/* Action center + Collections pipeline */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>🚨 דורש גבייה</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {m.action.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.6rem", background: a.days >= 14 ? "#fef2f2" : "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{a.name}</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {a.days > 0 && <span style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 700 }}>{a.days} ימים</span>}
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--foreground)" }}>{cur(a.amount)}</span>
                </span>
              </div>
            ))}
            {m.action.length === 0 && <div style={{ fontSize: "0.78rem", color: "var(--foreground-muted)", textAlign: "center", padding: "0.5rem" }}>אין תשלומים בפיגור 🎉</div>}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>צינור גבייה</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {m.pipeline.map((p) => (
              <div key={p.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--foreground-muted)", marginBottom: 2 }}><span>{p.label} ({p.count})</span><span>{cur(p.amount)}</span></div>
                <div style={{ height: 8, background: "var(--border)", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${(p.amount / pipeMax) * 100}%`, height: "100%", background: p.color, borderRadius: 5 }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue by category + Retainers + Renewals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>הכנסה לפי קטגוריה</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {m.categories.map((c) => (
              <div key={c.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", marginBottom: 2 }}><span style={{ color: "var(--foreground)" }}>{c.label}</span><span style={{ color: "var(--foreground-muted)" }}>{Math.round((c.value / m.catTotal) * 100)}%</span></div>
                <div style={{ height: 7, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(c.value / m.catTotal) * 100}%`, height: "100%", background: c.color, borderRadius: 4 }} /></div>
              </div>
            ))}
            {m.categories.length === 0 && <span style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>—</span>}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>🔁 ריטיינרים פעילים</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {m.retainers.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                <span style={{ color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                <span style={{ fontWeight: 700, color: BRAND, flexShrink: 0 }}>{cur(r.amount)}/ח׳</span>
              </div>
            ))}
            {m.retainers.length === 0 && <span style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>—</span>}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>🌐 חידושי אחסון/דומיין</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {m.renewals.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.76rem", color: r.status === "overdue" ? "#ef4444" : "var(--foreground)" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.domain || r.name}</span>
                <span style={{ flexShrink: 0, color: "var(--foreground-muted)" }}>{r.date ? new Date(r.date).toLocaleDateString("he-IL") : ""}</span>
              </div>
            ))}
            {m.renewals.length === 0 && <span style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>אין חידושים קרובים</span>}
          </div>
        </div>
      </div>

      {/* Risks */}
      {m.risks.length > 0 && (
        <div style={{ ...card, background: "#fffbeb", borderColor: "#fde68a" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 8, color: "#b45309" }}>⚠️ סיכונים פיננסיים</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {m.risks.map((r, i) => <div key={i} style={{ fontSize: "0.82rem", color: "#92400e" }}>{r.icon} {r.text}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
