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
type TerminalStatus = 'idle' | 'ready' | 'error' | 'missing_prerequisites';

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

function BrandWeaknessSection({ client, persisted, onRegenerate, terminalStatus, errorMessage, isOrchestrating }: { client: Client; persisted?: unknown; onRegenerate?: () => Promise<boolean>; terminalStatus?: TerminalStatus; errorMessage?: string; isOrchestrating?: boolean }) {
  const [weaknesses, setWeaknesses] = useState<BrandWeakness[]>([]);
  const [localStatus, setLocalStatus] = useState<SectionStatus>('idle');
  const [localError, setLocalError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const handleRegenerate = useCallback(async () => {
    setLocalStatus('loading');
    setLocalError(null);
    try {
      if (onRegenerate) {
        const ok = await onRegenerate();
        if (!ok) throw new Error('הייצור נכשל');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
      setLocalStatus('error');
    }
  }, [onRegenerate]);

  useEffect(() => {
    if (persisted && Array.isArray(persisted) && persisted.length > 0) {
      setWeaknesses(persisted as BrandWeakness[]);
      setLocalStatus('ready');
      return;
    }
    if (localStatus === 'loading') return;
    setLocalStatus('idle');
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

  // Determine effective display status — parent orchestration state takes priority
  const displayError = localError || errorMessage;
  const isError = localStatus === 'error' || terminalStatus === 'error';
  const isLoading = localStatus === 'loading' || (isOrchestrating && !weaknesses.length && terminalStatus === 'idle');
  const isMissing = terminalStatus === 'missing_prerequisites' && weaknesses.length === 0;

  if (isError && weaknesses.length === 0) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔍 חוזקות ותחומי הגדלה</h3>
      <ErrorState message={displayError || 'שגיאה בייצור ניתוח'} onRetry={handleRegenerate} />
    </div>);
  }
  if (isLoading) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔍 חוזקות ותחומי הגדלה</h3>
      <LoadingSkeleton />
    </div>);
  }
  if (isMissing) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔍 חוזקות ותחומי הגדלה</h3>
      <EmptyState message="יש להשלים חקר לקוח לפני ייצור תובנות." actionLabel="צור ניתוח" onAction={handleRegenerate} />
    </div>);
  }
  if (weaknesses.length === 0) {
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

function CustomerProfileSection({ client, persisted, onRegenerate, terminalStatus, errorMessage, isOrchestrating }: { client: Client; persisted?: unknown; onRegenerate?: () => Promise<boolean>; terminalStatus?: TerminalStatus; errorMessage?: string; isOrchestrating?: boolean }) {
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [localStatus, setLocalStatus] = useState<SectionStatus>('idle');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleRegenerate = useCallback(async () => {
    setLocalStatus('loading');
    setLocalError(null);
    try {
      if (onRegenerate) {
        const ok = await onRegenerate();
        if (!ok) throw new Error('הייצור נכשל');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
      setLocalStatus('error');
    }
  }, [onRegenerate]);

  useEffect(() => {
    if (persisted && Array.isArray(persisted) && persisted.length > 0) {
      setSegments(persisted as CustomerSegment[]);
      setLocalStatus('ready');
      return;
    }
    if (localStatus === 'loading') return;
    setLocalStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted]);

  const displayError = localError || errorMessage;
  const isError = localStatus === 'error' || terminalStatus === 'error';
  const isLoading = localStatus === 'loading' || (isOrchestrating && !segments.length && terminalStatus === 'idle');
  const isMissing = terminalStatus === 'missing_prerequisites' && segments.length === 0;

  if (isError && segments.length === 0) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>👥 פרופיל לקוח</h3>
      <ErrorState message={displayError || 'שגיאה בייצור פרופיל'} onRetry={handleRegenerate} />
    </div>);
  }
  if (isLoading) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>👥 פרופיל לקוח</h3>
      <LoadingSkeleton />
    </div>);
  }
  if (isMissing) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>👥 פרופיל לקוח</h3>
      <EmptyState message="יש להשלים חקר לקוח לפני ייצור תובנות." actionLabel="צור פרופיל" onAction={handleRegenerate} />
    </div>);
  }
  if (segments.length === 0) {
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

function TrendEngineSection({ client, persisted, onRegenerate, terminalStatus, errorMessage, isOrchestrating }: { client: Client; persisted?: unknown; onRegenerate?: () => Promise<boolean>; terminalStatus?: TerminalStatus; errorMessage?: string; isOrchestrating?: boolean }) {
  const [trends, setTrends] = useState<TrendSuggestion[]>([]);
  const [localStatus, setLocalStatus] = useState<SectionStatus>('idle');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleRegenerate = useCallback(async () => {
    setLocalStatus('loading');
    setLocalError(null);
    try {
      if (onRegenerate) {
        const ok = await onRegenerate();
        if (!ok) throw new Error('הייצור נכשל');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
      setLocalStatus('error');
    }
  }, [onRegenerate]);

  useEffect(() => {
    if (persisted && Array.isArray(persisted) && persisted.length > 0) {
      setTrends(persisted as TrendSuggestion[]);
      setLocalStatus('ready');
      return;
    }
    if (localStatus === 'loading') return;
    setLocalStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted]);

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) { case "high": return "#ef4444"; case "medium": return "#f59e0b"; case "low": return "#22c55e"; default: return "#6b7280"; }
  };
  const getUrgencyLabel = (urgency?: string) => {
    switch (urgency) { case "high": return "דחוף"; case "medium": return "בינוני"; case "low": return "נמוך"; default: return "—"; }
  };

  const displayError = localError || errorMessage;
  const isError = localStatus === 'error' || terminalStatus === 'error';
  const isLoading = localStatus === 'loading' || (isOrchestrating && !trends.length && terminalStatus === 'idle');
  const isMissing = terminalStatus === 'missing_prerequisites' && trends.length === 0;

  if (isError && trends.length === 0) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔥 מה חם השבוע</h3>
      <ErrorState message={displayError || 'שגיאה בייצור טרנדים'} onRetry={handleRegenerate} />
    </div>);
  }
  if (isLoading) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔥 מה חם השבוע</h3>
      <LoadingSkeleton />
    </div>);
  }
  if (isMissing) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🔥 מה חם השבוע</h3>
      <EmptyState message="יש להשלים חקר לקוח לפני ייצור תובנות." actionLabel="צור ניתוח" onAction={handleRegenerate} />
    </div>);
  }
  if (trends.length === 0) {
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

function CompetitorInsightsSection({ client, persisted, onRegenerate, terminalStatus, errorMessage, isOrchestrating }: { client: Client; persisted?: unknown; onRegenerate?: () => Promise<boolean>; terminalStatus?: TerminalStatus; errorMessage?: string; isOrchestrating?: boolean }) {
  const [insights, setInsights] = useState<CompetitorInsight | null>(null);
  const [localStatus, setLocalStatus] = useState<SectionStatus>('idle');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleRegenerate = useCallback(async () => {
    setLocalStatus('loading');
    setLocalError(null);
    try {
      if (onRegenerate) {
        const ok = await onRegenerate();
        if (!ok) throw new Error('הייצור נכשל');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'שגיאה בלתי צפויה');
      setLocalStatus('error');
    }
  }, [onRegenerate]);

  useEffect(() => {
    if (persisted && typeof persisted === 'object' && persisted !== null) {
      const p = persisted as CompetitorInsight;
      if (safeArray(p?.doMoreOf).length > 0 || safeArray(p?.avoid).length > 0 || safeArray(p?.opportunities).length > 0) {
        setInsights(p);
        setLocalStatus('ready');
        return;
      }
    }
    if (localStatus === 'loading') return;
    setLocalStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted]);

  const displayError = localError || errorMessage;
  const isError = localStatus === 'error' || terminalStatus === 'error';
  const isLoading = localStatus === 'loading' || (isOrchestrating && !insights && terminalStatus === 'idle');
  const isMissing = terminalStatus === 'missing_prerequisites' && !insights;

  if (isError && !insights) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🎯 תובנות תחרותיות</h3>
      <ErrorState message={displayError || 'שגיאה בייצור ניתוח תחרותי'} onRetry={handleRegenerate} />
    </div>);
  }
  if (isLoading) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🎯 תובנות תחרותיות</h3>
      <LoadingSkeleton />
    </div>);
  }
  if (isMissing) {
    return (<div style={sectionStyle}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.5rem" }}>🎯 תובנות תחרותיות</h3>
      <EmptyState message="יש להשלים חקר לקוח לפני ייצור תובנות." actionLabel="צור ניתוח" onAction={handleRegenerate} />
    </div>);
  }
  if (!insights) {
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

const CLIENT_TYPE_DISPLAY: Record<string, string> = {
  marketing: "פרסום ושיווק",
  branding: "מיתוג",
  websites: "בניית אתרים",
  hosting: "אחסון",
  podcast: "פודקאסט",
};

function WeeklyRecommendationsWidget({ client }: { client: Client }) {
  // Multiple recommendation pools per client type — rotate based on week number for variety
  const allRecommendations: Record<string, Array<Array<{ emoji: string; title: string; description: string; format: string }>>> = {
    marketing: [
      [
        { emoji: "📚", title: "מדריך שימושי", description: "טיפים חדשים במקצוע שלך או בתחום העיסוק", format: "קרוסלה" },
        { emoji: "😊", title: "סיפור לקוח", description: "חוויה חיובית של לקוח או מקרה של הצלחה", format: "ריל או סטורי" },
        { emoji: "🎯", title: "הצעה מיוחדת", description: "קידום או הצעה זמנית לעידוד קנייה", format: "ריל או אינפוגרפיקה" },
      ],
      [
        { emoji: "🔥", title: "טרנד חם בתעשייה", description: "הגיבו על שינוי או חדשות בתחום שלכם", format: "ריל" },
        { emoji: "📊", title: "נתון מפתיע", description: "שתפו סטטיסטיקה מעניינת שקשורה לקהל היעד", format: "אינפוגרפיקה" },
        { emoji: "💬", title: "Q&A עם הקהל", description: "ענו על 3 שאלות נפוצות שמקבלים מלקוחות", format: "סטורי אינטראקטיבי" },
      ],
      [
        { emoji: "🎬", title: "מאחורי הקלעים", description: "הראו את תהליך העבודה האמיתי — לקוחות אוהבים שקיפות", format: "ריל" },
        { emoji: "⭐", title: "ביקורת לקוח", description: "שתפו המלצה או תוצאה מרשימה של לקוח", format: "פוסט + סטורי" },
        { emoji: "📱", title: "טיפ מהיר ב-15 שניות", description: "טיפ אחד ממוקד בפורמט קצר שמקבל הרבה שיתופים", format: "ריל קצר" },
      ],
    ],
    branding: [
      [
        { emoji: "🏆", title: "הישגי מותג", description: "פרויקט או הישג שמשקף את ערכי המותג", format: "ריל" },
        { emoji: "👥", title: "מאחורי הקלעים", description: "תהליך העבודה או צוות החברה", format: "סטורי או ריל" },
        { emoji: "💡", title: "טיפ מקצועי", description: "ידע או בחינה בתחום המומחיות", format: "קרוסלה או פוסט" },
      ],
      [
        { emoji: "🎨", title: "תהליך עיצוב", description: "הראו שלבים בפרויקט עיצוב — from concept to final", format: "קרוסלה" },
        { emoji: "📐", title: "לפני ואחרי", description: "השוואת מותג לפני ואחרי עבודת המיתוג", format: "ריל" },
        { emoji: "🗣️", title: "ערכי המותג", description: "ספרו על העקרונות שמנחים את העבודה שלכם", format: "פוסט + סטורי" },
      ],
    ],
    websites: [
      [
        { emoji: "💻", title: "לפני ואחרי אתר", description: "הראו שדרוג אתר דרמטי — מרשים ומושך תשומת לב", format: "ריל" },
        { emoji: "🔍", title: "טיפ SEO", description: "שתפו טיפ קצר לשיפור דירוג בגוגל", format: "קרוסלה" },
        { emoji: "📱", title: "UX Tip", description: "טיפ לשיפור חוויית משתמש באתר", format: "ריל קצר" },
      ],
      [
        { emoji: "🚀", title: "מהירות אתר", description: "הסבירו למה מהירות טעינה משפיעה על מכירות", format: "אינפוגרפיקה" },
        { emoji: "🛒", title: "המרות בדף נחיתה", description: "3 טעויות נפוצות בדפי נחיתה ואיך לתקן", format: "קרוסלה" },
        { emoji: "✨", title: "פרויקט חדש", description: "הציגו אתר שהושק לאחרונה עם תוצאות", format: "ריל + פוסט" },
      ],
    ],
    hosting: [
      [
        { emoji: "🔒", title: "אבטחת אתרים", description: "טיפ לשמירה על אבטחת האתר והנתונים", format: "פוסט" },
        { emoji: "⚡", title: "ביצועי שרת", description: "הסבירו איך אחסון איכותי משפר את האתר", format: "אינפוגרפיקה" },
        { emoji: "📊", title: "סטטיסטיקות uptime", description: "שתפו נתוני זמינות ואמינות השירות", format: "פוסט" },
      ],
    ],
    podcast: [
      [
        { emoji: "🎙️", title: "קטע מהפרק האחרון", description: "קליפ קצר ומעניין מתוך הפרק שיצא", format: "ריל" },
        { emoji: "📢", title: "טיזר לפרק הבא", description: "רמזו על הנושא או האורח בפרק הקרוב", format: "סטורי" },
        { emoji: "💭", title: "ציטוט מהפרק", description: "ציטוט חזק מאורח או מהמגיש בעיצוב מותג", format: "פוסט" },
      ],
      [
        { emoji: "🎧", title: "מאחורי המיקרופון", description: "הראו את תהליך ההקלטה והעריכה", format: "סטורי" },
        { emoji: "📋", title: "סיכום פרק ב-60 שניות", description: "תקציר ויזואלי של עיקרי הפרק", format: "ריל" },
        { emoji: "❓", title: "שאלו את הקהל", description: "בקשו שאלות לפרק הבא — מגביר engagement", format: "סטורי אינטראקטיבי" },
      ],
    ],
  };

  // Rotate based on client ID hash + week number for variety per client
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const clientHash = client.id.split('').reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0);
  const pool = allRecommendations[client.clientType] || allRecommendations.marketing;
  const poolIndex = Math.abs(clientHash + weekNumber) % pool.length;
  const recommendations = pool[poolIndex];

  // Build context-aware subtitle using client's actual data
  const businessContext = client.businessField
    ? `מותאם ל${client.name} — ${client.businessField}`
    : `מותאם ל${client.name}`;

  const ctLabel = CLIENT_TYPE_DISPLAY[client.clientType] || "פרסום ושיווק";

  return (
    <div style={{ padding: "2rem", borderRadius: "0.75rem", background: "linear-gradient(135deg, var(--accent) 0%, rgba(0, 181, 254, 0.8) 100%)", color: "white" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "white", display: "flex", alignItems: "center", gap: "0.75rem", margin: 0 }}>
          📅 מה כדאי לפרסם השבוע
        </h3>
        <span style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "999px", fontWeight: 600 }}>
          {ctLabel}
        </span>
      </div>
      <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.75)", margin: "0.25rem 0 1.25rem 0" }}>
        {businessContext}
      </p>
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
        מתעדכן אוטומטית בהתאם לסוג הלקוח ותחום העיסוק
      </p>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT — loads persisted insights, passes to sections
// ============================================================================

// ============================================================================
// HELPER: Fetch persisted insights from DB
// ============================================================================

async function loadPersistedMap(clientId: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`/api/ai/client-insights?clientId=${clientId}`);
    if (!res.ok) return {};
    const result = await res.json();
    const map: Record<string, unknown> = {};
    if (result?.insights) {
      for (const [section, record] of Object.entries(result.insights)) {
        const r = record as { payload?: unknown; status?: string };
        if (r?.payload && r?.status === 'ready') {
          map[section] = r.payload;
        }
      }
    }
    return map;
  } catch {
    return {};
  }
}

// ============================================================================
// SECTION STATUS MODEL — every section MUST reach one of these terminal states
// ============================================================================
// 'idle'                → no data, no attempt yet
// 'loading'             → generation in progress (NOT terminal)
// 'ready'               → data available
// 'error'               → generation failed, retry possible
// 'missing_prerequisites' → cannot generate (no research, etc.)
// (TerminalStatus type defined near top of file with SectionStatus)

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TabInsights({ client, employees }: TabInsightsProps) {
  const [persistedInsights, setPersistedInsights] = useState<Record<string, unknown>>({});
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [loadingPersisted, setLoadingPersisted] = useState(true);
  const [orchestrating, setOrchestrating] = useState(false);
  const [hasResearch, setHasResearch] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // ── PHASE 1: Load persisted data + check research ──
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      console.log(`[Insights] Init for ${client.id}`);
      let map: Record<string, unknown> = {};

      try {
        map = await loadPersistedMap(client.id);
        if (!cancelled) {
          console.log(`[Insights] Persisted sections: ${Object.keys(map).join(', ') || 'none'}`);
          setPersistedInsights(map);
        }
      } catch { /* already handled */ }

      // Check research
      let research = false;
      try {
        const researchRes = await fetch(`/api/ai/client-research?clientId=${client.id}`);
        if (researchRes.ok) {
          const rd = await researchRes.json();
          research = !!(rd?.data && rd.data.status === 'complete');
        }
      } catch { /* research check failed — not fatal */ }

      if (!cancelled) {
        setHasResearch(research);
        setLoadingPersisted(false);
        setInitialLoadDone(true);
        console.log(`[Insights] Init complete. research=${research}, persisted=${Object.keys(map).length}`);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [client.id]);

  // ── PHASE 2: Auto-orchestrate missing sections (only runs once after init) ──
  useEffect(() => {
    if (!initialLoadDone || !hasResearch) return;

    const allSections = ['brand_weakness', 'customer_profile', 'trend_engine', 'competitor_insights', 'creative_dna'];
    const missing = allSections.filter(s => !persistedInsights[s]);
    if (missing.length === 0) {
      console.log('[Insights] All sections already persisted');
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const orchestrate = async () => {
      console.log(`[Insights] Orchestrating missing: ${missing.join(', ')}`);
      setOrchestrating(true);

      // Safety timeout — ALWAYS exit loading after 90s
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          console.warn('[Insights] Orchestration timeout (90s)');
          setOrchestrating(false);
          const errors: Record<string, string> = {};
          for (const s of missing) { errors[s] = 'הזמן הקצוב לייצור חלף. נסו שוב.'; }
          setSectionErrors(prev => ({ ...prev, ...errors }));
        }
      }, 90_000);

      try {
        const res = await fetch('/api/ai/orchestrate-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: client.id, sections: missing }),
        });

        if (cancelled) return;
        clearTimeout(timeoutId);

        if (res.ok) {
          const orchResult = await res.json();
          // Check per-section results for errors
          if (orchResult?.results) {
            const errors: Record<string, string> = {};
            for (const [sec, result] of Object.entries(orchResult.results)) {
              const r = result as { status: string; error?: string };
              if (r.status === 'error') {
                errors[sec] = r.error || 'ייצור נכשל';
              }
            }
            if (Object.keys(errors).length > 0) {
              setSectionErrors(prev => ({ ...prev, ...errors }));
            }
          }

          // Reload persisted data
          const newMap = await loadPersistedMap(client.id);
          if (!cancelled) setPersistedInsights(newMap);
        } else {
          console.warn(`[Insights] Orchestration failed: ${res.status}`);
          const errors: Record<string, string> = {};
          for (const s of missing) { errors[s] = 'שגיאה בייצור תובנות. נסו שוב מאוחר יותר.'; }
          if (!cancelled) setSectionErrors(prev => ({ ...prev, ...errors }));
        }
      } catch (err) {
        console.error('[Insights] Orchestration error:', err);
        if (!cancelled) {
          const errors: Record<string, string> = {};
          for (const s of missing) { errors[s] = 'שגיאת רשת. נסו שוב.'; }
          setSectionErrors(prev => ({ ...prev, ...errors }));
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setOrchestrating(false);
      }
    };

    orchestrate();
    return () => { cancelled = true; clearTimeout(timeoutId); };
    // Only run once after initial load — do NOT re-run when persistedInsights changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoadDone, hasResearch, client.id]);

  // ── Handler for manual section regeneration ──
  const regenerateSection = useCallback(async (section: string): Promise<boolean> => {
    console.log(`[Insights] Manual regen: ${section}`);
    // Clear any previous error for this section
    setSectionErrors(prev => { const n = { ...prev }; delete n[section]; return n; });

    try {
      const res = await fetch('/api/ai/orchestrate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, sections: [section], force: true }),
      });

      if (res.ok) {
        const orchResult = await res.json();
        if (orchResult?.results?.[section]?.status === 'error') {
          setSectionErrors(prev => ({ ...prev, [section]: orchResult.results[section].error || 'ייצור נכשל' }));
          return false;
        }
        const newMap = await loadPersistedMap(client.id);
        setPersistedInsights(newMap);
        return true;
      }
      setSectionErrors(prev => ({ ...prev, [section]: 'שגיאה בייצור. נסו שוב.' }));
      return false;
    } catch {
      setSectionErrors(prev => ({ ...prev, [section]: 'שגיאת רשת. נסו שוב.' }));
      return false;
    }
  }, [client.id]);

  // ── Determine each section's terminal status ──
  const getSectionTerminalStatus = (section: string): TerminalStatus => {
    if (persistedInsights[section]) return 'ready';
    if (sectionErrors[section]) return 'error';
    if (!hasResearch && !orchestrating) return 'missing_prerequisites';
    return 'idle';
  };

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
            מייצר תובנות AI... זה עלול לקחת עד דקה
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <ClientBrainSection client={client} persisted={persistedInsights['client_brain']} />
      <BrandWeaknessSection
        client={client}
        persisted={persistedInsights['brand_weakness']}
        onRegenerate={() => regenerateSection('brand_weakness')}
        terminalStatus={getSectionTerminalStatus('brand_weakness')}
        errorMessage={sectionErrors['brand_weakness']}
        isOrchestrating={orchestrating}
      />
      <CustomerProfileSection
        client={client}
        persisted={persistedInsights['customer_profile']}
        onRegenerate={() => regenerateSection('customer_profile')}
        terminalStatus={getSectionTerminalStatus('customer_profile')}
        errorMessage={sectionErrors['customer_profile']}
        isOrchestrating={orchestrating}
      />
      <TrendEngineSection
        client={client}
        persisted={persistedInsights['trend_engine']}
        onRegenerate={() => regenerateSection('trend_engine')}
        terminalStatus={getSectionTerminalStatus('trend_engine')}
        errorMessage={sectionErrors['trend_engine']}
        isOrchestrating={orchestrating}
      />
      <CompetitorInsightsSection
        client={client}
        persisted={persistedInsights['competitor_insights']}
        onRegenerate={() => regenerateSection('competitor_insights')}
        terminalStatus={getSectionTerminalStatus('competitor_insights')}
        errorMessage={sectionErrors['competitor_insights']}
        isOrchestrating={orchestrating}
      />
      <WeeklyRecommendationsWidget client={client} />
    </div>
  );
}
