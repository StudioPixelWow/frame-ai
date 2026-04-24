"use client";

export const dynamic = "force-dynamic";

import React, { useMemo } from "react";
import { AdminOnly } from "@/components/role-gate";
import {
  useClients,
  usePayments,
  useProjectPayments,
  useEmployees,
  useEmployeeTasks,
  useTasks,
  useLeads,
} from "@/lib/api/use-entity";
import {
  computeClientHealth,
  STATUS_LABELS_EXTENDED,
  type ClientHealthScore,
} from "@/lib/business/client-health";

// Access Denied Component
function AccessDenied() {
  return (
    <div
      dir="rtl"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center",
        color: "var(--foreground)",
      }}
    >
      <span style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</span>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        גישה נדחתה
      </h1>
      <p style={{ color: "var(--foreground-muted)" }}>
        רק מנהלים יכולים לגשת לדשבורד זה
      </p>
    </div>
  );
}

// KPI Card Component
function KPICard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div
      className="premium-card"
      style={{
        padding: "1.5rem",
        textAlign: "center",
        borderRadius: "0.75rem",
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.75rem" }}>
        {icon}
      </span>
      <p style={{ color: "var(--foreground-muted)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
        {label}
      </p>
      <p style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--foreground)" }}>
        {value}
      </p>
    </div>
  );
}

// Health Badge Component
function HealthBadge({ score }: { score: ClientHealthScore }) {
  const bgColor =
    score.status === "good"
      ? "rgba(34,197,94,0.1)"
      : score.status === "attention"
        ? "rgba(245,158,11,0.1)"
        : "rgba(239,68,68,0.1)";

  const textColor =
    score.status === "good"
      ? "#22c55e"
      : score.status === "attention"
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div
      style={{
        padding: "0.375rem 0.75rem",
        borderRadius: "0.375rem",
        backgroundColor: bgColor,
        color: textColor,
        fontSize: "0.75rem",
        fontWeight: 600,
        display: "inline-block",
      }}
    >
      {score.score}
    </div>
  );
}

// Client Health Row Component
function ClientHealthRow({
  client,
  healthScore,
}: {
  client: any;
  healthScore: ClientHealthScore;
}) {
  const statusLabel = STATUS_LABELS_EXTENDED[client.status];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 100px 120px 100px",
        gap: "1rem",
        alignItems: "center",
        padding: "1rem",
        borderBottom: "1px solid var(--border)",
        direction: "rtl",
      }}
    >
      <div>
        <p style={{ fontWeight: 600, color: "var(--foreground)" }}>
          {client.name || client.clientName || "לא ידוע"}
        </p>
      </div>
      <HealthBadge score={healthScore} />
      <div
        style={{
          padding: "0.375rem 0.75rem",
          borderRadius: "0.375rem",
          backgroundColor: `${statusLabel.color}20`,
          color: statusLabel.color,
          fontSize: "0.75rem",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {statusLabel.label}
      </div>
      <div style={{ textAlign: "left", fontWeight: 600, color: "var(--foreground)" }}>
        {client.retainerAmount ? `₪${client.retainerAmount.toLocaleString()}` : "-"}
      </div>
    </div>
  );
}

// Workload Bar Component
function WorkloadBar({
  employeeName,
  taskCount,
  totalTasks,
}: {
  employeeName: string;
  taskCount: number;
  totalTasks: number;
}) {
  const percentage = totalTasks > 0 ? (taskCount / totalTasks) * 100 : 0;
  const isOverloaded = taskCount > 8;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <p style={{ fontWeight: 600, color: "var(--foreground)" }}>
          {employeeName}
        </p>
        <p
          style={{
            fontWeight: 600,
            color: isOverloaded ? "#ef4444" : "var(--foreground)",
          }}
        >
          {taskCount} משימות
          {isOverloaded && " ⚠️"}
        </p>
      </div>
      <div
        style={{
          width: "100%",
          height: "8px",
          backgroundColor: "var(--border)",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(percentage, 100)}%`,
            height: "100%",
            backgroundColor: isOverloaded ? "#ef4444" : "var(--accent)",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

// Revenue Bar Component
function RevenueBar({
  label,
  amount,
  color,
}: {
  label: string;
  amount: number;
  color: string;
}) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div
        style={{
          width: "100%",
          height: "120px",
          backgroundColor: `${color}20`,
          borderRadius: "0.5rem",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          marginBottom: "0.75rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "80%",
            height: "100%",
            backgroundColor: color,
            opacity: 0.8,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            fontSize: "0.75rem",
            color: "white",
            fontWeight: 600,
            padding: "0.5rem",
          }}
        >
          {amount > 0 ? `₪${(amount / 1000).toFixed(0)}K` : "₪0"}
        </div>
      </div>
      <p style={{ fontWeight: 600, color: "var(--foreground)" }}>{label}</p>
      <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
        ₪{amount.toLocaleString()}
      </p>
    </div>
  );
}

// Alert Item Component
function AlertItem({ message, severity }: { message: string; severity: "risk" | "warning" | "info" }) {
  const bgColor =
    severity === "risk"
      ? "rgba(239,68,68,0.1)"
      : severity === "warning"
        ? "rgba(245,158,11,0.1)"
        : "rgba(59,130,246,0.1)";

  const textColor =
    severity === "risk"
      ? "#ef4444"
      : severity === "warning"
        ? "#f59e0b"
        : "#3b82f6";

  const icon = severity === "risk" ? "🚨" : severity === "warning" ? "⚠️" : "ℹ️";

  return (
    <div
      style={{
        display: "flex",
        gap: "0.75rem",
        padding: "0.75rem",
        backgroundColor: bgColor,
        borderRadius: "0.5rem",
        borderRight: `3px solid ${textColor}`,
        direction: "rtl",
      }}
    >
      <span style={{ fontSize: "1rem" }}>{icon}</span>
      <p style={{ color: textColor, fontSize: "0.875rem", fontWeight: 500 }}>
        {message}
      </p>
    </div>
  );
}

export default function ExecutivePage() {
  const { data: rawClients } = useClients();
  const { data: rawPayments } = usePayments();
  const { data: rawProjectPayments } = useProjectPayments();
  const { data: rawEmployees } = useEmployees();
  const { data: rawEmployeeTasks } = useEmployeeTasks();
  const { data: rawTasks } = useTasks();
  const { data: rawLeads } = useLeads();

  // Safe fallbacks
  const clients = rawClients ?? [];
  const payments = rawPayments ?? [];
  const projectPayments = rawProjectPayments ?? [];
  const employees = rawEmployees ?? [];
  const employeeTasks = rawEmployeeTasks ?? [];
  const tasks = rawTasks ?? [];
  const leads = rawLeads ?? [];

  // Loading state
  const isLoading =
    !rawClients ||
    !rawPayments ||
    !rawProjectPayments ||
    !rawEmployees ||
    !rawEmployeeTasks ||
    !rawTasks ||
    !rawLeads;

  // KPI Calculations
  const kpis = useMemo(() => {
    // Active clients count
    const activeClientsCount = clients.filter(
      (c: any) => c.status === "active"
    ).length;

    // Monthly revenue
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let monthlyRevenue = 0;

    // Sum paid payments this month
    payments.forEach((p: any) => {
      if (p.status === "paid") {
        const payDate = new Date(p.dueDate || p.createdAt || now);
        if (payDate >= monthStart && payDate <= monthEnd) {
          monthlyRevenue += p.amount || 0;
        }
      }
    });

    // Sum paid project payments this month
    projectPayments.forEach((p: any) => {
      if (p.status === "paid" || p.isPaid === true) {
        const payDate = new Date(p.dueDate || p.createdAt || now);
        if (payDate >= monthStart && payDate <= monthEnd) {
          monthlyRevenue += p.amount || 0;
        }
      }
    });

    // Open tasks count
    const openTasksCount = tasks.filter(
      (t: any) =>
        t.status !== "completed" && t.status !== "done" && t.status !== "cancelled"
    ).length;

    // Active leads count
    const activeLeadsCount = leads.filter(
      (l: any) =>
        l.status !== "won" && l.status !== "lost" && l.status !== "not_relevant"
    ).length;

    return {
      activeClientsCount,
      monthlyRevenue,
      openTasksCount,
      activeLeadsCount,
    };
  }, [clients, payments, projectPayments, tasks, leads]);

  // Client Health Scores
  const clientHealthScores = useMemo(() => {
    return clients
      .filter((c: any) => c.status === "active")
      .map((client: any) => {
        const clientPayments = payments.filter(
          (p: any) => p.clientId === client.id
        );
        const clientProjectPayments = projectPayments.filter(
          (p: any) => p.clientId === client.id
        );
        const clientTasks = tasks.filter((t: any) => t.clientId === client.id);

        const healthScore = computeClientHealth(
          client,
          clientTasks,
          clientPayments,
          clientProjectPayments
        );

        return { client, healthScore };
      })
      .sort((a, b) => a.healthScore.score - b.healthScore.score); // Worst first
  }, [clients, payments, projectPayments, tasks]);

  // Workload Distribution
  const workloadData = useMemo(() => {
    const employeeTaskMap = new Map<string, number>();
    const employeeNameMap = new Map<string, string>();

    employees.forEach((emp: any) => {
      employeeTaskMap.set(emp.id, 0);
      employeeNameMap.set(emp.id, emp.name || emp.firstName || "לא ידוע");
    });

    employeeTasks.forEach((et: any) => {
      if (et.status !== "completed" && et.status !== "done") {
        const count = employeeTaskMap.get(et.employeeId) || 0;
        employeeTaskMap.set(et.employeeId, count + 1);
      }
    });

    const totalTasks = Array.from(employeeTaskMap.values()).reduce(
      (a, b) => a + b,
      0
    );

    const workloadEntries = Array.from(employeeTaskMap.entries())
      .map(([empId, count]) => ({
        employeeId: empId,
        employeeName: employeeNameMap.get(empId) || "לא ידוע",
        taskCount: count,
      }))
      .sort((a, b) => b.taskCount - a.taskCount); // Most loaded first

    return { workloadEntries, totalTasks };
  }, [employees, employeeTasks]);

  // Revenue vs Collections
  const revenueData = useMemo(() => {
    const now = new Date();
    let paidThisMonth = 0;
    let pendingTotal = 0;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Paid amounts this month
    payments.forEach((p: any) => {
      if (p.status === "paid") {
        const payDate = new Date(p.dueDate || p.createdAt || now);
        if (payDate >= monthStart && payDate <= monthEnd) {
          paidThisMonth += p.amount || 0;
        }
      }
    });

    projectPayments.forEach((p: any) => {
      if (p.status === "paid" || p.isPaid === true) {
        const payDate = new Date(p.dueDate || p.createdAt || now);
        if (payDate >= monthStart && payDate <= monthEnd) {
          paidThisMonth += p.amount || 0;
        }
      }
    });

    // Pending/overdue amounts
    payments.forEach((p: any) => {
      if (p.status === "pending" || p.status === "overdue") {
        pendingTotal += p.amount || 0;
      }
    });

    projectPayments.forEach((p: any) => {
      if (
        p.status === "pending" ||
        p.status === "collection_needed" ||
        p.status === "overdue"
      ) {
        pendingTotal += p.amount || 0;
      }
    });

    return { paidThisMonth, pendingTotal };
  }, [payments, projectPayments]);

  // Alerts
  const alerts = useMemo(() => {
    const alertList: Array<{ message: string; severity: "risk" | "warning" | "info" }> = [];

    // Risk clients (health score < 40)
    clientHealthScores.forEach(({ client, healthScore }) => {
      if (healthScore.score < 40) {
        alertList.push({
          message: `לקוח בסיכון: ${client.name || client.clientName}`,
          severity: "risk",
        });
      }
    });

    // Overdue payments
    const now = new Date();
    payments.forEach((p: any) => {
      if (p.status === "overdue") {
        const client = clients.find((c: any) => c.id === p.clientId);
        alertList.push({
          message: `תשלום באיחור: ${client?.name || client?.clientName || "לא ידוע"}`,
          severity: "warning",
        });
      }
    });

    projectPayments.forEach((p: any) => {
      if (p.status === "overdue") {
        const client = clients.find((c: any) => c.id === p.clientId);
        alertList.push({
          message: `תשלום פרויקט באיחור: ${client?.name || client?.clientName || "לא ידוע"}`,
          severity: "warning",
        });
      }
    });

    // Overloaded employees
    workloadData.workloadEntries.forEach((emp) => {
      if (emp.taskCount > 8) {
        alertList.push({
          message: `עומס יתר: ${emp.employeeName} (${emp.taskCount} משימות)`,
          severity: "warning",
        });
      }
    });

    // Clients without manager
    clients.forEach((c: any) => {
      if (!c.assignedManagerId && c.status === "active") {
        alertList.push({
          message: `לקוח ללא מנהל: ${c.name || c.clientName}`,
          severity: "info",
        });
      }
    });

    return alertList;
  }, [clientHealthScores, payments, projectPayments, clients, workloadData]);

  if (isLoading) {
    return (
      <div
        dir="rtl"
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--foreground-muted)",
        }}
      >
        <p style={{ fontSize: "1.125rem" }}>טוען...</p>
      </div>
    );
  }

  return (
    <AdminOnly fallback={<AccessDenied />}>
      <div dir="rtl" style={{ padding: "2rem", direction: "rtl" }}>
        {/* Page Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.5rem" }}>
            סיכום מנהלים
          </h1>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.95rem" }}>
            מבט-על על העסק
          </p>
        </div>

        {/* KPI Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2.5rem",
          }}
        >
          <KPICard
            label="לקוחות פעילים"
            value={kpis.activeClientsCount}
            icon="👥"
          />
          <KPICard
            label="הכנסה חודשית"
            value={`₪${(kpis.monthlyRevenue / 1000).toFixed(0)}K`}
            icon="💰"
          />
          <KPICard
            label="משימות פתוחות"
            value={kpis.openTasksCount}
            icon="📋"
          />
          <KPICard
            label="הזדמנויות פתוחות"
            value={kpis.activeLeadsCount}
            icon="🎯"
          />
        </div>

        {/* Client Health Overview */}
        {clientHealthScores.length > 0 && (
          <div style={{ marginBottom: "2.5rem" }}>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--foreground)",
                marginBottom: "1rem",
              }}
            >
              בריאות לקוחות
            </h2>
            <div
              className="premium-card"
              style={{
                borderRadius: "0.75rem",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 120px 100px",
                  gap: "1rem",
                  padding: "1rem",
                  borderBottom: "2px solid var(--border)",
                  fontWeight: 600,
                  color: "var(--foreground-muted)",
                  fontSize: "0.875rem",
                  direction: "rtl",
                }}
              >
                <div>שם לקוח</div>
                <div style={{ textAlign: "center" }}>ציון</div>
                <div style={{ textAlign: "center" }}>סטטוס</div>
                <div style={{ textAlign: "left" }}>אחזקה</div>
              </div>
              {clientHealthScores.map(({ client, healthScore }) => (
                <ClientHealthRow
                  key={client.id}
                  client={client}
                  healthScore={healthScore}
                />
              ))}
            </div>
          </div>
        )}

        {/* Workload Distribution */}
        {workloadData.workloadEntries.length > 0 && (
          <div style={{ marginBottom: "2.5rem" }}>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--foreground)",
                marginBottom: "1rem",
              }}
            >
              התפלגות עומס עבודה
            </h2>
            <div
              className="premium-card"
              style={{
                padding: "1.5rem",
                borderRadius: "0.75rem",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
              }}
            >
              {workloadData.workloadEntries.map((emp) => (
                <WorkloadBar
                  key={emp.employeeId}
                  employeeName={emp.employeeName}
                  taskCount={emp.taskCount}
                  totalTasks={workloadData.totalTasks}
                />
              ))}
            </div>
          </div>
        )}

        {/* Revenue vs Collections */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--foreground)",
              marginBottom: "1rem",
            }}
          >
            הכנסה לעומת גבייה
          </h2>
          <div
            className="premium-card"
            style={{
              padding: "2rem",
              borderRadius: "0.75rem",
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              display: "flex",
              gap: "2rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <RevenueBar
              label="שולם החודש"
              amount={revenueData.paidThisMonth}
              color="#22c55e"
            />
            <RevenueBar
              label="בהמתנה"
              amount={revenueData.pendingTotal}
              color="#f59e0b"
            />
          </div>
        </div>

        {/* Alerts Panel */}
        {alerts.length > 0 && (
          <div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--foreground)",
                marginBottom: "1rem",
              }}
            >
              התראות חשובות
            </h2>
            <div
              className="premium-card"
              style={{
                padding: "1.5rem",
                borderRadius: "0.75rem",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {alerts.map((alert, idx) => (
                <AlertItem
                  key={idx}
                  message={alert.message}
                  severity={alert.severity}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminOnly>
  );
}
