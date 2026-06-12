"use client";

/**
 * Premium "Sales Command Center" — the management layer above the leads Kanban.
 * Pixel Sales AI + lead-heat strip + conversion funnel + sources + hot leads.
 * Brand-consistent (turquoise/blue, light, RTL, rounded cards). Reads existing leads.
 */
import React, { useMemo } from "react";
import { computeLeadQuality, getResponseTime, getStage, FUNNEL_STAGES } from "@/lib/leads/lead-quality";

const BRAND = "#00B5FE";
const card: React.CSSProperties = { background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.1rem 1.25rem" };
const cur = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;
const valOf = (l: any) => Number(l.value ?? l.proposalAmount ?? 0) || 0;
const ACTIVE = FUNNEL_STAGES.filter((s: any) => s.isActive);

export default function SalesCommandCenter({ leads = [], onOpenLead }: { leads?: any[]; onOpenLead?: (l: any) => void }) {
  const m = useMemo(() => {
    const active = leads.filter((l) => !["won", "not_relevant", "lost", "closed_lost"].includes(l.status));
    const today = new Date().toDateString();
    const now = Date.now();
    const withTemp = leads.map((l) => ({ l, q: computeLeadQuality(l), v: valOf(l) }));
    const hot = withTemp.filter((x) => x.q.level === "high");
    const warm = withTemp.filter((x) => x.q.level === "medium");
    const cold = withTemp.filter((x) => x.q.level === "low");

    const followToday = leads.filter((l) => l.followUpAt && new Date(l.followUpAt).toDateString() === today);
    const stale = active.filter((l) => { const rt = getResponseTime(l); return rt.isOverdue && (l.status === "new" || !l.status); });
    const hotHighValue = hot.filter((x) => x.v >= 50000 && !["won", "not_relevant"].includes(x.l.status));
    const topHot = [...hot].sort((a, b) => b.v - a.v)[0];

    const funnel = ACTIVE.map((s: any) => {
      const items = leads.filter((l) => l.status === s.id);
      return { id: s.id, label: s.label, color: s.color || BRAND, count: items.length, value: items.reduce((t, l) => t + valOf(l), 0) };
    });

    const srcMap = new Map<string, { count: number; value: number; won: number }>();
    for (const l of leads) {
      const k = (l.source || "ידני").trim() || "ידני";
      const e = srcMap.get(k) || { count: 0, value: 0, won: 0 };
      e.count++; e.value += valOf(l); if (l.status === "won") e.won++;
      srcMap.set(k, e);
    }
    const sources = [...srcMap.entries()].map(([name, v]) => ({ name, ...v, conv: v.count ? Math.round((v.won / v.count) * 100) : 0 })).sort((a, b) => b.count - a.count).slice(0, 6);

    const potential = active.reduce((t, l) => t + valOf(l), 0);
    const hotList = [...hot].sort((a, b) => b.v - a.v).slice(0, 5).map((x) => x.l);

    return { active, hotN: hot.length, warmN: warm.length, coldN: cold.length, followToday, stale, hotHighValue, topHot, funnel, sources, potential, hotList };
  }, [leads]);

  const insights: string[] = [];
  if (m.followToday.length) insights.push(`${m.followToday.length} לידים לטיפול (פולואפ) היום`);
  if (m.stale.length) insights.push(`${m.stale.length} לידים לא טופלו מעל 48 שעות`);
  if (m.hotHighValue.length) insights.push(`${m.hotHighValue.length} לידים חמים מעל ₪50K דורשים תשומת לב`);
  if (m.topHot) insights.push(`פעולה מומלצת: לפנות ל-${m.topHot.l.fullName || m.topHot.l.name || "הליד החם"} (${cur(m.topHot.v)})`);
  if (insights.length === 0) insights.push("אין פעולות דחופות — המשך לקדם את הפייפליין 💪");

  const maxFunnel = Math.max(...m.funnel.map((f) => f.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "1.5rem" }}>
      {/* Pixel Sales AI + Heat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "1rem" }}>
        <div style={{ borderRadius: 18, padding: "1.25rem", background: "linear-gradient(135deg,#eef2ff 0%,#f5f3ff 45%,#ecfeff 100%)", border: "1px solid #c7d2fe" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 900, background: "linear-gradient(90deg,#6366f1,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✨ Pixel Sales AI</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 10 }}>עוזר המכירות החכם שלך · {m.active.length} לידים פעילים · פוטנציאל {cur(m.potential)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {insights.slice(0, 4).map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.83rem", color: "#334155", background: "rgba(255,255,255,0.65)", borderRadius: 8, padding: "0.45rem 0.7rem" }}>💡 {t}</div>
            ))}
          </div>
        </div>
        <div style={{ ...card, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>חום הלידים</div>
          {[{ k: "🔥 חמים", n: m.hotN, c: "#ef4444" }, { k: "🟠 פושרים", n: m.warmN, c: "#f59e0b" }, { k: "🔵 קרים", n: m.coldN, c: "#3b82f6" }].map((r) => (
            <div key={r.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>{r.k}</span>
              <span style={{ fontSize: "1.2rem", fontWeight: 800, color: r.c }}>{r.n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Funnel + Sources + Hot leads */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>משפך המרה</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {m.funnel.map((f) => (
              <div key={f.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "var(--foreground-muted)", marginBottom: 2 }}>
                  <span>{f.label}</span><span>{f.count} · {cur(f.value)}</span>
                </div>
                <div style={{ height: 8, background: "var(--border)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ width: `${(f.count / maxFunnel) * 100}%`, height: "100%", background: f.color, borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>מקורות לידים</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {m.sources.map((s) => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}>
                <span style={{ color: "var(--foreground)" }}>{s.name}</span>
                <span style={{ color: "var(--foreground-muted)" }}>{s.count} · {s.conv}% המרה</span>
              </div>
            ))}
            {m.sources.length === 0 && <span style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>—</span>}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 10 }}>🔥 לידים חמים</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {m.hotList.map((l) => (
              <button key={l.id} onClick={() => onOpenLead?.(l)} style={{ textAlign: "start", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.45rem 0.6rem", cursor: "pointer" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.fullName || l.name || l.company}</span>
                <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#ef4444", flexShrink: 0 }}>{cur(valOf(l))}</span>
              </button>
            ))}
            {m.hotList.length === 0 && <span style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>אין לידים חמים כרגע</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
