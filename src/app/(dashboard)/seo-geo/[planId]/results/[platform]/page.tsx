'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const C = {
  primary: '#00B5FE',
  primaryDark: '#0095D0',
  primaryLight: '#E6F7FF',
  accent: '#E8F401',
  accentDark: '#C8D400',
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
  purple: '#8B5CF6',
};

type ScanMode = 'real' | 'simulated' | 'unavailable';

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
  metaDescription?: string | null;
  aiOverviewExists?: boolean;
  mentionPosition?: number | null;
  aiSnippet?: string | null;
  sourceUrls?: string[];
  answer?: string | null;
  mentionContext?: string | null;
  sources?: string[];
}

interface ApiResponse {
  summaries: {
    totalQueries: number;
    totalMentions: number;
    visibilityPercentage: number;
    scanMode: ScanMode;
  };
  metrics: Record<string, number>;
  results: PlatformResult[];
}

const PLATFORM_CONFIG: Record<
  string,
  { name: string; icon: string; desc: string }
> = {
  google_seo: {
    name: 'Google SEO',
    icon: '🔍',
    desc: 'חיפוש אורגני',
  },
  google_ai_overview: {
    name: 'Google AI Overview',
    icon: '✨',
    desc: 'סקירת AI של גוגל',
  },
  gemini: {
    name: 'Gemini',
    icon: '💎',
    desc: 'מנוע AI של Google',
  },
  chatgpt: {
    name: 'ChatGPT',
    icon: '💬',
    desc: 'מנוע AI של OpenAI',
  },
  claude: {
    name: 'Claude',
    icon: '🧠',
    desc: 'מנוע AI של Anthropic',
  },
  perplexity: {
    name: 'Perplexity',
    icon: '🔮',
    desc: 'מנוע חיפוש AI',
  },
};

export default function PlatformDetailPage() {
  const router = useRouter();
  const params = useParams<{ planId: string; platform: string }>();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'mentioned' | 'not-mentioned' | 'opportunities'>(
    'all'
  );
  const [sortBy, setSortBy] = useState<'position' | 'opportunity' | 'date'>('position');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [actionDropdowns, setActionDropdowns] = useState<Set<string>>(new Set());

  const planId = params?.planId;
  const platform = params?.platform;

  useEffect(() => {
    if (!planId || !platform) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/seo-geo-plans/${planId}/results?platform=${platform}`
        );
        if (!res.ok) throw new Error('Failed to fetch results');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [planId, platform]);

  if (!platform || !PLATFORM_CONFIG[platform]) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: C.danger }}>פלטפורמה לא תקינה</p>
      </div>
    );
  }

  const config = PLATFORM_CONFIG[platform];
  const platformType = platform as keyof typeof PLATFORM_CONFIG;

  const filteredAndSortedResults = (() => {
    let filtered = data?.results || [];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((r) =>
        r.query.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply mention filter
    if (filterMode === 'mentioned') {
      filtered = filtered.filter((r) => r.mentioned);
    } else if (filterMode === 'not-mentioned') {
      filtered = filtered.filter((r) => !r.mentioned);
    } else if (filterMode === 'opportunities') {
      filtered = filtered.filter((r) => !r.mentioned || r.opportunityScore > 0.5);
    }

    // Apply sorting
    if (sortBy === 'position' && platformType === 'google_seo') {
      filtered = [...filtered].sort(
        (a, b) => (a.organicPosition || Infinity) - (b.organicPosition || Infinity)
      );
    } else if (sortBy === 'opportunity') {
      filtered = [...filtered].sort((a, b) => b.opportunityScore - a.opportunityScore);
    } else if (sortBy === 'date') {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
      );
    }

    return filtered;
  })();

  const toggleRowExpanded = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  };

  const toggleActionDropdown = (id: string) => {
    const newSet = new Set(actionDropdowns);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.clear();
      newSet.add(id);
    }
    setActionDropdowns(newSet);
  };

  const handleAction = (resultId: string, action: string) => {
    console.log(`Action: ${action} for result ${resultId}`);
    toggleActionDropdown(resultId);
  };

  // Extract the summary for THIS specific platform from the summaries array
  const platformSummary = data?.summaries
    ? (Array.isArray(data.summaries)
        ? data.summaries.find((s: any) => s.platformId === platform)
        : data.summaries)
    : null;

  const getScanModeBadgeColor = (scanMode: ScanMode) => {
    switch (scanMode) {
      case 'real':
        return C.success;
      case 'simulated':
        return C.warning;
      case 'unavailable':
        return C.textMuted;
      default:
        return C.textMuted;
    }
  };

  const getScanModeLabel = (scanMode: ScanMode) => {
    switch (scanMode) {
      case 'real':
        return 'אמיתי';
      case 'simulated':
        return 'סימולציה';
      case 'unavailable':
        return 'לא זמין';
      default:
        return '—';
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ backgroundColor: C.card, borderBottom: `1px solid ${C.border}`, padding: '1.5rem' }}>
        <Link
          href={`/seo-geo/${planId}/results`}
          style={{
            color: C.primary,
            textDecoration: 'none',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
          }}
        >
          ← חזרה לתוצאות
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '3rem' }}>{config.icon}</div>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: C.text }}>
              {config.name}
            </h1>
            <p style={{ margin: 0, color: C.textSecondary, fontSize: '0.95rem' }}>
              {config.desc}
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        {!loading && data && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginTop: '1.5rem',
            }}
          >
            <div
              style={{
                backgroundColor: C.primaryLight,
                padding: '1rem',
                borderRadius: '0.5rem',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', color: C.textSecondary, fontSize: '0.875rem' }}>
                שאילתות שנסרקו
              </p>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: C.primary }}>
                {platformSummary?.queriesScanned ?? 0}
              </p>
            </div>
            <div
              style={{
                backgroundColor: '#F0FDF4',
                padding: '1rem',
                borderRadius: '0.5rem',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', color: C.textSecondary, fontSize: '0.875rem' }}>
                אזכורים
              </p>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: C.success }}>
                {platformSummary?.mentions ?? 0}
              </p>
            </div>
            <div
              style={{
                backgroundColor: '#FFFBEB',
                padding: '1rem',
                borderRadius: '0.5rem',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', color: C.textSecondary, fontSize: '0.875rem' }}>
                נראות %
              </p>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: C.warning }}>
                {platformSummary?.visibilityPct ?? 0}%
              </p>
            </div>
            <div
              style={{
                backgroundColor: '#EEF2FF',
                padding: '1rem',
                borderRadius: '0.5rem',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', color: C.textSecondary, fontSize: '0.875rem' }}>
                מצב סריקה
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  color: C.info,
                  display: 'inline-block',
                  backgroundColor: '#DDD6FE',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.25rem',
                }}
              >
                {getScanModeLabel(platformSummary?.scanMode || 'unavailable')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Scan Mode Banner */}
      {!loading && data && (
        <>
          {platformSummary?.scanMode === 'simulated' && (
            <div
              style={{
                backgroundColor: C.warning,
                color: C.text,
                padding: '1rem',
                textAlign: 'center',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              ⚠️ סימולציה — לא נתונים אמיתיים
            </div>
          )}
          {platformSummary?.scanMode === 'unavailable' && (
            <div
              style={{
                backgroundColor: C.textMuted,
                color: C.card,
                padding: '1rem',
                textAlign: 'center',
                fontSize: '0.95rem',
              }}
            >
              אין חיבור API — לא ניתן לסרוק פלטפורמה זו
            </div>
          )}
        </>
      )}

      <div style={{ padding: '2rem' }}>
        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: C.textSecondary }}>טוען תוצאות...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            style={{
              backgroundColor: '#FEE2E2',
              color: C.danger,
              padding: '1.5rem',
              borderRadius: '0.5rem',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0 }}>שגיאה: {error}</p>
          </div>
        )}

        {/* Filters Row */}
        {!loading && data && (
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {/* Search Input */}
            <input
              type="text"
              placeholder="חיפוש מילת מפתח..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: `1px solid ${C.border}`,
                fontSize: '0.95rem',
                textAlign: 'right',
              }}
            />

            {/* Filter Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(['all', 'mentioned', 'not-mentioned', 'opportunities'] as const).map((mode) => {
                const labels: Record<typeof mode, string> = {
                  all: 'הכל',
                  mentioned: 'מוזכרים',
                  'not-mentioned': 'לא מוזכרים',
                  opportunities: 'הזדמנויות',
                };
                return (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      backgroundColor: filterMode === mode ? C.primary : C.card,
                      color: filterMode === mode ? C.card : C.text,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: filterMode === mode ? 'bold' : 'normal',
                      transition: 'all 0.2s',
                    }}
                  >
                    {labels[mode]}
                  </button>
                );
              })}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: `1px solid ${C.border}`,
                backgroundColor: C.card,
                color: C.text,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              <option value="position">לפי מיקום</option>
              <option value="opportunity">לפי ציון הזדמנות</option>
              <option value="date">לפי תאריך</option>
            </select>
          </div>
        )}

        {/* Results Table */}
        {!loading && data && filteredAndSortedResults.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: C.card,
                borderRadius: '0.5rem',
                overflow: 'hidden',
              }}
            >
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  {platformType === 'google_seo' && (
                    <>
                      <th style={tableHeaderStyle}>מילת מפתח</th>
                      <th style={tableHeaderStyle}>כוונת חיפוש</th>
                      <th style={tableHeaderStyle}>מיקום אורגני</th>
                      <th style={tableHeaderStyle}>כתובת דף</th>
                      <th style={tableHeaderStyle}>כותרת</th>
                      <th style={tableHeaderStyle}>תיאור מטא</th>
                      <th style={tableHeaderStyle}>מופיע?</th>
                      <th style={tableHeaderStyle}>תאריך</th>
                      <th style={tableHeaderStyle}>פעולה</th>
                    </>
                  )}
                  {platformType === 'google_ai_overview' && (
                    <>
                      <th style={tableHeaderStyle}>מילת מפתח</th>
                      <th style={tableHeaderStyle}>סקירת AI קיימת?</th>
                      <th style={tableHeaderStyle}>מופיע?</th>
                      <th style={tableHeaderStyle}>מיקום אזכור</th>
                      <th style={tableHeaderStyle}>מתחרים</th>
                      <th style={tableHeaderStyle}>קטע AI</th>
                      <th style={tableHeaderStyle}>מקורות</th>
                      <th style={tableHeaderStyle}>פעולה</th>
                    </>
                  )}
                  {['gemini', 'chatgpt', 'claude', 'perplexity'].includes(platformType) && (
                    <>
                      <th style={tableHeaderStyle}>שאלה</th>
                      <th style={tableHeaderStyle}>תשובה</th>
                      <th style={tableHeaderStyle}>מוזכר?</th>
                      <th style={tableHeaderStyle}>הקשר אזכור</th>
                      <th style={tableHeaderStyle}>מתחרים</th>
                      <th style={tableHeaderStyle}>מקורות</th>
                      <th style={tableHeaderStyle}>ציון ביטחון</th>
                      <th style={tableHeaderStyle}>פעולה</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedResults.map((result, idx) => {
                  const isTopPosition =
                    platformType === 'google_seo' &&
                    result.organicPosition &&
                    result.organicPosition <= 10;
                  const rowBgColor = !result.mentioned ? '#FEF2F2' : isTopPosition ? C.primaryLight : C.card;

                  return (
                    <tbody key={result.id}>
                      <tr
                        style={{
                          borderBottom: `1px solid ${C.border}`,
                          backgroundColor: rowBgColor,
                        }}
                      >
                        {platformType === 'google_seo' && (
                          <>
                            <td style={tableCellStyle}>{result.query}</td>
                            <td style={tableCellStyle}>{result.queryIntent}</td>
                            <td style={tableCellStyle}>
                              {result.organicPosition ? (
                                <span
                                  style={{
                                    backgroundColor: isTopPosition ? C.primary : C.bg,
                                    color: isTopPosition ? C.card : C.text,
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  #{result.organicPosition}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td style={{ ...tableCellStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {result.pageUrl ? (
                                <a
                                  href={result.pageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: C.primary, textDecoration: 'none' }}
                                >
                                  {truncateText(result.pageUrl, 50)}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td style={tableCellStyle}>{result.pageTitle ? truncateText(result.pageTitle, 50) : '—'}</td>
                            <td style={tableCellStyle}>
                              {result.metaDescription ? truncateText(result.metaDescription, 50) : '—'}
                            </td>
                            <td style={tableCellStyle}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: result.mentioned ? C.success : C.danger,
                                }}
                              />
                            </td>
                            <td style={tableCellStyle}>
                              {new Date(result.scannedAt).toLocaleDateString('he-IL')}
                            </td>
                          </>
                        )}
                        {platformType === 'google_ai_overview' && (
                          <>
                            <td style={tableCellStyle}>{result.query}</td>
                            <td style={tableCellStyle}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: result.aiOverviewExists ? C.success : C.danger,
                                }}
                              />
                            </td>
                            <td style={tableCellStyle}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: result.mentioned ? C.success : C.danger,
                                }}
                              />
                            </td>
                            <td style={tableCellStyle}>
                              {result.mentionPosition ? `#${result.mentionPosition}` : '—'}
                            </td>
                            <td style={tableCellStyle}>
                              {result.competitorsMentioned && result.competitorsMentioned.length > 0
                                ? result.competitorsMentioned.join(', ')
                                : '—'}
                            </td>
                            <td style={tableCellStyle}>
                              {result.aiSnippet ? truncateText(result.aiSnippet, 50) : '—'}
                            </td>
                            <td style={tableCellStyle}>
                              {result.sourceUrls && result.sourceUrls.length > 0
                                ? result.sourceUrls.length
                                : '—'}
                            </td>
                          </>
                        )}
                        {['gemini', 'chatgpt', 'claude', 'perplexity'].includes(platformType) && (
                          <>
                            <td style={tableCellStyle}>{result.query}</td>
                            <td style={tableCellStyle}>
                              <div
                                style={{
                                  maxWidth: '200px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {result.answer ? truncateText(result.answer, 50) : '—'}
                              </div>
                            </td>
                            <td style={tableCellStyle}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: result.mentioned ? C.success : C.danger,
                                }}
                              />
                            </td>
                            <td style={tableCellStyle}>
                              {result.mentionContext ? truncateText(result.mentionContext, 50) : '—'}
                            </td>
                            <td style={tableCellStyle}>
                              {result.competitorsMentioned && result.competitorsMentioned.length > 0
                                ? result.competitorsMentioned.join(', ')
                                : '—'}
                            </td>
                            <td style={tableCellStyle}>
                              {result.sources && result.sources.length > 0 ? result.sources.length : '—'}
                            </td>
                            <td style={tableCellStyle}>{Math.round(result.confidence)}%</td>
                          </>
                        )}
                        <td
                          style={{
                            ...tableCellStyle,
                            position: 'relative',
                            paddingRight: '0.5rem',
                          }}
                        >
                          {!result.mentioned && (
                            <span
                              style={{
                                backgroundColor: '#FEE2E2',
                                color: C.danger,
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                marginLeft: '0.5rem',
                              }}
                            >
                              הזדמנות
                            </span>
                          )}
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              onClick={() => toggleActionDropdown(result.id)}
                              style={{
                                backgroundColor: C.primary,
                                color: C.card,
                                border: 'none',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: 'bold',
                              }}
                            >
                              ⚡ תקן זאת
                            </button>
                            {actionDropdowns.has(result.id) && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  marginTop: '0.5rem',
                                  backgroundColor: C.card,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: '0.5rem',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                  zIndex: 10,
                                  minWidth: '150px',
                                }}
                              >
                                <button
                                  onClick={() => handleAction(result.id, 'create-content')}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: C.text,
                                    textAlign: 'right',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    borderBottom: `1px solid ${C.border}`,
                                  }}
                                >
                                  צור תוכן
                                </button>
                                <button
                                  onClick={() => handleAction(result.id, 'add-task')}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: C.text,
                                    textAlign: 'right',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    borderBottom: `1px solid ${C.border}`,
                                  }}
                                >
                                  הוסף משימה
                                </button>
                                <button
                                  onClick={() => handleAction(result.id, 'improve-page')}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: C.text,
                                    textAlign: 'right',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                  }}
                                >
                                  שפר דף
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Evidence Footer - Collapsible */}
                      <tr
                        style={{
                          backgroundColor: rowBgColor,
                          borderBottom: `1px solid ${C.border}`,
                          display: expandedRows.has(result.id) ? 'table-row' : 'none',
                        }}
                      >
                        <td colSpan={100} style={{ padding: '1rem' }}>
                          <div
                            style={{
                              backgroundColor: C.bg,
                              padding: '1rem',
                              borderRadius: '0.5rem',
                              textAlign: 'right',
                            }}
                          >
                            <h4 style={{ margin: '0 0 1rem 0', color: C.text, fontSize: '0.95rem' }}>
                              עדויות
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                              <div>
                                <p style={{ margin: '0 0 0.5rem 0', color: C.textSecondary, fontSize: '0.875rem', fontWeight: 'bold' }}>
                                  מקור
                                </p>
                                <p style={{ margin: 0, color: C.text, fontSize: '0.875rem' }}>
                                  {result.evidence.sourceUrl ? (
                                    <a href={result.evidence.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.primary }}>
                                      {truncateText(result.evidence.sourceUrl, 40)}
                                    </a>
                                  ) : (
                                    '—'
                                  )}
                                </p>
                              </div>
                              <div>
                                <p style={{ margin: '0 0 0.5rem 0', color: C.textSecondary, fontSize: '0.875rem', fontWeight: 'bold' }}>
                                  קטע
                                </p>
                                <p style={{ margin: 0, color: C.text, fontSize: '0.875rem' }}>
                                  {result.evidence.extractedSnippet ? truncateText(result.evidence.extractedSnippet, 60) : '—'}
                                </p>
                              </div>
                              <div>
                                <p style={{ margin: '0 0 0.5rem 0', color: C.textSecondary, fontSize: '0.875rem', fontWeight: 'bold' }}>
                                  ביטחון
                                </p>
                                <p style={{ margin: 0, color: C.text, fontSize: '0.875rem' }}>
                                  {Math.round(result.evidence.confidence)}%
                                </p>
                              </div>
                              <div>
                                <p style={{ margin: '0 0 0.5rem 0', color: C.textSecondary, fontSize: '0.875rem', fontWeight: 'bold' }}>
                                  מצב
                                </p>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    backgroundColor: getScanModeBadgeColor(result.evidence.scanMode),
                                    color: C.card,
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {getScanModeLabel(result.evidence.scanMode)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Expand Evidence Button */}
                      <tr
                        style={{
                          backgroundColor: rowBgColor,
                          borderBottom: idx === filteredAndSortedResults.length - 1 ? 'none' : `1px solid ${C.border}`,
                          display: 'none',
                        }}
                      />
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && data && filteredAndSortedResults.length === 0 && (
          <div
            style={{
              backgroundColor: C.card,
              padding: '3rem',
              borderRadius: '0.5rem',
              textAlign: 'center',
              color: C.textSecondary,
            }}
          >
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
              אין נתוני סריקה לפלטפורמה זו
            </p>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>הרץ סריקת נראות כדי לקבל תוצאות</p>
          </div>
        )}

        {/* Bottom Section */}
        {!loading && data && (
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginTop: '2rem',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => console.log('Export results')}
              style={{
                backgroundColor: C.primary,
                color: C.card,
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.95rem',
              }}
            >
              ייצוא תוצאות {config.name}
            </button>

            <Link
              href={`/seo-geo/${planId}/results`}
              style={{
                color: C.primary,
                textDecoration: 'none',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              ← חזרה לסקירת פלטפורמות
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Inline Styles
const tableHeaderStyle = {
  padding: '1rem',
  textAlign: 'right' as const,
  backgroundColor: C.primaryLight,
  color: C.text,
  fontWeight: 'bold',
  fontSize: '0.875rem',
  borderBottom: `2px solid ${C.border}`,
};

const tableCellStyle = {
  padding: '0.75rem 1rem',
  textAlign: 'right' as const,
  color: C.text,
  fontSize: '0.875rem',
  verticalAlign: 'top' as const,
};
