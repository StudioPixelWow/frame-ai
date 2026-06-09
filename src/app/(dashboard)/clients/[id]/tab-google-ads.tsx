"use client";

import { useCallback, useEffect, useState } from "react";

const C = {
  primary: "#00B5FE", primaryDark: "#0095D0", bg: "#F7F9FC", card: "#FFFFFF",
  text: "#1A1A2E", sub: "#5A5A7A", muted: "#9A9AB0", border: "#E8EAF0", success: "#10B981",
};

interface ReportRow {
  id: string; reportType: "weekly" | "monthly" | "custom";
  dateFrom: string; dateTo: string; status: string; htmlUrl: string; pdfUrl: string;
  summaryText: string; isDemo?: boolean; createdAt: string; sentAt: string | null; viewedAt: string | null;
}

const TYPE_HE: Record<string, string> = { weekly: "שבועי", monthly: "חודשי", custom: "מותאם" };
const STATUS_HE: Record<string, { l: string; c: string }> = {
  created: { l: "נוצר", c: "#6366F1" }, sent: { l: "נשלח", c: "#0095D0" }, viewed: { l: "נצפה", c: "#10B981" }, failed: { l: "—", c: "#9A9AB0" },
};
const fmt = (d: string) => (d ? new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

export default function TabGoogleAds({ client }: { client: any }) {
  const clientId = client?.id;
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [genType, setGenType] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notice, setNotice] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [m, setM] = useState<Record<string, string>>({});
  const setMf = (k: string, v: string) => setM((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/clients/${clientId}/google-ads/reports`, { cache: "no-store" });
      const d = await r.json();
      setReports(d.reports || []);
      setConnection(d.connection || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setBusy("gen"); setNotice("");
    try {
      const body: any = { clientId, type: genType };
      if (genType === "custom") { body.from = from; body.to = to; }
      const r = await fetch("/api/google-ads/reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "שגיאה");
      setNotice("✓ הדוח הופק בהצלחה");
      await load();
      if (d.report?.id) window.open(`/api/google-ads/reports/${d.report.id}?format=html`, "_blank");
    } catch (e) { setNotice(e instanceof Error ? e.message : "הפקת הדוח נכשלה"); }
    finally { setBusy(""); }
  };

  const uploadCsv = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusy("csv"); setNotice("");
    try {
      const csvFiles = await Promise.all(Array.from(fileList).map(async (f) => ({ name: f.name, text: await f.text() })));
      const body: any = { clientId, type: genType, csvFiles };
      if (genType === "custom") { body.from = from; body.to = to; }
      const r = await fetch("/api/google-ads/reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "שגיאה");
      setNotice(`✓ הדוח הופק מהקבצים (${csvFiles.length})`);
      await load();
      if (d.report?.id) window.open(`/api/google-ads/reports/${d.report.id}?format=html`, "_blank");
    } catch (e) { setNotice(e instanceof Error ? e.message : "ניתוח הקובץ נכשל"); }
    finally { setBusy(""); }
  };

  const generateManual = async () => {
    setBusy("manual"); setNotice("");
    try {
      const manual = {
        impressions: Number(m.impressions) || 0, clicks: Number(m.clicks) || 0,
        conversions: Number(m.conversions) || 0, cost: Number(m.cost) || 0,
        convValue: m.convValue ? Number(m.convValue) : undefined, budget: m.budget ? Number(m.budget) : undefined,
        prevClicks: m.prevClicks ? Number(m.prevClicks) : undefined,
        prevConversions: m.prevConversions ? Number(m.prevConversions) : undefined,
        prevCost: m.prevCost ? Number(m.prevCost) : undefined,
        topCampaign: m.topCampaign || undefined, topDevice: m.topDevice || undefined,
        topRegion: m.topRegion || undefined, topTerm: m.topTerm || undefined,
      };
      const body: any = { clientId, type: genType, manual };
      if (genType === "custom") { body.from = from; body.to = to; }
      const r = await fetch("/api/google-ads/reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "שגיאה");
      setNotice("✓ הדוח הופק מהנתונים שהוזנו");
      setManualOpen(false);
      await load();
      if (d.report?.id) window.open(`/api/google-ads/reports/${d.report.id}?format=html`, "_blank");
    } catch (e) { setNotice(e instanceof Error ? e.message : "הפקת הדוח נכשלה"); }
    finally { setBusy(""); }
  };

  const send = async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch(`/api/google-ads/reports/${id}/send`, { method: "POST" });
      const d = await r.json();
      if (d.success) setNotice(`✓ סומן כנשלח · תקציר: ${d.summary || ""}`);
      await load();
    } catch { /* ignore */ } finally { setBusy(""); }
  };

  const btn = (bg: string): React.CSSProperties => ({ background: bg, color: "#fff", border: "none", borderRadius: 9, padding: "0.5rem 0.9rem", fontWeight: 700, fontSize: 12.5, cursor: "pointer" });
  const ghost: React.CSSProperties = { background: "none", color: C.sub, border: `1px solid ${C.border}`, borderRadius: 9, padding: "0.5rem 0.9rem", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };

  return (
    <div dir="rtl" style={{ color: C.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: C.primary, letterSpacing: 2, fontWeight: 800 }}>GOOGLE ADS</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: "2px 0" }}>דוחות Google Ads</h2>
          <p style={{ color: C.sub, fontSize: 13, margin: 0 }}>
            דוח ביצועים פרימיום, ממותג ועד 2 עמודים — שבועי, חודשי או לפי טווח תאריכים.
          </p>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: connection?.status === "connected" ? C.success : C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 99, padding: "5px 12px" }}>
          {connection?.status === "connected" ? "● מחובר ל-Google Ads" : "○ לא מחובר (יופק דוח דמו)"}
        </span>
      </div>

      {/* Generate panel */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "inline-flex", gap: 4, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4 }}>
            {(["weekly", "monthly", "custom"] as const).map((t) => (
              <button key={t} onClick={() => setGenType(t)} style={{ padding: "0.4rem 0.9rem", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 800, cursor: "pointer", background: genType === t ? C.primary : "transparent", color: genType === t ? "#fff" : C.sub }}>
                {TYPE_HE[t]}
              </button>
            ))}
          </div>
          {genType === "custom" && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "0.45rem 0.6rem", fontSize: 12.5 }} />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "0.45rem 0.6rem", fontSize: 12.5 }} />
            </>
          )}
          <button onClick={generate} disabled={busy === "gen" || (genType === "custom" && (!from || !to))} style={btn(busy === "gen" ? "#cbd5e1" : C.primary)}>
            {busy === "gen" ? "⏳ מפיק…" : "📊 הפק דוח Google Ads"}
          </button>
          <button onClick={() => document.getElementById("gads-csv-input")?.click()} disabled={busy === "csv"} style={btn(busy === "csv" ? "#cbd5e1" : C.primaryDark)}>
            {busy === "csv" ? "⏳ מנתח…" : "📁 העלאת CSV מ-Google Ads"}
          </button>
          <input id="gads-csv-input" type="file" accept=".csv,text/csv" multiple style={{ display: "none" }}
            onChange={(e) => { uploadCsv(e.target.files); e.currentTarget.value = ""; }} />
          <button onClick={() => setManualOpen((v) => !v)} style={ghost}>{manualOpen ? "✕ סגור הזנה ידנית" : "✏️ הזנה ידנית"}</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: C.muted }}>
          💡 ב-Google Ads: קמפיינים / מכשירים / אזורים / מונחי חיפוש → לחצן <b>Download → ‎.csv‎</b>. אפשר להעלות כמה קבצים יחד — המערכת מזהה כל אחד ומנתחת הכול לבד.
        </div>
        {notice && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: notice.startsWith("✓") ? C.success : "#B45309" }}>{notice}</div>}

        {manualOpen && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${C.border}` }}>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 10 }}>
              הזן את נתוני התקופה מ-Google Ads (Download → דוח) — והמערכת תפיק את הדוח המלא עם הניתוח והניסוח החיובי. שדות התקופה הקודמת והשדות המובילים אופציונליים.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
              {([
                ["impressions", "חשיפות *"], ["clicks", "קליקים *"], ["conversions", "המרות / לידים *"], ["cost", "עלות כוללת ₪ *"],
                ["convValue", "ערך המרות ₪"], ["budget", "תקציב ₪"],
                ["prevClicks", "קליקים — תקופה קודמת"], ["prevConversions", "המרות — תקופה קודמת"], ["prevCost", "עלות — תקופה קודמת"],
              ] as const).map(([k, label]) => (
                <div key={k}>
                  <label style={{ display: "block", fontSize: 11, color: C.sub, fontWeight: 600, marginBottom: 3 }}>{label}</label>
                  <input type="number" value={m[k] || ""} onChange={(e) => setMf(k, e.target.value)} style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "0.45rem 0.6rem", fontSize: 13 }} />
                </div>
              ))}
              {([
                ["topCampaign", "קמפיין מוביל"], ["topDevice", "מכשיר מוביל"], ["topRegion", "אזור מוביל"], ["topTerm", "ביטוי חיפוש מוביל"],
              ] as const).map(([k, label]) => (
                <div key={k}>
                  <label style={{ display: "block", fontSize: 11, color: C.sub, fontWeight: 600, marginBottom: 3 }}>{label}</label>
                  <input value={m[k] || ""} onChange={(e) => setMf(k, e.target.value)} style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "0.45rem 0.6rem", fontSize: 13 }} />
                </div>
              ))}
            </div>
            <button onClick={generateManual} disabled={busy === "manual" || !m.clicks || !m.conversions} style={{ ...btn(busy === "manual" ? "#cbd5e1" : C.success), marginTop: 12 }}>
              {busy === "manual" ? "⏳ מפיק…" : "✨ הפק דוח מהנתונים שהוזנו"}
            </button>
          </div>
        )}
      </div>

      {/* Reports list */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "0.5rem 0.5rem" }}>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: C.muted, fontSize: 13 }}>טוען…</div>
        ) : reports.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: C.muted, fontSize: 13 }}>אין עדיין דוחות. לחץ «הפק דוח Google Ads» כדי ליצור את הראשון.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {reports.map((r) => {
              const st = STATUS_HE[r.status] || STATUS_HE.created;
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "0.8rem 0.9rem", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                      דוח {TYPE_HE[r.reportType]} · {fmt(r.dateFrom)}–{fmt(r.dateTo)}
                      {r.isDemo && <span style={{ marginInlineStart: 8, fontSize: 10.5, fontWeight: 700, color: C.primaryDark, background: "#EFF8FF", borderRadius: 6, padding: "1px 7px" }}>דמו</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>הופק {fmt(r.createdAt)}{r.sentAt ? ` · נשלח ${fmt(r.sentAt)}` : ""}{r.viewedAt ? ` · נצפה ${fmt(r.viewedAt)}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: st.c }}>● {st.l}</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <a href={`/api/google-ads/reports/${r.id}?format=html`} target="_blank" rel="noreferrer" style={{ ...ghost, textDecoration: "none", color: C.text }}>👁 צפייה</a>
                    <a href={`/api/google-ads/reports/${r.id}/pdf`} target="_blank" rel="noreferrer" style={{ ...btn(C.primaryDark), textDecoration: "none" }}>⬇ PDF</a>
                    <button onClick={() => send(r.id)} disabled={busy === r.id} style={btn(C.success)}>{busy === r.id ? "…" : "✉ סמן כנשלח"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
