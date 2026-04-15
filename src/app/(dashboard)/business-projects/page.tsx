"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBusinessProjects, useProjectMilestones, useProjectPayments, useClients, useEmployees } from "@/lib/api/use-entity";
import type { BusinessProject, BusinessProjectType, BusinessProjectStatus, ClientType } from "@/lib/db/schema";
import { useToast } from "@/components/ui/toast";

type ViewMode = "grid" | "list";

function getProjectTypeColor(type: BusinessProjectType): string {
  const colors: Record<BusinessProjectType, string> = {
    branding: "#ec4899",
    website: "#10b981",
    campaign: "#f59e0b",
    podcast: "#8b5cf6",
    general: "#6b7280",
  };
  return colors[type] || "#6b7280";
}

function getProjectTypeLabel(type: BusinessProjectType): string {
  const labels: Record<BusinessProjectType, string> = {
    branding: "מיתוג",
    website: "אתר",
    campaign: "קמפיין",
    podcast: "פודקאסט",
    general: "כללי",
  };
  return labels[type] || type;
}

function getStatusColor(status: BusinessProjectStatus): string {
  const colors: Record<BusinessProjectStatus, string> = {
    not_started: "#6b7280",
    in_progress: "#f59e0b",
    waiting_for_client: "#8b5cf6",
    completed: "#22c55e",
  };
  return colors[status] || "#6b7280";
}

function getStatusLabel(status: BusinessProjectStatus): string {
  const labels: Record<BusinessProjectStatus, string> = {
    not_started: "לא התחיל",
    in_progress: "בתהליך",
    waiting_for_client: "בהמתנה ללקוח",
    completed: "הושלם",
  };
  return labels[status] || status;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 0 }).format(amount);
}

type ClientFormData = {
  name: string;
  company: string;
  email: string;
  phone: string;
  clientType: ClientType;
};

type ProjectFormData = {
  projectName: string;
  clientId: string;
  projectType: BusinessProjectType;
  description: string;
  startDate: string;
  assignedManagerId: string;
};

export default function BusinessProjectsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: projects, loading: projectsLoading, create: createProject, refetch: refetchProjects } = useBusinessProjects();
  const { data: milestones } = useProjectMilestones();
  const { data: payments } = useProjectPayments();
  const { data: clients, create: createClientHook, refetch: refetchClients } = useClients();
  const { data: employees } = useEmployees();

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterType, setFilterType] = useState<BusinessProjectType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<BusinessProjectStatus | "all">("all");
  const [filterClientId, setFilterClientId] = useState<string | "all">("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "status">("date");
  const [search, setSearch] = useState("");

  // Create project modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const [projectForm, setProjectForm] = useState<ProjectFormData>({
    projectName: "",
    clientId: "",
    projectType: "general",
    description: "",
    startDate: "",
    assignedManagerId: "",
  });

  const [clientForm, setClientForm] = useState<ClientFormData>({
    name: "",
    company: "",
    email: "",
    phone: "",
    clientType: "branding",
  });

  // Auto-assign project manager from client when client is selected
  useEffect(() => {
    if (projectForm.clientId && clients) {
      const selectedClient = clients.find(c => c.id === projectForm.clientId);
      if (selectedClient?.assignedManagerId && !projectForm.assignedManagerId) {
        setProjectForm(prev => ({
          ...prev,
          assignedManagerId: selectedClient.assignedManagerId || ""
        }));
      }
    }
  }, [projectForm.clientId, clients]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = projects || [];

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.projectName.toLowerCase().includes(q) ||
          (clients?.find((c) => c.id === p.clientId)?.name || "").toLowerCase().includes(q)
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter((p) => p.projectType === filterType);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((p) => p.projectStatus === filterStatus);
    }

    if (filterClientId !== "all") {
      filtered = filtered.filter((p) => p.clientId === filterClientId);
    }

    // Sort
    if (sortBy === "name") {
      filtered.sort((a, b) => a.projectName.localeCompare(b.projectName));
    } else if (sortBy === "status") {
      const statusOrder: Record<BusinessProjectStatus, number> = {
        not_started: 0,
        in_progress: 1,
        waiting_for_client: 2,
        completed: 3,
      };
      filtered.sort((a, b) => statusOrder[a.projectStatus] - statusOrder[b.projectStatus]);
    } else {
      // date (newest first)
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
  }, [projects, search, filterType, filterStatus, filterClientId, sortBy, clients]);

  const getProjectProgress = (projectId: string): { approved: number; total: number } => {
    const projectMilestones = (milestones || []).filter((m) => m.projectId === projectId);
    const approved = projectMilestones.filter((m) => m.status === "approved").length;
    return { approved, total: projectMilestones.length };
  };

  const getNextPayment = (projectId: string): { amount: number; date: string } | null => {
    const projectPayments = (payments || []).filter((p) => p.projectId === projectId && p.status === "pending");
    if (projectPayments.length === 0) return null;
    projectPayments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return { amount: projectPayments[0].amount, date: projectPayments[0].dueDate };
  };

  const getClientName = (clientId: string): string => {
    return clients?.find((c) => c.id === clientId)?.name || "לא זוהה";
  };

  const handleCreateClient = async () => {
    if (!clientForm.name || !clientForm.email || !clientForm.phone) {
      toast("אנא מלא את כל השדות", "error");
      return;
    }

    try {
      const newClient = await createClientHook({
        name: clientForm.name,
        company: clientForm.company,
        email: clientForm.email,
        phone: clientForm.phone,
        clientType: clientForm.clientType,
        contactPerson: clientForm.name,
        logoUrl: "",
        color: "#3b82f6",
        businessField: "",
        marketingGoals: "",
        keyMarketingMessages: "",
        assignedManagerId: null,
        websiteUrl: "",
        facebookPageUrl: "",
        instagramProfileUrl: "",
        tiktokProfileUrl: "",
        retainerAmount: 0,
        retainerDay: 1,
        paymentStatus: "none",
        nextPaymentDate: null,
        status: "active",
        notes: "",
        convertedFromLead: null,
        portalEnabled: false,
        portalUserId: null,
        lastPortalLoginAt: null,
        facebookPageId: "",
        facebookPageName: "",
        instagramAccountId: "",
        instagramUsername: "",
        tiktokAccountId: "",
        tiktokUsername: "",
        monthlyGanttStatus: "none",
        annualGanttStatus: "none",
      } as any);
      setProjectForm({ ...projectForm, clientId: newClient.id });
      setClientForm({ name: "", company: "", email: "", phone: "", clientType: "branding" });
      setShowNewClientForm(false);
      toast("לקוח נוצר בהצלחה", "success");
    } catch (error) {
      console.error("Error creating client:", error);
      toast("שגיאה ביצירת לקוח", "error");
    }
  };

  const handleCreateProject = async () => {
    if (!projectForm.projectName || !projectForm.clientId) {
      toast("אנא מלא את השדות: שם פרויקט ובחר לקוח", "error");
      return;
    }

    setCreatingProject(true);
    try {
      const newProject = await createProject({
        projectName: projectForm.projectName,
        clientId: projectForm.clientId,
        projectType: projectForm.projectType,
        description: projectForm.description,
        agreementSigned: false,
        projectStatus: "not_started",
        startDate: projectForm.startDate || null,
        endDate: null,
        assignedManagerId: projectForm.assignedManagerId || null,
      } as any);
      setProjectForm({ projectName: "", clientId: "", projectType: "general", description: "", startDate: "", assignedManagerId: "" });
      setShowCreateModal(false);
      toast("פרויקט נוצר בהצלחה", "success");
      router.push(`/business-projects/${newProject.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      toast("שגיאה ביצירת פרויקט", "error");
    } finally {
      setCreatingProject(false);
    }
  };

  return (
    <main dir="rtl" style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: "700", margin: "0", marginBottom: "0.25rem" }}>פרויקטים עסקיים</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", margin: "0" }}>
            {filteredProjects.length} מתוך {projects?.length || 0} פרויקטים
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="mod-btn-primary"
          style={{ textDecoration: "none", display: "inline-block", padding: "0.5rem 1.125rem", border: "none", cursor: "pointer" }}
        >
          + צור פרויקט חדש
        </button>
      </div>

      {/* Filter and View Controls */}
      {(projects?.length || 0) > 0 && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1rem",
            marginBottom: "1.5rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            alignItems: "end",
          }}
        >
          {/* Search */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", marginBottom: "0.375rem", color: "var(--foreground-muted)" }}>
              חיפוש
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="שם פרויקט או לקוח..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: "0.875rem" }}
            />
          </div>

          {/* Filter by Type */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", marginBottom: "0.375rem", color: "var(--foreground-muted)" }}>
              סוג פרויקט
            </label>
            <select
              className="form-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              style={{ fontSize: "0.875rem" }}
            >
              <option value="all">הכל</option>
              <option value="branding">מיתוג</option>
              <option value="website">אתר</option>
              <option value="campaign">קמפיין</option>
              <option value="podcast">פודקאסט</option>
              <option value="general">כללי</option>
            </select>
          </div>

          {/* Filter by Status */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", marginBottom: "0.375rem", color: "var(--foreground-muted)" }}>
              סטטוס
            </label>
            <select
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              style={{ fontSize: "0.875rem" }}
            >
              <option value="all">הכל</option>
              <option value="not_started">לא התחיל</option>
              <option value="in_progress">בתהליך</option>
              <option value="waiting_for_client">בהמתנה ללקוח</option>
              <option value="completed">הושלם</option>
            </select>
          </div>

          {/* Filter by Client */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", marginBottom: "0.375rem", color: "var(--foreground-muted)" }}>
              לקוח
            </label>
            <select
              className="form-select"
              value={filterClientId}
              onChange={(e) => setFilterClientId(e.target.value)}
              style={{ fontSize: "0.875rem" }}
            >
              <option value="all">כל הלקוחות</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", marginBottom: "0.375rem", color: "var(--foreground-muted)" }}>
              מיון
            </label>
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ fontSize: "0.875rem" }}
            >
              <option value="date">לפי תאריך</option>
              <option value="name">לפי שם</option>
              <option value="status">לפי סטטוס</option>
            </select>
          </div>

          {/* View Toggle */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setViewMode("grid")}
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "0.5rem",
                border: viewMode === "grid" ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: viewMode === "grid" ? "rgba(0, 181, 254, 0.1)" : "var(--surface)",
                color: "var(--foreground)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "600",
              }}
              title="תצוגת רשת"
            >
              ⊞
            </button>
            <button
              onClick={() => setViewMode("list")}
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "0.5rem",
                border: viewMode === "list" ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: viewMode === "list" ? "rgba(0, 181, 254, 0.1)" : "var(--surface)",
                color: "var(--foreground)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "600",
              }}
              title="תצוגת רשימה"
            >
              ≡
            </button>
          </div>
        </div>
      )}

      {/* Projects */}
      {projectsLoading ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--foreground-muted)" }}>
          טוען פרויקטים...
        </div>
      ) : filteredProjects.length === 0 && (projects?.length || 0) === 0 ? (
        /* Empty State */
        <div
          style={{
            border: "2px dashed var(--border)",
            borderRadius: "0.75rem",
            padding: "4rem 2rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
            }}
          >
            📊
          </div>
          <div>
            <p style={{ fontSize: "1rem", fontWeight: "600", margin: "0", marginBottom: "0.375rem" }}>
              אין פרויקטים עסקיים עדיין
            </p>
            <p style={{ color: "var(--foreground-muted)", fontSize: "0.875rem", margin: "0" }}>
              צור פרויקט ראשון כדי להתחיל לנהל את העבודה שלך
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mod-btn-primary"
            style={{ marginTop: "0.5rem", padding: "0.5rem 1.125rem" }}
          >
            + צור פרויקט חדש
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        /* No Results */
        <div
          style={{
            textAlign: "center",
            padding: "2rem 1rem",
            color: "var(--foreground-muted)",
            borderRadius: "0.75rem",
            border: "1px solid var(--border)",
            background: "var(--surface-raised)",
          }}
        >
          <p style={{ fontSize: "0.9rem", margin: "0", marginBottom: "0.5rem" }}>לא נמצאו פרויקטים התואמים לסינון</p>
          <button
            className="mod-btn-ghost"
            onClick={() => {
              setSearch("");
              setFilterType("all");
              setFilterStatus("all");
              setFilterClientId("all");
            }}
            style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem", marginTop: "0.5rem" }}
          >
            נקה סינונים
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {filteredProjects.map((project) => {
            const progress = getProjectProgress(project.id);
            const nextPayment = getNextPayment(project.id);
            const progressPercent = progress.total > 0 ? (progress.approved / progress.total) * 100 : 0;

            return (
              <div
                key={project.id}
                className="agd-card"
                style={{
                  padding: "1.25rem",
                  cursor: "pointer",
                  transition: "all 150ms",
                }}
                onClick={() => router.push(`/business-projects/${project.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.12)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "";
                  e.currentTarget.style.transform = "";
                }}
              >
                {/* Header with type and status badges */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.7rem",
                      fontWeight: "600",
                      color: "#fff",
                      backgroundColor: getProjectTypeColor(project.projectType),
                    }}
                  >
                    {getProjectTypeLabel(project.projectType)}
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.7rem",
                      fontWeight: "600",
                      color: "#fff",
                      backgroundColor: getStatusColor(project.projectStatus),
                    }}
                  >
                    {getStatusLabel(project.projectStatus)}
                  </span>
                </div>

                {/* Project Name */}
                <h3 style={{ fontSize: "1.125rem", fontWeight: "700", margin: "0 0 0.5rem 0", color: "var(--foreground)" }}>
                  {project.projectName}
                </h3>

                {/* Client Name */}
                <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", margin: "0 0 1rem 0" }}>
                  👤 {getClientName(project.clientId)}
                </p>

                {/* Description */}
                {project.description && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--foreground-muted)", margin: "0 0 1rem 0", lineHeight: "1.4" }}>
                    {project.description.substring(0, 100)}
                    {project.description.length > 100 ? "..." : ""}
                  </p>
                )}

                {/* Progress Bar */}
                {progress.total > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginBottom: "0.375rem" }}>
                      התקדמות: {progress.approved} / {progress.total} שלבים
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: "6px",
                        backgroundColor: "var(--border)",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${progressPercent}%`,
                          height: "100%",
                          backgroundColor: "var(--accent)",
                          transition: "width 200ms ease",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Next Payment */}
                {nextPayment && (
                  <div style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: "0.5rem", background: "var(--surface)" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                      תשלום הבא
                    </div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--foreground)" }}>
                      {formatCurrency(nextPayment.amount)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                      {formatDate(nextPayment.date)}
                    </div>
                  </div>
                )}

                {/* Footer info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
                  <div>
                    {project.agreementSigned ? (
                      <span style={{ color: "#22c55e" }}>✓ חוזה חתום</span>
                    ) : (
                      <span style={{ color: "#ef4444" }}>✕ חוזה לא חתום</span>
                    )}
                  </div>
                  {project.assignedManagerId && (
                    <div style={{ fontSize: "0.75rem" }}>מנהל מוקצה</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filteredProjects.map((project) => {
            const progress = getProjectProgress(project.id);
            const nextPayment = getNextPayment(project.id);
            const progressPercent = progress.total > 0 ? (progress.approved / progress.total) * 100 : 0;

            return (
              <div
                key={project.id}
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  padding: "1rem",
                  cursor: "pointer",
                  transition: "all 150ms",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: "1rem",
                }}
                onClick={() => router.push(`/business-projects/${project.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.375rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.2rem 0.625rem",
                        borderRadius: "0.3rem",
                        fontSize: "0.65rem",
                        fontWeight: "600",
                        color: "#fff",
                        backgroundColor: getProjectTypeColor(project.projectType),
                      }}
                    >
                      {getProjectTypeLabel(project.projectType)}
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.2rem 0.625rem",
                        borderRadius: "0.3rem",
                        fontSize: "0.65rem",
                        fontWeight: "600",
                        color: "#fff",
                        backgroundColor: getStatusColor(project.projectStatus),
                      }}
                    >
                      {getStatusLabel(project.projectStatus)}
                    </span>
                  </div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: "600", margin: "0 0 0.25rem 0", color: "var(--foreground)" }}>
                    {project.projectName}
                  </h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", margin: "0" }}>
                    {getClientName(project.clientId)} • {project.agreementSigned ? "✓ חוזה" : "✕ חוזה"} {nextPayment && `• ${formatCurrency(nextPayment.amount)}`}
                  </p>
                  {progress.total > 0 && (
                    <div style={{ marginTop: "0.375rem" }}>
                      <div
                        style={{
                          width: "150px",
                          height: "4px",
                          backgroundColor: "var(--border)",
                          borderRadius: "2px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${progressPercent}%`,
                            height: "100%",
                            backgroundColor: "var(--accent)",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
                    {progress.total > 0 ? `${progress.approved}/${progress.total}` : "-"}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>שלבים</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "auto",
              direction: "rtl",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--foreground)", margin: "0 0 1.5rem 0" }}>
              צור פרויקט חדש
            </h2>

            {/* Project Name */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--foreground)", display: "block", marginBottom: "0.375rem" }}>
                שם פרויקט
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="הכנס שם פרויקט"
                value={projectForm.projectName}
                onChange={(e) => setProjectForm({ ...projectForm, projectName: e.target.value })}
                style={{ fontSize: "0.875rem" }}
              />
            </div>

            {/* Client Selector with Add New Client Option */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--foreground)", display: "block", marginBottom: "0.375rem" }}>
                לקוח
              </label>
              <select
                className="form-select"
                value={projectForm.clientId}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setShowNewClientForm(true);
                    setProjectForm({ ...projectForm, clientId: "" });
                  } else {
                    setProjectForm({ ...projectForm, clientId: e.target.value });
                    setShowNewClientForm(false);
                  }
                }}
                style={{ fontSize: "0.875rem" }}
              >
                <option value="">בחר לקוח</option>
                <option value="__new__">➕ הוסף לקוח חדש</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Inline New Client Form */}
            {showNewClientForm && (
              <div
                style={{
                  backgroundColor: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  padding: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <h4 style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--foreground)", margin: "0 0 0.75rem 0" }}>
                  פרטי לקוח חדש
                </h4>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                    שם
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="שם הלקוח"
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    style={{ fontSize: "0.875rem" }}
                  />
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                    חברה
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="שם החברה"
                    value={clientForm.company}
                    onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })}
                    style={{ fontSize: "0.875rem" }}
                  />
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                    דוא״ל
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="דוא״ל"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    style={{ fontSize: "0.875rem" }}
                  />
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                    טלפון
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="טלפון"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    style={{ fontSize: "0.875rem" }}
                  />
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--foreground-muted)", display: "block", marginBottom: "0.25rem" }}>
                    סוג לקוח
                  </label>
                  <select
                    className="form-select"
                    value={clientForm.clientType}
                    onChange={(e) => setClientForm({ ...clientForm, clientType: e.target.value as ClientType })}
                    style={{ fontSize: "0.875rem" }}
                  >
                    <option value="marketing">פרסום ושיווק</option>
                    <option value="branding">מיתוג</option>
                    <option value="websites">בניית אתרים</option>
                    <option value="podcast">פודקאסט</option>
                    <option value="hosting">אחסון</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={handleCreateClient}
                    className="mod-btn-primary"
                    style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}
                  >
                    שמור לקוח
                  </button>
                  <button
                    onClick={() => setShowNewClientForm(false)}
                    className="mod-btn-ghost"
                    style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {/* Project Type */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--foreground)", display: "block", marginBottom: "0.375rem" }}>
                סוג פרויקט
              </label>
              <select
                className="form-select"
                value={projectForm.projectType}
                onChange={(e) => setProjectForm({ ...projectForm, projectType: e.target.value as BusinessProjectType })}
                style={{ fontSize: "0.875rem" }}
              >
                <option value="general">כללי</option>
                <option value="branding">מיתוג</option>
                <option value="website">בניית אתרים</option>
                <option value="campaign">קמפיין</option>
                <option value="podcast">פודקאסט</option>
              </select>
            </div>

            {/* Description */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--foreground)", display: "block", marginBottom: "0.375rem" }}>
                תיאור
              </label>
              <textarea
                className="form-input"
                placeholder="תיאור הפרויקט"
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                style={{ fontSize: "0.875rem", minHeight: "100px" }}
              />
            </div>

            {/* Start Date */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--foreground)", display: "block", marginBottom: "0.375rem" }}>
                תאריך התחלה
              </label>
              <input
                type="date"
                className="form-input"
                value={projectForm.startDate}
                onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                style={{ fontSize: "0.875rem" }}
              />
            </div>

            {/* Assigned Manager */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--foreground)", display: "block", marginBottom: "0.375rem" }}>
                מנהל מוקצה
              </label>
              <select
                className="form-select"
                value={projectForm.assignedManagerId}
                onChange={(e) => setProjectForm({ ...projectForm, assignedManagerId: e.target.value })}
                style={{ fontSize: "0.875rem" }}
              >
                <option value="">לא בחר</option>
                {employees?.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateModal(false)}
                className="mod-btn-ghost"
                style={{ padding: "0.5rem 1.125rem" }}
              >
                ביטול
              </button>
              <button
                onClick={handleCreateProject}
                className="mod-btn-primary"
                disabled={creatingProject}
                style={{ padding: "0.5rem 1.125rem" }}
              >
                {creatingProject ? "יוצר..." : "צור פרויקט"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
