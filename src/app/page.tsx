'use client';

import Link from "next/link";
import { useState, useEffect } from "react";
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
          id: task.id,
          type: 'task',
          title: task.title,
          clientName: task.clientName || 'כללי',
          dueDate: task.dueDate,
          urgency: 'overdue',
          link: '/tasks',
          icon: '🔥',
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
            id: task.id,
            type: 'task',
            title: task.title,
            clientName: task.clientName || 'כללי',
            dueDate: task.dueDate,
            urgency: 'today',
            link: '/tasks',
            icon: '📌',
          });
        }
      }
    });

    // 3. Tasks under review
    tasks.forEach((task) => {
      if (task.status === 'under_review') {
        items.push({
          id: task.id,
          type: 'task',
          title: task.title,
          clientName: task.clientName || 'כללי',
          dueDate: task.dueDate,
          urgency: 'review',
          link: '/tasks',
          icon: '👀',
        });
      }
    });

    // 4. Returned tasks
    tasks.forEach((task) => {
      if (task.status === 'returned') {
        items.push({
          id: task.id,
          type: 'task',
          title: task.title,
          clientName: task.clientName || 'כללי',
          dueDate: task.dueDate,
          urgency: 'returned',
          link: '/tasks',
          icon: '↩️',
        });
      }
    });

    // 5. Pending approvals
    approvals.forEach((approval) => {
      if (approval.status === 'pending_approval') {
        items.push({
          id: approval.id,
          type: 'approval',
          title: approval.title,
          clientName: approval.clientName,
          dueDate: approval.createdAt,
          urgency: 'pending',
          link: '/approvals',
          icon: '✋',
        });
      }
    });

    // 6. Overdue payments
    payments.forEach((payment) => {
      if (payment.status === 'overdue') {
        items.push({
          id: payment.id,
          type: 'payment',
          title: `${payment.clientName} - ${new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(payment.amount)}`,
          clientName: payment.clientName,
          dueDate: payment.dueDate,
          urgency: 'overdue',
          link: '/accounting/payments',
          icon: '💰',
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
            id: lead.id,
            type: 'lead',
            title: lead.fullName || lead.name,
            clientName: lead.company || 'ללא חברה',
            dueDate: lead.followUpAt,
            urgency: 'today',
            link: '/leads',
            icon: '📞',
          });
        }
      }
    });

    // 8. Clients without approved gantt
    clients.forEach((client) => {
      if (client.monthlyGanttStatus !== 'approved') {
        items.push({
          id: client.id,
          type: 'client',
          title: `${client.name} - דורש אישור תוכנית חודשית`,
          clientName: client.name,
          dueDate: null,
          urgency: 'pending',
          link: `/clients/${client.id}`,
          icon: '📅',
        });
      }
    });

    // Sort: overdue first, then today, then pending/returned/review, then upcoming
    const sortOrder = { overdue: 0, today: 1, review: 2, returned: 3, pending: 4, upcoming: 5 };
    items.sort((a, b) => {
      const orderDiff = (sortOrder[a.urgency as keyof typeof sortOrder] || 5) - (sortOrder[b.urgency as keyof typeof sortOrder] || 5);
      if (orderDiff !== 0) return orderDiff;
      // Then by due date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });

    setActionableItems(items.slice(0, 6));
  }, [tasks, approvals, payments, leads, clients, ganttItems]);

  return (
    <div className="landing">
      {/* ── LEFT: dominant hero image ── */}
      <div className="landing-image-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://s-pixel.co.il/wp-content/uploads/2025/12/Layer-47.png"
          alt="PixelFrameAI interface"
          className="landing-hero-img"
          loading="eager"
          style={{ animation: 'portalFloat 4s ease-in-out infinite' }}
        />
      </div>

      {/* ── CENTER: branding + content stack ── */}
      <div className="landing-content">
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem", marginBottom: "1.75rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://s-pixel.co.il/wp-content/uploads/2026/04/Asset-1.png"
            alt="PixelFrameAI"
            style={{ display: "block", height: 72, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }}
          />
          <span className="brand-lockup-name">PixelFrameAI</span>
        </div>

        {/* Main title */}
        <h1 style={{ animation: mounted ? 'portalFadeUp 0.6s ease-out forwards' : 'none', opacity: mounted ? 1 : 0 }}>סטודיו פיקסל פרסום ומיתוג עסקי</h1>

        {/* Supporting text */}
        <p style={{ animation: mounted ? 'portalFadeUp 0.6s ease-out 0.2s forwards' : 'none', opacity: mounted ? 1 : 0 }}>מערכת ניהול המשרד המשולבת בטכנולוגיות AI בפיתוח אישי</p>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center", marginTop: "1.375rem", animation: mounted ? 'portalFadeUp 0.6s ease-out 0.4s forwards' : 'none', opacity: mounted ? 1 : 0 }}>
          {["✂ עריכה חכמה", "🎬 תוכנית פלט", "📊 ניתוח AI", "🌐 עברית מובנית"].map((f) => (
            <span
              key={f}
              style={{
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 999,
                padding: "0.3rem 0.8rem",
                fontSize: "0.775rem",
                fontWeight: 600,
                backdropFilter: "blur(4px)",
                whiteSpace: "nowrap",
              }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="ctas" style={{ animation: mounted ? 'portalFadeUp 0.6s ease-out 0.6s forwards' : 'none', opacity: mounted ? 1 : 0 }}>
          <Link href="/dashboard" className="btn btn-landing-primary btn-lg">
            דשבורד הניהול
          </Link>
          <Link href="/tasks" className="btn btn-landing-ghost btn-lg">
            לוח משימות
          </Link>
        </div>

        <p className="landing-byline">by Studio Pixel</p>
      </div>

      {/* ── RIGHT: Tasks to Handle widget (RTL) ── */}
      <div className="landing-activity">
        <div className="la-panel" style={{ direction: 'rtl', textAlign: 'right' }}>
          <div className="la-head">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: 'flex-end' }}>
              <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>משימות לטיפול</span>
              <span className="la-pulse" />
            </div>
          </div>
          <div className="la-feed">
            {actionableItems.length > 0
              ? actionableItems.map((item, i) => (
                  <Link
                    key={item.id}
                    href={item.link}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    <div
                      className="la-item"
                      style={{
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <div className="la-item-icon">{item.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="la-item-title">{item.title}</div>
                        <div className="la-item-sub">{item.clientName}</div>
                      </div>
                    </div>
                  </Link>
                ))
              : (
                  <div style={{ padding: "1rem", textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "0.875rem" }}>
                    אין משימות דחופות 🎉
                  </div>
                )
            }
          </div>
          <div className="la-foot" style={{ justifyContent: 'space-between', direction: 'rtl' }}>
            <Link
              href="/tasks"
              style={{
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.7)",
                textDecoration: "none",
              }}
            >
              ← צפה בהכל
            </Link>
            <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)" }}>
              {actionableItems.length} משימות דחופות
            </span>
          </div>
        </div>
      </div>

      <style>{`
  @keyframes portalFloat {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  @keyframes portalFadeUp {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
`}</style>
    </div>
  );
}
