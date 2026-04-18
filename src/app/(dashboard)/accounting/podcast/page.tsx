"use client"

import { useRouter } from "next/navigation"
import { usePodcastSessions } from "@/lib/api/use-entity"
import { useToast } from "@/components/ui/toast"
import { Modal } from "@/components/ui/modal"
import { useState, useMemo } from "react"

const STATUS_LABELS = {
  booked: "מאושר",
  completed: "הושלם",
  cancelled: "בוטל",
  no_show: "לא הופיע",
} as const

const CONTENT_STATUS_LABELS = {
  pending_upload: "ממתין",
  drafts_uploaded: "טיוטות",
  client_review: "בבדיקה",
  revisions: "תיקונים",
  approved: "אושר",
  completed: "הושלם",
} as const

const PACKAGE_LABELS = {
  recording_only: "הקלטה בלבד",
  recording_3_videos: "3 וידאו",
  recording_5_videos: "5 וידאו",
  recording_10_videos: "10 וידאו",
} as const

const STATUS_COLORS = {
  booked: "#38bdf8",
  completed: "#22c55e",
  cancelled: "#ef4444",
  no_show: "#f59e0b",
} as const

const CONTENT_STATUS_COLORS = {
  pending_upload: "#6b7280",
  drafts_uploaded: "#f59e0b",
  client_review: "#a78bfa",
  revisions: "#f59e0b",
  approved: "#22c55e",
  completed: "#22c55e",
} as const

export default function PodcastPage() {
  const router = useRouter()
  const { data: sessions } = usePodcastSessions()
  const toast = useToast()

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterClient, setFilterClient] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const stats = useMemo(() => {
    if (!sessions) return { totalSessions: 0, todaySessions: 0, completedSessions: 0, upcomingSessions: 0 }

    const now = new Date()
    const todayStr = now.toISOString().split("T")[0]

    // Current week boundaries (Sunday–Saturday)
    const dayOfWeek = now.getDay() // 0=Sun
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    let totalSessions = 0
    let completedSessions = 0
    let upcomingSessions = 0
    let todaySessions = 0

    sessions.forEach((session) => {
      totalSessions++
      const sessionDate = new Date(session.sessionDate)
      const sessionDateStr = session.sessionDate?.split("T")[0] || ""

      if (session.sessionStatus === "completed") {
        completedSessions++
      }

      // Today's sessions: scheduled for today, not cancelled
      if (sessionDateStr === todayStr && session.sessionStatus !== "cancelled") {
        todaySessions++
      }

      // Upcoming: scheduled within current week, not cancelled, today or later
      if (sessionDate >= weekStart && sessionDate <= weekEnd && sessionDate >= now && session.sessionStatus !== "cancelled") {
        upcomingSessions++
      }
    })

    return {
      totalSessions,
      todaySessions,
      completedSessions,
      upcomingSessions,
    }
  }, [sessions])

  const uniqueClients = useMemo(() => {
    if (!sessions) return []
    const clients = new Set(sessions.map((s) => s.clientName))
    return Array.from(clients).sort()
  }, [sessions])

  const filtered = useMemo(() => {
    if (!sessions) return []
    return sessions.filter((session) => {
      const matchesSearch =
        !search ||
        session.clientName.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = !filterStatus || session.sessionStatus === filterStatus
      const matchesClient = !filterClient || session.clientName === filterClient

      return matchesSearch && matchesStatus && matchesClient
    })
  }, [sessions, search, filterStatus, filterClient])

  const handleCreateSession = () => {
    router.push("/accounting/podcast/calendar")
  }

  const getStatusColor = (status: string) => STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "#6b7280"
  const getContentStatusColor = (status: string) =>
    CONTENT_STATUS_COLORS[status as keyof typeof CONTENT_STATUS_COLORS] || "#6b7280"

  const getStatusLabel = (status: string) => STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status
  const getContentStatusLabel = (status: string) =>
    CONTENT_STATUS_LABELS[status as keyof typeof CONTENT_STATUS_LABELS] || status
  const getPackageLabel = (pkg: string) => PACKAGE_LABELS[pkg as keyof typeof PACKAGE_LABELS] || pkg

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", padding: "2rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "var(--foreground)" }}>
            🎙️ LOUD פודקאסט
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--yellow)",
              color: "#000",
              padding: "0.25rem 0.75rem",
              borderRadius: "999px",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            ⭐ מקצועי
          </div>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", margin: 0 }}>
          ניהול הקלטות, לקוחות ותוכן
        </p>
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "2.5rem",
        }}
      >
        {[
          { label: "סה״כ הקלטות", value: stats.totalSessions, icon: "📊" },
          { label: "הקלטות היום", value: stats.todaySessions, icon: "🔴" },
          { label: "הקלטות הושלמו", value: stats.completedSessions, icon: "✅" },
          { label: "הקלטות השבוע", value: stats.upcomingSessions, icon: "📅" },
        ].map((stat, idx) => (
          <div
            key={idx}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              transition: "all 180ms ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-muted)"
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)"
              e.currentTarget.style.transform = "translateY(-2px)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)"
              e.currentTarget.style.boxShadow = "none"
              e.currentTarget.style.transform = "translateY(0)"
            }}
          >
            <div style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>{stat.icon}</div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--foreground)" }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Navigation Cards */}
      <div style={{ marginBottom: "3rem" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--foreground-muted)", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          עמודות עיקריות
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          {[
            { icon: "📅", label: "יומן הקלטות", desc: "צפה בלוח הקלטות", href: "/accounting/podcast/calendar" },
            { icon: "👥", label: "לקוחות פודקאסט", desc: "ניהול לקוחות", href: "/accounting/podcast/clients" },
            { icon: "➕", label: "הזמן הקלטה", desc: "צור הקלטה חדשה", href: "/accounting/podcast/calendar" },
            { icon: "📊", label: "מעקב תוכן", desc: "ניהול תוכן וסטטוס", href: "/accounting/podcast/tracking" },
          ].map((nav, idx) => (
            <div
              key={idx}
              onClick={() => (nav.href === "#" ? handleCreateSession() : router.push(nav.href))}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                cursor: "pointer",
                transition: "all 200ms ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = "var(--border-muted)"
                el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)"
                el.style.transform = "translateY(-3px)"
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = "var(--border)"
                el.style.boxShadow = "none"
                el.style.transform = "translateY(0)"
              }}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>{nav.icon}</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.25rem" }}>
                {nav.label}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>{nav.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sessions Section */}
      <div style={{ marginBottom: "3rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--foreground)" }}>
            🎬 הקלטות קרובות
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              className="form-input"
              placeholder="חיפוש לקוח או כותרת..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: "250px", flex: "0 1 auto", minWidth: "150px" }}
            />
            <select
              className="form-select"
              value={filterStatus || ""}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              style={{ maxWidth: "150px", flex: "0 1 auto" }}
            >
              <option value="">כל הסטטוסים</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="form-select"
              value={filterClient || ""}
              onChange={(e) => setFilterClient(e.target.value || null)}
              style={{ maxWidth: "150px", flex: "0 1 auto" }}
            >
              <option value="">כל הלקוחות</option>
              {uniqueClients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: "0.75rem",
              padding: "3rem 2rem",
              textAlign: "center",
              color: "var(--foreground-muted)",
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📭</div>
            <div>אין הקלטות להצגה</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {filtered.map((session) => {
              const statusLabel = getStatusLabel(session.sessionStatus)
              const contentStatusLabel = getContentStatusLabel(session.contentStatus || "pending_upload")
              const packageLabel = getPackageLabel(session.packageType || "recording_only")

              return (
                <div
                  key={session.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    transition: "all 150ms ease",
                    cursor: "pointer",
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
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)", marginBottom: "0.25rem" }}>
                        {session.clientName}
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "var(--foreground-muted)" }}>
                        {session.sessionDate}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-start" }}>
                      <div
                        style={{
                          background: STATUS_COLORS[session.sessionStatus as keyof typeof STATUS_COLORS] || "#6b7280",
                          color: "#000",
                          padding: "0.25rem 0.625rem",
                          borderRadius: "999px",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                        }}
                      >
                        {statusLabel}
                      </div>
                      <div
                        style={{
                          background: `${getContentStatusColor(session.contentStatus || "pending_upload")}20`,
                          border: `1px solid ${getContentStatusColor(session.contentStatus || "pending_upload")}`,
                          color: getContentStatusColor(session.contentStatus || "pending_upload"),
                          padding: "0.25rem 0.625rem",
                          borderRadius: "999px",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                        }}
                      >
                        {contentStatusLabel}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                        תאריך
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "var(--foreground)" }}>
                        {new Date(session.sessionDate).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                        שעה
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "var(--foreground)" }}>
                        {session.startTime || "—"}{session.endTime ? ` - ${session.endTime}` : ""}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.25rem" }}>
                        חבילה
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "var(--foreground)" }}>
                        {packageLabel}
                      </div>
                    </div>
                  </div>

                  {session.notes && (
                    <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", borderTop: "1px solid var(--border-muted)", paddingTop: "0.75rem", marginTop: "0.75rem" }}>
                      {session.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
