"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useActivities } from "@/lib/api/use-entity";
import type { ActivityEntry } from "@/lib/db/schema";

const TYPE_TO_HEBREW: Record<ActivityEntry["type"], string> = {
  project: "פרויקטים",
  client: "לקוחות",
  render: "רינדורים",
  ai: "AI",
  payment: "תשלומים",
  task: "משימות",
  lead: "לידים",
};

const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (activityDate.getTime() === today.getTime()) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `היום ${hours}:${minutes}`;
  }

  if (activityDate.getTime() === yesterday.getTime()) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `אתמול ${hours}:${minutes}`;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function ActivityPage() {
  const { data: activities, loading } = useActivities();
  const [activeFilter, setActiveFilter] = useState<ActivityEntry["type"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filterChips: Array<{ label: string; value: ActivityEntry["type"] | "all" }> = [
    { label: "הכל", value: "all" },
    { label: "פרויקטים", value: "project" },
    { label: "לקוחות", value: "client" },
    { label: "רינדורים", value: "render" },
    { label: "AI", value: "ai" },
    { label: "תשלומים", value: "payment" },
    { label: "משימות", value: "task" },
    { label: "לידים", value: "lead" },
  ];

  const filteredActivities = activities.filter((activity) => {
    const typeMatch = activeFilter === "all" || activity.type === activeFilter;
    const searchMatch =
      searchQuery === "" ||
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchQuery.toLowerCase());
    return typeMatch && searchMatch;
  });

  const countText = `${filteredActivities.length} אירועים`;

  if (loading) {
    return (
      <main className="max-w-[1100px] mx-auto px-6 py-8">
        <div className="pg" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="gact-pg-header">
            <div style={{ flex: 1 }}>
              <h1 className="gact-pg-title" style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.025em" }}>
                פעילות מערכת
              </h1>
              <p className="gact-pg-sub" style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                טוען נתונים...
              </p>
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "3rem 2rem",
              color: "var(--foreground-muted)",
            }}
          >
            <p style={{ fontSize: "0.9375rem" }}>טוען פעילויות...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-8">
      <div className="pg" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header */}
        <div className="gact-pg-header">
          <div style={{ flex: 1 }}>
            <h1 className="gact-pg-title" style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.025em" }}>
              פעילות מערכת
            </h1>
            <p className="gact-pg-sub" style={{ fontSize: "0.875rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
              מעקב אחר פעולות בפרויקטים, לקוחות ורינדורים
            </p>
          </div>
          <div
            className="gact-count-pill"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "9999px",
              padding: "0.5rem 1rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {countText}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="gact-chips ux-stagger" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {filterChips.map((chip) => (
            <button
              key={chip.value}
              className={`gact-chip ux-btn ${activeFilter === chip.value ? "active" : ""}`}
              onClick={() => setActiveFilter(chip.value)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "9999px",
                border: activeFilter === chip.value ? "1px solid var(--foreground)" : "1px solid var(--border)",
                background: activeFilter === chip.value ? "var(--surface-raised)" : "transparent",
                color: activeFilter === chip.value ? "var(--foreground)" : "var(--foreground-muted)",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="gact-controls" style={{ display: "flex", gap: "1rem" }}>
          <div className="gact-search-wrap" style={{ flex: 1, position: "relative" }}>
            <span
              style={{
                position: "absolute",
                insetInlineStart: "1rem",
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.5,
                fontSize: "1rem",
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              className="gact-search ux-input"
              type="search"
              placeholder="חיפוש פעילות, פרויקט, לקוח…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                paddingInlineStart: "2.5rem",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: "0.875rem",
              }}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Activity Feed */}
        <div className="gact-feed ux-stagger" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filteredActivities.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 2rem",
                color: "var(--foreground-muted)",
              }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📭</div>
              <p style={{ fontSize: "0.9375rem" }}>אין פעילות בקטגוריה זו</p>
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <div
                key={activity.id}
                className="gact-feed-item premium-card ux-stagger-item"
                style={{
                  padding: "1rem",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  background: "var(--surface)",
                  display: "flex",
                  gap: "1rem",
                  alignItems: "flex-start",
                }}
              >
                <div
                  className="gact-feed-icon"
                  style={{
                    fontSize: "1.5rem",
                    flexShrink: 0,
                    width: "2.5rem",
                    height: "2.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {activity.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="gact-feed-title" style={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                    {activity.title}
                  </div>
                  <div className="gact-feed-desc" style={{ fontSize: "0.8125rem", color: "var(--foreground-muted)", marginTop: "0.25rem" }}>
                    {activity.description}
                  </div>
                </div>
                <div className="gact-feed-time" style={{ fontSize: "0.8125rem", color: "var(--foreground-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {getRelativeTime(activity.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
