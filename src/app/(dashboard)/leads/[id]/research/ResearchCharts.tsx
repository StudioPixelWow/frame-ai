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
  AreaChart,
  Area,
  LabelList,
} from "recharts";

const BRAND = "#00B5FE";
const TARGET = "#7c3aed";
const GOOD = "#22c55e";
const WARN = "#f97316";

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
  marginBottom: "0.5rem",
  color: "var(--foreground)",
};

const mutedText: React.CSSProperties = {
  color: "var(--foreground-muted)",
  fontSize: "0.8rem",
};

interface ResearchChartsProps {
  scores?: any;
  competitors?: any;
  google?: any;
}

/**
 * Visualizations that frame "where the client is today vs. where we can take them":
 *  1. Scores by category (radar)
 *  2. Gap to 90-day target (grouped bars + gap label)
 *  3. Growth forecast over 12 months (area)
 *  4. ROI / organic-visibility potential — today vs potential (bars)
 *  5. Competitor positioning (horizontal bars, LTR domain labels = readable)
 */
export default function ResearchCharts({ scores, competitors }: ResearchChartsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const categories: any[] = scores?.categories || [];
  const hasCategories = categories.length > 0;
  const comps: any[] = competitors?.competitors || [];

  const overall: number =
    scores?.overall ??
    (hasCategories
      ? Math.round(categories.reduce((a, c) => a + (c.score || 0), 0) / categories.length)
      : 0);

  // 90-day target per category and overall
  const targetOf = (cur: number) => Math.min(95, Math.max(cur + 18, 78));

  const tooltipStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: "0.8rem",
    color: "var(--foreground)",
  };

  // ── 1. radar ──
  const categoryData = categories.map((c) => ({ name: c.categoryHe || c.category, score: c.score ?? 0 }));

  // ── 2. gap to target ──
  const gapData = categories.map((c) => {
    const cur = c.score ?? 0;
    const target = targetOf(cur);
    return { name: c.categoryHe || c.category, current: cur, gap: Math.max(0, target - cur), target };
  });

  // ── 3. growth forecast (overall score trajectory) ──
  const oTarget = targetOf(overall);
  const gap = oTarget - overall;
  const forecastData = [
    { period: "היום", score: overall },
    { period: "3 ח׳", score: Math.round(overall + gap * 0.4) },
    { period: "6 ח׳", score: Math.round(overall + gap * 0.7) },
    { period: "12 ח׳", score: oTarget },
  ];

  // ── 4. ROI / visibility potential ──
  const googleCat = categories.find((c) => c.category === "Google" || c.categoryHe === "נוכחות בגוגל");
  const seoCat = categories.find((c) => c.category === "SEO" || c.categoryHe === "קידום אורגני");
  const organicToday = googleCat?.score ?? overall;
  const leadsToday = seoCat?.score ?? overall;
  const potentialData = [
    { name: "נראות אורגנית", today: organicToday, potential: targetOf(organicToday) },
    { name: "יצירת לידים", today: leadsToday, potential: targetOf(leadsToday) },
    { name: "ציון כולל", today: overall, potential: oTarget },
  ];

  // (Competitor comparison is rendered as a readable TABLE on the page itself,
  // not as a chart here — avoids RTL label-truncation and keeps domains legible.)

  if (!hasCategories && comps.length === 0) return null;

  return (
    <>
      {hasCategories && (
        <>
          {/* Radar + Gap to target */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ ...cardStyle, marginBottom: 0 }}>
              <div style={cardTitleStyle}>ציונים לפי קטגוריה</div>
              <div style={{ ...mutedText, marginBottom: "0.75rem" }}>מצב נוכחי בכל תחום (0-100).</div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={categoryData} outerRadius="72%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: "var(--foreground-muted)", fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "var(--foreground-muted)", fontSize: 10 }} angle={90} />
                  <Radar name="ציון" dataKey="score" stroke={BRAND} fill={BRAND} fillOpacity={0.45} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...cardStyle, marginBottom: 0 }}>
              <div style={cardTitleStyle}>פער מול יעד 90 יום</div>
              <div style={{ ...mutedText, marginBottom: "0.75rem" }}>
                כחול = מצב נוכחי · סגול = הפער שנסגור עד היעד.
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={gapData} margin={{ top: 16, right: 8, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--foreground-muted)", fontSize: 11 }} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--foreground-muted)", fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border)", opacity: 0.3 }} />
                  <Bar dataKey="current" name="נוכחי" stackId="a" fill={BRAND} />
                  <Bar dataKey="gap" name="פער ליעד" stackId="a" fill={TARGET} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="target" position="top" formatter={(v: number) => `יעד ${v}`} style={{ fill: "var(--foreground-muted)", fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Forecast + ROI potential */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ ...cardStyle, marginBottom: 0 }}>
              <div style={cardTitleStyle}>תחזית צמיחה — 12 חודשים</div>
              <div style={{ ...mutedText, marginBottom: "0.75rem" }}>
                מסלול הציון הכולל הצפוי עם ליווי סטודיו פיקסל (הערכה).
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={forecastData} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="period" tick={{ fill: "var(--foreground-muted)", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--foreground-muted)", fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="score" name="ציון צפוי" stroke={BRAND} strokeWidth={2.5} fill="url(#grad)">
                    <LabelList dataKey="score" position="top" style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 700 }} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...cardStyle, marginBottom: 0 }}>
              <div style={cardTitleStyle}>פוטנציאל — היום מול אפשרי</div>
              <div style={{ ...mutedText, marginBottom: "0.75rem" }}>
                מדדי נראות ולידים יחסיים (0-100) — היום מול הפוטנציאל הניתן להשגה (הערכה).
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={potentialData} margin={{ top: 16, right: 8, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--foreground-muted)", fontSize: 11 }} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--foreground-muted)", fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border)", opacity: 0.3 }} />
                  <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
                  <Bar dataKey="today" name="היום" fill={WARN} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="potential" name="פוטנציאל" fill={GOOD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

    </>
  );
}
