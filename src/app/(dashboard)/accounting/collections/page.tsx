"use client";

import Link from "next/link";
import { useClients, usePayments, useProjectPayments, useHostingRecords, usePodcastSessions } from "@/lib/api/use-entity";
import { useState, useMemo } from "react";
import { useToast } from "@/components/ui/toast";

interface PaymentEvent {
  id: string;
  clientId?: string;
  clientName: string;
  amount: number;
  date: Date;
  type: "retainer" | "project" | "hosting" | "podcast";
  status: "pending" | "collection_needed" | "paid";
}

export default function CollectionsPage() {
  const { data: clients } = useClients();
  const { data: payments } = usePayments();
  const { data: projectPayments } = useProjectPayments();
  const { data: hostingRecords } = useHostingRecords();
  const { data: podcastSessions } = usePodcastSessions();
  const toast = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const allPaymentEvents = useMemo(() => {
    const events: PaymentEvent[] = [];

    if (clients) {
      clients.forEach((client: any) => {
        if (client.retainerAmount && client.retainerDay) {
          const date = new Date();
          date.setDate(client.retainerDay);
          events.push({
            id: `retainer-${client.id}`,
            clientId: client.id,
            clientName: client.name || client.clientName || "לא ידוע",
            amount: client.retainerAmount,
            date,
            type: "retainer",
            status: client.paymentStatus || "pending",
          });
        }
      });
    }

    if (projectPayments) {
      projectPayments
        .filter((payment: any) => payment.isDue === true && payment.status !== "paid")
        .forEach((payment: any) => {
          const client = clients?.find((c: any) => c.id === payment.clientId);
          const typeLabel = payment.paymentType === "deposit" ? " (מקדמה)" : payment.paymentType === "final" ? " (סופי)" : "";
          // Use dueDate if set, otherwise use today (payment is due now but has no specific date)
          const paymentDate = payment.dueDate ? new Date(payment.dueDate) : new Date();
          events.push({
            id: `project-${payment.id}`,
            clientId: payment.clientId,
            clientName: (client?.name || payment.clientName || "לא ידוע") + typeLabel,
            amount: payment.amount || 0,
            date: paymentDate,
            type: "project",
            status: payment.status || "pending",
          });
        });
    }

    if (hostingRecords) {
      hostingRecords.forEach((record: any) => {
        const client = clients?.find((c: any) => c.id === record.clientId);
        events.push({
          id: `hosting-${record.id}`,
          clientId: record.clientId,
          clientName: client?.name || record.clientName || "לא ידוע",
          amount: record.yearlyPaymentAmount || 0,
          date: new Date(record.nextPaymentDate),
          type: "hosting",
          status: "pending",
        });
      });
    }

    if (podcastSessions) {
      podcastSessions.forEach((session: any) => {
        events.push({
          id: `podcast-${session.id}`,
          clientName: session.name || "LOUD",
          amount: session.price || 0,
          date: new Date(session.paymentDate),
          type: "podcast",
          status: session.paymentStatus || "pending",
        });
      });
    }

    return events;
  }, [clients, payments, projectPayments, hostingRecords, podcastSessions]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const overduePayments = useMemo(() => {
    return allPaymentEvents.filter((e) => e.date < today && e.status !== "paid");
  }, [allPaymentEvents, today]);

  const todayPayments = useMemo(() => {
    return allPaymentEvents.filter((e) => e.date.getTime() === today.getTime() && e.status !== "paid");
  }, [allPaymentEvents, today]);

  const monthStats = useMemo(() => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const eventsThisMonth = allPaymentEvents.filter(
      (e) => e.date >= monthStart && e.date <= monthEnd
    );

    const overdueClients = new Set(
      eventsThisMonth
        .filter((e) => e.date < now && e.status !== "paid")
        .map((e) => e.clientName)
    );

    const upcomingPayments = eventsThisMonth.filter(
      (e) => e.date >= now && e.date <= sevenDaysFromNow && e.status !== "paid"
    );

    const totalThisMonth = eventsThisMonth.reduce((sum, e) => sum + e.amount, 0);
    const totalUpcoming = upcomingPayments.reduce((sum, e) => sum + e.amount, 0);

    return {
      totalEvents: eventsThisMonth.length,
      totalAmount: totalThisMonth,
      overdueCount: overdueClients.size,
      upcomingCount: upcomingPayments.length,
      upcomingAmount: totalUpcoming,
    };
  }, [allPaymentEvents, currentDate]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const getEventsForDay = (day: number): PaymentEvent[] => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return allPaymentEvents.filter((e) => e.date.getDate() === day && e.date.getMonth() === currentDate.getMonth());
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      retainer: "#22c55e",
      project: "#3b82f6",
      hosting: "#8b5cf6",
      podcast: "#fbbf24",
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
      retainer: "ריטיינר",
      project: "פרויקט",
      hosting: "אחסון",
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

  const getDaysOverdue = (date: Date): number => {
    const diffTime = today.getTime() - new Date(date).getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const truncateText = (text: string, maxLength: number = 20): string => {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  const handleMarkPaid = (eventId: string) => {
    toast("סימנתם את התשלום כשולם", "success");
  };

  const handleSendReminder = (clientName: string) => {
    toast(`שלחנו תזכורת ל${clientName}`, "success");
  };

  const monthName = new Intl.DateTimeFormat("he-IL", { month: "long" }).format(currentDate);
  const weekdayHeaders = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  return (
    <div style={{ direction: "rtl", padding: "2rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--foreground)" }}>
          גבייה
        </h1>
        <p style={{ color: "var(--foreground-muted)", fontSize: "0.95rem" }}>לוח גבייה חודשי</p>
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
            תשלומים החודש
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--accent)" }}>
            {monthStats.totalEvents} תשלומים
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--foreground)", marginTop: "0.5rem" }}>
            ₪{monthStats.totalAmount.toLocaleString("he-IL")}
          </p>
        </div>

        <button
          onClick={() => setShowOverdueModal(true)}
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            cursor: "pointer",
            transition: "all 0.2s ease",
            textAlign: "right",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface)";
            e.currentTarget.style.borderColor = "#ef4444";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface-raised)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            לקוחות באיחור
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#ef4444" }}>
            {monthStats.overdueCount} לקוחות
          </p>
        </button>

        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            תשלומים קרובים (7 ימים)
          </p>
          <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#10b981" }}>
            {monthStats.upcomingCount} תשלומים
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--foreground)", marginTop: "0.5rem" }}>
            ₪{monthStats.upcomingAmount.toLocaleString("he-IL")}
          </p>
        </div>
      </div>

      {/* Daily Collection Tasks */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1.5rem", color: "var(--foreground)" }}>
          משימות גבייה להיום
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
          {/* Today's Payments */}
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "1rem", color: "var(--foreground)" }}>
              תשלומים להיום ({todayPayments.length})
            </h3>
            {todayPayments.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {todayPayments.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "1rem",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      background: "var(--surface)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <Link href={event.clientId ? `/clients/${event.clientId}` : "#"}>
                        <p
                          style={{
                            fontWeight: "600",
                            color: "var(--accent)",
                            cursor: "pointer",
                            textDecoration: "none",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {event.clientName}
                        </p>
                      </Link>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <p style={{ fontSize: "0.9rem", color: "var(--foreground)", fontWeight: "600" }}>
                          ₪{event.amount.toLocaleString("he-IL")}
                        </p>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            color: "#fff",
                            background: getTypeColor(event.type),
                          }}
                        >
                          {getTypeLabel(event.type)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginLeft: "1rem" }}>
                      <button
                        onClick={() => handleMarkPaid(event.id)}
                        style={{
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.8rem",
                          fontWeight: "600",
                          border: "1px solid var(--border)",
                          borderRadius: "0.375rem",
                          background: "var(--surface-raised)",
                          color: "var(--foreground)",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#22c55e";
                          e.currentTarget.style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--surface-raised)";
                          e.currentTarget.style.color = "var(--foreground)";
                        }}
                      >
                        שולם
                      </button>
                      <button
                        onClick={() => handleSendReminder(event.clientName)}
                        style={{
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.8rem",
                          fontWeight: "600",
                          border: "1px solid var(--border)",
                          borderRadius: "0.375rem",
                          background: "var(--surface-raised)",
                          color: "var(--foreground)",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--accent)";
                          e.currentTarget.style.color = "#000";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--surface-raised)";
                          e.currentTarget.style.color = "var(--foreground)";
                        }}
                      >
                        שלח תזכורת
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>אין תשלומים להיום</p>
            )}
          </div>

          {/* Overdue Payments */}
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "1rem", color: "var(--foreground)" }}>
              תשלומים באיחור ({overduePayments.length})
            </h3>
            {overduePayments.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {overduePayments.slice(0, 5).map((event) => {
                  const daysOverdue = getDaysOverdue(event.date);
                  return (
                    <div
                      key={event.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1rem",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        background: "var(--surface)",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <Link href={event.clientId ? `/clients/${event.clientId}` : "#"}>
                          <p
                            style={{
                              fontWeight: "600",
                              color: "var(--accent)",
                              cursor: "pointer",
                              textDecoration: "none",
                              marginBottom: "0.25rem",
                            }}
                          >
                            {event.clientName}
                          </p>
                        </Link>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <p style={{ fontSize: "0.9rem", color: "var(--foreground)", fontWeight: "600" }}>
                            ₪{event.amount.toLocaleString("he-IL")}
                          </p>
                          <span style={{ fontSize: "0.8rem", color: "#ef4444", fontWeight: "600" }}>
                            {daysOverdue} ימים באיחור
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", marginLeft: "1rem" }}>
                        <button
                          onClick={() => handleMarkPaid(event.id)}
                          style={{
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            border: "1px solid var(--border)",
                            borderRadius: "0.375rem",
                            background: "var(--surface-raised)",
                            color: "var(--foreground)",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#22c55e";
                            e.currentTarget.style.color = "#fff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "var(--surface-raised)";
                            e.currentTarget.style.color = "var(--foreground)";
                          }}
                        >
                          שולם
                        </button>
                        <button
                          onClick={() => handleSendReminder(event.clientName)}
                          style={{
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            border: "1px solid var(--border)",
                            borderRadius: "0.375rem",
                            background: "var(--surface-raised)",
                            color: "var(--foreground)",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--accent)";
                            e.currentTarget.style.color = "#000";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "var(--surface-raised)";
                            e.currentTarget.style.color = "var(--foreground)";
                          }}
                        >
                          שלח תזכורת
                        </button>
                      </div>
                    </div>
                  );
                })}
                {overduePayments.length > 5 && (
                  <p style={{ fontSize: "0.85rem", color: "var(--accent)", cursor: "pointer", marginTop: "0.5rem" }}>
                    הצג הכל ({overduePayments.length})
                  </p>
                )}
              </div>
            ) : (
              <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>אין תשלומים באיחור</p>
            )}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        {/* Month Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <button
            onClick={prevMonth}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              color: "var(--foreground)",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            ←
          </button>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--foreground)" }}>
            {monthName} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={nextMonth}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              color: "var(--foreground)",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            →
          </button>
        </div>

        {/* Weekday Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "0.5rem",
            marginBottom: "0.5rem",
          }}
        >
          {weekdayHeaders.map((day) => (
            <div
              key={day}
              style={{
                textAlign: "center",
                padding: "0.5rem",
                fontWeight: "600",
                color: "var(--foreground-muted)",
                fontSize: "0.9rem",
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "0.5rem",
          }}
        >
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                aspectRatio: "1",
                background: "transparent",
              }}
            />
          ))}

          {/* Days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            const isSelected = selectedDay === day;
            const isExpanded = expandedDay === day;

            return (
              <div key={day} style={{ position: "relative" }}>
                <button
                  onClick={() => {
                    setSelectedDay(isSelected ? null : day);
                    setExpandedDay(isExpanded ? null : day);
                  }}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: isSelected ? "var(--accent)" : "var(--surface-raised)",
                    color: isSelected ? "#000" : "var(--foreground)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.background = "var(--surface)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.background = "var(--surface-raised)";
                    }
                  }}
                >
                  <span style={{ marginBottom: "0.25rem" }}>{day}</span>
                  <div style={{ display: "flex", gap: "0.2rem", flexWrap: "wrap", justifyContent: "center" }}>
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        style={{
                          width: "0.5rem",
                          height: "0.5rem",
                          borderRadius: "50%",
                          background: getTypeColor(event.type),
                        }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: "0.65rem", marginLeft: "0.2rem" }}>+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </button>

                {/* Expanded Day Popup */}
                {isExpanded && dayEvents.length > 3 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "0",
                      right: "0",
                      zIndex: 10,
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      padding: "0.75rem",
                      marginTop: "0.5rem",
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        style={{
                          padding: "0.5rem",
                          fontSize: "0.8rem",
                          borderBottom: "1px solid var(--border)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <p style={{ fontWeight: "600", color: "var(--foreground)", marginBottom: "0.25rem" }}>
                          {truncateText(event.clientName, 15)}
                        </p>
                        <p style={{ color: "var(--foreground-muted)", fontSize: "0.75rem" }}>
                          ₪{event.amount.toLocaleString("he-IL")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details */}
      {selectedDay && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "2rem",
          }}
        >
          <h3 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1.5rem", color: "var(--foreground)" }}>
            תשלומים ביום {selectedDay} ב{monthName}
          </h3>

          {selectedDayEvents.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {selectedDayEvents.map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Link href={event.clientId ? `/clients/${event.clientId}` : "#"}>
                      <p
                        style={{
                          fontWeight: "600",
                          color: "var(--accent)",
                          cursor: "pointer",
                          textDecoration: "none",
                          marginBottom: "0.25rem",
                        }}
                      >
                        {event.clientName}
                      </p>
                    </Link>
                    <p style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
                      ₪{event.amount.toLocaleString("he-IL")}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginLeft: "1rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "0.375rem",
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        color: "#fff",
                        background: getTypeColor(event.type),
                      }}
                    >
                      {getTypeLabel(event.type)}
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "0.375rem",
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        color: "#fff",
                        background: getStatusColor(event.status),
                      }}
                    >
                      {getStatusLabel(event.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--foreground-muted)" }}>אין תשלומים ביום זה</p>
          )}
        </div>
      )}

      {/* Overdue Modal */}
      {showOverdueModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setShowOverdueModal(false)}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "1rem",
              padding: "2rem",
              maxWidth: "900px",
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              direction: "rtl",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--foreground)" }}>
                תשלומים באיחור
              </h2>
              <button
                onClick={() => setShowOverdueModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "var(--foreground)",
                }}
              >
                ✕
              </button>
            </div>

            {overduePayments.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.9rem",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground)" }}>
                        שם לקוח
                      </th>
                      <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground)" }}>
                        סכום
                      </th>
                      <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground)" }}>
                        סוג
                      </th>
                      <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground)" }}>
                        תאריך תשלום
                      </th>
                      <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground)" }}>
                        ימים באיחור
                      </th>
                      <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground)" }}>
                        סטטוס
                      </th>
                      <th style={{ padding: "1rem", textAlign: "right", fontWeight: "600", color: "var(--foreground)" }}>
                        פעולות
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overduePayments.map((event) => {
                      const daysOverdue = getDaysOverdue(event.date);
                      const dateStr = new Date(event.date).toLocaleDateString("he-IL");
                      return (
                        <tr
                          key={event.id}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            background: "var(--surface)",
                          }}
                        >
                          <td style={{ padding: "1rem", color: "var(--foreground)" }}>
                            <Link href={event.clientId ? `/clients/${event.clientId}` : "#"}>
                              <span
                                style={{
                                  color: "var(--accent)",
                                  cursor: "pointer",
                                  textDecoration: "none",
                                }}
                              >
                                {event.clientName}
                              </span>
                            </Link>
                          </td>
                          <td style={{ padding: "1rem", color: "var(--foreground)" }}>
                            ₪{event.amount.toLocaleString("he-IL")}
                          </td>
                          <td style={{ padding: "1rem", color: "var(--foreground)" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.25rem 0.75rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.8rem",
                                fontWeight: "600",
                                color: "#fff",
                                background: getTypeColor(event.type),
                              }}
                            >
                              {getTypeLabel(event.type)}
                            </span>
                          </td>
                          <td style={{ padding: "1rem", color: "var(--foreground)" }}>
                            {dateStr}
                          </td>
                          <td style={{ padding: "1rem", color: "#ef4444", fontWeight: "600" }}>
                            {daysOverdue}
                          </td>
                          <td style={{ padding: "1rem", color: "var(--foreground)" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.25rem 0.75rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.8rem",
                                fontWeight: "600",
                                color: "#fff",
                                background: getStatusColor(event.status),
                              }}
                            >
                              {getStatusLabel(event.status)}
                            </span>
                          </td>
                          <td style={{ padding: "1rem", color: "var(--foreground)" }}>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                onClick={() => handleMarkPaid(event.id)}
                                style={{
                                  padding: "0.4rem 0.6rem",
                                  fontSize: "0.75rem",
                                  fontWeight: "600",
                                  border: "1px solid var(--border)",
                                  borderRadius: "0.25rem",
                                  background: "var(--surface-raised)",
                                  color: "var(--foreground)",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#22c55e";
                                  e.currentTarget.style.color = "#fff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "var(--surface-raised)";
                                  e.currentTarget.style.color = "var(--foreground)";
                                }}
                              >
                                סמן כשולם
                              </button>
                              <button
                                onClick={() => handleSendReminder(event.clientName)}
                                style={{
                                  padding: "0.4rem 0.6rem",
                                  fontSize: "0.75rem",
                                  fontWeight: "600",
                                  border: "1px solid var(--border)",
                                  borderRadius: "0.25rem",
                                  background: "var(--surface-raised)",
                                  color: "var(--foreground)",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "var(--accent)";
                                  e.currentTarget.style.color = "#000";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "var(--surface-raised)";
                                  e.currentTarget.style.color = "var(--foreground)";
                                }}
                              >
                                שלח תזכורת
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "var(--foreground-muted)" }}>אין תשלומים באיחור</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
