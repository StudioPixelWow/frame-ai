"use client";

import { useClients, usePayments, useProjectPayments, useHostingRecords, usePodcastSessions } from "@/lib/api/use-entity";
import { useState, useMemo } from "react";

interface UnifiedPayment {
  id: string;
  type: "retainer" | "project" | "hosting" | "podcast";
  clientName: string;
  amount: number;
  dueDate: string;
  status: "pending" | "collection_needed" | "paid";
  rawData: any;
}

export default function PaymentsPage() {
  const { data: clients, update: updateClient } = useClients();
  const { data: payments } = usePayments();
  const { data: projectPayments, update: updateProjectPayment } = useProjectPayments();
  const { data: hostingRecords, update: updateHostingRecord } = useHostingRecords();
  const { data: podcastSessions } = usePodcastSessions();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "status">("date");

  const unifiedPayments = useMemo(() => {
    const combined: UnifiedPayment[] = [];

    if (clients) {
      clients.forEach((client: any) => {
        if (client.retainerAmount && client.retainerDay) {
          combined.push({
            id: `retainer-${client.id}`,
            type: "retainer",
            clientName: client.name || client.clientName || "לא ידוע",
            amount: client.retainerAmount,
            dueDate: client.nextPaymentDate || new Date().toISOString(),
            status: client.paymentStatus || "pending",
            rawData: client,
          });
        }
      });
    }

    if (projectPayments) {
      projectPayments.forEach((payment: any) => {
        const client = clients?.find((c: any) => c.id === payment.clientId);
        combined.push({
          id: `project-${payment.id}`,
          type: "project",
          clientName: client?.name || payment.clientName || "לא ידוע",
          amount: payment.amount || 0,
          dueDate: payment.dueDate || new Date().toISOString(),
          status: payment.status || "pending",
          rawData: payment,
        });
      });
    }

    if (hostingRecords) {
      hostingRecords.forEach((record: any) => {
        const client = clients?.find((c: any) => c.id === record.clientId);
        combined.push({
          id: `hosting-${record.id}`,
          type: "hosting",
          clientName: client?.name || record.clientName || "לא ידוע",
          amount: record.yearlyPaymentAmount || 0,
          dueDate: record.nextPaymentDate || new Date().toISOString(),
          status: "pending",
          rawData: record,
        });
      });
    }

    if (podcastSessions) {
      podcastSessions.forEach((session: any) => {
        combined.push({
          id: `podcast-${session.id}`,
          type: "podcast",
          clientName: session.name || "LOUD",
          amount: session.price || 0,
          dueDate: session.paymentDate || new Date().toISOString(),
          status: session.paymentStatus || "pending",
          rawData: session,
        });
      });
    }

    return combined;
  }, [clients, payments, projectPayments, hostingRecords, podcastSessions]);

  const filtered = useMemo(() => {
    let result = unifiedPayments;

    if (filterType !== "all") {
      result = result.filter((p) => p.type === filterType);
    }

    if (filterStatus !== "all") {
      result = result.filter((p) => p.status === filterStatus);
    }

    if (sortBy === "date") {
      result.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    } else if (sortBy === "amount") {
      result.sort((a, b) => b.amount - a.amount);
    } else if (sortBy === "status") {
      const statusOrder: Record<string, number> = { collection_needed: 0, pending: 1, paid: 2 };
      result.sort((a, b) => (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3));
    }

    return result;
  }, [unifiedPayments, filterType, filterStatus, sortBy]);

  const stats = useMemo(() => {
    const now = new Date();
    let totalPending = 0;
    let totalOverdue = 0;
    let totalThisMonth = 0;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    filtered.forEach((p) => {
      const dueDate = new Date(p.dueDate);
      if (p.status === "pending") {
        totalPending += p.amount;
      }
      if (p.status === "collection_needed" && dueDate < now) {
        totalOverdue += p.amount;
      }
      if (dueDate >= monthStart && dueDate <= monthEnd) {
        totalThisMonth += p.amount;
      }
    });

    return { totalPending, totalOverdue, totalThisMonth };
  }, [filtered]);

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      retainer: "#3b82f6",
      project: "#10b981",
      hosting: "#f59e0b",
      podcast: "#8b5cf6",
    };
    return colors[type] || "#6b7280";
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: "#6b7280",
      collection_needed: "#f97316",
      paid: "#22c55e",
    };
    return colors[status] || "#6b7280";
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      retainer: "שכירות",
      project: "פרויקט",
      hosting: "הוסטינג",
      podcast: "פודקאסט",
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: "בהמתנה",
      collection_needed: "גבייה נדרשת",
      paid: "שולם",
    };
    return labels[status] || status;
  };

  const handleMarkAsPaid = async (payment: UnifiedPayment) => {
    try {
      if (payment.type === "hosting") {
        const hostingRecord = payment.rawData;
        const nextPaymentDate = new Date(hostingRecord.nextPaymentDate);
        nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);

        await updateHostingRecord(hostingRecord.id, {
          ...hostingRecord,
          status: "active",
          lastPaidDate: new Date().toISOString(),
          nextPaymentDate: nextPaymentDate.toISOString(),
        } as any);
      } else if (payment.type === "retainer") {
        const client = payment.rawData;
        const nextPaymentDate = new Date(client.nextPaymentDate || new Date());
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

        await updateClient(client.id, {
          ...client,
          paymentStatus: "paid",
          nextPaymentDate: nextPaymentDate.toISOString(),
        } as any);
      } else if (payment.type === "project") {
        const projectPayment = payment.rawData;
        await updateProjectPayment(projectPayment.id, {
          ...projectPayment,
          status: "paid",
        } as any);
      }

      alert("תשלום סומן כשולם והוזן לארכיון");
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון התשלום");
    }
  };

  const handleSendReminder = async (payment: UnifiedPayment) => {
    try {
      const res = await fetch("/api/send-payment-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          clientName: payment.clientName,
          amount: payment.amount,
          dueDate: payment.dueDate,
          type: payment.type,
        }),
      });

      if (!res.ok) throw new Error("Failed to send reminder");
      alert("תזכורת נשלחה בהצלחה");
    } catch (err) {
      console.error(err);
      alert("שגיאה בשליחת התזכורת");
    }
  };

  const getStatusIndicatorColor = (payment: UnifiedPayment): string => {
    if (payment.status === "paid") return "#22c55e"; // Green

    const now = new Date();
    const dueDate = new Date(payment.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return "#ef4444"; // Red - overdue
    if (daysUntilDue <= 7) return "#f59e0b"; // Yellow - upcoming within 7 days
    return "#06b6d4"; // Cyan - on track
  };

  return (
    <div style={{ direction: "rtl", padding: "2rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--foreground)" }}>
          תשלומים
        </h1>
        <p style={{ color: "var(--foreground-muted)", fontSize: "0.95rem" }}>ניהול כל התשלומים מכל המקורות</p>
      </div>

      {/* Summary Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            בהמתנה
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--accent)" }}>
            ₪{stats.totalPending.toLocaleString("he-IL")}
          </p>
        </div>

        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            באיחור
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#ef4444" }}>
            ₪{stats.totalOverdue.toLocaleString("he-IL")}
          </p>
        </div>

        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            החודש
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#10b981" }}>
            ₪{stats.totalThisMonth.toLocaleString("he-IL")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
          padding: "1.5rem",
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
            סוג תשלום
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="form-select"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              background: "var(--surface-raised)",
              color: "var(--foreground)",
            }}
          >
            <option value="all">הכל</option>
            <option value="retainer">שכירות</option>
            <option value="project">פרויקט</option>
            <option value="hosting">호스팅</option>
            <option value="podcast">פודקאסט</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
            סטטוס
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="form-select"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              background: "var(--surface-raised)",
              color: "var(--foreground)",
            }}
          >
            <option value="all">הכל</option>
            <option value="pending">בהמתנה</option>
            <option value="collection_needed">גבייה נדרשת</option>
            <option value="paid">שולם</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--foreground)" }}>
            סדר
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="form-select"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              background: "var(--surface-raised)",
              color: "var(--foreground)",
            }}
          >
            <option value="date">לפי תאריך</option>
            <option value="amount">לפי סכום</option>
            <option value="status">לפי סטטוס</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
                לקוח
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
                סכום
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
                תאריך היעד
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
                סוג
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
                סטטוס
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
                פעולות
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((payment) => (
              <tr key={payment.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "1rem", color: "var(--foreground)" }}>{payment.clientName}</td>
                <td style={{ padding: "1rem", color: "var(--foreground)", fontWeight: "600" }}>
                  ₪{payment.amount.toLocaleString("he-IL")}
                </td>
                <td style={{ padding: "1rem", color: "var(--foreground)" }}>
                  {new Date(payment.dueDate).toLocaleDateString("he-IL")}
                </td>
                <td style={{ padding: "1rem" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      color: "#fff",
                      background: getTypeColor(payment.type),
                    }}
                  >
                    {getTypeLabel(payment.type)}
                  </span>
                </td>
                <td style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div
                      style={{
                        width: "0.75rem",
                        height: "0.75rem",
                        borderRadius: "50%",
                        background: getStatusIndicatorColor(payment),
                      }}
                    />
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "0.375rem",
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        color: "#fff",
                        background: getStatusColor(payment.status),
                      }}
                    >
                      {getStatusLabel(payment.status)}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    {payment.status !== "paid" && (
                      <button
                        onClick={() => handleMarkAsPaid(payment)}
                        className="mod-btn-primary"
                        style={{
                          padding: "0.4rem 0.8rem",
                          fontSize: "0.8rem",
                          background: "var(--accent)",
                          color: "#000",
                          border: "none",
                          borderRadius: "0.375rem",
                          cursor: "pointer",
                          fontWeight: "600",
                        }}
                      >
                        סימון כשולם
                      </button>
                    )}
                    <button
                      onClick={() => handleSendReminder(payment)}
                      className="mod-btn-ghost"
                      style={{
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.8rem",
                        background: "transparent",
                        color: "var(--accent)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        fontWeight: "600",
                      }}
                    >
                      תזכורת
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--foreground-muted)",
          }}
        >
          <p>לא נמצאו תשלומים</p>
        </div>
      )}
    </div>
  );
}
