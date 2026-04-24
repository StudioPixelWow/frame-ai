"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { AdminOnly } from "@/components/role-gate";
import {
  useClients,
  useEmployees,
  useEmployeeTasks,
  usePayments,
  useProjectPayments,
  useBusinessProjects,
} from "@/lib/api/use-entity";

function AccessDenied() {
  return (
    <div dir="rtl" style={{ maxWidth: 600, margin: "4rem auto", textAlign: "center", padding: "2rem" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>אין גישה</h2>
      <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>עמוד זה זמין למנהלים בלבד</p>
    </div>
  );
}

interface EmployeeWithWorkload {
  employee: any;
  activeTasks: any[];
  urgentTasks: any[];
  totalTasks: number;
  taskLoadPercentage: number;
  loadBarColor: string;
  isOverloaded: boolean;
}

export default function WorkloadPage() {
  const { data: employees } = useEmployees();
  const { data: tasks } = useEmployeeTasks();
  const { data: payments } = usePayments();
  const { data: projectPayments } = useProjectPayments();
  const { data: businessProjects } = useBusinessProjects();

  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  // Calculate employee workloads
  const employeeWorkloads = useMemo((): EmployeeWithWorkload[] => {
    if (!employees || !tasks) return [];

    return employees.map((employee: any) => {
      const employeeTasks = tasks.filter(
        (task: any) => task.assignedEmployeeId === employee.id
      );
      const activeTasks = employeeTasks.filter(
        (task: any) => task.status !== "completed" && task.status !== "approved"
      );
      const urgentTasks = activeTasks.filter(
        (task: any) => task.priority === "urgent"
      );
      const totalTasks = activeTasks.length;
      const taskLoadPercentage = Math.min((totalTasks / 15) * 100, 100);

      let loadBarColor = "var(--accent)"; // Green
      if (totalTasks > 8) {
        loadBarColor = "#ef4444"; // Red
      } else if (totalTasks >= 6) {
        loadBarColor = "#f97316"; // Orange
      }

      return {
        employee,
        activeTasks,
        urgentTasks,
        totalTasks,
        taskLoadPercentage,
        loadBarColor,
        isOverloaded: totalTasks > 8,
      };
    });
  }, [employees, tasks]);

  // Team summary
  const teamSummary = useMemo(() => {
    if (employeeWorkloads.length === 0) {
      return { totalTasks: 0, averagePerEmployee: 0, mostLoadedEmployee: null };
    }

    const totalTasks = employeeWorkloads.reduce(
      (sum, e) => sum + e.totalTasks,
      0
    );
    const averagePerEmployee =
      employeeWorkloads.length > 0 ? totalTasks / employeeWorkloads.length : 0;
    const mostLoadedEmployee = employeeWorkloads.reduce((max, e) =>
      e.totalTasks > max.totalTasks ? e : max
    );

    return {
      totalTasks,
      averagePerEmployee: Math.round(averagePerEmployee * 10) / 10,
      mostLoadedEmployee: mostLoadedEmployee.employee.name,
    };
  }, [employeeWorkloads]);

  // Calculate profit metrics
  const profitMetrics = useMemo(() => {
    const totalRevenue =
      (payments || [])
        .filter((p: any) => p.status === "paid")
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0) +
      (projectPayments || [])
        .filter((p: any) => p.status === "paid")
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const totalSalaries = (employees || []).reduce(
      (sum: number, e: any) => sum + (e.salary || 0),
      0
    );

    const activeBudget = (businessProjects || [])
      .filter((p: any) => p.projectStatus !== "completed")
      .reduce((sum: number, p: any) => sum + (p.budget || 0), 0);

    const estimatedProfit = totalRevenue - totalSalaries;

    return {
      totalRevenue,
      totalSalaries,
      activeBudget,
      estimatedProfit,
    };
  }, [payments, projectPayments, employees, businessProjects]);

  return (
    <AdminOnly fallback={<AccessDenied />}>
      <div style={{ direction: "rtl", minHeight: "100vh", padding: "24px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "700",
              color: "var(--foreground)",
              margin: "0 0 8px 0",
            }}
          >
            עומס עבודה ורווחיות
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "var(--foreground-muted)",
              margin: 0,
            }}
          >
            מבט על ביצועי הצוות והעסק
          </p>
        </div>

        {/* Section 1: Employee Workload */}
        <div style={{ marginBottom: "48px" }}>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "var(--foreground)",
              marginBottom: "16px",
            }}
          >
            עומס עבודה של הצוות
          </h2>

          {/* Employee Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {employeeWorkloads.map((item) => (
              <div
                key={item.employee.id}
                className="premium-card"
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  border: `1px solid var(--border)`,
                  backgroundColor: "var(--surface-raised)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() =>
                  setExpandedEmployee(
                    expandedEmployee === item.employee.id
                      ? null
                      : item.employee.id
                  )
                }
              >
                {/* Header: Name and Status */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    marginBottom: "12px",
                    gap: "8px",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: "15px",
                        fontWeight: "600",
                        color: "var(--foreground)",
                        margin: 0,
                      }}
                    >
                      {item.employee.name}
                    </h3>
                  </div>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor:
                        item.employee.status === "online"
                          ? "#22c55e"
                          : "#9ca3af",
                    }}
                  />
                </div>

                {/* Task Counts */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--foreground-muted)",
                        margin: "0 0 4px 0",
                      }}
                    >
                      משימות פעילות
                    </p>
                    <p
                      style={{
                        fontSize: "18px",
                        fontWeight: "700",
                        color: "var(--accent)",
                        margin: 0,
                      }}
                    >
                      {item.totalTasks}
                    </p>
                  </div>
                  <div style={{ width: "1px", backgroundColor: "var(--border)" }} />
                  <div
                    style={{
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--foreground-muted)",
                        margin: "0 0 4px 0",
                      }}
                    >
                      משימות דחופות
                    </p>
                    <p
                      style={{
                        fontSize: "18px",
                        fontWeight: "700",
                        color: "#ef4444",
                        margin: 0,
                      }}
                    >
                      {item.urgentTasks.length}
                    </p>
                  </div>
                </div>

                {/* Load Bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: "8px",
                      backgroundColor: "var(--border)",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${item.taskLoadPercentage}%`,
                        backgroundColor: item.loadBarColor,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--foreground-muted)",
                      minWidth: "30px",
                      textAlign: "left",
                    }}
                  >
                    {Math.round(item.taskLoadPercentage)}%
                  </span>
                </div>

                {/* Overload Badge */}
                {item.isOverloaded && (
                  <div
                    style={{
                      padding: "6px 10px",
                      backgroundColor: "#fee2e2",
                      color: "#991b1b",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "600",
                      textAlign: "center",
                      marginBottom: "12px",
                    }}
                  >
                    ⚠️ עומס יתר
                  </div>
                )}

                {/* Tasks List (Collapsible) */}
                {expandedEmployee === item.employee.id && (
                  <div
                    style={{
                      borderTop: `1px solid var(--border)`,
                      paddingTop: "12px",
                      marginTop: "12px",
                    }}
                  >
                    {item.activeTasks.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {item.activeTasks.map((task: any) => (
                          <div
                            key={task.id}
                            style={{
                              padding: "8px",
                              backgroundColor: "var(--surface)",
                              borderRadius: "4px",
                              fontSize: "12px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: "8px",
                                marginBottom: "4px",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: "600",
                                  color: "var(--foreground)",
                                  flex: 1,
                                  textAlign: "right",
                                }}
                              >
                                {task.title}
                              </span>
                              <span
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: "3px",
                                  fontSize: "10px",
                                  fontWeight: "600",
                                  backgroundColor:
                                    task.priority === "urgent"
                                      ? "#fee2e2"
                                      : "#dbeafe",
                                  color:
                                    task.priority === "urgent"
                                      ? "#991b1b"
                                      : "#1e40af",
                                }}
                              >
                                {task.priority === "urgent" ? "דחוף" : "רגיל"}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "8px",
                                color: "var(--foreground-muted)",
                                fontSize: "11px",
                              }}
                            >
                              <span>{task.clientName}</span>
                              <span>
                                {task.dueDate
                                  ? new Date(
                                      task.dueDate
                                    ).toLocaleDateString("he-IL")
                                  : "אין תאריך"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--foreground-muted)",
                          textAlign: "center",
                          margin: 0,
                        }}
                      >
                        אין משימות פעילות
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Team Summary Card */}
          <div
            className="premium-card"
            style={{
              padding: "20px",
              borderRadius: "8px",
              border: `1px solid var(--border)`,
              backgroundColor: "var(--surface-raised)",
            }}
          >
            <h3
              style={{
                fontSize: "15px",
                fontWeight: "600",
                color: "var(--foreground)",
                marginBottom: "16px",
              }}
            >
              סיכום הצוות
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "16px",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--foreground-muted)",
                    margin: "0 0 8px 0",
                  }}
                >
                  סה״כ משימות
                </p>
                <p
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "var(--accent)",
                    margin: 0,
                  }}
                >
                  {teamSummary.totalTasks}
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--foreground-muted)",
                    margin: "0 0 8px 0",
                  }}
                >
                  ממוצע לעובד
                </p>
                <p
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "var(--accent)",
                    margin: 0,
                  }}
                >
                  {teamSummary.averagePerEmployee}
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--foreground-muted)",
                    margin: "0 0 8px 0",
                  }}
                >
                  עובד עמוס ביותר
                </p>
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--foreground)",
                    margin: 0,
                  }}
                >
                  {teamSummary.mostLoadedEmployee || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Profit Estimation */}
        <div>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "var(--foreground)",
              marginBottom: "16px",
            }}
          >
            הערכת רווחיות
          </h2>

          {/* KPI Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            {/* Revenue Card */}
            <div
              className="premium-card"
              style={{
                padding: "20px",
                borderRadius: "8px",
                border: `1px solid var(--border)`,
                backgroundColor: "var(--surface-raised)",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--foreground-muted)",
                  margin: "0 0 12px 0",
                  textAlign: "right",
                }}
              >
                הכנסות
              </p>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#22c55e",
                  margin: 0,
                }}
              >
                ₪{profitMetrics.totalRevenue.toLocaleString("he-IL")}
              </p>
            </div>

            {/* Salaries Card */}
            <div
              className="premium-card"
              style={{
                padding: "20px",
                borderRadius: "8px",
                border: `1px solid var(--border)`,
                backgroundColor: "var(--surface-raised)",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--foreground-muted)",
                  margin: "0 0 12px 0",
                  textAlign: "right",
                }}
              >
                משכורות
              </p>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#f97316",
                  margin: 0,
                }}
              >
                ₪{profitMetrics.totalSalaries.toLocaleString("he-IL")}
              </p>
            </div>

            {/* Active Project Value Card */}
            <div
              className="premium-card"
              style={{
                padding: "20px",
                borderRadius: "8px",
                border: `1px solid var(--border)`,
                backgroundColor: "var(--surface-raised)",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--foreground-muted)",
                  margin: "0 0 12px 0",
                  textAlign: "right",
                }}
              >
                ערך פרויקטים פעילים
              </p>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#3b82f6",
                  margin: 0,
                }}
              >
                ₪{profitMetrics.activeBudget.toLocaleString("he-IL")}
              </p>
            </div>

            {/* Estimated Profit Card */}
            <div
              className="premium-card"
              style={{
                padding: "20px",
                borderRadius: "8px",
                border: `1px solid var(--border)`,
                backgroundColor: "var(--surface-raised)",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--foreground-muted)",
                  margin: "0 0 12px 0",
                  textAlign: "right",
                }}
              >
                רווח חודשי משוער
              </p>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color:
                    profitMetrics.estimatedProfit >= 0 ? "#22c55e" : "#ef4444",
                  margin: 0,
                }}
              >
                ₪{profitMetrics.estimatedProfit.toLocaleString("he-IL")}
              </p>
            </div>
          </div>

          {/* Note */}
          <p
            style={{
              fontSize: "12px",
              color: "var(--foreground-muted)",
              fontStyle: "italic",
              margin: 0,
              textAlign: "right",
            }}
          >
            * הערכה בלבד — לא כוללת הוצאות תפעוליות
          </p>
        </div>
      </div>
    </AdminOnly>
  );
}
