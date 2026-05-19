'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const C = {
  primary: '#00B5FE',
  primaryDark: '#0095D0',
  primaryLight: '#E6F7FF',
  accent: '#E8F401',
  bg: '#F7F9FC',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#5A5A7A',
  textMuted: '#9A9AB0',
  border: '#E8EAF0',
  borderLight: '#F0F2F5',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  neon: '#e9fe00',
  neonEnd: '#d3e200',
};

type ScanMode = 'real' | 'simulated' | 'unavailable';
type TabId = 'overview' | 'seo_keywords' | 'ai_visibility' | 'all_results';

interface PlatformSummary {
  platformId: string;
  platformName: string;
  icon: string;
  queriesScanned: number;
  mentions: number;
  visibilityPct: number;
  scanMode: ScanMode;
  lastScannedAt: string | null;
}

interface PlatformResult {
  id: string;
  platformId: string;
  query: string;
  queryCategory: string;
  queryIntent: string;
  mentioned: boolean;
  scanMode: ScanMode;
  confidence: number;
  competitorsMentioned: string[];
  opportunityScore: number;
  scannedAt: string;
  evidence: {
    sourceUrl: string | null;
    extractedSnippet: string | null;
    scanMode: ScanMode;
    confidence: number;
  };
  organicPosition?: number | null;
  pageUrl?: string | null;
  pageTitle?: string | null;
  answer?: string | null;
  mentionContext?: string | null;
  sources?: string[];
}

interface Metrics {
  totalQueries: number;
  totalMentions: number;
  overallVisibilityPct: number;
  perPlatform: any[];
}

interface ApiResponse {
  summaries: PlatformSummary[];
  metrics: Metrics;
  results?: PlatformResult[];
}

// ── Platform display config ──────────────────────────────────────────────────

const PLATFORM_DISPLAY: Record<string, { name: string; nameHe: string; icon: string; desc: string }> = {
  google_seo: { name: 'Google SEO', nameHe: 'Google חיפוש', icon: '🔍', desc: 'דירוג ונראות בתוצאות חיפוש אורגנית של Google' },
  google_ai_overview: { name: 'Google AI Overview', nameHe: 'AI Overview של Google', icon: '✨', desc: 'סיכומי AI בתוצאות חיפוש של Google' },
  gemini: { name: 'Gemini', nameHe: 'Gemini', icon: '💎', desc: 'אזכורים בתשובות של Google Gemini' },
  chatgpt: { name: 'ChatGPT', nameHe: 'ChatGPT', icon: '🤖', desc: 'אזכורים בתשובות של ChatGPT' },
  claude: { name: 'Claude', nameHe: 'Claude', icon: '🧠', desc: 'אזכורים בתשובות של Claude' },
  perplexity: { name: 'Perplexity', nameHe: 'Perplexity', icon: '🔮', desc: 'אזכורים בתשובות של Perplexity' },
};

function getPlatformName(id: string): string {
  return PLATFORM_DISPLAY[id]?.nameHe || PLATFORM_DISPLAY[id]?.name || id;
}
function getPlatformIcon(id: string): string {
  return PLATFORM_DISPLAY[id]?.icon || '📊';
}
function getPlatformDesc(id: string): string {
  return PLATFORM_DISPLAY[id]?.desc || 'נתוני פלטפורמה';
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)));
}

function scanModeLabel(mode: ScanMode): string {
  return { real: 'אמיתי', simulated: 'סימולציה', unavailable: 'לא זמין' }[mode];
}
function scanModeColor(mode: ScanMode): string {
  return { real: C.success, simulated: C.warning, unavailable: C.textMuted }[mode];
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.planId as string;

  const [plan, setPlan] = useState<any>(null);
  const [summaries, setSummaries] = useState<PlatformSummary[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [results, setResults] = useState<PlatformResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const planResponse = await fetch(`/api/seo-geo-plans/${planId}`);
        if (!planResponse.ok) throw new Error('שגיאה בטעינת התוכנית');
        const planData = await planResponse.json();
        setPlan(planData);

        const resultsResponse = await fetch(`/api/seo-geo-plans/${planId}/results?platform=all`);
        if (!resultsResponse.ok) throw new Error('שגיאה בטעינת התוצאות');
        const data: ApiResponse = await resultsResponse.json();

        setSummaries(data.summaries || []);
        setMetrics(data.metrics || null);
        setResults(data.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'שגיאה לא צפויה');
      } finally {
        setLoading(false);
      }
    };
    if (planId) fetchData();
  }, [planId]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const seoResults = results.filter(r => r.platformId === 'google_seo' || r.platformId === 'google_ai_overview');
  const aiResults = results.filter(r => !['google_seo', 'google_ai_overview'].includes(r.platformId));
  const seoSummaries = summaries.filter(s => s.platformId === 'google_seo' || s.platformId === 'google_ai_overview');
  const aiSummaries = summaries.filter(s => !['google_seo', 'google_ai_overview'].includes(s.platformId));

  // Group results by query for the keyword view
  const keywordMap = new Map<string, PlatformResult[]>();
  for (const r of results) {
    const key = decodeHtmlEntities(r.query);
    if (!keywordMap.has(key)) keywordMap.set(key, []);
    keywordMap.get(key)!.push(r);
  }

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: C.bg, direction: 'rtl' }}>
        <div style={{ textAlign: 'center', color: C.textSecondary }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${C.borderLight}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>טוען תוצאות...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: C.bg, direction: 'rtl' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ color: C.danger, fontSize: 16, marginBottom: 16 }}>שגיאה בטעינת הנתונים</p>
          <p style={{ color: C.textSecondary, fontSize: 14, marginBottom: 24 }}>{error}</p>
          <button onClick={() => router.back()} style={{ padding: '8px 16px', backgroundColor: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            חזור
          </button>
        </div>
      </div>
    );
  }

  const isEmpty = !summaries.length && !results.length;

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'סקירה כללית' },
    { id: 'seo_keywords', label: 'ביטויי SEO ודירוג', count: seoResults.length },
    { id: 'ai_visibility', label: 'נראות AI', count: aiResults.length },
    { id: 'all_results', label: 'כל התוצאות', count: results.length },
  ];

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', direction: 'rtl', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ backgroundColor: C.card, borderBottom: `1px solid ${C.border}`, padding: '24px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => router.push(`/seo-geo/${planId}`)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: C.primary, fontSize: 14 }}
          >
            ‹ חזרה לתוכנית
          </button>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>תוצאות ונראות</h1>
        {plan && <p style={{ fontSize: 14, color: C.textSecondary, margin: '0 0 20px' }}>{plan.name || plan.businessName || ''}</p>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? C.primary : C.textSecondary,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${C.primary}` : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
              {tab.count !== undefined && <span style={{ marginRight: 6, fontSize: 11, color: C.textMuted }}>({tab.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center' }}>
          <div style={{ maxWidth: 300 }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>📊</p>
            <p style={{ fontSize: 16, color: C.textSecondary, marginBottom: 16 }}>אין נתוני סריקה עדיין</p>
            <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>הרץ סריקת נראות מהתוכנית כדי לקבל תוצאות</p>
            <button onClick={() => router.push(`/seo-geo/${planId}`)} style={{ padding: '10px 24px', backgroundColor: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
              חזור לתוכנית
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '24px' }}>
          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === 'overview' && (
            <>
              {/* AI Visibility Disclaimer */}
              <div style={{
                backgroundColor: '#FFF8E1',
                border: '1px solid #FFD54F',
                borderRadius: 10,
                padding: '14px 18px',
                marginBottom: 20,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                fontSize: 13,
                color: '#5D4037',
                lineHeight: 1.6,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>⚠️</span>
                <div>
                  <strong>הערה חשובה:</strong> תוצאות נראות AI הן תמונת מצב נקודתית בלבד. תשובות מנועי AI (ChatGPT, Gemini, Claude, Perplexity) משתנות בין שאילתות, מהדורות ומשתמשים — אין ערובה שהתוצאה תחזור על עצמה.
                  פלטפורמות המסומנות כ-<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, backgroundColor: C.success + '18', padding: '1px 6px', borderRadius: 8, color: C.success, fontSize: 11, fontWeight: 500, verticalAlign: 'middle' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: C.success }} />אמיתי</span> הוחזרו מה-API בפועל;
                  {' '}<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, backgroundColor: C.warning + '18', padding: '1px 6px', borderRadius: 8, color: C.warning, fontSize: 11, fontWeight: 500, verticalAlign: 'middle' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: C.warning }} />סימולציה</span> הן הערכה בלבד;
                  {' '}<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, backgroundColor: C.textMuted + '18', padding: '1px 6px', borderRadius: 8, color: C.textMuted, fontSize: 11, fontWeight: 500, verticalAlign: 'middle' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: C.textMuted }} />לא זמין</span> לא נבדקו (חסר מפתח API).
                </div>
              </div>

              {/* Global Metrics */}
              {metrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                  <MetricCard icon="📊" label="סה״כ שאילתות" value={String(metrics.totalQueries)} />
                  <MetricCard icon="💬" label="סה״כ אזכורים" value={String(metrics.totalMentions)} accent={metrics.totalMentions > 0} />
                  <MetricCard icon="👁️" label="נראות AI כוללת" value={`${metrics.overallVisibilityPct}%`} accent={metrics.overallVisibilityPct > 0} />
                  <MetricCard icon="🌐" label="פלטפורמות פעילות" value={String(summaries.filter(s => s.scanMode !== 'unavailable').length)} />
                </div>
              )}

              {/* Platform Cards */}
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>פלטפורמות</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 32 }}>
                {summaries.map(s => (
                  <PlatformCard key={s.platformId} summary={s} onClick={() => router.push(`/seo-geo/${planId}/results/${s.platformId}`)} />
                ))}
              </div>

              {/* Quick summary table */}
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>סיכום מהיר לפי ביטוי</h2>
              <div style={{ backgroundColor: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
                      <th style={thStyle}>ביטוי</th>
                      <th style={thStyle}>Google דירוג</th>
                      <th style={thStyle}>ChatGPT</th>
                      <th style={thStyle}>Gemini</th>
                      <th style={thStyle}>Claude</th>
                      <th style={thStyle}>Perplexity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(keywordMap.entries()).map(([query, queryResults]) => {
                      const google = queryResults.find(r => r.platformId === 'google_seo');
                      const chatgpt = queryResults.find(r => r.platformId === 'chatgpt');
                      const gemini = queryResults.find(r => r.platformId === 'gemini');
                      const claude = queryResults.find(r => r.platformId === 'claude');
                      const perplexity = queryResults.find(r => r.platformId === 'perplexity');

                      return (
                        <tr key={query} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                          <td style={{ ...tdStyle, fontWeight: 500, maxWidth: 250 }}>{query}</td>
                          <td style={tdStyle}>{google ? <PositionBadge result={google} /> : <ModeTag mode="unavailable" />}</td>
                          <td style={tdStyle}>{chatgpt ? <MentionBadge result={chatgpt} /> : <ModeTag mode="unavailable" />}</td>
                          <td style={tdStyle}>{gemini ? <MentionBadge result={gemini} /> : <ModeTag mode="unavailable" />}</td>
                          <td style={tdStyle}>{claude ? <MentionBadge result={claude} /> : <ModeTag mode="unavailable" />}</td>
                          <td style={tdStyle}>{perplexity ? <MentionBadge result={perplexity} /> : <ModeTag mode="unavailable" />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {keywordMap.size === 0 && (
                  <div style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>אין תוצאות</div>
                )}
              </div>
            </>
          )}

          {/* ═══ SEO KEYWORDS TAB ═══ */}
          {activeTab === 'seo_keywords' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                <MetricCard icon="🔍" label="ביטויים שנבדקו" value={String(seoResults.length)} />
                <MetricCard icon="📍" label="ביטויים שנמצאו" value={String(seoResults.filter(r => r.mentioned).length)} accent />
                <MetricCard icon="🏆" label="Top 3" value={String(seoResults.filter(r => r.mentioned && r.evidence?.confidence && r.evidence.confidence >= 70).length)} accent />
                <MetricCard icon="📈" label="הזדמנויות" value={String(seoResults.filter(r => !r.mentioned).length)} />
              </div>

              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>דירוג ביטויי חיפוש</h2>
              <div style={{ backgroundColor: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
                      <th style={thStyle}>ביטוי</th>
                      <th style={thStyle}>פלטפורמה</th>
                      <th style={thStyle}>נמצא?</th>
                      <th style={thStyle}>דירוג</th>
                      <th style={thStyle}>ביטחון</th>
                      <th style={thStyle}>תגובה / קטע</th>
                      <th style={thStyle}>מצב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seoResults.map(result => (
                      <tr key={result.id} style={{ borderBottom: `1px solid ${C.borderLight}`, backgroundColor: result.mentioned ? '#F0FFF4' : C.card }}>
                        <td style={{ ...tdStyle, fontWeight: 500, maxWidth: 220 }}>{decodeHtmlEntities(result.query)}</td>
                        <td style={tdStyle}>
                          <span>{getPlatformIcon(result.platformId)} {getPlatformName(result.platformId)}</span>
                        </td>
                        <td style={tdStyle}>
                          {result.mentioned
                            ? <span style={{ color: C.success, fontWeight: 600 }}>✓ כן</span>
                            : <span style={{ color: C.danger }}>✗ לא</span>
                          }
                        </td>
                        <td style={tdStyle}>
                          <PositionBadge result={result} />
                        </td>
                        <td style={tdStyle}>
                          <ConfidenceBar value={result.confidence} />
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 250, fontSize: 12, color: C.textSecondary }}>
                          {result.answer || result.evidence?.extractedSnippet
                            ? <SnippetCell text={decodeHtmlEntities(result.answer || result.evidence?.extractedSnippet || '')} id={result.id} expanded={expandedQuery} setExpanded={setExpandedQuery} />
                            : <span style={{ color: C.textMuted }}>—</span>
                          }
                        </td>
                        <td style={tdStyle}><ModeTag mode={result.scanMode} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {seoResults.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 8 }}>אין תוצאות SEO עדיין</p>
                    <p style={{ fontSize: 12, color: C.textMuted }}>הרץ סריקה עם מפתח Google API כדי לקבל דירוגים</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ AI VISIBILITY TAB ═══ */}
          {activeTab === 'ai_visibility' && (
            <>
              {/* AI Visibility Tab Disclaimer */}
              <div style={{
                backgroundColor: '#EDE7F6',
                border: '1px solid #B39DDB',
                borderRadius: 10,
                padding: '14px 18px',
                marginBottom: 20,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                fontSize: 13,
                color: '#4A148C',
                lineHeight: 1.6,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>🔮</span>
                <div>
                  <strong>על נראות AI:</strong> מנועי AI לא מחזירים תוצאות קבועות — אותה שאילתה יכולה להניב תשובות שונות בכל פעם. התוצאות כאן משקפות בדיקה חד-פעמית ולא מבטיחות נוכחות עתידית. שימו לב לעמודת <strong>״מצב״</strong> כדי להבחין בין תוצאות אמיתיות לסימולציה.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                <MetricCard icon="🤖" label="שאילתות AI" value={String(aiResults.length)} />
                <MetricCard icon="💬" label="אזכורים" value={String(aiResults.filter(r => r.mentioned).length)} accent />
                <MetricCard icon="📊" label="נראות %" value={`${aiResults.length > 0 ? Math.round((aiResults.filter(r => r.mentioned).length / aiResults.length) * 100) : 0}%`} />
                <MetricCard icon="🔌" label="פלטפורמות AI" value={String(aiSummaries.filter(s => s.scanMode !== 'unavailable').length)} />
              </div>

              {/* AI platform cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 32 }}>
                {aiSummaries.map(s => (
                  <PlatformCard key={s.platformId} summary={s} onClick={() => router.push(`/seo-geo/${planId}/results/${s.platformId}`)} />
                ))}
              </div>

              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>תוצאות נראות AI</h2>
              <div style={{ backgroundColor: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
                      <th style={thStyle}>ביטוי</th>
                      <th style={thStyle}>פלטפורמה</th>
                      <th style={thStyle}>מוזכר?</th>
                      <th style={thStyle}>ביטחון</th>
                      <th style={thStyle}>תשובת AI</th>
                      <th style={thStyle}>מצב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiResults.map(result => (
                      <tr key={result.id} style={{ borderBottom: `1px solid ${C.borderLight}`, backgroundColor: result.mentioned ? '#F0FFF4' : C.card }}>
                        <td style={{ ...tdStyle, fontWeight: 500, maxWidth: 220 }}>{decodeHtmlEntities(result.query)}</td>
                        <td style={tdStyle}>
                          <span>{getPlatformIcon(result.platformId)} {getPlatformName(result.platformId)}</span>
                        </td>
                        <td style={tdStyle}>
                          {result.mentioned
                            ? <span style={{ color: C.success, fontWeight: 600 }}>✓ מוזכר</span>
                            : <span style={{ color: C.danger }}>✗ לא מוזכר</span>
                          }
                        </td>
                        <td style={tdStyle}>
                          <ConfidenceBar value={result.confidence} />
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 280, fontSize: 12, color: C.textSecondary }}>
                          {result.answer || result.evidence?.extractedSnippet
                            ? <SnippetCell text={decodeHtmlEntities(result.answer || result.evidence?.extractedSnippet || '')} id={result.id} expanded={expandedQuery} setExpanded={setExpandedQuery} />
                            : <span style={{ color: C.textMuted }}>—</span>
                          }
                        </td>
                        <td style={tdStyle}><ModeTag mode={result.scanMode} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {aiResults.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center' }}>
                    <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 8 }}>אין תוצאות AI עדיין</p>
                    <p style={{ fontSize: 12, color: C.textMuted }}>הרץ סריקת AI עם מפתחות API מוגדרים</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ ALL RESULTS TAB ═══ */}
          {activeTab === 'all_results' && (
            <>
              <div style={{ backgroundColor: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
                      <th style={thStyle}>פלטפורמה</th>
                      <th style={thStyle}>ביטוי</th>
                      <th style={thStyle}>נמצא?</th>
                      <th style={thStyle}>ציון הזדמנות</th>
                      <th style={thStyle}>ביטחון</th>
                      <th style={thStyle}>תגובה</th>
                      <th style={thStyle}>מצב סריקה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(result => (
                      <tr key={result.id} style={{ borderBottom: `1px solid ${C.borderLight}`, backgroundColor: result.mentioned ? '#F0FFF4' : C.card }}>
                        <td style={tdStyle}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{getPlatformIcon(result.platformId)}</span>
                            <span style={{ fontWeight: 500 }}>{getPlatformName(result.platformId)}</span>
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 500, maxWidth: 200 }}>{decodeHtmlEntities(result.query)}</td>
                        <td style={tdStyle}>
                          {result.mentioned
                            ? <span style={{ color: C.success, fontWeight: 600 }}>✓ כן</span>
                            : <span style={{ color: C.danger }}>✗ לא</span>
                          }
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 4, background: C.borderLight, borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(result.opportunityScore, 100)}%`, background: result.opportunityScore >= 70 ? C.warning : C.primary }} />
                            </div>
                            <span style={{ fontSize: 12 }}>{result.opportunityScore}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <ConfidenceBar value={result.confidence} />
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 250, fontSize: 12, color: C.textSecondary }}>
                          {result.answer || result.evidence?.extractedSnippet
                            ? <SnippetCell text={decodeHtmlEntities(result.answer || result.evidence?.extractedSnippet || '')} id={result.id} expanded={expandedQuery} setExpanded={setExpandedQuery} />
                            : <span style={{ color: C.textMuted }}>—</span>
                          }
                        </td>
                        <td style={tdStyle}><ModeTag mode={result.scanMode} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.length === 0 && (
                  <div style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>לא נמצאו תוצאות</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared table styles ─────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'right',
  fontSize: 12,
  fontWeight: 600,
  color: C.textSecondary,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 13,
  color: C.text,
  verticalAlign: 'middle',
};

// ── Components ──────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ backgroundColor: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <p style={{ fontSize: 28, fontWeight: 700, color: accent ? C.primary : C.text, margin: 0 }}>{value}</p>
    </div>
  );
}

function PlatformCard({ summary, onClick }: { summary: PlatformSummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: C.card,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: 20,
        cursor: 'pointer',
        textAlign: 'right',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28 }}>{getPlatformIcon(summary.platformId)}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{getPlatformName(summary.platformId)}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{getPlatformDesc(summary.platformId)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: 8, background: C.bg, borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: C.textMuted }}>שאילתות</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{summary.queriesScanned}</div>
        </div>
        <div style={{ padding: 8, background: C.bg, borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: C.textMuted }}>אזכורים</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: summary.mentions > 0 ? C.success : C.text }}>{summary.mentions}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ModeTag mode={summary.scanMode} />
        <div style={{ fontSize: 16, fontWeight: 700, color: summary.visibilityPct > 0 ? C.success : C.textMuted }}>
          {summary.visibilityPct}%
        </div>
      </div>
    </button>
  );
}

function ModeTag({ mode }: { mode: ScanMode }) {
  const color = scanModeColor(mode);
  const tooltip: Record<ScanMode, string> = {
    real: 'תוצאה אמיתית מ-API של הפלטפורמה',
    simulated: 'הערכה בלבד — לא נבדק מול API אמיתי',
    unavailable: 'חסר מפתח API — לא נבדק',
  };
  return (
    <span title={tooltip[mode]} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, backgroundColor: color + '18', padding: '3px 8px', borderRadius: 10, color, fontSize: 11, fontWeight: 500, cursor: 'help' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {scanModeLabel(mode)}
    </span>
  );
}

function MentionBadge({ result }: { result: PlatformResult }) {
  if (result.scanMode === 'unavailable') return <ModeTag mode="unavailable" />;
  return result.mentioned
    ? <span style={{ color: C.success, fontWeight: 600, fontSize: 13 }}>✓ מוזכר</span>
    : <span style={{ color: C.textMuted, fontSize: 13 }}>✗ לא</span>;
}

function PositionBadge({ result }: { result: PlatformResult }) {
  if (result.scanMode === 'unavailable') return <ModeTag mode="unavailable" />;
  if (!result.mentioned) return <span style={{ color: C.textMuted, fontSize: 13 }}>לא נמצא</span>;

  const position = result.evidence?.confidence ? Math.ceil((100 - result.evidence.confidence) / 10) + 1 : null;
  // If the confidence is high and it was found, show approximate position
  if (result.confidence >= 70) {
    return <span style={{ color: C.success, fontWeight: 700, fontSize: 14 }}>#{position || '?'} 🏆</span>;
  }
  if (result.confidence >= 40) {
    return <span style={{ color: C.warning, fontWeight: 600, fontSize: 13 }}>#{position || '?'}</span>;
  }
  return <span style={{ color: C.success, fontSize: 13 }}>נמצא</span>;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? C.success : value >= 40 ? C.warning : C.textMuted;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 40, height: 4, background: C.borderLight, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 500 }}>{value}%</span>
    </div>
  );
}

function SnippetCell({ text, id, expanded, setExpanded }: { text: string; id: string; expanded: string | null; setExpanded: (id: string | null) => void }) {
  const isExpanded = expanded === id;
  const shortText = text.length > 80 ? text.slice(0, 80) + '...' : text;

  return (
    <div>
      <div style={{ lineHeight: 1.5, direction: 'ltr', textAlign: 'left' }}>
        {isExpanded ? text : shortText}
      </div>
      {text.length > 80 && (
        <button
          onClick={() => setExpanded(isExpanded ? null : id)}
          style={{ background: 'none', border: 'none', color: C.primary, fontSize: 11, cursor: 'pointer', padding: 0, marginTop: 4 }}
        >
          {isExpanded ? 'הצג פחות' : 'הצג עוד'}
        </button>
      )}
    </div>
  );
}
