"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLeads } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { Lead, LeadInterestType, LeadStatus } from "@/lib/db/schema";
import { fireConfetti } from "@/lib/confetti";

const INTEREST_TYPE_LABELS: Record<LeadInterestType, string> = {
  marketing: "מרקטינג",
  podcast: "פודקאסט",
  branding: "ברנדינג",
  website: "אתר",
  hosting: "אחסון",
  other: "אחר",
};

const STATUS_LABELS: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "חדש", color: "#3b82f6" },
  assigned: { label: "שויך", color: "#6366f1" },
  contacted: { label: "נוצר קשר", color: "#f59e0b" },
  no_answer: { label: "לא ענה", color: "#f97316" },
  interested: { label: "מתעניין", color: "#06b6d4" },
  proposal_sent: { label: "נשלחה הצעה", color: "#a855f7" },
  negotiation: { label: 'במו"מ', color: "#ec4899" },
  meeting_set: { label: "נקבעה פגישה", color: "#14b8a6" },
  won: { label: "נסגר", color: "#22c55e" },
  lost: { label: "אבוד", color: "#ef4444" },
  not_relevant: { label: "לא רלוונטי", color: "#6b7280" },
  duplicate: { label: "כפול", color: "#9ca3af" },
};

const CONVERSION_OPTIONS = [
  { id: "marketing_client", label: "לקוח שיווק", icon: "📢" },
  { id: "podcast_client", label: "לקוח פודקאסט", icon: "🎙️" },
  { id: "branding_project", label: "פרויקט ברנדינג", icon: "🎨" },
  { id: "website_project", label: "פרויקט אתר", icon: "🌐" },
  { id: "hosting_client", label: "לקוח אחסון", icon: "🖥️" },
];

type EditingField = null | "fullName" | "company" | "email" | "phone" | "source" | "notes";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = (params?.id as string) || "";

  const { data: leads, loading, update, remove, refetch } = useLeads();
  const toast = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState("");
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalAmount, setProposalAmount] = useState(0);

  useEffect(() => {
    if (leads && leadId) {
      const found = leads.find((l) => l.id === leadId);
      setLead(found || null);
    }
  }, [leads, leadId]);

  if (loading) {
    return (
      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ color: "var(--foreground-muted)" }}>טוען פרטי ליד...</div>
        </div>
      </main>
    );
  }

  if (!lead) {
    return (
      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: "1.5rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem" }}>❌</div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>הליד לא נמצא</h2>
            <p style={{ color: "var(--foreground-muted)", marginBottom: "1.5rem" }}>
              לא יכולנו למצוא את הליד שחיפשת.
            </p>
          </div>
          <Link
            href="/leads"
            style={{
              display: "inline-block",
              padding: "0.5rem 1.125rem",
              backgroundColor: "var(--accent)",
              color: "white",
              borderRadius: "0.5rem",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            ← חזור ללידים
          </Link>
        </div>
      </main>
    );
  }

  const handleStartEdit = (field: EditingField, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const handleSaveEdit = async () => {
    if (!editingField) return;

    const updateData: Partial<Lead> = {};
    (updateData as any)[editingField] = editValue;

    try {
      await update(lead.id, updateData);
      setLead({ ...lead, ...updateData });
      toast("השדה עודכן בהצלחה", "success");
      setEditingField(null);
      await refetch();
    } catch (error) {
      toast("שגיאה בעדכון השדה", "error");
    }
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    try {
      await update(lead.id, { status: newStatus });
      setLead({ ...lead, status: newStatus });
      toast("סטטוס עודכן בהצלחה", "success");
      await refetch();
    } catch (error) {
      toast("שגיאה בעדכון הסטטוס", "error");
    }
  };

  const handleMarkProposalSent = async () => {
    try {
      const updateData = {
        proposalSent: true,
        proposalAmount: proposalAmount || lead.proposalAmount,
        status: "proposal_sent" as LeadStatus,
      };
      await update(lead.id, updateData);
      setLead({ ...lead, ...updateData });
      toast("הצעה סומנה כנשלחה", "success");
      setShowProposalModal(false);
      await refetch();
    } catch (error) {
      toast("שגיאה בעדכון הצעה", "error");
    }
  };

  const handleMarkNotRelevant = async () => {
    try {
      await update(lead.id, { status: "not_relevant" });
      setLead({ ...lead, status: "not_relevant" });
      toast("ליד סומן כלא רלוונטי", "success");
      await refetch();
    } catch (error) {
      toast("שגיאה בעדכון הסטטוס", "error");
    }
  };

  const handleConvert = async (option: string) => {
    try {
      const res = await fetch(`/api/data/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convertTo: option }),
      });

      if (!res.ok) {
        throw new Error("Failed to convert");
      }

      const data = await res.json();
      toast("הליד הומר בהצלחה", "success");
      fireConfetti(40);
      setShowConversionModal(false);
      await refetch();

      // Navigate to the new entity
      if (data.entityType === "client") {
        router.push(`/clients/${data.entity?.id || data.entityId}`);
      } else if (data.entityType === "project") {
        router.push(`/business-projects/${data.entity?.id || data.entityId}`);
      }
    } catch (error) {
      toast("שגיאה בהמרת הליד", "error");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את ${lead.fullName}?`)) {
      return;
    }

    try {
      await remove(lead.id);
      toast("הליד נמחק בהצלחה", "success");
      router.push("/leads");
    } catch (error) {
      toast("שגיאה במחיקת הליד", "error");
    }
  };

  const formatCurrency = (value: number) => {
    if (value === 0) return "-";
    return `₪${value.toLocaleString("he-IL")}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
              <h1 style={{ fontSize: "1.875rem", fontWeight: 700, color: "var(--foreground)" }}>
                {lead.fullName}
              </h1>
              <span
                style={{
                  display: "inline-block",
                  padding: "0.375rem 0.75rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  backgroundColor: `rgba(${STATUS_LABELS[lead.status].color}, 0.15)`,
                  color: STATUS_LABELS[lead.status].color,
                }}
              >
                {STATUS_LABELS[lead.status].label}
              </span>
            </div>
            <p style={{ fontSize: "0.92rem", color: "var(--foreground-muted)" }}>
              {lead.company || "ללא חברה"}
            </p>
          </div>

          <Link
            href="/leads"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.5rem 1rem",
              backgroundColor: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              textDecoration: "none",
              color: "var(--foreground)",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)";
              (e.currentTarget as HTMLElement).style.color = "white";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
              (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
            }}
          >
            ← חזור
          </Link>
        </div>

        {/* Quick Actions */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a
            href={`mailto:${lead.email}`}
            className="mod-btn-primary"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            שלח אימייל
          </a>

          <a
            href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mod-btn-primary"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            שלח WhatsApp
          </a>

          <button
            onClick={() => setShowProposalModal(true)}
            className="mod-btn-primary"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            סמן הצעה כנשלחה
          </button>

          <button
            onClick={() => setShowConversionModal(true)}
            className="mod-btn-primary"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            המר ללקוח
          </button>

          <button
            onClick={handleMarkNotRelevant}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              border: "1px solid #ef4444",
              background: "none",
              color: "#ef4444",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(239, 68, 68, 0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            סמן כלא רלוונטי
          </button>

          <button
            onClick={handleDelete}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              border: "1px solid #ef4444",
              background: "none",
              color: "#ef4444",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(239, 68, 68, 0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            מחק
          </button>
        </div>

        {/* Lead Info Card */}
        <div className="agd-card" style={{ padding: "1.5rem" }}>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1.5rem", color: "var(--foreground)" }}>
            פרטי הליד
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
            {/* Full Name */}
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                שם מלא
              </div>
              {editingField === "fullName" ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1 }}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="mod-btn-primary"
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: "0.375rem",
                    }}
                  >
                    שמור
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => handleStartEdit("fullName", lead.fullName)}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "var(--surface-raised)",
                    color: "var(--foreground)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-muted)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
                  }}
                >
                  {lead.fullName}
                </div>
              )}
            </div>

            {/* Company */}
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                חברה
              </div>
              {editingField === "company" ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1 }}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="mod-btn-primary"
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: "0.375rem",
                    }}
                  >
                    שמור
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => handleStartEdit("company", lead.company)}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "var(--surface-raised)",
                    color: "var(--foreground)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-muted)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
                  }}
                >
                  {lead.company || "-"}
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                אימייל
              </div>
              {editingField === "email" ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="email"
                    className="form-input"
                    style={{ flex: 1 }}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="mod-btn-primary"
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: "0.375rem",
                    }}
                  >
                    שמור
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => handleStartEdit("email", lead.email)}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "var(--surface-raised)",
                    color: "var(--foreground)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    direction: "ltr",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-muted)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
                  }}
                >
                  {lead.email}
                </div>
              )}
            </div>

            {/* Phone */}
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                טלפון
              </div>
              {editingField === "phone" ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="tel"
                    className="form-input"
                    style={{ flex: 1 }}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="mod-btn-primary"
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: "0.375rem",
                    }}
                  >
                    שמור
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => handleStartEdit("phone", lead.phone)}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "var(--surface-raised)",
                    color: "var(--foreground)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    direction: "ltr",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-muted)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
                  }}
                >
                  {lead.phone || "-"}
                </div>
              )}
            </div>

            {/* Source */}
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                מקור
              </div>
              {editingField === "source" ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1 }}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="mod-btn-primary"
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: "0.375rem",
                    }}
                  >
                    שמור
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => handleStartEdit("source", lead.source)}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "var(--surface-raised)",
                    color: "var(--foreground)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-muted)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
                  }}
                >
                  {lead.source || "-"}
                </div>
              )}
            </div>

            {/* Interest Type */}
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                סוג עניין
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "var(--accent-muted)",
                  color: "var(--accent)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                {INTEREST_TYPE_LABELS[lead.interestType]}
              </div>
            </div>
          </div>

          {/* Status Selection */}
          <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--foreground-muted)" }}>
              עדכן סטטוס
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {Object.entries(STATUS_LABELS).map(([statusId, statusData]) => (
                <button
                  key={statusId}
                  onClick={() => handleStatusChange(statusId as LeadStatus)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: lead.status === statusId ? `2px solid ${statusData.color}` : `1px solid var(--border)`,
                    backgroundColor: lead.status === statusId ? `rgba(${statusData.color}, 0.1)` : "transparent",
                    color: statusData.color,
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    transition: "all 150ms ease",
                  }}
                >
                  {statusData.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Proposal Info Card */}
        <div className="agd-card" style={{ padding: "1.5rem" }}>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1.5rem", color: "var(--foreground)" }}>
            פרטי הצעה
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                סטטוס הצעה
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: lead.proposalSent ? "rgba(34, 197, 94, 0.15)" : "rgba(107, 114, 128, 0.15)",
                  color: lead.proposalSent ? "#22c55e" : "#6b7280",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                {lead.proposalSent ? "נשלחה" : "לא נשלחה"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground-muted)" }}>
                סכום הצעה
              </div>
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "var(--surface-raised)",
                  color: "var(--foreground)",
                }}
              >
                {formatCurrency(lead.proposalAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* Notes Card */}
        <div className="agd-card" style={{ padding: "1.5rem" }}>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1.5rem", color: "var(--foreground)" }}>
            הערות
          </div>

          {editingField === "notes" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <textarea
                className="form-input"
                style={{ width: "100%", minHeight: "120px", resize: "none" }}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={handleSaveEdit}
                  className="mod-btn-primary"
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "0.375rem",
                  }}
                >
                  שמור
                </button>
                <button
                  onClick={() => setEditingField(null)}
                  className="mod-btn-ghost"
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "0.375rem",
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => handleStartEdit("notes", lead.notes)}
              style={{
                padding: "0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--surface-raised)",
                color: lead.notes ? "var(--foreground)" : "var(--foreground-muted)",
                cursor: "pointer",
                minHeight: "100px",
                display: "flex",
                alignItems: "center",
                transition: "all 150ms ease",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-muted)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
              }}
            >
              {lead.notes || "לא הוזנו הערות. לחץ כדי להוסיף..."}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="agd-card" style={{ padding: "1.5rem" }}>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1.5rem", color: "var(--foreground)" }}>
            ציר זמן
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem" }}>
              <div
                style={{
                  width: "4px",
                  backgroundColor: "var(--accent)",
                  borderRadius: "2px",
                  minHeight: "60px",
                }}
              />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)" }}>
                  ליד נוצר
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                  {formatDate(lead.createdAt)}
                </div>
              </div>
            </div>

            {lead.convertedAt && (
              <div style={{ display: "flex", gap: "1rem" }}>
                <div
                  style={{
                    width: "4px",
                    backgroundColor: "#22c55e",
                    borderRadius: "2px",
                    minHeight: "60px",
                  }}
                />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)" }}>
                    הומר ללקוח
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                    {formatDate(lead.convertedAt)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Proposal Modal */}
      <Modal
        open={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        title="סמן הצעה כנשלחה"
        footer={
          <>
            <button className="mod-btn-ghost" onClick={() => setShowProposalModal(false)}>
              ביטול
            </button>
            <button className="mod-btn-primary" onClick={handleMarkProposalSent}>
              סמן כנשלחה
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              סכום הצעה (₪)
            </label>
            <input
              type="number"
              className="form-input"
              style={{ width: "100%" }}
              value={proposalAmount || lead.proposalAmount}
              onChange={(e) => setProposalAmount(parseFloat(e.target.value) || 0)}
              min="0"
              placeholder="הזן סכום..."
            />
          </div>
          <div style={{ padding: "0.75rem", backgroundColor: "var(--surface-raised)", borderRadius: "0.375rem", fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
            הצעה תהיה סמנה כנשלחה והסטטוס יתעדכן ל"נשלחה הצעה"
          </div>
        </div>
      </Modal>

      {/* Conversion Modal */}
      <Modal
        open={showConversionModal}
        onClose={() => setShowConversionModal(false)}
        title="המר ליד"
        footer={null}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "1rem",
          }}
        >
          {CONVERSION_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleConvert(option.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                padding: "1.5rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface-raised)",
                cursor: "pointer",
                transition: "all 150ms ease",
                minHeight: "120px",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)";
                (e.currentTarget as HTMLElement).style.color = "white";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
                (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              <span style={{ fontSize: "1.5rem" }}>{option.icon}</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{option.label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </main>
  );
}
