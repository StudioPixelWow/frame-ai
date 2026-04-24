"use client";

export const dynamic = "force-dynamic";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useClients,
  useTasks,
  usePayments,
  useLeads,
  useApprovals,
  useBusinessProjects,
} from "@/lib/api/use-entity";

interface Insight {
  id: string;
  icon: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "success" | "alert";
  category: string;
  link?: string;
}

const SEVERITY_STYLES: Record<string, { border: string; bg: string; badge: string }> = {
  alert:   { border: "#f87171", bg: "rgba(248,113,113,0.06)", badge: "rgba(248,113,113,0.15)" },
  warning: { border: "#fbbf24", bg: "rgba(251,191,36,0.06)",  badge: "rgba(251,191,36,0.15)" },
  success: { border: "#22c55e", bg: "rgba(34,197,94,0.06)",   badge: "rgba(34,197,94,0.15)" },
  info:    { border: "#38bdf8", bg: "rgba(56,189,248,0.06)",  badge: "rgba(56,189,248,0.15)" },
};

const SEVERITY_LABELS: Record<string, string> = {
  alert: "דורש טיפול",
  warning: "שים לב",
  success: "חיובי",
  info: "מידע",
};

export default function InsightsPage() {
  const { data: clients, loading: loadingClients } = useClients();
  const { data: tasks, loading: loadingTasks } = useTasks();
  const { data: payments, loading: loadingPayments } = usePayments();
  const { data: leads, loading: loadingLeads } = useLeads();
  const { data: approvals, loading: loadingApprovals } = useApprovals();
  const { data: projects, loading: loadingProjects } = useBusinessProjects();
  const router = useRouter();

  const loading = loadingClients || loadingTasks || loadingPayments || loadingLeads || loadingApprovals || loadingProjects;

  const insights = useMemo<Insight[]>(() => {
    if (loading) return [];

    const result: Insight[] = [];
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // --- Client insights ---
    const activeClients = clients.filter(c => c.status === "active");
    const pausedClients = clients.filter(c => c.status === "paused");
    const portalClients = activeClients.filter(c => c.portalEnabled);

    if (pausedClients.length > 0) {
      result.push({
        id: "paused-clients",
        icon: "⏸️",
        title: "לקוחות מושהים",
        body: `יש ${pausedClients.length} לקוחות במצב מושהה. כדאי לבדוק אם ניתן להחזירם לפעילות או לסגור.`,
        severity: "warning",
        category: "לקוחות",
        link: "/clients",
      });
    }

    if (activeClients.length > 0 && portalClients.length === 0) {
      result.push({
        id: "no-portal",
        icon: "🌐",
        title: "אף לקוח ללא פורטל",
        body: `מתוך ${activeClients.length} לקוחות פעילים, אף אחד לא מחובר לפורטל. הפעלת פורטל משפרת שקיפות ותקשורת.`,
        severity: "info",
        category: "לקוחות",
        link: "/portal",
      });
    } else if (portalClients.length > 0 && portalClients.length < activeClients.length * 0.5) {
      result.push({
        id: "low-portal",
        icon: "🌐",
        title: "שימוש נמוך בפורטל",
        body: `רק ${portalClients.length} מתוך ${activeClients.length} לקוחות פעילים מחוברים לפורטל (${Math.round(portalClients.length / activeClients.length * 100)}%).`,
        severity: "info",
        category: "לקוחות",
        link: "/portal",
      });
    }

    // --- Task insights ---
    const overdueTasks = tasks.filter(t => {
      if (t.status === "completed") return false;
      return t.dueDate && t.dueDate < today;
    });
    const urgentTasks = tasks.filter(t => t.priority === "urgent" && t.status !== "done" && t.status !== "cancelled");

    if (overdueTasks.length > 0) {
      result.push({
        id: "overdue-tasks",
        icon: "🔴",
        title: "משימות באיחור",
        body: `${overdueTasks.length} משימות עברו את תאריך היעד שלהן. כדאי לטפל בהן בהקדם או לעדכן את הדדליין.`,
        severity: "alert",
        category: "משימות",
        link: "/tasks",
      });
    }

    if (urgentTasks.length > 0) {
      result.push({
        id: "urgent-tasks",
        icon: "⚡",
        title: "משימות דחופות פתוחות",
        body: `${urgentTasks.length} משימות מסומנות כדחופות וטרם הושלמו. ודא שהן מקבלות עדיפות.`,
        severity: "warning",
        category: "משימות",
        link: "/tasks",
      });
    }

    const doneTasks = tasks.filter(t => t.status === "completed");
    const totalTasks = tasks.length;
    if (totalTasks > 5) {
      const completionRate = Math.round((doneTasks.length / totalTasks) * 100);
      if (completionRate > 80) {
        result.push({
          id: "high-completion",
          icon: "🏆",
          title: "אחוז השלמה גבוה",
          body: `${completionRate}% מהמשימות הושלמו. קצב ביצוע מצוין!`,
          severity: "success",
          category: "משימות",
        });
      } else if (completionRate < 40) {
        result.push({
          id: "low-completion",
          icon: "📋",
          title: "אחוז השלמה נמוך",
          body: `רק ${completionRate}% מהמשימות הושלמו (${doneTasks.length} מתוך ${totalTasks}). ייתכן שיש צורך בתעדוף מחדש.`,
          severity: "warning",
          category: "משימות",
        });
      }
    }

    // --- Payment insights ---
    const overduePayments = payments.filter(p => {
      if (p.status === "paid") return false;
      return p.dueDate && p.dueDate < today;
    });

    if (overduePayments.length > 0) {
      const totalOverdue = overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      result.push({
        id: "overdue-payments",
        icon: "💰",
        title: "תשלומים באיחור",
        body: `${overduePayments.length} תשלומים באיחור בסך ${totalOverdue.toLocaleString()} ש"ח. כדאי לשלוח תזכורות גביה.`,
        severity: "alert",
        category: "כספים",
        link: "/payments",
      });
    }

    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthPaid = payments.filter(p => p.status === "paid" && p.paidAt?.startsWith(thisMonth));
    if (thisMonthPaid.length > 0) {
      const monthTotal = thisMonthPaid.reduce((sum, p) => sum + (p.amount || 0), 0);
      result.push({
        id: "month-revenue",
        icon: "📊",
        title: "הכנסות החודש",
        body: `${thisMonthPaid.length} תשלומים התקבלו החודש בסך ${monthTotal.toLocaleString()} ש"ח.`,
        severity: "success",
        category: "כספים",
        link: "/payments",
      });
    }

    // --- Lead insights ---
    const newLeads = leads.filter(l => l.status === "new");
    const contactedLeads = leads.filter(l => l.status === "contacted");

    if (newLeads.length > 3) {
      result.push({
        id: "unhandled-leads",
        icon: "📥",
        title: "לידים חדשים ממתינים",
        body: `${newLeads.length} לידים חדשים טרם טופלו. זמן תגובה מהיר מעלה את סיכויי ההמרה.`,
        severity: "warning",
        category: "לידים",
        link: "/leads",
      });
    }

    if (leads.length > 10) {
      const converted = leads.filter(l => l.status === "converted");
      const convRate = Math.round((converted.length / leads.length) * 100);
      result.push({
        id: "lead-conversion",
        icon: "🎯",
        title: "יחס המרה לידים",
        body: `${convRate}% מהלידים הומרו ללקוחות (${converted.length} מתוך ${leads.length}).`,
        severity: convRate > 30 ? "success" : convRate > 15 ? "info" : "warning",
        category: "לידים",
        link: "/leads",
      });
    }

    // --- Approval insights ---
    const pendingApprovals = approvals.filter(a => a.status === "pending_approval");
    const needsChanges = approvals.filter(a => a.status === "needs_changes");

    if (pendingApprovals.length > 0) {
      result.push({
        id: "pending-approvals",
        icon: "✋",
        title: "אישורים ממתינים",
        body: `${pendingApprovals.length} פריטים ממתינים לאישור. עיכוב באישורים מעכב את כל הצוות.`,
        severity: pendingApprovals.length > 5 ? "alert" : "warning",
        category: "אישורים",
        link: "/approvals",
      });
    }

    if (needsChanges.length > 0) {
      result.push({
        id: "needs-changes",
        icon: "🔄",
        title: "דורש תיקונים",
        body: `${needsChanges.length} פריטים סומנו כ"דורש שינויים". כדאי לטפל ולשלוח מחדש.`,
        severity: "warning",
        category: "אישורים",
        link: "/approvals",
      });
    }

    // --- Project insights ---
    const activeProjects = projects.filter(p => p.projectStatus === "in_progress");
    if (activeProjects.length > 0) {
      result.push({
        id: "active-projects",
        icon: "🚀",
        title: "פרויקטים פעילים",
        body: `${activeProjects.length} פרויקטים עסקיים פעילים כרגע. ודא שכולם מתקדמים לפי לו"ז.`,
        severity: "info",
        category: "פרויקטים",
        link: "/business-projects",
      });
    }

    // --- Overall health ---
    if (result.length === 0) {
      result.push({
        id: "all-clear",
        icon: "✅",
        title: "הכל תקין",
        body: "אין תובנות מיוחדות כרגע. המערכת פועלת כסדרה.",
        severity: "success",
        category: "כללי",
      });
    }

    // Sort: alerts first, then warnings, then info, then success
    const order: Record<string, number> = { alert: 0, warning: 1, info: 2, success: 3 };
    result.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

    return result;
  }, [loading, clients, tasks, payments, leads, approvals, projects]);

  const alertCount = insights.filter(i => i.severity === "alert").length;
  const warningCount = insights.filter(i => i.severity === "warning").length;

  return (
    <div dir="rtl" style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem" }}>
        <div>
          <h1 className="mod-page-title">תובנות ומצב מערכת</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
            סקירה חכמה של הנתונים שלך — {insights.length} תובנות
            {alertCount > 0 && <span style={{ color: "#f87171", marginRight: "0.5rem" }}> | {alertCount} דורשים טיפול</span>}
            {warningCount > 0 && <span style={{ color: "#fbbf24", marginRight: "0.5rem" }}> | {warningCount} שים לב</span>}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--foreground-muted)" }}>מנתח נתונים...</div>
      ) : insights.length === 0 ? (
        <div className="mod-empty ux-empty-state" style={{ minHeight: "300px" }}>
          <div className="mod-empty-icon ux-empty-state-icon">🧠</div>
          <div className="ux-empty-state-title" style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            אין מספיק נתונים לתובנות
          </div>
          <div className="ux-empty-state-text" style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
            ככל שתוסיף לקוחות, משימות ופרויקטים — תובנות יופיעו כאן
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
          {insights.map(insight => {
            const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
            return (
              <div
                key={insight.id}
                className="agd-card premium-card"
                onClick={() => insight.link && router.push(insight.link)}
                style={{
                  padding: "1.25rem 1.5rem",
                  cursor: insight.link ? "pointer" : "default",
                  borderRight: `4px solid ${style.border}`,
                  background: style.bg,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>{insight.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{insight.title}</div>
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.25rem" }}>
                      <span style={{
                        display: "inline-block", padding: "0.1rem 0.5rem", fontSize: "0.65rem",
                        fontWeight: 600, borderRadius: "999px", background: style.badge, color: style.border,
                      }}>
                        {SEVERITY_LABELS[insight.severity]}
                      </span>
                      <span style={{
                        display: "inline-block", padding: "0.1rem 0.5rem", fontSize: "0.65rem",
                        fontWeight: 500, borderRadius: "999px", background: "var(--background-muted, rgba(0,0,0,0.05))",
                        color: "var(--foreground-muted)",
                      }}>
                        {insight.category}
                      </span>
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: 1.6, margin: 0 }}>
                  {insight.body}
                </p>
                {insight.link && (
                  <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: style.border, fontWeight: 600 }}>
                    לחץ לפרטים &larr;
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
