"use client";

import { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

const BRAND = "#00B5FE";
const TARGET = "#F0FF02";
const GOOD = "#22c55e";
const WARN = "#f97316";
const BAD = "#ef4444";

function scoreColor(score: number): string {
  if (score >= 60) return GOOD;
  if (score >= 40) return WARN;
  return BAD;
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "1.5rem",
  marginBottom: "1.5rem",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 700,
  marginBottom: "1rem",
  color: "var(--foreground)",
};

const mutedText: React.CSSProperties = {
  color: "var(--foreground-muted)",
  fontSize: "0.85rem",
};

interface ResearchChartsProps {
  scores?: any;
  competitors?: any;
  google?: any;
}

/**
 * Visualizations for the lead research page:
 *  1. Scores by category (radar)
 *  2. Current state vs 90-day target (grouped bars)
 *  3. Competitor comparison — estimated organic visibility (bars)
 */
export default function ResearchCharts({ scores, competitors, google }: ResearchChartsProps) {
  // recharts must render client-side only (avoids SSR hydration mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const categories: any[] = scores?.categories || [];
  const hasCategories = categories.length > 0;

  // ── Data: scores by category ──
  const categoryData = categories.map((c) => ({
    name: c.categoryHe || c.category,
    score: c.score ?? 0,
  }));

  // ── Data: current vs 90-day target ──
  // Target = a realistic 90-day goal: at least +15 over current, floor 80, cap 100.
  const targetData = categories.map((c) => {
    const cur = c.score ?? 0;
    const target = Math.min(100, Math.max(cur + 15, 80));
    return { name: c.categoryHe || c.category, current: cur, target };
  });

  // ── Data: competitor comparison (estimated organic visibility) ──
  // Competitors only expose a search position → convert to a 0-100 visibility proxy.
  const posToVisibility = (pos?: number) =>
    pos && pos > 0 ? Math.max(10, Math.round(100 - (pos - 1) * 18)) : 15;

  const comps: any[] = competitors?.competitors || [];
  const googleCat = categories.find(
    (c) => c.category === "Google" || c.categoryHe === "נוכחות בגוגל"
  );
  const leadVisibility =
    googleCat?.score ??
    (google?.organic?.position
      ? posToVisibility(google.organic.position)
      : scores?.overall ?? 0);

  const competitorData = [
    { name: "האתר שלך", value: leadVisibility, isLead: true },
    ...comps.slice(0, 5).map((c: any, i: number) => ({
      name: c.name ? String(c.name).slice(0, 18) : c.domain || `מתחרה ${i + 1}`,
      value: posToVisibility(c.position),
      isLead: false,
    })),
  ];

  const tooltipStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: "0.8rem",
    color: "var(--foreground)",
  };

  if (!hasCategories && comps.length === 0) return null;

  return (
    <>
      {/* ═══ Scores by category (radar) + Current vs target (bars) ═══ */}
      {hasCategories && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          {/* Radar — scores by category */}
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={cardTitleStyle}>ציונים לפי קטגוריה</div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={categoryData} outerRadius="75%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fill: "var(--foreground-muted)", fontSize: 12 }}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--foreground-muted)", fontSize: 10 }}
                  angle={90}
                />
                <Radar
                  name="ציון"
                  dataKey="score"
                  stroke={BRAND}
                  fill={BRAND}
                  fillOpacity={0.45}
                />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Bars — current vs 90-day target */}
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={cardTitleStyle}>מצב נוכחי מול יעד (90 יום)</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={targetData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border)", opacity: 0.3 }} />
                <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
                <Bar dataKey="current" name="נוכחי" fill={BRAND} radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" name="יעד" fill={TARGET} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══ Competitor comparison ═══ */}
      {comps.length > 0 && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>השוואת מתחרים — נראות אורגנית משוערת</div>
          <div style={{ ...mutedText, marginBottom: "1rem" }}>
            מדד נראות משוער (0-100) על בסיס מיקום בתוצאות החיפוש — ערך גבוה יותר = נראות טובה יותר.
          </div>
          <ResponsiveContainer width="100%" height={Math.max(180, competitorData.length * 46)}>
            <BarChart
              data={competitorData}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: "var(--foreground-muted)", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fill: "var(--foreground)", fontSize: 11 }}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border)", opacity: 0.3 }} />
              <Bar dataKey="value" name="נראות" radius={[0, 4, 4, 0]}>
                {competitorData.map((d, i) => (
                  <Cell key={i} fill={d.isLead ? BRAND : scoreColor(d.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}
