"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useClients, useProjects, useTasks, useCampaigns } from "@/lib/api/use-entity";
import { useEmployees } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { Client } from "@/lib/db/schema";

const AVATAR_COLORS = ["#00B5FE", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2);
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "פעיל", color: "#22c55e" },
  inactive: { label: "לא פעיל", color: "#f59e0b" },
  prospect: { label: "פוטנציאלי", color: "#a1a1aa" },
};

const CLIENT_TYPE_LABELS: Record<string, { label: string; color: string; emoji?: string }> = {
  marketing: { label: "פרסום ושיווק", color: "#00B5FE", emoji: "📢" },
  branding: { label: "מיתוג", color: "#8b5cf6", emoji: "🎨" },
  websites: { label: "בניית אתרים", color: "#22c55e", emoji: "🌐" },
  hosting: { label: "אחסון", color: "#f59e0b", emoji: "🖥️" },
  podcast: { label: "פודקאסט", color: "#CCFF00", emoji: "🎙️" },
  lead: { label: "ליד", color: "#94a3b8", emoji: "🔗" },
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  current: "#22c55e",
  overdue: "#ef4444",
  pending: "#f59e0b",
  none: "#a1a1aa",
};

type ViewMode = "grid" | "list";
type SortOption = "newest" | "activity" | "name" | "retainer";
type FilterPaymentStatus = "all" | "current" | "overdue" | "pending";
type FilterPortal = "all" | "yes" | "no";

export default function ClientsPage() {
  const router = useRouter();
  const { data: clients, loading, create, update, remove } = useClients();
  const { data: employees } = useEmployees();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const { data: campaigns } = useCampaigns();
  const toast = useToast();

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterClientType, setFilterClientType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterManager, setFilterManager] = useState<string>("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<FilterPaymentStatus>("all");
  const [filterPortal, setFilterPortal] = useState<FilterPortal>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    company: "",
    contactPerson: "",
    email: "",
    phone: "",
    clientType: "marketing" as Client["clientType"],
    businessField: "",
    retainerAmount: 0,
    color: "#00B5FE",
    status: "active" as Client["status"],
    websiteUrl: "",
    facebookPageUrl: "",
    instagramProfileUrl: "",
    tiktokProfileUrl: "",
  });

  // Build employee lookup map
  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((emp) => {
      map.set(emp.id, emp.name || emp.email);
    });
    return map;
  }, [employees]);

  // Filter and sort logic
  const filtered = useMemo(() => {
    let result = clients;

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }

    // Client type filter
    if (filterClientType !== "all") {
      result = result.filter((c) => c.clientType === filterClientType);
    }

    // Status filter
    if (filterStatus !== "all") {
      result = result.filter((c) => c.status === filterStatus);
    }

    // Manager filter
    if (filterManager !== "all") {
      result = result.filter((c) => c.assignedManagerId === filterManager);
    }

    // Payment status filter
    if (filterPaymentStatus !== "all") {
      result = result.filter((c) => c.paymentStatus === filterPaymentStatus);
    }

    // Portal filter
    if (filterPortal === "yes") {
      result = result.filter((c) => c.portalEnabled);
    } else if (filterPortal === "no") {
      result = result.filter((c) => !c.portalEnabled);
    }

    // Sort
    const sorted = [...result];
    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "activity":
        sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "he"));
        break;
      case "retainer":
        sorted.sort((a, b) => b.retainerAmount - a.retainerAmount);
        break;
    }

    return sorted;
  }, [clients, search, filterClientType, filterStatus, filterManager, filterPaymentStatus, filterPortal, sortBy]);

  const openCreate = () => {
    setEditingClient(null);
    setForm({
      name: "",
      company: "",
      contactPerson: "",
      email: "",
      phone: "",
      clientType: "marketing",
      businessField: "",
      retainerAmount: 0,
      color: "#00B5FE",
      status: "active",
      websiteUrl: "",
      facebookPageUrl: "",
      instagramProfileUrl: "",
      tiktokProfileUrl: "",
    });
    setModalOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      company: client.company,
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone,
      clientType: client.clientType,
      businessField: client.businessField,
      retainerAmount: client.retainerAmount,
      color: client.color || "#00B5FE",
      status: client.status,
      websiteUrl: client.websiteUrl || "",
      facebookPageUrl: client.facebookPageUrl || "",
      instagramProfileUrl: client.instagramProfileUrl || "",
      tiktokProfileUrl: client.tiktokProfileUrl || "",
    });
    setModalOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) {
      toast("שם הלקוח הוא שדה חובה", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingClient) {
        await update(editingClient.id, form);
        toast("הלקוח עודכן בהצלחה", "success");
      } else {
        await create(form);
        toast("לקוח חדש נוצר בהצלחה", "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error("[ClientsPage] handleSave error:", err);
      const msg = err instanceof Error ? err.message : "שגיאה לא ידועה";
      toast(`שגיאה בשמירת הלקוח: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`למחוק את ${name}?`)) return;
    try {
      await remove(id);
      toast(`${name} נמחק`, "info");
    } catch {
      toast("שגיאה במחיקת הלקוח", "error");
    }
  };

  const handleExport = () => {
    const csv = [
      ["שם", "חברה", "אימייל", "טלפון", "סטטוס", "סוג לקוח", "ריטיינר"].join(","),
      ...filtered.map((c) =>
        [
          c.name,
          c.company,
          c.email,
          c.phone,
          STATUS_LABELS[c.status]?.label || "",
          CLIENT_TYPE_LABELS[c.clientType]?.label || "",
          c.retainerAmount,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main dir="rtl" style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header Section */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "1.5rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h1 className="mod-page-title">לקוחות</h1>
            <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
              {filtered.length} מתוך {clients.length} לקוחות
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button className="mod-btn-ghost" onClick={handleExport} style={{ fontSize: "0.875rem" }}>
              📥 ייצוא
            </button>
            <div
              style={{
                display: "flex",
                border: "1px solid var(--border)",
                borderRadius: "0.375rem",
                backgroundColor: "var(--surface-raised)",
              }}
            >
              <button
                onClick={() => setViewMode("grid")}
                style={{
                  padding: "0.5rem 0.75rem",
                  backgroundColor: viewMode === "grid" ? "var(--accent)" : "transparent",
                  color: viewMode === "grid" ? "white" : "var(--foreground-muted)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  transition: "all 200ms",
                }}
              >
                ⊞
              </button>
              <button
                onClick={() => setViewMode("list")}
                style={{
                  padding: "0.5rem 0.75rem",
                  backgroundColor: viewMode === "list" ? "var(--accent)" : "transparent",
                  color: viewMode === "list" ? "white" : "var(--foreground-muted)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  transition: "all 200ms",
                  borderRight: "1px solid var(--border)",
                }}
              >
                ≡
              </button>
            </div>
            <button className="mod-btn-primary" onClick={openCreate}>
              + לקוח חדש
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            padding: "1.25rem",
            backgroundColor: "var(--surface-raised)",
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ flex: "1 1 250px", minWidth: "200px" }}>
              <input
                className="mod-search"
                type="text"
                placeholder="🔍 חיפוש לקוח..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* Client Type Filter */}
            <div style={{ minWidth: "150px" }}>
              <select
                className="form-select"
                value={filterClientType}
                onChange={(e) => setFilterClientType(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="all">כל סוגי הלקוחות</option>
                <option value="marketing">פרסום ושיווק</option>
                <option value="branding">מיתוג</option>
                <option value="websites">בניית אתרים</option>
                <option value="podcast">פודקאסט</option>
                <option value="hosting">אחסון</option>
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ minWidth: "140px" }}>
              <select
                className="form-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="all">כל הסטטוסים</option>
                <option value="active">פעיל</option>
                <option value="inactive">לא פעיל</option>
                <option value="prospect">פוטנציאלי</option>
              </select>
            </div>

            {/* Manager Filter */}
            <div style={{ minWidth: "140px" }}>
              <select
                className="form-select"
                value={filterManager}
                onChange={(e) => setFilterManager(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="all">כל המנהלים</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name || emp.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Status Filter */}
            <div style={{ minWidth: "140px" }}>
              <select
                className="form-select"
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value as FilterPaymentStatus)}
                style={{ width: "100%" }}
              >
                <option value="all">כל סטטוסי התשלום</option>
                <option value="current">עדכני</option>
                <option value="overdue">逾期</option>
                <option value="pending">בהמתנה</option>
              </select>
            </div>

            {/* Portal Filter */}
            <div style={{ minWidth: "130px" }}>
              <select
                className="form-select"
                value={filterPortal}
                onChange={(e) => setFilterPortal(e.target.value as FilterPortal)}
                style={{ width: "100%" }}
              >
                <option value="all">כל הפורטלים</option>
                <option value="yes">פורטל מאופשר</option>
                <option value="no">ללא פורטל</option>
              </select>
            </div>
          </div>

          {/* Sorting */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
              מיון:
            </span>
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{ minWidth: "140px" }}
            >
              <option value="newest">חדש ביותר</option>
              <option value="activity">פעילות אחרונה</option>
              <option value="name">שם (א-ז)</option>
              <option value="retainer">ריטיינר (גבוה לנמוך)</option>
            </select>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="mod-empty" style={{ minHeight: "300px" }}>
            <div>טוען...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mod-empty" style={{ minHeight: "300px" }}>
            <div className="mod-empty-icon">👤</div>
            <div style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.5rem" }}>
              {search ? "לא נמצאו לקוחות תואמים" : "אין לקוחות עדיין"}
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", marginBottom: "1.5rem" }}>
              {search ? "נסה לחפש בקריטריונים שונים" : "התחל בהוספת הלקוח הראשון שלך"}
            </div>
            {!search && <button className="mod-btn-primary" onClick={openCreate}>+ הוסף לקוח ראשון</button>}
          </div>
        ) : viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {filtered.map((client) => {
              const displayColor = client.color || avatarColor(client.id);
              const st = STATUS_LABELS[client.status] || STATUS_LABELS.active;
              const ct = CLIENT_TYPE_LABELS[client.clientType] || CLIENT_TYPE_LABELS.marketing;
              const managerName = client.assignedManagerId ? employeeMap.get(client.assignedManagerId) : null;

              const hasSocial =
                client.facebookPageId ||
                client.instagramAccountId ||
                client.tiktokAccountId;

              const ganttIndicator =
                client.annualGanttStatus === "approved"
                  ? { icon: "📊", color: "#22c55e", title: "Gantt אושר" }
                  : client.annualGanttStatus === "draft"
                  ? { icon: "📊", color: "#f59e0b", title: "Gantt טיוטה" }
                  : { icon: "📊", color: "#a1a1aa", title: "אין Gantt" };

              // Calculate stats for this client
              const projectCount = projects.filter((p) => p.clientId === client.id).length;
              const taskCount = tasks.filter((t) => t.clientId === client.id).length;
              const campaignCount = campaigns.filter((c) => c.clientId === client.id).length;

              return (
                <div
                  key={client.id}
                  className="agd-card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    transition: "all 200ms",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = displayColor + "80";
                    e.currentTarget.style.boxShadow = `0 4px 12px ${displayColor}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Color accent bar */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: "4px",
                      height: "100%",
                      backgroundColor: displayColor,
                    }}
                  />

                  {/* Header with avatar and name */}
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    {/* Avatar */}
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: `${displayColor}20`,
                        border: `2px solid ${displayColor}40`,
                        color: displayColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}
                    >
                      {client.logoUrl ? (
                        <Image
                          src={client.logoUrl}
                          alt={client.name}
                          width={48}
                          height={48}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        initials(client.name)
                      )}
                    </div>

                    {/* Name and company */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/clients/${client.id}`} style={{ textDecoration: "none" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            color: "var(--foreground)",
                            lineHeight: 1.2,
                          }}
                        >
                          {client.name}
                        </div>
                      </Link>
                      {client.company && (
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--foreground-muted)",
                            marginTop: "0.15rem",
                          }}
                        >
                          {client.company}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Type badge and manager */}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "0.25rem",
                        background: `${ct.color}15`,
                        color: ct.color,
                        border: `1px solid ${ct.color}30`,
                      }}
                    >
                      {ct.label}
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "0.25rem",
                        background: `${st.color}15`,
                        color: st.color,
                        border: `1px solid ${st.color}30`,
                      }}
                    >
                      {st.label}
                    </span>
                  </div>

                  {/* Manager and retainer */}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", gap: "0.5rem" }}>
                    {managerName ? (
                      <div style={{ color: "var(--foreground-muted)" }}>
                        👤 {managerName}
                      </div>
                    ) : (
                      <div style={{ color: "var(--foreground-subtle)" }}>לא הוקצה עובד אחראי</div>
                    )}
                    {client.retainerAmount > 0 && (
                      <div style={{ color: "var(--accent)", fontWeight: 600 }}>
                        ₪{client.retainerAmount.toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Connected data stats */}
                  <div style={{ fontSize: "0.68rem", color: "var(--foreground-subtle)", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {projectCount > 0 && <span>🎬 {projectCount} פרויקטים</span>}
                    {taskCount > 0 && <span>📋 {taskCount} משימות</span>}
                    {campaignCount > 0 && <span>📣 {campaignCount} קמפיינים</span>}
                  </div>

                  {/* Status indicators */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                      paddingTop: "0.75rem",
                      borderTop: "1px solid var(--border)",
                      flexWrap: "wrap",
                    }}
                  >
                    {client.portalEnabled && (
                      <div title="פורטל מאופשר" style={{ fontSize: "1rem" }}>
                        🟢
                      </div>
                    )}
                    {hasSocial && (
                      <div title="חיבור לרשתות חברתיות" style={{ fontSize: "1rem" }}>
                        📱
                      </div>
                    )}
                    <div title={ganttIndicator.title} style={{ fontSize: "1rem", opacity: 0.7 }}>
                      {ganttIndicator.icon}
                    </div>
                    {client.paymentStatus === "overdue" && (
                      <div title="תשלום逾期" style={{ fontSize: "1rem", color: "#ef4444" }}>
                        ⚠️
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      paddingTop: "0.75rem",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <Link href={`/clients/${client.id}`} style={{ flex: 1, textDecoration: "none" }}>
                      <button
                        className="mod-btn-ghost"
                        style={{ fontSize: "0.75rem", width: "100%" }}
                      >
                        פתח
                      </button>
                    </Link>
                    <button
                      className="mod-btn-ghost"
                      style={{ fontSize: "0.75rem", flex: 1 }}
                      onClick={() => openEdit(client)}
                    >
                      ערוך
                    </button>
                    <button
                      className="mod-btn-ghost"
                      style={{ fontSize: "0.75rem", flex: 1 }}
                      onClick={() => router.push(`/clients/${client.id}?tab=content`)}
                    >
                      תוכן
                    </button>
                    <button
                      className="mod-btn-ghost"
                      style={{ fontSize: "0.75rem", flex: 1 }}
                      onClick={() => router.push(`/clients/${client.id}?tab=content`)}
                    >
                      גאנט
                    </button>
                    <button
                      className="mod-btn-ghost"
                      style={{
                        fontSize: "0.75rem",
                        flex: 1,
                        color: "#ef4444",
                        borderColor: "rgba(239,68,68,0.3)",
                      }}
                      onClick={() => handleDelete(client.id, client.name)}
                    >
                      מחיקה
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: "var(--surface-raised)",
                borderRadius: "0.5rem",
                overflow: "hidden",
                border: "1px solid var(--border)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ textAlign: "right", padding: "1rem", fontWeight: 600, fontSize: "0.875rem" }}>שם</th>
                  <th style={{ textAlign: "right", padding: "1rem", fontWeight: 600, fontSize: "0.875rem" }}>חברה</th>
                  <th style={{ textAlign: "right", padding: "1rem", fontWeight: 600, fontSize: "0.875rem" }}>סוג</th>
                  <th style={{ textAlign: "right", padding: "1rem", fontWeight: 600, fontSize: "0.875rem" }}>מנהל</th>
                  <th style={{ textAlign: "right", padding: "1rem", fontWeight: 600, fontSize: "0.875rem" }}>ריטיינר</th>
                  <th style={{ textAlign: "right", padding: "1rem", fontWeight: 600, fontSize: "0.875rem" }}>מצביעים</th>
                  <th style={{ textAlign: "right", padding: "1rem", fontWeight: 600, fontSize: "0.875rem" }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, idx) => {
                  const displayColor = client.color || avatarColor(client.id);
                  const st = STATUS_LABELS[client.status] || STATUS_LABELS.active;
                  const ct = CLIENT_TYPE_LABELS[client.clientType] || CLIENT_TYPE_LABELS.marketing;
                  const managerName = client.assignedManagerId ? employeeMap.get(client.assignedManagerId) : null;
                  const hasSocial = client.facebookPageId || client.instagramAccountId || client.tiktokAccountId;

                  return (
                    <tr
                      key={client.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        backgroundColor: idx % 2 === 0 ? "transparent" : "var(--surface-raised)",
                      }}
                    >
                      <td style={{ padding: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: `${displayColor}20`,
                            border: `2px solid ${displayColor}40`,
                            color: displayColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            flexShrink: 0,
                            overflow: "hidden",
                          }}
                        >
                          {client.logoUrl ? (
                            <Image
                              src={client.logoUrl}
                              alt={client.name}
                              width={36}
                              height={36}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            initials(client.name)
                          )}
                        </div>
                        <Link href={`/clients/${client.id}`} style={{ textDecoration: "none", color: "var(--foreground)" }}>
                          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                            {client.name}
                          </div>
                        </Link>
                      </td>
                      <td style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
                        {client.company}
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "0.25rem",
                            background: `${ct.color}15`,
                            color: ct.color,
                            border: `1px solid ${ct.color}30`,
                            display: "inline-block",
                          }}
                        >
                          {ct.label}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
                        {managerName || "-"}
                      </td>
                      <td style={{ padding: "1rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--accent)" }}>
                        {client.retainerAmount > 0 ? `₪${client.retainerAmount.toLocaleString()}` : "-"}
                      </td>
                      <td style={{ padding: "1rem", display: "flex", gap: "0.4rem" }}>
                        {client.portalEnabled && <span title="פורטל">🟢</span>}
                        {hasSocial && <span title="רשתות חברתיות">📱</span>}
                        {client.paymentStatus === "overdue" && <span title="תשלום逾期">⚠️</span>}
                      </td>
                      <td style={{ padding: "1rem", display: "flex", gap: "0.3rem" }}>
                        <Link href={`/clients/${client.id}`} style={{ textDecoration: "none" }}>
                          <button
                            className="mod-btn-ghost"
                            style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}
                          >
                            פתח
                          </button>
                        </Link>
                        <button
                          className="mod-btn-ghost"
                          style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}
                          onClick={() => openEdit(client)}
                        >
                          ערוך
                        </button>
                        <button
                          className="mod-btn-ghost"
                          style={{
                            fontSize: "0.7rem",
                            padding: "0.3rem 0.6rem",
                            color: "#ef4444",
                            borderColor: "rgba(239,68,68,0.3)",
                          }}
                          onClick={() => handleDelete(client.id, client.name)}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingClient ? "עריכת לקוח" : "לקוח חדש"}
        footer={
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="mod-btn-ghost" onClick={() => setModalOpen(false)}>
              ביטול
            </button>
            <button type="button" className="mod-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "שומר..." : editingClient ? "שמור שינויים" : "צור לקוח"}
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Row 1: Name and Company */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                שם *
              </label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="שם הלקוח"
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                חברה
              </label>
              <input
                className="form-input"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="שם החברה"
              />
            </div>
          </div>

          {/* Row 2: Contact Person and Phone */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                איש קשר
              </label>
              <input
                className="form-input"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="שם איש קשר"
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                טלפון
              </label>
              <input
                className="form-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="054-000-0000"
                dir="ltr"
              />
            </div>
          </div>

          {/* Row 3: Email */}
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
              אימייל
            </label>
            <input
              className="form-input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              dir="ltr"
            />
          </div>

          {/* Row 4: Client Type and Business Field */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                סוג לקוח
              </label>
              <select
                className="form-select"
                value={form.clientType}
                onChange={(e) => setForm({ ...form, clientType: e.target.value as Client["clientType"] })}
              >
                <option value="marketing">פרסום ושיווק</option>
                <option value="branding">מיתוג</option>
                <option value="websites">בניית אתרים</option>
                <option value="podcast">פודקאסט</option>
                <option value="hosting">אחסון</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                תחום עיסוק
              </label>
              <input
                className="form-input"
                value={form.businessField}
                onChange={(e) => setForm({ ...form, businessField: e.target.value })}
                placeholder="תחום עיסוק"
              />
            </div>
          </div>

          {/* Row 5: Retainer Amount and Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                ריטיינר ₪
              </label>
              <input
                className="form-input"
                type="number"
                value={form.retainerAmount}
                onChange={(e) => setForm({ ...form, retainerAmount: Number(e.target.value) })}
                placeholder="0"
                dir="ltr"
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                סטטוס
              </label>
              <select
                className="form-select"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Client["status"] })}
              >
                <option value="active">פעיל</option>
                <option value="inactive">לא פעיל</option>
                <option value="prospect">פוטנציאלי</option>
              </select>
            </div>
          </div>

          {/* Row 6: Color Picker */}
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
              צבע אישור
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {["#00B5FE", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#ef4444"].map((color) => (
                <button
                  key={color}
                  onClick={() => setForm({ ...form, color })}
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: color,
                    border: form.color === color ? "3px solid var(--foreground)" : "2px solid var(--border)",
                    cursor: "pointer",
                    transition: "all 150ms",
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* External Links Section */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)", margin: "0 0 1rem 0" }}>
              קישורים חיצוניים
            </h4>

            {/* Row 7: Website and Facebook */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  אתר 🌐
                </label>
                <input
                  className="form-input"
                  value={(form as any).websiteUrl || ""}
                  onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  placeholder="https://example.com"
                  dir="ltr"
                />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  Facebook 📘
                </label>
                <input
                  className="form-input"
                  value={(form as any).facebookPageUrl || ""}
                  onChange={(e) => setForm({ ...form, facebookPageUrl: e.target.value })}
                  placeholder="https://facebook.com/page"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Row 8: Instagram and TikTok */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  Instagram 📷
                </label>
                <input
                  className="form-input"
                  value={(form as any).instagramProfileUrl || ""}
                  onChange={(e) => setForm({ ...form, instagramProfileUrl: e.target.value })}
                  placeholder="https://instagram.com/profile"
                  dir="ltr"
                />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", display: "block", marginBottom: "0.35rem" }}>
                  TikTok 🎵
                </label>
                <input
                  className="form-input"
                  value={(form as any).tiktokProfileUrl || ""}
                  onChange={(e) => setForm({ ...form, tiktokProfileUrl: e.target.value })}
                  placeholder="https://tiktok.com/@profile"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </main>
  );
}
