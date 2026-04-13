"use client";
import { useState, useEffect } from "react";
import type { Client, Employee } from "@/lib/db/schema";

interface TabInsightsProps {
  client: Client;
  employees: Employee[];
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ClientBrainData {
  businessSummary: string;
  toneOfVoice: string;
  audienceProfile: string;
  keySellingPoints: string[];
  weaknesses: string[];
}

interface BrandWeakness {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  fixSuggestions: string[];
  messagingImprovement: string;
}

interface CustomerSegment {
  name: string;
  ageRange: string;
  interests: string[];
  behaviors: string[];
  painPoints: string[];
  color: string;
}

interface TrendSuggestion {
  title: string;
  relevanceScore: number;
  urgency: "high" | "medium" | "low";
  contentIdeas: string[];
}

interface CompetitorInsight {
  doMoreOf: string[];
  avoid: string[];
  opportunities: string[];
}

// ============================================================================
// LOADING SKELETON & ERROR COMPONENTS
// ============================================================================

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div
        style={{
          width: "1.25rem",
          height: "1.25rem",
          borderRadius: "50%",
          border: "2px solid var(--border)",
          borderTopColor: "var(--accent)",
          animation: "spin 1s linear infinite",
        }}
      />
      <span style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>
        לומד את העסק שלך...
      </span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        padding: "1rem",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        borderRadius: "0.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}
    >
      <span style={{ color: "#ef4444", fontSize: "0.875rem" }}>⚠️ {message}</span>
      <button
        onClick={onRetry}
        style={{
          padding: "0.5rem 1rem",
          backgroundColor: "var(--accent)",
          color: "white",
          border: "none",
          borderRadius: "0.375rem",
          cursor: "pointer",
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        נסה שוב
      </button>
    </div>
  );
}

// ============================================================================
// SECTION: CLIENT BRAIN
// ============================================================================

function ClientBrainSection({ client }: { client: Client }) {
  const [data, setData] = useState<ClientBrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientBrain = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai/client-brain?clientId=${client.id}`);
      if (!response.ok) throw new Error("Failed to fetch client brain");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/client-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          name: client.name,
          businessField: client.businessField,
          clientType: client.clientType,
          keyMarketingMessages: client.keyMarketingMessages,
          marketingGoals: client.marketingGoals,
          platforms: [client.facebookPageUrl ? 'facebook' : '', client.instagramProfileUrl ? 'instagram' : '', client.tiktokProfileUrl ? 'tiktok' : ''].filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error("Failed to refresh");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientBrain();
  }, [client.id]);

  if (error) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          background: "linear-gradient(135deg, var(--surface-raised) 0%, rgba(0, 181, 254, 0.03) 100%)",
        }}
      >
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            marginBottom: "1.5rem",
            color: "var(--foreground)",
          }}
        >
          🧠 ניתוח עסקי AI
        </h3>
        <ErrorState message={error} onRetry={handleRefresh} />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          background: "linear-gradient(135deg, var(--surface-raised) 0%, rgba(0, 181, 254, 0.03) 100%)",
        }}
      >
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            marginBottom: "1.5rem",
            color: "var(--foreground)",
          }}
        >
          🧠 ניתוח עסקי AI
        </h3>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      style={{
        padding: "2rem",
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
        background: "linear-gradient(135deg, var(--surface-raised) 0%, rgba(0, 181, 254, 0.03) 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "var(--foreground)",
            margin: 0,
          }}
        >
          🧠 ניתוח עסקי AI
        </h3>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
            opacity: loading ? 0.6 : 1,
          }}
        >
          רענן ניתוח
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <h4
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--foreground-muted)",
              marginBottom: "0.5rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            סיכום עסקי
          </h4>
          <p
            style={{
              fontSize: "0.9375rem",
              color: "var(--foreground)",
              margin: 0,
              lineHeight: "1.5",
            }}
          >
            {data.businessSummary}
          </p>
        </div>

        <div>
          <h4
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--foreground-muted)",
              marginBottom: "0.5rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            טון קול
          </h4>
          <p
            style={{
              fontSize: "0.9375rem",
              color: "var(--foreground)",
              margin: 0,
            }}
          >
            {data.toneOfVoice}
          </p>
        </div>

        <div>
          <h4
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--foreground-muted)",
              marginBottom: "0.5rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            פרופיל קהל
          </h4>
          <p
            style={{
              fontSize: "0.9375rem",
              color: "var(--foreground)",
              margin: 0,
            }}
          >
            {data.audienceProfile}
          </p>
        </div>

        <div>
          <h4
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--foreground-muted)",
              marginBottom: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            נקודות מכירה עיקריות
          </h4>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {data.keySellingPoints.map((point, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: "0.9375rem",
                  color: "var(--foreground)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "0.375rem",
                    height: "0.375rem",
                    backgroundColor: "var(--accent)",
                    borderRadius: "50%",
                    marginTop: "0.4rem",
                    flexShrink: 0,
                  }}
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {data.weaknesses && data.weaknesses.length > 0 && (
          <div>
            <h4
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--foreground-muted)",
                marginBottom: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              אתגרים
            </h4>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {data.weaknesses.map((weakness, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: "0.9375rem",
                    color: "#ef4444",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                  }}
                >
                  <span style={{ marginTop: "0.2rem" }}>⚠️</span>
                  {weakness}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SECTION: BRAND WEAKNESSES
// ============================================================================

function BrandWeaknessSection({ client }: { client: Client }) {
  const [weaknesses, setWeaknesses] = useState<BrandWeakness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const fetchWeaknesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/brand-weakness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          name: client.name,
          businessField: client.businessField,
          clientType: client.clientType,
          keyMarketingMessages: client.keyMarketingMessages,
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch weaknesses");
      const result = await response.json();
      setWeaknesses(Array.isArray(result) ? result : result.weaknesses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeaknesses();
  }, [client.id]);

  const toggleExpand = (idx: number) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpanded(newExpanded);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return { bg: "rgba(239, 68, 68, 0.1)", border: "#ef4444", label: "חמור" };
      case "medium":
        return { bg: "rgba(245, 158, 11, 0.1)", border: "#f59e0b", label: "בינוני" };
      case "low":
        return { bg: "rgba(34, 197, 94, 0.1)", border: "#22c55e", label: "נמוך" };
      default:
        return { bg: "rgba(107, 114, 128, 0.1)", border: "#6b7280", label: "לא ידוע" };
    }
  };

  if (error) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>
          🔍 חוזקות ותחומי הגדלה
        </h3>
        <ErrorState message={error} onRetry={fetchWeaknesses} />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>
          🔍 חוזקות ותחומי הגדלה
        </h3>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "2rem",
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
      }}
    >
      <h3
        style={{
          fontSize: "1.125rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
          color: "var(--foreground)",
        }}
      >
        🔍 חוזקות ותחומי הגדלה
      </h3>

      {weaknesses.length === 0 ? (
        <p style={{ color: "var(--foreground-muted)", textAlign: "center" }}>
          אין נתונים זמינים כרגע
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {weaknesses.map((weakness, idx) => {
            const severity = getSeverityColor(weakness.severity);
            const isExpanded = expanded.has(idx);
            return (
              <div
                key={idx}
                style={{
                  padding: "1.25rem",
                  backgroundColor: severity.bg,
                  border: `1px solid ${severity.border}`,
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
                onClick={() => toggleExpand(idx)}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <h4
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "var(--foreground)",
                        margin: "0 0 0.5rem 0",
                      }}
                    >
                      {weakness.title}
                    </h4>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.75rem",
                        backgroundColor: severity.border,
                        color: "white",
                        borderRadius: "0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {severity.label}
                    </span>
                  </div>
                  <span style={{ fontSize: "1.25rem" }}>
                    {isExpanded ? "▼" : "▶"}
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${severity.border}` }}>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        color: "var(--foreground)",
                        margin: "0 0 1rem 0",
                      }}
                    >
                      {weakness.description}
                    </p>

                    <div style={{ marginBottom: "1rem" }}>
                      <h5
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "var(--foreground-muted)",
                          marginBottom: "0.5rem",
                          textTransform: "uppercase",
                        }}
                      >
                        הצעות לתיקון
                      </h5>
                      <ul
                        style={{
                          listStyle: "none",
                          padding: 0,
                          margin: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        {weakness.fixSuggestions.map((suggestion, sidx) => (
                          <li
                            key={sidx}
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--foreground)",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "0.5rem",
                            }}
                          >
                            <span style={{ marginTop: "0.2rem", flexShrink: 0 }}>✓</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h5
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "var(--foreground-muted)",
                          marginBottom: "0.5rem",
                          textTransform: "uppercase",
                        }}
                      >
                        שיפור ההודעות
                      </h5>
                      <p
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--foreground)",
                          margin: 0,
                        }}
                      >
                        {weakness.messagingImprovement}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECTION: CUSTOMER PROFILE
// ============================================================================

function CustomerProfileSection({ client }: { client: Client }) {
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomerProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/customer-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          name: client.name,
          businessField: client.businessField,
          marketingGoals: client.marketingGoals,
          platforms: [client.facebookPageUrl ? 'facebook' : '', client.instagramProfileUrl ? 'instagram' : '', client.tiktokProfileUrl ? 'tiktok' : ''].filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch customer profile");
      const result = await response.json();
      setSegments(Array.isArray(result) ? result : result.segments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerProfile();
  }, [client.id]);

  if (error) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>
          👥 פרופיל לקוח
        </h3>
        <ErrorState message={error} onRetry={fetchCustomerProfile} />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>
          👥 פרופיל לקוח
        </h3>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "2rem",
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
      }}
    >
      <h3
        style={{
          fontSize: "1.125rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
          color: "var(--foreground)",
        }}
      >
        👥 פרופיל לקוח
      </h3>

      {segments.length === 0 ? (
        <p style={{ color: "var(--foreground-muted)", textAlign: "center" }}>
          אין נתונים זמינים כרגע
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {segments.map((segment, idx) => (
            <div
              key={idx}
              style={{
                padding: "1.5rem",
                backgroundColor: "var(--surface-raised)",
                border: `2px solid ${segment.color}`,
                borderRadius: "0.5rem",
              }}
            >
              <h4
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  marginBottom: "1rem",
                  color: "var(--foreground)",
                }}
              >
                {segment.name}
              </h4>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--foreground-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    גיל
                  </span>
                  <p style={{ fontSize: "0.875rem", color: "var(--foreground)", margin: "0.25rem 0 0 0" }}>
                    {segment.ageRange}
                  </p>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--foreground-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    תחומי עניין
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                    {segment.interests.map((interest, iidx) => (
                      <span
                        key={iidx}
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.75rem",
                          backgroundColor: segment.color,
                          color: "white",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                        }}
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--foreground-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    התנהגויות
                  </span>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0.5rem 0 0 0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    {segment.behaviors.map((behavior, bidx) => (
                      <li
                        key={bidx}
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--foreground)",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ marginTop: "0.1rem" }}>•</span>
                        {behavior}
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ paddingTop: "0.75rem", borderTop: `1px solid ${segment.color}` }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--foreground-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    נקודות כאב
                  </span>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0.5rem 0 0 0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    {segment.painPoints.map((point, pidx) => (
                      <li
                        key={pidx}
                        style={{
                          fontSize: "0.8125rem",
                          color: "#ef4444",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ marginTop: "0.1rem" }}>⚠️</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECTION: TREND ENGINE
// ============================================================================

function TrendEngineSection({ client }: { client: Client }) {
  const [trends, setTrends] = useState<TrendSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/trend-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          businessField: client.businessField,
          platforms: [client.facebookPageUrl ? 'facebook' : '', client.instagramProfileUrl ? 'instagram' : '', client.tiktokProfileUrl ? 'tiktok' : ''].filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch trends");
      const result = await response.json();
      setTrends(Array.isArray(result) ? result : result.trendSuggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [client.id]);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "#ef4444";
      case "medium":
        return "#f59e0b";
      case "low":
        return "#22c55e";
      default:
        return "#6b7280";
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "דחוף";
      case "medium":
        return "בינוני";
      case "low":
        return "נמוך";
      default:
        return "לא ידוע";
    }
  };

  if (error) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>
          🔥 מה חם השבוע
        </h3>
        <ErrorState message={error} onRetry={fetchTrends} />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>
          🔥 מה חם השבוע
        </h3>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "2rem",
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
      }}
    >
      <h3
        style={{
          fontSize: "1.125rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
          color: "var(--foreground)",
        }}
      >
        🔥 מה חם השבוע
      </h3>

      {trends.length === 0 ? (
        <p style={{ color: "var(--foreground-muted)", textAlign: "center" }}>
          אין נתונים זמינים כרגע
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {trends.map((trend, idx) => (
            <div
              key={idx}
              style={{
                padding: "1.5rem",
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.75rem",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: "var(--foreground)",
                      margin: 0,
                    }}
                  >
                    {trend.title}
                  </h4>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.75rem",
                      backgroundColor: getUrgencyColor(trend.urgency),
                      color: "white",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {getUrgencyLabel(trend.urgency)}
                  </span>
                </div>

                <div style={{ marginBottom: "0.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--foreground-muted)",
                        textTransform: "uppercase",
                      }}
                    >
                      ניקוד רלוונטיות
                    </span>
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--accent)",
                      }}
                    >
                      {Math.round(trend.relevanceScore * 100)}%
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "0.5rem",
                      backgroundColor: "var(--border)",
                      borderRadius: "0.25rem",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${trend.relevanceScore * 100}%`,
                        height: "100%",
                        backgroundColor: "var(--accent)",
                        transition: "width 300ms ease",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h5
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--foreground-muted)",
                    marginBottom: "0.5rem",
                    textTransform: "uppercase",
                  }}
                >
                  רעיונות תוכן
                </h5>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {trend.contentIdeas.map((idea, iidx) => (
                    <li
                      key={iidx}
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--foreground)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ marginTop: "0.2rem", flexShrink: 0 }}>💡</span>
                      {idea}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECTION: COMPETITOR INSIGHTS
// ============================================================================

function CompetitorInsightsSection({ client }: { client: Client }) {
  const [insights, setInsights] = useState<CompetitorInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompetitorAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/competitor-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          businessField: client.businessField,
          platforms: [client.facebookPageUrl ? 'facebook' : '', client.instagramProfileUrl ? 'instagram' : '', client.tiktokProfileUrl ? 'tiktok' : ''].filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch competitor analysis");
      const result = await response.json();
      setInsights(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitorAnalysis();
  }, [client.id]);

  if (error) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>
          🎯 תובנות תחרותיות
        </h3>
        <ErrorState message={error} onRetry={fetchCompetitorAnalysis} />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}
      >
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>
          🎯 תובנות תחרותיות
        </h3>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div
      style={{
        padding: "2rem",
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
      }}
    >
      <h3
        style={{
          fontSize: "1.125rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
          color: "var(--foreground)",
        }}
      >
        🎯 תובנות תחרותיות
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Do More Of */}
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            border: "1px solid #22c55e",
            borderRadius: "0.5rem",
          }}
        >
          <h4
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "#22c55e",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            ✅ יותר מזה
          </h4>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {insights.doMoreOf.map((item, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: "0.875rem",
                  color: "var(--foreground)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                }}
              >
                <span style={{ marginTop: "0.2rem", flexShrink: 0 }}>→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Avoid */}
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            borderRadius: "0.5rem",
          }}
        >
          <h4
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "#ef4444",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            ❌ הימנע מזה
          </h4>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {insights.avoid.map((item, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: "0.875rem",
                  color: "var(--foreground)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                }}
              >
                <span style={{ marginTop: "0.2rem", flexShrink: 0 }}>⊘</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Opportunities */}
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "rgba(0, 181, 254, 0.1)",
            border: "1px solid var(--accent)",
            borderRadius: "0.5rem",
          }}
        >
          <h4
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--accent)",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            💎 הזדמנויות
          </h4>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {insights.opportunities.map((item, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: "0.875rem",
                  color: "var(--foreground)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                }}
              >
                <span style={{ marginTop: "0.2rem", flexShrink: 0 }}>◆</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// WEEKLY RECOMMENDATIONS (Fallback + Trend Integration)
// ============================================================================

function WeeklyRecommendationsWidget({ client }: { client: Client }) {
  const [recommendations, setRecommendations] = useState<
    Array<{ emoji: string; title: string; description: string; format: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  // Fallback recommendations
  const fallbackRecommendations: Record<string, any[]> = {
    marketing: [
      {
        emoji: "📚",
        title: "מדריך שימושי",
        description: "טיפים חדשים במקצוע שלך או בתחום העיסוק",
        format: "קרוסלה",
      },
      {
        emoji: "😊",
        title: "סיפור לקוח",
        description: "חוויה חיובית של לקוח או מקרה של הצלחה",
        format: "ריל או סטורי",
      },
      {
        emoji: "🎯",
        title: "הצעה מיוחדת",
        description: "קדיחה או הצעה זמנית לעידוד קנייה",
        format: "ריל או אינפוגרפיקה",
      },
    ],
    branding: [
      {
        emoji: "🏆",
        title: "הישגי מותג",
        description: "פרויקט או הישג שמשקף את ערכי המותג",
        format: "ריל",
      },
      {
        emoji: "👥",
        title: "מאחורי הקלעים",
        description: "תהליך העבודה או צוות החברה",
        format: "סטורי או ריל",
      },
      {
        emoji: "💡",
        title: "טיפ מקצועי",
        description: "ידע או בחינה בתחום המומחיות",
        format: "קרוסלה או פוסט",
      },
    ],
  };

  useEffect(() => {
    const fallback = fallbackRecommendations[client.clientType] || fallbackRecommendations.marketing;
    setRecommendations(fallback);
  }, [client.clientType]);

  return (
    <div
      style={{
        padding: "2rem",
        backgroundColor: "var(--accent)",
        border: "1px solid var(--accent)",
        borderRadius: "0.75rem",
        background: `linear-gradient(135deg, var(--accent) 0%, rgba(0, 181, 254, 0.8) 100%)`,
        color: "white",
      }}
    >
      <h3
        style={{
          fontSize: "1.125rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
          color: "white",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        📅 מה כדאי לפרסם השבוע
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        {recommendations.map((rec, idx) => (
          <div
            key={idx}
            style={{
              padding: "1rem",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: "0.5rem",
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              {rec.emoji}
            </div>
            <h4
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                margin: "0 0 0.25rem 0",
                color: "white",
              }}
            >
              {rec.title}
            </h4>
            <p
              style={{
                fontSize: "0.8125rem",
                margin: "0 0 0.5rem 0",
                color: "rgba(255, 255, 255, 0.85)",
                lineHeight: "1.4",
              }}
            >
              {rec.description}
            </p>
            <span
              style={{
                display: "inline-block",
                padding: "0.25rem 0.5rem",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                borderRadius: "0.25rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              {rec.format}
            </span>
          </div>
        ))}
      </div>

      <p
        style={{
          fontSize: "0.75rem",
          color: "rgba(255, 255, 255, 0.7)",
          margin: 0,
          fontStyle: "italic",
        }}
      >
        (מבוסס על ניתוח AI — מתעדכן אוטומטית)
      </p>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TabInsights({ client, employees }: TabInsightsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <ClientBrainSection client={client} />
      <BrandWeaknessSection client={client} />
      <CustomerProfileSection client={client} />
      <TrendEngineSection client={client} />
      <CompetitorInsightsSection client={client} />
      <WeeklyRecommendationsWidget client={client} />
    </div>
  );
}
