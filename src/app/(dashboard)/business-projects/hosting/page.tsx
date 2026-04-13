"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useHostingRecords, useClients } from "@/lib/api/use-entity"

export default function HostingPage() {
  const router = useRouter()
  const { data: hostingRecords, update: updateHosting, create: createHosting, remove: removeHosting } = useHostingRecords()
  const { data: clients } = useClients()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    clientId: "",
    domainName: "",
    hostingProvider: "",
    yearlyPaymentAmount: "",
    nextPaymentDate: "",
  })

  const getStatus = (record: any) => {
    const nextPayment = new Date(record.nextPaymentDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    nextPayment.setHours(0, 0, 0, 0)

    if (record.status === "cancelled") return "cancelled"
    if (nextPayment < today) return "overdue"

    const daysUntilPayment = Math.floor(
      (nextPayment.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysUntilPayment <= 30 && daysUntilPayment > 0) return "expiring_soon"
    if (daysUntilPayment > 30) return "active"

    return "active"
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "active":
        return "green"
      case "expiring_soon":
        return "gold"
      case "overdue":
        return "red"
      case "cancelled":
        return "gray"
      default:
        return "gray"
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "פעיל"
      case "expiring_soon":
        return "עומד להסתיים"
      case "overdue":
        return "逾期"
      case "cancelled":
        return "בוטל"
      default:
        return status
    }
  }

  const handleMarkAsPaid = async (id: string) => {
    const record = hostingRecords?.find((r) => r.id === id)
    if (!record) return

    const nextYear = new Date(record.nextPaymentDate)
    nextYear.setFullYear(nextYear.getFullYear() + 1)

    try {
      await updateHosting(id, {
        lastPaidDate: new Date().toISOString(),
        nextPaymentDate: nextYear.toISOString(),
      } as any)
    } catch (err) {
      console.error("Error marking as paid:", err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק את רשומה זו?")) return

    try {
      await removeHosting(id)
    } catch (err) {
      console.error("Error deleting:", err)
    }
  }

  const handleAddHosting = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createHosting({
        ...formData,
        yearlyPaymentAmount: parseFloat(formData.yearlyPaymentAmount),
      } as any)
      setFormData({
        clientId: "",
        domainName: "",
        hostingProvider: "",
        yearlyPaymentAmount: "",
        nextPaymentDate: "",
      })
      setShowForm(false)
    } catch (err) {
      console.error("Error adding hosting:", err)
    }
  }

  const summary = useMemo(() => {
    if (!hostingRecords) return { active: 0, upcomingCount: 0, overdueCount: 0, revenue: 0 }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const thirtyDaysFromNow = new Date(today)
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    let active = 0
    let upcomingCount = 0
    let overdueCount = 0
    let revenue = 0

    hostingRecords.forEach((record) => {
      const status = getStatus(record)
      if (status !== "cancelled") active++
      if (status === "expiring_soon") upcomingCount++
      if (status === "overdue") overdueCount++
      if (status !== "cancelled") revenue += record.yearlyPaymentAmount || 0
    })

    return { active, upcomingCount, overdueCount, revenue }
  }, [hostingRecords])

  return (
    <div style={{ direction: "rtl", padding: "2rem", color: "var(--foreground)" }}>
      <h1 style={{ marginBottom: "2rem", fontSize: "2rem", fontWeight: "bold" }}>
        ניהול הוסטינג
      </h1>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ background: "var(--surface-raised)", padding: "1rem", borderRadius: "0.5rem", border: `1px solid var(--border)` }}>
          <div style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
            דומיינים פעילים
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "bold", marginTop: "0.5rem" }}>
            {summary.active}
          </div>
        </div>
        <div style={{ background: "var(--surface-raised)", padding: "1rem", borderRadius: "0.5rem", border: `1px solid var(--border)` }}>
          <div style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
            תשלומים קרובים
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "bold", marginTop: "0.5rem", color: "gold" }}>
            {summary.upcomingCount}
          </div>
        </div>
        <div style={{ background: "var(--surface-raised)", padding: "1rem", borderRadius: "0.5rem", border: `1px solid var(--border)` }}>
          <div style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
            מתנהלים
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "bold", marginTop: "0.5rem", color: "red" }}>
            {summary.overdueCount}
          </div>
        </div>
        <div style={{ background: "var(--surface-raised)", padding: "1rem", borderRadius: "0.5rem", border: `1px solid var(--border)` }}>
          <div style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
            הכנסות שנתיות
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "bold", marginTop: "0.5rem" }}>
            ₪{summary.revenue.toLocaleString("he-IL")}
          </div>
        </div>
      </div>

      {/* Add Form */}
      <button
        onClick={() => setShowForm(!showForm)}
        style={{
          marginBottom: "2rem",
          padding: "0.75rem 1.5rem",
          background: "var(--accent)",
          color: "white",
          border: "none",
          borderRadius: "0.5rem",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {showForm ? "בטל" : "+ הוסף הוסטינג"}
      </button>

      {showForm && (
        <form
          onSubmit={handleAddHosting}
          style={{
            background: "var(--surface-raised)",
            padding: "2rem",
            borderRadius: "0.5rem",
            border: `1px solid var(--border)`,
            marginBottom: "2rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1rem",
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              לקוח
            </label>
            <select
              className="form-select"
              required
              value={formData.clientId}
              onChange={(e) =>
                setFormData({ ...formData, clientId: e.target.value })
              }
            >
              <option value="">בחר לקוח</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              דומיין
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="example.com"
              required
              value={formData.domainName}
              onChange={(e) =>
                setFormData({ ...formData, domainName: e.target.value })
              }
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              ספק הוסטינג
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="Namecheap, GoDaddy..."
              required
              value={formData.hostingProvider}
              onChange={(e) =>
                setFormData({ ...formData, hostingProvider: e.target.value })
              }
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              תשלום שנתי (₪)
            </label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              placeholder="0.00"
              required
              value={formData.yearlyPaymentAmount}
              onChange={(e) =>
                setFormData({ ...formData, yearlyPaymentAmount: e.target.value })
              }
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              תאריך התשלום הבא
            </label>
            <input
              className="form-input"
              type="date"
              required
              value={formData.nextPaymentDate}
              onChange={(e) =>
                setFormData({ ...formData, nextPaymentDate: e.target.value })
              }
            />
          </div>

          <button
            type="submit"
            className="mod-btn-primary"
            style={{ gridColumn: "1 / -1" }}
          >
            שמור
          </button>
        </form>
      )}

      {/* Table */}
      <div
        style={{
          overflowX: "auto",
          background: "var(--surface-raised)",
          borderRadius: "0.5rem",
          border: `1px solid var(--border)`,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid var(--border)` }}>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "bold" }}>
                דומיין
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "bold" }}>
                לקוח
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "bold" }}>
                ספק
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "bold" }}>
                תשלום שנתי
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "bold" }}>
                תאריך תשלום
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "bold" }}>
                סטטוס
              </th>
              <th style={{ padding: "1rem", textAlign: "right", fontWeight: "bold" }}>
                פעולות
              </th>
            </tr>
          </thead>
          <tbody>
            {hostingRecords?.map((record) => {
              const status = getStatus(record)
              const color = statusColor(status)
              return (
                <tr key={record.id} style={{ borderBottom: `1px solid var(--border)` }}>
                  <td style={{ padding: "1rem" }}>{record.domainName}</td>
                  <td style={{ padding: "1rem" }}>
                    {clients?.find((c) => c.id === record.clientId)?.name || "-"}
                  </td>
                  <td style={{ padding: "1rem" }}>{record.hostingProvider}</td>
                  <td style={{ padding: "1rem" }}>
                    ₪{record.yearlyPaymentAmount?.toLocaleString("he-IL")}
                  </td>
                  <td style={{ padding: "1rem" }}>
                    {new Date(record.nextPaymentDate).toLocaleDateString("he-IL")}
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.875rem",
                        fontWeight: "bold",
                        backgroundColor: `${color}20`,
                        color: color,
                      }}
                    >
                      {statusLabel(status)}
                    </span>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <button
                      onClick={() => handleMarkAsPaid(record.id)}
                      className="mod-btn-ghost"
                      style={{ marginLeft: "0.5rem", fontSize: "0.875rem" }}
                    >
                      סימון כשולם
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="mod-btn-ghost"
                      style={{
                        color: "red",
                        fontSize: "0.875rem",
                        marginLeft: "0.5rem",
                      }}
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!hostingRecords || hostingRecords.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "var(--foreground-muted)",
          }}
        >
          אין רשומות הוסטינג
        </div>
      ) : null}
    </div>
  )
}
