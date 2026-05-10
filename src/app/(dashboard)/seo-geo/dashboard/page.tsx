'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

// ==================== TYPES ====================
interface SeoPlan {
  id: string;
  clientId: string;
  clientName: string;
  websiteUrl: string;
  status: 'draft' | 'scanning' | 'goals_set' | 'visibility_done' | 'insights_ready' | 'plan_generated' | 'tasks_created' | 'active' | 'completed';
  overallScore: number;
  visibilityScore: number;
  technicalScore: number;
  contentScore: number;
  completedTasks: number;
  totalTasks: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== COLORS & STYLES ====================
const COLORS = {
  primary: '#00B5FE',
  accent: '#E8F401',
  background: '#F7F9FC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#666666',
  border: '#E8E8E8',
  draft: '#999999',
  blue: '#0066FF',
  orange: '#FF9933',
  green: '#22C55E',
  emerald: '#10B981',
  yellow: '#FFC107',
  red: '#FF6B6B',
};

const statusBadgeColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#F3F3F3', text: '#666666' },
  scanning: { bg: '#E3F2FD', text: '#0066FF' },
  scanned: { bg: '#E0F2F1', text: '#10B981' },
  goals_set: { bg: '#E3F2FD', text: '#0066FF' },
  visibility_done: { bg: '#E3F2FD', text: '#0066FF' },
  insights_ready: { bg: '#E3F2FD', text: '#0066FF' },
  plan_generated: { bg: '#FFF3E0', text: '#FF9933' },
  tasks_created: { bg: '#FFF3E0', text: '#FF9933' },
  active: { bg: '#E8F5E9', text: '#22C55E' },
  completed: { bg: '#E0F2F1', text: '#10B981' },
};

const statusLabels: Record<string, string> = {
  draft: 'טיוטה',
  scanning: 'בסריקה',
  scanned: 'נסרק',
  goals_set: 'יעדים הוגדרו',
  visibility_done: 'נראות הושלמה',
  insights_ready: 'תובנות מוכנות',
  plan_generated: 'תוכנית מוכנה',
  tasks_created: 'משימות נוצרו',
  active: 'פעיל',
  completed: 'הושלם',
};

const PLATFORMS = [
  { id: 'google_seo', name: 'Google SEO', icon: '🔍', desc: 'חיפוש אורגני' },
  { id: 'google_ai_overview', name: 'Google AI Overview', icon: '✨', desc: 'סקירת AI של גוגל' },
  { id: 'gemini', name: 'Gemini', icon: '💎', desc: 'מנוע AI של Google' },
  { id: 'chatgpt', name: 'ChatGPT', icon: '🤖', desc: 'מנוע AI של OpenAI' },
  { id: 'claude', name: 'Claude', icon: '🧠', desc: 'מנוע AI של Anthropic' },
  { id: 'perplexity', name: 'Perplexity', icon: '🔮', desc: 'מנוע חיפוש AI' },
];

// ==================== HELPERS ====================
function getStatusBadgeColor(status: string): { bg: string; text: string } {
  return statusBadgeColors[status] || statusBadgeColors.draft;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.blue;
  if (score >= 40) return COLORS.orange;
  return COLORS.red;
}

function getDaysAgo(dateStr: string): number {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  } catch {
    return -1;
  }
}

// ==================== MAIN COMPONENT ====================
export default function SeoGeoDashboard() {
  const [plans, setPlans] = useState<SeoPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPlans, setFilteredPlans] = useState<SeoPlan[]>([]);
  const [platformStatus, setPlatformStatus] = useState<Record<string, 'real' | 'unavailable'>>({});

  // Fetch SEO plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/data/seo-plans', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch plans');
        const data = await res.json();
        setPlans(Array.isArray(data.plans) ? data.plans : []);
      } catch (err) {
        console.error('Error fetching plans:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();

    // Fetch platform availability — convert API response format, fall back to scan data
    fetch('/api/seo/platform-status').then(r => r.ok ? r.json() : {}).then(data => {
      if (data.platforms) {
        // API returns { platforms: { id: { available: bool, name: string } } }
        // Convert to { id: 'real' | 'unavailable' } for our state
        const converted: Record<string, 'real' | 'unavailable'> = {};
        for (const [id, info] of Object.entries(data.platforms)) {
          converted[id] = (info as any).available ? 'real' : 'unavailable';
        }
        const hasAnyReal = Object.values(converted).some(s => s === 'real');
        if (hasAnyReal) {
          setPlatformStatus(converted);
        } else {
          // All show unavailable from env vars — check if any plan had successful scans
          fetch('/api/data/seo-plans').then(r => r.ok ? r.json() : []).then((allPlans: any[]) => {
            if (Array.isArray(allPlans) && allPlans.length > 0) {
              const anyWithScans = allPlans.some((p: any) => p.websiteScan?.aiQueries?.length > 0 || p.websiteScan?.platformStatuses);
              if (anyWithScans) {
                const scannedPlatforms: Record<string, 'real' | 'unavailable'> = {};
                ['google_seo', 'google_ai_overview', 'gemini', 'chatgpt', 'claude', 'perplexity'].forEach(id => {
                  scannedPlatforms[id] = 'real';
                });
                setPlatformStatus(scannedPlatforms);
              }
            }
          }).catch(() => {});
        }
      }
    }).catch(() => {});
  }, []);

  // Filter plans based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredPlans(plans);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = plans.filter(
      (plan) =>
        plan.clientName.toLowerCase().includes(term) ||
        plan.websiteUrl.toLowerCase().includes(term)
    );
    setFilteredPlans(filtered);
  }, [searchTerm, plans]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = plans.length;
    const active = plans.filter((p) => p.status === 'active' || p.status === 'plan_generated').length;
    const avgGeoScore = plans.length > 0 ? Math.round(plans.reduce((sum, p) => sum + p.visibilityScore, 0) / plans.length) : 0;
    const needsReview = plans.filter((p) => {
      // Extract confidence from somewhere or use a default logic
      return p.status === 'draft' || p.overallScore < 70;
    }).length;
    const lastSevenDays = plans.filter((p) => getDaysAgo(p.updatedAt) <= 7).length;

    return { total, active, avgGeoScore, needsReview, lastSevenDays };
  }, [plans]);

  return (
    <div style={{ direction: 'rtl', padding: '32px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: COLORS.background, minHeight: '100vh' }}>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .kpi-card {
          background: ${COLORS.card};
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          animation: fade-in 0.4s ease both;
        }
        .plan-card {
          background: ${COLORS.card};
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          border: 1px solid ${COLORS.border};
          transition: all 0.3s ease;
          animation: fade-in 0.4s ease both;
        }
        .plan-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
        .score-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 16px;
        }
        .status-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
        }
        .badge-yellow {
          background: ${COLORS.yellow}20;
          color: #B8960B;
        }
        .action-button {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-block;
        }
        .action-button-primary {
          background: ${COLORS.primary};
          color: white;
        }
        .action-button-primary:hover {
          opacity: 0.9;
        }
        .action-button-secondary {
          background: transparent;
          color: ${COLORS.primary};
          border: 1.5px solid ${COLORS.primary};
        }
        .action-button-secondary:hover {
          background: ${COLORS.primary}08;
        }
        .search-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid ${COLORS.border};
          font-size: 14px;
          font-family: inherit;
        }
        .search-input:focus {
          outline: none;
          border-color: ${COLORS.primary};
          box-shadow: 0 0 0 3px ${COLORS.primary}10;
        }
        .empty-state {
          text-align: center;
          padding: 60px 32px;
          color: ${COLORS.textMuted};
        }
        .empty-state-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }
        .plans-table {
          width: 100%;
          border-collapse: collapse;
          background: ${COLORS.card};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .plans-table thead {
          background: ${COLORS.background};
          border-bottom: 1px solid ${COLORS.border};
        }
        .plans-table th {
          padding: 16px;
          text-align: right;
          font-weight: 600;
          font-size: 13px;
          color: ${COLORS.textMuted};
        }
        .plans-table td {
          padding: 16px;
          border-bottom: 1px solid ${COLORS.border};
          font-size: 14px;
        }
        .plans-table tbody tr:last-child td {
          border-bottom: none;
        }
        .plans-table tbody tr:hover {
          background: ${COLORS.background};
        }
      `}</style>

      {/* ══════════ HEADER ══════════ */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: COLORS.text, margin: '0 0 8px 0' }}>
            מרכז PIXEL SEO/GEO
          </h1>
          <p style={{ fontSize: '14px', color: COLORS.textMuted, margin: 0 }}>
            סקירת כל תוכניות PIXEL SEO/GEO ללקוחות
          </p>
        </div>
        <Link href="/seo-geo" style={{
          padding: '12px 24px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600',
          background: COLORS.primary,
          color: 'white',
          textDecoration: 'none',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
        }}>
          תוכנית PIXEL SEO/GEO חדשה +
        </Link>
      </div>

      {/* ══════════ KPI CARDS ROW ══════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="kpi-card" style={{ animationDelay: '0s' }}>
          <div style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '12px' }}>
            סה״כ תוכניות
          </div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: COLORS.primary }}>
            {kpis.total}
          </div>
        </div>

        <div className="kpi-card" style={{ animationDelay: '0.08s' }}>
          <div style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '12px' }}>
            תוכניות פעילות
          </div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: COLORS.green }}>
            {kpis.active}
          </div>
        </div>

        <div className="kpi-card" style={{ animationDelay: '0.16s' }}>
          <div style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '12px' }}>
            ציון GEO ממוצע
          </div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: COLORS.blue }}>
            {kpis.avgGeoScore}
          </div>
        </div>

        <div className="kpi-card" style={{ animationDelay: '0.24s' }}>
          <div style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '12px' }}>
            תוכניות לבדיקה
          </div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: COLORS.orange }}>
            {kpis.needsReview}
          </div>
        </div>

        <div className="kpi-card" style={{ animationDelay: '0.32s' }}>
          <div style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '12px' }}>
            סטטוס חיבור API
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(() => {
              const connected = Object.values(platformStatus).filter(s => s === 'real').length;
              const total = PLATFORMS.length;
              if (connected === total) return <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: `${COLORS.green}20`, color: COLORS.green }}>הכל מחובר</span>;
              if (connected > 0) return <span className="badge badge-yellow">{connected}/{total} מחוברים</span>;
              return <span className="badge badge-yellow">לא מחובר</span>;
            })()}
          </div>
        </div>

        <div className="kpi-card" style={{ animationDelay: '0.40s' }}>
          <div style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '12px' }}>
            סריקות אחרונות (7 ימים)
          </div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: COLORS.emerald }}>
            {kpis.lastSevenDays}
          </div>
        </div>
      </div>

      {/* ══════════ PLATFORM CARDS ROW ══════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '32px' }}>
        {PLATFORMS.map((p) => {
          const status = platformStatus[p.id];
          const isConnected = status === 'real';
          return (
            <div key={p.id} className="kpi-card" style={{ textAlign: 'center', cursor: 'default' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{p.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>{p.desc}</div>
              <div style={{ marginTop: 10 }}>
                {isConnected
                  ? <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: `${COLORS.green}20`, color: COLORS.green }}>מחובר</span>
                  : <span className="badge badge-yellow">לא מחובר</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════ SEARCH & PLANS LIST ══════════ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 32px', color: COLORS.textMuted }}>
          טוען תוכניות...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px 32px', color: COLORS.red }}>
          שגיאה בטעינה: {error}
        </div>
      ) : plans.length === 0 ? (
        <div className="plan-card" style={{ textAlign: 'center' }}>
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: COLORS.text, marginBottom: '8px' }}>
              אין תוכניות PIXEL SEO/GEO עדיין
            </h3>
            <p style={{ marginBottom: '24px' }}>
              צור תוכנית ראשונה כדי להתחיל
            </p>
            <Link href="/seo-geo" style={{
              display: 'inline-block',
              padding: '12px 24px',
              borderRadius: '12px',
              background: COLORS.primary,
              color: 'white',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '14px',
            }}>
              צור תוכנית חדשה
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div style={{ marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="חפש לפי שם לקוח, דומיין או תחום..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Plans table */}
          <div style={{ overflow: 'auto' }}>
            <table className="plans-table">
              <thead>
                <tr>
                  <th>שם לקוח</th>
                  <th>דומיין</th>
                  <th>סטטוס</th>
                  <th>ציון GEO</th>
                  <th>ציון טכני</th>
                  <th>סריקה אחרונה</th>
                  <th>מצב סריקה</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: COLORS.textMuted }}>
                      אין תוכניות התואמות את החיפוש
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan) => {
                    const badge = getStatusBadgeColor(plan.status);
                    const daysAgo = getDaysAgo(plan.updatedAt);
                    const lastScanText = daysAgo === 0 ? 'היום' : daysAgo === 1 ? 'אתמול' : `לפני ${daysAgo} ימים`;

                    return (
                      <tr key={plan.id}>
                        <td style={{ fontWeight: '600', color: COLORS.text }}>{plan.clientName}</td>
                        <td style={{ fontSize: '13px', color: COLORS.textMuted, wordBreak: 'break-all' }}>
                          {plan.websiteUrl}
                        </td>
                        <td>
                          <div className="status-badge" style={{ background: badge.bg, color: badge.text }}>
                            {statusLabels[plan.status] || plan.status}
                          </div>
                        </td>
                        <td>
                          <div className="score-badge" style={{ background: `${scoreColor(plan.visibilityScore)}15`, color: scoreColor(plan.visibilityScore) }}>
                            {plan.visibilityScore}
                          </div>
                        </td>
                        <td>
                          <div className="score-badge" style={{ background: `${scoreColor(plan.technicalScore)}15`, color: scoreColor(plan.technicalScore) }}>
                            {plan.technicalScore}
                          </div>
                        </td>
                        <td style={{ fontSize: '13px', color: COLORS.textMuted }}>
                          {lastScanText}
                        </td>
                        <td>
                          {(() => {
                            const ws = (plan as any).websiteScan;
                            const scanMode = ws?.scanType || ws?.scan_mode || (ws?.aiQueries?.some((q: any) => q.scanMode === 'real') ? 'real' : 'simulated');
                            return scanMode === 'real'
                              ? <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: `${COLORS.green}20`, color: COLORS.green }}>אמיתי</span>
                              : ws ? <span className="badge badge-yellow">סימולציה</span>
                              : <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#F3F3F3', color: '#999' }}>לא נסרק</span>;
                          })()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Link href={`/seo-geo/${plan.id}`} className="action-button action-button-primary">
                              פתח
                            </Link>
                            <button className="action-button action-button-secondary" onClick={() => {
                              window.location.href = `/seo-geo/${plan.id}/report?lang=he`;
                            }}>
                              הפק דוח
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
