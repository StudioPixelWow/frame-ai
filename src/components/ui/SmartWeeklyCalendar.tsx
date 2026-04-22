"use client";

import { useState, useMemo } from "react";
import { useTasks, useMeetings } from "@/lib/api/use-entity";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface CalendarItem {
  id: string;
  title: string;
  time: string;
  type: "task" | "meeting" | "urgent";
  status?: string;
  color: string;
}

interface DayData {
  date: Date;
  dayName: string;
  dateStr: string;
  isToday: boolean;
  items: CalendarItem[];
  load: "calm" | "medium" | "heavy";
}

interface AIInsight {
  icon: string;
  text: string;
  type: "warning" | "success" | "info";
}

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function getNext7Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function getLoadLevel(count: number): "calm" | "medium" | "heavy" {
  if (count <= 2) return "calm";
  if (count <= 5) return "medium";
  return "heavy";
}

function getLoadColor(load: "calm" | "medium" | "heavy"): string {
  if (load === "calm") return "rgba(34,197,94,0.15)";
  if (load === "medium") return "rgba(250,204,21,0.15)";
  return "rgba(239,68,68,0.15)";
}

function getLoadBorder(load: "calm" | "medium" | "heavy"): string {
  if (load === "calm") return "rgba(34,197,94,0.3)";
  if (load === "medium") return "rgba(250,204,21,0.3)";
  return "rgba(239,68,68,0.3)";
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI Insights Generator
   ═══════════════════════════════════════════════════════════════════════════ */

function generateInsights(days: DayData[], allTasks: any[]): AIInsight[] {
  const insights: AIInsight[] = [];

  // Find overloaded day
  const heavyDay = days.find(d => d.load === "heavy");
  if (heavyDay) {
    insights.push({
      icon: "⚠️",
      text: `יום ${heavyDay.dayName} עמוס (${heavyDay.items.length} פריטים) – מומלץ לפזר`,
      type: "warning",
    });
  }

  // Find free day
  const freeDay = days.find(d => d.items.length === 0 && !d.isToday);
  if (freeDay) {
    insights.push({
      icon: "💡",
      text: `יום ${freeDay.dayName} פנוי – זמן טוב לתכנון או שיחות`,
      type: "success",
    });
  }

  // Overdue tasks
  const now = new Date();
  const overdue = allTasks.filter((t: any) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due < now && t.status !== "completed" && t.status !== "done";
  });
  if (overdue.length > 0) {
    insights.push({
      icon: "🔴",
      text: `${overdue.length} משימות עברו דדליין ודורשות טיפול`,
      type: "warning",
    });
  }

  // Completion rate
  const thisWeekTasks = allTasks.filter((t: any) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return due >= now && due <= weekFromNow;
  });
  const completed = thisWeekTasks.filter((t: any) => t.status === "completed" || t.status === "done");
  if (thisWeekTasks.length > 0) {
    const rate = Math.round((completed.length / thisWeekTasks.length) * 100);
    insights.push({
      icon: rate >= 70 ? "✅" : "📊",
      text: `קצב השלמה שבועי: ${rate}% (${completed.length}/${thisWeekTasks.length})`,
      type: rate >= 70 ? "success" : "info",
    });
  }

  // Balanced workload check
  const itemCounts = days.map(d => d.items.length);
  const max = Math.max(...itemCounts);
  const min = Math.min(...itemCounts);
  if (max - min >= 4) {
    insights.push({
      icon: "⚖️",
      text: "העומס לא מאוזן – שקול לפזר משימות בין הימים",
      type: "info",
    });
  }

  return insights.slice(0, 5);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Performance Score
   ═══════════════════════════════════════════════════════════════════════════ */

function calculateScore(days: DayData[], allTasks: any[]): { score: number; label: string } {
  const now = new Date();
  const total = allTasks.length || 1;
  const completed = allTasks.filter((t: any) => t.status === "completed" || t.status === "done").length;
  const overdue = allTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed" && t.status !== "done").length;

  const completionRate = completed / total;
  const overdueRate = overdue / total;
  const itemCounts = days.map(d => d.items.length);
  const variance = itemCounts.length > 0 ? Math.max(...itemCounts) - Math.min(...itemCounts) : 0;
  const balanceScore = Math.max(0, 1 - variance / 10);

  const score = Math.round((completionRate * 50 + (1 - overdueRate) * 30 + balanceScore * 20));
  const label = score >= 80 ? "שבוע מאוזן" : score >= 60 ? "עומס בינוני" : "נדרש פיזור משימות";

  return { score: Math.min(100, Math.max(0, score)), label };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SmartWeeklyCalendar() {
  const { data: tasks } = useTasks();
  const { data: meetings } = useMeetings();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const days: DayData[] = useMemo(() => {
    const next7 = getNext7Days();
    const today = new Date();

    return next7.map(date => {
      const dayTasks: CalendarItem[] = (tasks || [])
        .filter((t: any) => {
          if (!t.dueDate) return false;
          return isSameDay(new Date(t.dueDate), date);
        })
        .map((t: any) => ({
          id: t.id,
          title: t.title || t.name || "משימה",
          time: t.dueTime || t.time || "",
          type: (t.priority === "urgent" || t.priority === "high") ? "urgent" as const : "task" as const,
          status: t.status,
          color: t.priority === "urgent" ? "#ef4444" : t.priority === "high" ? "#f59e0b" : "#3b82f6",
        }));

      const dayMeetings: CalendarItem[] = (meetings || [])
        .filter((m: any) => {
          if (!m.date) return false;
          return isSameDay(new Date(m.date), date);
        })
        .map((m: any) => ({
          id: m.id,
          title: m.title || "פגישה",
          time: m.startTime || "",
          type: "meeting" as const,
          status: m.status,
          color: "#00B5FE",
        }));

      const items = [...dayMeetings, ...dayTasks].sort((a, b) => a.time.localeCompare(b.time));

      return {
        date,
        dayName: DAYS_HE[date.getDay()],
        dateStr: formatDate(date),
        isToday: isSameDay(date, today),
        items,
        load: getLoadLevel(items.length),
      };
    });
  }, [tasks, meetings]);

  const insights = useMemo(() => generateInsights(days, tasks || []), [days, tasks]);
  const { score, label } = useMemo(() => calculateScore(days, tasks || []), [days, tasks]);

  return (
    <div style={{ direction: "rtl" }}>
      {/* Section Label */}
      <div className="mhd-section-label">📅 שבוע חכם</div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 280px",
        gap: "1rem",
        alignItems: "start",
      }}>
        {/* ═══ Weekly Calendar ═══ */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "0.5rem",
        }}>
          {days.map(day => (
            <div
              key={day.dateStr}
              style={{
                background: day.isToday
                  ? "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.08))"
                  : "var(--card-bg, rgba(255,255,255,0.03))",
                border: day.isToday
                  ? "1.5px solid rgba(59,130,246,0.5)"
                  : `1px solid ${getLoadBorder(day.load)}`,
                borderRadius: "0.75rem",
                padding: "0.75rem 0.5rem",
                minHeight: "160px",
                position: "relative",
                transition: "all 0.2s ease",
                boxShadow: day.isToday
                  ? "0 0 20px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
                  : "0 2px 8px rgba(0,0,0,0.1)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = day.isToday
                  ? "0 0 20px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
                  : "0 2px 8px rgba(0,0,0,0.1)";
              }}
            >
              {/* Load heatmap bar */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                borderRadius: "0.75rem 0.75rem 0 0",
                background: getLoadColor(day.load).replace("0.15", "0.8"),
              }} />

              {/* Day header */}
              <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                <div style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: day.isToday ? "#3b82f6" : "var(--foreground)",
                  letterSpacing: "0.02em",
                }}>
                  {day.dayName}
                </div>
                <div style={{
                  fontSize: "0.65rem",
                  color: "var(--foreground-muted)",
                  marginTop: "0.125rem",
                }}>
                  {day.dateStr}
                </div>
                {day.isToday && (
                  <div style={{
                    fontSize: "0.55rem",
                    color: "#3b82f6",
                    fontWeight: 600,
                    marginTop: "0.125rem",
                  }}>היום</div>
                )}
              </div>

              {/* Items */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {day.items.length === 0 && (
                  <div style={{
                    fontSize: "0.6rem",
                    color: "var(--foreground-muted)",
                    textAlign: "center",
                    padding: "1rem 0",
                    opacity: 0.6,
                  }}>
                    אין משימות
                  </div>
                )}
                {day.items.slice(0, expandedDay === day.dateStr ? 10 : 4).map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.25rem 0.375rem",
                      borderRadius: "0.375rem",
                      background: hoveredItem === item.id
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    title={`${item.title}${item.time ? ` • ${item.time}` : ""}`}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: item.color,
                      flexShrink: 0,
                    }} />
                    {/* Title */}
                    <div style={{
                      fontSize: "0.6rem",
                      color: "var(--foreground)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}>
                      {item.title}
                    </div>
                    {/* Time badge */}
                    {item.time && (
                      <div style={{
                        fontSize: "0.5rem",
                        color: "var(--foreground-muted)",
                        flexShrink: 0,
                      }}>
                        {item.time}
                      </div>
                    )}
                  </div>
                ))}
                {day.items.length > 4 && expandedDay !== day.dateStr && (
                  <button
                    onClick={() => setExpandedDay(day.dateStr)}
                    style={{
                      fontSize: "0.55rem",
                      color: "#3b82f6",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "center",
                      padding: "0.25rem",
                    }}
                  >
                    +{day.items.length - 4} נוספים
                  </button>
                )}
                {expandedDay === day.dateStr && day.items.length > 4 && (
                  <button
                    onClick={() => setExpandedDay(null)}
                    style={{
                      fontSize: "0.55rem",
                      color: "#3b82f6",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "center",
                      padding: "0.25rem",
                    }}
                  >
                    הצג פחות
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ═══ AI Insights Panel ═══ */}
        <div style={{
          background: "linear-gradient(135deg, rgba(0,181,254,0.05), rgba(59,130,246,0.05))",
          border: "1px solid rgba(0,181,254,0.15)",
          borderRadius: "0.75rem",
          padding: "1rem",
        }}>
          {/* Score Card */}
          <div style={{
            textAlign: "center",
            marginBottom: "1rem",
            padding: "0.75rem",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "0.5rem",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              fontSize: "2rem",
              fontWeight: 800,
              background: score >= 70
                ? "linear-gradient(135deg, #22c55e, #10b981)"
                : score >= 50
                  ? "linear-gradient(135deg, #f59e0b, #eab308)"
                  : "linear-gradient(135deg, #ef4444, #f97316)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              {score}%
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
              ביצועים שבועיים
            </div>
            <div style={{
              fontSize: "0.6rem",
              fontWeight: 600,
              color: score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444",
              marginTop: "0.25rem",
            }}>
              {label}
            </div>
          </div>

          {/* Insights List */}
          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.5rem" }}>
            ✨ תובנות AI
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {insights.length === 0 && (
              <div style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", textAlign: "center", padding: "1rem 0" }}>
                אין תובנות להצגה
              </div>
            )}
            {insights.map((insight, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  background: insight.type === "warning"
                    ? "rgba(239,68,68,0.06)"
                    : insight.type === "success"
                      ? "rgba(34,197,94,0.06)"
                      : "rgba(59,130,246,0.06)",
                  border: `1px solid ${
                    insight.type === "warning"
                      ? "rgba(239,68,68,0.12)"
                      : insight.type === "success"
                        ? "rgba(34,197,94,0.12)"
                        : "rgba(59,130,246,0.12)"
                  }`,
                }}
              >
                <span style={{ fontSize: "0.8rem", flexShrink: 0 }}>{insight.icon}</span>
                <span style={{ fontSize: "0.625rem", color: "var(--foreground)", lineHeight: 1.5 }}>
                  {insight.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
