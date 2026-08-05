"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  generatePremiumReport,
  type PremiumSeoReport,
  type PremiumReportBlock,
  type PremiumReportSection,
} from "@/lib/seo/premium-report-engine";

// ══════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════════════

const C = {
  primary: "#00B5FE",
  primaryDark: "#0095D0",
  primaryLight: "#E6F7FF",
  accent: "#F0FF02",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  text: "#1A1A2E",
  textSecondary: "#5A5A7A",
  textMuted: "#9A9AB0",
  border: "#E8EAF0",
  borderLight: "#F0F2F5",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
};

const SEVERITY_MAP: Record<
  string,
  { bg: string; border: string; color: string; icon: string; label: string; labelEn: string }
> = {
  critical: { bg: "#FEE2E2", border: "#FECACA", color: "#991B1B", icon: "⛔", label: "קריטי", labelEn: "Critical" },
  warning: { bg: "#FEF3C7", border: "#FDE68A", color: "#92400E", icon: "⚠️", label: "אזהרה", labelEn: "Warning" },
  info: { bg: "#DBEAFE", border: "#BFDBFE", color: "#1E40AF", icon: "ℹ️", label: "מידע", labelEn: "Info" },
  success: { bg: "#D1FAE5", border: "#A7F3D0", color: "#065F46", icon: "✅", label: "תקין", labelEn: "Success" },
};

const PRIORITY_MAP: Record<string, { bg: string; color: string; label: string; labelEn: string }> = {
  critical: { bg: "#FEE2E2", color: "#991B1B", label: "קריטי", labelEn: "Critical" },
  high: { bg: "#FEF3C7", color: "#92400E", label: "גבוה", labelEn: "High" },
  medium: { bg: "#DBEAFE", color: "#1E40AF", label: "בינוני", labelEn: "Medium" },
  low: { bg: "#E5E7EB", color: "#374151", label: "נמוך", labelEn: "Low" },
};

const SECTION_ICONS: Record<string, string> = {
  cover: "📋",
  executive_summary: "📊",
  market_context: "🌐",
  pixel_seo_score: "🎯",
  pixel_geo_score: "🤖",
  engine_snapshot: "⚙️",
  language_segmentation: "🌍",
  branded_analysis: "🏷️",
  topic_clusters: "🗂️",
  competitor_authority: "🏆",
  technical_audit: "🔧",
  structured_data: "🧩",
  seo_organic: "🔍",
  content_gaps: "💡",
  citation_quality: "📝",
  brand_accuracy: "🎯",
  action_plan: "🚀",
  success_metrics: "📈",
  methodology: "🔬",
  appendices: "📎",
};

const MODE_SECTIONS: Record<string, string[]> = {
  full: [],
  executive: ["cover", "executive_summary", "pixel_seo_score", "pixel_geo_score", "action_plan", "success_metrics"],
  technical: ["cover", "technical_audit", "structured_data", "seo_organic", "methodology"],
  client: [
    "cover", "executive_summary", "pixel_seo_score", "pixel_geo_score",
    "engine_snapshot", "action_plan", "success_metrics",
  ],
};

// ══════════════════════════════════════════════════════════════
// SHARED STYLES
// ══════════════════════════════════════════════════════════════

const cardStyle: React.CSSProperties = {
  background: C.card,
  borderRadius: 20,
  border: `1px solid ${C.border}`,
  padding: 32,
  boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
};

const actionBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 20px",
  borderRadius: 12,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 14px",
  borderRadius: 100,
  fontSize: 12,
  fontWeight: 600,
  background: "rgba(255,255,255,0.15)",
  backdropFilter: "blur(8px)",
};

// ══════════════════════════════════════════════════════════════
// SCORE GAUGE SVG
// ══════════════════════════════════════════════════════════════

function ScoreGauge({
  score,
  maxScore,
  label,
  color,
  previousScore,
  size = 140,
}: {
  score: number;
  maxScore: number;
  label: string;
  color: string;
  previousScore?: number;
  size?: number;
}) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / maxScore) * circumference;
  const rotation = -90;
  const delta = previousScore != null ? score - previousScore : null;

  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={C.border}
          strokeWidth={10}
          opacity={0.5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size / 3.5}
          fontWeight={800}
          fill={color}
        >
          {score}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 20}
          textAnchor="middle"
          fontSize={11}
          fill={C.textMuted}
        >
          / {maxScore}
        </text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginTop: 4 }}>
        {label}
      </div>
      {delta != null && delta !== 0 && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: delta > 0 ? C.success : C.danger,
            marginTop: 2,
          }}
        >
          {delta > 0 ? `+${delta}` : delta} {delta > 0 ? "↑" : "↓"}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MINI GAUGE (for engine cards)
// ══════════════════════════════════════════════════════════════

function MiniGauge({ value, color, size = 48 }: { value: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={4} opacity={0.4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size / 3.8}
        fontWeight={800}
        fill={color}
      >
        {value}%
      </text>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════
// CONFIDENCE BADGE
// ══════════════════════════════════════════════════════════════

function ConfidenceBadge({ level, he }: { level: "high" | "medium" | "low"; he: boolean }) {
  const map = {
    high: { bg: "#D1FAE5", color: "#065F46", label: he ? "גבוהה" : "High" },
    medium: { bg: "#FEF3C7", color: "#92400E", label: he ? "בינונית" : "Medium" },
    low: { bg: "#FEE2E2", color: "#991B1B", label: he ? "נמוכה" : "Low" },
  };
  const c = map[level];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
      }}
    >
      {c.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
// PREMIUM BLOCK RENDERER
// ══════════════════════════════════════════════════════════════

function RenderPremiumBlock({ block, he }: { block: PremiumReportBlock; he: boolean }) {
  switch (block.type) {
    // ── Paragraph ────────────────────────────────────────────
    case "paragraph":
      return (
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.9,
            color: C.textSecondary,
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {block.text}
        </p>
      );

    // ── Heading ──────────────────────────────────────────────
    case "heading": {
      const level = block.level || 3;
      const sizes: Record<number, number> = { 2: 20, 3: 16, 4: 14 };
      return (
        <div
          style={{
            fontSize: sizes[level] || 16,
            fontWeight: 700,
            color: C.text,
            margin: level === 2 ? "16px 0 8px" : "12px 0 4px",
            borderBottom: level === 2 ? `2px solid ${C.primaryLight}` : undefined,
            paddingBottom: level === 2 ? 8 : undefined,
          }}
        >
          {block.text}
        </div>
      );
    }

    // ── Stat ─────────────────────────────────────────────────
    case "stat":
      return (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "18px 28px",
            borderRadius: 16,
            background: `${block.color}0A`,
            border: `1px solid ${block.color}20`,
          }}
        >
          {block.icon && <span style={{ fontSize: 26 }}>{block.icon}</span>}
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>{block.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: block.color }}>{block.value}</span>
              {block.change && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: block.change.startsWith("+") ? C.success : block.change.startsWith("-") ? C.danger : C.textMuted,
                  }}
                >
                  {block.change}
                </span>
              )}
            </div>
          </div>
          {block.confidence && (
            <div style={{ marginRight: "auto" }}>
              <ConfidenceBadge level={block.confidence} he={he} />
            </div>
          )}
        </div>
      );

    // ── Stat Row ─────────────────────────────────────────────
    case "stat_row":
      return (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {block.stats.map((s, i) => (
            <div
              key={i}
              style={{
                flex: "1 1 140px",
                padding: "18px 20px",
                borderRadius: 16,
                background: `${s.color}08`,
                border: `1px solid ${s.color}18`,
                textAlign: "center",
                transition: "transform 0.2s",
              }}
            >
              {s.icon && <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>}
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
              {s.change && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    marginTop: 2,
                    color: s.change.startsWith("+") ? C.success : s.change.startsWith("-") ? C.danger : C.textMuted,
                  }}
                >
                  {s.change}
                </div>
              )}
            </div>
          ))}
        </div>
      );

    // ── Score Gauge ──────────────────────────────────────────
    case "score_gauge":
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <ScoreGauge
            score={block.score}
            maxScore={block.maxScore}
            label={block.label}
            color={block.color}
            previousScore={block.previousScore}
            size={160}
          />
          {block.subScores && block.subScores.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "center",
                marginTop: 8,
                width: "100%",
              }}
            >
              {block.subScores.map((sub, i) => {
                const pct = block.maxScore > 0 ? Math.round((sub.score / block.maxScore) * 100) : 0;
                return (
                  <div
                    key={i}
                    style={{
                      flex: "1 1 120px",
                      maxWidth: 180,
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>
                      {sub.label} ({Math.round(sub.weight * 100)}%)
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: block.color }}>{sub.score}</div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 2,
                        background: C.borderLight,
                        marginTop: 6,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 2,
                          width: `${pct}%`,
                          background: block.color,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );

    // ── Table ────────────────────────────────────────────────
    case "table":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {block.caption && (
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>
              {block.caption}
            </div>
          )}
          <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${C.border}` }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: C.bg }}>
                  {block.headers.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "12px 14px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: C.textSecondary,
                        fontSize: 12,
                        borderBottom: `2px solid ${C.border}`,
                        whiteSpace: "nowrap",
                        position: "sticky",
                        top: 0,
                        background: C.bg,
                        zIndex: 1,
                      }}
                    >
                      {h}
                      {block.sortable && (
                        <span style={{ opacity: 0.3, marginRight: 4, fontSize: 10 }}>{"▲▼"}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    style={{
                      borderBottom: ri < block.rows.length - 1 ? `1px solid ${C.borderLight}` : "none",
                      background: ri % 2 === 1 ? "#FAFBFD" : "transparent",
                    }}
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: "10px 14px",
                          color: C.text,
                          fontWeight: ci === 0 ? 600 : 400,
                        }}
                      >
                        {cell === "✓"
                          ? <span style={{ color: C.success, fontWeight: 700, fontSize: 16 }}>{"✓"}</span>
                          : cell === "✗"
                            ? <span style={{ color: C.danger, fontWeight: 700, fontSize: 16 }}>{"✗"}</span>
                            : cell === "◆"
                              ? <span style={{ color: C.primary, fontWeight: 700, fontSize: 14 }}>{"◆"}</span>
                              : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    // ── List ─────────────────────────────────────────────────
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          style={{
            margin: 0,
            paddingRight: 24,
            paddingLeft: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {block.items.map((item, i) => (
            <li key={i} style={{ fontSize: 14, lineHeight: 1.8, color: C.textSecondary }}>
              {item}
            </li>
          ))}
        </Tag>
      );
    }

    // ── Finding ──────────────────────────────────────────────
    case "finding": {
      const sev = SEVERITY_MAP[block.severity] || SEVERITY_MAP.info;
      return (
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${sev.border}`,
            background: sev.bg,
            padding: "18px 22px",
            pageBreakInside: "avoid",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 14 }}>{sev.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: sev.color,
                background: `${sev.color}15`,
                padding: "2px 10px",
                borderRadius: 6,
              }}
            >
              {he ? sev.label : sev.labelEn}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: sev.color, flex: 1 }}>
              {block.title}
            </span>
            {block.confidence && <ConfidenceBadge level={block.confidence} he={he} />}
          </div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              color: sev.color,
              margin: "0 0 10px",
              opacity: 0.85,
            }}
          >
            {block.detail}
          </p>
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.6)",
              border: `1px solid ${sev.border}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: sev.color,
                marginBottom: 4,
                opacity: 0.7,
              }}
            >
              {he ? "המלצה:" : "Recommendation:"}
            </div>
            <div style={{ fontSize: 13, color: sev.color, fontWeight: 500 }}>
              {block.recommendation}
            </div>
          </div>
          {block.evidence && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: sev.color,
                opacity: 0.6,
                fontStyle: "italic",
              }}
            >
              {he ? "ראיה:" : "Evidence:"} {block.evidence}
            </div>
          )}
        </div>
      );
    }

    // ── Engine Card ──────────────────────────────────────────
    case "engine_card":
      return (
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            background: C.card,
            padding: "24px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 28 }}>{block.icon}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{block.engine}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>
                {block.queriesTested} {he ? "שאילתות נבדקו" : "queries tested"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ flex: "1 1 80px", textAlign: "center" }}>
              <MiniGauge
                value={Math.round(block.mentionRate)}
                color={block.mentionRate >= 50 ? C.success : block.mentionRate >= 25 ? C.warning : C.danger}
              />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                {he ? "שיעור אזכור" : "Mention Rate"}
              </div>
            </div>
            <div style={{ flex: "1 1 80px", textAlign: "center" }}>
              <MiniGauge
                value={Math.round(block.citationRate)}
                color={block.citationRate >= 30 ? C.success : block.citationRate >= 15 ? C.warning : C.danger}
              />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                {he ? "שיעור ציטוט" : "Citation Rate"}
              </div>
            </div>
            <div style={{ flex: "1 1 80px", textAlign: "center" }}>
              <MiniGauge
                value={Math.round(block.firstMentionRate)}
                color={C.primary}
              />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                {he ? "אזכור ראשון" : "First Mention"}
              </div>
            </div>
          </div>
          {block.topCitedPages.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 6 }}>
                {he ? "דפים מצוטטים:" : "Top Cited Pages:"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {block.topCitedPages.slice(0, 5).map((page, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 12,
                      color: C.primary,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: C.primaryLight,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {page}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    // ── Competitor Row ───────────────────────────────────────
    case "competitor_row": {
      const threatColor =
        block.mentions > 10 ? C.danger : block.mentions > 5 ? C.warning : C.success;
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "14px 20px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.card,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 6,
              height: 40,
              borderRadius: 3,
              background: threatColor,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: "1 1 140px", minWidth: 120 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{block.domain}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{block.sourceType}</div>
          </div>
          <div style={{ textAlign: "center", flex: "0 0 70px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{block.mentions}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{he ? "אזכורים" : "Mentions"}</div>
          </div>
          <div style={{ textAlign: "center", flex: "0 0 70px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{block.citations}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{he ? "ציטוטים" : "Citations"}</div>
          </div>
          <div style={{ flex: "1 1 100px", display: "flex", gap: 4, flexWrap: "wrap" }}>
            {block.engines.map((e, i) => (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: C.primaryLight,
                  color: C.primaryDark,
                  fontWeight: 600,
                }}
              >
                {e}
              </span>
            ))}
          </div>
          <div style={{ flex: "1 1 100px", display: "flex", gap: 4, flexWrap: "wrap" }}>
            {block.topics.slice(0, 3).map((tp, i) => (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: C.bg,
                  color: C.textSecondary,
                }}
              >
                {tp}
              </span>
            ))}
          </div>
        </div>
      );
    }

    // ── Query Result ─────────────────────────────────────────
    case "query_result":
      return (
        <div
          style={{
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.card,
            padding: "14px 18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.text }}>
              &quot;{block.query}&quot;
            </div>
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 6,
                background: C.bg,
                color: C.textSecondary,
                fontWeight: 600,
              }}
            >
              {block.language}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 6,
                background: C.bg,
                color: C.textSecondary,
              }}
            >
              {block.category}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 6,
                background: block.branded ? "#FEF3C7" : C.primaryLight,
                color: block.branded ? "#92400E" : C.primaryDark,
                fontWeight: 600,
              }}
            >
              {block.branded
                ? he ? "ממותג" : "Branded"
                : he ? "לא-ממותג" : "Non-Branded"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {block.engines.map((eng, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: eng.cited
                    ? `${C.success}12`
                    : eng.mentioned
                      ? `${C.primary}10`
                      : `${C.danger}08`,
                  border: `1px solid ${eng.cited ? `${C.success}25` : eng.mentioned ? `${C.primary}20` : `${C.danger}15`}`,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>
                  {eng.engine}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: eng.cited ? C.success : eng.mentioned ? C.primary : C.danger,
                  }}
                >
                  {eng.cited ? "◆" : eng.mentioned ? "✓" : "✗"}
                </span>
                {eng.position != null && (
                  <span style={{ fontSize: 10, color: C.textMuted }}>#{eng.position}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      );

    // ── Action Item ──────────────────────────────────────────
    case "action_item": {
      const pri = PRIORITY_MAP[block.priority] || PRIORITY_MAP.medium;
      return (
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: C.card,
            padding: "18px 22px",
            borderRight: `4px solid ${pri.color}`,
            pageBreakInside: "avoid",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 6,
                background: pri.bg,
                color: pri.color,
              }}
            >
              {he ? pri.label : pri.labelEn}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1 }}>
              {block.title}
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: C.textSecondary, margin: "0 0 12px" }}>
            {block.description}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: C.textMuted }}>{he ? "השפעה:" : "Impact:"}</span>
              <span style={{ fontWeight: 600, color: C.text }}>{block.impact}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: C.textMuted }}>{he ? "מאמץ:" : "Effort:"}</span>
              <span style={{ fontWeight: 600, color: C.text }}>{block.effort}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: C.textMuted }}>KPI:</span>
              <span style={{ fontWeight: 600, color: C.primary }}>{block.kpi}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: C.textMuted }}>{he ? "דדליין:" : "Deadline:"}</span>
              <span style={{ fontWeight: 600, color: C.text }}>{block.deadline}</span>
            </div>
          </div>
          {block.evidence && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: C.textMuted,
                fontStyle: "italic",
              }}
            >
              {he ? "ראיה:" : "Evidence:"} {block.evidence}
            </div>
          )}
        </div>
      );
    }

    // ── Methodology Field ────────────────────────────────────
    case "methodology_field":
      return (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            padding: "8px 0",
            borderBottom: `1px solid ${C.borderLight}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.textSecondary,
              minWidth: 140,
              flexShrink: 0,
            }}
          >
            {block.label}
          </div>
          <div
            style={{
              fontSize: 13,
              color: block.value === "לא זמין" || block.value === "N/A" ? C.textMuted : C.text,
              fontWeight: block.value === "לא זמין" || block.value === "N/A" ? 400 : 500,
              fontStyle: block.value === "לא זמין" || block.value === "N/A" ? "italic" : "normal",
            }}
          >
            {block.value}
          </div>
        </div>
      );

    // ── Progress Bar ─────────────────────────────────────────
    case "progress_bar": {
      const pctVal = block.max > 0 ? Math.round((block.value / block.max) * 100) : 0;
      return (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{block.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: block.color }}>
              {block.value}/{block.max} ({pctVal}%)
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: C.borderLight }}>
            <div
              style={{
                height: "100%",
                borderRadius: 5,
                width: `${pctVal}%`,
                background: `linear-gradient(90deg, ${block.color}, ${block.color}CC)`,
                transition: "width 0.8s ease",
              }}
            />
          </div>
        </div>
      );
    }

    // ── Alert ────────────────────────────────────────────────
    case "alert": {
      const alertSev = SEVERITY_MAP[block.severity] || SEVERITY_MAP.info;
      return (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: alertSev.bg,
            border: `1px solid ${alertSev.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>{alertSev.icon}</span>
          <span style={{ fontSize: 13, color: alertSev.color, fontWeight: 500 }}>
            {block.message}
          </span>
        </div>
      );
    }

    // ── KPI Target ───────────────────────────────────────────
    case "kpi_target":
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "16px 20px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.card,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{block.metric}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{block.timeframe}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.textMuted }}>{he ? "נוכחי" : "Current"}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.textSecondary }}>{block.current}</div>
          </div>
          <div
            style={{
              width: 1,
              height: 32,
              background: C.border,
            }}
          />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.textMuted }}>{he ? "יעד" : "Target"}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{block.target}</div>
          </div>
          <ConfidenceBadge level={block.confidence as "high" | "medium" | "low"} he={he} />
        </div>
      );

    // ── Divider ──────────────────────────────────────────────
    case "divider":
      return <hr style={{ border: "none", height: 1, background: C.border, margin: "8px 0" }} />;

    // ── Page Break ───────────────────────────────────────────
    case "page_break":
      return <div className="page-break" style={{ height: 1 }} />;

    // ── Spacer ───────────────────────────────────────────────
    case "spacer":
      return <div style={{ height: block.height }} />;

    default:
      return null;
  }
}

// ══════════════════════════════════════════════════════════════
// ACTION PLAN KANBAN VIEW
// ══════════════════════════════════════════════════════════════

function ActionPlanKanban({
  items,
  he,
}: {
  items: Extract<PremiumReportBlock, { type: "action_item" }>[];
  he: boolean;
}) {
  const phases = [
    { key: "0-30", label: he ? "ימים 0–30" : "Days 0–30", color: C.danger },
    { key: "31-60", label: he ? "ימים 31–60" : "Days 31–60", color: C.warning },
    { key: "61-90", label: he ? "ימים 61–90" : "Days 61–90", color: C.primary },
  ];

  function classifyDeadline(deadline: string): string {
    // Parse the first number from the deadline string (e.g., "יום 7-14" → 7)
    const match = deadline.match(/(\d+)/);
    if (match) {
      const firstDay = parseInt(match[1], 10);
      if (firstDay <= 30) return "0-30";
      if (firstDay <= 60) return "31-60";
      return "61-90";
    }
    // Fallback for non-numeric deadlines
    const d = deadline.toLowerCase();
    if (d.includes("מיידי") || d.includes("asap") || d.includes("immediate")) return "0-30";
    if (d.includes("ארוך") || d.includes("חודשיים")) return "31-60";
    return "61-90";
  }

  const grouped = phases.map((phase) => ({
    ...phase,
    items: items.filter((item) => classifyDeadline(item.deadline) === phase.key),
  }));

  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
      {grouped.map((phase) => (
        <div
          key={phase.key}
          style={{
            flex: "1 1 280px",
            minWidth: 260,
            background: C.bg,
            borderRadius: 16,
            padding: 16,
            border: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              paddingBottom: 10,
              borderBottom: `2px solid ${phase.color}`,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: phase.color,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{phase.label}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.textMuted,
                marginRight: "auto",
              }}
            >
              ({phase.items.length})
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {phase.items.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: C.textMuted,
                  textAlign: "center",
                  padding: 20,
                  fontStyle: "italic",
                }}
              >
                {he ? "אין פעולות בשלב זה" : "No actions in this phase"}
              </div>
            )}
            {phase.items.map((item, i) => {
              const pri = PRIORITY_MAP[item.priority] || PRIORITY_MAP.medium;
              return (
                <div
                  key={i}
                  style={{
                    background: C.card,
                    borderRadius: 12,
                    padding: "12px 14px",
                    border: `1px solid ${C.border}`,
                    borderRight: `3px solid ${pri.color}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: pri.bg,
                        color: pri.color,
                      }}
                    >
                      {he ? pri.label : pri.labelEn}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.textMuted,
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.description}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 10, color: C.textMuted }}>
                    <span>{he ? "השפעה" : "Impact"}: {item.impact}</span>
                    <span>{he ? "מאמץ" : "Effort"}: {item.effort}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// FLOATING TABLE OF CONTENTS
// ══════════════════════════════════════════════════════════════

function FloatingTOC({
  sections,
  activeSection,
  he,
  onNavigate,
}: {
  sections: PremiumReportSection[];
  activeSection: string;
  he: boolean;
  onNavigate: (id: string) => void;
}) {
  return (
    <div
      className="no-print"
      style={{
        position: "sticky",
        top: 32,
        width: 220,
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        padding: "16px 12px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        maxHeight: "calc(100vh - 64px)",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 10, letterSpacing: 1 }}>
        {he ? "תוכן עניינים" : "TABLE OF CONTENTS"}
      </div>
      {sections.map((s) => {
        const isActive = activeSection === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onNavigate(s.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "6px 8px",
              borderRadius: 8,
              border: "none",
              background: isActive ? C.primaryLight : "transparent",
              cursor: "pointer",
              textAlign: "right",
              transition: "background 0.2s",
              marginBottom: 2,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                background: isActive ? C.primary : C.bg,
                color: isActive ? "#fff" : C.textMuted,
              }}
            >
              {s.number}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? C.primary : C.textSecondary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {he ? s.title : s.titleEn}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// EXPORT DROPDOWN
// ══════════════════════════════════════════════════════════════

function ExportDropdown({
  report,
  he,
}: {
  report: PremiumSeoReport;
  he: boolean;
}) {
  const [open, setOpen] = useState(false);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixel-seo-geo-report-${report.planId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }, [report]);

  const exportCSV = useCallback(() => {
    let csv = "Section,Block Type,Content\n";
    report.sections.forEach((s) => {
      s.content.forEach((b) => {
        const text = "text" in b ? (b as any).text : "label" in b ? (b as any).label : b.type;
        csv += `"${s.title}","${b.type}","${String(text).replace(/"/g, '""')}"\n`;
      });
    });
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixel-seo-geo-report-${report.planId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }, [report]);

  const exportHTML = useCallback(() => {
    const printArea = document.getElementById("premium-report-print");
    if (!printArea) return;
    const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${report.clientName} - PIXEL SEO/GEO Report</title></head><body style="font-family:system-ui,sans-serif;background:#F7F9FC">${printArea.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixel-seo-geo-report-${report.planId}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }, [report]);

  const options = [
    { label: "JSON", icon: "{ }", action: exportJSON },
    { label: "CSV", icon: "📊", action: exportCSV },
    { label: "HTML", icon: "🌐", action: exportHTML },
  ];

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          ...actionBtnStyle,
          background: "transparent",
          border: `1px solid ${C.border}`,
          color: C.textSecondary,
        }}
      >
        {he ? "ייצוא" : "Export"} {"▾"}
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 4,
              background: C.card,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              zIndex: 100,
              minWidth: 140,
              overflow: "hidden",
            }}
          >
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={opt.action}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "10px 16px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  color: C.text,
                  textAlign: "right",
                  borderBottom: i < options.length - 1 ? `1px solid ${C.borderLight}` : "none",
                }}
              >
                <span style={{ fontSize: 14 }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════

export default function PremiumReportPage() {
  const params = useParams<{ planId: string }>();
  const planId = params?.planId;
  const router = useRouter();

  const [report, setReport] = useState<PremiumSeoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"he" | "en">("he");
  const [reportMode, setReportMode] = useState<"full" | "executive" | "technical" | "client">("full");
  const [activeSection, setActiveSection] = useState<string>("");

  const he = lang === "he";

  // ── Fetch plan and generate report ──
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/data/seo-plans/${planId}`);
        if (!res.ok) throw new Error(he ? "לא ניתן לטעון את התוכנית" : "Failed to load plan");
        const plan = await res.json();
        if (cancelled) return;
        const premiumReport = generatePremiumReport(plan, lang);
        setReport(premiumReport);
      } catch (e: any) {
        if (!cancelled) setError(e.message || (he ? "שגיאה בייצור הדוח" : "Report generation failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [planId, lang, he]);

  // ── Section intersection observer ──
  useEffect(() => {
    if (!report) return;
    const observers: IntersectionObserver[] = [];
    report.sections.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(s.id);
        },
        { rootMargin: "-20% 0px -60% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [report]);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }, []);

  const handleRegenerate = useCallback(() => {
    if (!planId) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/data/seo-plans/${planId}`);
        if (!res.ok) throw new Error("Failed");
        const plan = await res.json();
        const premiumReport = generatePremiumReport(plan, lang);
        setReport(premiumReport);
      } catch (e: any) {
        setError(e.message || "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [planId, lang]);

  // ── Filter sections by mode ──
  const filteredSections = useMemo(() => {
    if (!report) return [];
    const allowed = MODE_SECTIONS[reportMode];
    if (!allowed || allowed.length === 0) return report.sections;
    return report.sections.filter((s) => allowed.includes(s.id));
  }, [report, reportMode]);

  // ── Detect action_plan section for kanban ──
  const actionPlanItems = useMemo(() => {
    if (!report) return [];
    const section = report.sections.find((s) => s.id === "action_plan");
    if (!section) return [];
    return section.content.filter(
      (b): b is Extract<PremiumReportBlock, { type: "action_item" }> => b.type === "action_item"
    );
  }, [report]);

  // ══════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div style={{ direction: "rtl", padding: "60px 32px", minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", padding: "140px 0" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              margin: "0 auto 24px",
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              color: "#fff",
              fontWeight: 800,
              animation: "premiumPulse 2s ease-in-out infinite",
            }}
          >
            P
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
            {he ? "מייצר דוח פרמיום..." : "Generating Premium Report..."}
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>
            {he
              ? "המערכת מנתחת 18 פרקי דוח, מחשבת ציונים ומכינה המלצות"
              : "Analyzing 18 report sections, computing scores and preparing recommendations"}
          </p>
        </div>
        <style>{`@keyframes premiumPulse { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.08); opacity:0.85; } }`}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ERROR STATE
  // ══════════════════════════════════════════════════════════

  if (error || !report) {
    return (
      <div style={{ direction: "rtl", padding: "60px 32px", minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", padding: "100px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{"⚠️"}</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
            {he ? "שגיאה בייצור הדוח" : "Report Generation Error"}
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>{error}</p>
          <button
            onClick={handleRegenerate}
            style={{
              padding: "12px 32px",
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {he ? "נסה שוב" : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════

  const domain = report.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      {/* Print + animation styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #premium-report-print, #premium-report-print * { visibility: visible; }
          #premium-report-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 15mm 12mm; }
          .page-break { page-break-before: always; }
        }
        @keyframes premiumPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ direction: "rtl", minHeight: "100vh", background: C.bg }}>
        {/* ═══ ACTION BAR (no-print) ═══ */}
        <div
          className="no-print"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "rgba(247,249,252,0.92)",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${C.border}`,
            padding: "10px 32px",
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {/* Left: back */}
            <button
              onClick={() => router.push(`/seo-geo/${planId}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "none",
                fontSize: 13,
                color: C.primary,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {"←"} {he ? "חזרה לתוכנית" : "Back to Plan"}
            </button>

            {/* Center: mode selector */}
            <div
              style={{
                display: "flex",
                background: C.card,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                overflow: "hidden",
              }}
            >
              {(
                [
                  { key: "full", label: he ? "מלא" : "Full" },
                  { key: "executive", label: he ? "מנהלים" : "Executive" },
                  { key: "technical", label: he ? "טכני" : "Technical" },
                  { key: "client", label: he ? "ללקוח" : "Client" },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setReportMode(m.key)}
                  style={{
                    padding: "7px 16px",
                    border: "none",
                    background: reportMode === m.key ? C.primary : "transparent",
                    color: reportMode === m.key ? "#fff" : C.textSecondary,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    transition: "all 0.2s",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Right: actions */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Language toggle */}
              <div
                style={{
                  display: "flex",
                  background: C.card,
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setLang("he")}
                  style={{
                    padding: "7px 14px",
                    border: "none",
                    background: lang === "he" ? C.primary : "transparent",
                    color: lang === "he" ? "#fff" : C.textSecondary,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {"עברית"}
                </button>
                <button
                  onClick={() => setLang("en")}
                  style={{
                    padding: "7px 14px",
                    border: "none",
                    background: lang === "en" ? C.primary : "transparent",
                    color: lang === "en" ? "#fff" : C.textSecondary,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  English
                </button>
              </div>

              <button
                onClick={() => {
                  const publicUrl = `${window.location.origin}/report/${planId}`;
                  navigator.clipboard.writeText(publicUrl).then(() => {
                    const btn = document.getElementById('share-btn');
                    if (btn) { btn.textContent = he ? '✓ הקישור הועתק!' : '✓ Link copied!'; setTimeout(() => { btn.textContent = he ? '🔗 שתף ללקוח' : '🔗 Share'; }, 2000); }
                  });
                }}
                id="share-btn"
                style={{
                  ...actionBtnStyle,
                  background: "#10B981",
                  color: "#fff",
                }}
              >
                {he ? "🔗 שתף ללקוח" : "🔗 Share"}
              </button>

              <button
                onClick={handleRegenerate}
                style={{
                  ...actionBtnStyle,
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  color: C.textSecondary,
                }}
              >
                {"↻"} {he ? "ייצר מחדש" : "Regenerate"}
              </button>

              <button
                onClick={() => window.print()}
                style={{
                  ...actionBtnStyle,
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                  color: "#fff",
                }}
              >
                {he ? "ייצוא PDF" : "Export PDF"}
              </button>

              <ExportDropdown report={report} he={he} />
            </div>
          </div>
        </div>

        {/* ═══ MAIN LAYOUT: SIDEBAR + CONTENT ═══ */}
        <div
          style={{
            display: "flex",
            gap: 24,
            maxWidth: 1200,
            margin: "0 auto",
            padding: "32px 32px 80px",
            alignItems: "flex-start",
          }}
        >
          {/* Floating TOC sidebar — desktop only */}
          <div className="no-print" style={{ display: "block" }}>
            <FloatingTOC
              sections={filteredSections}
              activeSection={activeSection}
              he={he}
              onNavigate={scrollToSection}
            />
          </div>

          {/* Report content */}
          <div id="premium-report-print" style={{ flex: 1, minWidth: 0 }}>
            {/* ═══════════════════════════════════════════════
                COVER SECTION
            ═══════════════════════════════════════════════ */}
            <div
              style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                borderRadius: 24,
                padding: "52px 44px",
                color: "#fff",
                marginBottom: 28,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Decorative elements */}
              <div
                style={{
                  position: "absolute",
                  top: -50,
                  left: -50,
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -70,
                  right: -70,
                  width: 260,
                  height: 260,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.04)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 30,
                  right: 40,
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.03)",
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                {/* Brand mark */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    opacity: 0.7,
                    letterSpacing: 3,
                    marginBottom: 16,
                    textTransform: "uppercase",
                  }}
                >
                  PIXEL SEO/GEO
                </div>

                {/* Title */}
                <h1 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.3 }}>
                  {he ? "דוח PIXEL SEO/GEO מקיף" : "Comprehensive PIXEL SEO/GEO Report"}
                </h1>

                {/* Client info */}
                <div style={{ fontSize: 20, fontWeight: 500, opacity: 0.9, marginBottom: 20 }}>
                  {report.clientName} {"—"} {domain}
                </div>

                {/* Meta pills */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
                  <span style={pillStyle}>
                    {he ? "תקופה:" : "Period:"} {report.period.from} {"–"} {report.period.to}
                  </span>
                  <span style={pillStyle}>
                    {report.enginesChecked.length} {he ? "מנועים" : "engines"}
                  </span>
                  <span style={pillStyle}>
                    {report.languagesChecked.join(", ")}
                  </span>
                  <span style={pillStyle}>
                    v{report.version}
                  </span>
                  {report.confidential && (
                    <span style={{ ...pillStyle, background: "rgba(240,255,2,0.2)", color: C.accent }}>
                      {he ? "סודי" : "Confidential"}
                    </span>
                  )}
                </div>

                {/* Score summary gauges */}
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.12)",
                      backdropFilter: "blur(8px)",
                      borderRadius: 20,
                      padding: "20px 28px",
                    }}
                  >
                    <ScoreGauge
                      score={report.scores.pixelSeoScore}
                      maxScore={100}
                      label={he ? "ציון PIXEL SEO" : "PIXEL SEO Score"}
                      color="#fff"
                      previousScore={report.scores.previousSeoScore}
                      size={120}
                    />
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.12)",
                      backdropFilter: "blur(8px)",
                      borderRadius: 20,
                      padding: "20px 28px",
                    }}
                  >
                    <ScoreGauge
                      score={report.scores.pixelGeoScore}
                      maxScore={100}
                      label={he ? "ציון PIXEL GEO" : "PIXEL GEO Score"}
                      color={C.accent}
                      previousScore={report.scores.previousGeoScore}
                      size={120}
                    />
                  </div>

                  {/* Quick stats */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: he ? "ממצאים" : "Findings", value: report.meta.totalFindings },
                      { label: he ? "קריטיים" : "Critical", value: report.meta.criticalFindings },
                      { label: he ? "המלצות" : "Recommendations", value: report.meta.totalRecommendations },
                      { label: he ? "שאילתות" : "Queries", value: report.totalQueries },
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, minWidth: 36 }}>{item.value}</span>
                        <span style={{ fontSize: 12, opacity: 0.7 }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generated date */}
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 24 }}>
                  {he ? "הופק בתאריך:" : "Generated:"}{" "}
                  {new Date(report.generatedAt).toLocaleDateString(he ? "he-IL" : "en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════
                TABLE OF CONTENTS (in-report)
            ═══════════════════════════════════════════════ */}
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 16px" }}>
                {he ? "תוכן עניינים" : "Table of Contents"}
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 6,
                }}
              >
                {filteredSections.map((s) => (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => scrollToSection(s.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") scrollToSection(s.id); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 10,
                      textDecoration: "none",
                      color: C.text,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = C.primaryLight;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        flexShrink: 0,
                        background: C.primaryLight,
                        color: C.primary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {s.number}
                    </span>
                    <span style={{ fontSize: 14 }}>{SECTION_ICONS[s.id] || ""}</span>
                    <span style={{ fontWeight: 500 }}>{he ? s.title : s.titleEn}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════
                REPORT SECTIONS
            ═══════════════════════════════════════════════ */}
            {filteredSections.map((section) => {
              const isActionPlan = section.id === "action_plan";
              const nonActionBlocks = section.content.filter((b) => b.type !== "action_item");
              const hasEngineCards = section.content.some((b) => b.type === "engine_card");
              const hasCompetitorRows = section.content.some((b) => b.type === "competitor_row");
              const hasQueryResults = section.content.some((b) => b.type === "query_result");

              return (
                <div
                  key={section.id}
                  id={`section-${section.id}`}
                  style={{
                    ...cardStyle,
                    marginBottom: 24,
                    pageBreakInside: "avoid",
                    animation: "fadeInUp 0.4s ease",
                  }}
                >
                  {/* Section header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      marginBottom: 24,
                      paddingBottom: 16,
                      borderBottom: `2px solid ${C.primaryLight}`,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        flexShrink: 0,
                        background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        fontWeight: 800,
                      }}
                    >
                      {section.number}
                    </div>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
                        {he ? section.title : section.titleEn}
                      </h2>
                      {section.icon && (
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                          {SECTION_ICONS[section.id] || section.icon}{" "}
                          {he ? section.titleEn : section.title}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section content */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Engine cards: grid layout */}
                    {hasEngineCards && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                          gap: 16,
                        }}
                      >
                        {section.content
                          .filter((b) => b.type === "engine_card")
                          .map((b, i) => (
                            <RenderPremiumBlock key={`ec-${i}`} block={b} he={he} />
                          ))}
                      </div>
                    )}

                    {/* Competitor rows: stacked */}
                    {hasCompetitorRows && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {section.content
                          .filter((b) => b.type === "competitor_row")
                          .map((b, i) => (
                            <RenderPremiumBlock key={`cr-${i}`} block={b} he={he} />
                          ))}
                      </div>
                    )}

                    {/* Query results: stacked */}
                    {hasQueryResults && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {section.content
                          .filter((b) => b.type === "query_result")
                          .map((b, i) => (
                            <RenderPremiumBlock key={`qr-${i}`} block={b} he={he} />
                          ))}
                      </div>
                    )}

                    {/* Non-special blocks */}
                    {(hasEngineCards || hasCompetitorRows || hasQueryResults
                      ? section.content.filter(
                          (b) =>
                            b.type !== "engine_card" &&
                            b.type !== "competitor_row" &&
                            b.type !== "query_result" &&
                            (!isActionPlan || b.type !== "action_item")
                        )
                      : isActionPlan
                        ? nonActionBlocks
                        : section.content
                    ).map((block, bi) => (
                      <RenderPremiumBlock key={bi} block={block} he={he} />
                    ))}

                    {/* Action Plan kanban view */}
                    {isActionPlan && actionPlanItems.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: C.text,
                            marginBottom: 12,
                          }}
                        >
                          {he
                            ? "תוכנית פעולה לפי שלב"
                            : "Action Plan by Phase"}
                        </div>
                        <ActionPlanKanban items={actionPlanItems} he={he} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* ═══════════════════════════════════════════════
                FOOTER
            ═══════════════════════════════════════════════ */}
            <div
              style={{
                textAlign: "center",
                padding: "40px 0 20px",
                color: C.textMuted,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  margin: "0 auto 12px",
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                P
              </div>
              <div style={{ fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}>
                PIXEL SEO/GEO by PixelManageAI
              </div>
              <div>
                {he
                  ? "דוח זה הופק אוטומטית. כל הזכויות שמורות."
                  : "This report was auto-generated. All rights reserved."}
              </div>
              {report.confidential && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: C.warning,
                    fontWeight: 600,
                  }}
                >
                  {he
                    ? "מסמך סודי — לא להפצה"
                    : "Confidential — Do not distribute"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
