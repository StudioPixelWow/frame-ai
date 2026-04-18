"use client";
import { useState, useEffect, useCallback } from "react";
import type { Client, Employee } from "@/lib/db/schema";

interface TabInsightsProps {
  client: Client;
  employees: Employee[];
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ClientBrainData {
  businessSummary?: string;
  toneOfVoice?: string;
  audienceProfile?: string;
  keySellingPoints?: string[];
  weaknesses?: Array<string | { description?: string }>;
}

interface BrandWeakness {
  title?: string;
  area?: string;
  description?: string;
  severity?: "high" | "medium" | "low";
  fixSuggestions?: string[];
  messagingImprovement?: string;
}

interface CustomerSegment {
  name?: string;
  ageRange?: string;
  interests?: string[];
  behaviors?: string[];
  painPoints?: string[];
  color?: string;
}

interface TrendSuggestion {
  title?: string;
  trendName?: string;
  relevanceScore?: number;
  urgency?: "high" | "medium" | "low";
  contentIdeas?: string[];
}

interface CompetitorInsight {
  doMoreOf?: string[];
  avoid?: string[];
  opportunities?: string[];
}

// Safe array helper — never crashes on null/undefined
function safeArray<T>(val: T[] | null | undefined): T[] {
  return Array.isArray(val) ? val : [];
}

function safeString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'description' in val) {
    return (val as { description?: string }).description || '';
  }
  return String(val ?? '');
}

// ============================================================================
// STATUS TYPES
// ============================================================================

type SectionStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

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
        @keyframes spin { to { transform: rotate(360deg); } }
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

function EmptyState({ message, actionLabel, onAction }: { message: string; actionLabel: string; onAction: () => void }) {
  return (
    <div
      style={{
        padding: "1.5rem",
        backgroundColor: "rgba(0, 181, 254, 0.04)",
        border: "1px dashed var(--border)",
        borderRadius: "0.5rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        textAlign: "center",
      }}
    >
      <span style={{ color: "var(--foreground-muted)", fontSize: "0.875rem" }}>{message}</span>
      <button
        onClick={onAction}
        style={{
          padding: "0.5rem 1.25rem",
          backgroundColor: "var(--accent)",
          color: "white",
          border: "none",
          borderRadius: "0.375rem",
          cursor: "pointer",
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

const sectionStyle = {
  padding: "2rem",
  backgroundColor: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
};

// ============================================================================
// HELPER: Persist insight to DB
// ============================================================================

async function saveInsight(clientId: string, section: string, payload: unknown) {
  try {
    await fetch('/api/ai/client-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, section, payload }),
    });
    console.log(`[Insights] Saved ${section} for ${clientId}`);
  } catch (err) {
    console.warn(`[Insights] Failed to save ${section}:`, err);
  }
}

// ============================================================================
// SECTION: CLIENT BRAIN
// ============================================================================

function ClientBrainSection({ client, persisted }: { client: Client; persisted?: unknown }) {
  const [data, setData] = useState<ClientBrainData | null>(null);
  const [status, setStatus] = useState<SectionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchClientBrain = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      console.log(`[Insights] ClientBrain GET for ${client.id}`);
      const response = await fetch(`/api/ai/client-brain?clientId=${client.id}`);
      if (response.status === 404) {
        setStatus('empty');
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `Server error (${response.status})`);
      }
      const result = await response.json();
      const brainData = result?.data || result;
      setData(brainData);
      setStatus('ready');
      // Persist to insights store
      saveInsight(client.id, 'client_brain', brainData);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStatus('error');
    }
  }, [client.id]);

  const handleGenerate = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      console.log(`[Insights] ClientBrain POST generate for ${client.id}`);
      const response = await fetch("/api/ai/client-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          clientName: client.name,
          businessField: client.businessField,
          businessType: client.clientType,
          industryType: client.businessField,
          websiteUrl: client.websiteUrl || '',
          facebookUrl: client.facebookPageUrl || '',
          instagramUrl: client.instagramProfileUrl || '',
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to generate");
      }
      const result = await response.json();
      const brainData = result?.data || result;
      setData(brainData);
      setStatus('ready');
      saveInsight(client.id, 'client_brain', brainData);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStatus('error');
    }
  }, [client.id, client.name, client.businessField, client.clientType, client.websiteUrl, client.facebookPageUrl, client.instagramProfileUrl]);

  useEffect(() => {
    // If persisted data exists, use it immediately
    if (persisted && typeof persisted === 'object') {
      setData(persisted as ClientBrainData);
      setStatus('ready');
      return;
    }
    fetchClientBrain();
  }, [client.id, persisted, fetchClientBrain]);

  if (status === 'error') {
    return (
      <div style={sectionStyle}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem", color: "var(--foreground)" }}>
          🧠 ניתוח עסקי AI
        </h3>
        <ErrorState message={errorMsg || 'שגיאה בלתי צפויה'} onRetry={fetchClientBrain} />
      </div>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div style={sectionStyle}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem", color: "var(--foreground)" }}>
          🧠 ניתוח עסקי AI
        </h3>
        <LoadingSkeleton />
      </div>
    );
  }

  if (status === 'empty' || !data) {
    return (
      <div style={sectionStyle}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem", color: "var(--foreground)" }}>
          🧠 ניתוח עסקי AI
        </h3>
        <EmptyState message="עדיין לא נוצר ניתוח עסקי עבור לקוח זה." actionLabel="צור ניתוח" onAction={handleGenerate} />
      </div>
    );
  }

  return (
    <div style={{ ...sectionStyle, background: "linear-gradient(135deg, var(--surface-raised) 0%, rgba(0, 181, 254, 0.03) 100%)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
          🧠 ניתוח עסקי AI
        </h3>
        <button
          onClick={handleGenerate}
          disabled={status === 'loading'}
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
          רענן ניתוח
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {data.businessSummary && (
          <div>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              סיכום עסקי
            </h4>
            <p style={{ fontSize: "0.9375rem", color: "var(--foreground)", margin: 0, lineHeight: "1.5" }}>
              {data.businessSummary}
            </p>
          </div>
        )}

        {data.toneOfVoice && (
          <div>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              טון קול
            </h4>
            <p style={{ fontSize: "0.9375rem", color: "var(--foreground)", margin: 0 }}>
              {data.toneOfVoice}
            </p>
          </div>
        )}

        {data.audienceProfile && (
          <div>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              פרופיל קהל
            </h4>
            <p style={{ fontSize: "0.9375rem", color: "var(--foreground)", margin: 0 }}>
              {data.audienceProfile}
            </p>
          </div>
        )}

        {safeArray(data.keySellingPoints).length > 0 && (
          <div>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              נקודות מכירה עיקריות
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {safeArray(data.keySellingPoints).map((point, idx) => (
                <li key={idx} style={{ fontSize: "0.9375rem", color: "var(--foreground)", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <span style={{ display: "inline-block", width: "0.375rem", height: "0.375rem", backgroundColor: "var(--accent)", borderRadius: "50%", marginTop: "0.4rem", flexShrink: 0 }} />
                  {safeString(point)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {safeArray(data.weaknesses).length > 0 && (
          <div>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              אתגרים
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {safeArray(data.weaknesses).map((weakness, idx) => (
                <li key={idx} style={{ fontSize: "0.9375rem", color: "#ef4444", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <span style={{ marginTop: "0.2rem" }}>⚠️</span>
                  {safeString(weakness)}
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

function BrandWeaknessSection({ client, persisted, autoGenerate, onRegenerate }: { client: Client; persisted?: unknown; autoGenerate?: boolean; onRegenerate?: () => Promise<boolean> }) {
  const [weaknesses, setWeaknesses] = useState<BrandWeakness[]>([]);
  const [status, setStatus] = useState<SectionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const handleRegenerate = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      if (onRegenerate) {
        const ok = await onRegenerate();
        if (!ok) throw new Error('הייצור נכשל');
        // Parent will update persisted prop — we don't need to do anything else
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
      setStatus('error');
    }
  }, [onRegenerate]);

  useEffect(() => {
    if (persisted && Array.isArray(persisted) && persisted.length > 0) {
      setWeaknesses(persisted as BrandWeakness[]);
      setStatus('ready');
      return;
    }
    if (status === 'loading') return; // don't reset during regeneration
    setStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted]);

  const toggleExpand = (idx: number) => {
    const n = new Set(expanded);
    n.has(idx) ? n.delete(idx) : n.add(idx);
    setExpanded(n);
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "high": return { bg: "rgba(239, 68, 68, 0.1)", border: "#ef4444", label: "חמור" };
      case "medium": return { bg: "rgba(245, 158, 11, 0.1)", border: "#f59e0b", label: "בינוני" };
      case "low": return { bg: "rgba(34, 197, 94, 0.1)", border: "#22c55e", label: "נמוך" };
      default: return { bg: "rgba(107, 114, 128, 0.1)", border: "#6b7280", label: "לא ידוע" };
    }
  };

  if (status === 'error') {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔍 חוזקות ותחומי הגדלה</h3>
      <ErrorState message={errorMsg || 'שגיאה בייצור ניתוח'} onRetry={handleRegenerate} />
    </div>);
  }
  if (status === 'loading') {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔍 חוזקות ותחומי הגדלה</h3>
      <LoadingSkeleton />
    </div>);
  }
  if ((status === 'idle' || status === 'empty') && weaknesses.length === 0) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔍 חוזקות ותחומי הגדלה</h3>
      <EmptyState message="יש ליצור חקר לקוח קודם, או ללחוץ לייצור ידני." actionLabel="צור ניתוח" onAction={handleRegenerate} />
    </div>);
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>🔍 חוזקות ותחומי הגדלה</h3>
        <button onClick={handleRegenerate} style={{ padding: "0.5rem 1rem", backgroundColor: "var(--accent)", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>
          רענן
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {weaknesses.map((weakness, idx) => {
          const severity = getSeverityColor(weakness?.severity);
          const isExpanded = expanded.has(idx);
          const title = weakness?.title || weakness?.area || `נקודה ${idx + 1}`;
          const suggestions = safeArray(weakness?.fixSuggestions);
          return (
            <div
              key={idx}
              style={{ padding: "1.25rem", backgroundColor: severity.bg, border: `1px solid ${severity.border}`, borderRadius: "0.5rem", cursor: "pointer" }}
              onClick={() => toggleExpand(idx)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--foreground)", margin: "0 0 0.5rem 0" }}>
                    {title}
                  </h4>
                  <span style={{ display: "inline-block", padding: "0.25rem 0.75rem", backgroundColor: severity.border, color: "white", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: 600 }}>
                    {severity.label}
                  </span>
                </div>
                <span style={{ fontSize: "1.25rem" }}>{isExpanded ? "▼" : "▶"}</span>
              </div>
              {isExpanded && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${severity.border}` }}>
                  {weakness?.description && (
                    <p style={{ fontSize: "0.875rem", color: "var(--foreground)", margin: "0 0 1rem 0" }}>
                      {weakness.description}
                    </p>
                  )}
                  {suggestions.length > 0 && (
                    <div style={{ marginBottom: "1rem" }}>
                      <h5 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                        הצעות לתיקון
                      </h5>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {suggestions.map((s, sidx) => (
                          <li key={sidx} style={{ fontSize: "0.8125rem", color: "var(--foreground)", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                            <span style={{ marginTop: "0.2rem", flexShrink: 0 }}>✓</span>
                            {safeString(s)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {weakness?.messagingImprovement && (
                    <div>
                      <h5 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>שיפור ההודעות</h5>
                      <p style={{ fontSize: "0.8125rem", color: "var(--foreground)", margin: 0 }}>{weakness.messagingImprovement}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// SECTION: CUSTOMER PROFILE
// ============================================================================

function CustomerProfileSection({ client, persisted, autoGenerate, onRegenerate }: { client: Client; persisted?: unknown; autoGenerate?: boolean; onRegenerate?: () => Promise<boolean> }) {
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [status, setStatus] = useState<SectionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegenerate = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      if (onRegenerate) {
        const ok = await onRegenerate();
        if (!ok) throw new Error('הייצור נכשל');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
      setStatus('error');
    }
  }, [onRegenerate]);

  useEffect(() => {
    if (persisted && Array.isArray(persisted) && persisted.length > 0) {
      setSegments(persisted as CustomerSegment[]);
      setStatus('ready');
      return;
    }
    if (status === 'loading') return;
    setStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted]);

  if (status === 'error') {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>👥 פרופיל לקוח</h3>
      <ErrorState message={errorMsg || 'שגיאה בייצור פרופיל'} onRetry={handleRegenerate} />
    </div>);
  }
  if (status === 'loading') {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>👥 פרופיל לקוח</h3>
      <LoadingSkeleton />
    </div>);
  }
  if ((status === 'idle' || status === 'empty') && segments.length === 0) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>👥 פרופיל לקוח</h3>
      <EmptyState message="יש ליצור חקר לקוח קודם, או ללחוץ לייצור ידני." actionLabel="צור פרופיל" onAction={handleRegenerate} />
    </div>);
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>👥 פרופיל לקוח</h3>
        <button onClick={handleRegenerate} style={{ padding: "0.5rem 1rem", backgroundColor: "var(--accent)", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>רענן</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        {segments.map((segment, idx) => {
          const color = segment?.color || '#6b7280';
          return (
            <div key={idx} style={{ padding: "1.5rem", backgroundColor: "var(--surface-raised)", border: `2px solid ${color}`, borderRadius: "0.5rem" }}>
              <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem", color: "var(--foreground)" }}>
                {segment?.name || `סגמנט ${idx + 1}`}
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {segment?.ageRange && (
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase" }}>גיל</span>
                    <p style={{ fontSize: "0.875rem", color: "var(--foreground)", margin: "0.25rem 0 0 0" }}>{segment.ageRange}</p>
                  </div>
                )}
                {safeArray(segment?.interests).length > 0 && (
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase" }}>תחומי עניין</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                      {safeArray(segment?.interests).map((interest, iidx) => (
                        <span key={iidx} style={{ display: "inline-block", padding: "0.25rem 0.75rem", backgroundColor: color, color: "white", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 500 }}>
                          {safeString(interest)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {safeArray(segment?.behaviors).length > 0 && (
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase" }}>התנהגויות</span>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0 0", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      {safeArray(segment?.behaviors).map((b, bidx) => (
                        <li key={bidx} style={{ fontSize: "0.8125rem", color: "var(--foreground)", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                          <span style={{ marginTop: "0.1rem" }}>•</span>{safeString(b)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {safeArray(segment?.painPoints).length > 0 && (
                  <div style={{ paddingTop: "0.75rem", borderTop: `1px solid ${color}` }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase" }}>נקודות כאב</span>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0 0", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      {safeArray(segment?.painPoints).map((p, pidx) => (
                        <li key={pidx} style={{ fontSize: "0.8125rem", color: "#ef4444", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                          <span style={{ marginTop: "0.1rem" }}>⚠️</span>{safeString(p)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// SECTION: TREND ENGINE
// ============================================================================

function TrendEngineSection({ client, persisted, autoGenerate, onRegenerate }: { client: Client; persisted?: unknown; autoGenerate?: boolean; onRegenerate?: () => Promise<boolean> }) {
  const [trends, setTrends] = useState<TrendSuggestion[]>([]);
  const [status, setStatus] = useState<SectionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegenerate = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      if (onRegenerate) {
        const ok = await onRegenerate();
        if (!ok) throw new Error('הייצור נכשל');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
      setStatus('error');
    }
  }, [onRegenerate]);

  useEffect(() => {
    if (persisted && Array.isArray(persisted) && persisted.length > 0) {
      setTrends(persisted as TrendSuggestion[]);
      setStatus('ready');
      return;
    }
    if (status === 'loading') return;
    setStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted]);

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) { case "high": return "#ef4444"; case "medium": return "#f59e0b"; case "low": return "#22c55e"; default: return "#6b7280"; }
  };
  const getUrgencyLabel = (urgency?: string) => {
    switch (urgency) { case "high": return "דחוף"; case "medium": return "בינוני"; case "low": return "נמוך"; default: return "—"; }
  };

  if (status === 'error') {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔥 מה חם השבוע</h3>
      <ErrorState message={errorMsg || 'שגיאה בייצור טרנדים'} onRetry={handleRegenerate} />
    </div>);
  }
  if (status === 'loading') {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔥 מה חם השבוע</h3>
      <LoadingSkeleton />
    </div>);
  }
  if ((status === 'idle' || status === 'empty') && trends.length === 0) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔥 מה חם השבוע</h3>
      <EmptyState message="יש ליצור חקר לקוח קודם, או ללחוץ לייצור ידני." actionLabel="צור ניתוח" onAction={handleRegenerate} />
    </div>);
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>🔥 מה חם השבוע</h3>
        <button onClick={handleRegenerate} style={{ padding: "0.5rem 1rem", backgroundColor: "var(--accent)", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>רענן</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {trends.map((trend, idx) => {
          const title = trend?.title || trend?.trendName || `טרנד ${idx + 1}`;
          const score = typeof trend?.relevanceScore === 'number' ? trend.relevanceScore : 0;
          // Score might be 0-1 or 0-100
          const pct = score > 1 ? score : Math.round(score * 100);
          return (
            <div key={idx} style={{ padding: "1.5rem", backgroundColor: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{title}</h4>
                <span style={{ display: "inline-block", padding: "0.25rem 0.75rem", backgroundColor: getUrgencyColor(trend?.urgency), color: "white", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: 600 }}>
                  {getUrgencyLabel(trend?.urgency)}
                </span>
              </div>
              <div style={{ marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)", textTransform: "uppercase" }}>ניקוד רלוונטיות</span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--accent)" }}>{pct}%</span>
                </div>
                <div style={{ width: "100%", height: "0.5rem", backgroundColor: "var(--border)", borderRadius: "0.25rem", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "var(--accent)", transition: "width 300ms ease" }} />
                </div>
              </div>
              {safeArray(trend?.contentIdeas).length > 0 && (
                <div>
                  <h5 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--foreground-muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>רעיונות תוכן</h5>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {safeArray(trend?.contentIdeas).map((idea, iidx) => (
                      <li key={iidx} style={{ fontSize: "0.8125rem", color: "var(--foreground)", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                        <span style={{ marginTop: "0.2rem", flexShrink: 0 }}>💡</span>
                        {safeString(idea)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// SECTION: COMPETITOR INSIGHTS
// ============================================================================

function CompetitorInsightsSection({ client, persisted, autoGenerate, onRegenerate }: { client: Client; persisted?: unknown; autoGenerate?: boolean; onRegenerate?: () => Promise<boolean> }) {
  const [insights, setInsights] = useState<CompetitorInsight | null>(null);
  const [status, setStatus] = useState<SectionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegenerate = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      if (onRegenerate) {
        const ok = await onRegenerate();
        if (!ok) throw new Error('הייצור נכשל');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
      setStatus('error');
    }
  }, [onRegenerate]);

  useEffect(() => {
    if (persisted && typeof persisted === 'object' && persisted !== null) {
      const p = persisted as CompetitorInsight;
      if (safeArray(p?.doMoreOf).length > 0 || safeArray(p?.avoid).length > 0 || safeArray(p?.opportunities).length > 0) {
        setInsights(p);
        setStatus('ready');
        return;
      }
    }
    if (status === 'loading') return;
    setStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted]);

  if (status === 'error') {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🎯 תובנות תחרותיות</h3>
      <ErrorState message={errorMsg || 'שגיאה בייצור ניתוח תחרותי'} onRetry={handleRegenerate} />
    </div>);
  }
  if (status === 'loading') {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🎯 תובנות תחרותיות</h3>
      <LoadingSkeleton />
    </div>);
  }
  if ((status === 'idle' || status === 'empty') && !insights) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🎯 תובנות תחרותיות</h3>
      <EmptyState message="יש ליצור חקר לקוח קודם, או ללחוץ לייצור ידני." actionLabel="צור ניתוח" onAction={handleRegenerate} />
    </div>);
  }

  const doMore = safeArray(insights?.doMoreOf);
  const avoid = safeArray(insights?.avoid);
  const opps = safeArray(insights?.opportunities);

  if (doMore.length === 0 && avoid.length === 0 && opps.length === 0) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🎯 תובנות תחרותיות</h3>
      <EmptyState message="יש ליצור חקר לקוח קודם, או ללחוץ לייצור ידני." actionLabel="צור ניתוח" onAction={handleRegenerate} />
    </div>);
  }

  const renderList = (items: string[], icon: string) => (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {items.map((item, idx) => (
        <li key={idx} style={{ fontSize: "0.875rem", color: "var(--foreground)", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
          <span style={{ marginTop: "0.2rem", flexShrink: 0 }}>{icon}</span>
          {safeString(item)}
        </li>
      ))}
    </ul>
  );

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>🎯 תובנות תחרותיות</h3>
        <button onClick={handleRegenerate} style={{ padding: "0.5rem 1rem", backgroundColor: "var(--accent)", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>רענן</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        {doMore.length > 0 && (
          <div style={{ padding: "1.5rem", backgroundColor: "rgba(34, 197, 94, 0.1)", border: "1px solid #22c55e", borderRadius: "0.5rem" }}>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#22c55e", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>✅ יותר מזה</h4>
            {renderList(doMore, "→")}
          </div>
        )}
        {avoid.length > 0 && (
          <div style={{ padding: "1.5rem", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: "0.5rem" }}>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#ef4444", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>❌ הימנע מזה</h4>
            {renderList(avoid, "⊘")}
          </div>
        )}
        {opps.length > 0 && (
          <div style={{ padding: "1.5rem", backgroundColor: "rgba(0, 181, 254, 0.1)", border: "1px solid var(--accent)", borderRadius: "0.5rem" }}>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--accent)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>💎 הזדמנויות</h4>
            {renderList(opps, "◆")}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// WEEKLY RECOMMENDATIONS (Fallback)
// ============================================================================

function WeeklyRecommendationsWidget({ client }: { client: Client }) {
  const fallbackRecommendations: Record<string, Array<{ emoji: string; title: string; description: string; format: string }>> = {
    marketing: [
      { emoji: "📚", title: "מדריך שימושי", description: "טיפים חדשים במקצוע שלך או בתחום העיסוק", format: "קרוסלה" },
      { emoji: "😊", title: "סיפור לקוח", description: "חוויה חיובית של לקוח או מקרה של הצלחה", format: "ריל או סטורי" },
      { emoji: "🎯", title: "הצעה מיוחדת", description: "קידוח או הצעה זמנית לעידוד קנייה", format: "ריל או אינפוגרפיקה" },
    ],
    branding: [
      { emoji: "🏆", title: "הישגי מותג", description: "פרויקט או הישג שמשקף את ערכי המותג", format: "ריל" },
      { emoji: "👥", title: "מאחורי הקלעים", description: "תהליך העבודה או צוות החברה", format: "סטורי או ריל" },
      { emoji: "💡", title: "טיפ מקצועי", description: "ידע או בחינה בתחום המומחיות", format: "קרוסלה או פוסט" },
    ],
  };

  const recommendations = fallbackRecommendations[client.clientType] || fallbackRecommendations.marketing;

  return (
    <div style={{ padding: "2rem", borderRadius: "0.75rem", background: "linear-gradient(135deg, var(--accent) 0%, rgba(0, 181, 254, 0.8) 100%)", color: "white" }}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem", color: "white", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        📅 מה כדאי לפרסם השבוע
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        {recommendations.map((rec, idx) => (
          <div key={idx} style={{ padding: "1rem", backgroundColor: "rgba(255, 255, 255, 0.1)", borderRadius: "0.5rem", backdropFilter: "blur(10px)" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{rec.emoji}</div>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0 0 0.25rem 0", color: "white" }}>{rec.title}</h4>
            <p style={{ fontSize: "0.8125rem", margin: "0 0 0.5rem 0", color: "rgba(255, 255, 255, 0.85)", lineHeight: "1.4" }}>{rec.description}</p>
            <span style={{ display: "inline-block", padding: "0.25rem 0.5rem", backgroundColor: "rgba(255, 255, 255, 0.2)", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: 600 }}>{rec.format}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.7)", margin: 0, fontStyle: "italic" }}>
        (מבוסס על ניתוח AI — מתעדכן אוטומטית)
      </p>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT — loads persisted insights, passes to sections
// ============================================================================

export default function TabInsights({ client, employees }: TabInsightsProps) {
  const [persistedInsights, setPersistedInsights] = useState<Record<string, unknown>>({});
  const [loadingPersisted, setLoadingPersisted] = useState(true);
  const [orchestrating, setOrchestrating] = useState(false);

  // Load persisted insights, then auto-orchestrate missing sections server-side
  useEffect(() => {
    let cancelled = false;
    const loadAndOrchestrate = async () => {
      try {
        console.log(`[Insights] Loading persisted insights for ${client.id}`);

        // Step 1: Load persisted insights
        const insightsRes = await fetch(`/api/ai/client-insights?clientId=${client.id}`);
        let map: Record<string, unknown> = {};
        if (insightsRes.ok) {
          const result = await insightsRes.json();
          if (!cancelled && result?.insights) {
            for (const [section, record] of Object.entries(result.insights)) {
              const r = record as { payload?: unknown; status?: string };
              if (r?.payload && r?.status === 'ready') {
                map[section] = r.payload;
              }
            }
            console.log(`[Insights] Loaded persisted sections: ${Object.keys(map).join(', ') || 'none'}`);
            setPersistedInsights(map);
          }
        }
        if (cancelled) return;
        setLoadingPersisted(false);

        // Step 2: Check which sections are missing
        const allSections = ['brand_weakness', 'customer_profile', 'trend_engine', 'competitor_insights', 'creative_dna'];
        const missing = allSections.filter(s => !map[s]);
        if (missing.length === 0) {
          console.log('[Insights] All sections already persisted — skipping orchestration');
          return;
        }

        // Step 3: Check if research exists first
        const researchRes = await fetch(`/api/ai/client-research?clientId=${client.id}`);
        if (cancelled) return;
        let hasResearch = false;
        if (researchRes.ok) {
          const researchData = await researchRes.json();
          hasResearch = !!(researchData?.data && researchData.data.status === 'complete');
        }

        if (!hasResearch) {
          console.log('[Insights] No complete research — skipping auto-orchestration');
          return;
        }

        // Step 4: Trigger server-side orchestration for missing sections only
        console.log(`[Insights] Auto-orchestrating missing sections: ${missing.join(', ')}`);
        if (!cancelled) setOrchestrating(true);

        const orchRes = await fetch('/api/ai/orchestrate-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: client.id,
            sections: missing,
          }),
        });

        if (cancelled) return;
        setOrchestrating(false);

        if (orchRes.ok) {
          // Reload persisted insights after orchestration
          const refreshRes = await fetch(`/api/ai/client-insights?clientId=${client.id}`);
          if (refreshRes.ok && !cancelled) {
            const refreshResult = await refreshRes.json();
            if (refreshResult?.insights) {
              const newMap: Record<string, unknown> = {};
              for (const [section, record] of Object.entries(refreshResult.insights)) {
                const r = record as { payload?: unknown; status?: string };
                if (r?.payload && r?.status === 'ready') {
                  newMap[section] = r.payload;
                }
              }
              console.log(`[Insights] Post-orchestration sections: ${Object.keys(newMap).join(', ')}`);
              setPersistedInsights(newMap);
            }
          }
        } else {
          console.warn('[Insights] Orchestration returned non-OK:', orchRes.status);
        }
      } catch (err) {
        console.warn('[Insights] Failed during load/orchestrate:', err);
        if (!cancelled) {
          setLoadingPersisted(false);
          setOrchestrating(false);
        }
      }
    };
    loadAndOrchestrate();
    return () => { cancelled = true; };
  }, [client.id]);

  // Handler for individual section regeneration — calls orchestrate for just that section
  const regenerateSection = useCallback(async (section: string) => {
    console.log(`[Insights] Manual regeneration: ${section}`);
    const res = await fetch('/api/ai/orchestrate-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: client.id,
        sections: [section],
        force: true,
      }),
    });
    if (res.ok) {
      // Reload just the persisted data
      const refreshRes = await fetch(`/api/ai/client-insights?clientId=${client.id}`);
      if (refreshRes.ok) {
        const result = await refreshRes.json();
        if (result?.insights) {
          const map: Record<string, unknown> = {};
          for (const [s, record] of Object.entries(result.insights)) {
            const r = record as { payload?: unknown; status?: string };
            if (r?.payload && r?.status === 'ready') {
              map[s] = r.payload;
            }
          }
          setPersistedInsights(map);
        }
      }
    }
    return res.ok;
  }, [client.id]);

  if (loadingPersisted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={sectionStyle}><LoadingSkeleton /></div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {orchestrating && (
        <div style={{
          padding: "1rem 1.5rem",
          backgroundColor: "rgba(0, 181, 254, 0.08)",
          border: "1px solid rgba(0, 181, 254, 0.2)",
          borderRadius: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}>
          <div style={{
            width: "1rem", height: "1rem", borderRadius: "50%",
            border: "2px solid var(--accent)", borderTopColor: "transparent",
            animation: "spin 1s linear infinite",
          }} />
          <span style={{ fontSize: "0.875rem", color: "var(--accent)" }}>
            מייצר תובנות AI... זה עלול לקחת כמה שניות
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <ClientBrainSection client={client} persisted={persistedInsights['client_brain']} />
      <BrandWeaknessSection client={client} persisted={persistedInsights['brand_weakness']} autoGenerate={false} onRegenerate={() => regenerateSection('brand_weakness')} />
      <CustomerProfileSection client={client} persisted={persistedInsights['customer_profile']} autoGenerate={false} onRegenerate={() => regenerateSection('customer_profile')} />
      <TrendEngineSection client={client} persisted={persistedInsights['trend_engine']} autoGenerate={false} onRegenerate={() => regenerateSection('trend_engine')} />
      <CompetitorInsightsSection client={client} persisted={persistedInsights['competitor_insights']} autoGenerate={false} onRegenerate={() => regenerateSection('competitor_insights')} />
      <WeeklyRecommendationsWidget client={client} />
    </div>
  );
}
