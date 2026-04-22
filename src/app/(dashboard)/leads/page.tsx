"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useLeads, useCampaigns, useClients } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { Lead, LeadStatus, LeadInterestType } from "@/lib/db/schema";
import {
  computeLeadQuality,
  getResponseTime,
  getStage,
  FUNNEL_STAGES,
  QUALITY_COLORS,
  type ExtendedLeadStatus,
  type QualityLevel,
  type FunnelStage,
} from "@/lib/leads/lead-quality";
import { SmartHint, EmptyStateAI } from "@/components/ui/smart-hint";

// ── Constants ────────────────────────────────────────────────────────────────

/** Pipeline view shows active stages only */
const PIPELINE_STAGES = FUNNEL_STAGES.filter((s) => s.isActive);
/** Terminal stages shown at bottom */
const TERMINAL_STAGES = FUNNEL_STAGES.filter((s) => s.isTerminal);

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
  marketing: "#0092cc",
  podcast: "#06b6d4",
  branding: "#ec4899",
  website: "#14b8a6",
  hosting: "#f59e0b",
  other: "#6b7280",
};

type ViewMode = "pipeline" | "table";
type SortDirection = "asc" | "desc";
type TableSortBy = "name" | "company" | "amount" | "created" | "quality";

// ══════════════════════════════════════════════════════════════════════════════
// QUALITY BADGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function QualityBadge({ lead }: { lead: Lead }) {
  const q = computeLeadQuality(lead);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.25rem 0.5rem",
        borderRadius: "0.375rem",
        fontSize: "0.7rem",
        fontWeight: 700,
        backgroundColor: q.color + "18",
        color: q.color,
        border: `1px solid ${q.color}30`,
      }}
      title={`ציון איכות: ${q.score}/100`}
    >
      {q.score}
      <span style={{ fontSize: "0.65rem", opacity: 0.8 }}>{q.label}</span>
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESPONSE TIME BADGE
// ══════════════════════════════════════════════════════════════════════════════

function ResponseTimeBadge({ lead }: { lead: Lead }) {
  const rt = getResponseTime(lead);
  if (rt.label === "-") return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.2rem",
        padding: "0.2rem 0.45rem",
        borderRadius: "0.375rem",
        fontSize: "0.7rem",
        fontWeight: 600,
        backgroundColor: rt.color + "15",
        color: rt.color,
      }}
      title={rt.isOverdue ? "זמן תגובה חריג" : "זמן תגובה"}
    >
      {rt.isOverdue && "⚡"}
      {rt.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ATTRIBUTION BLOCK (shows campaign/client linkage)
// ══════════════════════════════════════════════════════════════════════════════

function AttributionBlock({ lead }: { lead: Lead }) {
  if (!lead.campaignName && !lead.adSetName && !lead.adName) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.15rem",
        padding: "0.4rem 0.5rem",
        borderRadius: "0.375rem",
        backgroundColor: "var(--accent)" + "08",
        border: "1px solid var(--accent)" + "15",
        fontSize: "0.7rem",
        color: "var(--foreground-muted)",
      }}
    >
      {lead.campaignName && (
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>קמפיין:</span>
          <span style={{ fontWeight: 500 }}>{lead.campaignName}</span>
        </div>
      )}
      {lead.adSetName && (
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
          <span style={{ color: "var(--foreground-muted)", fontWeight: 600 }}>אד סט:</span>
          <span>{lead.adSetName}</span>
        </div>
      )}
      {lead.adName && (
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
          <span style={{ color: "var(--foreground-muted)", fontWeight: 600 }}>מודעה:</span>
          <span>{lead.adName}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LEAD DETAIL SIDE PANEL
// ══════════════════════════════════════════════════════════════════════════════

function LeadDetailPanel({
  lead,
  onClose,
  onUpdate,
  onDelete,
  clients,
  campaigns,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Lead>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  clients: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; campaignName: string }>;
}) {
  const [editNotes, setEditNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const quality = computeLeadQuality(lead);
  const responseTime = getResponseTime(lead);
  const stage = getStage(lead.status);

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    try {
      await onUpdate(lead.id, { status: newStatus as LeadStatus });
      toast(`סטטוס עודכן ל${getStage(newStatus).label}`, "success");
    } catch {
      toast("שגיאה בעדכון סטטוס", "error");
    }
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await onUpdate(lead.id, { notes: editNotes });
      toast("הערות נשמרו", "success");
    } catch {
      toast("שגיאה בשמירת הערות", "error");
    }
    setSaving(false);
  };

  const handleMarkNotRelevant = async () => {
    setSaving(true);
    try {
      await onUpdate(lead.id, { status: "not_relevant" as LeadStatus });
      toast("סומן כלא רלוונטי", "success");
    } catch {
      toast("שגיאה", "error");
    }
    setSaving(false);
  };

  const handleDeleteLead = async () => {
    if (!window.confirm(`למחוק את ${lead.fullName || "הליד"}?`)) return;
    try {
      await onDelete(lead.id);
      toast("ליד נמחק", "success");
      onClose();
    } catch {
      toast("שגיאה במחיקה", "error");
    }
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "-";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("he-IL", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const sectionStyle: React.CSSProperties = {
    padding: "1rem",
    borderBottom: "1px solid var(--border)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--foreground-muted)",
    marginBottom: "0.25rem",
    textTransform: "uppercase" as const,
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-start",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: "relative",
          width: "min(480px, 90vw)",
          height: "100vh",
          backgroundColor: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          overflowY: "auto",
          direction: "rtl",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--surface-raised)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--foreground)" }}>
              {lead.fullName || "ללא שם"}
            </h2>
            {lead.company && (
              <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                {lead.company}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "var(--foreground-muted)",
              padding: "0.25rem",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Quality + Response Time */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <div style={labelStyle}>איכות ליד</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    color: quality.color,
                  }}
                >
                  {quality.score}
                </span>
                <span
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    backgroundColor: quality.color + "18",
                    color: quality.color,
                  }}
                >
                  {quality.label}
                </span>
              </div>
              {/* Mini breakdown */}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                {[
                  { label: "תגובה", val: quality.breakdown.responseTime, max: 25 },
                  { label: "התקדמות", val: quality.breakdown.progression, max: 30 },
                  { label: "שלמות", val: quality.breakdown.completeness, max: 20 },
                  { label: "מעורבות", val: quality.breakdown.engagement, max: 25 },
                ].map((b) => (
                  <div key={b.label} style={{ display: "flex", flexDirection: "column", gap: "0.15rem", flex: 1 }}>
                    <div style={{ fontSize: "0.6rem", color: "var(--foreground-muted)" }}>{b.label}</div>
                    <div
                      style={{
                        height: "4px",
                        borderRadius: "2px",
                        backgroundColor: "var(--border)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(b.val / b.max) * 100}%`,
                          borderRadius: "2px",
                          backgroundColor: quality.color,
                          transition: "width 400ms ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderRight: "1px solid var(--border)", height: "3rem" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <div style={labelStyle}>זמן תגובה</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: responseTime.color }}>
                {responseTime.label}
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div style={sectionStyle}>
          <div style={labelStyle}>סטטוס</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>{stage.icon}</span>
            <span
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "0.375rem",
                fontSize: "0.85rem",
                fontWeight: 700,
                backgroundColor: stage.color + "20",
                color: stage.color,
              }}
            >
              {stage.label}
            </span>
          </div>
          {/* Quick status actions */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {FUNNEL_STAGES.filter((s) => s.id !== lead.status).slice(0, 6).map((s) => (
              <button
                key={s.id}
                onClick={() => handleStatusChange(s.id)}
                disabled={saving}
                style={{
                  padding: "0.35rem 0.65rem",
                  borderRadius: "0.375rem",
                  border: `1px solid ${s.color}30`,
                  backgroundColor: "transparent",
                  color: s.color,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = s.color + "15";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = "transparent";
                }}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div style={sectionStyle}>
          <div style={labelStyle}>פרטי קשר</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {lead.email && (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--foreground-muted)" }}>📧</span>
                <a href={`mailto:${lead.email}`} style={{ color: "var(--accent)", textDecoration: "none", direction: "ltr" }}>
                  {lead.email}
                </a>
              </div>
            )}
            {lead.phone && (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--foreground-muted)" }}>📱</span>
                <a href={`tel:${lead.phone}`} style={{ color: "var(--accent)", textDecoration: "none", direction: "ltr" }}>
                  {lead.phone}
                </a>
              </div>
            )}
            {lead.source && (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--foreground-muted)" }}>🔗</span>
                <span style={{ color: "var(--foreground)" }}>{lead.source}</span>
              </div>
            )}
          </div>
        </div>

        {/* Campaign Attribution */}
        {(lead.campaignName || lead.adSetName || lead.adName || lead.campaignId) && (
          <div style={sectionStyle}>
            <div style={labelStyle}>שיוך קמפיין</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                backgroundColor: "var(--accent)" + "08",
                border: "1px solid var(--accent)" + "20",
              }}
            >
              {lead.campaignName && (
                <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.85rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--accent)" }}>קמפיין:</span>
                  <span style={{ color: "var(--foreground)" }}>{lead.campaignName}</span>
                </div>
              )}
              {lead.adSetName && (
                <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.85rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--foreground-muted)" }}>אד סט:</span>
                  <span style={{ color: "var(--foreground)" }}>{lead.adSetName}</span>
                </div>
              )}
              {lead.adName && (
                <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.85rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--foreground-muted)" }}>מודעה:</span>
                  <span style={{ color: "var(--foreground)" }}>{lead.adName}</span>
                </div>
              )}
              {lead.adAccountId && (
                <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--foreground-muted)" }}>חשבון מודעות:</span>
                  <span style={{ color: "var(--foreground-muted)" }}>{lead.adAccountId}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Financial */}
        {((lead.proposalAmount || 0) > 0 || lead.proposalSent) && (
          <div style={sectionStyle}>
            <div style={labelStyle}>פיננסי</div>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              {(lead.proposalAmount || 0) > 0 && (
                <div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent)" }}>
                    ₪{(lead.proposalAmount || 0).toLocaleString("he-IL")}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>סכום הצעה</div>
                </div>
              )}
              {lead.proposalSent && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span style={{ color: "#22c55e", fontSize: "0.8rem" }}>✓</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>הצעה נשלחה</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={sectionStyle}>
          <div style={labelStyle}>הערות</div>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--foreground)",
              fontSize: "0.85rem",
              fontFamily: "inherit",
              resize: "vertical",
            }}
            placeholder="הוסף הערות..."
          />
          {editNotes !== (lead.notes || "") && (
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              style={{
                marginTop: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "none",
                backgroundColor: "var(--accent)",
                color: "white",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              שמור הערות
            </button>
          )}
        </div>

        {/* Timestamps */}
        <div style={sectionStyle}>
          <div style={labelStyle}>תאריכים</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
            <div>נוצר: {formatDate(lead.createdAt)}</div>
            <div>עודכן: {formatDate(lead.updatedAt)}</div>
            {lead.followUpAt && <div>מעקב: {formatDate(lead.followUpAt)}</div>}
            {lead.convertedAt && <div>הומר: {formatDate(lead.convertedAt)}</div>}
          </div>
        </div>

        {/* Quick Actions — Communication */}
        <div style={sectionStyle}>
          <div style={labelStyle}>פעולות מהירות</div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #22c55e30",
                  backgroundColor: "#22c55e10",
                  color: "#22c55e",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "none",
                  transition: "all 150ms ease",
                }}
              >
                📞 התקשר
              </a>
            )}
            {lead.phone && (
              <button
                onClick={() => {
                  const cleaned = (lead.phone || "").replace(/[^0-9]/g, "");
                  const intl = cleaned.startsWith("0") ? "972" + cleaned.slice(1) : cleaned;
                  window.open(`https://wa.me/${intl}`, "_blank");
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #25D36630",
                  backgroundColor: "#25D36610",
                  color: "#25D366",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                💬 WhatsApp
              </button>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--accent)" + "30",
                  backgroundColor: "var(--accent)" + "10",
                  color: "var(--accent)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "none",
                  transition: "all 150ms ease",
                }}
              >
                📧 שלח מייל
              </a>
            )}
            <button
              onClick={() => {
                toast(`משימה נוצרה עבור ${lead.fullName || "הליד"}`, "success");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid #8b5cf630",
                backgroundColor: "#8b5cf610",
                color: "#8b5cf6",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              📋 צור משימה
            </button>
          </div>
        </div>

        {/* Status Actions */}
        <div style={{ padding: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={handleMarkNotRelevant}
            disabled={saving || lead.status === "not_relevant"}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #6b728030",
              backgroundColor: "transparent",
              color: "#6b7280",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🚫 סמן כלא רלוונטי
          </button>
          <button
            onClick={handleDeleteLead}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #ef444430",
              backgroundColor: "transparent",
              color: "#ef4444",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🗑️ מחק ליד
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function LeadsPage() {
  const { data: rawLeads, loading, create, update, remove, refetch } = useLeads();
  const { data: rawCampaigns } = useCampaigns();
  const { data: rawClients } = useClients();

  // Safe fallbacks — never let undefined reach .filter/.map/.reduce/.length
  const leads = rawLeads ?? [];
  const campaigns = rawCampaigns ?? [];
  const clients = rawClients ?? [];
  const toast = useToast();

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterInterestType, setFilterInterestType] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterCampaign, setFilterCampaign] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterQuality, setFilterQuality] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [tableSortBy, setTableSortBy] = useState<TableSortBy>("created");
  const [tableSortDir, setTableSortDir] = useState<SortDirection>("desc");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

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
    campaignId: null,
  });

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null;
    return (leads || []).find((l) => l.id === selectedLeadId) || null;
  }, [leads, selectedLeadId]);

  // Campaign names for filter dropdown
  const campaignOptions = useMemo(() => {
    const safeC = campaigns || [];
    const names = new Map<string, string>();
    for (const c of safeC) {
      if (c.campaignName) names.set(c.id, c.campaignName);
    }
    return names;
  }, [campaigns]);

  // Client names for filter dropdown
  const clientOptions = useMemo(() => {
    const safeC = clients || [];
    const names = new Map<string, string>();
    for (const c of safeC) {
      if (c.name) names.set(c.id, c.name);
    }
    return names;
  }, [clients]);

  const filteredLeads = useMemo(() => {
    let result = [...(leads || [])];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (lead) =>
          (lead.fullName || "").toLowerCase().includes(q) ||
          (lead.company && lead.company.toLowerCase().includes(q)) ||
          (lead.email || "").toLowerCase().includes(q) ||
          (lead.campaignName || "").toLowerCase().includes(q)
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

    // Campaign filter
    if (filterCampaign !== "all") {
      result = result.filter((lead) => lead.campaignId === filterCampaign);
    }

    // Client filter
    if (filterClient !== "all") {
      result = result.filter((lead) => lead.clientId === filterClient);
    }

    // Quality filter
    if (filterQuality !== "all") {
      result = result.filter((lead) => computeLeadQuality(lead).level === filterQuality);
    }

    // Date range filter
    if (filterDateRange !== "all") {
      const now = new Date();
      let cutoff: Date | null = null;
      switch (filterDateRange) {
        case "7d":
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "thisMonth": {
          cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        }
        case "lastMonth": {
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 1);
          result = result.filter((lead) => {
            if (!lead.createdAt) return false;
            const d = new Date(lead.createdAt);
            return d >= start && d < end;
          });
          cutoff = null; // already filtered
          break;
        }
      }
      if (cutoff) {
        result = result.filter((lead) => {
          if (!lead.createdAt) return false;
          return new Date(lead.createdAt) >= cutoff!;
        });
      }
    }

    // Sort for table view
    if (viewMode === "table") {
      result.sort((a, b) => {
        let aVal: number | string = "";
        let bVal: number | string = "";

        switch (tableSortBy) {
          case "name":
            aVal = a.fullName || "";
            bVal = b.fullName || "";
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
          case "quality":
            aVal = computeLeadQuality(a).score;
            bVal = computeLeadQuality(b).score;
            break;
        }

        if (typeof aVal === "string") {
          const cmp = aVal.localeCompare(bVal as string, "he");
          return tableSortDir === "asc" ? cmp : -cmp;
        } else {
          return tableSortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
        }
      });
    }

    return result;
  }, [leads, searchQuery, filterStatus, filterInterestType, filterSource, filterCampaign, filterClient, filterQuality, filterDateRange, viewMode, tableSortBy, tableSortDir]);

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
    const closureRate = safeLeads.length > 0 ? Math.round((closedCount / safeLeads.length) * 100) : 0;

    // Quality distribution
    let highQ = 0, medQ = 0, lowQ = 0;
    for (const l of safeLeads) {
      const q = computeLeadQuality(l).level;
      if (q === "high") highQ++;
      else if (q === "medium") medQ++;
      else lowQ++;
    }

    // Unassigned
    const unassigned = safeLeads.filter(
      (l) => !l.assigneeId && l.status !== "won" && l.status !== "not_relevant" && l.status !== "lost" && l.status !== "duplicate"
    ).length;

    return {
      total: safeLeads.length,
      newThisWeek: safeLeads.filter((l) => l.createdAt && new Date(l.createdAt) > weekAgo).length,
      openProposalsCount: openProposals.length,
      openProposalsValue: totalValue,
      closureRate,
      highQ,
      medQ,
      lowQ,
      unassigned,
    };
  }, [leads]);

  // Group leads by status for pipeline view
  const leadsByStatus = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    for (const s of FUNNEL_STAGES) {
      grouped[s.id] = [];
    }
    filteredLeads.forEach((lead) => {
      const status = lead.status || "new";
      if (grouped[status]) {
        grouped[status].push(lead);
      } else {
        // Unknown status — put in new
        grouped["new"].push(lead);
      }
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
      campaignId: null,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

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
      // Find campaign name from selected campaign
      const selectedCampaign = (campaigns || []).find((c) => c.id === formData.campaignId);
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
        campaignId: formData.campaignId || null,
        campaignName: selectedCampaign?.campaignName || "",
      });
      toast("ליד חדש נוצר בהצלחה", "success");
      handleCloseModal();
      await refetch();
    } catch {
      toast("שגיאה בשמירת הליד", "error");
    }
  };

  const handleDelete = async (lead: Lead) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את ${lead.fullName || "הליד"}?`)) return;
    try {
      await remove(lead.id);
      toast("הליד נמחק בהצלחה", "success");
      await refetch();
    } catch {
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

  const handleDragLeave = () => setDragOverStatus(null);

  const handleDrop = async (status: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStatus(null);
    if (!draggedLead) return;
    if (draggedLead.status === status) {
      setDraggedLead(null);
      return;
    }
    try {
      await update(draggedLead.id, { status: status as LeadStatus });
      toast(`עדכן ל${getStage(status).label}`, "success");
      await refetch();
    } catch {
      toast("שגיאה בעדכון סטטוס הליד", "error");
    } finally {
      setDraggedLead(null);
    }
  };

  const handleUpdateLead = async (id: string, data: Partial<Lead>) => {
    await update(id, data);
    await refetch();
  };

  const handleRemoveLead = async (id: string) => {
    await remove(id);
    await refetch();
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

  // Shared select style
  const selectStyle: React.CSSProperties = {
    padding: "0.6rem 0.85rem",
    borderRadius: "0.5rem",
    border: "1px solid var(--border)",
    backgroundColor: "var(--surface)",
    color: "var(--foreground)",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontFamily: "inherit",
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
              מעקב וניהול יעיל של משפך המכירות — עם ניתוח איכות ושיוך קמפיינים
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
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
          }}
        >
          {[
            { label: 'סה"כ לידים', value: stats.total, color: "var(--accent)", sub: "כל הלידים" },
            { label: "חדשים השבוע", value: stats.newThisWeek, color: "#3b82f6", sub: "השבוע האחרון" },
            { label: "הצעות פתוחות", value: stats.openProposalsCount, color: "#a855f7", sub: formatCurrency(stats.openProposalsValue) + " שווי" },
            { label: "שיעור סגירה", value: `${stats.closureRate}%`, color: "#22c55e", sub: "מכלל הלידים" },
            { label: "איכות גבוהה", value: stats.highQ, color: "#22c55e", sub: `${stats.medQ} בינונית · ${stats.lowQ} נמוכה` },
            { label: "ללא שיוך", value: stats.unassigned, color: stats.unassigned > 5 ? "#ef4444" : "#f59e0b", sub: "דורשים שיוך" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: "var(--surface-raised)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                {stat.sub}
              </div>
            </div>
          ))}
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
            {(["pipeline", "table"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  backgroundColor: viewMode === mode ? "var(--accent)" : "transparent",
                  color: viewMode === mode ? "white" : "var(--foreground)",
                  transition: "all 150ms ease",
                }}
              >
                {mode === "pipeline" ? "צינור מכירות" : "טבלה"}
              </button>
            ))}
          </div>

          {/* Search & Filters */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input
              type="text"
              placeholder="חיפוש לפי שם, חברה, אימייל או קמפיין..."
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
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
                <option value="all">כל הסטטוסים</option>
                {FUNNEL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>

              <select value={filterInterestType} onChange={(e) => setFilterInterestType(e.target.value)} style={selectStyle}>
                <option value="all">כל סוגי העניין</option>
                {INTEREST_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>

              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={selectStyle}>
                <option value="all">כל המקורות</option>
                {SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>

              <select value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)} style={selectStyle}>
                <option value="all">כל הקמפיינים</option>
                {Array.from(campaignOptions.entries()).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} style={selectStyle}>
                <option value="all">כל הלקוחות</option>
                {Array.from(clientOptions.entries()).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              <select value={filterQuality} onChange={(e) => setFilterQuality(e.target.value)} style={selectStyle}>
                <option value="all">כל האיכויות</option>
                <option value="high">איכות גבוהה</option>
                <option value="medium">איכות בינונית</option>
                <option value="low">איכות נמוכה</option>
              </select>

              <select value={filterDateRange} onChange={(e) => setFilterDateRange(e.target.value)} style={selectStyle}>
                <option value="all">כל התאריכים</option>
                <option value="7d">7 ימים אחרונים</option>
                <option value="30d">30 ימים אחרונים</option>
                <option value="90d">90 ימים אחרונים</option>
                <option value="thisMonth">החודש הנוכחי</option>
                <option value="lastMonth">החודש הקודם</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Smart Hints ──────────────────────────────────── */}
        {(() => {
          const all = leads || [];
          if (all.length === 0) return null;
          const hints: Array<{ key: string; icon: string; text: string; type: 'warning' | 'ai' | 'info' }> = [];
          const newCount = all.filter(l => l.status === 'new').length;
          if (newCount > 5) {
            hints.push({ key: 'new-leads', icon: '🔥', text: `${newCount} לידים חדשים ממתינים לטיפול — מומלץ לשייך ולהתחיל מעקב`, type: 'warning' });
          }
          const noAssign = all.filter(l => !l.assigneeId && l.status !== 'won' && l.status !== 'lost' && l.status !== 'not_relevant');
          if (noAssign.length > 3) {
            hints.push({ key: 'unassigned', icon: '👤', text: `${noAssign.length} לידים ללא שיוך — שייך אותם לנציג לטיפול מהיר`, type: 'info' });
          }
          if (hints.length === 0) return null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
              {hints.slice(0, 2).map(h => (
                <SmartHint key={h.key} icon={h.icon} text={h.text} type={h.type} />
              ))}
            </div>
          );
        })()}

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
          /* PIPELINE VIEW */
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Active stages */}
            <div
              style={{
                display: "flex",
                gap: "1rem",
                overflowX: "auto",
                paddingBottom: "1rem",
                paddingRight: "1rem",
                paddingLeft: "1rem",
                marginRight: "-2rem",
                marginLeft: "-2rem",
              }}
            >
              {PIPELINE_STAGES.map((statusConfig) => {
                const statusLeads = leadsByStatus[statusConfig.id] || [];
                const isOverStatus = dragOverStatus === statusConfig.id;
                return (
                  <div
                    key={statusConfig.id}
                    style={{
                      minWidth: "300px",
                      maxWidth: "300px",
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
                        padding: "0.85rem 1rem",
                        borderBottom: "1px solid var(--border)",
                        borderTop: `3px solid ${statusConfig.color}`,
                        backgroundColor: "var(--surface-raised)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.9rem" }}>{statusConfig.icon}</span>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>
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
                          padding: "0 0.35rem",
                        }}
                      >
                        {statusLeads.length}
                      </div>
                    </div>

                    {/* Cards Container */}
                    <div
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        minHeight: "400px",
                        maxHeight: "600px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.6rem",
                        overflowY: "auto",
                      }}
                    >
                      {statusLeads.length > 0 ? (
                        statusLeads.map((lead) => (
                          <div
                            key={lead.id}
                            onClick={() => setSelectedLeadId(lead.id)}
                            style={{
                              padding: "0.85rem",
                              borderRadius: "0.625rem",
                              backgroundColor: "var(--surface-raised)",
                              border: "1px solid var(--border)",
                              cursor: "grab",
                              transition: "all 200ms ease",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
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
                            {/* Name + Quality */}
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", flex: 1 }}>
                                {lead.fullName || "ללא שם"}
                              </div>
                              <QualityBadge lead={lead} />
                            </div>

                            {/* Company */}
                            {lead.company && (
                              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontWeight: 500 }}>
                                {lead.company}
                              </div>
                            )}

                            {/* Badges Row */}
                            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "0.25rem 0.5rem",
                                  borderRadius: "0.375rem",
                                  backgroundColor: INTEREST_TYPE_COLORS[lead.interestType] + "20",
                                  color: INTEREST_TYPE_COLORS[lead.interestType],
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                }}
                              >
                                {getInterestTypeLabel(lead.interestType)}
                              </span>
                              {(lead.proposalAmount || 0) > 0 && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "0.25rem 0.5rem",
                                    borderRadius: "0.375rem",
                                    backgroundColor: "#22c55e20",
                                    color: "#22c55e",
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                  }}
                                >
                                  {formatCurrency(lead.proposalAmount)}
                                </span>
                              )}
                              <ResponseTimeBadge lead={lead} />
                            </div>

                            {/* Attribution */}
                            <AttributionBlock lead={lead} />

                            {/* Source + Assignee */}
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                              {lead.source && <span>מקור: {lead.source}</span>}
                              {lead.assigneeId && (
                                <span style={{ color: "#6366f1", fontWeight: 600 }}>👤 משויך</span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: 1,
                            color: "var(--foreground-muted)",
                            fontSize: "0.8rem",
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

            {/* Terminal stages row */}
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.75rem" }}>
                סופיים
              </div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {TERMINAL_STAGES.map((s) => {
                  const count = (leadsByStatus[s.id] || []).length;
                  const isOver = dragOverStatus === s.id;
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.65rem 1rem",
                        borderRadius: "0.5rem",
                        border: `1px solid ${isOver ? s.color : "var(--border)"}`,
                        backgroundColor: isOver ? s.color + "10" : "var(--surface-raised)",
                        cursor: "default",
                        transition: "all 200ms ease",
                        minWidth: "120px",
                      }}
                      onDragOver={(e) => handleDragOver(s.id, e)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(s.id, e)}
                    >
                      <span style={{ fontSize: "0.9rem" }}>{s.icon}</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: s.color }}>{s.label}</span>
                      <span
                        style={{
                          marginRight: "auto",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: s.color,
                          backgroundColor: s.color + "20",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "0.25rem",
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* TABLE VIEW */
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "0.75rem",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      backgroundColor: "var(--surface-raised)",
                    }}
                  >
                    {renderTableHeader("שם", "name")}
                    {renderTableHeader("חברה", "company")}
                    <th style={{ padding: "0.85rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>טלפון</th>
                    <th style={{ padding: "0.85rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>סטטוס</th>
                    {renderTableHeader("איכות", "quality")}
                    <th style={{ padding: "0.85rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>עניין</th>
                    {renderTableHeader("סכום", "amount")}
                    <th style={{ padding: "0.85rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>קמפיין</th>
                    <th style={{ padding: "0.85rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>אד סט</th>
                    <th style={{ padding: "0.85rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>מודעה</th>
                    <th style={{ padding: "0.85rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>מקור</th>
                    {renderTableHeader("תאריך", "created")}
                    <th style={{ padding: "0.85rem", textAlign: "right", fontWeight: 600, color: "var(--foreground)" }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length > 0 ? (
                    filteredLeads.map((lead, idx) => {
                      const stage = getStage(lead.status);
                      return (
                        <tr
                          key={lead.id}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            backgroundColor: idx % 2 === 0 ? "transparent" : "var(--surface-raised)",
                            transition: "background-color 150ms ease",
                            cursor: "pointer",
                          }}
                          onClick={() => setSelectedLeadId(lead.id)}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)" + "08";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor =
                              idx % 2 === 0 ? "transparent" : "var(--surface-raised)";
                          }}
                        >
                          <td style={{ padding: "0.85rem", fontWeight: 600, color: "var(--accent)" }}>
                            {lead.fullName || "ללא שם"}
                          </td>
                          <td style={{ padding: "0.85rem", color: "var(--foreground-muted)" }}>
                            {lead.company || "-"}
                          </td>
                          <td style={{ padding: "0.85rem", color: "var(--foreground-muted)", direction: "ltr", textAlign: "right" }}>
                            {lead.phone ? (
                              <a
                                href={`tel:${lead.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: "var(--accent)", textDecoration: "none", fontSize: "0.8rem" }}
                              >
                                {lead.phone}
                              </a>
                            ) : "-"}
                          </td>
                          <td style={{ padding: "0.85rem" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                padding: "0.25rem 0.6rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                backgroundColor: stage.color + "20",
                                color: stage.color,
                              }}
                            >
                              {stage.icon} {stage.label}
                            </span>
                          </td>
                          <td style={{ padding: "0.85rem" }}>
                            <QualityBadge lead={lead} />
                          </td>
                          <td style={{ padding: "0.85rem", color: "var(--foreground-muted)" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                backgroundColor: INTEREST_TYPE_COLORS[lead.interestType] + "20",
                                color: INTEREST_TYPE_COLORS[lead.interestType],
                              }}
                            >
                              {getInterestTypeLabel(lead.interestType)}
                            </span>
                          </td>
                          <td style={{ padding: "0.85rem", textAlign: "right" }}>
                            <span style={{ fontWeight: 700, color: (lead.proposalAmount || 0) > 0 ? "var(--accent)" : "var(--foreground-muted)" }}>
                              {formatCurrency(lead.proposalAmount)}
                            </span>
                          </td>
                          <td style={{ padding: "0.85rem", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                            {lead.campaignName || "-"}
                          </td>
                          <td style={{ padding: "0.85rem", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                            {lead.adSetName || "-"}
                          </td>
                          <td style={{ padding: "0.85rem", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                            {lead.adName || "-"}
                          </td>
                          <td style={{ padding: "0.85rem", color: "var(--foreground-muted)" }}>
                            {lead.source || "-"}
                          </td>
                          <td style={{ padding: "0.85rem", color: "var(--foreground-muted)" }}>
                            {formatDate(lead.createdAt)}
                          </td>
                          <td style={{ padding: "0.85rem" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(lead); }}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                fontSize: "0.7rem",
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
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={10}
                        style={{ padding: 0 }}
                      >
                        <EmptyStateAI
                          icon="🔍"
                          title="לא נמצאו לידים התואמים את המסננים"
                          aiSuggestion="נסה להרחיב את הסינון או לבדוק לידים בסטטוסים אחרים"
                        />
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
          onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem",
          }}
        >
          {/* Full Name */}
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

          {/* Email */}
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
                <option key={t.id} value={t.id}>{t.label}</option>
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
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          </div>

          {/* Campaign */}
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--foreground)" }}>
              קמפיין (אופציונלי)
            </label>
            <select
              value={formData.campaignId || ""}
              onChange={(e) => setFormData({ ...formData, campaignId: e.target.value || null })}
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
              <option value="">ללא שיוך קמפיין</option>
              {Array.from(campaignOptions.entries()).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
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

          {/* Notes */}
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

      {/* LEAD DETAIL PANEL */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={handleUpdateLead}
          onDelete={handleRemoveLead}
          clients={Array.from(clientOptions.entries()).map(([id, name]) => ({ id, name }))}
          campaigns={Array.from(campaignOptions.entries()).map(([id, campaignName]) => ({ id, campaignName }))}
        />
      )}
    </main>
  );
}
