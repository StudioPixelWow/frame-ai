"use client";

import { useMemo, useState } from "react";
import { useClients, usePayments, useProjectPayments, useHostingRecords } from "@/lib/api/use-entity";
import { AdminOnly } from "@/components/role-gate";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <div dir="rtl" style={{ maxWidth: 600, margin: "4rem auto", textAlign: "center", padding: "2rem" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>אין גישה</h2>
      <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>עמוד זה זמין למנהלים בלבד</p>
    </div>
  );
}

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

interface TimelineMonth {
  month: number;
  year: number;
  monthName: string;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  paymentCount: number;
  isCurrentMonth: boolean;
}

interface OverduePayment {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  daysOverdue: number;
  dueDate: string;
  type: "payment" | "project_payment";
  status: string;
}

interface CollectionSummary {
  totalOverdueAmount: number;
  clientsWithOverdue: number;
  averageDaysOverdue: number;
  totalCollectedThisMonth: number;
}

interface SendingStates {
  [key: string]: boolean;
}

interface SuccessMessages {
  [key: string]: boolean;
}

export default function AccountingTimelinePage() {
  const { data: clients = [] } = useClients();
  const { data: payments = [] } = usePayments();
  const { data: projectPayments = [] } = useProjectPayments();
  const { data: hostingRecords = [] } = useHostingRecords();

  const [sendingStates, setSendingStates] = useState<SendingStates>({});
  const [successMessages, setSuccessMessages] = useState<SuccessMessages>({});

  // Calculate timeline data
  const timelineData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const months: TimelineMonth[] = [];

    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const month = date.getMonth();
      const year = date.getFullYear();

      let totalPaid = 0;
      let totalPending = 0;
      let totalOverdue = 0;
      let paymentCount = 0;

      // Process regular payments
      payments.forEach((payment: any) => {
        if (!payment.dueDate) return;
        const dueDate = new Date(payment.dueDate);
        if (
          dueDate.getMonth() === month &&
          dueDate.getFullYear() === year
        ) {
          paymentCount++;
          if (payment.status === "paid") {
            totalPaid += payment.amount || 0;
          } else if (payment.status === "overdue") {
            totalOverdue += payment.amount || 0;
          } else if (
            payment.status === "pending" ||
            payment.status === "draft" ||
            payment.status === "msg_sent"
          ) {
            totalPending += payment.amount || 0;
          }
        }
      });

      // Process project payments
      projectPayments.forEach((pp: any) => {
        if (!pp.dueDate) return;
        const dueDate = new Date(pp.dueDate);
        if (
          dueDate.getMonth() === month &&
          dueDate.getFullYear() === year
        ) {
          paymentCount++;
          if (pp.status === "paid") {
            totalPaid += pp.amount || 0;
          } else if (pp.status === "overdue" || pp.status === "collection_needed") {
            totalOverdue += pp.amount || 0;
          } else if (pp.status === "pending") {
            totalPending += pp.amount || 0;
          }
        }
      });

      months.push({
        month,
        year,
        monthName: HEBREW_MONTHS[month],
        totalPaid,
        totalPending,
        totalOverdue,
        paymentCount,
        isCurrentMonth: month === currentMonth && year === currentYear,
      });
    }

    return months;
  }, [payments, projectPayments]);

  // Calculate overdue payments
  const overduePayments = useMemo(() => {
    const now = new Date();
    const overdueList: OverduePayment[] = [];

    // Regular payments
    payments.forEach((payment: any) => {
      if (payment.status === "overdue" && payment.dueDate) {
        const dueDate = new Date(payment.dueDate);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        overdueList.push({
          id: `payment-${payment.invoiceNo || payment.clientId}`,
          clientId: payment.clientId,
          clientName: payment.clientName,
          amount: payment.amount || 0,
          daysOverdue,
          dueDate: payment.dueDate,
          type: "payment",
          status: "overdue",
        });
      }
    });

    // Project payments
    projectPayments.forEach((pp: any) => {
      if (
        (pp.status === "overdue" || pp.status === "collection_needed") &&
        pp.dueDate
      ) {
        const dueDate = new Date(pp.dueDate);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        overdueList.push({
          id: `project-${pp.clientId}-${pp.title}`,
          clientId: pp.clientId,
          clientName: clients.find((c: any) => c.id === pp.clientId)?.name || "לא ידוע",
          amount: pp.amount || 0,
          daysOverdue,
          dueDate: pp.dueDate,
          type: "project_payment",
          status: pp.status,
        });
      }
    });

    return overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [payments, projectPayments, clients]);

  // Calculate collection summary
  const collectionSummary = useMemo((): CollectionSummary => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalOverdueAmount = 0;
    let totalCollectedThisMonth = 0;
    const clientsWithOverdueSet = new Set<string>();
    let totalDaysOverdue = 0;
    let overduePaysmentCount = 0;

    // Regular payments
    payments.forEach((payment: any) => {
      if (payment.status === "overdue" && payment.dueDate) {
        totalOverdueAmount += payment.amount || 0;
        clientsWithOverdueSet.add(payment.clientId);
        const dueDate = new Date(payment.dueDate);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDaysOverdue += daysOverdue;
        overduePaysmentCount++;
      }

      if (payment.status === "paid" && payment.paidAt) {
        const paidDate = new Date(payment.paidAt);
        if (
          paidDate.getMonth() === currentMonth &&
          paidDate.getFullYear() === currentYear
        ) {
          totalCollectedThisMonth += payment.amount || 0;
        }
      }
    });

    // Project payments
    projectPayments.forEach((pp: any) => {
      if (
        (pp.status === "overdue" || pp.status === "collection_needed") &&
        pp.dueDate
      ) {
        totalOverdueAmount += pp.amount || 0;
        clientsWithOverdueSet.add(pp.clientId);
        const dueDate = new Date(pp.dueDate);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDaysOverdue += daysOverdue;
        overduePaysmentCount++;
      }

      if (pp.status === "paid" && pp.paidAt) {
        const paidDate = new Date(pp.paidAt);
        if (
          paidDate.getMonth() === currentMonth &&
          paidDate.getFullYear() === currentYear
        ) {
          totalCollectedThisMonth += pp.amount || 0;
        }
      }
    });

    return {
      totalOverdueAmount,
      clientsWithOverdue: clientsWithOverdueSet.size,
      averageDaysOverdue:
        overduePaysmentCount > 0 ? Math.round(totalDaysOverdue / overduePaysmentCount) : 0,
      totalCollectedThisMonth,
    };
  }, [payments, projectPayments]);

  // Get hosting renewals
  const hostingRenewals = useMemo(() => {
    const now = new Date();
    return hostingRecords
      .filter((record: any) => {
        if (!record.nextPaymentDate) return false;
        const nextPayment = new Date(record.nextPaymentDate);
        const daysUntil = Math.floor(
          (nextPayment.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysUntil <= 30;
      })
      .map((record: any) => {
        const nextPayment = new Date(record.nextPaymentDate);
        const daysUntil = Math.floor(
          (nextPayment.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          ...record,
          daysUntil,
          status:
            daysUntil < 0 ? "overdue" : daysUntil <= 7 ? "expiring_soon" : "upcoming",
        };
      })
      .sort((a: any, b: any) => a.daysUntil - b.daysUntil);
  }, [hostingRecords]);

  const handleSendReminder = async (payment: OverduePayment) => {
    const key = payment.id;
    setSendingStates((prev) => ({ ...prev, [key]: true }));

    try {
      const client = clients.find((c: any) => c.id === payment.clientId);
      const response = await fetch(`/api/clients/${payment.clientId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailType: "payment_reminder",
          subject: "תזכורת תשלום - סטודיו פיקסל",
          recipientEmail: client?.email || "",
        }),
      });

      if (response.ok) {
        setSuccessMessages((prev) => ({ ...prev, [key]: true }));
        setTimeout(
          () => setSuccessMessages((prev) => ({ ...prev, [key]: false })),
          3000
        );
      }
    } catch (error) {
      console.error("Error sending reminder:", error);
    } finally {
      setSendingStates((prev) => ({ ...prev, [key]: false }));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AdminOnly fallback={<AccessDenied />}>
      <div style={{ direction: "rtl", padding: "2rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "3rem" }}>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              color: "var(--foreground)",
              marginBottom: "0.5rem",
            }}
          >
            ציר זמן חשבונאי וגבייה חכמה
          </h1>
          <p
            style={{
              fontSize: "1rem",
              color: "var(--foreground-muted)",
            }}
          >
            מעקב תשלומים וגבייה אוטומטית
          </p>
        </div>

        {/* Section 1: Monthly Timeline */}
        <section style={{ marginBottom: "3rem" }}>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              color: "var(--foreground)",
              marginBottom: "1.5rem",
            }}
          >
            ציר זמן חשבונאי - 6 חודשים אחרונים
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1rem",
            }}
          >
            {timelineData.map((month) => (
              <div
                key={`${month.year}-${month.month}`}
                className="premium-card"
                style={{
                  padding: "1.5rem",
                  backgroundColor: "var(--surface-raised)",
                  border: `2px solid ${
                    month.isCurrentMonth ? "var(--accent)" : "var(--border)"
                  }`,
                  borderRadius: "0.5rem",
                  boxShadow: month.isCurrentMonth
                    ? "0 0 0 3px rgba(var(--accent-rgb), 0.1)"
                    : "none",
                }}
              >
                <div
                  style={{
                    fontWeight: "600",
                    fontSize: "1rem",
                    color: "var(--foreground)",
                    marginBottom: "1rem",
                    textAlign: "center",
                  }}
                >
                  {month.monthName} {month.year}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {month.totalPaid > 0 && (
                    <div
                      style={{
                        padding: "0.5rem",
                        backgroundColor: "rgba(34, 197, 94, 0.1)",
                        borderRight: "3px solid rgb(34, 197, 94)",
                        borderRadius: "0.25rem",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                        תשלום
                      </div>
                      <div
                        style={{
                          fontWeight: "600",
                          color: "rgb(34, 197, 94)",
                          fontSize: "0.9rem",
                        }}
                      >
                        {formatCurrency(month.totalPaid)}
                      </div>
                    </div>
                  )}

                  {month.totalPending > 0 && (
                    <div
                      style={{
                        padding: "0.5rem",
                        backgroundColor: "rgba(249, 115, 22, 0.1)",
                        borderRight: "3px solid rgb(249, 115, 22)",
                        borderRadius: "0.25rem",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                        בטיפול
                      </div>
                      <div
                        style={{
                          fontWeight: "600",
                          color: "rgb(249, 115, 22)",
                          fontSize: "0.9rem",
                        }}
                      >
                        {formatCurrency(month.totalPending)}
                      </div>
                    </div>
                  )}

                  {month.totalOverdue > 0 && (
                    <div
                      style={{
                        padding: "0.5rem",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        borderRight: "3px solid rgb(239, 68, 68)",
                        borderRadius: "0.25rem",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                        逾期
                      </div>
                      <div
                        style={{
                          fontWeight: "600",
                          color: "rgb(239, 68, 68)",
                          fontSize: "0.9rem",
                        }}
                      >
                        {formatCurrency(month.totalOverdue)}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--foreground-muted)",
                      paddingTop: "0.5rem",
                      borderTop: `1px solid var(--border)`,
                    }}
                  >
                    {month.paymentCount} תשלומים
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Smart Collection System */}
        <section>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              color: "var(--foreground)",
              marginBottom: "1.5rem",
            }}
          >
            מערכת גבייה חכמה
          </h2>

          {/* Collection Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "2rem",
            }}
          >
            <div
              className="premium-card"
              style={{
                padding: "1.5rem",
                backgroundColor: "rgba(239, 68, 68, 0.05)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "0.5rem",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
                סך הכל בעיכוב
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "rgb(239, 68, 68)",
                  marginTop: "0.5rem",
                }}
              >
                {formatCurrency(collectionSummary.totalOverdueAmount)}
              </div>
            </div>

            <div
              className="premium-card"
              style={{
                padding: "1.5rem",
                backgroundColor: "rgba(59, 130, 246, 0.05)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "0.5rem",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
                לקוחות בעיכוב
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "rgb(59, 130, 246)",
                  marginTop: "0.5rem",
                }}
              >
                {collectionSummary.clientsWithOverdue}
              </div>
            </div>

            <div
              className="premium-card"
              style={{
                padding: "1.5rem",
                backgroundColor: "rgba(168, 85, 247, 0.05)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
                borderRadius: "0.5rem",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
                ממוצע ימים בעיכוב
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "rgb(168, 85, 247)",
                  marginTop: "0.5rem",
                }}
              >
                {collectionSummary.averageDaysOverdue} ימים
              </div>
            </div>

            <div
              className="premium-card"
              style={{
                padding: "1.5rem",
                backgroundColor: "rgba(34, 197, 94, 0.05)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                borderRadius: "0.5rem",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
                נגבה החודש
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "rgb(34, 197, 94)",
                  marginTop: "0.5rem",
                }}
              >
                {formatCurrency(collectionSummary.totalCollectedThisMonth)}
              </div>
            </div>
          </div>

          {/* Overdue Alerts */}
          {overduePayments.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  color: "var(--foreground)",
                  marginBottom: "1rem",
                }}
              >
                התראות בעיכוב ({overduePayments.length})
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {overduePayments.map((payment) => {
                  let bgColor = "rgba(239, 68, 68, 0.05)";
                  let borderColor = "rgba(239, 68, 68, 0.3)";
                  let badgeColor = "rgb(239, 68, 68)";

                  if (payment.daysOverdue < 15) {
                    bgColor = "rgba(251, 191, 36, 0.05)";
                    borderColor = "rgba(251, 191, 36, 0.3)";
                    badgeColor = "rgb(251, 191, 36)";
                  } else if (payment.daysOverdue < 30) {
                    bgColor = "rgba(249, 115, 22, 0.05)";
                    borderColor = "rgba(249, 115, 22, 0.3)";
                    badgeColor = "rgb(249, 115, 22)";
                  }

                  return (
                    <div
                      key={payment.id}
                      className="premium-card"
                      style={{
                        padding: "1.5rem",
                        backgroundColor: bgColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: "0.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <div
                          style={{
                            fontWeight: "600",
                            color: "var(--foreground)",
                            fontSize: "1rem",
                            marginBottom: "0.5rem",
                          }}
                        >
                          {payment.clientName}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "1rem",
                            fontSize: "0.9rem",
                            color: "var(--foreground-muted)",
                          }}
                        >
                          <span>סכום: {formatCurrency(payment.amount)}</span>
                          <span
                            style={{
                              color: badgeColor,
                              fontWeight: "600",
                            }}
                          >
                            {payment.daysOverdue} ימים בעיכוב
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        {successMessages[payment.id] && (
                          <div
                            style={{
                              padding: "0.5rem 1rem",
                              backgroundColor: "rgba(34, 197, 94, 0.1)",
                              color: "rgb(34, 197, 94)",
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                            }}
                          >
                            ✓ נשלח בהצלחה
                          </div>
                        )}
                        <button
                          onClick={() => handleSendReminder(payment)}
                          disabled={sendingStates[payment.id] || successMessages[payment.id]}
                          style={{
                            padding: "0.5rem 1rem",
                            backgroundColor: "var(--accent)",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: sendingStates[payment.id]
                              ? "not-allowed"
                              : "pointer",
                            opacity: sendingStates[payment.id] ? 0.6 : 1,
                            fontWeight: "500",
                            fontSize: "0.9rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {sendingStates[payment.id] ? "שליחה..." : "📧 שלח תזכורת"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hosting Renewals */}
          {hostingRenewals.length > 0 && (
            <div>
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  color: "var(--foreground)",
                  marginBottom: "1rem",
                }}
              >
                הארכות דומיין - פקיעות קרובות ({hostingRenewals.length})
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {hostingRenewals.map((record) => {
                  let badgeBgColor = "rgba(34, 197, 94, 0.1)";
                  let badgeTextColor = "rgb(34, 197, 94)";
                  let badgeLabel = "קרוב";

                  if (record.status === "overdue") {
                    badgeBgColor = "rgba(239, 68, 68, 0.1)";
                    badgeTextColor = "rgb(239, 68, 68)";
                    badgeLabel = "פקע";
                  } else if (record.status === "expiring_soon") {
                    badgeBgColor = "rgba(249, 115, 22, 0.1)";
                    badgeTextColor = "rgb(249, 115, 22)";
                    badgeLabel = "עומד לפקוע";
                  }

                  return (
                    <div
                      key={`${record.clientId}-${record.domainName}`}
                      className="premium-card"
                      style={{
                        padding: "1.5rem",
                        backgroundColor: "var(--surface-raised)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <div
                          style={{
                            fontWeight: "600",
                            color: "var(--foreground)",
                            fontSize: "1rem",
                            marginBottom: "0.5rem",
                          }}
                        >
                          {record.domainName}
                        </div>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            color: "var(--foreground-muted)",
                          }}
                        >
                          לקוח: {record.clientId}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
                            תשלום שנתי
                          </div>
                          <div
                            style={{
                              fontWeight: "600",
                              color: "var(--foreground)",
                              fontSize: "1rem",
                            }}
                          >
                            {formatCurrency(record.yearlyPaymentAmount)}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: "0.375rem 0.75rem",
                            backgroundColor: badgeBgColor,
                            color: badgeTextColor,
                            borderRadius: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {badgeLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {overduePayments.length === 0 && hostingRenewals.length === 0 && (
            <div
              style={{
                padding: "2rem",
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                textAlign: "center",
                color: "var(--foreground-muted)",
              }}
            >
              <p style={{ fontSize: "1rem" }}>
                אין תשלומים בעיכוב או הארכות דומיין הדורשות תשומת לב
              </p>
            </div>
          )}
        </section>
      </div>
    </AdminOnly>
  );
}
