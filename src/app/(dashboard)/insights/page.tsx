"use client";

export const dynamic = "force-dynamic";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  useClients,
  useTasks,
  usePayments,
  useLeads,
  useApprovals,
  useBusinessProjects,
  useCampaigns,
  useSocialPosts,
} from "@/lib/api/use-entity";
import { generateInsights, type AIInsight } from "@/components/ai-insights-panel";

/* ── Priority → visual mapping ── */
const PRIORITY_STYLES: Record<string, { border: string; bg: string; badge: string; label: string }> = {
  high:   { border: "#ef4444", bg: "rgba(239,68,68,0.05)", badge: "rgba(239,68,68,0.14)", label: "דחיפות גבוהה" },
  medium: { border: "#f59e0b", bg: "rgba(245,158,11,0.05)", badge: "rgba(245,158,11,0.14)", label: "דחיפות בינונית" },
  low:    { border: "#22c55e", bg: "rgba(34,197,94,0.05)",  badge: "rgba(34,197,94,0.14)",  label: "הזדמנות" },
};

const CATEGORY_LABELS: Record<string, string> = {
  hot: "דורש טיפול מיידי",
  action: "המלצות פעולה",
  warning: "אזהרות",
  opportunity: "הזדמנויות צמיחה",
};

const CATEGORY_ICONS: Record<string, string> = {
  hot: "🔥",
  action: "⚡",
  warning: "⚠️",
  opportunity: "💡",
};

/* ── System Health Score calculator ── */
function computeHealthScore(data: {
  tasks: any[];
  payments: any[];
  approvals: any[];
  clients: any[];
  leads: any[];
}): { score: number; label: string; color: string; details: string[] } {
  let score = 100;
  const details: string[] = [];
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Deduct for overdue tasks
  const overdueTasks = data.tasks.filter((t: any) => t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "approved");
  if (overdueTasks.length > 0) {
    const deduction = Math.min(overdueTasks.length * 4, 25);
    score -= deduction;
    details.push(`${overdueTasks.length} משימות בפיגור`);
  }

  // Deduct for overdue payments
  const overduePayments = data.payments.filter((p: any) => (p.status === "overdue") || (p.status === "pending" && p.dueDate && p.dueDate < today));
  if (overduePayments.length > 0) {
    const deduction = Math.min(overduePayments.length * 5, 20);
    score -= deduction;
    details.push(`${overduePayments.length} תשלומים בפיגור`);
  }

  // Deduct for pending approvals
  const pendingApprovals = data.approvals.filter((a: any) => a.status === "pending_approval");
  if (pendingApprovals.length > 0) {
    const deduction = Math.min(pendingApprovals.length * 3, 15);
    score -= deduction;
    details.push(`${pendingApprovals.length} אישורים ממתינים`);
  }

  // Deduct for clients without content plan
  const activeClients = data.clients.filter((c: any) => c.status === "active");
  const missingGantt = activeClients.filter((c: any) => !c.monthlyGanttStatus || c.monthlyGanttStatus === "none" || c.monthlyGanttStatus === "draft");
  if (activeClients.length > 0 && missingGantt.length > activeClients.length * 0.5) {
    score -= 10;
    details.push(`${missingGantt.length} לקוחות ללא תוכנית`);
  }

  // Deduct for unhandled leads
  const newLeads = data.leads.filter((l: any) => l.status === "new");
  if (newLeads.length > 5) {
    score -= Math.min(newLeads.length * 2, 10);
    details.push(`${newLeads.length} לידים חדשים ללא טיפול`);
  }

  // Bonus for good task completion
  const completedTasks = data.tasks.filter((t: any) => t.status === "completed");
  if (data.tasks.length > 5 && completedTasks.length / data.tasks.length > 0.7) {
    score = Math.min(score + 5, 100);
  }

  score = Math.max(0, Math.min(100, score));

  const label = score >= 85 ? "מצוין" : score >= 70 ? "טוב" : score >= 50 ? "דורש שיפור" : "דורש טיפול דחוף";
  const color = score >= 85 ? "#22c55e" : score >= 70 ? "#38bdf8" : score >= 50 ? "#f59e0b" : "#ef4444";

  if (details.length === 0) details.push("כל המערכות תקינות");

  return { score, label, color, details };
}

/* ── Health Ring SVG ── */
function HealthRing({ score, color, size = 120 }: { score: number; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border, #e5e7eb)" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s ease-out" }}
      />
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fontSize="1.75rem" fontWeight="800" fill={color}>
        {score}
      </text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize="0.65rem" fontWeight="600" fill="var(--foreground-muted)">
        מתוך 100
      </text>
    </svg>
  );
}

/* ── Time-aware greeting ── */
function getTimeContext(): string {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  if (day === 5) return "סוף שבוע מתקרב — סגור מה שצריך לפני שישי";
  if (day === 0) return "תחילת שבוע — זה הזמן לתכנן ולתעדף";
  if (hour < 12) return "בוקר טוב — הנה הסקירה המעודכנת שלך";
  if (hour < 17) return "צהריים טובים — מה דורש תשומת לב עכשיו";
  return "ערב טוב — סיכום היום שלך";
}

export default function InsightsPage() {
  const { data: clients, loading: loadingClients } = useClients();
  const { data: tasks, loading: loadingTasks } = useTasks();
  const { data: payments, loading: loadingPayments } = usePayments();
  const { data: leads, loading: loadingLeads } = useLeads();
  const { data: approvals, loading: loadingApprovals } = useApprovals();
  const { data: projects, loading: loadingProjects } = useBusinessProjects();
  const { data: campaigns, loading: loadingCampaigns } = useCampaigns();
  const { data: socialPosts, loading: loadingSocial } = useSocialPosts();

  const loading = loadingClients || loadingTasks || loadingPayments || loadingLeads || loadingApprovals || loadingProjects || loadingCampaigns || loadingSocial;

  // Smart AI insights from the centralized engine
  const insights = useMemo<AIInsight[]>(() => {
    if (loading) return [];
    return generateInsights({ tasks, clients, approvals, payments, campaigns, socialPosts });
  }, [loading, tasks, clients, approvals, payments, campaigns, socialPosts]);

  // System health score
  const health = useMemo(() => {
    if (loading) return { score: 0, label: "טוען...", color: "#6b7280", details: [] };
    return computeHealthScore({ tasks, payments, approvals, clients, leads });
  }, [loading, tasks, payments, approvals, clients, leads]);

  // Group insights by category
  const grouped = useMemo(() => {
    const groups: Record<string, AIInsight[]> = {};
    const order = ["hot", "action", "warning", "opportunity"];
    insights.forEach(i => {
      if (!groups[i.category]) groups[i.category] = [];
      groups[i.category].push(i);
    });
    return order.filter(k => groups[k]?.length > 0).map(k => ({ key: k, items: groups[k] }));
  }, [insights]);

  const highCount = insights.filter(i => i.priority === "high").length;
  const mediumCount = insights.filter(i => i.priority === "medium").length;
  const timeContext = getTimeContext();

  // AI top recommendation — the single most important thing to act on
  const topAction = insights.find(i => i.priority === "high" && i.actionHref) || insights.find(i => i.actionHref);

  return (
    <div dir="rtl" style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* ═══ HEADER ═══ */}
      <div style={{ marginBottom: "2rem", borderBottom: "1px solid var(--border)", paddingBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)", fontWeight: 600 }}>מנוע AI פעיל — ניתוח בזמן אמת</span>
        </div>
        <h1 className="mod-page-title">תובנות ומצב מערכת</h1>
        <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
          {timeContext} — {insights.length} תובנות
          {highCount > 0 && <span style={{ color: "#ef4444", marginRight: "0.5rem" }}> | {highCount} דחופות</span>}
          {mediumCount > 0 && <span style={{ color: "#f59e0b", marginRight: "0.5rem" }}> | {mediumCount} לתשומת לב</span>}
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--foreground-muted)" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🧠</div>
          מנתח נתונים ובונה תובנות...
        </div>
      ) : (
        <>
          {/* ═══ HEALTH SCORE + TOP ACTION ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1.5rem", marginBottom: "2rem", alignItems: "center" }}>
            {/* Health Ring */}
            <div className="premium-card" style={{ padding: "1.5rem 2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
              <HealthRing score={health.score} color={health.color} />
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: health.color }}>{health.label}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", textAlign: "center", maxWidth: "160px", lineHeight: 1.5 }}>
                {health.details.slice(0, 2).join(" · ")}
              </div>
            </div>

            {/* Right side: AI summary + top action */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* AI Summary bar */}
              <div style={{
                background: "linear-gradient(135deg, rgba(56,189,248,0.06), rgba(139,92,246,0.06))",
                border: "1px solid rgba(56,189,248,0.12)", borderRadius: "0.75rem",
                padding: "1.25rem 1.5rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <span className="ai-badge" style={{ fontSize: "0.6rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "999px", background: "rgba(56,189,248,0.15)", color: "#38bdf8" }}>✨ AI</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>סיכום מצב</span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)", lineHeight: 1.7, margin: 0 }}>
                  {health.score >= 85
                    ? `המערכת במצב מצוין. ${insights.length > 0 ? `יש ${insights.length} תובנות לשיפור, אך אין דבר דחוף.` : "אין תובנות חריגות — המשך בקצב הנוכחי."}`
                    : health.score >= 70
                    ? `מצב כללי טוב, עם ${highCount > 0 ? `${highCount} נושאים דחופים` : "מספר נושאים"} שדורשים תשומת לב. טפל בהם כדי לשמור על קצב.`
                    : health.score >= 50
                    ? `המערכת פועלת אך יש ${highCount} בעיות שדורשות טיפול מיידי. ${health.details[0]}. התחל מהדחוף ביותר.`
                    : `מצב קריטי — ${health.details.slice(0, 2).join(" + ")}. יש לטפל בנושאים הדחופים מיד כדי למנוע נזק תפעולי.`
                  }
                </p>
              </div>

              {/* Top action recommendation */}
              {topAction && (
                <Link href={topAction.actionHref || "#"} style={{ textDecoration: "none" }}>
                  <div className="premium-card" style={{
                    padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem",
                    borderRight: `4px solid ${PRIORITY_STYLES[topAction.priority]?.border || "#38bdf8"}`,
                    background: PRIORITY_STYLES[topAction.priority]?.bg || "transparent",
                    cursor: "pointer",
                  }}>
                    <span style={{ fontSize: "1.25rem" }}>{topAction.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: PRIORITY_STYLES[topAction.priority]?.border || "#38bdf8", marginBottom: "0.15rem" }}>
                        ✨ AI ממליץ לטפל עכשיו
                      </div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>{topAction.title}</div>
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: PRIORITY_STYLES[topAction.priority]?.border || "#38bdf8" }}>
                      {topAction.actionText} ←
                    </span>
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* ═══ INSIGHTS BY CATEGORY ═══ */}
          {grouped.length === 0 ? (
            <div className="premium-card" style={{ textAlign: "center", padding: "3rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
              <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>הכל תקין — המערכת פועלת חלק</div>
              <div style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>
                אין תובנות חריגות כרגע. ככל שתוסיף נתונים, התובנות יהפכו מפורטות ומדויקות יותר.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {grouped.map(group => (
                <div key={group.key}>
                  {/* Category header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    marginBottom: "1rem", paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--border)",
                  }}>
                    <span style={{ fontSize: "1rem" }}>{CATEGORY_ICONS[group.key] || "📌"}</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>{CATEGORY_LABELS[group.key] || group.key}</span>
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 600, padding: "0.15rem 0.5rem",
                      borderRadius: "999px", background: "var(--background-muted, rgba(0,0,0,0.05))",
                      color: "var(--foreground-muted)",
                    }}>
                      {group.items.length}
                    </span>
                  </div>

                  {/* Insight cards grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
                    {group.items.map(insight => {
                      const ps = PRIORITY_STYLES[insight.priority] || PRIORITY_STYLES.medium;
                      return (
                        <div
                          key={insight.id}
                          className="premium-card"
                          style={{
                            padding: "1.25rem 1.5rem",
                            borderRight: `4px solid ${ps.border}`,
                            background: ps.bg,
                            cursor: insight.actionHref ? "pointer" : "default",
                            transition: "transform 150ms ease, box-shadow 150ms ease",
                          }}
                          onClick={() => insight.actionHref && (window.location.href = insight.actionHref)}
                          onMouseEnter={e => { if (insight.actionHref) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
                            <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{insight.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: "0.92rem", marginBottom: "0.25rem" }}>{insight.title}</div>
                              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                                <span style={{
                                  display: "inline-block", padding: "0.1rem 0.5rem", fontSize: "0.6rem",
                                  fontWeight: 600, borderRadius: "999px", background: ps.badge, color: ps.border,
                                }}>
                                  {ps.label}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)", lineHeight: 1.65, margin: 0 }}>
                            {insight.description}
                          </p>
                          {insight.actionText && insight.actionHref && (
                            <div style={{ marginTop: "0.75rem" }}>
                              <Link href={insight.actionHref} style={{
                                fontSize: "0.72rem", fontWeight: 700, color: ps.border, textDecoration: "none",
                              }}>
                                {insight.actionText} ←
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ SYSTEM PULSE FOOTER ═══ */}
          <div style={{
            marginTop: "2.5rem", padding: "1rem 1.5rem", borderRadius: "0.75rem",
            background: "var(--background-muted, rgba(0,0,0,0.02))", border: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
              <span style={{ fontSize: "0.72rem", color: "var(--foreground-muted)" }}>
                עודכן לאחרונה: {new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <Link href="/stats" style={{ fontSize: "0.72rem", color: "var(--accent, #38bdf8)", textDecoration: "none", fontWeight: 600 }}>
                📊 סטטיסטיקות מלאות
              </Link>
              <Link href="/dashboard" style={{ fontSize: "0.72rem", color: "var(--accent, #38bdf8)", textDecoration: "none", fontWeight: 600 }}>
                🏠 חזרה לדשבורד
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
