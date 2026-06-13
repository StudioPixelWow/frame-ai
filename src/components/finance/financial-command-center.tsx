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

    // ── Client financial health (per-client, real data) ──
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime();
    const clientHealth = (clients || []).filter((c: any) => c.status !== "inactive").map((c: any) => {
      const cps = all.filter((p: any) => p.clientId === c.id);
      const mrr = num(c.retainerAmount);
      const monthIncome = cps.filter((p: any) => p.status === "paid" && p.paidAt && new Date(p.paidAt).getTime() >= monthStart && new Date(p.paidAt).getTime() <= monthEnd).reduce((s: number, p: any) => s + num(p.amount), 0) || mrr;
      const openPs = cps.filter(isOpen);
      const out = openPs.reduce((s: number, p: any) => s + num(p.amount), 0);
      const overdueDays = Math.max(0, ...openPs.map((p: any) => (p.dueDate && new Date(p.dueDate) < now) ? Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / 864e5) : 0));
      const status = overdueDays > 0 ? "באיחור" : out > 0 ? "שולם חלקית" : "שולם";
      const statusColor = overdueDays > 0 ? "#ef4444" : out > 0 ? "#f59e0b" : "#22c55e";
      const health = overdueDays > 14 ? { label: "בסיכון", color: "#ef4444" } : overdueDays > 0 || out > 0 ? { label: "במעקב", color: "#f59e0b" } : { label: "בריא", color: "#22c55e" };
      return { id: c.id, name: c.name, mrr, monthIncome, out, overdueDays, status, statusColor, health, annual: mrr * 12 };
    }).filter((c: any) => c.mrr > 0 || c.out > 0 || c.monthIncome > 0).sort((a: any, b: any) => b.mrr - a.mrr).slice(0, 10);
    const arr = recurring * 12;

    // ── Financial opportunities (rule-based on real client signals) ──
    const retAmts = (clients || []).map((c: any) => num(c.retainerAmount)).filter((x: number) => x > 0).sort((a: number, b: number) => a - b);
    const median = retAmts.length ? retAmts[Math.floor(retAmts.length / 2)] : 0;
    const opportunities: { name: string; text: string; est: number; prob: string }[] = [];
    (clients || []).filter((c: any) => c.status !== "inactive").forEach((c: any) => {
      const ret = num(c.retainerAmount);
      const hasHosting = (hostingRecords || []).some((h: any) => h.clientId === c.id && h.status !== "cancelled");
      if (hasHosting && ret === 0) opportunities.push({ name: c.name, text: "לקוח אחסון ללא ריטיינר שיווק — הזדמנות לניהול שיווקי", est: 2500, prob: "בינונית" });
      else if (ret > 0 && median > 0 && ret < median * 0.8) opportunities.push({ name: c.name, text: "ריטיינר נמוך מהחציון — הזדמנות להרחבת שירות", est: Math.round(median - ret), prob: "גבוהה" });
    });
    const oppList = opportunities.slice(0, 5);
    const oppPotential = oppList.reduce((s, o) => s + o.est, 0);

    // ── Today Collections Center (actionable, per client) ──
    const phoneOf = (id: string) => (clients.find((c) => c.id === id) as any)?.phone || "";
    const today0 = new Date(now.toDateString()).getTime();
    const day = 864e5;
    const openForCollection = all.filter((p) => isOpen(p) && p.status !== "draft");
    const colRow = (p: any) => {
      const due = p.dueDate ? new Date(p.dueDate).getTime() : null;
      const days = due !== null ? Math.round((due - today0) / day) : null;
      return { id: p.id, clientId: p.clientId, name: p.clientName || clientName(p.clientId), amount: num(p.amount), days, phone: phoneOf(p.clientId), status: p.status };
    };
    const colAll = openForCollection.map(colRow);
    const collections = {
      dueToday: colAll.filter((r) => r.days === 0).sort((a, b) => b.amount - a.amount),
      late: colAll.filter((r) => r.days !== null && r.days < 0).sort((a, b) => (a.days || 0) - (b.days || 0)),
      dueWeek: colAll.filter((r) => r.days !== null && r.days > 0 && r.days <= 7).sort((a, b) => (a.days || 0) - (b.days || 0)),
      upcoming: colAll.filter((r) => r.days !== null && r.days > 7 && r.days <= 30).sort((a, b) => (a.days || 0) - (b.days || 0)),
    };

    // ── Forecast (run-rate based, real history) ──
    const last3 = revSeries.slice(-3);
    const avg3 = last3.reduce((s, n) => s + n, 0) / (last3.length || 1);
    const nextMonth = Math.round(Math.max(recurring, avg3));
    const forecast = { nextMonth, nextQuarter: nextMonth * 3, yearly: Math.round(Math.max(arr, avg3 * 12)) };

    return { monthRevenue, recurring, arr, outstanding, overdue, revSeries, action, pipeline, categories, catTotal, retainers, renewals, risks, overdueCount: overdueItems.length, topClient, clientHealth, opportunities: oppList, oppPotential, collections, forecast };
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

      {/* ── Today Collections Center (actionable) ── */}
      <div style={{ ...card, background: "linear-gradient(135deg,#fff7ed,#fffbeb)", border: "1px solid #fed7aa" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: "1rem", color: "#c2410c" }}>🧾 מרכז גבייה</div>
          <span style={{ fontSize: "0.74rem", color: "#9a3412" }}>היום {cur(m.collections.dueToday.reduce((s: number, r: any) => s + r.amount, 0))} · באיחור {cur(m.collections.late.reduce((s: number, r: any) => s + r.amount, 0))}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.8rem" }} className="fcc-4col">
          {[
            { key: "dueToday", label: "לגבייה היום", color: "#f59e0b", rows: m.collections.dueToday },
            { key: "late", label: "באיחור", color: "#ef4444", rows: m.collections.late },
            { key: "dueWeek", label: "השבוע", color: "#3b82f6", rows: m.collections.dueWeek },
            { key: "upcoming", label: "צפוי (30 יום)", color: "#22c55e", rows: m.collections.upcoming },
          ].map((col) => (
            <div key={col.key} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 12, padding: "0.85rem", borderTop: `3px solid ${col.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--foreground)" }}>{col.label}</span>
                <span style={{ fontSize: "0.66rem", fontWeight: 800, color: col.color, background: col.color + "1a", borderRadius: 999, padding: "1px 8px" }}>{col.rows.length}</span>
              </div>
              {col.rows.length === 0 ? <div style={{ fontSize: "0.72rem", color: "var(--foreground-subtle)" }}>—</div> :
                col.rows.slice(0, 5).map((r: any) => {
                  const digits = String(r.phone || "").replace(/\D/g, "");
                  const wa = digits ? `https://wa.me/${digits.startsWith("0") ? "972" + digits.slice(1) : digits}?text=${encodeURIComponent(`שלום ${r.name}, תזכורת ידידותית לתשלום על סך ${cur(r.amount)}. תודה!`)}` : "";
                  return (
                    <div key={r.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                        <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                        <span style={{ fontSize: "0.78rem", fontWeight: 800, color: col.color, flexShrink: 0 }}>{cur(r.amount)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                        <span style={{ fontSize: "0.64rem", color: "var(--foreground-subtle)" }}>{r.days === 0 ? "היום" : r.days! < 0 ? `${Math.abs(r.days!)} ימי איחור` : `בעוד ${r.days} ימים`}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" title="שלח תזכורת בוואטסאפ" style={{ fontSize: "0.64rem", fontWeight: 700, color: "#16a34a", textDecoration: "none" }}>תזכורת</a>}
                          <Link href="/accounting" title="פתח חשבון" style={{ fontSize: "0.64rem", fontWeight: 700, color: BRAND, textDecoration: "none" }}>חשבון</Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Revenue forecast ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.9rem" }} className="fcc-3col">
        {[
          { l: "תחזית חודש הבא", v: m.forecast.nextMonth, sub: "לפי run-rate" },
          { l: "תחזית רבעון", v: m.forecast.nextQuarter, sub: "3 חודשים" },
          { l: "תחזית שנתית", v: m.forecast.yearly, sub: "ARR + פרויקטים" },
        ].map((f, i) => (
          <div key={i} style={{ ...card, background: "linear-gradient(135deg,#eff6ff,#eef2ff)", border: "1px solid #bfdbfe" }}>
            <div style={{ fontSize: "0.74rem", color: "#1e40af" }}>{f.l}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#1d4ed8", lineHeight: 1.2 }}>{cur(f.v)}</div>
            <div style={{ fontSize: "0.64rem", color: "#3b82f6" }}>{f.sub}</div>
          </div>
        ))}
      </div>

      {/* Client financial health */}
      {m.clientHealth.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>בריאות לקוחות פיננסית</div>
            <span style={{ fontSize: "0.74rem", color: "var(--foreground-muted)" }}>MRR {cur(m.recurring)} · ARR {cur(m.arr)}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ color: "var(--foreground-muted)", fontSize: "0.72rem", textAlign: "right" }}>
                  <th style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>לקוח</th>
                  <th style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>MRR</th>
                  <th style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>הכנסה חודשית</th>
                  <th style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>מצב תשלום</th>
                  <th style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>איחור</th>
                  <th style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>הכנסה שנתית</th>
                  <th style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {m.clientHealth.map((c: any) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 700, color: "var(--foreground)" }}>{c.name}</td>
                    <td style={{ padding: "0.5rem", color: "var(--foreground)" }}>{c.mrr > 0 ? cur(c.mrr) : "—"}</td>
                    <td style={{ padding: "0.5rem", color: "var(--foreground)" }}>{cur(c.monthIncome)}</td>
                    <td style={{ padding: "0.5rem" }}><span style={{ fontSize: "0.72rem", fontWeight: 700, color: c.statusColor, background: c.statusColor + "1a", borderRadius: 999, padding: "2px 9px" }}>{c.status}</span></td>
                    <td style={{ padding: "0.5rem", color: c.overdueDays > 0 ? "#ef4444" : "var(--foreground-muted)", fontWeight: c.overdueDays > 0 ? 700 : 400 }}>{c.overdueDays > 0 ? `${c.overdueDays} ימים` : "0 ימים"}</td>
                    <td style={{ padding: "0.5rem", color: "var(--foreground-muted)" }}>{c.annual > 0 ? cur(c.annual) : "—"}</td>
                    <td style={{ padding: "0.5rem" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.72rem", fontWeight: 700, color: c.health.color }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: c.health.color }} />{c.health.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Financial opportunities */}
      {m.opportunities.length > 0 && (
        <div style={{ ...card, background: "linear-gradient(135deg,#f0fdf4,#ecfeff)", borderColor: "#bbf7d0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#15803d" }}>💡 הזדמנויות פיננסיות</div>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#15803d" }}>פוטנציאל ~{cur(m.oppPotential)}/ח׳</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {m.opportunities.map((o, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "0.5rem 0.65rem", background: "rgba(255,255,255,0.7)", border: "1px solid #d1fae5", borderRadius: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--foreground)" }}>{o.name}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>{o.text}</div>
                </div>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#15803d" }}>+{cur(o.est)}</div>
                  <div style={{ fontSize: "0.64rem", color: "var(--foreground-muted)" }}>סבירות {o.prob}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
