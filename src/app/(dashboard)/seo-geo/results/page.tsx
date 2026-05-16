'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

// ==================== TYPES ====================
interface Client {
  id: string;
  name: string;
  website?: string;
}

interface GscQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  change?: number;
}

interface GscPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
}

interface GscTimeline {
  date: string;
  clicks: number;
  impressions: number;
}

interface WebVitals {
  lcp: number;
  inp: number;
  cls: number;
  performanceScore: number;
  opportunities: string[];
}

interface KeywordRank {
  keyword: string;
  position: number;
  change: number;
  trend: number[];
  lastUpdated: string;
}

interface AiPlatform {
  id: string;
  name: string;
  visible: boolean;
  mentions: number;
  lastChecked: string;
  trend: 'up' | 'down' | 'stable';
}

interface BacklinkData {
  total: number;
  newThisMonth: number;
  activeCampaigns: number;
  topDomains: { domain: string; authority: number }[];
}

interface EeatData {
  experience: number;
  expertise: number;
  authority: number;
  trust: number;
  overall: number;
  recommendations: string[];
}

interface GbpData {
  avgRating: number;
  totalReviews: number;
  responseRate: number;
  recentReviews: { author: string; rating: number; text: string; aiSuggestion?: string }[];
  localRankings: { keyword: string; position: number }[];
}

// ==================== STYLES ====================
const COLORS = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  primary: '#00B5FE',
  accent: '#E8F401',
  text: '#1A1A1A',
  textMuted: '#666666',
  border: '#e2e8f0',
  card: '#FFFFFF',
  bg: '#F7F9FC',
};

const cardStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 14,
  padding: '1.5rem',
  transition: 'box-shadow 200ms',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  borderRadius: 8,
  border: 'none',
  background: COLORS.primary,
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
  transition: 'all 150ms',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: COLORS.text,
  marginBottom: '1rem',
};

// ==================== SKELETON ====================
function Skeleton({ width = '100%', height = 20 }: { width?: string | number; height?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 6,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  );
}

// ==================== CIRCULAR GAUGE ====================
function CircularGauge({ value, max, label, unit, thresholds }: {
  value: number; max: number; label: string; unit: string;
  thresholds: { green: number; yellow: number };
}) {
  const pct = Math.min(value / max, 1);
  const color = value <= thresholds.green ? COLORS.green : value <= thresholds.yellow ? COLORS.yellow : COLORS.red;
  const circumference = 2 * Math.PI * 36;
  const strokeDasharray = `${pct * circumference} ${circumference}`;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="90" height="90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="#f0f0f0" strokeWidth="6" />
        <circle cx="40" cy="40" r="36" fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={strokeDasharray} strokeLinecap="round"
          transform="rotate(-90 40 40)" />
        <text x="40" y="38" textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>
          {typeof value === 'number' ? value.toFixed(value < 1 ? 2 : 0) : value}
        </text>
        <text x="40" y="52" textAnchor="middle" fontSize="8" fill={COLORS.textMuted}>{unit}</text>
      </svg>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.textMuted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ==================== SPARKLINE ====================
function Sparkline({ data, color = COLORS.primary }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 60, h = 20;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ==================== MAIN PAGE ====================
export default function SeoResultsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Data states
  const [gscTimeline, setGscTimeline] = useState<GscTimeline[]>([]);
  const [gscQueries, setGscQueries] = useState<GscQuery[]>([]);
  const [gscPages, setGscPages] = useState<GscPage[]>([]);
  const [gscConnected, setGscConnected] = useState(true);
  const [webVitals, setWebVitals] = useState<WebVitals | null>(null);
  const [vitalsDevice, setVitalsDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [keywords, setKeywords] = useState<KeywordRank[]>([]);
  const [keywordFilter, setKeywordFilter] = useState<'all' | 'improved' | 'declined' | 'new'>('all');
  const [aiPlatforms, setAiPlatforms] = useState<AiPlatform[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkData | null>(null);
  const [eeat, setEeat] = useState<EeatData | null>(null);
  const [gbp, setGbp] = useState<GbpData | null>(null);
  const [gbpConnected, setGbpConnected] = useState(true);

  const [loadingGsc, setLoadingGsc] = useState(false);
  const [loadingVitals, setLoadingVitals] = useState(false);
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingBacklinks, setLoadingBacklinks] = useState(false);
  const [loadingEeat, setLoadingEeat] = useState(false);
  const [loadingGbp, setLoadingGbp] = useState(false);

  // Fetch clients
  useEffect(() => {
    fetch('/api/data/clients')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.clients || [];
        setClients(list);
        if (list.length > 0) setSelectedClient(list[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch all data when client changes
  const fetchData = useCallback(async () => {
    if (!selectedClient) return;

    // GSC
    setLoadingGsc(true);
    try {
      const res = await fetch(`/api/seo/gsc?clientId=${selectedClient}&type=queries&days=30`);
      if (res.ok) {
        const data = await res.json();
        setGscTimeline(data.timeline || []);
        setGscQueries(data.queries || []);
        setGscPages(data.pages || []);
        setGscConnected(data.connected !== false);
      } else {
        setGscConnected(false);
      }
    } catch { setGscConnected(false); }
    setLoadingGsc(false);

    // PageSpeed
    setLoadingVitals(true);
    try {
      const client = clients.find(c => c.id === selectedClient);
      const url = client?.website || '';
      const res = await fetch(`/api/seo/pagespeed?url=${encodeURIComponent(url)}&device=${vitalsDevice}`);
      if (res.ok) setWebVitals(await res.json());
    } catch {}
    setLoadingVitals(false);

    // Keywords (from geo-boost endpoint)
    setLoadingKeywords(true);
    try {
      const res = await fetch(`/api/seo/geo-boost?clientId=${selectedClient}`);
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || []);
        setAiPlatforms(data.platforms || []);
      }
    } catch {}
    setLoadingKeywords(false);
    setLoadingAi(false);

    // Backlinks
    setLoadingBacklinks(true);
    try {
      const res = await fetch(`/api/seo/backlinks?clientId=${selectedClient}`);
      if (res.ok) setBacklinks(await res.json());
    } catch {}
    setLoadingBacklinks(false);

    // E-E-A-T
    setLoadingEeat(true);
    try {
      const res = await fetch(`/api/seo/eeat?clientId=${selectedClient}`);
      if (res.ok) setEeat(await res.json());
    } catch {}
    setLoadingEeat(false);

    // GBP
    setLoadingGbp(true);
    try {
      const res = await fetch(`/api/seo/gbp?clientId=${selectedClient}`);
      if (res.ok) {
        const data = await res.json();
        setGbp(data);
        setGbpConnected(data.connected !== false);
      } else {
        setGbpConnected(false);
      }
    } catch { setGbpConnected(false); }
    setLoadingGbp(false);
  }, [selectedClient, clients, vitalsDevice]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Computed KPIs
  const overallScore = Math.round(
    ((eeat?.overall || 0) * 0.25) +
    ((webVitals?.performanceScore || 0) * 0.25) +
    ((aiPlatforms.filter(p => p.visible).length / Math.max(aiPlatforms.length, 1)) * 100 * 0.25) +
    ((keywords.filter(k => k.position <= 10).length / Math.max(keywords.length, 1)) * 100 * 0.25)
  );
  const page1Keywords = keywords.filter(k => k.position <= 10).length;
  const avgImprovement = keywords.length > 0
    ? (keywords.reduce((s, k) => s + k.change, 0) / keywords.length).toFixed(1)
    : '0';
  const aiPresenceCount = aiPlatforms.filter(p => p.visible).length;
  const eeatScore = eeat?.overall || 0;

  // Filtered keywords
  const filteredKeywords = keywords.filter(k => {
    if (keywordFilter === 'improved') return k.change > 0;
    if (keywordFilter === 'declined') return k.change < 0;
    if (keywordFilter === 'new') return k.trend.length <= 2;
    return true;
  });

  if (loading) {
    return (
      <div style={{ direction: 'rtl', padding: '2rem', fontFamily: 'system-ui' }}>
        <Skeleton height={40} width="300px" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginTop: 24 }}>
          {[1,2,3,4,5].map(i => <Skeleton key={i} height={100} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl', padding: '2rem', fontFamily: 'system-ui', background: COLORS.bg, minHeight: '100vh' }}>
      {/* Shimmer keyframe */}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: COLORS.text, margin: 0 }}>
          תוצאות SEO/GEO - ביצועים בזמן אמת
        </h1>
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            fontSize: '0.9rem',
            fontWeight: 500,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* ==================== SECTION 1: Hero Stats Bar ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: '2rem' }}>
        {[
          { label: 'ציון ביצועים כולל', value: overallScore, suffix: '/100', color: overallScore >= 70 ? COLORS.green : overallScore >= 40 ? COLORS.yellow : COLORS.red },
          { label: 'ביטויים בעמוד 1 של גוגל', value: page1Keywords, suffix: '', color: COLORS.primary },
          { label: 'שיפור ממוצע בדירוג', value: `${Number(avgImprovement) > 0 ? '+' : ''}${avgImprovement}`, suffix: ' מקומות', color: Number(avgImprovement) > 0 ? COLORS.green : COLORS.red },
          { label: 'נוכחות ב-AI', value: `${aiPresenceCount}/${aiPlatforms.length || 6}`, suffix: ' פלטפורמות', color: COLORS.primary },
          { label: 'ציון E-E-A-T', value: eeatScore, suffix: '/100', color: eeatScore >= 70 ? COLORS.green : eeatScore >= 40 ? COLORS.yellow : COLORS.red },
        ].map((kpi, i) => (
          <div key={i} style={{ ...cardStyle, textAlign: 'center', padding: '1.25rem 1rem' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(240,255,2,0.13)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <div style={{ fontSize: '0.75rem', color: COLORS.textMuted, marginBottom: 6, fontWeight: 500 }}>{kpi.label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '0.7rem', color: COLORS.textMuted }}>{kpi.suffix}</div>
          </div>
        ))}
      </div>

      {/* ==================== SECTION 2: Google Search Console ==================== */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(240,255,2,0.13)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      >
        <div style={sectionTitle}>Google Search Console</div>
        {!gscConnected ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: COLORS.textMuted, marginBottom: 16 }}>Google Search Console לא מחובר</p>
            <button style={buttonStyle} onClick={() => window.location.href = '/api/auth/gsc'}>
              חיבור GSC
            </button>
          </div>
        ) : loadingGsc ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={200} />
            <Skeleton height={150} />
          </div>
        ) : (
          <>
            {/* Timeline Chart */}
            {gscTimeline.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={gscTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="clicks" stroke={COLORS.primary} name="קליקים" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="impressions" stroke={COLORS.accent} name="חשיפות" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top Queries Table */}
            {gscQueries.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>שאילתות מובילות</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>שאילתה</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>קליקים</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>חשיפות</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>CTR</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>מיקום</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>שינוי</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gscQueries.slice(0, 10).map((q, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={{ padding: '8px', fontWeight: 500 }}>{q.query}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{q.clicks}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{q.impressions}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{(q.ctr * 100).toFixed(1)}%</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{q.position.toFixed(1)}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: (q.change || 0) > 0 ? COLORS.green : (q.change || 0) < 0 ? COLORS.red : COLORS.textMuted }}>
                            {(q.change || 0) > 0 ? '▲' : (q.change || 0) < 0 ? '▼' : '–'} {Math.abs(q.change || 0).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top Pages Table */}
            {gscPages.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>עמודים מובילים</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>עמוד</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>קליקים</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>חשיפות</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gscPages.slice(0, 5).map((p, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={{ padding: '8px', fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.page}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{p.clicks}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{p.impressions}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{(p.ctr * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ==================== SECTION 3: Core Web Vitals ==================== */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(240,255,2,0.13)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={sectionTitle}>Core Web Vitals</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setVitalsDevice('mobile')}
              style={{ ...buttonStyle, background: vitalsDevice === 'mobile' ? COLORS.primary : '#f0f0f0', color: vitalsDevice === 'mobile' ? '#fff' : COLORS.text, fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
            >
              מובייל
            </button>
            <button
              onClick={() => setVitalsDevice('desktop')}
              style={{ ...buttonStyle, background: vitalsDevice === 'desktop' ? COLORS.primary : '#f0f0f0', color: vitalsDevice === 'desktop' ? '#fff' : COLORS.text, fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
            >
              דסקטופ
            </button>
            <button style={{ ...buttonStyle, fontSize: '0.75rem', padding: '0.35rem 0.75rem' }} onClick={fetchData}>
              בדוק עכשיו
            </button>
          </div>
        </div>
        {loadingVitals ? (
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
            <Skeleton width={90} height={90} />
            <Skeleton width={90} height={90} />
            <Skeleton width={90} height={90} />
          </div>
        ) : webVitals ? (
          <>
            <div style={{ display: 'flex', gap: 32, justifyContent: 'center', alignItems: 'center', marginBottom: '1rem' }}>
              <CircularGauge value={webVitals.lcp} max={4} label="LCP" unit="שניות" thresholds={{ green: 2.5, yellow: 4 }} />
              <CircularGauge value={webVitals.inp} max={500} label="INP" unit="ms" thresholds={{ green: 200, yellow: 500 }} />
              <CircularGauge value={webVitals.cls} max={0.25} label="CLS" unit="" thresholds={{ green: 0.1, yellow: 0.25 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: webVitals.performanceScore >= 90 ? COLORS.green : webVitals.performanceScore >= 50 ? COLORS.yellow : COLORS.red }}>
                  {webVitals.performanceScore}
                </div>
                <div style={{ fontSize: '0.75rem', color: COLORS.textMuted, fontWeight: 600 }}>ציון ביצועים</div>
              </div>
            </div>
            {webVitals.opportunities.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>הזדמנויות לשיפור</h4>
                <ul style={{ margin: 0, paddingInlineStart: '1.2rem', fontSize: '0.8rem', color: COLORS.textMuted }}>
                  {webVitals.opportunities.map((o, i) => <li key={i} style={{ marginBottom: 4 }}>{o}</li>)}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: COLORS.textMuted, textAlign: 'center' }}>לא נמצאו נתונים. לחצו &quot;בדוק עכשיו&quot; לביצוע סריקה.</p>
        )}
      </div>

      {/* ==================== SECTION 4: Keyword Rankings ==================== */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(240,255,2,0.13)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={sectionTitle}>מעקב דירוגים</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'improved', 'declined', 'new'] as const).map(f => (
              <button key={f}
                onClick={() => setKeywordFilter(f)}
                style={{ ...buttonStyle, background: keywordFilter === f ? COLORS.primary : '#f0f0f0', color: keywordFilter === f ? '#fff' : COLORS.text, fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}
              >
                {{ all: 'הכל', improved: 'עלייה', declined: 'ירידה', new: 'חדש' }[f]}
              </button>
            ))}
            <button style={{ ...buttonStyle, fontSize: '0.7rem', padding: '0.3rem 0.6rem' }} onClick={fetchData}>
              סרוק מחדש
            </button>
          </div>
        </div>
        {loadingKeywords ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} height={32} />)}
          </div>
        ) : filteredKeywords.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>ביטוי</th>
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>מיקום נוכחי</th>
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>שינוי</th>
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>מגמה</th>
                  <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>עדכון אחרון</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeywords.map((k, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: '8px', fontWeight: 500 }}>{k.keyword}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: k.position <= 3 ? COLORS.green : k.position <= 10 ? COLORS.primary : COLORS.textMuted }}>
                      {k.position}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: k.change > 0 ? COLORS.green : k.change < 0 ? COLORS.red : COLORS.textMuted, fontWeight: 600 }}>
                      {k.change > 0 ? '▲' : k.change < 0 ? '▼' : '–'} {Math.abs(k.change)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <Sparkline data={k.trend} color={k.change >= 0 ? COLORS.green : COLORS.red} />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: COLORS.textMuted, fontSize: '0.75rem' }}>{k.lastUpdated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: COLORS.textMuted, textAlign: 'center' }}>אין ביטויים לתצוגה</p>
        )}
      </div>

      {/* ==================== SECTION 5: AI Visibility Matrix ==================== */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(240,255,2,0.13)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={sectionTitle}>מטריצת נוכחות AI</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: COLORS.primary }}>
            ציון GEO: {aiPlatforms.length > 0 ? Math.round((aiPresenceCount / aiPlatforms.length) * 100) : 0}/100
          </div>
        </div>
        {loadingAi ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} height={80} />)}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1rem' }}>
              {(aiPlatforms.length > 0 ? aiPlatforms : [
                { id: 'google_ai', name: 'Google AI Overview', visible: false, mentions: 0, lastChecked: '', trend: 'stable' as const },
                { id: 'chatgpt', name: 'ChatGPT', visible: false, mentions: 0, lastChecked: '', trend: 'stable' as const },
                { id: 'perplexity', name: 'Perplexity', visible: false, mentions: 0, lastChecked: '', trend: 'stable' as const },
                { id: 'claude', name: 'Claude', visible: false, mentions: 0, lastChecked: '', trend: 'stable' as const },
                { id: 'gemini', name: 'Gemini', visible: false, mentions: 0, lastChecked: '', trend: 'stable' as const },
                { id: 'copilot', name: 'Copilot', visible: false, mentions: 0, lastChecked: '', trend: 'stable' as const },
              ]).map((p) => (
                <div key={p.id} style={{
                  border: `1px solid ${p.visible ? COLORS.green : COLORS.border}`,
                  borderRadius: 10,
                  padding: '1rem',
                  background: p.visible ? 'rgba(34,197,94,0.04)' : '#fafafa',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</span>
                    <span style={{ fontSize: '1.1rem' }}>{p.visible ? '✓' : '✗'}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>
                    {p.mentions > 0 && <span>{p.mentions} אזכורים | </span>}
                    {p.lastChecked && <span>נבדק: {p.lastChecked}</span>}
                  </div>
                  <div style={{ fontSize: '0.7rem', marginTop: 4, color: p.trend === 'up' ? COLORS.green : p.trend === 'down' ? COLORS.red : COLORS.textMuted }}>
                    {p.trend === 'up' ? '▲ עלייה' : p.trend === 'down' ? '▼ ירידה' : '– יציב'}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <button style={{ ...buttonStyle, background: COLORS.accent, color: COLORS.text }}>
                שפר נוכחות AI
              </button>
            </div>
          </>
        )}
      </div>

      {/* ==================== SECTION 6: Backlinks ==================== */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(240,255,2,0.13)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      >
        <div style={sectionTitle}>פרופיל קישורים נכנסים</div>
        {loadingBacklinks ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height={24} />
            <Skeleton height={24} />
            <Skeleton height={80} />
          </div>
        ) : backlinks ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: COLORS.primary }}>{backlinks.total}</div>
                <div style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>סה&quot;כ קישורים</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: COLORS.green }}>+{backlinks.newThisMonth}</div>
                <div style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>חדשים החודש</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: COLORS.text }}>{backlinks.activeCampaigns}</div>
                <div style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>קמפיינים פעילים</div>
              </div>
            </div>
            {backlinks.topDomains.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>דומיינים מפנים מובילים</h4>
                {backlinks.topDomains.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: '0.8rem' }}>
                    <span>{d.domain}</span>
                    <span style={{ color: COLORS.textMuted }}>DA: {d.authority}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button style={buttonStyle}>צור קמפיין קישורים</button>
            </div>
          </>
        ) : (
          <p style={{ color: COLORS.textMuted, textAlign: 'center' }}>אין נתוני קישורים זמינים</p>
        )}
      </div>

      {/* ==================== SECTION 7: E-E-A-T Audit ==================== */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(240,255,2,0.13)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={sectionTitle}>ביקורת E-E-A-T</div>
          <button style={{ ...buttonStyle, fontSize: '0.75rem', padding: '0.35rem 0.75rem' }} onClick={fetchData}>
            הרץ ביקורת
          </button>
        </div>
        {loadingEeat ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4].map(i => <Skeleton key={i} height={24} />)}
          </div>
        ) : eeat ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                {([
                  { label: 'Experience (ניסיון)', value: eeat.experience },
                  { label: 'Expertise (מומחיות)', value: eeat.expertise },
                  { label: 'Authority (סמכות)', value: eeat.authority },
                  { label: 'Trust (אמון)', value: eeat.trust },
                ] as { label: string; value: number }[]).map((item, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{item.label}</span>
                      <span style={{ fontWeight: 700, color: item.value >= 70 ? COLORS.green : item.value >= 40 ? COLORS.yellow : COLORS.red }}>{item.value}/100</span>
                    </div>
                    <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${item.value}%`,
                        background: item.value >= 70 ? COLORS.green : item.value >= 40 ? COLORS.yellow : COLORS.red,
                        borderRadius: 4,
                        transition: 'width 500ms ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: eeat.overall >= 70 ? COLORS.green : eeat.overall >= 40 ? COLORS.yellow : COLORS.red }}>
                  {eeat.overall}
                </div>
                <div style={{ fontSize: '0.7rem', color: COLORS.textMuted }}>ציון כולל</div>
              </div>
            </div>
            {eeat.recommendations.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>המלצות מובילות</h4>
                <ul style={{ margin: 0, paddingInlineStart: '1.2rem', fontSize: '0.8rem', color: COLORS.textMuted }}>
                  {eeat.recommendations.slice(0, 3).map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: COLORS.textMuted, textAlign: 'center' }}>לחצו &quot;הרץ ביקורת&quot; לקבלת ציון E-E-A-T</p>
        )}
      </div>

      {/* ==================== SECTION 8: Local SEO / GBP ==================== */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(240,255,2,0.13)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      >
        <div style={sectionTitle}>SEO מקומי - Google Business Profile</div>
        {!gbpConnected ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: COLORS.textMuted, marginBottom: 16 }}>Google Business Profile לא מחובר</p>
            <button style={buttonStyle} onClick={() => window.location.href = '/api/auth/gbp'}>
              חיבור Google Business
            </button>
          </div>
        ) : loadingGbp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={60} />
            <Skeleton height={100} />
          </div>
        ) : gbp ? (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: COLORS.accent }}>⭐ {gbp.avgRating.toFixed(1)}</div>
                <div style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>דירוג ממוצע</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: COLORS.primary }}>{gbp.totalReviews}</div>
                <div style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>סה&quot;כ ביקורות</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: COLORS.green }}>{gbp.responseRate}%</div>
                <div style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>שיעור תגובה</div>
              </div>
            </div>

            {/* Recent Reviews */}
            {gbp.recentReviews.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>ביקורות אחרונות</h4>
                {gbp.recentReviews.slice(0, 3).map((r, i) => (
                  <div key={i} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '0.75rem', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{r.author}</span>
                      <span style={{ color: COLORS.accent }}>{'⭐'.repeat(r.rating)}</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: COLORS.textMuted, margin: '0 0 4px 0' }}>{r.text}</p>
                    {r.aiSuggestion && (
                      <div style={{ background: '#f0f9ff', borderRadius: 6, padding: '0.5rem', fontSize: '0.75rem', color: COLORS.primary }}>
                        💡 הצעת תגובה AI: {r.aiSuggestion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Local Rankings */}
            {gbp.localRankings.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>דירוג Local Pack</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {gbp.localRankings.map((lr, i) => (
                    <div key={i} style={{
                      border: `1px solid ${lr.position <= 3 ? COLORS.green : COLORS.border}`,
                      borderRadius: 8,
                      padding: '0.5rem 0.75rem',
                      background: lr.position <= 3 ? 'rgba(34,197,94,0.05)' : '#fff',
                      fontSize: '0.8rem',
                    }}>
                      <span style={{ fontWeight: 600 }}>{lr.keyword}</span>
                      <span style={{ marginInlineStart: 8, color: lr.position <= 3 ? COLORS.green : COLORS.textMuted, fontWeight: 700 }}>#{lr.position}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: COLORS.textMuted, textAlign: 'center' }}>אין נתונים זמינים</p>
        )}
      </div>
    </div>
  );
}
