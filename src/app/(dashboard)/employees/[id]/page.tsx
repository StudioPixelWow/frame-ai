"use client";

export const dynamic = "force-dynamic";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useEmployees, useEmployeeTasks, useTasks } from "@/lib/api/use-entity";
import type { EmployeeTask } from "@/lib/db/schema";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "חדש", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)" },
  in_progress: { label: "בעבודה", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)" },
  under_review: { label: "בבדיקה", color: "#0092cc", bg: "rgba(0, 146, 204, 0.12)" },
  returned: { label: "הוחזר", color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)" },
  approved: { label: "אושר", color: "#22c55e", bg: "rgba(34, 197, 94, 0.12)" },
  completed: { label: "הושלם", color: "#6b7280", bg: "rgba(107, 114, 128, 0.12)" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "דחוף", color: "#ef4444" },
  high: { label: "גבוה", color: "#f59e0b" },
  medium: { label: "בינוני", color: "#3b82f6" },
  low: { label: "נמוך", color: "#6b7280" },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל",
  manager: "מנהל מחלקה",
  employee: "עובד",
  viewer: "צופה",
};

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function getAvatarBg(name: string): string {
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F38181", "#AA96DA"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
}

function getDaysUntilDue(dueDate: string | null): number {
  if (!dueDate) return 999;
  const due = new Date(dueDate);
  const now = new Date();
  return Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

interface UnifiedTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  clientName: string;
  dueDate: string | null;
  source: "global" | "employee";
}

export default function EmployeeDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: employeeId } = use(params);
  const { data: employees } = useEmployees();
  const { data: employeeTasks } = useEmployeeTasks();
  const { data: globalTasks } = useTasks();
  const [activeTab, setActiveTab] = useState<"today" | "overdue" | "review" | "upcoming">("today");

  const employee = useMemo(() => (employees || []).find((e) => e.id === employeeId), [employees, employeeId]);

  // Unify tasks from both global and employee task stores
  const allTasks = useMemo(() => {
    const unified: UnifiedTask[] = [];
    const seenIds = new Set<string>();

    // Global tasks assigned to this employee
    (globalTasks || []).forEach((t: any) => {
      const assigneeIds = t.assigneeIds || [];
      if (assigneeIds.includes(employeeId) && !seenIds.has(t.id)) {
        seenIds.add(t.id);
        unified.push({
          id: t.id, title: t.title, description: t.description || "",
          status: t.status, priority: t.priority || "medium",
          clientName: t.clientName || "", dueDate: t.dueDate || null, source: "global",
        });
      }
    });

    // Employee tasks assigned to this employee
    (employeeTasks || []).forEach((t: EmployeeTask) => {
      if (t.assignedEmployeeId === employeeId && !seenIds.has(t.id)) {
        seenIds.add(t.id);
        unified.push({
          id: t.id, title: t.title, description: t.description || "",
          status: t.status, priority: t.priority || "medium",
          clientName: t.clientName || "", dueDate: t.dueDate || null, source: "employee",
        });
      }
    });

    return unified;
  }, [globalTasks, employeeTasks, employeeId]);

  const activeTasks = useMemo(() => allTasks.filter((t) => t.status !== "completed" && t.status !== "approved"), [allTasks]);
  const todayTasks = useMemo(() => activeTasks.filter((t) => isToday(t.dueDate)), [activeTasks]);
  const overdueTasks = useMemo(() => activeTasks.filter((t) => t.dueDate && getDaysUntilDue(t.dueDate) < 0), [activeTasks]);
  const reviewTasks = useMemo(() => activeTasks.filter((t) => t.status === "under_review"), [activeTasks]);
  const upcomingTasks = useMemo(() => {
    return activeTasks
      .filter((t) => t.dueDate && getDaysUntilDue(t.dueDate) >= 0 && getDaysUntilDue(t.dueDate) <= 7 && !isToday(t.dueDate))
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  }, [activeTasks]);

  const tabs = [
    { key: "today" as const, label: "היום", count: todayTasks.length, color: "#3b82f6" },
    { key: "overdue" as const, label: "באיחור", count: overdueTasks.length, color: "#ef4444" },
    { key: "review" as const, label: "בבדיקה", count: reviewTasks.length, color: "#0092cc" },
    { key: "upcoming" as const, label: "קרוב", count: upcomingTasks.length, color: "#f59e0b" },
  ];

  const currentTasks = activeTab === "today" ? todayTasks
    : activeTab === "overdue" ? overdueTasks
    : activeTab === "review" ? reviewTasks
    : upcomingTasks;

  if (!employee) {
    return (
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem", direction: "rtl", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👤</div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: "0.5rem" }}>העובד לא נמצא</h2>
        <Link href="/employees" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>חזרה לצוות</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "2rem", direction: "rtl" }}>
      {/* Back Link */}
      <Link
        href="/employees"
        style={{ color: "var(--accent)", fontSize: "0.85rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
      >
        ← חזרה לניהול צוות
      </Link>

      {/* Employee Header Card */}
      <div style={{
        display: "flex", gap: "1.5rem", alignItems: "center",
        background: "var(--surface-raised)", border: "1px solid var(--border)",
        borderRadius: "1rem", padding: "2rem",
      }}>
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%",
          background: getAvatarBg(employee.name),
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: "1.6rem", flexShrink: 0,
        }}>
          {getInitials(employee.name)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>{employee.name}</h1>
            <span style={{
              padding: "0.3rem 0.65rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600,
              background: "rgba(0, 181, 254, 0.12)", color: "var(--accent)",
            }}>
              {ROLE_LABELS[employee.role] || employee.role}
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", margin: 0 }}>
            {employee.email} &bull; {employee.phone}
          </p>
          {employee.skills.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.75rem" }}>
              {employee.skills.map((skill, i) => (
                <span key={i} style={{
                  padding: "0.25rem 0.5rem", borderRadius: "0.3rem",
                  background: "rgba(0, 181, 254, 0.08)", color: "var(--accent)",
                  fontSize: "0.7rem", fontWeight: 500,
                }}>
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {[
          { label: "פתוחות", value: activeTasks.length, color: "var(--accent)", bg: "rgba(0, 181, 254, 0.08)", border: "rgba(0, 181, 254, 0.2)" },
          { label: "היום", value: todayTasks.length, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.2)" },
          { label: "באיחור", value: overdueTasks.length, color: "#ef4444", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.2)" },
          { label: "בבדיקה", value: reviewTasks.length, color: "#0092cc", bg: "rgba(0, 146, 204, 0.08)", border: "rgba(0, 146, 204, 0.2)" },
        ].map((card) => (
          <div key={card.label} style={{
            background: card.bg, border: `1px solid ${card.border}`,
            borderRadius: "0.75rem", padding: "1.25rem", textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.25rem", fontWeight: 500 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Task Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "0.6rem 1.25rem", fontSize: "0.85rem", fontWeight: 600,
              background: activeTab === tab.key ? tab.color : "transparent",
              color: activeTab === tab.key ? "#fff" : "var(--foreground-muted)",
              border: "none", borderRadius: "0.5rem 0.5rem 0 0",
              cursor: "pointer", transition: "all 150ms ease",
              display: "flex", alignItems: "center", gap: "0.5rem",
            }}
          >
            {tab.label}
            <span style={{
              padding: "0.15rem 0.45rem", borderRadius: "9999px",
              fontSize: "0.7rem", fontWeight: 700,
              background: activeTab === tab.key ? "rgba(255,255,255,0.25)" : `${tab.color}22`,
              color: activeTab === tab.key ? "#fff" : tab.color,
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Task List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {currentTasks.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--foreground-muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
              {activeTab === "today" ? "📋" : activeTab === "overdue" ? "🎉" : activeTab === "review" ? "📝" : "📅"}
            </div>
            <p style={{ fontSize: "0.9rem", margin: 0 }}>
              {activeTab === "today" ? "אין משימות להיום"
                : activeTab === "overdue" ? "אין משימות באיחור!"
                : activeTab === "review" ? "אין משימות בבדיקה"
                : "אין משימות קרובות"}
            </p>
          </div>
        )}

        {currentTasks.map((task) => {
          const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.new;
          const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
          const daysUntil = getDaysUntilDue(task.dueDate);

          return (
            <div
              key={task.id}
              style={{
                background: "var(--surface-raised)", border: "1px solid var(--border)",
                borderRadius: "0.75rem", padding: "1.25rem",
                display: "flex", alignItems: "center", gap: "1rem",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,181,254,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {/* Priority indicator bar */}
              <div style={{ width: "4px", height: "40px", borderRadius: "2px", background: priorityCfg.color, flexShrink: 0 }} />

              {/* Task info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  fontSize: "0.95rem", fontWeight: 600, margin: 0, marginBottom: "0.35rem",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {task.title}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                  {task.clientName && <span>{task.clientName}</span>}
                  {task.dueDate && (
                    <span style={{ color: daysUntil < 0 ? "#ef4444" : daysUntil === 0 ? "#f59e0b" : "var(--foreground-muted)" }}>
                      {daysUntil < 0 ? `איחור ${Math.abs(daysUntil)} ימים` : daysUntil === 0 ? "היום" : `בעוד ${daysUntil} ימים`}
                    </span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <span style={{
                padding: "0.3rem 0.6rem", borderRadius: "0.375rem",
                fontSize: "0.7rem", fontWeight: 600,
                background: statusCfg.bg, color: statusCfg.color, whiteSpace: "nowrap",
              }}>
                {statusCfg.label}
              </span>

              {/* Priority badge */}
              <span style={{
                padding: "0.3rem 0.6rem", borderRadius: "0.375rem",
                fontSize: "0.7rem", fontWeight: 600,
                background: `${priorityCfg.color}18`, color: priorityCfg.color, whiteSpace: "nowrap",
              }}>
                {priorityCfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
