"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// ══════════════════════════════════════════════════════════════
// TYPES (mirrors report-engine.ts)
// ══════════════════════════════════════════════════════════════

interface ReportSection {
  id: string; number: number; title: string; titleEn: string;
  content: ReportBlock[];
}

type ReportBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "stat"; label: string; value: string; color: string; icon?: string }
  | { type: "stat_row"; stats: Array<{ label: string; value: string; color: string; icon?: string }> }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "finding"; severity: "critical" | "warning" | "info" | "success"; title: string; detail: string; recommendation: string }
  | { type: "progress_bar"; label: string; value: number; max: number; color: string }
  | { type: "divider" };

interface SeoReport {
  id: string; planId: string; clientName: string; websiteUrl: string;
  generatedAt: string; language: "he" | "en";
  sections: ReportSection[];
  meta: {
    overallScore: number; technicalScore: number; contentScore: number;
    visibilityScore: number; totalFindings: number; criticalFindings: number;
    totalRecommendations: number;
  };
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════

const C = {
  primary: "#00B5FE", primaryDark: "#0095D0", primaryLight: "#E6F7FF",
  accent: "#E8F401",
  bg: "#F7F9FC", card: "#FFFFFF",
  text: "#1A1A2E", textSecondary: "#5A5A7A", textMuted: "#9A9AB0",
  border: "#E8EAF0", borderLight: "#F0F2F5",
  success: "#10B981", warning: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
};

const SEVERITY_CONFIG = {
  critical: { bg: "#FEE2E2", border: "#FECACA", color: "#991B1B", icon: "🔴", label: "קריטי", labelEn: "Critical" },
  warning: { bg: "#FEF3C7", border: "#FDE68A", color: "#92400E", icon: "🟡", label: "אזהרה", labelEn: "Warning" },
  info: { bg: "#DBEAFE", border: "#BFDBFE", color: "#1E40AF", icon: "🔵", label: "מידע", labelEn: "Info" },
  success: { bg: "#D1FAE5", border: "#A7F3D0", color: "#065F46", icon: "🟢", label: "תקין", labelEn: "Success" },
};

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function ReportViewer() {
  const { planId } = useParams<{ planId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<SeoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lang, setLang] = useState<"he" | "en">((searchParams.get("lang") as "he" | "en") || "he");
  const he = lang === "he";

  // Fetch existing report on load, auto-generate if none exists
  useEffect(() => {
    if (!planId) return;
    (async () => {
      try {
        const res = await fetch(`/api/data/seo-plans/${planId}`);
        if (res.ok) {
          const plan = await res.json();
          // Check if a report already exists (check both lastReport and reports array)
          if (plan.lastReport) {
            setReport(plan.lastReport);
            setLoading(false);
            return;
          }
          // Check reports array — find the latest full report
          if (plan.reports && plan.reports.length > 0) {
            // Reports array has metadata only; we need to regenerate for full content
          }
        }
      } catch (e) {
        console.error("Failed to load plan:", e);
      }
      // No existing report found — auto-generate
      setGenerating(true);
      setLoading(false);
      try {
        const genRes = await fetch("/api/seo/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, language: lang }),
        });
        if (!genRes.ok) {
          const errData = await genRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to generate report");
        }
        const data = await genRes.json();
        setReport(data);
      } catch (e: any) {
        console.error("Report generation failed:", e);
        setError(e.message || "Failed to generate report");
      } finally {
        setGenerating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  async function generateReport() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/seo/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, language: lang }),
      });
      if (!res.ok) throw new Error("Failed to generate report");
      const data = await res.json();
      setReport(data);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  // ── Loading State ──
  if (loading || generating) {
    return (
      <div style={{ direction: "rtl", padding: "60px 32px", minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", padding: "120px 0" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, margin: "0 auto 24px",
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, animation: "pulse 2s ease-in-out infinite",
          }}>📊</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
            {he ? "מייצר דוח..." : "Generating report..."}
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted }}>
            {he ? "המערכת מנתחת את כל נתוני הסריקה ומייצרת המלצות מותאמות" : "Analyzing scan data and generating tailored recommendations"}
          </p>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error || !report) {
    return (
      <div style={{ direction: "rtl", padding: "60px 32px", minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", padding: "80px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
            {he ? "שגיאה בייצור הדוח" : "Report Generation Error"}
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>{error}</p>
          <button
            onClick={() => { setLoading(true); generateReport(); }}
            style={{
              padding: "12px 32px", background: C.primary, color: "#fff",
              border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            {he ? "נסה שוב" : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  const domain = report.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-print-area, #report-print-area * { visibility: visible; }
          #report-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 18mm 15mm; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
      `}</style>

      <div style={{ direction: "rtl", padding: "32px 32px 80px", minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* ── Action Bar (no-print) ── */}
          <div className="no-print" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 32, flexWrap: "wrap", gap: 12,
          }}>
            <button
              onClick={() => router.push(`/seo-geo/${planId}`)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "transparent", border: "none",
                fontSize: 14, color: C.primary, cursor: "pointer", fontWeight: 600,
              }}
            >
              → {he ? "חזרה לתוכנית" : "Back to Plan"}
            </button>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexDirection: "row-reverse" }}>
              {/* Language toggle */}
              <div style={{ display: "flex", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <button
                  onClick={() => setLang("he")}
                  style={{
                    padding: "8px 14px", border: "none", background: lang === "he" ? C.primary : "transparent",
                    color: lang === "he" ? "#fff" : C.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600,
                  }}
                >
                  עברית
                </button>
                <button
                  onClick={() => setLang("en")}
                  style={{
                    padding: "8px 14px", border: "none", background: lang === "en" ? C.primary : "transparent",
                    color: lang === "en" ? "#fff" : C.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600,
                  }}
                >
                  English
                </button>
              </div>
              <button onClick={() => generateReport()} style={{ ...actionBtnStyle, background: "transparent", border: `1px solid ${C.border}`, color: C.textSecondary }}>
                🔄 {he ? "ייצר מחדש" : "Regenerate"}
              </button>
              <button onClick={handlePrint} style={{ ...actionBtnStyle, background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: "#fff" }}>
                📥 {he ? "ייצוא PDF" : "Export PDF"}
              </button>
            </div>
          </div>

          {/* ── Report Content ── */}
          <div id="report-print-area" ref={printRef}>

            {/* ── Cover Header ── */}
            <div style={{
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              borderRadius: 24, padding: "48px 40px", color: "#fff", marginBottom: 32,
              position: "relative", overflow: "hidden",
            }}>
              {/* Decorative circles */}
              <div style={{ position: "absolute", top: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
              <div style={{ position: "absolute", bottom: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.8, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
                  PixelManageAI
                </div>
                <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.3 }}>
                  {he ? "דוח PIXEL SEO/GEO מקיף" : "Comprehensive PIXEL SEO/GEO Report"}
                </h1>
                <div style={{ fontSize: 18, fontWeight: 500, opacity: 0.9, marginBottom: 24 }}>
                  {report.clientName} — {domain}
                </div>

                {/* Meta scores row */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {[
                    { label: he ? "ציון כללי" : "Overall", value: `${report.meta.overallScore}%`, icon: "📊" },
                    { label: he ? "טכני" : "Technical", value: `${report.meta.technicalScore}%`, icon: "🔧" },
                    { label: he ? "נראות AI" : "AI Visibility", value: `${report.meta.visibilityScore}%`, icon: "🤖" },
                    { label: he ? "ממצאים" : "Findings", value: `${report.meta.totalFindings}`, icon: "🔍" },
                    { label: he ? "קריטיים" : "Critical", value: `${report.meta.criticalFindings}`, icon: "🔴" },
                  ].map((m, i) => (
                    <div key={i} style={{
                      background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
                      borderRadius: 14, padding: "12px 20px", minWidth: 100,
                    }}>
                      <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>{m.icon} {m.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 20 }}>
                  {he ? "הופק בתאריך:" : "Generated:"} {new Date(report.generatedAt).toLocaleDateString(he ? "he-IL" : "en-US")}
                </div>
              </div>
            </div>

            {/* ── Table of Contents ── */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 16px" }}>
                {he ? "תוכן עניינים" : "Table of Contents"}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {report.sections.map(s => (
                  <a
                    key={s.id}
                    href={`#section-${s.id}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", borderRadius: 10, textDecoration: "none",
                      color: C.text, fontSize: 14, transition: "background 0.2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.primaryLight)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: C.primaryLight, color: C.primary,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                    }}>{s.number}</span>
                    <span style={{ fontWeight: 500 }}>{he ? s.title : s.titleEn}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* ── Sections ── */}
            {report.sections.map(section => (
              <div
                key={section.id}
                id={`section-${section.id}`}
                style={{ ...cardStyle, marginBottom: 24, pageBreakInside: "avoid" }}
              >
                {/* Section header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
                  paddingBottom: 16, borderBottom: `2px solid ${C.primaryLight}`,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 800,
                  }}>{section.number}</div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
                    {he ? section.title : section.titleEn}
                  </h2>
                </div>

                {/* Section content blocks */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {section.content.map((block, bi) => (
                    <RenderBlock key={bi} block={block} he={he} />
                  ))}
                </div>
              </div>
            ))}

            {/* ── Footer ── */}
            <div style={{
              textAlign: "center", padding: "32px 0", color: C.textMuted, fontSize: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, margin: "0 auto 12px",
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 16, fontWeight: 800,
              }}>P</div>
              <div style={{ fontWeight: 600, color: C.textSecondary }}>PixelManageAI</div>
              <div style={{ marginTop: 4 }}>
                {he ? "דוח זה הופק אוטומטית. כל הזכויות שמורות." : "This report was auto-generated. All rights reserved."}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// BLOCK RENDERER
// ══════════════════════════════════════════════════════════════

function RenderBlock({ block, he }: { block: ReportBlock; he: boolean }) {
  switch (block.type) {

    case "paragraph":
      return (
        <p style={{ fontSize: 14, lineHeight: 1.8, color: C.textSecondary, margin: 0 }}>
          {block.text}
        </p>
      );

    case "heading":
      return (
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: "8px 0 0" }}>
          {block.text}
        </h3>
      );

    case "stat":
      return (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 12,
          padding: "16px 24px", borderRadius: 16,
          background: `${block.color}10`, border: `1px solid ${block.color}25`,
        }}>
          {block.icon && <span style={{ fontSize: 24 }}>{block.icon}</span>}
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{block.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: block.color }}>{block.value}</div>
          </div>
        </div>
      );

    case "stat_row":
      return (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {block.stats.map((s, i) => (
            <div key={i} style={{
              flex: "1 1 140px", padding: "16px 20px", borderRadius: 16,
              background: `${s.color}08`, border: `1px solid ${s.color}20`,
              textAlign: "center",
            }}>
              {s.icon && <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>}
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      );

    case "table":
      return (
        <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${C.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {block.headers.map((h, i) => (
                  <th key={i} style={{
                    padding: "12px 14px", textAlign: "right", fontWeight: 700,
                    color: C.textSecondary, fontSize: 12,
                    borderBottom: `2px solid ${C.border}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: ri < block.rows.length - 1 ? `1px solid ${C.borderLight}` : "none" }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: "10px 14px", color: C.text,
                      fontWeight: ci === 0 ? 600 : 400,
                    }}>
                      {cell === "✓" ? <span style={{ color: C.success, fontWeight: 700 }}>✓</span>
                        : cell === "✗" ? <span style={{ color: C.danger, fontWeight: 700 }}>✗</span>
                        : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "list":
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag style={{
          margin: 0, paddingRight: 24, paddingLeft: 0,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ fontSize: 14, lineHeight: 1.7, color: C.textSecondary }}>
              {item}
            </li>
          ))}
        </Tag>
      );

    case "finding": {
      const sev = SEVERITY_CONFIG[block.severity];
      return (
        <div style={{
          borderRadius: 14, border: `1px solid ${sev.border}`,
          background: sev.bg, padding: "16px 20px",
          pageBreakInside: "avoid",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span>{sev.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: sev.color,
              background: `${sev.color}15`, padding: "2px 8px", borderRadius: 6,
            }}>{he ? sev.label : sev.labelEn}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: sev.color }}>{block.title}</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: sev.color, margin: "0 0 8px", opacity: 0.85 }}>
            {block.detail}
          </p>
          <div style={{
            padding: "10px 14px", borderRadius: 10,
            background: "rgba(255,255,255,0.6)", border: `1px solid ${sev.border}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: sev.color, marginBottom: 4, opacity: 0.7 }}>
              {he ? "המלצה:" : "Recommendation:"}
            </div>
            <div style={{ fontSize: 13, color: sev.color, fontWeight: 500 }}>
              {block.recommendation}
            </div>
          </div>
        </div>
      );
    }

    case "progress_bar": {
      const pct = block.max > 0 ? Math.round((block.value / block.max) * 100) : 0;
      return (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{block.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: block.color }}>{block.value}/{block.max} ({pct}%)</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: C.borderLight }}>
            <div style={{
              height: "100%", borderRadius: 5, width: `${pct}%`,
              background: `linear-gradient(90deg, ${block.color}, ${block.color}CC)`,
              transition: "width 0.5s ease",
            }} />
          </div>
        </div>
      );
    }

    case "divider":
      return <hr style={{ border: "none", height: 1, background: C.border, margin: "8px 0" }} />;

    default:
      return null;
  }
}

// ══════════════════════════════════════════════════════════════
// SHARED STYLES
// ══════════════════════════════════════════════════════════════

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF", borderRadius: 20, border: `1px solid #E8EAF0`,
  padding: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

const actionBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "10px 20px", borderRadius: 12, border: "none",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
