"use client"

import { useState, useMemo } from "react"
import { usePodcastSessions, useClients } from "@/lib/api/use-entity"
import { useToast } from "@/components/ui/toast"
import type { PodcastSession } from "@/lib/db/schema"

const PACKAGE_TYPES = {
  recording_only: { name: "הקלטה בלבד", price: 497 },
  recording_3_videos: { name: "הקלטה + 3 סרטונים", price: 849 },
  recording_5_videos: { name: "הקלטה + 5 סרטונים", price: 999 },
  recording_10_videos: { name: "הקלטה + 10 סרטונים", price: 1749 },
}

const SESSION_DURATION_MINUTES = 90

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"]
const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8
  const minutes = (i % 2) * 30
  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
})

interface BookingModalState {
  isOpen: boolean
  selectedDate: string | null
  selectedSlot: string | null
}

interface BookingFormData {
  clientId: string
  isNewClient: boolean
  newClientName: string
  newClientPhone: string
  newClientEmail: string
  packageType: "recording_only" | "recording_3_videos" | "recording_5_videos" | "recording_10_videos"
  price: number
  notes: string
}

interface SessionDetailState {
  isOpen: boolean
  session: PodcastSession | null
}

export default function PodcastCalendarPage() {
  const toast = useToast()
  const { data: sessions, refetch: refreshSessions, create: createSession } = usePodcastSessions()
  const { data: clients } = useClients()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [bookingModal, setBookingModal] = useState<BookingModalState>({
    isOpen: false,
    selectedDate: null,
    selectedSlot: null,
  })
  const [sessionDetail, setSessionDetail] = useState<SessionDetailState>({
    isOpen: false,
    session: null,
  })
  const [bookingForm, setBookingForm] = useState<BookingFormData>({
    clientId: "",
    isNewClient: false,
    newClientName: "",
    newClientPhone: "",
    newClientEmail: "",
    packageType: "recording_only",
    price: 497,
    notes: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const weekStart = useMemo(() => {
    const d = new Date(currentDate)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }, [currentDate])

  const weekDays = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const getWeekDateRange = () => {
    const start = weekStart.toLocaleDateString("he-IL", { month: "short", day: "numeric" })
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 5)
    const endStr = end.toLocaleDateString("he-IL", { month: "short", day: "numeric", year: "numeric" })
    return `${start} - ${endStr}`
  }

  const checkSlotAvailable = (date: Date, slot: string): boolean => {
    if (!sessions) return true

    const [hours, minutes] = slot.split(":").map(Number)
    const slotStart = new Date(date)
    slotStart.setHours(hours, minutes, 0)
    const slotEnd = new Date(slotStart)
    slotEnd.setMinutes(slotEnd.getMinutes() + SESSION_DURATION_MINUTES)

    const dateStr = date.toISOString().split("T")[0]

    return !sessions.some((s) => {
      const sDate = new Date(s.sessionDate)
      const sDateStr = sDate.toISOString().split("T")[0]
      if (sDateStr !== dateStr) return false

      const sStart = new Date(s.sessionDate)
      const sEnd = new Date(sStart)
      sEnd.setMinutes(sEnd.getMinutes() + SESSION_DURATION_MINUTES)

      return !(slotEnd <= sStart || slotStart >= sEnd)
    })
  }

  const getSessionsForDay = (date: Date): PodcastSession[] => {
    if (!sessions) return []
    const dateStr = date.toISOString().split("T")[0]
    return sessions.filter((s) => {
      const sDateStr = new Date(s.sessionDate).toISOString().split("T")[0]
      return sDateStr === dateStr
    })
  }

  const handleSlotClick = (date: Date, slot: string) => {
    const isAvailable = checkSlotAvailable(date, slot)
    if (isAvailable) {
      setBookingModal({
        isOpen: true,
        selectedDate: date.toISOString().split("T")[0],
        selectedSlot: slot,
      })
      setBookingForm({
        clientId: "",
        isNewClient: false,
        newClientName: "",
        newClientPhone: "",
        newClientEmail: "",
        packageType: "recording_only",
        price: 497,
        notes: "",
      })
    }
  }

  const handlePackageChange = (packageType: keyof typeof PACKAGE_TYPES) => {
    const price = PACKAGE_TYPES[packageType].price
    setBookingForm((prev) => ({
      ...prev,
      packageType,
      price,
    }))
  }

  const handleBookSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!bookingModal.selectedDate || !bookingModal.selectedSlot) {
        toast("חסרים פרטי הזמנה — בחר תאריך ושעה", "error")
        setIsSubmitting(false)
        return
      }

      if (bookingForm.isNewClient) {
        if (!bookingForm.newClientName || !bookingForm.newClientPhone || !bookingForm.newClientEmail) {
          toast("נא למלא את כל פרטי הלקוח החדש", "error")
          setIsSubmitting(false)
          return
        }
      } else if (!bookingForm.clientId) {
        toast("נא לבחור לקוח", "error")
        setIsSubmitting(false)
        return
      }

      // Check for overlaps before saving — use startTime strings for reliable comparison
      const [hours, minutes] = bookingModal.selectedSlot.split(":").map(Number)
      const slotStartMinutes = hours * 60 + minutes
      const slotEndMinutes = slotStartMinutes + SESSION_DURATION_MINUTES
      const selectedDateStr = bookingModal.selectedDate

      if (sessions) {
        const hasOverlap = sessions.some((s) => {
          if (!s.sessionDate || !s.startTime) return false
          const sDateStr = s.sessionDate.split("T")[0]
          if (sDateStr !== selectedDateStr) return false

          const [sH, sM] = s.startTime.split(":").map(Number)
          const sStartMin = sH * 60 + sM
          const sEndMin = sStartMin + SESSION_DURATION_MINUTES

          return !(slotEndMinutes <= sStartMin || slotStartMinutes >= sEndMin)
        })

        if (hasOverlap) {
          toast("המשבצת הזו כבר תפוסה — בחר שעה אחרת", "error")
          setIsSubmitting(false)
          return
        }
      }

      const endTotalMinutes = slotStartMinutes + SESSION_DURATION_MINUTES
      const endHours = Math.floor(endTotalMinutes / 60).toString().padStart(2, "0")
      const endMins = (endTotalMinutes % 60).toString().padStart(2, "0")
      const endTimeStr = `${endHours}:${endMins}`

      const pkgKey = bookingForm.packageType as keyof typeof PACKAGE_TYPES
      const videosMap: Record<string, number> = {
        recording_only: 0,
        recording_3_videos: 3,
        recording_5_videos: 5,
        recording_10_videos: 10,
      }

      await createSession({
        clientId: bookingForm.isNewClient ? "" : bookingForm.clientId,
        clientName: bookingForm.isNewClient
          ? bookingForm.newClientName
          : clients?.find((c) => c.id === bookingForm.clientId)?.name || "",
        packageType: bookingForm.packageType,
        price: bookingForm.price,
        sessionDate: bookingModal.selectedDate,
        startTime: bookingModal.selectedSlot,
        endTime: endTimeStr,
        sessionStatus: "booked",
        contentStatus: "pending_upload",
        agreementPdfUrl: "",
        agreementSent: false,
        videosCount: videosMap[bookingForm.packageType] || 0,
        draftUrls: [],
        finalUrls: [],
        paymentStatus: "pending",
        paidAt: null,
        notes: bookingForm.notes,
      } as any)

      await refreshSessions()
      toast("ההקלטה נקבעה בהצלחה", "success")
      setBookingModal({ isOpen: false, selectedDate: null, selectedSlot: null })
      setBookingForm({
        clientId: "",
        isNewClient: false,
        newClientName: "",
        newClientPhone: "",
        newClientEmail: "",
        packageType: "recording_only",
        price: 497,
        notes: "",
      })
    } catch (err: any) {
      console.error("[Podcast Booking] Error:", err)
      toast(err?.message || "שגיאה בקביעת הקלטה — בדוק את הפרטים ונסה שוב", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "booked":
        return "var(--accent)"
      case "completed":
        return "#10b981"
      case "cancelled":
        return "#ef4444"
      case "no_show":
        return "#f97316"
      default:
        return "var(--foreground-muted)"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "booked":
        return "מוזמן"
      case "completed":
        return "הסתיים"
      case "cancelled":
        return "בוטל"
      case "no_show":
        return "לא הופיע"
      default:
        return status
    }
  }

  return (
    <div
      style={{
        direction: "rtl",
        minHeight: "100vh",
        background: "var(--surface)",
        color: "var(--foreground)",
        padding: "2rem",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: "700",
            marginBottom: "0.5rem",
            color: "var(--foreground)",
          }}
        >
          לוח הקלטות פודקאסט
        </h1>
        <p style={{ fontSize: "0.95rem", color: "var(--foreground-muted)", margin: "0" }}>
          ניהול הזמנות הקלטות ופדקאסט
        </p>
      </div>

      {/* Week Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          gap: "1.5rem",
        }}
      >
        <button
          onClick={() => {
            const d = new Date(weekStart)
            d.setDate(d.getDate() - 7)
            setCurrentDate(d)
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--surface-raised)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            padding: "0.625rem 1rem",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "500",
            fontSize: "0.9rem",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              "var(--surface-raised)"
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              "var(--surface-raised)"
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"
          }}
        >
          ← שבוע קודם
        </button>

        <div
          style={{
            flex: 1,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: "600",
              margin: "0",
              color: "var(--foreground)",
            }}
          >
            {getWeekDateRange()}
          </h2>
        </div>

        <button
          onClick={() => {
            const d = new Date(weekStart)
            d.setDate(d.getDate() + 7)
            setCurrentDate(d)
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--surface-raised)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            padding: "0.625rem 1rem",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "500",
            fontSize: "0.9rem",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              "var(--surface-raised)"
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              "var(--surface-raised)"
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"
          }}
        >
          שבוע הבא →
        </button>
      </div>

      {/* Calendar Grid */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: "2rem",
        }}
      >
        {/* Week Days Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `80px repeat(6, 1fr)`,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              padding: "1rem",
              background: "var(--surface)",
              borderRight: "1px solid var(--border)",
              fontWeight: "600",
              fontSize: "0.85rem",
              color: "var(--foreground-muted)",
            }}
          >
            שעה
          </div>
          {weekDays.map((d, i) => (
            <div
              key={i}
              style={{
                padding: "1rem",
                background: "var(--surface)",
                borderRight: i < 5 ? "1px solid var(--border)" : "none",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: "600", fontSize: "0.95rem", color: "var(--foreground)" }}>
                {HEBREW_DAYS[d.getDay()]}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--foreground-muted)",
                  marginTop: "0.25rem",
                }}
              >
                {d.toLocaleDateString("he-IL")}
              </div>
            </div>
          ))}
        </div>

        {/* Time Slots */}
        <div
          style={{
            maxHeight: "calc(100vh - 400px)",
            overflowY: "auto",
          }}
        >
          {TIME_SLOTS.map((slot) => (
            <div
              key={slot}
              style={{
                display: "grid",
                gridTemplateColumns: `80px repeat(6, 1fr)`,
                borderBottom: "1px solid var(--border)",
                minHeight: "80px",
              }}
            >
              {/* Time Label */}
              <div
                style={{
                  padding: "1rem",
                  background: "var(--surface)",
                  borderRight: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  fontWeight: "500",
                  color: "var(--foreground-muted)",
                }}
              >
                {slot}
              </div>

              {/* Day Slots */}
              {weekDays.map((d, i) => {
                const isAvailable = checkSlotAvailable(d, slot)
                const daySession = getSessionsForDay(d).find((s) => {
                  const [sHours, sMinutes] = s.startTime.split(":").map(Number)
                  const [slotHours, slotMinutes] = slot.split(":").map(Number)
                  return sHours === slotHours && sMinutes === slotMinutes
                })

                return (
                  <div
                    key={i}
                    style={{
                      padding: "0.75rem",
                      borderRight: i < 5 ? "1px solid var(--border)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--surface-raised)",
                      cursor: isAvailable && !daySession ? "pointer" : "default",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (isAvailable && !daySession) {
                        ;(e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 5%, var(--surface-raised))"
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isAvailable && !daySession) {
                        ;(e.currentTarget as HTMLElement).style.background = "var(--surface-raised)"
                      }
                    }}
                    onClick={() => {
                      if (isAvailable && !daySession) {
                        handleSlotClick(d, slot)
                      }
                    }}
                  >
                    {daySession ? (
                      <div
                        style={{
                          background: getStatusColor(daySession.sessionStatus),
                          color: "white",
                          padding: "0.75rem",
                          borderRadius: "8px",
                          textAlign: "center",
                          width: "100%",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          borderLeft: `3px solid ${getStatusColor(daySession.sessionStatus)}`,
                          opacity: 0.95,
                        }}
                        onClick={() => setSessionDetail({ isOpen: true, session: daySession })}
                      >
                        <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                          {daySession.clientName}
                        </div>
                        <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                          {daySession.startTime} - {daySession.endTime}
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            marginTop: "0.25rem",
                            background: "#FFD700",
                            color: "#1a1a2e",
                            padding: "0.125rem 0.5rem",
                            borderRadius: "4px",
                            display: "inline-block",
                            fontWeight: "600",
                          }}
                        >
                          {PACKAGE_TYPES[daySession.packageType as keyof typeof PACKAGE_TYPES].name}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Booking Modal */}
      {bookingModal.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => setBookingModal({ isOpen: false, selectedDate: null, selectedSlot: null })}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: "700",
                marginBottom: "0.5rem",
                color: "var(--foreground)",
              }}
            >
              הזמנת הקלטה חדשה
            </h2>
            <p
              style={{
                color: "var(--foreground-muted)",
                fontSize: "0.9rem",
                marginBottom: "1.5rem",
              }}
            >
              {bookingModal.selectedDate && bookingModal.selectedSlot
                ? `${new Date(bookingModal.selectedDate).toLocaleDateString("he-IL")} בשעה ${bookingModal.selectedSlot}`
                : ""}
            </p>

            <form onSubmit={handleBookSession}>
              {/* Client Selection */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    marginBottom: "0.5rem",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                  }}
                >
                  לקוח
                </label>
                <select
                  value={bookingForm.isNewClient ? "new" : bookingForm.clientId}
                  onChange={(e) => {
                    if (e.target.value === "new") {
                      setBookingForm((prev) => ({
                        ...prev,
                        isNewClient: true,
                        clientId: "",
                      }))
                    } else {
                      setBookingForm((prev) => ({
                        ...prev,
                        isNewClient: false,
                        clientId: e.target.value,
                      }))
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                  }}
                  required
                >
                  <option value="">בחר לקוח</option>
                  {clients?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="new">לקוח חדש</option>
                </select>
              </div>

              {/* New Client Form */}
              {bookingForm.isNewClient && (
                <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--surface)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <div style={{ marginBottom: "1rem" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "600",
                        marginBottom: "0.5rem",
                        color: "var(--foreground)",
                        fontSize: "0.9rem",
                      }}
                    >
                      שם
                    </label>
                    <input
                      type="text"
                      value={bookingForm.newClientName}
                      onChange={(e) =>
                        setBookingForm((prev) => ({
                          ...prev,
                          newClientName: e.target.value,
                        }))
                      }
                      placeholder="שם הלקוח"
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        background: "var(--surface-raised)",
                        color: "var(--foreground)",
                        fontSize: "0.9rem",
                      }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: "1rem" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "600",
                        marginBottom: "0.5rem",
                        color: "var(--foreground)",
                        fontSize: "0.9rem",
                      }}
                    >
                      טלפון
                    </label>
                    <input
                      type="tel"
                      value={bookingForm.newClientPhone}
                      onChange={(e) =>
                        setBookingForm((prev) => ({
                          ...prev,
                          newClientPhone: e.target.value,
                        }))
                      }
                      placeholder="05X-XXXXXXX"
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        background: "var(--surface-raised)",
                        color: "var(--foreground)",
                        fontSize: "0.9rem",
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "600",
                        marginBottom: "0.5rem",
                        color: "var(--foreground)",
                        fontSize: "0.9rem",
                      }}
                    >
                      אימייל
                    </label>
                    <input
                      type="email"
                      value={bookingForm.newClientEmail}
                      onChange={(e) =>
                        setBookingForm((prev) => ({
                          ...prev,
                          newClientEmail: e.target.value,
                        }))
                      }
                      placeholder="example@domain.com"
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        background: "var(--surface-raised)",
                        color: "var(--foreground)",
                        fontSize: "0.9rem",
                      }}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Package Selection */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    marginBottom: "1rem",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                  }}
                >
                  חבילה
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {Object.entries(PACKAGE_TYPES).map(([key, value]) => (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.75rem",
                        border:
                          bookingForm.packageType === key
                            ? "2px solid var(--accent)"
                            : "1px solid var(--border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background:
                          bookingForm.packageType === key
                            ? "color-mix(in srgb, var(--accent) 8%, var(--surface))"
                            : "var(--surface)",
                        transition: "all 0.2s",
                      }}
                    >
                      <input
                        type="radio"
                        name="package"
                        value={key}
                        checked={bookingForm.packageType === key as any}
                        onChange={() => handlePackageChange(key as keyof typeof PACKAGE_TYPES)}
                        style={{ cursor: "pointer" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "500", color: "var(--foreground)" }}>
                          {value.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--foreground-muted)",
                          }}
                        >
                          ₪{value.price}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    marginBottom: "0.5rem",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                  }}
                >
                  מחיר
                </label>
                <input
                  type="number"
                  value={bookingForm.price}
                  onChange={(e) =>
                    setBookingForm((prev) => ({
                      ...prev,
                      price: Number(e.target.value),
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    marginBottom: "0.5rem",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                  }}
                >
                  הערות
                </label>
                <textarea
                  value={bookingForm.notes}
                  onChange={(e) =>
                    setBookingForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="הערות נוספות..."
                  style={{
                    width: "100%",
                    minHeight: "80px",
                    padding: "0.75rem",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setBookingModal({
                      isOpen: false,
                      selectedDate: null,
                      selectedSlot: null,
                    })
                  }
                  style={{
                    padding: "0.75rem 1.5rem",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      "color-mix(in srgb, var(--foreground) 5%, var(--surface))"
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      "var(--surface)"
                  }}
                >
                  בטל
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    opacity: isSubmitting ? 0.7 : 1,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      ;(e.currentTarget as HTMLButtonElement).style.opacity = "0.9"
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmitting) {
                      ;(e.currentTarget as HTMLButtonElement).style.opacity = "1"
                    }
                  }}
                >
                  {isSubmitting ? "בטעינה..." : "שריין הקלטה"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {sessionDetail.isOpen && sessionDetail.session && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => setSessionDetail({ isOpen: false, session: null })}
        >
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: "700",
                marginBottom: "1.5rem",
                color: "var(--foreground)",
              }}
            >
              {sessionDetail.session.clientName}
            </h2>

            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ marginBottom: "1rem" }}>
                <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", margin: "0 0 0.25rem 0" }}>
                  תאריך
                </p>
                <p style={{ color: "var(--foreground)", fontSize: "0.95rem", fontWeight: "500", margin: "0" }}>
                  {new Date(sessionDetail.session.sessionDate).toLocaleDateString("he-IL")}
                </p>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", margin: "0 0 0.25rem 0" }}>
                  שעה
                </p>
                <p style={{ color: "var(--foreground)", fontSize: "0.95rem", fontWeight: "500", margin: "0" }}>
                  {sessionDetail.session.startTime} - {sessionDetail.session.endTime}
                </p>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", margin: "0 0 0.25rem 0" }}>
                  חבילה
                </p>
                <div
                  style={{
                    display: "inline-block",
                    padding: "0.5rem 0.75rem",
                    background: "#FFD700",
                    color: "#1a1a2e",
                    borderRadius: "6px",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                  }}
                >
                  {PACKAGE_TYPES[sessionDetail.session.packageType].name}
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", margin: "0 0 0.25rem 0" }}>
                  סטטוס הקלטה
                </p>
                <p style={{ color: "var(--foreground)", fontSize: "0.95rem", fontWeight: "500", margin: "0" }}>
                  {getStatusLabel(sessionDetail.session.sessionStatus)}
                </p>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", margin: "0 0 0.25rem 0" }}>
                  מחיר
                </p>
                <p style={{ color: "var(--foreground)", fontSize: "0.95rem", fontWeight: "500", margin: "0" }}>
                  ₪{sessionDetail.session.price}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSessionDetail({ isOpen: false, session: null })}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.9rem",
              }}
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
