"use client";

import { useState, useMemo } from "react";
import { useLeads, useCampaigns } from "@/lib/api/use-entity";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import type { Client, Lead, LeadStatus } from "@/lib/db/schema";

const STATUS_COLORS: Record<LeadStatus, { bg: string; text: string }> = {
  new: { bg: "#3b82f6", text: "#3b82f6" },
  contacted: { bg: "#f59e0b", text: "#f59e0b" },
  proposal_sent: { bg: "#a855f7", text: "#a855f7" },
  negotiation: { bg: "#f97316", text: "#f97316" },
  won: { bg: "#22c55e", text: "#22c55e" },
  not_relevant: { bg: "#6b7280", text: "#6b7280" },
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "חדש",
  contacted: "נוצר קשר",
  proposal_sent: "נשלחה הצעה",
  negotiation: 'במו״מ',
  won: "נסגר",
  not_relevant: "לא רלוונטי",
};

const STATUS_FILTERS = [
  { id: "all", label: "כולם" },
  { id: "new", label: "חדש" },
  { id: "contacted", label: "נוצר קשר" },
  { id: "proposal_sent", label: "נשלחה הצעה" },
  { id: "negotiation", label: 'במו״מ' },
  { id: "won", label: "נסגר" },
  { id: "not_relevant", label: "לא רלוונטי" },
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

interface AddLeadFormData {
  fullName: string;
  phone: string;
  email: string;
  source: string;
  notes: string;
  status: LeadStatus;
}

export default function TabLeads({ client }: { client: Client }) {
  const { data: leads, loading, create, update, refetch } = useLeads();
  const { data: campaigns } = useCampaigns();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<AddLeadFormData>({
    fullName: "",
    phone: "",
    email: "",
    source: "",
    notes: "",
    status: "new",
  });

  // Filter leads for this client
  const filteredLeads = useMemo(() => {
    let result = (leads || []).filter(
      (lead) => lead.clientId === client.id || lead.convertedClientId === client.id
    );

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((lead) => lead.status === statusFilter);
    }

    // Sort by createdAt descending (newest first)
    result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return result;
  }, [leads, client.id, statusFilter]);

  // Calculate summary cards
  const stats = useMemo(() => {
    const clientLeads = (leads || []).filter(
      (lead) => lead.clientId === client.id || lead.convertedClientId === client.id
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalLeads = clientLeads.length;
    const newThisMonth = clientLeads.filter(
      (lead) =>
        lead.status === "new" && new Date(lead.createdAt) >= monthStart
    ).length;
    const waitingFollowUp = clientLeads.filter(
      (lead) => lead.followUpAt && !lead.followupDone
    ).length;
    const convertedLeads = clientLeads.filter((lead) => lead.convertedAt).length;

    return { totalLeads, newThisMonth, waitingFollowUp, convertedLeads };
  }, [leads, client.id]);

  const getCampaignName = (campaignId: string | null): string => {
    if (!campaignId) return "-";
    const campaign = campaigns?.find((c) => c.id === campaignId);
    return campaign?.campaignName || "-";
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("he-IL", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName.trim()) {
      toast("שם מלא הוא חובה", "error");
      return;
    }
    if (!formData.email.trim()) {
      toast("אימייל הוא חובה", "error");
      return;
    }

    try {
      await create({
        fullName: formData.fullName,
        name: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        source: formData.source,
        notes: formData.notes,
        status: formData.status,
        clientId: client.id,
        company: "",
        interestType: "marketing",
        proposalSent: false,
        proposalAmount: 0,
        value: 0,
        followupDone: false,
        assigneeId: null,
        followUpAt: null,
        convertedAt: null,
        convertedClientId: null,
        convertedEntityType: null,
        convertedEntityId: null,
        campaignId: null,
        campaignName: "",
        adAccountId: "",
        adSetName: "",
        adName: "",
      });

      toast("ליד חדש נוסף בהצלחה", "success");
      setIsAddModalOpen(false);
      setFormData({
        fullName: "",
        phone: "",
        email: "",
        source: "",
        notes: "",
        status: "new",
      });
      await refetch();
    } catch (error) {
      toast("שגיאה בהוספת הליד", "error");
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      await update(leadId, { status: newStatus });
      toast("סטטוס הליד עודכן", "success");
      await refetch();
    } catch (error) {
      toast("שגיאה בעדכון הסטטוס", "error");
    }
  };

  const handleConvertLead = async (lead: Lead) => {
    if (lead.convertedAt) {
      toast("ליד זה כבר הומר", "error");
      return;
    }

    try {
      const response = await fetch(`/api/data/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });

      if (!response.ok) throw new Error("Conversion failed");

      toast("הליד הומר ללקוח בהצלחה", "success");
      await refetch();
    } catch (error) {
      toast("שגיאה בהמרת הליד", "error");
    }
  };

  const handleWhatsApp = (phone: string) => {
    if (!phone) {
      toast("אין מספר טלפון", "error");
      return;
    }
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank");
  };

  const handleEmail = (email: string) => {
    if (!email) {
      toast("אין אימייל", "error");
      return;
    }
    window.location.href = `mailto:${email}`;
  };

  const handleExportCSV = () => {
    if (filteredLeads.length === 0) {
      toast("אין לידים לייצא", "error");
      return;
    }

    const headers = [
      "שם מלא",
      "טלפון",
      "אימייל",
      "מקור",
      "קמפיין",
      "סטטוס",
      "תאריך",
    ];
    const rows = filteredLeads.map((lead) => [
      lead.fullName,
      lead.phone,
      lead.email,
      lead.source,
      getCampaignName(lead.campaignId),
      STATUS_LABELS[lead.status],
      formatDate(lead.createdAt),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `leads-${client.name}-${new Date().getTime()}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast("הלידים יוצאו בהצלחה", "success");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Total Leads */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--foreground-muted)",
              marginBottom: "0.5rem",
            }}
          >
            סה״כ לידים
          </div>
          <div
            style={{
              fontSize: "2.5rem",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            {stats.totalLeads}
          </div>
        </div>

        {/* New This Month */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--foreground-muted)",
              marginBottom: "0.5rem",
            }}
          >
            לידים חדשים החודש
          </div>
          <div
            style={{
              fontSize: "2.5rem",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            {stats.newThisMonth}
          </div>
        </div>

        {/* Waiting Follow-up */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--foreground-muted)",
              marginBottom: "0.5rem",
            }}
          >
            ממתינים למעקב
          </div>
          <div
            style={{
              fontSize: "2.5rem",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            {stats.waitingFollowUp}
          </div>
        </div>

        {/* Converted Leads */}
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--foreground-muted)",
              marginBottom: "0.5rem",
            }}
          >
            לידים שהומרו
          </div>
          <div
            style={{
              fontSize: "2.5rem",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            {stats.convertedLeads}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setStatusFilter(filter.id)}
            style={{
              padding: "0.625rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 150ms",
              background:
                statusFilter === filter.id
                  ? "var(--accent)"
                  : "var(--surface-raised)",
              color: statusFilter === filter.id ? "white" : "var(--foreground)",
              borderBottom:
                statusFilter === filter.id ? "none" : "1px solid var(--border)",
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Quick Actions Bar */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="mod-btn-primary"
          style={{
            padding: "0.625rem 1.125rem",
            fontSize: "0.875rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
        >
          ➕ הוסף ליד ידנית
        </button>
        <button
          onClick={handleExportCSV}
          className="mod-btn-ghost"
          style={{
            padding: "0.625rem 1.125rem",
            fontSize: "0.875rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
        >
          📥 ייצא לידים
        </button>
      </div>

      {/* Leads Table */}
      <div>
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--foreground-muted)",
            }}
          >
            טוען לידים...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 2rem",
              background: "var(--surface-raised)",
              borderRadius: "0.75rem",
              border: "1px solid var(--border)",
              color: "var(--foreground-muted)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
            <div>אין לידים עדיין</div>
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "var(--surface-raised)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "right",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--foreground)",
                    }}
                  >
                    שם מלא
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "right",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--foreground)",
                    }}
                  >
                    טלפון
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "right",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--foreground)",
                    }}
                  >
                    אימייל
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "right",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--foreground)",
                    }}
                  >
                    מקור
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "right",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--foreground)",
                    }}
                  >
                    קמפיין
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "right",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--foreground)",
                    }}
                  >
                    סטטוס
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "right",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--foreground)",
                    }}
                  >
                    תאריך
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "right",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--foreground)",
                    }}
                  >
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      transition: "background-color 150ms",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "rgba(255, 255, 255, 0.03)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "transparent";
                    }}
                  >
                    <td
                      style={{
                        padding: "1rem",
                        textAlign: "right",
                        fontSize: "0.875rem",
                        color: "var(--foreground)",
                      }}
                    >
                      {lead.fullName}
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        textAlign: "right",
                        fontSize: "0.875rem",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      {lead.phone || "-"}
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        textAlign: "right",
                        fontSize: "0.875rem",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      {lead.email}
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        textAlign: "right",
                        fontSize: "0.875rem",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      {lead.source || "-"}
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        textAlign: "right",
                        fontSize: "0.875rem",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      {getCampaignName(lead.campaignId)}
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        textAlign: "right",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            handleStatusChange(lead.id, e.target.value as LeadStatus)
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            padding: "0.375rem 0.5rem",
                            cursor: "pointer",
                            color: STATUS_COLORS[lead.status].text,
                          }}
                        >
                          {Object.entries(STATUS_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: STATUS_COLORS[lead.status].bg,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        textAlign: "right",
                        fontSize: "0.875rem",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      {formatDate(lead.createdAt)}
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        textAlign: "right",
                        fontSize: "0.75rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          justifyContent: "flex-start",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => handleWhatsApp(lead.phone)}
                          style={{
                            padding: "0.375rem 0.625rem",
                            backgroundColor: "#25D366",
                            color: "white",
                            border: "none",
                            borderRadius: "0.25rem",
                            cursor: "pointer",
                            fontSize: "0.7rem",
                            fontWeight: 500,
                            transition: "opacity 150ms",
                          }}
                          onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.opacity = "0.8";
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.opacity = "1";
                          }}
                          title="שלח וואטסאפ"
                        >
                          💬
                        </button>
                        <button
                          onClick={() => handleEmail(lead.email)}
                          style={{
                            padding: "0.375rem 0.625rem",
                            backgroundColor: "#EA4335",
                            color: "white",
                            border: "none",
                            borderRadius: "0.25rem",
                            cursor: "pointer",
                            fontSize: "0.7rem",
                            fontWeight: 500,
                            transition: "opacity 150ms",
                          }}
                          onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.opacity = "0.8";
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.opacity = "1";
                          }}
                          title="שלח אימייל"
                        >
                          ✉️
                        </button>
                        {!lead.convertedAt && (
                          <button
                            onClick={() => handleConvertLead(lead)}
                            style={{
                              padding: "0.375rem 0.625rem",
                              backgroundColor: "var(--accent)",
                              color: "white",
                              border: "none",
                              borderRadius: "0.25rem",
                              cursor: "pointer",
                              fontSize: "0.7rem",
                              fontWeight: 500,
                              transition: "opacity 150ms",
                            }}
                            onMouseEnter={(e) => {
                              (e.target as HTMLElement).style.opacity = "0.8";
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLElement).style.opacity = "1";
                            }}
                            title="המר ללקוח"
                          >
                            ⭐
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="הוסף ליד חדש"
        footer={
          <>
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="mod-btn-ghost"
              style={{
                padding: "0.625rem 1.125rem",
                fontSize: "0.875rem",
              }}
            >
              ביטול
            </button>
            <button
              onClick={handleAddLeadSubmit}
              className="mod-btn-primary"
              style={{
                padding: "0.625rem 1.125rem",
                fontSize: "0.875rem",
              }}
            >
              הוסף
            </button>
          </>
        }
      >
        <form onSubmit={handleAddLeadSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Full Name */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--foreground)",
              }}
            >
              שם מלא
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              style={{
                padding: "0.75rem",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.875rem",
                fontFamily: "inherit",
              }}
              placeholder="שם מלא"
            />
          </div>

          {/* Phone */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--foreground)",
              }}
            >
              טלפון
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              style={{
                padding: "0.75rem",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.875rem",
                fontFamily: "inherit",
              }}
              placeholder="טלפון"
            />
          </div>

          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--foreground)",
              }}
            >
              אימייל
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              style={{
                padding: "0.75rem",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.875rem",
                fontFamily: "inherit",
              }}
              placeholder="אימייל"
            />
          </div>

          {/* Source */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--foreground)",
              }}
            >
              מקור
            </label>
            <select
              value={formData.source}
              onChange={(e) =>
                setFormData({ ...formData, source: e.target.value })
              }
              style={{
                padding: "0.75rem",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.875rem",
                fontFamily: "inherit",
              }}
            >
              <option value="">בחר מקור</option>
              {SOURCE_OPTIONS.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--foreground)",
              }}
            >
              הערות
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              style={{
                padding: "0.75rem",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.875rem",
                fontFamily: "inherit",
                minHeight: "100px",
                resize: "vertical",
              }}
              placeholder="הערות אופציונליות"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
