"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOperationalAlerts } from "@/lib/alerts/use-alerts";
import {
  useTasks,
  useClients,
  useCampaigns,
  usePayments,
  useApprovals,
  useSocialPosts,
} from "@/lib/api/use-entity";
import { generateInsights } from "@/components/ai-insights-panel";

// Types
interface Alert {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  category?: string;
  timestamp?: number;
}

interface Insight {
  title: string;
  value?: string | number;
  type?: string;
}

interface TrendResult {
  name: string;
  relevanceScore: number;
  urgency: "high" | "medium" | "low";
  contentIdea: string;
}

interface TrendEngineResponse {
  trends: TrendResult[];
  summary?: string;
}

// Page name mapping
const getPageName = (pathname: string): string => {
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] || "דף הבית";

  const pageMap: Record<string, string> = {
    "": "דף הבית",
    dashboard: "לוח בקרה",
    clients: "לקוחות",
    tasks: "משימות",
    campaigns: "קמפיינים",
    stats: "סטטיסטיקות",
    leads: "ליידים",
    "business-projects": "פרויקטים",
    payments: "תשלומים",
    approvals: "אישורים",
  };

  return pageMap[lastSegment] || lastSegment;
};

// Alert severity colors
const getSeverityColor = (
  severity: "critical" | "warning" | "info"
): string => {
  switch (severity) {
    case "critical":
      return "#ef4444";
    case "warning":
      return "#f59e0b";
    case "info":
      return "#00B5FE";
    default:
      return "#00B5FE";
  }
};

const getSeverityIcon = (severity: "critical" | "warning" | "info"): string => {
  switch (severity) {
    case "critical":
      return "⚠️";
    case "warning":
      return "⚡";
    case "info":
      return "ℹ️";
    default:
      return "ℹ️";
  }
};

// Insights Tab Component
const InsightsTab: React.FC = () => {
  const { alerts: rawAlerts, insights: rawInsights } = useOperationalAlerts();
  const { data: rawTasks } = useTasks();
  const { data: rawClients } = useClients();
  const { data: rawCampaigns } = useCampaigns();
  const { data: rawPayments } = usePayments();

  // Safe fallbacks — never let undefined reach .filter/.map/.reduce
  const alerts = rawAlerts ?? [];
  const insights = rawInsights ?? [];
  const tasks = rawTasks ?? [];
  const clients = rawClients ?? [];
  const campaigns = rawCampaigns ?? [];
  const payments = rawPayments ?? [];

  const allAlerts = useMemo(() => {
    const mapped = alerts.map((alert) => ({
      ...alert,
      severity: alert.severity as "critical" | "warning" | "info",
    }));

    return mapped.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [alerts]);

  const managementInsights = useMemo(() => {
    return generateInsights({
      tasks: tasks || [],
      clients: clients || [],
      campaigns: campaigns || [],
      payments: payments || [],
      insights: insights || [],
    });
  }, [tasks, clients, campaigns, payments, insights]);

  return (
    <div
      style={{
        direction: "rtl",
        textAlign: "right",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1rem",
      }}
    >
      {allAlerts.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem 1rem",
            textAlign: "center",
            color: "var(--foreground-muted)",
          }}
        >
          <div style={{ fontSize: "2.5rem" }}>✅</div>
          <div style={{ fontWeight: 600 }}>הכל תקין!</div>
          <div style={{ fontSize: "0.875rem", color: "var(--foreground-subtle)" }}>
            אין התראות פעילות כרגע
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {allAlerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: "1rem",
                  background: "var(--surface-raised)",
                  border: `1px solid var(--border)`,
                  borderRadius: "0.75rem",
                  display: "flex",
                  gap: "0.75rem",
                  flexDirection: "row-reverse",
                }}
              >
                <div
                  style={{
                    fontSize: "1.25rem",
                    flexShrink: 0,
                  }}
                >
                  {getSeverityIcon(alert.severity)}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    {alert.title}
                  </div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--foreground-muted)",
                    }}
                  >
                    {alert.description}
                  </div>
                  {alert.category && (
                    <div
                      style={{
                        display: "inline-flex",
                        width: "fit-content",
                        gap: "0.5rem",
                        marginTop: "0.5rem",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.5rem",
                          background: getSeverityColor(alert.severity),
                          color: "white",
                          borderRadius: "0.375rem",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                        }}
                      >
                        {alert.category}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {managementInsights && managementInsights.length > 0 && (
            <div
              style={{
                marginTop: "1rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "0.75rem",
                  color: "var(--foreground-muted)",
                }}
              >
                📊 תובנות ניהול
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {managementInsights.slice(0, 3).map((insight, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "0.75rem",
                      background: "var(--surface-raised)",
                      borderRadius: "0.5rem",
                      fontSize: "0.85rem",
                      color: "var(--foreground-muted)",
                    }}
                  >
                    {insight.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Actions Tab Component
const ActionsTab: React.FC = () => {
  const { data: rawTasks } = useTasks();
  const { data: rawClients } = useClients();
  const { data: rawPayments } = usePayments();

  // Safe fallbacks — never let undefined reach .filter/.map/.reduce
  const tasks = rawTasks ?? [];
  const clients = rawClients ?? [];
  const payments = rawPayments ?? [];

  const stats = useMemo(() => {
    return {
      activeClients: clients.filter((c) => (c as any).status !== "inactive").length,
      openTasks: tasks.filter((t) => (t as any).status !== "completed").length,
      pendingPayments: payments.filter((p) => (p as any).status === "pending").length,
    };
  }, [clients, tasks, payments]);

  const actions = [
    { icon: "👤", label: "לקוח חדש", route: "/clients" },
    { icon: "📅", label: "משימה חדשה", route: "/tasks" },
    { icon: "📣", label: "קמפיין חדש", route: "/campaigns" },
    { icon: "📋", label: "פרויקט חדש", route: "/business-projects" },
    { icon: "🎯", label: "ליד חדש", route: "/leads" },
    { icon: "📊", label: "סטטיסטיקות", route: "/stats" },
  ];

  return (
    <div
      style={{
        direction: "rtl",
        textAlign: "right",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        padding: "1rem",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem",
        }}
      >
        {actions.map((action) => (
          <Link
            key={action.route}
            href={action.route}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                padding: "1rem",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                cursor: "pointer",
                transition: "all 200ms ease",
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-raised)";
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface-raised)";
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ fontSize: "1.5rem" }}>{action.icon}</div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                {action.label}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            marginBottom: "1rem",
            color: "var(--foreground-muted)",
          }}
        >
          📈 סטטיסטיקות מהירות
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem",
              background: "var(--surface-raised)",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
            }}
          >
            <span style={{ color: "var(--foreground-muted)" }}>לקוחות פעילים</span>
            <span
              style={{
                fontWeight: 600,
                background: "var(--accent-muted)",
                color: "var(--accent)",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.375rem",
              }}
            >
              {stats.activeClients}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem",
              background: "var(--surface-raised)",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
            }}
          >
            <span style={{ color: "var(--foreground-muted)" }}>משימות פתוחות</span>
            <span
              style={{
                fontWeight: 600,
                background: "var(--accent-muted)",
                color: "var(--accent)",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.375rem",
              }}
            >
              {stats.openTasks}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem",
              background: "var(--surface-raised)",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
            }}
          >
            <span style={{ color: "var(--foreground-muted)" }}>תשלומים ממתינים</span>
            <span
              style={{
                fontWeight: 600,
                background: "var(--accent-muted)",
                color: "var(--accent)",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.375rem",
              }}
            >
              {stats.pendingPayments}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// AI Analysis Tab Component
const AIAnalysisTab: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TrendEngineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleStartAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setShowResults(false);
    setResults(null);

    try {
      const response = await fetch("/api/ai/trend-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: "marketing",
          platforms: ["instagram", "tiktok", "facebook"],
          language: "he",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch trends");
      }

      const data: TrendEngineResponse = await response.json();
      setResults(data);

      // Simulate thinking time for UX
      setTimeout(() => {
        setShowResults(true);
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה בעת הניתוח");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div
      style={{
        direction: "rtl",
        textAlign: "right",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1rem",
      }}
    >
      <style>{`
        @keyframes pulse-dots {
          0%, 20% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
        .thinking-dot {
          display: inline-block;
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 50%;
          background: var(--accent);
          margin: 0 0.25rem;
        }
        .thinking-dot:nth-child(1) {
          animation: pulse-dots 1.4s infinite;
        }
        .thinking-dot:nth-child(2) {
          animation: pulse-dots 1.4s infinite 0.2s;
        }
        .thinking-dot:nth-child(3) {
          animation: pulse-dots 1.4s infinite 0.4s;
        }
      `}</style>

      {!isLoading && !results && !error && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            padding: "2rem 1rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2.5rem" }}>🔍</div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              בחר לניתוח עמוק
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--foreground-muted)",
              }}
            >
              ניתוח מגמות וזדמנויות בשוק שלך
            </div>
          </div>
          <button
            onClick={handleStartAnalysis}
            style={{
              padding: "0.75rem 1.5rem",
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 200ms ease",
              fontSize: "0.95rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            התחל ניתוח
          </button>
        </div>
      )}

      {isLoading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem 1rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2rem" }}>🧠</div>
          <div
            style={{
              fontSize: "0.95rem",
              color: "var(--foreground-muted)",
            }}
          >
            מנתח נתונים
            <span style={{ display: "inline-block", marginInlineStart: "0.5rem" }}>
              <div className="thinking-dot" />
              <div className="thinking-dot" />
              <div className="thinking-dot" />
            </span>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "1.5rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "0.75rem",
            color: "#ef4444",
            fontSize: "0.9rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>שגיאה</div>
          <div>{error}</div>
          <button
            onClick={() => {
              setError(null);
              handleStartAnalysis();
            }}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 500,
            }}
          >
            נסה שוב
          </button>
        </div>
      )}

      {results && showResults && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {results.trends && results.trends.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {results.trends.map((trend, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "1rem",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    animation: `fadeInUp 0.5s ease forwards`,
                    animationDelay: `${idx * 0.1}s`,
                    opacity: 0,
                  }}
                >
                  <style>{`
                    @keyframes fadeInUp {
                      from {
                        opacity: 0;
                        transform: translateY(10px);
                      }
                      to {
                        opacity: 1;
                        transform: translateY(0);
                      }
                    }
                  `}</style>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                        {trend.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--foreground-muted)",
                        }}
                      >
                        {trend.contentIdea}
                      </div>
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.75rem",
                        background:
                          trend.urgency === "high"
                            ? "rgba(239, 68, 68, 0.15)"
                            : trend.urgency === "medium"
                              ? "rgba(245, 158, 11, 0.15)"
                              : "rgba(59, 130, 246, 0.15)",
                        color:
                          trend.urgency === "high"
                            ? "#ef4444"
                            : trend.urgency === "medium"
                              ? "#f59e0b"
                              : "#3b82f6",
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {trend.urgency === "high"
                        ? "דחוף"
                        : trend.urgency === "medium"
                          ? "בינוני"
                          : "נמוך"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.75rem",
                        color: "var(--foreground-muted)",
                      }}
                    >
                      <span>רלוונטיות</span>
                      <span>{Math.round(trend.relevanceScore * 100)}%</span>
                    </div>
                    <div
                      style={{
                        height: "0.375rem",
                        background: "var(--border)",
                        borderRadius: "9999px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          background: "var(--accent)",
                          width: `${trend.relevanceScore * 100}%`,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.summary && (
            <div
              style={{
                padding: "1rem",
                background: "var(--accent-muted)",
                borderRadius: "0.75rem",
                borderInlineStart: "3px solid var(--accent)",
                animation: `fadeInUp 0.5s ease forwards 0.3s`,
                opacity: 0,
              }}
            >
              <style>{`
                @keyframes fadeInUp {
                  from {
                    opacity: 0;
                    transform: translateY(10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}</style>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                📋 סיכום
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
                {results.summary}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setResults(null);
              setShowResults(false);
            }}
            style={{
              padding: "0.75rem 1.5rem",
              background: "transparent",
              color: "var(--accent)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 200ms ease",
              fontSize: "0.95rem",
              marginTop: "0.5rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            ניתוח חדש
          </button>
        </div>
      )}
    </div>
  );
};

// Main Drawer Component
interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"insights" | "actions" | "analysis">(
    "insights"
  );
  const pathname = usePathname();
  const pageName = getPageName(pathname);
  const { alerts: rawAlerts } = useOperationalAlerts();
  const alerts = rawAlerts ?? [];

  const criticalAlertCount = useMemo(() => {
    return alerts.filter((a) => a.severity === "critical").length;
  }, [alerts]);

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            zIndex: 1349,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "380px",
          height: "100vh",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          zIndex: 1350,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease",
          display: "flex",
          flexDirection: "column",
          direction: "rtl",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            direction: "rtl",
            textAlign: "right",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              marginBottom: "0.75rem",
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--foreground-muted)",
                cursor: "pointer",
                fontSize: "1.25rem",
                padding: 0,
                width: "2rem",
                height: "2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
            <div style={{ flex: 1, textAlign: "right", marginInlineEnd: "0.5rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.25rem" }}>
                🧠 AI Copilot
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--foreground-muted)",
                }}
              >
                {pageName}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.85rem",
              color: "var(--foreground-muted)",
            }}
          >
            <div
              style={{
                width: "0.5rem",
                height: "0.5rem",
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            פעיל
          </div>
        </div>

        {/* Tab Bar */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            direction: "rtl",
          }}
        >
          {[
            { id: "insights" as const, label: "תובנות" },
            { id: "actions" as const, label: "פעולות" },
            { id: "analysis" as const, label: "ניתוח AI" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "1rem 0.75rem",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: activeTab === tab.id ? 600 : 500,
                color: activeTab === tab.id ? "var(--accent)" : "var(--foreground-muted)",
                borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "none",
                transition: "all 200ms ease",
                textAlign: "center",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {activeTab === "insights" && <InsightsTab />}
          {activeTab === "actions" && <ActionsTab />}
          {activeTab === "analysis" && <AIAnalysisTab />}
        </div>
      </div>
    </>
  );
};

// Toggle Button Component
interface AICopilotToggleProps {
  onClick: () => void;
  isOpen: boolean;
}

const AICopilotToggle: React.FC<AICopilotToggleProps> = ({ onClick, isOpen }) => {
  const { alerts: rawAlerts } = useOperationalAlerts();
  const alerts = rawAlerts ?? [];

  const criticalAlertCount = useMemo(() => {
    return alerts.filter((a) => a.severity === "critical").length;
  }, [alerts]);

  const hasCriticalAlerts = criticalAlertCount > 0;

  return (
    <>
      <style>{`
        @keyframes pulse-button {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
        }
        .ai-copilot-toggle-pulse {
          animation: pulse-button 2s infinite;
        }
      `}</style>

      <button
        onClick={onClick}
        className={hasCriticalAlerts && !isOpen ? "ai-copilot-toggle-pulse" : ""}
        style={{
          position: "fixed",
          insetInlineStart: "1.5rem",
          bottom: "1.5rem",
          zIndex: 1400,
          width: "3rem",
          height: "3rem",
          borderRadius: "50%",
          background: "var(--accent)",
          color: "white",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
          transition: "all 200ms ease",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
        }}
      >
        {isOpen ? "✕" : "🧠"}

        {criticalAlertCount > 0 && !isOpen && (
          <div
            style={{
              position: "absolute",
              top: "-0.5rem",
              insetInlineEnd: "-0.5rem",
              width: "1.5rem",
              height: "1.5rem",
              borderRadius: "50%",
              background: "#ef4444",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              border: "2px solid var(--surface)",
            }}
          >
            {criticalAlertCount > 9 ? "9+" : criticalAlertCount}
          </div>
        )}
      </button>
    </>
  );
};

// Container Component that manages state
interface AICopilotContainerProps {
  children?: ReactNode;
}

const AICopilotContainer: React.FC<AICopilotContainerProps> = ({ children }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <AICopilotToggle
        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        isOpen={isDrawerOpen}
      />
      <AICopilotDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      {children}
    </>
  );
};

export { AICopilotDrawer, AICopilotToggle, AICopilotContainer };
export default AICopilotContainer;
