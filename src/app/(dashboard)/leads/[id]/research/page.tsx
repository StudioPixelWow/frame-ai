"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ResearchCharts from "./ResearchCharts";

// ── Types ────────────────────────────────────────────────────────────────────

interface HistoryItem {
  id: string;
  leadName: string;
  websiteUrl: string;
  status: string;
  scores: any;
  createdAt: string;
  completedAt?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const BRAND = "#00B5FE";

function scoreColor(score: number): string {
  if (score >= 60) return "#22c55e";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

// Client-side PageSpeed estimate from website facts — used when the stored record
// has no PageSpeed data (e.g. older scans), so the metrics card is never empty.
function estimatePageSpeedClient(wf: any): any {
  if (!wf || !wf.title) return null;
  let perf = 100;
  const sizeKB = wf.pageSizeKB || 0;
  if (sizeKB > 5000) perf -= 35; else if (sizeKB > 3000) perf -= 25; else if (sizeKB > 1500) perf -= 15; else if (sizeKB > 800) perf -= 8;
  const js = wf.jsFileCount || 0;
  if (js > 20) perf -= 20; else if (js > 10) perf -= 12; else if (js > 5) perf -= 6;
  const css = wf.cssFileCount || 0;
  if (css > 10) perf -= 10; else if (css > 5) perf -= 5;
  const imgs = wf.imageCount || 0;
  if (!wf.hasLazyLoading && imgs > 15) perf -= 12; else if (!wf.hasLazyLoading && imgs > 5) perf -= 6;
  if (!wf.isHttps) perf -= 5;
  perf = Math.min(Math.max(perf, 10), 92);
  let acc = 90;
  if (!wf.hasMobileViewport) acc -= 25;
  if (!wf.detectedLanguages?.length) acc -= 10;
  if (imgs > 0 && !wf.ogImage) acc -= 5;
  acc = Math.min(Math.max(acc, 20), 95);
  let seoSc = 100;
  if (wf.title.length < 10 || wf.title.length > 70) seoSc -= 8;
  if (!wf.description) seoSc -= 15;
  if (!wf.h1) seoSc -= 12;
  if (!wf.hasMobileViewport) seoSc -= 15;
  if (!wf.isHttps) seoSc -= 10;
  if (!wf.canonical) seoSc -= 5;
  if (!wf.hasSchemaMarkup) seoSc -= 5;
  seoSc = Math.min(Math.max(seoSc, 20), 98);
  return {
    performanceScore: Math.round(perf), accessibilityScore: Math.round(acc), seoScore: Math.round(seoSc),
    fcp: null, lcp: null, cls: null, tbt: null, speedIndex: null, estimated: true,
  };
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  direction: "rtl",
  maxWidth: 960,
  margin: "0 auto",
  padding: "2rem 1.5rem 4rem",
  fontFamily: "inherit",
  color: "var(--foreground)",
};

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
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const gridRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.5rem",
  fontSize: "0.85rem",
};

const mutedText: React.CSSProperties = {
  color: "var(--foreground-muted)",
  fontSize: "0.85rem",
};

const barBg: React.CSSProperties = {
  height: 6,
  background: "var(--border)",
  borderRadius: 3,
  marginTop: 6,
  overflow: "hidden",
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function LeadResearchPage() {
  const params = useParams<{ id: string }>();
  const leadId = params.id;

  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current research + history
  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;

    (async () => {
      try {
        const [resRes, histRes] = await Promise.all([
          fetch(`/api/leads/${leadId}/research/results`),
          fetch(`/api/leads/${leadId}/research/history`),
        ]);

        if (!cancelled) {
          if (resRes.ok) {
            setData(await resRes.json());
          } else {
            setError("לא נמצאו תוצאות מחקר עבור ליד זה");
          }

          if (histRes.ok) {
            const h = await histRes.json();
            setHistory(h.history || []);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("שגיאה בטעינת נתוני המחקר");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [leadId]);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...pageStyle, textAlign: "center", paddingTop: "6rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>...</div>
        <div style={mutedText}>טוען נתוני מחקר...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...pageStyle, textAlign: "center", paddingTop: "6rem" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#ef4444" }}>
          {error || "לא נמצאו נתונים"}
        </div>
        <Link
          href="/leads"
          style={{ color: BRAND, textDecoration: "none", fontWeight: 600 }}
        >
          חזור לדף הלידים
        </Link>
      </div>
    );
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const scores = data.scores || {};
  const wf = data.websiteFacts || {};
  const social = data.socialPresence || {};
  const google = data.googlePresence || {};
  const seo = data.seoAnalysis || {};
  const geo = data.geoAnalysis || {};
  const competitors = data.competitorAnalysis || {};
  const plan = data.quarterPlan || {};
  const report = data.report;
  const deep = data.deepAnalysis || {};
  const socialDeep = deep.socialDeepAnalysis || null;
  const keywordResults = google.keywordResults || [];
  const adsLibrary = data.adsLibrary || null;
  const pageSpeed = seo.pageSpeed || estimatePageSpeedClient(wf);
  const leadName = history[0]?.leadName || wf.title || "ליד";
  const websiteUrl = history[0]?.websiteUrl || "";

  const platformNamesHe: Record<string, string> = {
    facebook: "פייסבוק",
    instagram: "אינסטגרם",
    linkedin: "לינקדאין",
    tiktok: "טיקטוק",
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleViewPdf = () => {
    window.open(`/api/leads/${leadId}/research/report?format=pdf`, "_blank");
  };

  const handleApproveReport = async () => {
    try {
      await fetch(`/api/leads/${leadId}/research/approve`, { method: "POST" });
    } catch {}
  };

  const handleSendEmail = async () => {
    // We don't have lead.email here, but the API uses it from the research record
    try {
      await fetch(`/api/leads/${leadId}/research/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {}
  };

  const handleRescan = () => {
    window.location.href = "/leads";
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      {/* ═══ Header ═══ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <Link
          href="/leads"
          style={{
            color: BRAND,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>&#8592;</span>
          חזור לדף לידים
        </Link>
        <h1
          style={{
            fontSize: "1.3rem",
            fontWeight: 800,
            margin: 0,
            color: "var(--foreground)",
          }}
        >
          {leadName} — מחקר דיגיטלי
        </h1>
      </div>

      {/* ═══ Hero Score Card ═══ */}
      {scores.overall != null && (
        <div
          style={{
            ...cardStyle,
            textAlign: "center",
            background: `linear-gradient(135deg, ${BRAND}10, #F0FF0208)`,
            border: `1px solid ${BRAND}30`,
            padding: "2rem 1.5rem",
          }}
        >
          <div
            style={{
              fontSize: "4rem",
              fontWeight: 800,
              color: BRAND,
              lineHeight: 1,
            }}
          >
            {scores.overall}
            <span
              style={{
                fontSize: "1.5rem",
                color: "var(--foreground-muted)",
              }}
            >
              /100
            </span>
          </div>
          <div
            style={{
              fontSize: "1rem",
              color: "var(--foreground-muted)",
              marginTop: "0.5rem",
            }}
          >
            ציון נוכחות דיגיטלית כולל
          </div>
          {scores.grade && (
            <div
              style={{
                display: "inline-block",
                marginTop: "0.75rem",
                padding: "0.35rem 1.2rem",
                borderRadius: 20,
                fontSize: "1rem",
                fontWeight: 700,
                color: "#fff",
                background: scoreColor(scores.overall),
              }}
            >
              דירוג: {scores.grade}
            </div>
          )}
          {scores.confidence != null && (
            <div style={{ ...mutedText, marginTop: "0.5rem" }}>
              רמת ביטחון: {scores.confidence}%
            </div>
          )}
        </div>
      )}

      {/* ═══ Scores Grid ═══ */}
      {scores.categories?.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {scores.categories.map((cat: any) => (
            <div
              key={cat.category}
              style={{
                ...cardStyle,
                marginBottom: 0,
                textAlign: "center",
                padding: "1.25rem",
              }}
            >
              <div style={{ ...mutedText, fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                {cat.categoryHe}
              </div>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  color: scoreColor(cat.score),
                }}
              >
                {cat.score}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: scoreColor(cat.score),
                  marginTop: "0.25rem",
                }}
              >
                {cat.grade}
              </div>
              <div style={barBg}>
                <div
                  style={{
                    height: "100%",
                    width: `${cat.score}%`,
                    background: scoreColor(cat.score),
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Visualizations ═══ */}
      <ResearchCharts scores={scores} competitors={competitors} google={google} />

      {/* ═══ Website Analysis ═══ */}
      {wf.title && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>ניתוח אתר</div>
          <div style={{ marginBottom: "1rem" }}>
            {wf.title && (
              <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                {wf.title}
              </div>
            )}
            {wf.description && (
              <div style={{ ...mutedText, marginBottom: "0.75rem" }}>{wf.description}</div>
            )}
            {websiteUrl && (
              <div style={{ fontSize: "0.8rem", color: BRAND, marginBottom: "0.75rem" }}>
                {websiteUrl}
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                פרטים טכניים
              </div>
              <div style={{ ...gridRow, gridTemplateColumns: "1fr" }}>
                <span>{wf.isHttps ? "✓ HTTPS מאובטח" : "✗ אין HTTPS"}</span>
                <span>{wf.hasMobileViewport ? "✓ מותאם למובייל" : "✗ לא מותאם למובייל"}</span>
                <span>{wf.hasSchemaMarkup ? "✓ Schema Markup" : "✗ אין Schema Markup"}</span>
                <span>{wf.hasLazyLoading ? "✓ Lazy Loading" : "✗ אין Lazy Loading"}</span>
                <span>{wf.hasFavicon ? "✓ Favicon" : "✗ אין Favicon"}</span>
                <span>{wf.ogImage ? "✓ OG Image" : "✗ אין OG Image"}</span>
                {wf.cms && wf.cms !== "unknown" && <span>CMS: {wf.cms}</span>}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                תוכן ושיווק
              </div>
              <div style={{ ...gridRow, gridTemplateColumns: "1fr" }}>
                <span>{wf.hasContactForm ? "✓ טופס צור קשר" : "✗ אין טופס"}</span>
                <span>{wf.hasPhoneNumber ? "✓ מספר טלפון" : "✗ אין טלפון"}</span>
                <span>{wf.hasWhatsApp ? "✓ WhatsApp" : "✗ אין WhatsApp"}</span>
                <span>{wf.hasGoogleAnalytics ? "✓ Google Analytics" : "✗ אין Analytics"}</span>
                <span>{wf.hasBlog ? "✓ בלוג פעיל" : "✗ אין בלוג"}</span>
                {wf.wordCount && <span>מילים: {wf.wordCount.toLocaleString()}</span>}
                {wf.imageCount != null && <span>תמונות: {wf.imageCount}</span>}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                מדדים
              </div>
              <div style={{ ...gridRow, gridTemplateColumns: "1fr" }}>
                {wf.pageSizeKB && <span>גודל עמוד: {wf.pageSizeKB} KB</span>}
                {wf.internalLinkCount != null && <span>לינקים פנימיים: {wf.internalLinkCount}</span>}
                {wf.externalLinkCount != null && <span>לינקים חיצוניים: {wf.externalLinkCount}</span>}
                {wf.cssFileCount != null && <span>קבצי CSS: {wf.cssFileCount}</span>}
                {wf.jsFileCount != null && <span>קבצי JS: {wf.jsFileCount}</span>}
                {wf.detectedLanguages?.length > 0 && (
                  <span>שפות: {wf.detectedLanguages.join(", ")}</span>
                )}
              </div>
            </div>
          </div>

          {/* SEO Issues inline */}
          {seo.issues?.length > 0 && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem", color: "#f97316" }}>
                בעיות שזוהו ({seo.issues.length})
              </div>
              {seo.issues.map((issue: string, i: number) => (
                <div
                  key={i}
                  style={{
                    fontSize: "0.85rem",
                    padding: "0.4rem 0",
                    borderBottom:
                      i < seo.issues.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    color: "var(--foreground-muted)",
                  }}
                >
                  &#9888; {issue}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ PageSpeed ═══ */}
      {pageSpeed && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            ביצועי אתר — PageSpeed
            {pageSpeed.estimated && (
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "#f97316",
                  background: "#f9731620",
                  padding: "0.15rem 0.55rem",
                  borderRadius: 10,
                  marginRight: "0.5rem",
                }}
              >
                הערכה
              </span>
            )}
          </div>
          {pageSpeed.estimated && (
            <div style={{ ...mutedText, marginBottom: "0.75rem", fontSize: "0.78rem" }}>
              המדדים מוערכים מתוך ניתוח קוד האתר (לא נמדדו ב-PageSpeed API). FCP/LCP/CLS אינם זמינים בהערכה.
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            {[
              { label: "ביצועים", value: pageSpeed.performanceScore },
              { label: "נגישות", value: pageSpeed.accessibilityScore },
              { label: "SEO", value: pageSpeed.seoScore },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  textAlign: "center",
                  padding: "1rem",
                  borderRadius: 8,
                  background: `${scoreColor(m.value)}10`,
                  border: `1px solid ${scoreColor(m.value)}30`,
                }}
              >
                <div style={{ ...mutedText, fontSize: "0.8rem" }}>{m.label}</div>
                <div
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 800,
                    color: scoreColor(m.value),
                  }}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "0.5rem",
              fontSize: "0.85rem",
            }}
          >
            {pageSpeed.fcp && (
              <div>
                <span style={mutedText}>FCP: </span>
                <strong>{pageSpeed.fcp}</strong>
              </div>
            )}
            {pageSpeed.lcp && (
              <div>
                <span style={mutedText}>LCP: </span>
                <strong>{pageSpeed.lcp}</strong>
              </div>
            )}
            {pageSpeed.cls != null && (
              <div>
                <span style={mutedText}>CLS: </span>
                <strong>{pageSpeed.cls}</strong>
              </div>
            )}
            {pageSpeed.tbt && (
              <div>
                <span style={mutedText}>TBT: </span>
                <strong>{pageSpeed.tbt}</strong>
              </div>
            )}
            {pageSpeed.speedIndex && (
              <div>
                <span style={mutedText}>Speed Index: </span>
                <strong>{pageSpeed.speedIndex}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Social Presence ═══ */}
      {social && Object.keys(social).length > 0 && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>נוכחות ברשתות חברתיות</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            {(["facebook", "instagram", "linkedin", "tiktok"] as const).map((platform) => {
              const p = social[platform];
              const found = p?.found;
              const platformNames: Record<string, string> = {
                facebook: "פייסבוק",
                instagram: "אינסטגרם",
                linkedin: "לינקדאין",
                tiktok: "טיקטוק",
              };
              return (
                <div
                  key={platform}
                  style={{
                    padding: "1rem",
                    borderRadius: 8,
                    background: found ? `${BRAND}08` : "var(--surface)",
                    border: `1px solid ${found ? BRAND + "30" : "var(--border)"}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                      {platformNames[platform]}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.6rem",
                        borderRadius: 12,
                        background: found ? "#22c55e20" : "#ef444420",
                        color: found ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {found ? "נמצא" : "לא נמצא"}
                    </span>
                  </div>
                  {found && (
                    <div style={{ fontSize: "0.8rem" }}>
                      {p.name && (
                        <div style={{ marginBottom: "0.25rem" }}>
                          <strong>שם:</strong> {p.name}
                        </div>
                      )}
                      {p.description && (
                        <div
                          style={{
                            ...mutedText,
                            fontSize: "0.8rem",
                            marginBottom: "0.25rem",
                            maxHeight: "3rem",
                            overflow: "hidden",
                          }}
                        >
                          {p.description}
                        </div>
                      )}
                      {p.followers != null && (
                        <div>
                          <strong>עוקבים:</strong> {Number(p.followers).toLocaleString()}
                        </div>
                      )}
                      {p.likes != null && (
                        <div>
                          <strong>לייקים:</strong> {Number(p.likes).toLocaleString()}
                        </div>
                      )}
                      {p.url && (
                        <div style={{ marginTop: "0.5rem" }}>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: BRAND, fontSize: "0.75rem", textDecoration: "none" }}
                          >
                            צפה בפרופיל &#8599;
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Social Deep Analysis (per platform) ═══ */}
      {socialDeep && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>ניתוח מעמיק — רשתות חברתיות</div>

          {socialDeep.overallAssessment && (
            <p style={{ fontSize: "0.9rem", lineHeight: 1.7, marginTop: 0, marginBottom: "1rem", color: "var(--foreground)" }}>
              {socialDeep.overallAssessment}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {(socialDeep.platformAnalyses || []).map((pa: any, i: number) => {
              const live = social[pa.platform] || {};
              return (
                <div
                  key={i}
                  style={{
                    padding: "1rem",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                      {platformNamesHe[pa.platform] || pa.platform}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {live.followers != null && (
                        <span style={{ ...mutedText }}>עוקבים: {Number(live.followers).toLocaleString()}</span>
                      )}
                      {live.likes != null && (
                        <span style={{ ...mutedText }}>לייקים: {Number(live.likes).toLocaleString()}</span>
                      )}
                      {pa.score != null && (
                        <span style={{ fontWeight: 700, color: scoreColor(pa.score) }}>{pa.score}/100</span>
                      )}
                    </div>
                  </div>
                  {pa.analysis && (
                    <p style={{ fontSize: "0.88rem", lineHeight: 1.7, margin: "0 0 0.5rem", color: "var(--foreground)" }}>
                      {pa.analysis}
                    </p>
                  )}
                  {pa.recommendations?.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.25rem", color: BRAND }}>המלצות:</div>
                      {pa.recommendations.map((rec: string, ri: number) => (
                        <div key={ri} style={{ ...mutedText, fontSize: "0.82rem", paddingRight: "0.75rem" }}>• {rec}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {socialDeep.contentStrategy && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>אסטרטגיית תוכן מומלצת</div>
              <p style={{ fontSize: "0.88rem", lineHeight: 1.7, margin: 0, color: "var(--foreground)" }}>{socialDeep.contentStrategy}</p>
            </div>
          )}

          {socialDeep.missingOpportunities?.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem", color: "#f97316" }}>הזדמנויות שלא מנוצלות</div>
              {socialDeep.missingOpportunities.map((op: string, oi: number) => (
                <div key={oi} style={{ ...mutedText, fontSize: "0.82rem", paddingRight: "0.75rem" }}>• {op}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Google Presence ═══ */}
      {google && (google.found || google.organic || google.localPack || google.reviews) && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>נוכחות בגוגל</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Organic */}
            <div
              style={{
                padding: "1rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                חיפוש אורגני
              </div>
              {google.organic?.found ? (
                <div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 800,
                      color: google.organic.position <= 3 ? "#22c55e" : google.organic.position <= 10 ? "#f97316" : "#ef4444",
                    }}
                  >
                    מיקום #{google.organic.position}
                  </div>
                  {google.organic.results?.length > 0 && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                      {google.organic.results.slice(0, 3).map((r: any, i: number) => (
                        <div key={i} style={{ ...mutedText, marginBottom: "0.25rem" }}>
                          {r.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={mutedText}>לא נמצא בתוצאות אורגניות</div>
              )}
            </div>

            {/* Local Pack */}
            <div
              style={{
                padding: "1rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Local Pack
              </div>
              {google.localPack?.found ? (
                <div style={{ color: "#22c55e", fontWeight: 600 }}>
                  &#10003; מופיע ב-Local Pack
                </div>
              ) : (
                <div style={mutedText}>לא נמצא ב-Local Pack</div>
              )}
            </div>

            {/* Reviews */}
            <div
              style={{
                padding: "1rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                ביקורות
              </div>
              {google.reviews?.count ? (
                <div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: BRAND }}>
                    {google.reviews.rating}/5
                  </div>
                  <div style={mutedText}>
                    {google.reviews.count} ביקורות
                  </div>
                </div>
              ) : (
                <div style={mutedText}>לא נמצאו ביקורות</div>
              )}
            </div>
          </div>

          {/* Keyword positions — commercial phrases, not the brand name */}
          {keywordResults.length > 0 && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                מיקום במילות מפתח מסחריות
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {keywordResults.map((kw: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.85rem",
                      padding: "0.45rem 0.7rem",
                      borderRadius: 6,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ flex: 1 }}>&ldquo;{kw.keyword}&rdquo;</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: kw.found ? (kw.position <= 3 ? "#22c55e" : kw.position <= 10 ? "#f97316" : "#ef4444") : "var(--foreground-muted)",
                      }}
                    >
                      {kw.found ? `מיקום #${kw.position}` : "לא בעמוד הראשון"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ AI Visibility ═══ */}
      {geo && geo.platforms?.length > 0 && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>נראות במנועי AI</div>
          {geo.overallVisibility != null && (
            <div style={{ marginBottom: "1rem", textAlign: "center" }}>
              <span style={{ fontSize: "2rem", fontWeight: 800, color: scoreColor(geo.overallVisibility) }}>
                {geo.overallVisibility}%
              </span>
              <span style={{ ...mutedText, marginRight: "0.5rem" }}>נראות כוללת</span>
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {geo.platforms.map((p: any) => (
              <div
                key={p.platformId}
                style={{
                  padding: "0.75rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: p.found ? `${BRAND}08` : "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                    {p.platformName}
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: p.found ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {p.found ? "נמצא" : "לא נמצא"}
                  </span>
                </div>
                {p.mentionType && (
                  <div style={{ ...mutedText, fontSize: "0.75rem", marginTop: "0.25rem" }}>
                    סוג אזכור: {p.mentionType}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Competitors ═══ */}
      {competitors.competitors?.length > 0 && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>ניתוח מתחרים</div>
          {competitors.marketPosition && (
            <div style={{ ...mutedText, marginBottom: "1rem" }}>
              מיקום בשוק: {competitors.marketPosition}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "right", color: "var(--foreground-muted)", fontSize: "0.78rem" }}>
                  <th style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid var(--border)", width: 36 }}>#</th>
                  <th style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid var(--border)" }}>מתחרה</th>
                  <th style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid var(--border)" }}>דומיין</th>
                  <th style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid var(--border)", width: 120 }}>מיקום בחיפוש</th>
                  <th style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid var(--border)", width: 110 }}>נראות משוערת</th>
                </tr>
              </thead>
              <tbody>
                {competitors.competitors.map((c: any, i: number) => {
                  const pos = c.position ?? i + 1;
                  const vis = Math.max(10, Math.round(100 - (pos - 1) * 18));
                  return (
                    <tr key={i}>
                      <td style={{ padding: "0.55rem 0.6rem", borderBottom: "1px solid var(--border)", color: "var(--foreground-muted)" }}>{i + 1}</td>
                      <td style={{ padding: "0.55rem 0.6rem", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
                        {c.name || c.domain}
                        {c.strengths?.[0] && (
                          <div style={{ ...mutedText, fontSize: "0.72rem", fontWeight: 400, marginTop: "0.2rem" }}>{c.strengths[0]}</div>
                        )}
                      </td>
                      <td style={{ padding: "0.55rem 0.6rem", borderBottom: "1px solid var(--border)", direction: "ltr", textAlign: "right", color: BRAND }}>{c.domain || "-"}</td>
                      <td style={{ padding: "0.55rem 0.6rem", borderBottom: "1px solid var(--border)" }}>#{pos}</td>
                      <td style={{ padding: "0.55rem 0.6rem", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${vis}%`, background: scoreColor(vis), borderRadius: 3 }} />
                          </div>
                          <span style={{ fontWeight: 600, minWidth: 24 }}>{vis}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Meta Ad Library ═══ */}
      {adsLibrary?.checked && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>פרסום ממומן — ספריית המודעות של Meta</div>
          <div style={{ marginBottom: "1rem" }}>
            {adsLibrary.isAdvertising ? (
              <span style={{ fontWeight: 700, color: "#22c55e" }}>
                ✓ נמצאו {adsLibrary.activeAdsCount} מודעות פעילות
              </span>
            ) : (
              <span style={{ ...mutedText }}>לא נמצאו מודעות פעילות בספריית המודעות</span>
            )}
          </div>
          {adsLibrary.ads?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {adsLibrary.ads.map((ad: any, i: number) => (
                <div key={i} style={{ padding: "0.75rem 1rem", borderRadius: 8, border: "1px solid var(--border)", background: `${BRAND}05` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{ad.pageName || "—"}</span>
                    {ad.platforms?.length > 0 && (
                      <span style={{ ...mutedText, fontSize: "0.75rem" }}>{ad.platforms.join(", ")}</span>
                    )}
                  </div>
                  {ad.body && <div style={{ ...mutedText, fontSize: "0.82rem", marginBottom: "0.3rem" }}>{ad.body}</div>}
                  {ad.snapshotUrl && (
                    <a href={ad.snapshotUrl} target="_blank" rel="noopener noreferrer" style={{ color: BRAND, fontSize: "0.75rem", textDecoration: "none" }}>
                      צפה במודעה ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {adsLibrary && !adsLibrary.checked && adsLibrary.note && (
        <div style={{ ...cardStyle, ...mutedText }}>פרסום ממומן (Meta): {adsLibrary.note}</div>
      )}

      {/* ═══ AI Report (sections) ═══ */}
      {report?.sections?.length > 0 && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>דוח מחקר AI מלא</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {report.sections.map((section: any, si: number) => (
              <div key={si}>
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    marginBottom: "0.75rem",
                    color: BRAND,
                    borderBottom: `2px solid ${BRAND}30`,
                    paddingBottom: "0.5rem",
                  }}
                >
                  {si + 1}. {section.titleHe || section.title}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {(section.content || []).map((block: any, bi: number) => (
                    <p
                      key={bi}
                      style={{
                        margin: 0,
                        fontSize: "0.9rem",
                        lineHeight: 1.7,
                        color: "var(--foreground)",
                      }}
                    >
                      {block.text || block}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Quarter Plan ═══ */}
      {plan.goals?.length > 0 && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>
            תוכנית רבעונית {plan.quarter || ""}
          </div>
          {plan.estimatedROI && (
            <div style={{ ...mutedText, marginBottom: "1rem" }}>
              ROI משוער: {plan.estimatedROI}
              {plan.totalInvestment ? ` | השקעה: ₪${plan.totalInvestment.toLocaleString()}` : ""}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {plan.goals.map((goal: any, gi: number) => (
              <div
                key={gi}
                style={{
                  padding: "1rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                  {goal.titleHe || goal.title}
                </div>
                {goal.metric && (
                  <div style={{ ...mutedText, fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                    מדד: {goal.metric} ({goal.currentValue || "?"} &#8594; {goal.targetValue || "?"})
                  </div>
                )}
                {goal.actions?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {goal.actions.map((a: any, ai: number) => (
                      <div
                        key={ai}
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--foreground-muted)",
                          paddingRight: "0.75rem",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>שבוע {a.week}:</span>{" "}
                        {a.actionHe || a.action}
                        {a.responsible && (
                          <span style={{ color: BRAND, marginRight: "0.5rem", fontSize: "0.75rem" }}>
                            ({a.responsible})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Scan History ═══ */}
      {history.length > 0 && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>היסטוריית סריקות</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {history.map((item, i) => {
              const prevItem = history[i + 1]; // older item (list is newest-first)
              const currentScore = item.scores?.overall ?? null;
              const prevScore = prevItem?.scores?.overall ?? null;
              const diff = currentScore != null && prevScore != null ? currentScore - prevScore : null;

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.75rem 1rem",
                    borderRadius: 8,
                    border: `1px solid ${i === 0 ? BRAND + "40" : "var(--border)"}`,
                    background: i === 0 ? `${BRAND}08` : "transparent",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      {formatDate(item.completedAt || item.createdAt)}
                    </div>
                    <div style={{ ...mutedText, fontSize: "0.75rem" }}>
                      {item.status === "completed" ? "הושלם" : item.status === "scanning" ? "בסריקה..." : item.status === "failed" ? "נכשל" : "ממתין"}
                    </div>
                  </div>
                  {currentScore != null && (
                    <div style={{ textAlign: "center", minWidth: 60 }}>
                      <div
                        style={{
                          fontSize: "1.25rem",
                          fontWeight: 800,
                          color: scoreColor(currentScore),
                        }}
                      >
                        {currentScore}
                      </div>
                    </div>
                  )}
                  {diff != null && (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: diff > 0 ? "#22c55e" : diff < 0 ? "#ef4444" : "var(--foreground-muted)",
                        minWidth: 40,
                        textAlign: "center",
                      }}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </div>
                  )}
                  {/* Score bar */}
                  {currentScore != null && (
                    <div style={{ width: 100 }}>
                      <div style={{ ...barBg, marginTop: 0 }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${currentScore}%`,
                            background: scoreColor(currentScore),
                            borderRadius: 3,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Actions ═══ */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>פעולות</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <button
            onClick={handleViewPdf}
            style={{
              padding: "0.85rem 1.25rem",
              background: `linear-gradient(135deg, ${BRAND}, #0090cc)`,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            &#128196; צפה ב-PDF
          </button>

          <button
            onClick={handleApproveReport}
            style={{
              padding: "0.85rem 1.25rem",
              background: "#22c55e",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            &#10003; אישור דוח
          </button>

          <button
            onClick={handleSendEmail}
            style={{
              padding: "0.85rem 1.25rem",
              background: BRAND,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            &#9993; שלח במייל
          </button>

          <button
            onClick={handleRescan}
            style={{
              padding: "0.85rem 1.25rem",
              background: "var(--surface)",
              color: "var(--foreground-muted)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            &#128260; סריקה חוזרת
          </button>
        </div>
      </div>
    </div>
  );
}
