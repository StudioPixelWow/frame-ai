"use client";

import { useState, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useCampaigns, useLeads, useClients } from "@/lib/api/use-entity";

/* ═══════════════════════════════════════════════════════════════════════════
   Floating AI Assistant — glowing orb + smart suggestions panel
   ════════════════���═════════════���════════════════════════════════════════════ */

interface AISuggestion {
  id: string;
  icon: string;
  text: string;
  priority: "high" | "medium" | "low";
  category: "optimization" | "action" | "insight" | "warning";
}

function generatePageSuggestions(
  pathname: string,
  campaigns: any[] | undefined,
  leads: any[] | undefined,
  clients: any[] | undefined
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const allCampaigns = campaigns || [];
  const allLeads = leads || [];
  const allClients = clients || [];

  // Global suggestions
  if (allCampaigns.length === 0 && allClients.length > 0) {
    suggestions.push({
      id: "no-campaigns",
      icon: "🚀",
      text: "יש לך לקוחות אך ללא קמפיינים — צור את הקמפיין הראשון",
      priority: "high",
      category: "action",
    });
  }

  // Campaigns page
  if (pathname.includes("/campaigns") || pathname === "/") {
    const drafts = allCampaigns.filter((c) => c.status === "draft");
    const staleDrafts = drafts.filter((c) => {
      const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      return created > 0 && (Date.now() - created) / 86400000 > 7;
    });
    if (staleDrafts.length > 0) {
      suggestions.push({
        id: "stale-drafts",
        icon: "⏰",
        text: `${staleDrafts.length} טיוטות ישנות מעל שבוע — שווה לקדם או לארכב`,
        priority: "medium",
        category: "optimization",
      });
    }
    const noBudget = allCampaigns.filter((c) => c.status === "active" && (!c.budget || c.budget === 0));
    if (noBudget.length > 0) {
      suggestions.push({
        id: "no-budget-active",
        icon: "💰",
        text: `${noBudget.length} קמפיינים פעילים ללא תקציב מוגדר`,
        priority: "high",
        category: "warning",
      });
    }
    const activeCampaigns = allCampaigns.filter((c) => c.status === "active");
    if (activeCampaigns.length > 3) {
      suggestions.push({
        id: "many-active",
        icon: "📊",
        text: `${activeCampaigns.length} קמפיינים פעילים — בדוק ביצועים ותעדוף`,
        priority: "low",
        category: "insight",
      });
    }
  }

  // Leads page
  if (pathname.includes("/leads")) {
    const newLeads = allLeads.filter((l) => l.status === "new");
    if (newLeads.length > 5) {
      suggestions.push({
        id: "unhandled-leads",
        icon: "🔥",
        text: `${newLeads.length} לידים חדשים ממתינים לטיפול`,
        priority: "high",
        category: "action",
      });
    }
    const noAssigned = allLeads.filter((l) => !l.assignedTo && l.status !== "won" && l.status !== "lost");
    if (noAssigned.length > 0) {
      suggestions.push({
        id: "unassigned-leads",
        icon: "👤",
        text: `${noAssigned.length} לידים ללא שיוך לאיש קשר`,
        priority: "medium",
        category: "optimization",
      });
    }
  }

  // Clients page
  if (pathname.includes("/clients")) {
    const noClientCampaigns = allClients.filter(
      (cl) => !allCampaigns.some((c) => c.clientId === cl.id)
    );
    if (noClientCampaigns.length > 0) {
      suggestions.push({
        id: "clients-no-campaigns",
        icon: "📋",
        text: `${noClientCampaigns.length} לקוחות ללא קמפיינים — הזדמנות להפעלה`,
        priority: "medium",
        category: "insight",
      });
    }
  }

  // Dashboard / Command Center
  if (pathname === "/" || pathname.includes("/command-center")) {
    const todayLeads = allLeads.filter((l) => {
      const created = l.createdAt ? new Date(l.createdAt).getTime() : 0;
      return created > 0 && Date.now() - created < 86400000;
    });
    if (todayLeads.length > 0) {
      suggestions.push({
        id: "today-leads",
        icon: "📥",
        text: `${todayLeads.length} לידים חדשים היום — בדוק אותם`,
        priority: "high",
        category: "insight",
      });
    }
  }

  // Default suggestion
  if (suggestions.length === 0) {
    suggestions.push({
      id: "all-good",
      icon: "✅",
      text: "הכל נראה תקין — המשך עבודה טובה!",
      priority: "low",
      category: "insight",
    });
  }

  return suggestions.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });
}

const PRIORITY_COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

const CATEGORY_LABELS = {
  optimization: "אופטימיזציה",
  action: "פעולה נדרשת",
  insight: "תובנה",
  warning: "אזהרה",
};

export function FloatingAI() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: campaigns } = useCampaigns();
  const { data: leads } = useLeads();
  const { data: clients } = useClients();

  const suggestions = useMemo(
    () => generatePageSuggestions(pathname, campaigns, leads, clients),
    [pathname, campaigns, leads, clients]
  );

  const highPriorityCount = suggestions.filter((s) => s.priority === "high").length;

  const toggle = useCallback(() => setOpen((p) => !p), []);

  return (
    <>
      {/* Panel */}
      {open && (
        <div className="ux-ai-panel" style={{ direction: "rtl" }}>
          <div className="ux-ai-panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1rem" }}>🧠</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--foreground)" }}>
                תובנות AI
              </span>
              <span className="ux-ai-label">
                {suggestions.length} תובנות
              </span>
            </div>
            <button
              onClick={toggle}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--foreground-muted)",
                fontSize: "1.2rem",
                padding: "0.2rem",
                lineHeight: 1,
                transition: "color 150ms ease",
              }}
            >
              ×
            </button>
          </div>
          <div className="ux-ai-panel-body">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="ux-ai-insight"
                style={{ cursor: "default" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: "0.05rem" }}>
                    {s.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.3rem" }}>
                      <span
                        style={{
                          fontSize: "0.58rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "0.2rem",
                          background: `${PRIORITY_COLORS[s.priority]}12`,
                          color: PRIORITY_COLORS[s.priority],
                          border: `1px solid ${PRIORITY_COLORS[s.priority]}25`,
                        }}
                      >
                        {CATEGORY_LABELS[s.category]}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--foreground)",
                        lineHeight: 1.5,
                        fontWeight: 500,
                      }}
                    >
                      {s.text}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating orb */}
      <div
        style={{
          position: "fixed",
          bottom: "1.5rem",
          insetInlineStart: "1.5rem",
          zIndex: 1400,
        }}
      >
        <button
          className="ux-ai-orb"
          onClick={toggle}
          aria-label="AI Assistant"
          title="תובנות AI"
        >
          <span style={{ fontSize: "1.15rem", position: "relative", zIndex: 1 }}>
            {open ? "×" : "🧠"}
          </span>

          {/* Badge */}
          {highPriorityCount > 0 && !open && (
            <span
              style={{
                position: "absolute",
                top: "-2px",
                insetInlineEnd: "-2px",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "#ef4444",
                color: "#fff",
                fontSize: "0.6rem",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid var(--surface)",
                zIndex: 2,
              }}
            >
              {highPriorityCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
