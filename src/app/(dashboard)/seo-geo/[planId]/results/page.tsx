'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
// Inline icon components — no external dependency
const IconSpan = ({ children, size = 48 }: { children: string; size?: number }) => (
  <span style={{ fontSize: size * 0.6, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>{children}</span>
);
const GoogleIcon = ({ width = 48, height = 48 }: { width?: number; height?: number }) => <IconSpan size={width}>🔍</IconSpan>;
const ChatGPTIcon = ({ width = 48, height = 48 }: { width?: number; height?: number }) => <IconSpan size={width}>🤖</IconSpan>;
const ClaudeIcon = ({ width = 48, height = 48 }: { width?: number; height?: number }) => <IconSpan size={width}>🧠</IconSpan>;
const BingIcon = ({ width = 48, height = 48 }: { width?: number; height?: number }) => <IconSpan size={width}>✨</IconSpan>;
const PerplexityIcon = ({ width = 48, height = 48 }: { width?: number; height?: number }) => <IconSpan size={width}>🔮</IconSpan>;
const WikipediaIcon = ({ width = 48, height = 48 }: { width?: number; height?: number }) => <IconSpan size={width}>📚</IconSpan>;
const ChevronLeftIcon = ({ width = 16, height = 16, style }: { width?: number; height?: number; style?: React.CSSProperties }) => (
  <span style={{ fontSize: width, lineHeight: 1, ...style }}>‹</span>
);

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
  neon: '#e9fe00', neonEnd: '#d3e200',
};

type ScanMode = 'real' | 'simulated' | 'unavailable';

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
  metaDescription?: string | null;
  aiOverviewExists?: boolean;
  answer?: string | null;
  mentionContext?: string | null;
  sources?: string[];
}

interface Metrics {
  totalQueries: number;
  totalMentions: number;
  overallVisibilityPct: number;
  perPlatform: Record<string, { queries: number; mentions: number; visibility: number }>;
}

interface ApiResponse {
  summaries: PlatformSummary[];
  metrics: Metrics;
  results?: PlatformResult[];
}

interface Plan {
  id: string;
  name: string;
}

const platformIcons: Record<string, React.ReactNode> = {
  google: <GoogleIcon width={48} height={48} />,
  chatgpt: <ChatGPTIcon width={48} height={48} />,
  claude: <ClaudeIcon width={48} height={48} />,
  bing: <BingIcon width={48} height={48} />,
  perplexity: <PerplexityIcon width={48} height={48} />,
  wikipedia: <WikipediaIcon width={48} height={48} />,
};

const platformDisplayNames: Record<string, string> = {
  google: 'Google SEO',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  bing: 'Bing',
  perplexity: 'Perplexity',
  wikipedia: 'Wikipedia',
};

const platformDescriptions: Record<string, string> = {
  google: 'נראות בתוצאות חיפוש אורגנית של Google',
  chatgpt: 'אזכורים בתשובות של ChatGPT',
  claude: 'אזכורים בתשובות של Claude',
  bing: 'נראות בתוצאות חיפוש של Bing',
  perplexity: 'אזכורים בתשובות של Perplexity',
  wikipedia: 'אזכורים וקישורים בויקיפדיה',
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.planId as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [summaries, setSummaries] = useState<PlatformSummary[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [results, setResults] = useState<PlatformResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'opportunities' | 'high_rank' | 'ai_mentions'
  >('all');
  const [sortBy, setSortBy] = useState<
    'platform' | 'query' | 'mentioned' | 'opportunity' | 'scan_mode'
  >('platform');
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch plan
        const planResponse = await fetch(`/api/seo-geo-plans/${planId}`);
        if (!planResponse.ok) throw new Error('Failed to load plan');
        const planData = await planResponse.json();
        setPlan(planData);

        // Fetch results
        const resultsResponse = await fetch(
          `/api/seo-geo-plans/${planId}/results?platform=all`
        );
        if (!resultsResponse.ok) throw new Error('Failed to load results');
        const data: ApiResponse = await resultsResponse.json();

        setSummaries(data.summaries || []);
        setMetrics(data.metrics || null);
        setResults(data.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching results:', err);
      } finally {
        setLoading(false);
      }
    };

    if (planId) fetchData();
  }, [planId]);

  const filteredResults = results.filter((result) => {
    if (activeFilter === 'opportunities') {
      return !result.mentioned;
    }
    if (activeFilter === 'high_rank') {
      return result.opportunityScore >= 75;
    }
    if (activeFilter === 'ai_mentions') {
      return result.mentioned && result.platformId !== 'google';
    }
    return true;
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    switch (sortBy) {
      case 'query':
        return a.query.localeCompare(b.query);
      case 'mentioned':
        return (b.mentioned ? 1 : 0) - (a.mentioned ? 1 : 0);
      case 'opportunity':
        return b.opportunityScore - a.opportunityScore;
      case 'scan_mode':
        return a.scanMode.localeCompare(b.scanMode);
      case 'platform':
      default:
        return a.platformId.localeCompare(b.platformId);
    }
  });

  const getScanModeLabel = (mode: ScanMode): string => {
    const labels: Record<ScanMode, string> = {
      real: 'אמיתי',
      simulated: 'סימולציה',
      unavailable: 'לא זמין',
    };
    return labels[mode];
  };

  const getScanModeColor = (mode: ScanMode): string => {
    const colors: Record<ScanMode, string> = {
      real: C.success,
      simulated: C.warning,
      unavailable: C.textMuted,
    };
    return colors[mode];
  };

  const handlePlatformCardClick = (platformId: string) => {
    router.push(`/seo-geo/${planId}/results/${platformId}`);
  };

  const handleRowHover = (rowId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoveredRowId(rowId);
    setTooltipPos({ x: rect.right + 10, y: rect.top });
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: C.bg,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            color: C.textSecondary,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: `3px solid ${C.borderLight}`,
              borderTop: `3px solid ${C.primary}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p>טוען תוצאות...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: C.bg,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            color: C.danger,
            maxWidth: '400px',
          }}
        >
          <p style={{ marginBottom: '16px', fontSize: '16px' }}>שגיאה בטעינת הנתונים</p>
          <p style={{ color: C.textSecondary, fontSize: '14px', marginBottom: '24px' }}>
            {error}
          </p>
          <button
            onClick={() => router.back()}
            style={{
              padding: '8px 16px',
              backgroundColor: C.primary,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            חזור
          </button>
        </div>
      </div>
    );
  }

  const isEmpty = !summaries.length && !results.length;

  return (
    <div
      style={{
        backgroundColor: C.bg,
        minHeight: '100vh',
        direction: 'rtl',
        paddingBottom: '60px',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: C.card,
          borderBottom: `1px solid ${C.border}`,
          padding: '24px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <button
            onClick={() => router.push(`/seo-geo/${planId}`)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: C.primary,
              fontSize: '14px',
            }}
          >
            <ChevronLeftIcon width={16} height={16} style={{ transform: 'scaleX(-1)' }} />
            חזרה לתוכנית
          </button>
        </div>
        <div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: C.text,
              margin: '0 0 8px 0',
            }}
          >
            תוצאות ונראות
          </h1>
          {plan && (
            <p
              style={{
                fontSize: '14px',
                color: C.textSecondary,
                margin: '0',
              }}
            >
              {plan.name}
            </p>
          )}
        </div>
      </div>

      {isEmpty ? (
        /* Empty State */
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '300px' }}>
            <p
              style={{
                fontSize: '16px',
                color: C.textSecondary,
                marginBottom: '16px',
              }}
            >
              אין נתוני סריקה עדיין. הרץ סריקת נראות מהאשף כדי לקבל תוצאות.
            </p>
            <button
              onClick={() => router.push(`/seo-geo/${planId}`)}
              style={{
                padding: '10px 24px',
                backgroundColor: C.primary,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              חזור לתוכנית
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Global Metrics Row */}
          {metrics && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
                padding: '0 24px',
                marginBottom: '32px',
              }}
            >
              <MetricCard
                label="סה״כ שאילתות שנסרקו"
                value={metrics.totalQueries.toString()}
                icon="📊"
              />
              <MetricCard
                label="סה״כ אזכורים"
                value={metrics.totalMentions.toString()}
                icon="💬"
              />
              <MetricCard
                label="נראות AI כוללת"
                value={`${metrics.overallVisibilityPct}%`}
                icon="👁️"
              />
              <MetricCard
                label="פלטפורמות פעילות"
                value={summaries.length.toString()}
                icon="🌐"
              />
            </div>
          )}

          {/* Platform Cards Row */}
          <div
            style={{
              padding: '0 24px',
              marginBottom: '32px',
              overflowX: 'auto',
              overflowY: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '16px',
                paddingBottom: '8px',
              }}
            >
              {summaries.map((summary) => (
                <PlatformCard
                  key={summary.platformId}
                  summary={summary}
                  onClick={() => handlePlatformCardClick(summary.platformId)}
                />
              ))}
            </div>
          </div>

          {/* Quick Filters */}
          <div
            style={{
              padding: '0 24px',
              marginBottom: '32px',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {(
              [
                { id: 'all', label: 'הכל' },
                { id: 'opportunities', label: 'הזדמנויות בלבד' },
                { id: 'high_rank', label: 'דירוג גבוה' },
                { id: 'ai_mentions', label: 'אזכורי AI' },
              ] as Array<{
                id: 'all' | 'opportunities' | 'high_rank' | 'ai_mentions';
                label: string;
              }>
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: activeFilter === filter.id ? C.primary : C.card,
                  color: activeFilter === filter.id ? '#FFFFFF' : C.text,
                  border: `1px solid ${activeFilter === filter.id ? C.primary : C.border}`,
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeFilter === filter.id ? '600' : '400',
                  transition: 'all 0.2s ease',
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Results Table */}
          <div
            style={{
              padding: '0 24px',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                backgroundColor: C.card,
                borderRadius: '8px',
                border: `1px solid ${C.border}`,
                overflow: 'hidden',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  direction: 'rtl',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: C.bg,
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {[
                      { id: 'platform', label: 'פלטפורמה' },
                      { id: 'query', label: 'שאילתה' },
                      { id: 'mentioned', label: 'מוזכר?' },
                      { id: 'opportunity', label: 'ציון הזדמנות' },
                      { id: 'scan_mode', label: 'מצב סריקה' },
                    ].map((col) => (
                      <th
                        key={col.id}
                        onClick={() =>
                          setSortBy(
                            col.id as
                              | 'platform'
                              | 'query'
                              | 'mentioned'
                              | 'opportunity'
                              | 'scan_mode'
                          )
                        }
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: C.textSecondary,
                          userSelect: 'none',
                          borderRight:
                            col.id !== 'platform' ? `1px solid ${C.borderLight}` : 'none',
                          backgroundColor: sortBy === col.id ? C.primaryLight : 'transparent',
                        }}
                      >
                        {col.label} {sortBy === col.id && '↓'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((result) => {
                    const platformName =
                      platformDisplayNames[result.platformId] || result.platformId;
                    const isMentioned = result.mentioned;
                    const rowId = result.id;

                    return (
                      <tr
                        key={rowId}
                        onMouseEnter={(e) => handleRowHover(rowId, e)}
                        onMouseLeave={() => {
                          setHoveredRowId(null);
                          setTooltipPos(null);
                        }}
                        style={{
                          borderBottom: `1px solid ${C.borderLight}`,
                          backgroundColor: !isMentioned ? '#FFEBEE' : C.card,
                          transition: 'background-color 0.2s ease',
                        }}
                      >
                        <td
                          style={{
                            padding: '12px 16px',
                            fontSize: '13px',
                            color: C.text,
                            fontWeight: '500',
                            borderRight: `1px solid ${C.borderLight}`,
                          }}
                        >
                          {platformName}
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            fontSize: '13px',
                            color: C.text,
                            borderRight: `1px solid ${C.borderLight}`,
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {result.query}
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            fontSize: '13px',
                            color: isMentioned ? C.success : C.danger,
                            fontWeight: '500',
                            borderRight: `1px solid ${C.borderLight}`,
                          }}
                        >
                          {isMentioned ? '✓ כן' : '✗ לא'}
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            fontSize: '13px',
                            color: C.text,
                            borderRight: `1px solid ${C.borderLight}`,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <div
                              style={{
                                width: '100%',
                                maxWidth: '60px',
                                height: '4px',
                                backgroundColor: C.borderLight,
                                borderRadius: '2px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(result.opportunityScore, 100)}%`,
                                  backgroundColor: C.primary,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '12px', minWidth: '30px' }}>
                              {result.opportunityScore}
                            </span>
                          </div>
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            fontSize: '12px',
                            borderRight: `1px solid ${C.borderLight}`,
                          }}
                        >
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor:
                                getScanModeColor(result.scanMode) + '20',
                              padding: '4px 8px',
                              borderRadius: '12px',
                              color: getScanModeColor(result.scanMode),
                            }}
                          >
                            <div
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: getScanModeColor(result.scanMode),
                              }}
                            />
                            {getScanModeLabel(result.scanMode)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sortedResults.length === 0 && (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: C.textMuted,
                }}
              >
                לא נמצאו תוצאות עבור הסינון שנבחר
              </div>
            )}
          </div>

          {/* Export Buttons */}
          <div
            style={{
              padding: '0 24px',
              marginBottom: '32px',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-start',
            }}
          >
            <button
              style={{
                padding: '10px 20px',
                backgroundColor: C.primary,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
              }}
              title="TODO: Implement export by platform"
            >
              ייצוא לפי פלטפורמה
            </button>
            <button
              style={{
                padding: '10px 20px',
                backgroundColor: C.primary,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
              }}
              title="TODO: Implement full report export"
            >
              ייצוא דוח מלא
            </button>
          </div>
        </>
      )}

      {/* Tooltip */}
      {hoveredRowId && tooltipPos && (
        <div
          style={{
            position: 'fixed',
            top: `${tooltipPos.y}px`,
            left: `${tooltipPos.x}px`,
            backgroundColor: C.text,
            color: '#FFFFFF',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '12px',
            maxWidth: '300px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
          }}
        >
          {results.find((r) => r.id === hoveredRowId)?.evidence?.extractedSnippet ||
            'אין פרטים זמינים'}
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: string;
}

function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: C.card,
        borderRadius: '8px',
        border: `1px solid ${C.border}`,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: C.textSecondary,
            fontWeight: '500',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: '20px',
          }}
        >
          {icon}
        </span>
      </div>
      <p
        style={{
          fontSize: '24px',
          fontWeight: '700',
          color: C.text,
          margin: '0',
        }}
      >
        {value}
      </p>
    </div>
  );
}

interface PlatformCardProps {
  summary: PlatformSummary;
  onClick: () => void;
}

function PlatformCard({ summary, onClick }: PlatformCardProps) {
  const platformName = platformDisplayNames[summary.platformId] || summary.platformId;
  const platformDesc =
    platformDescriptions[summary.platformId] || 'Platform data';

  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: C.card,
        borderRadius: '8px',
        border: `1px solid ${C.border}`,
        padding: '20px',
        cursor: 'pointer',
        minWidth: '260px',
        textAlign: 'right',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = C.primary;
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 4px 12px rgba(0,181,254,0.1)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = C.border;
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Icon */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        {platformIcons[summary.platformId] || <div style={{ width: '48px', height: '48px' }} />}
      </div>

      {/* Name & Description */}
      <div>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: C.text,
            margin: '0 0 4px 0',
          }}
        >
          {platformName}
        </h3>
        <p
          style={{
            fontSize: '12px',
            color: C.textSecondary,
            margin: '0',
          }}
        >
          {platformDesc}
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}
      >
        <div
          style={{
            padding: '8px',
            backgroundColor: C.bg,
            borderRadius: '4px',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              color: C.textMuted,
              margin: '0 0 4px 0',
            }}
          >
            שאילתות
          </p>
          <p
            style={{
              fontSize: '16px',
              fontWeight: '700',
              color: C.text,
              margin: '0',
            }}
          >
            {summary.queriesScanned}
          </p>
        </div>
        <div
          style={{
            padding: '8px',
            backgroundColor: C.bg,
            borderRadius: '4px',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              color: C.textMuted,
              margin: '0 0 4px 0',
            }}
          >
            אזכורים
          </p>
          <p
            style={{
              fontSize: '16px',
              fontWeight: '700',
              color: C.text,
              margin: '0',
            }}
          >
            {summary.mentions}
          </p>
        </div>
      </div>

      {/* Visibility & Mode */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor:
              getScanModeColor(summary.scanMode) + '20',
            padding: '4px 8px',
            borderRadius: '12px',
            color: getScanModeColor(summary.scanMode),
            fontSize: '11px',
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: getScanModeColor(summary.scanMode),
            }}
          />
          {getScanModeLabel(summary.scanMode)}
        </div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: '700',
            color: C.primary,
          }}
        >
          {summary.visibilityPct}%
        </div>
      </div>
    </button>
  );
}

function getScanModeColor(mode: ScanMode): string {
  const colors: Record<ScanMode, string> = {
    real: C.success,
    simulated: C.warning,
    unavailable: C.textMuted,
  };
  return colors[mode];
}

function getScanModeLabel(mode: ScanMode): string {
  const labels: Record<ScanMode, string> = {
    real: 'אמיתי',
    simulated: 'סימולציה',
    unavailable: 'לא זמין',
  };
  return labels[mode];
}
