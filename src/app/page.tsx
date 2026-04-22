'use client';

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  useTasks,
  useApprovals,
  usePayments,
  useLeads,
  useClients,
  useClientGanttItems,
  useEmployees,
} from "@/lib/api/use-entity";

export default function LandingPage() {
  const { data: tasks } = useTasks();
  const { data: approvals } = useApprovals();
  const { data: payments } = usePayments();
  const { data: leads } = useLeads();
  const { data: clients } = useClients();
  const { data: ganttItems } = useClientGanttItems();

  const [mounted, setMounted] = useState(false);
  const [actionableItems, setActionableItems] = useState<any[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);


  // Compute actionable items from all data sources
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const items: any[] = [];

    // 1. Overdue tasks
    tasks.forEach((task) => {
      if (task.dueDate && new Date(task.dueDate) < today && !['completed', 'approved'].includes(task.status)) {
        items.push({
          id: task.id, type: 'task', title: task.title,
          clientName: task.clientName || 'כללי', dueDate: task.dueDate,
          urgency: 'overdue', link: '/tasks', icon: '🔥',
        });
      }
    });

    // 2. Tasks due today
    tasks.forEach((task) => {
      if (task.dueDate) {
        const taskDate = new Date(task.dueDate);
        taskDate.setHours(0, 0, 0, 0);
        if (taskDate.getTime() === today.getTime() && !['completed', 'approved'].includes(task.status)) {
          items.push({
            id: task.id, type: 'task', title: task.title,
            clientName: task.clientName || 'כללי', dueDate: task.dueDate,
            urgency: 'today', link: '/tasks', icon: '📌',
          });
        }
      }
    });

    // 3. Tasks under review
    tasks.forEach((task) => {
      if (task.status === 'under_review') {
        items.push({
          id: task.id, type: 'task', title: task.title,
          clientName: task.clientName || 'כללי', dueDate: task.dueDate,
          urgency: 'review', link: '/tasks', icon: '👁️',
        });
      }
    });

    // 4. Pending approvals
    approvals.forEach((approval) => {
      if (approval.status === 'pending_client' || approval.status === 'pending') {
        items.push({
          id: approval.id, type: 'approval', title: approval.title || 'אישור ממתין',
          clientName: approval.clientName || 'כללי', dueDate: approval.deadline,
          urgency: 'pending', link: '/approvals', icon: '✅',
        });
      }
      if (approval.status === 'returned') {
        items.push({
          id: approval.id, type: 'approval', title: approval.title || 'אישור הוחזר',
          clientName: approval.clientName || 'כללי', dueDate: approval.deadline,
          urgency: 'returned', link: '/approvals', icon: '🔁',
        });
      }
    });

    // 5. Upcoming gantt deadlines
    ganttItems.forEach((item) => {
      if (item.endDate) {
        const endDate = new Date(item.endDate);
        endDate.setHours(0, 0, 0, 0);
        if (endDate.getTime() === today.getTime() && item.status !== 'approved') {
          items.push({
            id: item.id, type: 'gantt', title: item.taskName || 'משימת גאנט',
            clientName: item.clientName || 'לקוח', dueDate: item.endDate,
            urgency: 'today', link: `/clients/${item.clientId}`, icon: '📋',
          });
        }
      }
    });

    // 6. Overdue payments
    payments.forEach((payment) => {
      if (payment.dueDate && new Date(payment.dueDate) < today && payment.status !== 'paid') {
        items.push({
          id: payment.id, type: 'payment', title: `תשלום — ${payment.clientName || 'לקוח'}`,
          clientName: payment.clientName || '', dueDate: payment.dueDate,
          urgency: 'overdue', link: '/accounting/payments', icon: '💰',
        });
      }
    });

    // 7. Follow-ups due today
    leads.forEach((lead) => {
      if (lead.followUpAt) {
        const followUpDate = new Date(lead.followUpAt);
        followUpDate.setHours(0, 0, 0, 0);
        if (followUpDate.getTime() === today.getTime()) {
          items.push({
            id: lead.id, type: 'lead', title: lead.fullName || lead.name,
            clientName: lead.company || 'ללא חברה', dueDate: lead.followUpAt,
            urgency: 'today', link: '/leads', icon: '📞',
          });
        }
      }
    });

    // 8. Clients without approved gantt
    clients.forEach((client) => {
      if (client.monthlyGanttStatus !== 'approved') {
        items.push({
          id: client.id, type: 'client',
          title: `${client.name} - דורש אישור תוכנית חודשית`,
          clientName: client.name, dueDate: null,
          urgency: 'pending', link: `/clients/${client.id}`, icon: '📅',
        });
      }
    });

    const sortOrder = { overdue: 0, today: 1, review: 2, returned: 3, pending: 4, upcoming: 5 };
    items.sort((a, b) => {
      const orderDiff = (sortOrder[a.urgency as keyof typeof sortOrder] || 5) - (sortOrder[b.urgency as keyof typeof sortOrder] || 5);
      if (orderDiff !== 0) return orderDiff;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      return 0;
    });

    setActionableItems(items.slice(0, 6));
  }, [tasks, approvals, payments, leads, clients, ganttItems]);

  return (
    <div className="landing" ref={heroRef}>



      {/* ── LEFT: branding + content stack ── */}
      <div className="landing-content">
        {/* Logo */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.625rem", marginBottom: "1.75rem",
          animation: mounted ? 'ux-hero-reveal 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none',
          opacity: mounted ? undefined : 0,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://s-pixel.co.il/wp-content/uploads/2026/04/Asset-1.png"
            alt="PixelFrameAI"
            style={{ display: "block", height: 36, width: "auto", objectFit: "contain", filter: "var(--logo-filter, none)" }}
          />
          <span className="brand-lockup-name">PixelFrameAI</span>
        </div>

        {/* Main title */}
        <h1 style={{
          animation: mounted ? 'portalFadeUp 0.7s ease-out 0.15s forwards' : 'none',
          opacity: mounted ? undefined : 0,
        }}>
          סטודיו פיקסל פרסום ומיתוג עסקי
        </h1>

        {/* Supporting text */}
        <p style={{
          animation: mounted ? 'portalFadeUp 0.7s ease-out 0.3s forwards' : 'none',
          opacity: mounted ? undefined : 0,
        }}>
          מערכת ניהול המשרד המשולבת בטכנולוגיות AI בפיתוח אישי
        </p>

        {/* Feature pills — upgraded with glow */}
        <div style={{
          display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end", marginTop: "1.375rem",
          animation: mounted ? 'portalFadeUp 0.7s ease-out 0.45s forwards' : 'none',
          opacity: mounted ? undefined : 0,
        }}>
          {["✂ עריכה חכמה", "🎬 תוכנית פלט", "📊 ניתוח AI", "🌐 עברית מובנית"].map((f, i) => (
            <span
              key={f}
              className="ux-chip landing-chip"
              style={{
                whiteSpace: "nowrap",
                animationDelay: `${0.5 + i * 0.08}s`,
                transition: "all 200ms ease",
              }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* AI status hint */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "1.25rem", justifyContent: "flex-end",
          animation: mounted ? 'portalFadeUp 0.7s ease-out 0.6s forwards' : 'none',
          opacity: mounted ? undefined : 0,
        }}>
          <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
            AI מערכת פעילה
          </span>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 8px rgba(34,197,94,0.5)',
            animation: 'la-blink 2s infinite',
          }} />
        </div>

        {/* CTAs — upgraded with beam effect */}
        <div className="ctas" style={{
          animation: mounted ? 'portalFadeUp 0.7s ease-out 0.65s forwards' : 'none',
          opacity: mounted ? undefined : 0,
        }}>
          <Link href="/dashboard" className="btn btn-landing-primary btn-lg ux-light-sweep">
            דשבורד הניהול
          </Link>
          <Link href="/command-center" className="btn btn-landing-ghost btn-lg ux-light-sweep">
            מרכז הפיקוד
          </Link>
        </div>

        <p className="landing-byline" style={{
          animation: mounted ? 'portalFadeUp 0.7s ease-out 0.8s forwards' : 'none',
          opacity: mounted ? undefined : 0,
        }}>
          by Studio Pixel
        </p>
      </div>

      {/* ── RIGHT: dominant hero image ── */}
      <div className="landing-image-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://s-pixel.co.il/wp-content/uploads/2025/12/Layer-47.png"
          alt="PixelFrameAI interface"
          className="landing-hero-img"
          loading="eager"
        />
      </div>

      {/* ── OVERLAY: Tasks to Handle widget ── */}
      <div className="landing-activity" style={{
        animation: mounted ? 'portalFadeUp 0.7s ease-out 0.4s forwards' : 'none',
        opacity: mounted ? undefined : 0,
      }}>
        <div className="la-panel" style={{ direction: 'rtl', textAlign: 'right' }}>
          <div className="la-head">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: 'flex-end' }}>
              <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--foreground)" }}>משימות לטיפול</span>
              <span className="la-pulse" />
            </div>
          </div>
          <div className="la-feed">
            {actionableItems.length > 0
              ? actionableItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.link}
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div
                      className="la-item ux-light-sweep"
                      style={{ cursor: "pointer" }}
                    >
                      <div className="la-item-icon">{item.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="la-item-title">{item.title}</div>
                        <div className="la-item-sub">{item.clientName}</div>
                      </div>
                      {item.urgency === 'overdue' && (
                        <span style={{
                          fontSize: '0.55rem', fontWeight: 700, padding: '0.1rem 0.35rem',
                          borderRadius: '0.2rem', background: 'rgba(239,68,68,0.2)', color: '#ef4444',
                          flexShrink: 0, alignSelf: 'center',
                        }}>
                          באיחור
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              : (
                  <div style={{
                    padding: "1.5rem 1rem", textAlign: "center",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                  }}>
                    <span style={{ fontSize: "1.5rem", opacity: 0.5 }}>✅</span>
                    <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 500 }}>
                      אין משימות דחופות
                    </span>
                    <span style={{ color: "var(--foreground-subtle)", fontSize: "0.7rem" }}>
                      המערכת שקטה — הכל תקין
                    </span>
                  </div>
                )
            }
          </div>
          <div className="la-foot" style={{ justifyContent: 'space-between', direction: 'rtl' }}>
            <Link
              href="/tasks"
              style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", textDecoration: "none" }}
            >
              ← צפה בהכל
            </Link>
            <span style={{ fontSize: "0.7rem", color: "var(--foreground-subtle)" }}>
              {actionableItems.length} משימות דחופות
            </span>
          </div>
        </div>
      </div>

      <style>{`
  @keyframes portalFadeUp {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
`}</style>
    </div>
  );
}
