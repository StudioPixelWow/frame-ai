"use client"

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation"
import { usePodcastSessions } from "@/lib/api/use-entity"
import { useMemo, useState } from "react"

const PACKAGE_LABELS: Record<string, string> = {
  recording_only: "הקלטה בלבד",
  recording_3_videos: "3 וידאו",
  recording_5_videos: "5 וידאו",
  recording_10_videos: "10 וידאו",
}

export default function PodcastClientsPage() {
  const router = useRouter()
  const { data: sessions, loading } = usePodcastSessions()
  const [search, setSearch] = useState("")

  const clientStats = useMemo(() => {
    if (!sessions) return []
    const map = new Map<string, {
      clientName: string
      clientId: string
      totalSessions: number
      completedSessions: number
      upcomingSessions: number
      totalRevenue: number
      paidAmount: number
      pendingAmount: number
      lastSession: string
      packages: Set<string>
    }>()

    const now = new Date()
    sessions.forEach((s) => {
      const key = s.clientName || "לא ידוע"
      if (!map.has(key)) {
        map.set(key, {
          clientName: key,
          clientId: s.clientId || "",
          totalSessions: 0,
          completedSessions: 0,
          upcomingSessions: 0,
          totalRevenue: 0,
          paidAmount: 0,
          pendingAmount: 0,
          lastSession: "",
          packages: new Set(),
        })
      }
      const stat = map.get(key)!
      stat.totalSessions++
      if (s.packageType) stat.packages.add(s.packageType)
      stat.totalRevenue += s.price || 0

      if (s.paymentStatus === "paid") {
        stat.paidAmount += s.price || 0
      } else {
        stat.pendingAmount += s.price || 0
      }

      if (s.sessionStatus === "completed") {
        stat.completedSessions++
      }
      const sessionDate = new Date(s.sessionDate)
      if (sessionDate > now && s.sessionStatus !== "cancelled") {
        stat.upcomingSessions++
      }
      if (!stat.lastSession || s.sessionDate > stat.lastSession) {
        stat.lastSession = s.sessionDate
      }
    })

    return Array.from(map.values()).sort((a, b) => b.totalSessions - a.totalSessions)
  }, [sessions])

  const filtered = useMemo(() => {
    if (!search) return clientStats
    const q = search.toLowerCase()
    return clientStats.filter((c) => c.clientName.toLowerCase().includes(q))
  }, [clientStats, search])

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", padding: "2rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
          <button
            onClick={() => router.push("/accounting/podcast")}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              padding: "0.4rem 0.75rem",
              color: "var(--foreground-muted)",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            → חזור
          </button>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--foreground)" }}>
            👥 לקוחות פודקאסט
          </div>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", margin: 0 }}>
          סיכום לקוחות, הקלטות ותשלומים
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "1.5rem" }}>
        <input
          className="form-input"
          placeholder="חיפוש לקוח..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: "300px" }}
        />
      </div>

      {/* Stats Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>סה״כ לקוחות</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--foreground)" }}>{clientStats.length}</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>סה״כ הכנסות</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--foreground)" }}>
            {clientStats.reduce((s, c) => s + c.totalRevenue, 0).toLocaleString("he-IL")}
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>ממתין לתשלום</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#f59e0b" }}>
            {clientStats.reduce((s, c) => s + c.pendingAmount, 0).toLocaleString("he-IL")}
          </div>
        </div>
      </div>

      {/* Client Cards */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--foreground-muted)" }}>טוען...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "0.75rem", padding: "3rem", textAlign: "center", color: "var(--foreground-muted)" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📭</div>
          <div>אין לקוחות להצגה</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {filtered.map((client) => (
            <div
              key={client.clientName}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-muted)"
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)"
                e.currentTarget.style.boxShadow = "none"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.25rem" }}>
                    {client.clientName}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                    {Array.from(client.packages).map(p => PACKAGE_LABELS[p] || p).join(", ")}
                  </div>
                </div>
                <div style={{
                  padding: "0.25rem 0.625rem",
                  borderRadius: "999px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  background: client.pendingAmount > 0 ? "#f59e0b20" : "#22c55e20",
                  color: client.pendingAmount > 0 ? "#f59e0b" : "#22c55e",
                  border: `1px solid ${client.pendingAmount > 0 ? "#f59e0b" : "#22c55e"}`,
                }}>
                  {client.pendingAmount > 0 ? "ממתין לתשלום" : "שולם"}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--foreground-muted)" }}>הקלטות</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--foreground)" }}>{client.totalSessions}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--foreground-muted)" }}>הושלמו</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#22c55e" }}>{client.completedSessions}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--foreground-muted)" }}>קרובות</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#38bdf8" }}>{client.upcomingSessions}</div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--foreground)" }}>
                  <span style={{ fontWeight: 700 }}>{client.totalRevenue.toLocaleString("he-IL")}</span> סה״כ
                  {client.pendingAmount > 0 && (
                    <span style={{ color: "#f59e0b", marginRight: "0.5rem", fontSize: "0.75rem" }}>
                      ({client.pendingAmount.toLocaleString("he-IL")} ממתין)
                    </span>
                  )}
                </div>
                {client.lastSession && (
                  <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
                    אחרון: {new Date(client.lastSession).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
