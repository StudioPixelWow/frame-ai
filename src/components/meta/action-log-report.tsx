"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Optimization action report — a verifiable history of every action performed on
 * a client's Meta campaigns (audience expansions, budget shifts, creative
 * refreshes, audiences, etc.), with Meta's real outcome. Embedded in both the
 * Meta campaign dashboard and the client card so the agency can show clients
 * exactly what was done.
 */

interface LogEntry {
  id: string;
  createdAt: string;
  actionKind: string;
  category?: string | null;
  title: string;
  status: "success" | "failed" | "info";
  metaId?: string | null;
  objectType?: string | null;
  detail?: string | null;
  error?: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  success: { bg: "rgba(34,197,94,0.12)", color: "#16a34a", label: "בוצע" },
  failed: { bg: "rgba(239,68,68,0.12)", color: "#dc2626", label: "נכשל" },
  info: { bg: "rgba(245,158,11,0.12)", color: "#d97706", label: "לביצוע ידני" },
};

const CAT_ICON: Record<string, string> = {
  audience: "👥", creative: "🎨", budget: "💰", ab_test: "🧪",
};

export default function ActionLogReport({ clientId, limit = 100, title = "📋 יומן פעולות ואופטימיזציות" }: { clientId?: string; limit?: number; title?: string }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<{ total: number; success: number; failed: number; info: number }>({ total: 0, success: 0, failed: 0, info: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (clientId) qs.set("clientId", clientId);
      qs.set("limit", String(limit));
      const res = await fetch(`/api/meta-business/action-log?${qs.toString()}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setSummary(data.summary || { total: 0, success: 0, failed: 0, info: 0 });
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, limit]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  const copyReport = () => {
    const lines = entries.map((e) => {
      const st = STATUS_STYLE[e.status]?.label || e.status;
      return `• ${fmtDate(e.createdAt)} — ${e.title} [${st}]${e.detail ? `: ${e.detail}` : ""}${e.error ? ` (${e.error})` : ""}`;
    });
    navigator.clipboard?.writeText(`דוח פעולות ואופטימיזציות בקמפיינים:\n\n${lines.join("\n")}`);
  };

  return (
    <div dir="rtl" style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {summary.total > 0 && (
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {summary.success} בוצעו · {summary.failed} נכשלו · {summary.info} ידני
            </span>
          )}
          <button onClick={copyReport} disabled={entries.length === 0} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border, #e5e7eb)", background: "#fff", fontSize: 12, fontWeight: 600, cursor: entries.length ? "pointer" : "default", opacity: entries.length ? 1 : 0.5 }}>
            📋 העתק דוח
          </button>
          <button onClick={load} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border, #e5e7eb)", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ⟳ רענן
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 16, color: "#6b7280", fontSize: 13 }}>טוען...</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 16, color: "#6b7280", fontSize: 13, textAlign: "center", border: "1px dashed var(--border, #e5e7eb)", borderRadius: 8 }}>
          עדיין לא בוצעו פעולות אופטימיזציה. כל פעולה שתבצע דרך "המלצות ייעול" תתועד כאן אוטומטית.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {entries.map((e) => {
            const st = STATUS_STYLE[e.status] || STATUS_STYLE.info;
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, background: "#fff" }}>
                <span style={{ fontSize: 16, lineHeight: "20px" }}>{CAT_ICON[e.category || ""] || "⚙️"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                  {e.detail && <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{e.detail}</div>}
                  {e.error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>{e.error}</div>}
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{fmtDate(e.createdAt)}{e.metaId ? ` · ${e.objectType || "object"} ${e.metaId}` : ""}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 9999, background: st.bg, color: st.color }}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
