"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useTasks, usePayments, useLeads } from "@/lib/api/use-entity";

const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const HEBREW_DAYS = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];

const FILTER_COLORS: Record<string, string> = {
  task: "#38bdf8",
  payment: "#fbbf24",
  lead: "#34d399",
};
const FILTER_LABELS: Record<string, string> = {
  task: "משימות",
  payment: "תשלומים",
  lead: "פולואפ לידים",
};

interface CalEvent {
  day: number;
  month: number;
  year: number;
  type: "task" | "payment" | "lead";
  title: string;
  color: string;
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState<"month" | "list">("month");
  const [filters, setFilters] = useState<Set<string>>(new Set(["task", "payment", "lead"]));

  const { data: tasks } = useTasks();
  const { data: payments } = usePayments();
  const { data: leads } = useLeads();

  // Build events from real data
  const events = useMemo<CalEvent[]>(() => {
    const result: CalEvent[] = [];

    tasks.forEach((t) => {
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        if (!isNaN(d.getTime())) {
          result.push({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), type: "task", title: `משימה: ${t.title}`, color: FILTER_COLORS.task });
        }
      }
    });

    payments.forEach((p) => {
      if (p.dueDate) {
        const d = new Date(p.dueDate);
        if (!isNaN(d.getTime())) {
          result.push({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), type: "payment", title: `תשלום: ${p.clientName} — ₪${p.amount.toLocaleString()}`, color: FILTER_COLORS.payment });
        }
      }
    });

    leads.forEach((l) => {
      if (l.followUpAt) {
        const d = new Date(l.followUpAt);
        if (!isNaN(d.getTime())) {
          result.push({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), type: "lead", title: `פולואפ: ${l.name}`, color: FILTER_COLORS.lead });
        }
      }
    });

    return result;
  }, [tasks, payments, leads]);

  const monthEvents = events.filter((e) => e.month === month && e.year === year && filters.has(e.type));

  const toggleFilter = (f: string) => {
    const n = new Set(filters);
    n.has(f) ? n.delete(f) : n.add(f);
    setFilters(n);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  return (
    <div className="gcal-page" dir="rtl">
      {/* Toolbar */}
      <div className="gcal-toolbar">
        <h1 className="mod-page-title">📅 יומן כללי</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <button className="mod-btn-ghost" onClick={prevMonth}>←</button>
          <span style={{ fontSize: "1.1rem", fontWeight: 600, minWidth: "10rem", textAlign: "center" }}>{HEBREW_MONTHS[month]} {year}</span>
          <button className="mod-btn-ghost" onClick={nextMonth}>→</button>
          <button className="mod-btn-primary" onClick={goToday}>היום</button>
          <div style={{ display: "flex", gap: "0.35rem", marginInlineStart: "auto" }}>
            <button className={`mod-btn-ghost ${view === "month" ? "active" : ""}`} onClick={() => setView("month")} style={view === "month" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}}>חודש</button>
            <button className={`mod-btn-ghost ${view === "list" ? "active" : ""}`} onClick={() => setView("list")} style={view === "list" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}}>רשימה</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {Object.keys(FILTER_LABELS).map((key) => (
            <button key={key} onClick={() => toggleFilter(key)} style={{
              padding: "0.35rem 0.85rem", borderRadius: 999, border: `2px solid ${FILTER_COLORS[key]}`, fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
              background: filters.has(key) ? FILTER_COLORS[key] : "transparent",
              color: filters.has(key) ? "#fff" : FILTER_COLORS[key],
            }}>
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Month View */}
      {view === "month" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div className="gcal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.35rem" }}>
            {HEBREW_DAYS.map((d) => (
              <div key={d} style={{ fontWeight: 600, textAlign: "center", padding: "0.5rem", color: "var(--foreground-muted)", fontSize: "0.82rem" }}>{d}</div>
            ))}
            {calendarDays.map((day, idx) => {
              const dayEvents = day ? monthEvents.filter((e) => e.day === day) : [];
              const isTodayCell = isCurrentMonth && day === today.getDate();
              return (
                <div key={idx} className="gcal-day" style={{
                  minHeight: 80, padding: "0.4rem", borderRadius: "0.375rem", display: "flex", flexDirection: "column",
                  border: isTodayCell ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: !day ? "var(--surface-raised)" : isTodayCell ? "rgba(0,181,254,0.06)" : "var(--surface)",
                }}>
                  {day && (
                    <>
                      <div style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.2rem" }}>{day}</div>
                      {dayEvents.slice(0, 3).map((ev, i) => (
                        <div key={i} style={{ fontSize: "0.6rem", padding: "0.15rem 0.35rem", borderRadius: "0.2rem", background: ev.color, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.15rem" }}>
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && <div style={{ fontSize: "0.6rem", color: "var(--foreground-muted)" }}>+{dayEvents.length - 3} עוד</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
            {Object.keys(FILTER_LABELS).map((key) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem" }}>
                <div style={{ width: 12, height: 12, borderRadius: "0.2rem", background: FILTER_COLORS[key] }} />
                <span>{FILTER_LABELS[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {monthEvents.length === 0 ? (
            <div className="mod-empty"><div className="mod-empty-icon">📅</div><div>אין אירועים בחודש זה</div></div>
          ) : (
            monthEvents.sort((a, b) => a.day - b.day).map((ev, i) => (
              <div key={i} className="agd-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderInlineEnd: `3px solid ${ev.color}` }}>
                <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{ev.title}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>{ev.day} {HEBREW_MONTHS[month]}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
