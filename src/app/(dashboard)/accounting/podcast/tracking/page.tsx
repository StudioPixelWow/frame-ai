"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { usePodcastSessions } from "@/lib/api/use-entity"

const CONTENT_STATUSES = [
  "pending_upload",
  "drafts_uploaded",
  "client_review",
  "revisions",
  "approved",
  "completed",
]

const STATUS_LABELS: Record<string, string> = {
  pending_upload: "ממתין העלאה",
  drafts_uploaded: "טיוטות הועלו",
  client_review: "בדיקת לקוח",
  revisions: "תיקונים",
  approved: "אושר",
  completed: "הסתיים",
}

const PACKAGE_LABELS: Record<string, string> = {
  recording_only: "הקלטה בלבד",
  recording_3_videos: "הקלטה + 3 סרטונים",
  recording_5_videos: "הקלטה + 5 סרטונים",
  recording_10_videos: "הקלטה + 10 סרטונים",
}

export default function PodcastTrackingPage() {
  const router = useRouter()
  const { data: sessions, update: updateSession } = usePodcastSessions()
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null)

  const getSessionsByStatus = (status: string) => {
    if (!sessions) return []
    return sessions.filter((s) => s.contentStatus === status)
  }

  const handleMoveStatus = async (sessionId: string, newStatus: string) => {
    if (newStatus === "completed") {
      setCompletingSessionId(sessionId)
      return
    }

    await updateSessionStatus(sessionId, newStatus)
  }

  const handleCompleteWithDiscount = async (sessionId: string) => {
    await updateSessionStatus(sessionId, "completed")
    setCompletingSessionId(null)
  }

  const updateSessionStatus = async (sessionId: string, newStatus: string) => {
    try {
      await updateSession(sessionId, { contentStatus: newStatus } as any)
    } catch (err) {
      console.error("Error updating status:", err)
    }
  }

  const getStatusIndex = (status: string) => {
    return CONTENT_STATUSES.indexOf(status)
  }

  return (
    <div
      style={{
        direction: "rtl",
        minHeight: "100vh",
        background: "#1a1a2e",
        color: "white",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "2rem", color: "#CCFF00" }}>
        מעקב תוכן
      </h1>

      {/* Kanban Board */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {CONTENT_STATUSES.map((status) => {
          const sessionsList = getSessionsByStatus(status)
          const statusIndex = getStatusIndex(status)

          return (
            <div
              key={status}
              style={{
                background: "rgba(204, 255, 0, 0.05)",
                border: "2px solid #CCFF00",
                borderRadius: "0.75rem",
                padding: "1.5rem",
                minHeight: "600px",
              }}
            >
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "bold",
                  color: "#CCFF00",
                  marginBottom: "1rem",
                  paddingBottom: "1rem",
                  borderBottom: "2px solid #CCFF00",
                }}
              >
                {STATUS_LABELS[status]}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {sessionsList.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      background: "#1a1a2e",
                      border: "1px solid #444",
                      borderRadius: "0.5rem",
                      padding: "1rem",
                      cursor: "default",
                    }}
                  >
                    {/* Client Name */}
                    <div style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "0.75rem" }}>
                      {session.clientName || "לקוח לא ידוע"}
                    </div>

                    {/* Package Type */}
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "#CCFF00",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {PACKAGE_LABELS[session.packageType] || session.packageType}
                    </div>

                    {/* Session Date */}
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "rgba(255, 255, 255, 0.7)",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {new Date(session.sessionDate).toLocaleDateString("he-IL")}
                    </div>

                    {/* Videos Count */}
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "rgba(255, 255, 255, 0.7)",
                        marginBottom: "0.75rem",
                      }}
                    >
                      סרטונים: {session.videosCount || 0}
                    </div>

                    {/* Payment Status */}
                    <div
                      style={{
                        fontSize: "0.875rem",
                        padding: "0.5rem",
                        borderRadius: "0.25rem",
                        marginBottom: "1rem",
                        background:
                          session.paymentStatus === "paid"
                            ? "rgba(34, 197, 94, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                        color: session.paymentStatus === "paid" ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {session.paymentStatus === "paid" ? "✓ שולם" : "⚠ בהמתנה"}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {statusIndex > 0 && (
                        <button
                          onClick={() => {
                            const prevStatus = CONTENT_STATUSES[statusIndex - 1]
                            handleMoveStatus(session.id, prevStatus)
                          }}
                          style={{
                            flex: 1,
                            padding: "0.5rem",
                            background: "#444",
                            color: "white",
                            border: "1px solid #666",
                            borderRadius: "0.25rem",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                          }}
                        >
                          ← חזור
                        </button>
                      )}

                      {statusIndex < CONTENT_STATUSES.length - 1 && (
                        <button
                          onClick={() => {
                            const nextStatus = CONTENT_STATUSES[statusIndex + 1]
                            handleMoveStatus(session.id, nextStatus)
                          }}
                          style={{
                            flex: 1,
                            padding: "0.5rem",
                            background: "#CCFF00",
                            color: "#1a1a2e",
                            border: "none",
                            borderRadius: "0.25rem",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                          }}
                        >
                          קדימה →
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {sessionsList.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "2rem 1rem",
                      color: "rgba(255, 255, 255, 0.5)",
                      fontSize: "0.875rem",
                    }}
                  >
                    אין הקלטות בשלב זה
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Completion Confirmation Modal */}
      {completingSessionId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setCompletingSessionId(null)}
        >
          <div
            style={{
              background: "#1a1a2e",
              border: "2px solid #CCFF00",
              borderRadius: "1rem",
              padding: "2rem",
              maxWidth: "500px",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#CCFF00" }}>
              סיום הקלטה
            </h2>

            <div
              style={{
                background: "rgba(204, 255, 0, 0.1)",
                padding: "1.5rem",
                borderRadius: "0.5rem",
                marginBottom: "2rem",
                border: "1px solid #CCFF00",
              }}
            >
              <div style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem" }}>
                הנחה של 10% להקלטה הבאה
              </div>
              <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.8)" }}>
                הנחה זו תמסר ללקוח בדוא"ל הגמר
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                onClick={() => setCompletingSessionId(null)}
                style={{
                  flex: 1,
                  padding: "1rem",
                  background: "#444",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "1rem",
                }}
              >
                בטל
              </button>
              <button
                onClick={() => handleCompleteWithDiscount(completingSessionId)}
                style={{
                  flex: 1,
                  padding: "1rem",
                  background: "#CCFF00",
                  color: "#1a1a2e",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "1rem",
                }}
              >
                סיום עם הנחה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
