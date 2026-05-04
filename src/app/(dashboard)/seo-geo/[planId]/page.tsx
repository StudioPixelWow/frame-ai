"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

interface ScanResult {
  url: string; scannedAt: string; hasSSL: boolean; loadTimeMs: number;
  mobileOptimized: boolean; metaTitle: string; metaDescription: string;
  h1Tags: string[]; totalPages: number; indexedPages: number; brokenLinks: number;
  hasRobotsTxt: boolean; hasSitemap: boolean; domainAuthority: number;
  structuredData: boolean; openGraph: boolean; canonicalTags: boolean;
  issues: { type: string; category: string; title: string; description: string; impact: string }[];
}

interface Goal {
  id: string; type: string; label: string; icon: string;
  selected: boolean; targetMetric: string; currentValue: number; targetValue: number; priority: string;
}

interface VisibilityQuery { id: string; query: string; category: string; intent: string; importance: string; }
interface VisibilityEngineResult { engine: string; mentioned: boolean; position: number | null; sentiment: string; }
interface VisibilityResult { queryId: string; query: string; results: VisibilityEngineResult[]; }
interface Insight { id: string; category: string; title: string; description: string; impact: string; action: string; }

interface PlanTask {
  id: string; title: string; category: string; priority: string;
  estimatedHours: number; deliverable: string; kpiTarget: string;
  status?: "todo" | "in_progress" | "waiting" | "done";
}

interface PlanWeek {
  weekNumber: number; startDate: string; endDate: string;
  theme: string; focus: string; tasks: PlanTask[];
}

interface PlanPhase {
  number: number; name: string; days: [number, number]; focus: string; tasks: PlanTask[];
}

interface PlanDay {
  day: number; date: string; phase: number; theme: string; tasks: PlanTask[];
}

interface SeoPlan {
  id: string; clientId: string; clientName: string; websiteUrl: string; status: string;
  overallScore: number; technicalScore: number; contentScore: number; visibilityScore: number;
  totalTasks: number; completedTasks: number;
  createdAt: string; updatedAt: string; generatedAt: string | null;
  websiteScan: ScanResult | null;
  goals: Goal[];
  visibilityQueries: VisibilityQuery[];
  visibilityResults: VisibilityResult[];
  insights: Insight[];
  weeks?: PlanWeek[]; // fallback for backward compatibility
  phases?: PlanPhase[]; // new structure
  days?: PlanDay[]; // flat list of days
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════

const C = {
  primary: "#00B5FE", primaryDark: "#0095D0", primaryLight: "#E6F7FF",
  accent: "#E8F401", accentDark: "#C8D400",
  bg: "#F7F9FC", card: "#FFFFFF",
  text: "#1A1A2E", textSecondary: "#5A5A7A", textMuted: "#9A9AB0",
  border: "#E8EAF0", borderLight: "#F0F2F5",
  success: "#10B981", warning: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
  purple: "#8B5CF6",
};

const AI_ENGINES = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Copilot"];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "#6B7280" },
  scanning: { label: "בסריקה", color: C.info },
  goals_set: { label: "יעדים הוגדרו", color: C.warning },
  visibility_done: { label: "נראות הושלמה", color: C.primary },
  insights_ready: { label: "תובנות מוכנות", color: C.purple },
  plan_generated: { label: "תוכנית מוכנה", color: C.success },
  tasks_created: { label: "משימות נוצרו", color: C.success },
  active: { label: "פעיל", color: C.success },
  completed: { label: "הושלם", color: C.primary },
};

type TabId = "overview" | "plan" | "tasks" | "ai" | "results" | "competitors" | "gaps" | "reports";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "סקירה", icon: "📊" },
  { id: "plan", label: "תוכנית 60 יום", icon: "📅" },
  { id: "tasks", label: "משימות", icon: "✅" },
  { id: "ai", label: "תוצאות AI", icon: "🤖" },
  { id: "results", label: "תוצאות ��נראות", icon: "🔎" },
  { id: "competitors", label: "מתחרים", icon: "🏆" },
  { id: "gaps", label: "פערי תוכן", icon: "📝" },
  { id: "reports", label: "דוחות", icon: "📄" },
];

const KANBAN_COLS: { id: PlanTask["status"]; label: string; color: string; icon: string }[] = [
  { id: "todo", label: "לביצוע", color: C.textMuted, icon: "○" },
  { id: "in_progress", label: "בעבודה", color: C.primary, icon: "◉" },
  { id: "waiting", label: "ממתין ללקוח", color: C.warning, icon: "⏳" },
  { id: "done", label: "הושלם", color: C.success, icon: "✓" },
];

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const m = ["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
  return `${date.getDate()} ${m[date.getMonth()]} ${date.getFullYear()}`;
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function SeoPlanDetail() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<SeoPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [drawerQuery, setDrawerQuery] = useState<VisibilityResult | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [reports, setReports] = useState<Array<{ id: string; name: string; generatedAt: string; type: string }>>([]);

  // Fetch plan
  useEffect(() => {
    if (!planId) return;
    (async () => {
      try {
        const res = await fetch(`/api/data/seo-plans/${planId}`);
        if (res.ok) {
          const data = await res.json();
          // Normalize task statuses
          if (data.weeks) {
            data.weeks = data.weeks.map((w: PlanWeek) => ({
              ...w,
              tasks: w.tasks.map((t: PlanTask) => ({ ...t, status: t.status || "todo" })),
            }));
          }
          setPlan(data);
        }
      } catch (e) {
        console.error("Failed to load plan:", e);
      }
      setLoading(false);
    })();
  }, [planId]);

  // All tasks flattened (supports both weeks and days/phases)
  const allTasks = useMemo(() => {
    if (!plan) return [];

    // If plan has days structure
    if (plan.days) {
      return plan.days.flatMap(d => d.tasks.map(t => ({ ...t, dayNumber: d.day, phaseNumber: d.phase, dayTheme: d.theme })));
    }

    // Fallback to weeks structure
    if (plan.weeks) {
      return plan.weeks.flatMap(w => w.tasks.map(t => ({ ...t, weekNumber: w.weekNumber, weekTheme: w.theme })));
    }

    return [];
  }, [plan?.days, plan?.weeks]);

  // Update task status
  const updateTaskStatus = useCallback(async (taskId: string, newStatus: PlanTask["status"]) => {
    if (!plan) return;
    const updatedWeeks = (plan.weeks || []).map(w => ({
      ...w,
      tasks: w.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t),
    }));
    const completedCount = updatedWeeks.flatMap(w => w.tasks).filter(t => t.status === "done").length;
    const updatedPlan = { ...plan, weeks: updatedWeeks, completedTasks: completedCount };
    setPlan(updatedPlan);

    try {
      await fetch(`/api/data/seo-plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks: updatedWeeks, completedTasks: completedCount }),
      });
    } catch (e) {
      console.error("Failed to update task:", e);
    }
  }, [plan]);

  // Load reports from plan data
  useEffect(() => {
    if (plan && (plan as any).reports) {
      setReports((plan as any).reports);
    }
  }, [plan]);

  // Generate report and navigate to viewer
  const handleGenerateReport = useCallback(async () => {
    if (!plan) return;
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/seo/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, language: "he" }),
      });
      if (res.ok) {
        const report = await res.json();
        // Update local reports list
        setReports(prev => [...prev, {
          id: report.id,
          name: `דוח PIXEL SEO/GEO — ${plan.clientName || "ללא שם"}`,
          generatedAt: report.generatedAt,
          type: "full",
        }]);
        // Navigate to report viewer
        router.push(`/seo-geo/${plan.id}/report?lang=he`);
      }
    } catch (e) {
      console.error("Failed to generate report:", e);
    }
    setGeneratingReport(false);
  }, [plan, router]);

  // Generate 60-day plan
  const handleGenerate60DayPlan = useCallback(async () => {
    if (!plan) return;
    setGeneratingPlan(true);
    try {
      const res = await fetch(`/api/seo-geo-plans/${plan.id}/generate-60-day-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        // Refresh plan data
        const refreshRes = await fetch(`/api/data/seo-plans/${plan.id}`);
        if (refreshRes.ok) {
          const refreshed = await refreshRes.json();
          if (refreshed.weeks) {
            refreshed.weeks = refreshed.weeks.map((w: any) => ({
              ...w,
              tasks: w.tasks.map((t: any) => ({ ...t, status: t.status || "todo" })),
            }));
          }
          setPlan(refreshed);
          setActiveTab("plan");
        }
      } else {
        console.error("Failed to generate 60-day plan:", await res.text());
      }
    } catch (e) {
      console.error("Failed to generate 60-day plan:", e);
    }
    setGeneratingPlan(false);
  }, [plan]);

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ direction: "rtl", padding: 40, background: C.bg, minHeight: "100vh" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {[200, 100, 400].map((h, i) => (
            <div key={i} style={{
              height: h, borderRadius: 20, background: C.borderLight, marginBottom: 20,
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ direction: "rtl", padding: 60, background: C.bg, minHeight: "100vh", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>תוכנית לא נמצאה</h2>
        <p style={{ fontSize: 14, color: C.textMuted, marginTop: 8 }}>ID: {planId}</p>
        <button onClick={() => router.push("/seo-geo/dashboard")} style={{
          marginTop: 24, padding: "12px 32px", background: C.primary, color: "#fff",
          border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>חזרה למרכז PIXEL SEO/GEO</button>
      </div>
    );
  }

  const status = STATUS_MAP[plan.status] || STATUS_MAP.draft;
  const domain = plan.websiteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "—";
  const progress = (plan.totalTasks || 0) > 0 ? Math.round(((plan.completedTasks || 0) / (plan.totalTasks || 1)) * 100) : 0;
  const createdDate = plan.createdAt ? new Date(plan.createdAt) : new Date();
  const now = new Date();
  const daysSinceCreated = Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / 86400000));
  const daysRemaining = Math.max(0, 60 - daysSinceCreated);

  // Safe accessors for websiteScan (data from DB may have unexpected types)
  const scan = plan.websiteScan || null;
  const safeLoadTime = typeof scan?.loadTimeMs === 'number' ? scan.loadTimeMs : 0;
  const safeDa = typeof scan?.domainAuthority === 'number' ? scan.domainAuthority : 0;
  const safeTotalPages = typeof scan?.totalPages === 'number' ? scan.totalPages : 0;
  const safeBrokenLinks = typeof scan?.brokenLinks === 'number' ? scan.brokenLinks : 0;

  // ── Compute scores from websiteScan data (plan fields are often 0) ──
  const computedScores = useMemo(() => {
    const scan = plan?.websiteScan;
    if (!scan) return { technical: plan?.technicalScore || 0, visibility: plan?.visibilityScore || 0, overall: plan?.overallScore || 0 };

    // Technical score: based on scan findings
    let tech = 50; // base
    if (scan.hasSSL) tech += 10;
    if (scan.mobileOptimized) tech += 10;
    if (scan.hasRobotsTxt) tech += 5;
    if (scan.hasSitemap) tech += 5;
    if (scan.structuredData) tech += 5;
    if (scan.metaTitle) tech += 5;
    if (scan.metaDescription) tech += 5;
    if (scan.loadTimeMs && scan.loadTimeMs < 3000) tech += 5;
    const issueCount = scan.issues?.length || 0;
    tech = Math.max(0, Math.min(100, tech - issueCount * 3));

    // Visibility score: based on AI queries
    const aiQueries = scan.aiQueries || [];
    const found = aiQueries.filter((q: any) => q.found).length;
    const vis = aiQueries.length > 0 ? Math.round((found / aiQueries.length) * 100) : (plan?.visibilityScore || 0);

    // Overall = weighted average
    const overall = Math.round(tech * 0.4 + vis * 0.6);

    return {
      technical: plan?.technicalScore || tech,
      visibility: plan?.visibilityScore || vis,
      overall: plan?.overallScore || overall,
    };
  }, [plan]);

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <div style={{
      direction: "rtl", background: C.bg, minHeight: "100vh",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 32px" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{
          background: C.card, borderRadius: 24, border: `1px solid ${C.border}`,
          padding: "28px 32px", marginBottom: 24,
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
            {/* Left: info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <button onClick={() => router.push("/seo-geo/dashboard")} style={{
                  width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`,
                  background: "transparent", cursor: "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted,
                }}>→</button>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                }}>🔍</div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
                    {plan.clientName || "תוכנית PIXEL SEO/GEO"}
                  </h1>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 13, color: C.textSecondary }}>🌐 {domain}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 12px", borderRadius: 8,
                      background: `${status.color}15`, color: status.color,
                    }}>{status.label}</span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>נוצר {fmtDate(plan.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: action buttons */}
            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                  background: "transparent", color: C.textSecondary,
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: generatingReport ? "wait" : "pointer",
                  opacity: generatingReport ? 0.6 : 1, transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 13 }}>📄</span> {generatingReport ? "מייצר..." : "הפק דוח PDF"}
              </button>
              {!plan.phases?.length && (
                <button
                  onClick={handleGenerate60DayPlan}
                  disabled={generatingPlan}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                    background: C.primary, color: "#fff",
                    border: "none", borderRadius: 10,
                    fontSize: 12, fontWeight: 600, cursor: generatingPlan ? "wait" : "pointer",
                    opacity: generatingPlan ? 0.6 : 1, transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: 13 }}>📅</span> {generatingPlan ? "מייצר תוכנית..." : "צור תוכנית 60 יום"}
                </button>
              )}
              <button
                onClick={() => router.push(`/seo-geo/${plan.id}/report?lang=he`)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                  background: "transparent", color: C.textSecondary,
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 13 }}>👁️</span> צפה בדוח
              </button>
              <button
                onClick={() => {
                  alert("בקרוב: שלח דוח ותוכנית ללקוח במייל וב-Dashboard");
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                  background: "transparent", color: C.textSecondary,
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 13 }}>📧</span> שלח ללקוח
              </button>
              <button
                onClick={() => {
                  alert("בקרוב: ממשק לייצירת משימה חדשה לתוכנית");
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                  background: C.primary, color: "#fff",
                  border: "none", borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 13 }}>+</span> הוסף משימה
              </button>
            </div>
          </div>
        </div>

        {/* ═══ KPI CARDS ═══ */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 24,
        }}>
          {[
            { label: "GEO Score", value: `${computedScores.visibility}%`, color: C.purple, icon: "🤖", sub: "נראות במנועי AI" },
            { label: "SEO Score", value: `${computedScores.technical}%`, color: C.info, icon: "🔧", sub: "ציון טכני" },
            { label: "AI Visibility", value: `${computedScores.overall}%`, color: C.primary, icon: "📊", sub: "ציון כללי" },
            { label: "Progress", value: `${progress}%`, color: progress >= 60 ? C.success : C.warning, icon: "📈", sub: "התקדמות" },
            { label: "Completed Tasks", value: `${plan.completedTasks || 0}`, color: C.success, icon: "���", sub: `מתוך ${plan.totalTasks || 0}` },
            { label: "Days Remaining", value: `${daysRemaining}`, color: daysRemaining < 15 ? C.danger : C.primary, icon: "⏰", sub: `מתוך 60 יום` },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: C.card, borderRadius: 18, border: `1px solid ${C.border}`,
              padding: "20px 16px", textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              position: "relative", overflow: "hidden",
            }}>
              {/* Subtle top accent line */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: kpi.color, borderRadius: "18px 18px 0 0",
              }} />
              <div style={{ fontSize: 22, marginBottom: 8 }}>{kpi.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* ═══ TABS ═══ */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 24, background: C.card,
          borderRadius: 16, border: `1px solid ${C.border}`, padding: 6,
          boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: "12px 8px",
                background: activeTab === tab.id ? C.primary : "transparent",
                color: activeTab === tab.id ? "#fff" : C.textSecondary,
                border: "none", borderRadius: 12, cursor: "pointer",
                fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
                transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ TAB CONTENT ═══ */}

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Goals */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ ...sectionTitle }}>🎯 יעדים</h3>
              {(plan.goals || []).length === 0 ? (
                <p style={{ fontSize: 13, color: C.textMuted }}>לא הוגדרו יעדים</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.goals.filter(g => g.selected).map(g => (
                    <div key={g.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 12, background: C.bg,
                    }}>
                      <span style={{ fontSize: 22 }}>{g.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{g.label}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>
                          {g.currentValue} → {g.targetValue} {g.targetMetric}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                        background: g.priority === "high" ? `${C.danger}15` : g.priority === "medium" ? `${C.warning}15` : `${C.info}15`,
                        color: g.priority === "high" ? C.danger : g.priority === "medium" ? C.warning : C.info,
                      }}>
                        {g.priority === "high" ? "גבוהה" : g.priority === "medium" ? "בינונית" : "נמוכה"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scan Summary */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ ...sectionTitle }}>🔍 סריקה טכנית</h3>
              {!scan ? (
                <p style={{ fontSize: 13, color: C.textMuted }}>לא בוצעה סריקה</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {[
                    { l: "SSL", v: scan?.hasSSL ? "✓" : "���", ok: scan?.hasSSL },
                    { l: "מהירות", v: `${(safeLoadTime / 1000).toFixed(1)}s`, ok: safeLoadTime < 3000 },
                    { l: "מובייל", v: scan?.mobileOptimized ? "✓" : "✗", ok: scan?.mobileOptimized },
                    { l: "Sitemap", v: scan?.hasSitemap ? "✓" : "✗", ok: scan?.hasSitemap },
                    { l: "Robots", v: scan?.hasRobotsTxt ? "✓" : "✗", ok: scan?.hasRobotsTxt },
                    { l: "DA", v: `${safeDa}`, ok: safeDa > 20 },
                    { l: "דפים", v: `${safeTotalPages}`, ok: true },
                    { l: "שבורים", v: `${safeBrokenLinks}`, ok: safeBrokenLinks === 0 },
                    { l: "Schema", v: scan?.structuredData ? "✓" : "✗", ok: scan?.structuredData },
                  ].map((item, i) => (
                    <div key={i} style={{
                      padding: "10px 12px", borderRadius: 10, background: C.bg,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span style={{ fontSize: 11, color: C.textMuted }}>{item.l}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: item.ok ? C.success : C.danger }}>{item.v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Insights SWOT */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ ...sectionTitle }}>💡 תובנות</h3>
              {(plan.insights || []).length === 0 ? (
                <p style={{ fontSize: 13, color: C.textMuted }}>אין תובנות</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {plan.insights.slice(0, 6).map(ins => {
                    const catConfig: Record<string, { icon: string; color: string }> = {
                      strength: { icon: "💪", color: C.success },
                      opportunity: { icon: "🚀", color: C.primary },
                      weakness: { icon: "⚠️", color: C.warning },
                      threat: { icon: "🛡️", color: C.danger },
                    };
                    const cc = catConfig[ins.category] || catConfig.opportunity;
                    return (
                      <div key={ins.id} style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        padding: "10px 12px", borderRadius: 10, background: `${cc.color}06`,
                        border: `1px solid ${cc.color}18`,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{cc.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{ins.title}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{ins.action}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI Visibility Summary */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ ...sectionTitle }}>🤖 נראות AI</h3>
              <div style={{
                textAlign: "center", padding: "20px 0 16px",
              }}>
                <div style={{
                  fontSize: 48, fontWeight: 800, color: C.primary,
                  background: `linear-gradient(135deg, ${C.primary}, ${C.purple})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  {plan.visibilityScore || 0}%
                </div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>ציון נראות כולל</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                {AI_ENGINES.map(eng => {
                  const total = (plan.visibilityResults || []).length;
                  const mentioned = (plan.visibilityResults || []).filter(vr =>
                    (Array.isArray(vr.results) ? vr.results : []).some(r => r.engine === eng && r.mentioned)
                  ).length;
                  const pct = total > 0 ? Math.round((mentioned / total) * 100) : 0;
                  return (
                    <div key={eng} style={{
                      padding: "8px 14px", borderRadius: 10, background: C.bg,
                      border: `1px solid ${C.borderLight}`, textAlign: "center", minWidth: 80,
                    }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: pct > 50 ? C.success : C.danger }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{eng}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 60-DAY PLAN ── */}
        {activeTab === "plan" && (
          <div>
            {/* Phase + Day structure (new) */}
            {plan.phases && plan.phases.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {plan.phases.map(phase => {
                  const phaseDays = (plan.days || []).filter(d => d.phase === phase.number);
                  const phaseDone = phaseDays.flatMap(d => d.tasks).filter(t => t.status === "done").length;
                  const phaseTotal = phaseDays.flatMap(d => d.tasks).length;
                  const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;

                  return (
                    <div key={phase.number} style={{
                      background: C.card, borderRadius: 20,
                      border: `1px solid ${expandedWeeks.has(phase.number) ? `${C.primary}40` : C.border}`,
                      overflow: "hidden", transition: "border-color 0.2s",
                      boxShadow: expandedWeeks.has(phase.number) ? `0 4px 20px ${C.primary}10` : "0 2px 8px rgba(0,0,0,0.03)",
                    }}>
                      {/* Phase header */}
                      <button onClick={() => {
                        const next = new Set(expandedWeeks);
                        if (next.has(phase.number)) next.delete(phase.number); else next.add(phase.number);
                        setExpandedWeeks(next);
                      }} style={{
                        width: "100%", padding: "18px 24px",
                        display: "flex", alignItems: "center", gap: 16,
                        background: "transparent", border: "none", cursor: "pointer", textAlign: "right",
                      }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                          background: `linear-gradient(135deg, ${C.primary}15, ${C.primary}05)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 20, fontWeight: 800, color: C.primary,
                        }}>{phase.number}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                            שלב {phase.number}: {phase.name}
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                            {phase.focus} · {phaseDone}/{phaseTotal} tasks · Days {phase.days[0]}-{phase.days[1]}
                          </div>
                        </div>
                        {/* Mini progress */}
                        <div style={{ width: 80, textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: phasePct === 100 ? C.success : C.primary }}>{phasePct}%</div>
                          <div style={{
                            height: 4, background: C.borderLight, borderRadius: 2, marginTop: 4, overflow: "hidden",
                          }}>
                            <div style={{
                              height: "100%", width: `${phasePct}%`, borderRadius: 2,
                              background: phasePct === 100 ? C.success : C.primary, transition: "width 0.4s",
                            }} />
                          </div>
                        </div>
                        <span style={{
                          fontSize: 18, color: C.textMuted, transition: "transform 0.2s",
                          transform: expandedWeeks.has(phase.number) ? "rotate(180deg)" : "rotate(0deg)",
                        }}>▾</span>
                      </button>

                      {/* Days within phase */}
                      {expandedWeeks.has(phase.number) && (
                        <div style={{ padding: "0 24px 20px", borderTop: `1px solid ${C.borderLight}` }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 16 }}>
                            {phaseDays.map(day => {
                              const dayDone = day.tasks.filter(t => t.status === "done").length;
                              const dayTotal = day.tasks.length;
                              const dayPct = dayTotal > 0 ? Math.round((dayDone / dayTotal) * 100) : 0;

                              return (
                                <div key={day.day} style={{
                                  padding: "12px 16px", borderRadius: 14, background: C.bg,
                                  border: `1px solid ${C.borderLight}`, marginBottom: 8,
                                }}>
                                  <div style={{
                                    fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8,
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                  }}>
                                    <span>יום {day.day}: {day.theme}</span>
                                    <span style={{ fontSize: 11, color: C.textMuted }}>{dayDone}/{dayTotal} משימות ({dayPct}%)</span>
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {day.tasks.map(task => (
                                      <div key={task.id} style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "10px 12px", borderRadius: 10, background: C.card,
                                        border: `1px solid ${C.borderLight}`,
                                      }}>
                                        {/* Status toggle */}
                                        <select
                                          value={task.status || "todo"}
                                          onChange={e => updateTaskStatus(task.id, e.target.value as PlanTask["status"])}
                                          style={{
                                            padding: "4px 6px", borderRadius: 6, border: `1px solid ${C.border}`,
                                            fontSize: 10, background: C.card, cursor: "pointer", flexShrink: 0,
                                            color: task.status === "done" ? C.success : task.status === "in_progress" ? C.primary : C.textSecondary,
                                          }}
                                        >
                                          {KANBAN_COLS.map(col => (
                                            <option key={col.id} value={col.id}>{col.label}</option>
                                          ))}
                                        </select>

                                        {/* Content */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{
                                            fontSize: 12, fontWeight: 600, color: C.text,
                                            textDecoration: task.status === "done" ? "line-through" : "none",
                                            opacity: task.status === "done" ? 0.6 : 1,
                                          }}>{task.title}</div>
                                        </div>

                                        {/* Impact badge */}
                                        <span style={{
                                          fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, flexShrink: 0,
                                          background: task.priority === "high" ? `${C.danger}15` : task.priority === "medium" ? `${C.warning}15` : `${C.info}15`,
                                          color: task.priority === "high" ? C.danger : task.priority === "medium" ? C.warning : C.info,
                                        }}>
                                          {task.priority === "high" ? "גבוהה" : task.priority === "medium" ? "בינו" : "נמוכה"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (plan.weeks || []).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {plan.weeks.map(week => {
                  const isExpanded = expandedWeeks.has(week.weekNumber);
                  const weekDone = week.tasks.filter(t => t.status === "done").length;
                  const weekTotal = week.tasks.length;
                  const weekPct = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

                  return (
                    <div key={week.weekNumber} style={{
                      background: C.card, borderRadius: 20,
                      border: `1px solid ${isExpanded ? `${C.primary}40` : C.border}`,
                      overflow: "hidden", transition: "border-color 0.2s",
                      boxShadow: isExpanded ? `0 4px 20px ${C.primary}10` : "0 2px 8px rgba(0,0,0,0.03)",
                    }}>
                      {/* Week header */}
                      <button onClick={() => {
                        const next = new Set(expandedWeeks);
                        if (next.has(week.weekNumber)) next.delete(week.weekNumber); else next.add(week.weekNumber);
                        setExpandedWeeks(next);
                      }} style={{
                        width: "100%", padding: "18px 24px",
                        display: "flex", alignItems: "center", gap: 16,
                        background: "transparent", border: "none", cursor: "pointer", textAlign: "right",
                      }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                          background: `linear-gradient(135deg, ${C.primary}15, ${C.primary}05)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 20, fontWeight: 800, color: C.primary,
                        }}>{week.weekNumber}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                            שבוע {week.weekNumber}: {week.theme}
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                            {week.focus} · {weekDone}/{weekTotal} משימות · {fmtDate(week.startDate)} – {fmtDate(week.endDate)}
                          </div>
                        </div>
                        {/* Mini progress */}
                        <div style={{ width: 80, textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: weekPct === 100 ? C.success : C.primary }}>{weekPct}%</div>
                          <div style={{
                            height: 4, background: C.borderLight, borderRadius: 2, marginTop: 4, overflow: "hidden",
                          }}>
                            <div style={{
                              height: "100%", width: `${weekPct}%`, borderRadius: 2,
                              background: weekPct === 100 ? C.success : C.primary, transition: "width 0.4s",
                            }} />
                          </div>
                        </div>
                        <span style={{
                          fontSize: 18, color: C.textMuted, transition: "transform 0.2s",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        }}>▾</span>
                      </button>

                      {/* Tasks */}
                      {isExpanded && (
                        <div style={{ padding: "0 24px 20px", borderTop: `1px solid ${C.borderLight}` }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 16 }}>
                            {week.tasks.map(task => (
                              <div key={task.id} style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "14px 16px", borderRadius: 14, background: C.bg,
                                border: `1px solid ${C.borderLight}`,
                              }}>
                                {/* Status toggle */}
                                <select
                                  value={task.status || "todo"}
                                  onChange={e => updateTaskStatus(task.id, e.target.value as PlanTask["status"])}
                                  style={{
                                    padding: "4px 8px", borderRadius: 8, border: `1px solid ${C.border}`,
                                    fontSize: 11, background: C.card, cursor: "pointer", flexShrink: 0,
                                    color: task.status === "done" ? C.success : task.status === "in_progress" ? C.primary : C.textSecondary,
                                  }}
                                >
                                  {KANBAN_COLS.map(col => (
                                    <option key={col.id} value={col.id}>{col.label}</option>
                                  ))}
                                </select>

                                {/* Priority dot */}
                                <div style={{
                                  width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                                  background: task.priority === "high" ? C.danger : task.priority === "medium" ? C.warning : C.info,
                                }} />

                                {/* Content */}
                                <div style={{ flex: 1 }}>
                                  <div style={{
                                    fontSize: 13, fontWeight: 600, color: C.text,
                                    textDecoration: task.status === "done" ? "line-through" : "none",
                                    opacity: task.status === "done" ? 0.6 : 1,
                                  }}>{task.title}</div>
                                  <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                                    <span style={{ ...tagStyle, background: `${C.primary}10`, color: C.primary }}>
                                      🏷️ {task.category}
                                    </span>
                                    <span style={{ ...tagStyle, background: `${C.warning}10`, color: C.warning }}>
                                      ⏱️ {task.estimatedHours}h
                                    </span>
                                    {task.deliverable && (
                                      <span style={{ ...tagStyle, background: `${C.success}10`, color: C.success }}>
                                        📦 {task.deliverable}
                                      </span>
                                    )}
                                    {task.kpiTarget && (
                                      <span style={{ ...tagStyle, background: `${C.purple}10`, color: C.purple }}>
                                        📊 {task.kpiTarget}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Impact badge */}
                                <span style={{
                                  fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6, flexShrink: 0,
                                  background: task.priority === "high" ? `${C.danger}15` : task.priority === "medium" ? `${C.warning}15` : `${C.info}15`,
                                  color: task.priority === "high" ? C.danger : task.priority === "medium" ? C.warning : C.info,
                                }}>
                                  {task.priority === "high" ? "השפעה גבוהה" : task.priority === "medium" ? "בינונית" : "נמוכה"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                <p style={{ fontSize: 16, color: C.textMuted, marginBottom: 24 }}>אין תוכנית 60 יום עדיין</p>
                <button
                  onClick={handleGenerate60DayPlan}
                  disabled={generatingPlan}
                  style={{
                    padding: "14px 36px",
                    background: `linear-gradient(135deg, ${C.primary}, ${C.purple})`,
                    color: "#fff", border: "none", borderRadius: 14,
                    fontSize: 15, fontWeight: 700, cursor: generatingPlan ? "wait" : "pointer",
                    opacity: generatingPlan ? 0.6 : 1, transition: "all 0.3s",
                    boxShadow: `0 4px 16px ${C.primary}30`,
                  }}
                >
                  {generatingPlan ? "מייצר תוכנית..." : "צור תוכנית 60 יום"}
                </button>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 12 }}>
                  התוכנית תיווצר על בסיס נתוני הסריקה, היעדים והתובנות
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TASKS (KANBAN) ── */}
        {activeTab === "tasks" && (
          <div>
            {allTasks.length === 0 ? (
              <EmptyTab icon="✅" text="אין משימות בתוכנית. צור תוכנית 60 יום כדי ליצור משימות." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "flex-start" }}>
                {KANBAN_COLS.map(col => {
                  const colTasks = allTasks.filter(t => (t.status || "todo") === col.id);
                  return (
                    <div key={col.id} style={{
                      background: C.bg, borderRadius: 20, border: `1px solid ${C.border}`,
                      padding: "16px 14px", minHeight: 300,
                    }}>
                      {/* Column header */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 14, padding: "0 4px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16, color: col.color }}>{col.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{col.label}</span>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 8,
                          background: `${col.color}15`, color: col.color,
                        }}>{colTasks.length}</span>
                      </div>

                      {/* Task cards */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {colTasks.map(task => (
                          <div key={task.id} style={{
                            background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`,
                            padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                          }}>
                            <div style={{
                              fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8,
                              lineHeight: 1.5,
                            }}>{task.title}</div>

                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                              <span style={{ ...tagStyle, background: `${C.primary}10`, color: C.primary }}>{task.category}</span>
                              <span style={{ ...tagStyle, background: `${C.warning}10`, color: C.warning }}>{task.estimatedHours}h</span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 10, color: C.textMuted }}>שבוע {(task as any).weekNumber}</span>
                              <select
                                value={task.status || "todo"}
                                onChange={e => updateTaskStatus(task.id, e.target.value as PlanTask["status"])}
                                style={{
                                  padding: "3px 6px", borderRadius: 6, border: `1px solid ${C.border}`,
                                  fontSize: 10, background: C.card, cursor: "pointer",
                                }}
                              >
                                {KANBAN_COLS.map(c => (
                                  <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                        {colTasks.length === 0 && (
                          <div style={{
                            padding: 24, textAlign: "center", fontSize: 12, color: C.textMuted,
                            border: `2px dashed ${C.borderLight}`, borderRadius: 14,
                          }}>אין משימות</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── AI RESULTS ── */}
        {activeTab === "ai" && (
          <div>
            {(plan.visibilityResults || []).length === 0 ? (
              <EmptyTab icon="🤖" text="אין תוצאות AI. חזור לאשף והרץ סריקת נראות." />
            ) : (
              <>
                {/* Score hero */}
                <div style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.purple})`,
                  borderRadius: 20, padding: 28, marginBottom: 20, color: "#fff",
                  display: "flex", alignItems: "center", gap: 32,
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 52, fontWeight: 800 }}>{plan.visibilityScore || 0}%</div>
                    <div style={{ fontSize: 14, opacity: 0.9 }}>ציון נראות AI</div>
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {AI_ENGINES.map(eng => {
                      const total = plan.visibilityResults.length;
                      const mentioned = plan.visibilityResults.filter(vr =>
                        (Array.isArray(vr.results) ? vr.results : []).some(r => r.engine === eng && r.mentioned)
                      ).length;
                      return (
                        <div key={eng} style={{
                          background: "rgba(255,255,255,0.15)", borderRadius: 12,
                          padding: "12px 18px", textAlign: "center", minWidth: 90,
                          backdropFilter: "blur(8px)",
                        }}>
                          <div style={{ fontSize: 20, fontWeight: 800 }}>{mentioned}/{total}</div>
                          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{eng}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Results table */}
                <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        <th style={thStyle}>שאילתה</th>
                        <th style={thStyle}>קטגוריה</th>
                        <th style={thStyle}>כוונה</th>
                        {AI_ENGINES.map(e => <th key={e} style={{ ...thStyle, textAlign: "center", minWidth: 70 }}>{e}</th>)}
                        <th style={{ ...thStyle, textAlign: "center" }}>פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.visibilityResults.map((vr, i) => {
                        const q = plan.visibilityQueries.find(q => q.id === vr.queryId);
                        return (
                          <tr key={vr.queryId} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                            <td style={tdStyle}>{vr.query}</td>
                            <td style={tdStyle}>
                              <span style={{ ...tagStyle, background: `${C.primary}10`, color: C.primary }}>
                                {q?.category || "—"}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <span style={{ fontSize: 11, color: C.textMuted }}>{q?.intent || "—"}</span>
                            </td>
                            {AI_ENGINES.map(eng => {
                              const res = (Array.isArray(vr.results) ? vr.results : []).find(r => r.engine === eng);
                              return (
                                <td key={eng} style={{ ...tdStyle, textAlign: "center" }}>
                                  <div style={{
                                    width: 28, height: 28, borderRadius: 8, margin: "0 auto",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 14,
                                    background: res?.mentioned ? `${C.success}15` : `${C.danger}10`,
                                    color: res?.mentioned ? C.success : C.danger,
                                  }}>
                                    {res?.mentioned ? "✓" : "✗"}
                                  </div>
                                </td>
                              );
                            })}
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <button onClick={() => setDrawerQuery(vr)} style={{
                                padding: "5px 12px", background: "transparent",
                                border: `1px solid ${C.border}`, borderRadius: 8,
                                fontSize: 11, color: C.primary, cursor: "pointer", fontWeight: 600,
                              }}>פרטים</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Drawer */}
                {drawerQuery && (
                  <div style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    display: "flex", justifyContent: "flex-start",
                  }}>
                    <div onClick={() => setDrawerQuery(null)} style={{
                      flex: 1, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)",
                    }} />
                    <div style={{
                      width: 440, background: C.card, padding: 32,
                      borderRight: `1px solid ${C.border}`, overflowY: "auto",
                      boxShadow: "-8px 0 32px rgba(0,0,0,0.1)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>פרטי שאילתה</h3>
                        <button onClick={() => setDrawerQuery(null)} style={{
                          width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`,
                          background: "transparent", cursor: "pointer", fontSize: 16, color: C.textMuted,
                        }}>×</button>
                      </div>
                      <div style={{
                        padding: "14px 16px", borderRadius: 12, background: C.bg,
                        marginBottom: 20, fontSize: 14, fontWeight: 600, color: C.text,
                      }}>{drawerQuery.query}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {(Array.isArray(drawerQuery.results) ? drawerQuery.results : []).map(r => (
                          <div key={r.engine} style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "14px 16px", borderRadius: 12,
                            background: r.mentioned ? `${C.success}06` : `${C.danger}06`,
                            border: `1px solid ${r.mentioned ? `${C.success}20` : `${C.danger}20`}`,
                          }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: r.mentioned ? `${C.success}15` : `${C.danger}10`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 16, color: r.mentioned ? C.success : C.danger,
                            }}>{r.mentioned ? "✓" : "✗"}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.engine}</div>
                              <div style={{ fontSize: 11, color: C.textMuted }}>
                                {r.mentioned ? `מוזכר · עמדה ${r.position ?? "—"} · ${r.sentiment}` : "לא מוזכר"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── RESULTS & VISIBILITY ── */}
        {activeTab === "results" && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔎</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>תוצאות ונראות</h3>
            <p style={{ color: C.textSecondary, marginBottom: 20, maxWidth: 500, margin: "0 auto 20px" }}>
              צפה בתוצאות מפורטות לפי פלטפורמה — Google SEO, AI Overview, ChatGPT, Gemini, Claude, Perplexity
            </p>
            <button
              onClick={() => router.push(`/seo-geo/${planId}/results`)}
              style={{
                padding: "12px 32px", borderRadius: 10, border: "none", cursor: "pointer",
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                color: "#fff", fontWeight: 600, fontSize: 15,
              }}
            >
              פתח דשבורד תוצאות ונראות →
            </button>
          </div>
        )}

        {/* ── COMPETITORS ── */}
        {activeTab === "competitors" && (
          <EmptyTab icon="🏆" text="ניתוח מתחרים בקרוב. נתונים יאספו מסריקות נראות וחקר מילות מפתח." />
        )}

        {/* ── CONTENT GAPS ── */}
        {activeTab === "gaps" && (
          <EmptyTab icon="📝" text="ניתוח פערי תוכן בקרוב. המערכת תזהה הזדמנויות תוכן בהתאם לחקר מילות מפתח וניתוח מתחרים." />
        )}

        {/* ── REPORTS ── */}
        {activeTab === "reports" && (
          <div style={{ ...cardStyle }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ ...sectionTitle, margin: 0 }}>📄 דוחות</h3>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 24px", background: C.primary, color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: generatingReport ? "wait" : "pointer",
                  opacity: generatingReport ? 0.7 : 1,
                }}
              >
                <span>{generatingReport ? "⏳" : "+"}</span>
                {generatingReport ? "מייצר דוח..." : "הפק דוח חדש"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reports.length > 0 ? reports.map((report) => (
                <div key={report.id} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "16px 20px", borderRadius: 14, background: C.bg,
                  border: `1px solid ${C.borderLight}`,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: `${C.danger}10`, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22,
                  }}>📄</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{report.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {fmtDate(report.generatedAt)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => router.push(`/seo-geo/${plan.id}/report?lang=he`)}
                      style={{ ...smallBtnStyle }}
                    >👁️ צפה</button>
                    <button
                      onClick={() => {
                        router.push(`/seo-geo/${plan.id}/report?lang=he`);
                        // The report viewer page has a print button for PDF export
                      }}
                      style={{ ...smallBtnStyle }}
                    >📥 PDF</button>
                    <button style={{ ...smallBtnStyle }}>📧 שלח</button>
                  </div>
                </div>
              )) : null}

              {/* Empty / hint area */}
              <div style={{
                textAlign: "center", padding: reports.length === 0 ? 48 : 24,
                color: C.textMuted, fontSize: 13,
                border: `2px dashed ${C.borderLight}`, borderRadius: 14,
              }}>
                {reports.length === 0 ? (
                  <>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
                      background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 28,
                    }}>📊</div>
                    <div style={{ fontWeight: 600, color: C.text, fontSize: 15, marginBottom: 6 }}>
                      עדיין לא הופק דוח
                    </div>
                    <div>
                      הפק דוח חדש כדי לשתף עם הלקוח ממצאי סריקה, תוצאות AI ותוכנית פעולה
                    </div>
                    <button
                      onClick={handleGenerateReport}
                      disabled={generatingReport}
                      style={{
                        marginTop: 16, padding: "10px 28px", background: C.primary, color: "#fff",
                        border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        cursor: generatingReport ? "wait" : "pointer",
                      }}
                    >
                      {generatingReport ? "מייצר..." : "הפק דוח ראשון"}
                    </button>
                  </>
                ) : (
                  <>לחץ על &quot;הפק דוח חדש&quot; כדי ליצור דוח מעודכן</>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SHARED STYLES
// ══════════════════════════════════════════════════════════════

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF", borderRadius: 20, border: "1px solid #E8EAF0",
  padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: "#1A1A2E", margin: "0 0 16px 0",
};

const tagStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
  display: "inline-flex", alignItems: "center", gap: 3,
};

const thStyle: React.CSSProperties = {
  padding: "12px 14px", textAlign: "right", fontWeight: 600,
  color: "#9A9AB0", fontSize: 12, borderBottom: "2px solid #E8EAF0",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px", verticalAlign: "middle",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "6px 12px", background: "transparent",
  border: "1px solid #E8EAF0", borderRadius: 8,
  fontSize: 11, color: "#5A5A7A", cursor: "pointer", fontWeight: 500,
};

// ── Empty Tab Component ──
function EmptyTab({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 24, border: "1px solid #E8EAF0",
      padding: "64px 40px", textAlign: "center",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 18, margin: "0 auto 20px",
        background: "#E6F7FF", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36,
      }}>{icon}</div>
      <p style={{ fontSize: 14, color: "#9A9AB0", maxWidth: 420, margin: "0 auto", lineHeight: 1.7 }}>{text}</p>
    </div>
  );
}
