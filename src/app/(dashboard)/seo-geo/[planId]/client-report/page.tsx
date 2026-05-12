"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

// ══════════════════════════════════════════════════════════════
// PIXEL SEO/GEO — Client-Facing PDF Report
// Premium branded printable page — opens in new tab, auto-print
// ══════════════════════════════════════════════════════════════

// ── Phase definitions ──────────────────────────────────────────
const PHASES = [
  { num: 1, name: "תשתית טכנית", days: "1-7", color: "#3B82F6", icon: "🔧", desc: "סריקה, תיקונים טכניים, בסיס חזק" },
  { num: 2, name: "סגירת פערי תוכן", days: "8-20", color: "#8B5CF6", icon: "📝", desc: "מאמרים, קישורים פנימיים, סכמות" },
  { num: 3, name: "GEO ו-Schema", days: "21-35", color: "#06B6D4", icon: "🤖", desc: "אופטימיזציה למנועי AI, סכמות מתקדמות" },
  { num: 4, name: "סמכות ותחרות", days: "36-50", color: "#F59E0B", icon: "🏆", desc: "ניתוח מתחרים, חיזוק סמכות, אסטרטגיה" },
  { num: 5, name: "אופטימיזציה ודיווח", days: "51-60", color: "#10B981", icon: "📊", desc: "ניטור, דיווח, אופטימיזציה סופית" },
];

// ── Platform icons ─────────────────────────────────────────────
const PLATFORM_LABELS: Record<string, string> = {
  google_seo: "Google SEO",
  google_ai_overview: "Google AI Overview",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  claude: "Claude",
  gemini: "Gemini",
};

// ── Helpers ────────────────────────────────────────────────────
function s(v: any): string { return typeof v === "string" ? v : String(v || ""); }
function n(v: any): number { return typeof v === "number" ? v : Number(v) || 0; }
function fmtDate(d: any): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return "—"; }
}
function scoreColor(score: number): string {
  if (score >= 80) return "#10B981";
  if (score >= 60) return "#F59E0B";
  if (score >= 40) return "#F97316";
  return "#EF4444";
}

export default function ClientReportPage() {
  const params = useParams();
  const planId = params?.planId as string;
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load plan data ─────────────────────────────────────────
  useEffect(() => {
    if (!planId) return;
    fetch(`/api/seo-geo-plans/${planId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); }
        else { setPlan(data); }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [planId]);

  // ── Auto-print on load ────────────────────────────────────
  const handlePrint = useCallback(() => {
    setTimeout(() => window.print(), 800);
  }, []);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "Arial, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 18, color: "#64748b" }}>טוען דוח...</div>
      </div>
    </div>
  );

  if (error || !plan) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "Arial, sans-serif" }}>
      <div style={{ textAlign: "center", color: "#ef4444" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 18 }}>{error || "תוכנית לא נמצאה"}</div>
      </div>
    </div>
  );

  const p = plan;
  const scan = p.websiteScan || {};
  const days: any[] = Array.isArray(p.days) ? p.days : [];
  const aiQueries: any[] = scan.aiQueries || p.visibilityResults || [];
  const facts = scan.websiteFacts || {};
  const keywords: any[] = Array.isArray(p.clientKeywords) ? p.clientKeywords : [];

  // Compute scores
  const techScore = n(p.technicalScore);
  const contentScore = n(p.contentScore);
  const visScore = n(p.visibilityScore);
  const overallScore = n(p.overallScore);

  // Scan metrics
  const hasSSL = scan.hasSSL ?? facts.has_ssl?.value ?? false;
  const loadTime = n(scan.loadTimeMs || facts.load_time_ms?.value);
  const mobileOpt = scan.mobileOptimized ?? facts.mobile_optimized?.value ?? false;
  const hasSitemap = scan.hasSitemap ?? false;
  const hasRobots = scan.hasRobotsTxt ?? false;
  const hasSchema = scan.structuredData ?? false;

  // Group days by phase
  const phaseGroups: Record<number, any[]> = {};
  days.forEach(d => {
    const ph = d.phaseNumber || d.phase || 1;
    if (!phaseGroups[ph]) phaseGroups[ph] = [];
    phaseGroups[ph].push(d);
  });

  // AI visibility summary per platform
  const platformSummary: Record<string, { total: number; mentioned: number }> = {};
  aiQueries.forEach((q: any) => {
    const results = q.results || [];
    results.forEach((r: any) => {
      const eng = r.engine || r.platform || "";
      if (!eng) return;
      if (!platformSummary[eng]) platformSummary[eng] = { total: 0, mentioned: 0 };
      platformSummary[eng].total++;
      if (r.mentioned) platformSummary[eng].mentioned++;
    });
  });

  // Count tasks
  const allTasks = days.flatMap(d => Array.isArray(d.tasks) ? d.tasks : []);
  const totalTasks = allTasks.length;
  const autoTasks = allTasks.filter(t => t.automationModule).length;

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          @page { margin: 15mm 12mm; size: A4; }
        }
        @media screen {
          body { background: #f1f5f9; }
        }
      `}</style>

      <div style={{
        direction: "rtl", fontFamily: "'Segoe UI', 'Arial', sans-serif",
        maxWidth: 800, margin: "0 auto", background: "#fff",
        color: "#1e293b", lineHeight: 1.7,
      }}>

        {/* ═══ PRINT BUTTON (screen only) ═══ */}
        <div className="no-print" style={{
          position: "fixed", top: 20, left: 20, zIndex: 999,
          display: "flex", gap: 8,
        }}>
          <button onClick={handlePrint} style={{
            padding: "12px 28px", background: "#3B82F6", color: "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
          }}>
            🖨️ הורד PDF
          </button>
          <button onClick={() => window.close()} style={{
            padding: "12px 20px", background: "#f1f5f9", color: "#64748b",
            border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 14, fontWeight: 600,
            cursor: "pointer",
          }}>
            ✕ סגור
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAGE 1: COVER                                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
          color: "#fff", padding: "60px 40px", position: "relative", overflow: "hidden",
        }}>
          {/* Background pattern */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.04,
            backgroundImage: `radial-gradient(circle at 25% 25%, #3B82F6 1px, transparent 1px),
                              radial-gradient(circle at 75% 75%, #8B5CF6 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }} />

          {/* Logo */}
          <div style={{
            fontSize: 18, fontWeight: 800, letterSpacing: 6,
            color: "#60a5fa", marginBottom: 48,
            textTransform: "uppercase",
          }}>
            PIXEL SEO / GEO
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 42, fontWeight: 800, textAlign: "center",
            margin: "0 0 16px", lineHeight: 1.3,
            background: "linear-gradient(135deg, #fff 0%, #93c5fd 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            תוכנית קידום אתרים
            <br />
            60 ימים
          </h1>

          <div style={{
            fontSize: 22, fontWeight: 600, color: "#93c5fd",
            marginBottom: 48, textAlign: "center",
          }}>
            {s(p.clientName)}
          </div>

          {/* Domain + date */}
          <div style={{
            display: "flex", gap: 32, fontSize: 14, color: "#94a3b8",
          }}>
            <span>🌐 {s(p.websiteUrl || scan.url)}</span>
            <span>📅 {fmtDate(p.generatedAt || p.createdAt)}</span>
          </div>

          {/* Score circle */}
          <div style={{
            marginTop: 48, width: 140, height: 140, borderRadius: "50%",
            border: "3px solid rgba(96,165,250,0.3)",
            display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
            background: "rgba(255,255,255,0.05)",
          }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: "#60a5fa" }}>
              {overallScore || Math.round((techScore + contentScore + visScore) / 3)}%
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>ציון כללי</div>
          </div>

          {/* Footer line */}
          <div style={{
            position: "absolute", bottom: 30, fontSize: 11, color: "#475569",
            textAlign: "center",
          }}>
            דוח זה הופק אוטומטית על ידי מערכת PIXEL SEO/GEO
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAGE 2: EXECUTIVE SUMMARY                                  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="page-break" style={{ padding: "48px 40px" }}>
          <SectionHeader title="סיכום מנהלים" icon="📋" />

          {/* Score cards */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16,
            marginBottom: 32,
          }}>
            {[
              { label: "ציון טכני", score: techScore, icon: "🔧" },
              { label: "ציון תוכן", score: contentScore, icon: "📝" },
              { label: "נראות AI", score: visScore, icon: "🤖" },
              { label: "ציון כללי", score: overallScore || Math.round((techScore + contentScore + visScore) / 3), icon: "📊" },
            ].map((item, i) => (
              <div key={i} style={{
                textAlign: "center", padding: "20px 12px", borderRadius: 14,
                border: "1px solid #e2e8f0", background: "#fafbfc",
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                <div style={{
                  fontSize: 32, fontWeight: 800, color: scoreColor(item.score),
                }}>{item.score}%</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Quick facts */}
          <div style={{
            background: "#f8fafc", borderRadius: 14, padding: "20px 24px",
            border: "1px solid #e2e8f0", marginBottom: 24,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>נתונים מהירים</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 32px", fontSize: 13 }}>
              <FactRow label="אתר" value={s(p.websiteUrl || scan.url)} />
              <FactRow label="סה״כ משימות" value={`${totalTasks} (${autoTasks} אוטומטיות)`} />
              <FactRow label="SSL" value={hasSSL ? "✅ מאובטח" : "❌ חסר"} />
              <FactRow label="מהירות טעינה" value={loadTime ? `${(loadTime / 1000).toFixed(1)} שניות` : "—"} />
              <FactRow label="מותאם למובייל" value={mobileOpt ? "✅ כן" : "❌ לא"} />
              <FactRow label="Sitemap" value={hasSitemap ? "✅ קיים" : "❌ חסר"} />
              <FactRow label="Robots.txt" value={hasRobots ? "✅ קיים" : "❌ חסר"} />
              <FactRow label="Schema" value={hasSchema ? "✅ קיים" : "❌ חסר"} />
            </div>
          </div>

          {/* Keywords */}
          {keywords.length > 0 && (
            <div style={{
              background: "#f0f9ff", borderRadius: 14, padding: "20px 24px",
              border: "1px solid #bae6fd",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#0369a1" }}>
                ביטויי מפתח עיקריים ({keywords.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {keywords.map((kw: any, i: number) => (
                  <span key={i} style={{
                    padding: "4px 14px", background: "#fff", borderRadius: 20,
                    fontSize: 12, fontWeight: 600, color: "#0369a1",
                    border: "1px solid #bae6fd",
                  }}>
                    {typeof kw === "string" ? kw : kw.keyword || kw.term || ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAGE 3: WEBSITE SCAN RESULTS                               */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="page-break" style={{ padding: "48px 40px" }}>
          <SectionHeader title="תוצאות סריקת האתר" icon="🔍" />

          {/* Tech check grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
            marginBottom: 32,
          }}>
            {[
              { label: "אבטחת SSL", ok: hasSSL, icon: "🔒" },
              { label: "מותאם למובייל", ok: mobileOpt, icon: "📱" },
              { label: "Sitemap.xml", ok: hasSitemap, icon: "🗺️" },
              { label: "Robots.txt", ok: hasRobots, icon: "🤖" },
              { label: "Schema / מבנה נתונים", ok: hasSchema, icon: "📐" },
              { label: "Open Graph", ok: scan.openGraph ?? false, icon: "🔗" },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 16px", borderRadius: 12,
                background: item.ok ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${item.ok ? "#bbf7d0" : "#fecaca"}`,
              }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: item.ok ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                    {item.ok ? "תקין" : "דורש טיפול"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Speed + pages */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
            marginBottom: 32,
          }}>
            <MetricCard label="מהירות טעינה" value={loadTime ? `${(loadTime / 1000).toFixed(1)}s` : "—"}
              color={loadTime < 3000 ? "#10B981" : loadTime < 5000 ? "#F59E0B" : "#EF4444"} />
            <MetricCard label="עמודים שנסרקו" value={`${n(scan.totalPages || scan.scannedPages?.length)}`} color="#3B82F6" />
            <MetricCard label="קישורים שבורים" value={`${n(scan.brokenLinks)}`}
              color={n(scan.brokenLinks) === 0 ? "#10B981" : "#EF4444"} />
          </div>

          {/* Issues if present */}
          {Array.isArray(scan.issues) && scan.issues.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>
                בעיות שזוהו ({scan.issues.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {scan.issues.slice(0, 8).map((issue: any, i: number) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10,
                    background: issue.impact === "high" ? "#fef2f2" : "#fffbeb",
                    border: `1px solid ${issue.impact === "high" ? "#fecaca" : "#fed7aa"}`,
                    fontSize: 12,
                  }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                      background: issue.impact === "high" ? "#fee2e2" : "#fef3c7",
                      color: issue.impact === "high" ? "#dc2626" : "#d97706",
                    }}>
                      {issue.impact === "high" ? "גבוה" : "בינוני"}
                    </span>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{s(issue.title)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAGE 4: AI VISIBILITY RESULTS                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {Object.keys(platformSummary).length > 0 && (
          <div className="page-break" style={{ padding: "48px 40px" }}>
            <SectionHeader title="נראות במנועי AI" icon="🤖" />

            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24, lineHeight: 1.8 }}>
              בדקנו את הנוכחות שלכם ב-{Object.keys(platformSummary).length} פלטפורמות AI מובילות.
              להלן התוצאות עבור {aiQueries.length} שאילתות שנבדקו:
            </p>

            {/* Platform cards */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
              marginBottom: 32,
            }}>
              {Object.entries(platformSummary).map(([eng, data]) => {
                const pct = data.total > 0 ? Math.round((data.mentioned / data.total) * 100) : 0;
                return (
                  <div key={eng} style={{
                    textAlign: "center", padding: "20px 14px", borderRadius: 14,
                    border: "1px solid #e2e8f0", background: "#fafbfc",
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>
                      {PLATFORM_LABELS[eng] || eng}
                    </div>
                    <div style={{
                      fontSize: 36, fontWeight: 800, color: scoreColor(pct),
                    }}>{pct}%</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      מוזכר ב-{data.mentioned} מתוך {data.total} שאילתות
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top queries table */}
            {aiQueries.length > 0 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>
                  שאילתות מרכזיות
                </div>
                <table style={{
                  width: "100%", borderCollapse: "collapse", fontSize: 12,
                }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={thStyle}>שאילתה</th>
                      <th style={thStyle}>פלטפורמות</th>
                      <th style={thStyle}>אזכור</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiQueries.slice(0, 12).map((q: any, i: number) => {
                      const results = q.results || [];
                      const mentioned = results.filter((r: any) => r.mentioned).length;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={tdStyle}>{s(q.query)}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>{results.length}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{
                              padding: "2px 10px", borderRadius: 10, fontWeight: 700, fontSize: 11,
                              background: mentioned > 0 ? "#dcfce7" : "#fee2e2",
                              color: mentioned > 0 ? "#16a34a" : "#dc2626",
                            }}>
                              {mentioned > 0 ? `${mentioned} מתוך ${results.length}` : "לא מוזכר"}
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

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAGE 5+: 60-DAY PLAN BY PHASES                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="page-break" style={{ padding: "48px 40px" }}>
          <SectionHeader title="תוכנית 60 ימים — מפת הדרכים" icon="📅" />

          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24, lineHeight: 1.8 }}>
            התוכנית מחולקת ל-5 שלבים, כל שלב מתמקד בהיבט אחר של הקידום.
            משימות אוטומטיות מסומנות ב-⚡ ומתבצעות על ידי המערכת ללא צורך בהתערבות ידנית.
          </p>

          {/* Phase overview cards */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10,
            marginBottom: 32,
          }}>
            {PHASES.map(ph => {
              const phaseDays = phaseGroups[ph.num] || [];
              const phaseTasks = phaseDays.flatMap(d => Array.isArray(d.tasks) ? d.tasks : []);
              const done = phaseTasks.filter(t => t.status === "done").length;
              return (
                <div key={ph.num} style={{
                  textAlign: "center", padding: "14px 8px", borderRadius: 12,
                  border: `2px solid ${ph.color}20`,
                  background: `${ph.color}08`,
                }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{ph.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ph.color }}>{ph.name}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                    ימים {ph.days}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                    {phaseTasks.length} משימות
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed phase breakdowns */}
        {PHASES.map(ph => {
          const phaseDays = phaseGroups[ph.num] || [];
          if (phaseDays.length === 0) return null;

          return (
            <div key={ph.num} className="page-break" style={{ padding: "48px 40px" }}>
              {/* Phase header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 14, marginBottom: 24,
                paddingBottom: 16, borderBottom: `3px solid ${ph.color}`,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, fontSize: 26,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${ph.color}15`, color: ph.color,
                }}>
                  {ph.icon}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>
                    שלב {ph.num}: {ph.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    ימים {ph.days} — {ph.desc}
                  </div>
                </div>
              </div>

              {/* Tasks table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: `${ph.color}08` }}>
                    <th style={{ ...thStyle, width: 50 }}>יום</th>
                    <th style={thStyle}>משימה</th>
                    <th style={{ ...thStyle, width: 60 }}>סוג</th>
                    <th style={{ ...thStyle, width: 60 }}>עדיפות</th>
                  </tr>
                </thead>
                <tbody>
                  {phaseDays.flatMap(d =>
                    (Array.isArray(d.tasks) ? d.tasks : []).map((task: any, ti: number) => (
                      <tr key={`${d.day}-${ti}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: ph.color }}>
                          {d.day}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: "#1e293b" }}>
                            {task.automationModule ? "⚡ " : ""}{s(task.title)}
                          </div>
                          {task.description && (
                            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                              {s(task.description).slice(0, 80)}
                            </div>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                            background: task.automationModule ? "#dbeafe" : "#f1f5f9",
                            color: task.automationModule ? "#2563eb" : "#64748b",
                          }}>
                            {task.automationModule ? "אוטומטי" : "ידני"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                            background: task.priority === "high" ? "#fee2e2" : task.priority === "medium" ? "#fef3c7" : "#f1f5f9",
                            color: task.priority === "high" ? "#dc2626" : task.priority === "medium" ? "#d97706" : "#64748b",
                          }}>
                            {task.priority === "high" ? "גבוה" : task.priority === "medium" ? "בינוני" : "נמוך"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* LAST PAGE: SUMMARY + CONTACT                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="page-break" style={{
          padding: "48px 40px", minHeight: "60vh",
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <SectionHeader title="סיכום והמלצות" icon="🎯" />

          <div style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
            borderRadius: 20, padding: "36px 32px", color: "#fff", marginBottom: 32,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>מה הלאה?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SummaryItem num={1} text="תחילת עבודה מיידית — השלב הראשון מתחיל עם סריקה מלאה ותיקונים טכניים" />
              <SummaryItem num={2} text={`${autoTasks} משימות אוטומטיות — המערכת מבצעת פעולות SEO ו-GEO באופן עצמאי`} />
              <SummaryItem num={3} text="דוחות שבועיים — קבלו עדכונים על כל פעולה שבוצעה ותוצאותיה" />
              <SummaryItem num={4} text="מעקב ושיפור מתמיד — המערכת עוקבת אחרי דירוגים ומתאימה את האסטרטגיה" />
            </div>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: "center", padding: "24px 0", borderTop: "2px solid #e2e8f0",
          }}>
            <div style={{
              fontSize: 16, fontWeight: 800, color: "#3B82F6",
              letterSpacing: 4, marginBottom: 8,
            }}>PIXEL SEO / GEO</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              קידום אתרים חכם מבוסס AI — מערכת אוטונומית לשיפור נראות דיגיטלית
            </div>
            <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 8 }}>
              {fmtDate(new Date().toISOString())} | דוח אוטומטי
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
      paddingBottom: 12, borderBottom: "2px solid #e2e8f0",
    }}>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>{title}</h2>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#64748b" }}>{label}:</span>
      <span style={{ fontWeight: 600, color: "#1e293b" }}>{value}</span>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      textAlign: "center", padding: "18px 12px", borderRadius: 14,
      border: "1px solid #e2e8f0", background: "#fafbfc",
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SummaryItem({ num, text }: { num: number; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: "rgba(59,130,246,0.2)", color: "#93c5fd",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800,
      }}>{num}</div>
      <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

// ── Table styles ────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "10px 12px", textAlign: "right", fontWeight: 700,
  color: "#475569", fontSize: 11, borderBottom: "2px solid #e2e8f0",
};
const tdStyle: React.CSSProperties = {
  padding: "10px 12px", textAlign: "right", verticalAlign: "top",
};
