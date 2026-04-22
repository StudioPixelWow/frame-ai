"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useEmployees, useEmployeeTasks, useTasks } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { Employee } from "@/lib/db/schema";

const ROLE_CONFIG: Record<string, { labelHe: string; color: string; bg: string; iconColor: string }> = {
  admin: { labelHe: "מנהל", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", iconColor: "#ef4444" },
  manager: { labelHe: "מנהל מחלקה", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", iconColor: "#3b82f6" },
  employee: { labelHe: "עובד", color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)", iconColor: "#22c55e" },
  viewer: { labelHe: "צופה", color: "#6b7280", bg: "rgba(107, 114, 128, 0.15)", iconColor: "#6b7280" },
};

const ACCESS_RULES: Record<string, { title: string; description: string }> = {
  admin: { title: "מנהל", description: "גישה מלאה לכל המערכת" },
  manager: { title: "מנהל מחלקה", description: "גישה לכל הלקוחות, המשימות והדוחות" },
  employee: { title: "עובד", description: "גישה למשימות שהוקצו ויומן אישי" },
  viewer: { title: "צופה", description: "צפייה בלבד" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
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
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  return Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  role: "admin" | "manager" | "employee" | "viewer";
  salary: number;
  status: "online" | "busy" | "offline";
  skills: string;
  notes: string;
}

// Only show these 4 team members on the Team page
const TEAM_MEMBERS = ["טל זטלמן", "מאיה זטלמן", "נועם בוברין", "מיכאלה"];

const INITIAL_FORM: FormData = {
  name: "",
  email: "",
  phone: "",
  role: "employee",
  salary: 0,
  status: "offline",
  skills: "",
  notes: "",
};

export default function EmployeesPage() {
  const { data: employees, loading, create, update, remove } = useEmployees();
  const { data: employeeTasks } = useEmployeeTasks();
  const { data: globalTasks } = useTasks();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRulesExpanded, setIsRulesExpanded] = useState(true);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const taskStats = useMemo(() => {
    const stats: Record<string, { open: number; overdue: number; thisWeek: number; underReview: number }> = {};

    // Count from employee tasks (safe: guard against undefined)
    (employeeTasks || []).forEach((task) => {
      if (!stats[task.assignedEmployeeId]) {
        stats[task.assignedEmployeeId] = { open: 0, overdue: 0, thisWeek: 0, underReview: 0 };
      }

      const isCompleted = task.status === "completed" || task.status === "approved";
      if (!isCompleted) {
        stats[task.assignedEmployeeId].open++;
        if (task.status === "under_review") stats[task.assignedEmployeeId].underReview++;

        if (task.dueDate) {
          const daysUntil = getDaysUntilDue(task.dueDate);
          if (daysUntil < 0) {
            stats[task.assignedEmployeeId].overdue++;
          } else if (daysUntil <= 7) {
            stats[task.assignedEmployeeId].thisWeek++;
          }
        }
      }
    });

    // Also count from global tasks (single source of truth)
    (globalTasks || []).forEach((task: any) => {
      const assigneeIds = task.assigneeIds || [];
      assigneeIds.forEach((empId: string) => {
        if (!stats[empId]) {
          stats[empId] = { open: 0, overdue: 0, thisWeek: 0, underReview: 0 };
        }
        const isCompleted = task.status === "completed" || task.status === "approved";
        if (!isCompleted) {
          stats[empId].open++;
          if (task.status === "under_review") stats[empId].underReview++;

          if (task.dueDate) {
            const daysUntil = getDaysUntilDue(task.dueDate);
            if (daysUntil < 0) {
              stats[empId].overdue++;
            } else if (daysUntil <= 7) {
              stats[empId].thisWeek++;
            }
          }
        }
      });
    });

    return stats;
  }, [employeeTasks, globalTasks]);

  const filteredEmployees = useMemo(() => {
    return (employees || []).filter((e) => {
      const isTeamMember = TEAM_MEMBERS.includes(e.name);
      const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || e.role === roleFilter;
      return isTeamMember && matchesSearch && matchesRole;
    });
  }, [employees, search, roleFilter]);

  const roleSummary = useMemo(() => {
    const counts = { admin: 0, manager: 0, employee: 0, viewer: 0 };
    (employees || []).filter((e) => TEAM_MEMBERS.includes(e.name)).forEach((e) => {
      counts[e.role]++;
    });
    return counts;
  }, [employees]);

  const handleOpenCreateModal = () => {
    setEditingEmployeeId(null);
    setFormData(INITIAL_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      salary: employee.salary,
      status: employee.status,
      skills: employee.skills.join(", "),
      notes: employee.notes,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
    setEditingEmployeeId(null);
  };

  const handleSaveEmployee = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast("אנא מלא את כל השדות הנדרשים", "success");
      return;
    }

    try {
      const dataToSave = {
        ...formData,
        skills: formData.skills.split(",").map((s) => s.trim()).filter((s) => s),
      };

      if (editingEmployeeId) {
        await update(editingEmployeeId, dataToSave);
        toast("העובד עודכן בהצלחה", "success");
      } else {
        await create(dataToSave);
        toast("העובד נוסף בהצלחה", "success");
      }
      handleCloseModal();
    } catch (error) {
      toast("שגיאה בשמירת העובד", "success");
    }
  };

  const handleOpenDeleteConfirm = (employeeId: string) => {
    setDeleteTargetId(employeeId);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;

    try {
      await remove(deleteTargetId);
      toast("העובד הוסר בהצלחה", "success");
      setIsDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      toast("שגיאה בהסרת העובד", "success");
    }
  };

  return (
    <main
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "2rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        direction: "rtl",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              ניהול צוות
            </h1>
            <div
              style={{
                background: "var(--accent)",
                color: "#fff",
                padding: "0.35rem 0.75rem",
                borderRadius: "9999px",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {filteredEmployees.length}
            </div>
          </div>
          <p style={{ fontSize: "0.95rem", color: "var(--foreground-muted)", margin: 0 }}>
            {roleSummary.admin} מנהלים, {roleSummary.manager} מנהלי מחלקה, {roleSummary.employee} עובדים
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          disabled={loading}
          className="ux-btn ux-btn-glow"
          style={{
            padding: "0.6rem 1.25rem",
            fontSize: "0.9rem",
            fontWeight: 600,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + הוסף עובד
        </button>
      </div>

      {/* Access Rules Banner */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: `1px solid var(--border)`,
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setIsRulesExpanded(!isRulesExpanded)}
          style={{
            width: "100%",
            padding: "1rem 1.25rem",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--foreground)",
          }}
        >
          <span>כללי גישה ותפקידים</span>
          <span style={{ fontSize: "1.2rem" }}>
            {isRulesExpanded ? "▼" : "▶"}
          </span>
        </button>

        {isRulesExpanded && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
              padding: "0 1.25rem 1.25rem 1.25rem",
              borderTop: "1px solid var(--border)",
            }}
          >
            {Object.entries(ACCESS_RULES).map(([role, info]) => (
              <div
                key={role}
                style={{
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  background: ROLE_CONFIG[role].bg,
                  border: `1px solid ${ROLE_CONFIG[role].color}`,
                }}
              >
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: ROLE_CONFIG[role].color,
                    marginBottom: "0.5rem",
                  }}
                >
                  {info.title}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                  {info.description}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="חיפוש בשם..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ux-input"
          style={{
            flex: 1,
            minWidth: "250px",
            padding: "0.6rem 0.875rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--foreground)",
            fontSize: "0.875rem",
          }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: "0.6rem 0.875rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--foreground)",
            fontSize: "0.875rem",
          }}
        >
          <option value="all">כל התפקידים</option>
          <option value="admin">מנהל</option>
          <option value="manager">מנהל מחלקה</option>
          <option value="employee">עובד</option>
          <option value="viewer">צופה</option>
        </select>
      </div>

      {/* Employee Grid */}
      <div
        className="ux-stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {filteredEmployees.map((employee) => {
          const stats = taskStats[employee.id] || { open: 0, overdue: 0, thisWeek: 0, underReview: 0 };
          const workloadPercent = Math.min((stats.open / 12) * 100, 100);

          return (
            <Link
              key={employee.id}
              href={`/employees/${employee.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="ux-stagger-item premium-card"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  cursor: "pointer",
                  transition: "all 200ms ease",
                  minHeight: "320px",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--accent)";
                  el.style.boxShadow = "0 8px 16px rgba(0, 181, 254, 0.12)";
                  el.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--border)";
                  el.style.boxShadow = "none";
                  el.style.transform = "translateY(0)";
                }}
              >
                {/* Avatar & Header */}
                <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: getAvatarBg(employee.name),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(employee.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, marginBottom: "0.25rem" }}>
                      {employee.name}
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", margin: 0 }}>
                      {employee.email}
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "0.4rem 0.7rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      background: (ROLE_CONFIG[employee.role] || ROLE_CONFIG.employee).bg,
                      color: (ROLE_CONFIG[employee.role] || ROLE_CONFIG.employee).color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(ROLE_CONFIG[employee.role] || ROLE_CONFIG.employee).labelHe}
                  </div>
                </div>

                {/* Status & Phone */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.8rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--foreground-muted)" }}>
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background:
                          employee.status === "online"
                            ? "#22c55e"
                            : employee.status === "busy"
                            ? "#f59e0b"
                            : "#6b7280",
                      }}
                    />
                    {employee.status === "online" ? "מחובר" : employee.status === "busy" ? "עסוק" : "לא מחובר"}
                  </div>
                  {employee.phone && <span style={{ color: "var(--foreground-muted)" }}>{employee.phone}</span>}
                </div>

                {/* Task Stats Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem" }}>
                  {[
                    { label: "פתוחות", value: stats.open, color: "var(--accent)", bg: "rgba(0, 181, 254, 0.08)", border: "rgba(0, 181, 254, 0.2)" },
                    { label: "איחור", value: stats.overdue, color: stats.overdue > 0 ? "#ef4444" : "var(--foreground-muted)", bg: stats.overdue > 0 ? "rgba(239, 68, 68, 0.08)" : "rgba(107, 114, 128, 0.08)", border: stats.overdue > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(107, 114, 128, 0.2)" },
                    { label: "בבדיקה", value: stats.underReview, color: stats.underReview > 0 ? "#0092cc" : "var(--foreground-muted)", bg: stats.underReview > 0 ? "rgba(0, 146, 204, 0.08)" : "rgba(107, 114, 128, 0.08)", border: stats.underReview > 0 ? "rgba(0, 146, 204, 0.2)" : "rgba(107, 114, 128, 0.2)" },
                    { label: "השבוע", value: stats.thisWeek, color: "#22c55e", bg: "rgba(34, 197, 94, 0.08)", border: "rgba(34, 197, 94, 0.2)" },
                  ].map((s) => (
                    <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: "0.5rem", padding: "0.6rem", textAlign: "center" }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", marginTop: "0.2rem", fontWeight: 500 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Workload Bar */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.8rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>עומס עבודה</span>
                    <span
                      style={{
                        color: workloadPercent > 80 ? "#ef4444" : "var(--foreground-muted)",
                        fontWeight: 600,
                      }}
                    >
                      {Math.round(workloadPercent)}%
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      borderRadius: "3px",
                      background: "rgba(0, 181, 254, 0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${workloadPercent}%`,
                        background:
                          workloadPercent > 80
                            ? "#ef4444"
                            : workloadPercent > 60
                            ? "#f59e0b"
                            : "var(--accent)",
                        transition: "width 300ms ease",
                      }}
                    />
                  </div>
                </div>

                {/* Skills */}
                {(employee.skills || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {(employee.skills || []).slice(0, 3).map((skill, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "0.3rem 0.6rem",
                          borderRadius: "0.375rem",
                          background: "rgba(0, 181, 254, 0.1)",
                          color: "var(--accent)",
                          fontSize: "0.7rem",
                          fontWeight: 500,
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                    {(employee.skills || []).length > 3 && (
                      <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                        +{employee.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    marginTop: "auto",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenEditModal(employee);
                    }}
                    className="ux-btn"
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: `1px solid var(--border)`,
                      background: "transparent",
                      color: "var(--foreground)",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      transition: "all 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--surface)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "transparent";
                    }}
                  >
                    עריכה
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenDeleteConfirm(employee.id);
                    }}
                    className="ux-btn"
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #ef4444",
                      background: "transparent",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      transition: "all 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "rgba(239, 68, 68, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "transparent";
                    }}
                  >
                    מחק
                  </button>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredEmployees.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--foreground-muted)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👥</div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--foreground)" }}>אין עובדים</h3>
          <p style={{ fontSize: "0.9rem", margin: "0.5rem 0 0 0" }}>
            {search || roleFilter !== "all" ? "לא נמצאו עובדים תואמים" : "התחל בהוספת עובד לצוות"}
          </p>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={editingEmployeeId ? "עריכת עובד" : "הוספת עובד חדש"}
        footer={
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              onClick={handleCloseModal}
              className="ux-btn"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--foreground)",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              ביטול
            </button>
            <button
              onClick={handleSaveEmployee}
              className="ux-btn ux-btn-glow"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              {editingEmployeeId ? "עדכן" : "הוסף"}
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
              שם *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="ux-input"
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
              דוא״ל *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="ux-input"
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
              טלפון
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="ux-input"
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
              תפקיד
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="ux-input"
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
              }}
            >
              <option value="employee">עובד</option>
              <option value="manager">מנהל מחלקה</option>
              <option value="admin">מנהל</option>
              <option value="viewer">צופה</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
              סטטוס
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="ux-input"
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
              }}
            >
              <option value="online">מחובר</option>
              <option value="busy">עסוק</option>
              <option value="offline">לא מחובר</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
              שכר חודשי
            </label>
            <input
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
              className="ux-input"
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
              כישורים (מופרדים בפסיק)
            </label>
            <textarea
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="JavaScript, React, Node.js"
              className="ux-input"
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                minHeight: "70px",
                resize: "vertical",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
              הערות
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="ux-input"
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                minHeight: "70px",
                resize: "vertical",
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="אשר מחיקה"
        footer={
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="ux-btn"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--foreground)",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              ביטול
            </button>
            <button
              onClick={handleConfirmDelete}
              className="ux-btn ux-btn-glow"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                background: "#ef4444",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              מחק
            </button>
          </div>
        }
      >
        <p style={{ fontSize: "0.95rem", color: "var(--foreground-muted)" }}>
          האם אתה בטוח שברצונך להסיר עובד זה? פעולה זו לא ניתנת לביטול.
        </p>
      </Modal>
    </main>
  );
}
