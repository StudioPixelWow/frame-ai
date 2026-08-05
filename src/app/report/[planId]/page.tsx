"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  generatePremiumReport,
  type PremiumSeoReport,
  type PremiumReportBlock,
  type PremiumReportSection,
} from "@/lib/seo/premium-report-engine";

// ══════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════════════

const C = {
  primary: "#00B5FE",
  primaryDark: "#0095D0",
  primaryLight: "#E6F7FF",
  accent: "#F0FF02",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  text: "#1A1A2E",
  textSecondary: "#5A5A7A",
  textMuted: "#9A9AB0",
  border: "#E8EAF0",
  borderLight: "#F0F2F5",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
};

const SEVERITY_MAP: Record<
  string,
  { bg: string; border: string; color: string; icon: string; label: string; labelEn: string }
> = {
  critical: { bg: "#FEE2E2", border: "#FECACA", color: "#991B1B", icon: "⛔", label: "קריטי", labelEn: "Critical" },
  warning: { bg: "#FEF3C7", border: "#FDE68A", color: "#92400E", icon: "⚠️", label: "אזהרה", labelEn: "Warning" },
  info: { bg: "#DBEAFE", border: "#BFDBFE", color: "#1E40AF", icon: "ℹ️", label: "מידע", labelEn: "Info" },
  success: { bg: "#D1FAE5", border: "#A7F3D0", color: "#065F46", icon: "✅", label: "תקין", labelEn: "Success" },
};

const PRIORITY_MAP: Record<string, { bg: string; color: string; label: string; labelEn: string }> = {
  critical: { bg: "#FEE2E2", color: "#991B1B", label: "קריטי", labelEn: "Critical" },
  high: { bg: "#FEF3C7", color: "#92400E", label: "גבוה", labelEn: "High" },
  medium: { bg: "#DBEAFE", color: "#1E40AF", label: "בינוני", labelEn: "Medium" },
  low: { bg: "#E5E7EB", color: "#374151", label: "נמוך", labelEn: "Low" },
};

const SECTION_ICONS: Record<string, string> = {
  cover: "📋",
  executive_summary: "📊",
  market_context: "🌐",
  pixel_seo_score: "🎯",
  pixel_geo_score: "🤖",
  engine_snapshot: "⚙️",
  language_segmentation: "🌍",
  branded_analysis: "🏷️",
  topic_clusters: "🗂️",
  competitor_authority: "🏆",
  technical_audit: "🔧",
  structured_data: "🧩",
  seo_organic: "🔍",
  content_gaps: "💡",
  citation_quality: "📝",
  brand_accuracy: "🎯",
  action_plan: "🚀",
  success_metrics: "📈",
  methodology: "🔬",
  appendices: "📎",
};

const MODE_SECTIONS: Record<string, string[]> = {
  full: [],
  executive: ["cover", "executive_summary", "pixel_seo_score", "pixel_geo_score", "action_plan", "success_metrics"],
  technical: ["cover", "technical_audit", "structured_data", "seo_organic", "methodology"],
  client: [
    "cover", "executive_summary", "pixel_seo_score", "pixel_geo_score",
    "engine_snapshot", "action_plan", "success_metrics",
  ],
};

const cardStyle: React.CSSProperties = {
  background: C.card,
  borderRadius: 20,
  border: `1px solid ${C.border}`,
  padding: 32,
  boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
};

// ══════════════════════════════════════════════════════════════
// IMPORT RENDER HELPERS — re-export from internal report page
// We copy just the rendering since we can't import default exports
// ══════════════════════════════════════════════════════════════

function ScoreGauge({
  score,
  maxScore,
  label,
  color,
  previousScore,
  size = 140,
}: {
  score: number;
  maxScore: number;
  label: string;
  color: string;
  previousScore?: number;
  size?: number;
}) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / maxScore) * circumference;
  const rotation = -90;
  const delta = previousScore != null ? score - previousScore : null;

  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={C.border} strokeWidth={10} opacity={0.5} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round" transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" dominantBaseline="central"
          fontSize={size / 3.5} fontWeight={800} fill={color}>{score}</text>
        <text x={size / 2} y={size / 2 + 20} textAnchor="middle" fontSize={11} fill={C.textMuted}>/ {maxScore}</text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginTop: 4 }}>{label}</div>
      {delta != null && delta !== 0 && (
        <div style={{ fontSize: 11, marginTop: 2, color: delta > 0 ? C.success : C.danger, fontWeight: 600 }}>
          {delta > 0 ? `+${delta}` : delta} {delta > 0 ? "↑" : "↓"}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// BLOCK RENDERER — renders each report content block
// ══════════════════════════════════════════════════════════════

function RenderBlock({ block, he }: { block: PremiumReportBlock; he: boolean }) {
  switch (block.type) {
    case "heading":
      return <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "24px 0 12px" }}>{block.text}</h3>;
    case "subheading":
      return <h4 style={{ fontSize: 15, fontWeight: 600, color: C.textSecondary, margin: "18px 0 8px" }}>{block.text}</h4>;
    case "paragraph":
      return <p style={{ fontSize: 14, lineHeight: 1.8, color: C.textSecondary, margin: "8px 0" }}>{block.text}</p>;
    case "stat":
      return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", background: C.primaryLight, borderRadius: 10, margin: "4px 6px 4px 0" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{block.value}</span>
          <span style={{ fontSize: 12, color: C.textSecondary }}>{block.label}</span>
        </div>
      );
    case "score_gauge":
      return (
        <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", margin: "16px 0" }}>
          <ScoreGauge score={block.score} maxScore={block.maxScore} label={block.label} color={block.color || C.primary} previousScore={block.previousScore} />
        </div>
      );
    case "table": {
      const headers = block.headers || [];
      const rows = block.rows || [];
      return (
        <div style={{ overflowX: "auto", margin: "12px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            {headers.length > 0 && (
              <thead>
                <tr>
                  {headers.map((h: string, i: number) => (
                    <th key={i} style={{ padding: "10px 14px", background: "#F0F4F8", fontWeight: 700, color: C.text, borderBottom: `2px solid ${C.border}`, textAlign: "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row: string[], ri: number) => (
                <tr key={ri}>
                  {row.map((cell: string, ci: number) => (
                    <td key={ci} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderLight}`, color: C.textSecondary }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "list":
      return (
        <ul style={{ margin: "8px 0", paddingRight: 20, paddingLeft: 0 }}>
          {(block.items || []).map((item: string, i: number) => (
            <li key={i} style={{ fontSize: 14, lineHeight: 1.8, color: C.textSecondary, marginBottom: 4 }}>{item}</li>
          ))}
        </ul>
      );
    case "alert": {
      const severity = SEVERITY_MAP[block.severity || "info"] || SEVERITY_MAP.info;
      return (
        <div style={{ padding: "14px 18px", borderRadius: 12, background: severity.bg, border: `1px solid ${severity.border}`, margin: "10px 0", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{severity.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: severity.color, marginBottom: 2 }}>{severity.label}</div>
            <div style={{ fontSize: 13, color: severity.color, lineHeight: 1.6 }}>{block.text}</div>
          </div>
        </div>
      );
    }
    case "action_item": {
      const priority = PRIORITY_MAP[block.priority || "medium"] || PRIORITY_MAP.medium;
      return (
        <div style={{ ...cardStyle, padding: "16px 20px", margin: "8px 0", borderRight: `4px solid ${priority.color}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ padding: "3px 10px", borderRadius: 6, background: priority.bg, color: priority.color, fontSize: 11, fontWeight: 700 }}>
              {he ? priority.label : priority.labelEn}
            </span>
            {block.deadline && <span style={{ fontSize: 11, color: C.textMuted }}>{block.deadline}</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{block.title}</div>
          {block.description && <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>{block.description}</div>}
          {block.kpi && <div style={{ fontSize: 12, color: C.primary, fontWeight: 600, marginTop: 6 }}>KPI: {block.kpi}</div>}
        </div>
      );
    }
    case "kpi_card":
      return (
        <div style={{ ...cardStyle, padding: "16px 20px", margin: "8px 0", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.primary }}>{block.value}</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>{block.label}</div>
          {block.target && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{he ? "יעד" : "Target"}: {block.target}</div>}
        </div>
      );
    case "progress_bar":
      return (
        <div style={{ margin: "10px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{block.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{block.value}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: C.borderLight }}>
            <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`, width: `${Math.min(100, block.value || 0)}%`, transition: "width 1s ease" }} />
          </div>
        </div>
      );
    case "chart_placeholder":
      return (
        <div style={{ ...cardStyle, padding: 24, margin: "12px 0", textAlign: "center", background: "#F8FAFC" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{block.title}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{block.description}</div>
        </div>
      );
    case "divider":
      return <hr style={{ border: "none", borderTop: `1px solid ${C.borderLight}`, margin: "20px 0" }} />;
    default:
      return null;
  }
}

// ══════════════════════════════════════════════════════════════
// ACTION PLAN KANBAN
// ══════════════════════════════════════════════════════════════

function classifyDeadline(deadline?: string): "immediate" | "short" | "medium" {
  if (!deadline) return "medium";
  const d = deadline.toLowerCase();
  const numMatch = d.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1], 10) : null;
  if (d.includes("מיידי") || d.includes("immediate") || d.includes("אחד") || (num !== null && num <= 7)) return "immediate";
  if (d.includes("שבועיים") || d.includes("שבוע") || (num !== null && num <= 30)) return "short";
  return "medium";
}

function ActionPlanKanban({ items, he }: { items: Extract<PremiumReportBlock, { type: "action_item" }>[]; he: boolean }) {
  const phases = [
    { key: "immediate" as const, label: he ? "מיידי (שבוע 1)" : "Immediate (Week 1)", color: "#EF4444", bg: "#FEE2E2" },
    { key: "short" as const, label: he ? "טווח קצר (חודש 1)" : "Short Term (Month 1)", color: "#F59E0B", bg: "#FEF3C7" },
    { key: "medium" as const, label: he ? "טווח בינוני (חודש 2-3)" : "Medium Term (Month 2-3)", color: "#3B82F6", bg: "#DBEAFE" },
  ];
  const grouped = { immediate: [] as typeof items, short: [] as typeof items, medium: [] as typeof items };
  items.forEach((item) => { const phase = classifyDeadline(item.deadline); grouped[phase].push(item); });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, margin: "16px 0" }}>
      {phases.map((p) => (
        <div key={p.key} style={{ background: "#FAFBFC", borderRadius: 14, padding: 14, border: `1px solid ${C.borderLight}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.label}</span>
            <span style={{ marginRight: "auto", fontSize: 11, color: C.textMuted, background: p.bg, padding: "2px 8px", borderRadius: 8 }}>{grouped[p.key].length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {grouped[p.key].map((item, i) => {
              const priority = PRIORITY_MAP[item.priority || "medium"] || PRIORITY_MAP.medium;
              return (
                <div key={i} style={{ background: C.card, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}`, borderRight: `3px solid ${priority.color}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>{item.title}</div>
                  {item.kpi && <div style={{ fontSize: 11, color: C.primary, fontWeight: 500 }}>KPI: {item.kpi}</div>}
                </div>
              );
            })}
            {grouped[p.key].length === 0 && (
              <div style={{ textAlign: "center", padding: 20, color: C.textMuted, fontSize: 12 }}>
                {he ? "אין פריטים" : "No items"}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN PUBLIC REPORT PAGE
// ══════════════════════════════════════════════════════════════

export default function PublicReportPage() {
  const params = useParams<{ planId: string }>();
  const planId = params?.planId;

  const [report, setReport] = useState<PremiumSeoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"he" | "en">("he");
  const [reportMode, setReportMode] = useState<"full" | "executive" | "technical" | "client">("client");
  const [activeSection, setActiveSection] = useState<string>("");

  const he = lang === "he";

  // ── Fetch plan and generate report ──
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/data/seo-plans/${planId}`);
        if (!res.ok) throw new Error(he ? "לא ניתן לטעון את הדוח" : "Failed to load report");
        const plan = await res.json();
        if (cancelled) return;
        const premiumReport = generatePremiumReport(plan, lang);
        setReport(premiumReport);
      } catch (e: any) {
        if (!cancelled) setError(e.message || (he ? "שגיאה בטעינת הדוח" : "Report loading failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [planId, lang, he]);

  // ── Section intersection observer ──
  useEffect(() => {
    if (!report) return;
    const observers: IntersectionObserver[] = [];
    report.sections.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(s.id); },
        { rootMargin: "-20% 0px -60% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [report]);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }, []);

  // ── Filter sections by mode ──
  const filteredSections = useMemo(() => {
    if (!report) return [];
    const allowed = MODE_SECTIONS[reportMode];
    if (!allowed || allowed.length === 0) return report.sections;
    return report.sections.filter((s) => allowed.includes(s.id));
  }, [report, reportMode]);

  // ── Detect action_plan section for kanban ──
  const actionPlanItems = useMemo(() => {
    if (!report) return [];
    const section = report.sections.find((s) => s.id === "action_plan");
    if (!section) return [];
    return section.content.filter(
      (b): b is Extract<PremiumReportBlock, { type: "action_item" }> => b.type === "action_item"
    );
  }, [report]);

  // ══════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div style={{ direction: "rtl", padding: "60px 32px", minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", padding: "140px 0" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, margin: "0 auto 24px",
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, color: "#fff", fontWeight: 800,
            animation: "premiumPulse 2s ease-in-out infinite",
          }}>P</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
            {he ? "טוען דוח פרמיום..." : "Loading Premium Report..."}
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>
            {he ? "המערכת טוענת את הדוח המלא" : "Loading the full report"}
          </p>
        </div>
        <style>{`@keyframes premiumPulse { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.08); opacity:0.85; } }`}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ERROR STATE
  // ══════════════════════════════════════════════════════════

  if (error || !report) {
    return (
      <div style={{ direction: "rtl", padding: "60px 32px", minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", padding: "100px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{"⚠️"}</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
            {he ? "הדוח אינו זמין" : "Report Not Available"}
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>{error || (he ? "לא נמצא דוח בכתובת זו" : "No report found at this URL")}</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════

  const domain = report.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      {/* Print + animation styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #premium-report-print, #premium-report-print * { visibility: visible; }
          #premium-report-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 15mm 12mm; }
        }
        @keyframes premiumPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        html { scroll-behavior: smooth; }
      `}</style>

      <div style={{ direction: "rtl", minHeight: "100vh", background: C.bg }}>
        {/* ═══ BRANDED HEADER BAR (no-print) ═══ */}
        <div
          className="no-print"
          style={{
            position: "sticky", top: 0, zIndex: 50,
            background: "rgba(247,249,252,0.92)", backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${C.border}`, padding: "10px 32px",
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            {/* Left: Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 800, color: "#fff",
              }}>P</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>PIXEL SEO/GEO</span>
            </div>

            {/* Center: mode selector */}
            <div style={{ display: "flex", background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {([
                { key: "full", label: he ? "מלא" : "Full" },
                { key: "executive", label: he ? "מנהלים" : "Executive" },
                { key: "technical", label: he ? "טכני" : "Technical" },
                { key: "client", label: he ? "ללקוח" : "Client" },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setReportMode(m.key)}
                  style={{
                    padding: "7px 16px", border: "none",
                    background: reportMode === m.key ? C.primary : "transparent",
                    color: reportMode === m.key ? "#fff" : C.textSecondary,
                    cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s",
                  }}
                >{m.label}</button>
              ))}
            </div>

            {/* Right: actions */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <button onClick={() => setLang("he")} style={{ padding: "7px 14px", border: "none", background: lang === "he" ? C.primary : "transparent", color: lang === "he" ? "#fff" : C.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>עב</button>
                <button onClick={() => setLang("en")} style={{ padding: "7px 14px", border: "none", background: lang === "en" ? C.primary : "transparent", color: lang === "en" ? "#fff" : C.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>EN</button>
              </div>
              <button onClick={() => window.print()} style={{ padding: "7px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.textSecondary }}>
                {he ? "🖨️ הדפסה" : "🖨️ Print"}
              </button>
            </div>
          </div>
        </div>

        {/* ═══ CONTENT AREA WITH TOC SIDEBAR ═══ */}
        <div id="premium-report-print" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 24, padding: "24px 32px" }}>
          {/* TOC SIDEBAR */}
          <aside className="no-print" style={{ width: 240, flexShrink: 0, position: "sticky", top: 60, alignSelf: "flex-start", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>
                {he ? "תוכן עניינים" : "Contents"}
              </div>
              {filteredSections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "right", padding: "7px 10px",
                    border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 500,
                    marginBottom: 2, transition: "all 0.2s",
                    background: activeSection === s.id ? C.primaryLight : "transparent",
                    color: activeSection === s.id ? C.primary : C.textSecondary,
                    borderRight: activeSection === s.id ? `3px solid ${C.primary}` : "3px solid transparent",
                  }}
                >
                  {SECTION_ICONS[s.id] || "📄"} {s.title}
                </button>
              ))}
            </div>
          </aside>

          {/* MAIN REPORT CONTENT */}
          <main style={{ flex: 1, minWidth: 0 }}>
            {filteredSections.map((section, si) => (
              <div
                key={section.id}
                id={`section-${section.id}`}
                style={{
                  ...cardStyle,
                  marginBottom: 20,
                  animation: `fadeInUp 0.4s ease ${si * 0.05}s both`,
                }}
              >
                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${C.borderLight}` }}>
                  <span style={{ fontSize: 22 }}>{SECTION_ICONS[section.id] || "📄"}</span>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>{section.title}</h2>
                    {section.subtitle && <p style={{ fontSize: 13, color: C.textMuted, margin: "2px 0 0" }}>{section.subtitle}</p>}
                  </div>
                </div>

                {/* Section content */}
                {section.content.map((block, bi) => (
                  <RenderBlock key={bi} block={block} he={he} />
                ))}

                {/* Kanban for action_plan */}
                {section.id === "action_plan" && actionPlanItems.length > 0 && (
                  <ActionPlanKanban items={actionPlanItems} he={he} />
                )}
              </div>
            ))}

            {/* Footer */}
            <div style={{ textAlign: "center", padding: "40px 0 60px", color: C.textMuted, fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#fff",
                }}>P</div>
                <span style={{ fontWeight: 700 }}>PIXEL SEO/GEO</span>
              </div>
              <div>{he ? `דוח נוצר אוטומטית עבור ${domain}` : `Report automatically generated for ${domain}`}</div>
              <div style={{ marginTop: 4 }}>{he ? `תאריך: ${report.generatedAt}` : `Date: ${report.generatedAt}`}</div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
