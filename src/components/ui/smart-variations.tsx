"use client";

import { useState, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   SmartVariations — AI-powered campaign angle variations
   Premium card-based UI for selecting and applying campaign variations
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CampaignVariation {
  id: string;
  angle: string;
  angleLabel: string;
  primaryText: string;
  headline: string;
  cta: string;
  explanation: string;
}

interface SmartVariationsProps {
  campaignId: string;
  primaryText: string;
  headline: string;
  objective: string;
  campaignType: string;
  platform: string;
  clientName: string;
  clientId: string;
  audience?: string;
  onApply: (variation: CampaignVariation) => void;
  onCreateNew: (variation: CampaignVariation) => void;
  onClose: () => void;
}

const ANGLE_STYLES: Record<string, { icon: string; gradient: string; color: string; border: string }> = {
  emotional: {
    icon: "💜",
    gradient: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(236,72,153,0.08))",
    color: "#a855f7",
    border: "rgba(168,85,247,0.25)",
  },
  urgency: {
    icon: "⚡",
    gradient: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(249,115,22,0.08))",
    color: "#ef4444",
    border: "rgba(239,68,68,0.25)",
  },
  pain: {
    icon: "🎯",
    gradient: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.08))",
    color: "#f59e0b",
    border: "rgba(245,158,11,0.25)",
  },
  value: {
    icon: "📊",
    gradient: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(34,197,94,0.08))",
    color: "#10b981",
    border: "rgba(16,185,129,0.25)",
  },
  story: {
    icon: "📖",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.08))",
    color: "#3b82f6",
    border: "rgba(59,130,246,0.25)",
  },
};

function getAngleStyle(angle: string) {
  return ANGLE_STYLES[angle] || ANGLE_STYLES.value;
}

export function SmartVariationsPanel({
  campaignId,
  primaryText,
  headline,
  objective,
  campaignType,
  platform,
  clientName,
  clientId,
  audience,
  onApply,
  onCreateNew,
  onClose,
}: SmartVariationsProps) {
  const [variations, setVariations] = useState<CampaignVariation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const generateVariations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/campaign-variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          primaryText,
          headline,
          objective,
          campaignType,
          platform,
          clientName,
          clientId,
          audience,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `שגיאה ${res.status}`);
      }

      const data = await res.json();
      setVariations(data.variations || []);
      setGenerated(true);
      if (data.variations?.length > 0) {
        setSelectedId(data.variations[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת וריאציות");
    } finally {
      setLoading(false);
    }
  }, [campaignId, primaryText, headline, objective, campaignType, platform, clientName, clientId, audience]);

  const selectedVariation = variations.find((v) => v.id === selectedId) || null;

  return (
    <div
      style={{
        direction: "rtl",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        maxWidth: "900px",
        width: "100%",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "1.25rem" }}>🧬</span>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "var(--foreground)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              וריאציות חכמות
            </h2>
            <span className="ux-ai-label" style={{ fontSize: "0.6rem" }}>AI</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", margin: 0 }}>
            AI מייצר גרסאות מזוויות שונות — רגשי, דחיפות, כאב, ערך, סיפור
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--foreground-muted)",
            fontSize: "1.5rem",
            padding: "0.25rem",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Generate Button — shown before generation */}
      {!generated && !loading && (
        <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--foreground-muted)",
              marginBottom: "1.25rem",
              lineHeight: 1.6,
            }}
          >
            AI ינתח את הקמפיין שלך וייצור 4 גרסאות מזוויות שיווקיות שונות.
            <br />
            כל גרסה כוללת טקסט, כותרת, CTA, והסבר למה הזווית יכולה לעבוד.
          </p>
          <button
            onClick={generateVariations}
            className="mod-btn-primary ux-btn ux-btn-glow"
            style={{
              padding: "0.75rem 2rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "0.5rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>🧬</span>
            צור וריאציות חכמות
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <div className="ux-ai-thinking-dots" style={{ marginBottom: "1rem" }}>
            <span /><span /><span />
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", fontWeight: 600 }}>
            AI מנתח את הקמפיין ומייצר זוויות חדשות...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          style={{
            padding: "1rem",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>⚠️</span>
          <span style={{ fontSize: "0.85rem", color: "#ef4444" }}>{error}</span>
          <button
            onClick={generateVariations}
            style={{
              marginInlineStart: "auto",
              background: "none",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "0.375rem",
              color: "#ef4444",
              padding: "0.375rem 0.75rem",
              fontSize: "0.75rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            נסה שוב
          </button>
        </div>
      )}

      {/* Variations Cards */}
      {generated && variations.length > 0 && (
        <>
          <div
            className="ux-stagger"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
              gap: "1rem",
            }}
          >
            {variations.map((v) => {
              const style = getAngleStyle(v.angle);
              const isSelected = v.id === selectedId;

              return (
                <div
                  key={v.id}
                  className={`ux-card ux-stagger-item ${isSelected ? "ux-card-glow" : ""}`}
                  onClick={() => setSelectedId(v.id)}
                  style={{
                    padding: "1.25rem",
                    borderRadius: "0.75rem",
                    background: isSelected ? style.gradient : "var(--surface-raised)",
                    border: `2px solid ${isSelected ? style.color : "var(--border)"}`,
                    cursor: "pointer",
                    transition: "all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transform: isSelected ? "scale(1.02)" : "scale(1)",
                    boxShadow: isSelected
                      ? `0 4px 24px ${style.color}20, 0 0 0 1px ${style.color}30`
                      : "none",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Selected indicator */}
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        top: "0.75rem",
                        insetInlineEnd: "0.75rem",
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: style.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        color: "#fff",
                        fontWeight: 800,
                      }}
                    >
                      ✓
                    </div>
                  )}

                  {/* Angle badge */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "0.3rem",
                      background: `${style.color}15`,
                      border: `1px solid ${style.border}`,
                      marginBottom: "0.75rem",
                    }}
                  >
                    <span style={{ fontSize: "0.85rem" }}>{style.icon}</span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: style.color,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {v.angleLabel}
                    </span>
                  </div>

                  {/* Headline */}
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: "var(--foreground)",
                      marginBottom: "0.5rem",
                      lineHeight: 1.4,
                    }}
                  >
                    {v.headline}
                  </div>

                  {/* Primary Text */}
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--foreground)",
                      lineHeight: 1.6,
                      marginBottom: "0.75rem",
                      opacity: 0.85,
                      display: "-webkit-box",
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {v.primaryText}
                  </div>

                  {/* CTA */}
                  <div
                    style={{
                      display: "inline-block",
                      padding: "0.3rem 0.75rem",
                      borderRadius: "0.3rem",
                      background: `${style.color}12`,
                      border: `1px solid ${style.border}`,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: style.color,
                      marginBottom: "0.75rem",
                    }}
                  >
                    CTA: {v.cta}
                  </div>

                  {/* Explanation */}
                  <div
                    style={{
                      padding: "0.625rem 0.75rem",
                      background: "rgba(0,181,254,0.05)",
                      border: "1px solid rgba(0,181,254,0.1)",
                      borderRadius: "0.375rem",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.375rem",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", flexShrink: 0, marginTop: "0.05rem" }}>💡</span>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--foreground-muted)",
                        lineHeight: 1.5,
                        fontStyle: "italic",
                      }}
                    >
                      {v.explanation}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          {selectedVariation && (
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "center",
                paddingTop: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => onApply(selectedVariation)}
                className="mod-btn-primary ux-btn ux-btn-glow"
                style={{
                  padding: "0.75rem 1.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>✨</span>
                החל על הקמפיין
              </button>
              <button
                onClick={() => onCreateNew(selectedVariation)}
                className="mod-btn-ghost ux-btn"
                style={{
                  padding: "0.75rem 1.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>🚀</span>
                צור קמפיין חדש מהווריאציה
              </button>
              <button
                onClick={generateVariations}
                className="mod-btn-ghost ux-btn"
                style={{
                  padding: "0.75rem 1.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  opacity: 0.7,
                }}
              >
                <span>🔄</span>
                יצירה מחדש
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty after generation */}
      {generated && variations.length === 0 && !loading && !error && (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🤷</div>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
            לא הצלחנו ליצור וריאציות. נסה להוסיף עוד מידע לקמפיין ולנסות שוב.
          </p>
          <button
            onClick={generateVariations}
            className="mod-btn-ghost ux-btn"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              borderRadius: "0.375rem",
              cursor: "pointer",
              marginTop: "0.75rem",
            }}
          >
            נסה שוב
          </button>
        </div>
      )}
    </div>
  );
}
