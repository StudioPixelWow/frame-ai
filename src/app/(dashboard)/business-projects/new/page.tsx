"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useClients, useEmployees, useBusinessProjects, useProjectMilestones, useProjectPayments } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import type { BusinessProjectType } from "@/lib/db/schema";

interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  assignedEmployeeId: string;
}

interface Payment {
  id: string;
  amount: number;
  dueDate: string;
  description: string;
}

interface FormData {
  clientId: string;
  projectName: string;
  projectType: BusinessProjectType;
  description: string;
  agreementSigned: boolean;
  assignedManagerId: string;
  startDate: string;
  endDate: string;
}

const PROJECT_TYPES: { id: BusinessProjectType; label: string; icon: string }[] = [
  { id: "branding", label: "מיתוג", icon: "🎨" },
  { id: "website", label: "אתר", icon: "🌐" },
  { id: "campaign", label: "קמפיין", icon: "📢" },
  { id: "general", label: "כללי", icon: "📋" },
];

export default function NewBusinessProjectPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: clients } = useClients();
  const { data: employees } = useEmployees();
  const { create: createProject } = useBusinessProjects();
  const { create: createMilestone } = useProjectMilestones();
  const { create: createPayment } = useProjectPayments();

  const [form, setForm] = useState<FormData>({
    clientId: "",
    projectName: "",
    projectType: "general",
    description: "",
    agreementSigned: false,
    assignedManagerId: "",
    startDate: "",
    endDate: "",
  });

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      {
        id: crypto.randomUUID(),
        title: "",
        description: "",
        dueDate: "",
        assignedEmployeeId: "",
      },
    ]);
  };

  const removeMilestone = (id: string) => {
    setMilestones(milestones.filter((m) => m.id !== id));
  };

  const updateMilestone = (id: string, field: string, value: string) => {
    setMilestones(
      milestones.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      )
    );
  };

  const addPayment = () => {
    setPayments([
      ...payments,
      {
        id: crypto.randomUUID(),
        amount: 0,
        dueDate: "",
        description: "",
      },
    ]);
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter((p) => p.id !== id));
  };

  const updatePayment = (id: string, field: string, value: string | number) => {
    setPayments(
      payments.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.clientId.trim()) {
      toast("בחירת לקוח חובה", "error");
      return;
    }
    if (!form.projectName.trim()) {
      toast("שם פרויקט חובה", "error");
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();

      // Create project
      const createdProject = await createProject({
        clientId: form.clientId,
        projectName: form.projectName,
        projectType: form.projectType,
        description: form.description,
        agreementSigned: form.agreementSigned,
        assignedManagerId: form.assignedManagerId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        projectStatus: "not_started",
        createdAt: now,
        updatedAt: now,
      } as any);

      // Create milestones
      for (const milestone of milestones) {
        if (milestone.title.trim()) {
          try {
            await createMilestone({
              projectId: createdProject.id,
              title: milestone.title,
              description: milestone.description,
              dueDate: milestone.dueDate || null,
              assignedEmployeeId: milestone.assignedEmployeeId || null,
              status: "pending",
              files: [],
              notes: "",
              createdAt: now,
              updatedAt: now,
            } as any);
          } catch (err) {
            console.error("Error creating milestone:", err);
          }
        }
      }

      // Create payments
      for (const payment of payments) {
        if (payment.amount > 0) {
          try {
            await createPayment({
              projectId: createdProject.id,
              clientId: form.clientId,
              amount: payment.amount,
              dueDate: payment.dueDate,
              status: "pending",
              description: payment.description,
              paidAt: null,
              createdAt: now,
              updatedAt: now,
            } as any);
          } catch (err) {
            console.error("Error creating payment:", err);
          }
        }
      }

      toast("הפרויקט נוצר בהצלחה!", "success");
      router.push(`/projects/${createdProject.id}`);
    } catch (error) {
      console.error("Error:", error);
      toast(
        error instanceof Error ? error.message : "שגיאה ביצירת הפרויקט",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "700", margin: "0" }}>פרויקט עסקי חדש</h1>
        <Link
          href="/business-projects"
          style={{
            color: "var(--foreground-muted)",
            textDecoration: "none",
            fontSize: "0.9rem",
            transition: "color 150ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-muted)")}
        >
          ← חזור לפרויקטים
        </Link>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Section 1: Client Selection */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            👥 בחירת לקוח
          </h2>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
              לקוח *
            </label>
            <select
              className="form-select"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              disabled={submitting}
            >
              <option value="">בחר לקוח...</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 2: Project Details */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            📋 פרטי הפרויקט
          </h2>

          {/* Name */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
              שם הפרויקט *
            </label>
            <input
              type="text"
              className="form-input"
              value={form.projectName}
              onChange={(e) => setForm({ ...form, projectName: e.target.value })}
              placeholder="שם הפרויקט"
              disabled={submitting}
            />
          </div>

          {/* Type Selection */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", marginBottom: "0.75rem", color: "var(--foreground)" }}>
              סוג הפרויקט
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.75rem" }}>
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setForm({ ...form, projectType: type.id })}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    border: form.projectType === type.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: form.projectType === type.id ? "rgba(0, 181, 254, 0.08)" : "var(--surface)",
                    cursor: "pointer",
                    transition: "all 150ms",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.375rem",
                    opacity: submitting ? 0.5 : 1,
                  }}
                  disabled={submitting}
                >
                  <span style={{ fontSize: "1.25rem" }}>{type.icon}</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--foreground)" }}>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
              תיאור הפרויקט
            </label>
            <textarea
              className="form-input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="תיאור קצר של הפרויקט"
              rows={3}
              disabled={submitting}
              style={{ fontFamily: "inherit", resize: "vertical" }}
            />
          </div>
        </div>

        {/* Section 3: Agreement & Assignment */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            ⚙️ הגדרות נוספות
          </h2>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.agreementSigned}
                onChange={(e) => setForm({ ...form, agreementSigned: e.target.checked })}
                disabled={submitting}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.8125rem", fontWeight: "600", color: "var(--foreground)" }}>
                החוזה חתום
              </span>
            </label>
          </div>

          {/* Manager */}
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
              מנהל פרויקט
            </label>
            <select
              className="form-select"
              value={form.assignedManagerId}
              onChange={(e) => setForm({ ...form, assignedManagerId: e.target.value })}
              disabled={submitting}
            >
              <option value="">בחר מנהל (אופציונלי)</option>
              {employees?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name || emp.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 4: Dates */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            📅 תאריכים
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
                תאריך התחלה
              </label>
              <input
                type="date"
                className="form-input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                disabled={submitting}
                dir="ltr"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
                תאריך סיום
              </label>
              <input
                type="date"
                className="form-input"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                disabled={submitting}
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Initial Milestones */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            🎯 שלבי פרויקט (שלבים)
          </h2>

          {milestones.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
              עדיין לא הוספו שלבים. לחץ על הכפתור להוסיף את השלב הראשון.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
              {milestones.map((milestone, idx) => (
                <div
                  key={milestone.id}
                  style={{
                    padding: "1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    background: "var(--surface)",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "1rem",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <input
                      type="text"
                      className="form-input"
                      value={milestone.title}
                      onChange={(e) => updateMilestone(milestone.id, "title", e.target.value)}
                      placeholder="שם השלב"
                      disabled={submitting}
                      style={{ fontSize: "0.875rem" }}
                    />
                    <textarea
                      className="form-input"
                      value={milestone.description}
                      onChange={(e) => updateMilestone(milestone.id, "description", e.target.value)}
                      placeholder="תיאור השלב"
                      rows={2}
                      disabled={submitting}
                      style={{ fontSize: "0.8125rem", fontFamily: "inherit", resize: "none" }}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <input
                        type="date"
                        className="form-input"
                        value={milestone.dueDate}
                        onChange={(e) => updateMilestone(milestone.id, "dueDate", e.target.value)}
                        placeholder="תאריך ביצוע"
                        disabled={submitting}
                        dir="ltr"
                        style={{ fontSize: "0.8125rem" }}
                      />
                      <select
                        className="form-select"
                        value={milestone.assignedEmployeeId}
                        onChange={(e) => updateMilestone(milestone.id, "assignedEmployeeId", e.target.value)}
                        disabled={submitting}
                        style={{ fontSize: "0.8125rem" }}
                      >
                        <option value="">מוקצה ל...</option>
                        {employees?.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name || emp.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMilestone(milestone.id)}
                    disabled={submitting}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.375rem",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      height: "fit-content",
                    }}
                  >
                    🗑 הסר
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addMilestone}
            disabled={submitting}
            className="mod-btn-ghost"
            style={{ fontSize: "0.8125rem", padding: "0.45rem 0.875rem" }}
          >
            + הוסף שלב
          </button>
        </div>

        {/* Section 6: Payment Schedule */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            💰 לוח תשלומים
          </h2>

          {payments.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
              עדיין לא הוסף לוח תשלומים. לחץ על הכפתור להוסיף תשלום ראשון.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  style={{
                    padding: "1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    background: "var(--surface)",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "1rem",
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: "600", marginBottom: "0.25rem", color: "var(--foreground-muted)" }}>
                        סכום
                      </label>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <span style={{ position: "absolute", insetInlineStart: "0.5rem", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                          ₪
                        </span>
                        <input
                          type="number"
                          className="form-input"
                          value={payment.amount}
                          onChange={(e) => updatePayment(payment.id, "amount", parseInt(e.target.value) || 0)}
                          placeholder="0"
                          disabled={submitting}
                          dir="ltr"
                          style={{ paddingInlineStart: "2rem", fontSize: "0.8125rem" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: "600", marginBottom: "0.25rem", color: "var(--foreground-muted)" }}>
                        תאריך
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={payment.dueDate}
                        onChange={(e) => updatePayment(payment.id, "dueDate", e.target.value)}
                        disabled={submitting}
                        dir="ltr"
                        style={{ fontSize: "0.8125rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: "600", marginBottom: "0.25rem", color: "var(--foreground-muted)" }}>
                        תיאור
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={payment.description}
                        onChange={(e) => updatePayment(payment.id, "description", e.target.value)}
                        placeholder="תיאור התשלום"
                        disabled={submitting}
                        style={{ fontSize: "0.8125rem" }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePayment(payment.id)}
                    disabled={submitting}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.375rem",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      height: "fit-content",
                    }}
                  >
                    🗑 הסר
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addPayment}
            disabled={submitting}
            className="mod-btn-ghost"
            style={{ fontSize: "0.8125rem", padding: "0.45rem 0.875rem" }}
          >
            + הוסף תשלום
          </button>
        </div>

        {/* Bottom Action Bar */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "flex-end",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <Link
            href="/business-projects"
            style={{
              padding: "0.45rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              background: "none",
              color: "var(--foreground-muted)",
              fontSize: "0.8125rem",
              fontWeight: "600",
              cursor: "pointer",
              textDecoration: "none",
              transition: "all 150ms",
              display: "inline-flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-muted)";
              e.currentTarget.style.color = "var(--foreground)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--foreground-muted)";
            }}
          >
            ביטול
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="mod-btn-primary"
            style={{
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "יוצר..." : "צור פרויקט"}
          </button>
        </div>
      </form>
    </div>
  );
}
