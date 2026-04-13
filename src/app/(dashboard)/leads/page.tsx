"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLeads } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { Lead, LeadStatus, LeadInterestType } from "@/lib/db/schema";

const STATUSES: { id: LeadStatus; label: string; color: string; borderColor: string }[] = [
  { id: "new", label: "חדש", color: "#3b82f6", borderColor: "#3b82f6" },
  { id: "contacted", label: "נוצר קשר", color: "#f59e0b", borderColor: "#f59e0b" },
  { id: "proposal_sent", label: "נשלחה הצעה", color: "#a855f7", borderColor: "#a855f7" },
  { id: "negotiation", label: 'במו"מ', color: "#f97316", borderColor: "#f97316" },
  { id: "won", label: "נסגר", color: "#22c55e", borderColor: "#22c55e" },
  { id: "not_relevant", label: "לא רלוונטי", color: "#6b7280", borderColor: "#6b7280" },
];

const INTEREST_TYPES: { id: LeadInterestType; label: string }[] = [
  { id: "marketing", label: "מרקטינג" },
  { id: "podcast", label: "פודקאסט" },
  { id: "branding", label: "ברנדינג" },
  { id: "website", label: "אתר" },
  { id: "hosting", label: "אחסון" },
  { id: "other", label: "אחר" },
];

const SOURCE_OPTIONS = [
  "קמפיין מיוחד",
  "המלצה",
  "אתר אינטרנט",
  "רשתות חברתיות",
  "ישירות",
  "אירוע",
  "LinkedIn",
  "פייסבוק",
];

const INTEREST_TYPE_COLORS: Record<LeadInterestType, string> = {
  marketing: "#8b5cf6",
  podcast: "#06b6d4",
  branding: "#ec4899",
  website: "#14b8a6",
  hosting: "#f59e0b",
  other: "#6b7280",
};

type ViewMode = "pipeline" | "table";
type SortDirection = "asc" | "desc";
type TableSortBy = "name" | "company" | "amount" | "created";

export default function LeadsPage() {
  const { data: leads, loading, create, update, remove, refetch } = useLeads();
  const toast = useToast();

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterInterestType, setFilterInterestType] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [tableSortBy, setTableSortBy] = useState<TableSortBy>("created");
  const [tableSortDir, setTableSortDir] = useState<SortDirection>("desc");

  // Form state
  const [formData, setFormData] = useState<Partial<Lead>>({
    fullName: "",
    company: "",
    email: "",
    phone: "",
    source: "",
    interestType: "marketing",
    proposalSent: false,
    proposalAmount: 0,
    notes: "",
  });

  const filteredLeads = useMemo(() => {
    let result = [...(leads || [])];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (lead) =>
          (lead.fullName || '').toLowerCase().includes(q) ||
          (lead.company && lead.company.toLowerCase().includes(q)) ||
          (lead.email || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      result = result.filter((lead) => lead.status === filterStatus);
    }

    // Interest type filter
    if (filterInterestType !== "all") {
      result = result.filter((lead) => lead.interestType === filterInterestType);
    }

    // Source filter
    if (filterSource !== "all") {
      result = result.filter((lead) => lead.source === filterSource);
    }

    // Sort for table view
    if (viewMode === "table") {
      result.sort((a, b) => {
        let aVal: any = null;
        let bVal: any = null;

        switch (tableSortBy) {
          case "name":
            aVal = a.fullName;
            bVal = b.fullName;
            break;
          case "company":
            aVal = a.company || "";
            bVal = b.company || "";
            break;
          case "amount":
            aVal = a.proposalAmount || 0;
            bVal = b.proposalAmount || 0;
            break;
          case "created":
            aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            break;
        }

        if (typeof aVal === "string") {
          const cmp = aVal.localeCompare(bVal, "he");
          return tableSortDir === "asc" ? cmp : -cmp;
        } else {
          return tableSortDir === "asc" ? aVal - bVal : bVal - aVal;
        }
      });
    }

    return result;
  }, [leads, searchQuery, filterStatus, filterInterestType, filterSource, viewMode, tableSortBy, tableSortDir]);

  // Premium Stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const safeLeads = leads || [];

    const openProposals = safeLeads.filter(
      (l) => (l.status === "proposal_sent" || l.status === "negotiation") && (l.proposalAmount || 0) > 0
    );

    const totalValue = openProposals.reduce((sum, l) => sum + (l.proposalAmount || 0), 0);

    const closedCount = safeLeads.filter((l) => l.status === "won").length;
    const closureRate =
      safeLeads.length > 0 ? Math.round((closedCount / safeLeads.length) * 100) : 0;

    return {
      total: safeLeads.length,
      newThisWeek: safeLeads.filter((l) => l.createdAt && new Date(l.createdAt) > weekAgo).length,
      openProposalsCount: openProposals.length,
      openProposalsValue: totalValue,
      closureRate,
    };
  }, [leads]);

  // Group leads by status for pipeline view
  const leadsByStatus = useMemo(() => {
    const grouped: Record<LeadStatus, Lead[]> = {
      new: [],
      contacted: [],
      proposal_sent: [],
      negotiation: [],
      won: [],
      not_relevant: [],
    };

    filteredLeads.forEach((lead) => {
      grouped[lead.status].push(lead);
    });

    return grouped;
  }, [filteredLeads]);

  const handleOpenCreate = () => {
    setFormData({
      fullName: "",
      company: "",
      email: "",
      phone: "",
      source: "",
      interestType: "marketing",
      proposalSent: false,
      proposalAmount: 0,
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName?.trim()) {
      toast("שם מלא הוא שדה חובה", "error");
      return;
    }
    if (!formData.email?.trim()) {
      toast("אימייל הוא שדה חובה", "error");
      return;
    }

    try {
      await create({
        fullName: formData.fullName,
        name: formData.fullName,
        company: formData.company || "",
        email: formData.email,
        phone: formData.phone || "",
        source: formData.source || "",
        interestType: formData.interestType || "marketing",
        proposalSent: formData.proposalSent || false,
        proposalAmount: formData.proposalAmount || 0,
        value: formData.proposalAmount || 0,
        notes: formData.notes || "",
        status: "new" as LeadStatus,
        followupDone: false,
        assigneeId: null,
        followUpAt: null,
        convertedAt: null,
        convertedClientId: null,
        convertedEntityType: null,
        convertedEntityId: null,
      });
      toast("ליד חדש נוצר בהצלחה", "success");
      handleCloseModal();
      await refetch();
    } catch (error) {
      toast("שגיאה בשמירת הליד", "error");
    }
  };

  const handleDelete = async (lead: Lead) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את ${lead.fullName || 'הליד'}?`)) {
      return;
    }

    try {
      await remove(lead.id);
      toast("הליד נמחק בהצלחה", "success");
      await refetch();
    } catch (error) {
      toast("שגיאה במחיקת הליד", "error");
    }
  };

  const handleDragStart = (lead: Lead, e: React.DragEvent) => {
    setDraggedLead(lead);
    e.dataTransfer!.effectAllowed = "move";
  };

  const handleDragOver = (status: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (status: LeadStatus, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStatus(null);

    if (!draggedLead) return;

    if (draggedLead.status === status) {
      setDraggedLead(null);
      return;
    }

    try {
      await update(draggedLead.id, { status });
      toast(`עדכן ל${STATUSES.find((s) => s.id === status)?.label}`, "success");
      await refetch();
    } catch (error) {
      toast("שגיאה בעדכון סטטוס הליד", "error");
    } finally {
      setDraggedLead(null);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value || value === 0) return "-";
    return `₪${(value || 0).toLocaleString("he-IL")}`;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("he-IL", { year: "2-digit", month: "2-digit", day: "2-digit" });
  };

  const getInterestTypeLabel = (type: LeadInterestType) => {
    return INTEREST_TYPES.find((t) => t.id === type)?.label || type;
  };

  const isFollowUpOverdue = (lead: Lead): boolean => {
    if (!lead.followUpAt) return false;
    const followUpDate = new Date(lead.followUpAt);
    if (isNaN(followUpDate.getTime())) return false;
    return followUpDate < new Date();
  };

  const isFollowUpUpcoming = (lead: Lead): boolean => {
    if (!lead.followUpAt) return false;
    const now = new Date();
    const followUp = new Date(lead.followUpAt);
    if (isNaN(followUp.getTime())) return false;
    return followUp >= now && followUp <= new Date(now.getTime() + 24 * 60 * 60 * 1000);
  };

  const handleColumnSort = (column: TableSortBy) => {
    if (tableSortBy === column) {
      setTableSortDir(tableSortDir === "asc" ? "desc" : "asc");
    } else {
      setTableSortBy(column);
      setTableSortDir("asc");
    }
  };

  const renderTableHeader = (label: string, column: TableSortBy) => {
    const isActive = tableSortBy === column;
    const arrow = isActive ? (tableSortDir === "asc" ? " ↑" : " ↓") : "";
    return (
      <th
        onClick={() => handleColumnSort(column)}
        style={{
          padding: "1rem",
          textAlign: "right",
          fontWeight: 600,
          color: isActive ? "var(--accent)" : "var(--foreground)",
          cursor: "pointer",
          userSelect: "none",
          transition: "color 150ms ease",
        }}
      >
        {label}
        {arrow}
      </th>
    );
  };

  return (
    <main
      style={{
        maxWidth: "1480px",
        margin: "0 auto",
        padding: "2.5rem 2rem",
        direction: "rtl",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* HEADER SECTION */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "0.5rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <h1
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--foreground)",
                  margin: 0,
                }}
              >
                ניהול לידים
              </h1>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "2.5rem",
                  height: "2.5rem",
                  borderRadius: "0.625rem",
                  backgroundColor: "var(--accent)",
                  color: "white",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                }}
              >
                {stats.total}
              </div>
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--foreground-muted)", margin: "0.5rem 0 0 0" }}>
              מעקב וניהול יעיל של משפך המכירות
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: "var(--accent)",
              color: "white",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.transform = "translateY(-2px)";
              (e.target as HTMLElement).style.boxShadow = "0 8px 16px rgba(0, 181, 254, 0.3)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.transform = "translateY(0)";
              (e.target as HTMLElement).style.boxShadow = "none";
            }}
          >
            + הוסף ליד
          </button>
        </div>

        {/* STATS BAR - Premium Design */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {/* Total Leads */}
          <div
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase" }}>
              סה"כ לידים
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)" }}>
              {stats.total}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
              כל הלידים בקובץ
            </div>
          </div>

          {/* New This Week */}
          <div
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase" }}>
              חדשים השבוע
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#3b82f6" }}>
              {stats.newThisWeek}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
              לידים חדשים בשבוע האחרון
            </div>
          </div>

          {/* Open Proposals */}
          <div
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase" }}>
              הצעות פתוחות
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#a855f7" }}>
              {stats.openProposalsCount}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
              {formatCurrency(stats.openProposalsValue)} בשווי כולל
            </div>
          </div>

          {/* Closure Rate */}
          <div
            style={{
              backgroundColor: "var(--surface-raised)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase" }}>
              שיעור סגירה
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#22c55e" }}>
              {stats.closureRate}%
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
              מכלל הלידים
            </div>
          </div>
        </div>

        {/* VIEW TOGGLE & FILTERS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Segmented Control for View Mode */}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              padding: "0.375rem",
              backgroundColor: "var(--surface-raised)",
              borderRadius: "0.5rem",
              width: "fit-content",
              border: "1px solid var(--border)",
            }}
          >
            <button
              onClick={() => setViewMode("pipeline")}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                border: "none",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 600,
                backgroundColor: viewMode === "pipeline" ? "var(--accent)" : "transparent",
                color: viewMode === "pipeline" ? "white" : "var(--foreground)",
                transition: "all 150ms ease",
              }}
            >
              צינור מכירות
            </button>
            <button
              onClick={() => setViewMode("table")}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                border: "none",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 600,
                backgroundColor: viewMode === "table" ? "var(--accent)" : "transparent",
                color: viewMode === "table" ? "white" : "var(--foreground)",
                transition: "all 150ms ease",
              }}
            >
              טבלה
            </button>
          </div>

          {/* Search & Filters */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input
              type="text"
              placeholder="חיפוש לפי שם, חברה או אימייל..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "0.75rem",
              }}
            >
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
                  color: "var(--foreground)",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <option value="all">כל הסטטוסים</option>
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                value={filterInterestType}
                onChange={(e) => setFilterInterestType(e.target.value)}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
                  color: "var(--foreground)",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <option value="all">כל סוגי העניין</option>
                {INTEREST_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>

              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
                  color: "var(--foreground)",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <option value="all">כל המקורות</option>
                {SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* CONTENT AREA */}
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              color: "var(--foreground-muted)",
            }}
          >
            <div style={{ fontSize: "0.9rem" }}>טוען לידים...</div>
          </div>
        ) : viewMode === "pipeline" ? (
          // PIPELINE VIEW
          <div
            style={{
              display: "flex",
              gap: "1.25rem",
              overflowX: "auto",
              paddingBottom: "1rem",
              paddingRight: "1rem",
              paddingLeft: "1rem",
              marginRight: "-2rem",
              marginLeft: "-2rem",
            }}
          >
            {STATUSES.map((statusConfig) => {
              const statusLeads = leadsByStatus[statusConfig.id];
              const isOverStatus = dragOverStatus === statusConfig.id;
              return (
                <div
                  key={statusConfig.id}
                  style={{
                    minWidth: "340px",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "0.75rem",
                    border: `2px solid ${isOverStatus ? statusConfig.color : "var(--border)"}`,
                    backgroundColor: "var(--surface)",
                    overflow: "hidden",
                    transition: "border-color 200ms ease, box-shadow 200ms ease",
                    boxShadow: isOverStatus ? `0 0 0 3px ${statusConfig.color}15` : "none",
                  }}
                  onDragOver={(e) => handleDragOver(statusConfig.id, e)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(statusConfig.id, e)}
                >
                  {/* Column Header */}
                  <div
                    style={{
                      padding: "1rem",
                      borderBottom: `1px solid var(--border)`,
                      borderTop: `3px solid ${statusConfig.color}`,
                      backgroundColor: "var(--surface-raised)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          width: "0.5rem",
                          height: "0.5rem",
                          borderRadius: "50%",
                          backgroundColor: statusConfig.color,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          color: "var(--foreground)",
                        }}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "1.5rem",
                        height: "1.5rem",
                        borderRadius: "0.375rem",
                        backgroundColor: statusConfig.color + "20",
                        color: statusConfig.color,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      {statusLeads.length}
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div
                    style={{
                      flex: 1,
                      padding: "1rem",
                      minHeight: "500px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                      overflowY: "auto",
                    }}
                  >
                    {statusLeads.length > 0 ? (
                      statusLeads.map((lead) => (
                        <Link
                          key={lead.id}
                          href={`/leads/${lead.id}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div
                            style={{
                              padding: "1rem",
                              borderRadius: "0.625rem",
                              backgroundColor: "var(--surface-raised)",
                              border: `1px solid var(--border)`,
                              cursor: "grab",
                              transition: "all 200ms ease",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.75rem",
                            }}
                            draggable
                            onDragStart={(e) => handleDragStart(lead, e)}
                            onMouseEnter={(el) => {
                              (el.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
                              (el.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                            }}
                            onMouseLeave={(el) => {
                              (el.currentTarget as HTMLElement).style.boxShadow = "none";
                              (el.currentTarget as HTMLElement).style.transform = "translateY(0)";
                            }}
                          >
                            {/* Name & Follow-up Indicator */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: "0.5rem",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.95rem",
                                  fontWeight: 700,
                                  color: "var(--foreground)",
                                  flex: 1,
                                }}
                              >
                                {lead.fullName || 'ללא שם'}
                              </div>
                              {(isFollowUpOverdue(lead) || isFollowUpUpcoming(lead)) && (
                                <div
                                  style={{
                                    width: "0.625rem",
                                    height: "0.625rem",
                                    borderRadius: "50%",
                                    backgroundColor: isFollowUpOverdue(lead) ? "#ef4444" : "#22c55e",
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </div>

                            {/* Company */}
                            {lead.company && (
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  color: "var(--foreground-muted)",
                                  fontWeight: 500,
                                }}
                              >
                                {lead.company}
                              </div>
                            )}

                            {/* Badges Row */}
                            <div
                              style={{
                                display: "flex",
                                gap: "0.5rem",
                                flexWrap: "wrap",
                              }}
                            >
                              {/* Interest Type */}
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "0.35rem 0.65rem",
                                  borderRadius: "0.375rem",
                                  backgroundColor: INTEREST_TYPE_COLORS[lead.interestType] + "20",
                                  color: INTEREST_TYPE_COLORS[lead.interestType],
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                }}
                              >
                                {getInterestTypeLabel(lead.interestType)}
                              </span>

                              {/* Amount */}
                              {(lead.proposalAmount || 0) > 0 && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "0.35rem 0.65rem",
                                    borderRadius: "0.375rem",
                                    backgroundColor: "#22c55e20",
                                    color: "#22c55e",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                  }}
                                >
                                  {formatCurrency(lead.proposalAmount)}
                                </span>
                              )}
                            </div>

                            {/* Source */}
                            {lead.source && (
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--foreground-muted)",
                                  fontWeight: 500,
                                }}
                              >
                                מקור: {lead.source}
                              </div>
                            )}
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: 1,
                          color: "var(--foreground-muted)",
                          fontSize: "0.85rem",
                        }}
                      >
                        אין לידים
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // TABLE VIEW
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "0.75rem",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.9rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      backgroundColor: "var(--surface-raised)",
                    }}
                  >
                    {renderTableHeader("שם", "name")}
                    {renderTableHeader("חברה", "company")}
                    <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>
                      אימייל
                    </th>
                    <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>
                      סטטוס
                    </th>
                    <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>
                      עניין
                    </th>
                    {renderTableHeader("סכום", "amount")}
                    <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>
                      מקור
                    </th>
                    {renderTableHeader("תאריך", "created")}
                    <th style={{ padding: "1rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>
                      פעולות
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length > 0 ? (
                    filteredLeads.map((lead, idx) => (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          backgroundColor: idx % 2 === 0 ? "transparent" : "var(--surface-raised)",
                          transition: "background-color 150ms ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)" + "08";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            idx % 2 === 0 ? "transparent" : "var(--surface-raised)";
                        }}
                      >
                        <td style={{ padding: "1rem", fontWeight: 600 }}>
                          <Link
                            href={`/leads/${lead.id}`}
                            style={{
                              color: "var(--accent)",
                              textDecoration: "none",
                              fontWeight: 600,
                            }}
                          >
                            {lead.fullName}
                          </Link>
                        </td>
                        <td style={{ padding: "1rem", color: "var(--foreground-muted)" }}>
                          {lead.company || "-"}
                        </td>
                        <td style={{ padding: "1rem", color: "var(--foreground-muted)", direction: "ltr" }}>
                          {lead.email || "-"}
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "0.35rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              backgroundColor: STATUSES.find((s) => s.id === lead.status)?.color + "20",
                              color: STATUSES.find((s) => s.id === lead.status)?.color,
                            }}
                          >
                            {STATUSES.find((s) => s.id === lead.status)?.label}
                          </span>
                        </td>
                        <td style={{ padding: "1rem", color: "var(--foreground-muted)" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "0.35rem 0.65rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor: INTEREST_TYPE_COLORS[lead.interestType] + "20",
                              color: INTEREST_TYPE_COLORS[lead.interestType],
                            }}
                          >
                            {getInterestTypeLabel(lead.interestType)}
                          </span>
                        </td>
                        <td style={{ padding: "1rem", color: "var(--foreground-muted)", textAlign: "right" }}>
                          <span style={{ fontWeight: 700, color: (lead.proposalAmount || 0) > 0 ? "var(--accent)" : "var(--foreground-muted)" }}>
                            {formatCurrency(lead.proposalAmount)}
                          </span>
                        </td>
                        <td style={{ padding: "1rem", color: "var(--foreground-muted)" }}>
                          {lead.source || "-"}
                        </td>
                        <td style={{ padding: "1rem", color: "var(--foreground-muted)" }}>
                          {formatDate(lead.createdAt)}
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <button
                            onClick={() => handleDelete(lead)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.375rem",
                              transition: "all 150ms ease",
                            }}
                            onMouseEnter={(e) => {
                              (e.target as HTMLElement).style.backgroundColor = "#ef444420";
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLElement).style.backgroundColor = "transparent";
                            }}
                          >
                            מחק
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: "2.5rem",
                          textAlign: "center",
                          color: "var(--foreground-muted)",
                          fontSize: "0.95rem",
                        }}
                      >
                        לא נמצאו לידים התואמים את המסננים
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ADD LEAD MODAL */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title="הוסף ליד חדש"
        footer={
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-start" }}>
            <button
              onClick={handleCloseModal}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "transparent",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              ביטול
            </button>
            <button
              onClick={handleSubmit}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "var(--accent)",
                color: "white",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.transform = "translateY(-2px)";
                (e.target as HTMLElement).style.boxShadow = "0 8px 16px rgba(0, 181, 254, 0.3)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.transform = "translateY(0)";
                (e.target as HTMLElement).style.boxShadow = "none";
              }}
            >
              צור ליד
            </button>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(e);
          }}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem",
          }}
        >
          {/* Full Name - Full Width */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground)" }}>
              שם מלא *
            </label>
            <input
              type="text"
              value={formData.fullName || ""}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Email - Full Width */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground)" }}>
              אימייל *
            </label>
            <input
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground)" }}>
              טלפון
            </label>
            <input
              type="tel"
              value={formData.phone || ""}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Company */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground)" }}>
              חברה
            </label>
            <input
              type="text"
              value={formData.company || ""}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Interest Type */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground)" }}>
              סוג עניין
            </label>
            <select
              value={formData.interestType || "marketing"}
              onChange={(e) => setFormData({ ...formData, interestType: e.target.value as LeadInterestType })}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {INTEREST_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Source */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground)" }}>
              מקור
            </label>
            <select
              value={formData.source || ""}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <option value="">בחר מקור</option>
              {SOURCE_OPTIONS.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>

          {/* Proposal Amount */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground)" }}>
              סכום הצעה (₪)
            </label>
            <input
              type="number"
              value={formData.proposalAmount || 0}
              onChange={(e) => setFormData({ ...formData, proposalAmount: parseFloat(e.target.value) || 0 })}
              min="0"
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Proposal Sent Checkbox */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem" }}>
            <input
              type="checkbox"
              id="proposalSent"
              checked={formData.proposalSent || false}
              onChange={(e) => setFormData({ ...formData, proposalSent: e.target.checked })}
              style={{ cursor: "pointer", width: "1.1rem", height: "1.1rem" }}
            />
            <label htmlFor="proposalSent" style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--foreground)" }}>
              הצעה נשלחה
            </label>
          </div>

          {/* Notes - Full Width */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground)" }}>
              הערות
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
                minHeight: "100px",
                resize: "none",
              }}
            />
          </div>
        </form>
      </Modal>
    </main>
  );
}
