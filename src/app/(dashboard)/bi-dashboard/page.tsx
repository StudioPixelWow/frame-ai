'use client';

/**
 * BI Dashboard — Business Intelligence overview
 *
 * Sections:
 * 1. AI Insights (executive summary)
 * 2. Client Health overview
 * 3. Profitability model
 * 4. Content Intelligence (מה עובד / מה לא עובד)
 * 5. Cross-Client insights
 * 6. Early Warning System
 */

import { useState, useEffect, useCallback } from 'react';

interface HealthScore {
  clientId: string; clientName: string; score: number;
  status: string; statusLabel: string; statusColor: string;
  hasEnoughData: boolean;
  breakdown: Record<string, { score: number; label: string; detail: string }>;
}

interface Profitability {
  clientId: string; clientName: string;
  totalSpend: number; totalLeads: number; cpl: number;
  retainerAmount: number; estimatedProfit: number; roi: number;
  level: string; levelLabel: string; levelColor: string;
  warning: string | null; hasEnoughData: boolean;
}

interface ContentInsight {
  type: string; category: string; title: string;
  detail: string; confidence: string; relatedAds: string[];
}

interface EarlyWarning {
  id: string; type: string; severity: string;
  clientId: string; clientName: string;
  campaignName?: string; title: string;
  detail: string; actionSuggestion: string;
}

interface CrossClientInsight {
  id: string; category: string; title: string;
  detail: string; severity: string; affectedClients: string[];
}

interface IndustryBenchmark {
  industry: string; clientCount: number;
  avgCpl: number; avgCtr: number; totalLeads: number; totalSpend: number;
}

interface AIInsight {
  id: string; level: string; icon: string;
  title: string; body: string; recommendation: string;
}

export default function BIDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [biData, setBiData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'profit' | 'content' | 'cross' | 'warnings' | 'platforms'>('overview');

  const fetchBI = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/data/bi?section=all');
      if (res.ok) {
        const data = await res.json();
        setBiData(data);
      }
    } catch { /* safe */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBI(); }, [fetchBI]);

  const tabs = [
    { key: 'overview', label: 'סקירה כללית', icon: '🧠' },
    { key: 'health', label: 'בריאות לקוחות', icon: '💚' },
    { key: 'profit', label: 'רווחיות', icon: '💰' },
    { key: 'content', label: 'תוכן', icon: '🎨' },
    { key: 'cross', label: 'חוצה-לקוחות', icon: '🔗' },
    { key: 'warnings', label: 'התראות', icon: '⚠️' },
    { key: 'platforms', label: 'פלטפורמות', icon: '📡' },
  ] as const;

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
          📊 Business Intelligence
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', marginTop: '0.3rem' }}>
          ניתוח ביצועים חכם — מבוסס נתונים אמיתיים
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0.35rem', marginBottom: '1.5rem', flexWrap: 'wrap',
        borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem',
      }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
              background: activeTab === tab.key ? 'var(--accent)' : 'var(--surface)',
              color: activeTab === tab.key ? '#fff' : 'var(--foreground)',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--foreground-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          מנתח נתונים...
        </div>
      )}

      {/* Content */}
      {!loading && biData && (
        <>
          {activeTab === 'overview' && <OverviewTab data={biData} />}
          {activeTab === 'health' && <HealthTab health={biData.health || []} />}
          {activeTab === 'profit' && <ProfitTab profitability={biData.profitability || []} />}
          {activeTab === 'content' && <ContentTab content={biData.content} />}
          {activeTab === 'cross' && <CrossClientTab crossClient={biData.crossClient} />}
          {activeTab === 'warnings' && <WarningsTab warnings={biData.warnings} />}
          {activeTab === 'platforms' && <PlatformsTab platforms={biData.platforms} />}
        </>
      )}

      {!loading && !biData && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--foreground-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          לא ניתן לטעון נתוני BI
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════

function OverviewTab({ data }: { data: any }) {
  const insights: AIInsight[] = data.insights || [];
  const warnings = data.warnings || { criticalCount: 0, highCount: 0 };
  const health: HealthScore[] = Array.isArray(data.health) ? data.health : [];
  const profit: Profitability[] = Array.isArray(data.profitability) ? data.profitability : [];

  const healthyCount = health.filter(h => h.status === 'healthy').length;
  const criticalCount = health.filter(h => h.status === 'critical').length;
  const totalClients = health.length;

  const totalSpend = profit.reduce((s, p) => s + (p.totalSpend || 0), 0);
  const totalLeads = profit.reduce((s, p) => s + (p.totalLeads || 0), 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  return (
    <div>
      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'לקוחות פעילים', value: totalClients, color: 'var(--accent)' },
          { label: 'לקוחות בריאים', value: healthyCount, color: '#22c55e' },
          { label: 'קריטיים', value: criticalCount, color: '#ef4444' },
          { label: 'סה"כ הוצאה', value: `₪${totalSpend.toLocaleString('he-IL')}`, color: '#3b82f6' },
          { label: 'סה"כ לידים', value: totalLeads, color: '#8b5cf6' },
          { label: 'CPL ממוצע', value: avgCpl > 0 ? `₪${avgCpl.toFixed(0)}` : '—', color: '#f59e0b' },
          { label: 'התראות קריטיות', value: warnings.criticalCount || 0, color: '#ef4444' },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: 'var(--surface)', borderRadius: '0.75rem', padding: '1rem',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>{kpi.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>🧠 תובנות AI</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {insights.map((insight, i) => (
              <div key={i} style={{
                background: 'var(--surface)', borderRadius: '0.75rem', padding: '1rem',
                border: '1px solid var(--border)',
                borderRight: `3px solid ${insight.level === 'executive' ? '#8b5cf6' : insight.level === 'tactical' ? '#3b82f6' : '#22c55e'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '1rem' }}>{insight.icon}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{insight.title}</span>
                  <span style={{
                    fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '999px',
                    background: insight.level === 'executive' ? '#8b5cf610' : '#3b82f610',
                    color: insight.level === 'executive' ? '#8b5cf6' : '#3b82f6',
                    fontWeight: 600,
                  }}>
                    {insight.level === 'executive' ? 'אסטרטגי' : insight.level === 'tactical' ? 'טקטי' : 'תפעולי'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginBottom: '0.3rem' }}>{insight.body}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>💡 {insight.recommendation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '2rem', background: 'var(--surface)',
          borderRadius: '0.75rem', color: 'var(--foreground-muted)', marginBottom: '1.5rem',
        }}>
          אין מספיק נתונים לייצר תובנות — הוסיפו קמפיינים ולידים
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HEALTH TAB
// ═══════════════════════════════════════════════════════════════════

function HealthTab({ health }: { health: HealthScore[] }) {
  if (!health || health.length === 0) {
    return <EmptyState message="אין מספיק נתונים — הוסיפו לקוחות וקמפיינים" />;
  }

  return (
    <div>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>💚 בריאות לקוחות</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {health.map(h => (
          <div key={h.clientId} style={{
            background: 'var(--surface)', borderRadius: '0.75rem', padding: '1rem',
            border: '1px solid var(--border)',
            borderRight: `3px solid ${h.statusColor}`,
            opacity: h.hasEnoughData ? 1 : 0.6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{h.clientName}</span>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px',
                  background: `${h.statusColor}15`, color: h.statusColor,
                }}>{h.statusLabel}</span>
              </div>
              <div style={{
                fontSize: '1.2rem', fontWeight: 800, color: h.statusColor,
                minWidth: '3rem', textAlign: 'center',
              }}>
                {h.hasEnoughData ? h.score : '—'}
              </div>
            </div>
            {h.hasEnoughData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
                {Object.entries(h.breakdown).map(([key, val]) => (
                  <div key={key} style={{
                    background: 'rgba(0,0,0,0.02)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem',
                  }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>{val.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--foreground)', marginTop: '0.1rem' }}>{val.detail}</div>
                    <div style={{
                      height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.06)', marginTop: '0.3rem',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${Math.min(100, (val.score / 30) * 100)}%`,
                        background: val.score >= 20 ? '#22c55e' : val.score >= 10 ? '#f59e0b' : '#ef4444',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!h.hasEnoughData && (
              <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>אין מספיק נתונים</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROFITABILITY TAB
// ═══════════════════════════════════════════════════════════════════

function ProfitTab({ profitability }: { profitability: Profitability[] }) {
  if (!profitability || profitability.length === 0) {
    return <EmptyState message="אין מספיק נתונים לניתוח רווחיות" />;
  }

  return (
    <div>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>💰 מודל רווחיות</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {profitability.map(p => (
          <div key={p.clientId} style={{
            background: 'var(--surface)', borderRadius: '0.75rem', padding: '1rem',
            border: '1px solid var(--border)',
            borderRight: `3px solid ${p.levelColor}`,
            opacity: p.hasEnoughData ? 1 : 0.6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.clientName}</span>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px',
                  background: `${p.levelColor}15`, color: p.levelColor,
                }}>{p.levelLabel}</span>
              </div>
            </div>

            {p.hasEnoughData ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {[
                    { label: 'הוצאה', value: `₪${p.totalSpend.toLocaleString('he-IL')}` },
                    { label: 'לידים', value: p.totalLeads },
                    { label: 'CPL', value: p.cpl > 0 ? `₪${p.cpl.toFixed(0)}` : '—' },
                    { label: 'ריטיינר', value: p.retainerAmount > 0 ? `₪${p.retainerAmount.toLocaleString('he-IL')}` : '—' },
                    { label: 'רווח מוערך', value: `₪${p.estimatedProfit.toLocaleString('he-IL')}` },
                    { label: 'ROI', value: p.roi !== 0 ? `${p.roi.toFixed(0)}%` : '—' },
                  ].map((item, i) => (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.02)', borderRadius: '0.4rem', padding: '0.4rem 0.6rem' }}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--foreground-muted)' }}>{item.label}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                {p.warning && (
                  <div style={{
                    fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245,158,11,0.06)',
                    padding: '0.4rem 0.6rem', borderRadius: '0.4rem',
                  }}>
                    ⚠️ {p.warning}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>אין מספיק נתונים</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CONTENT INTELLIGENCE TAB
// ═══════════════════════════════════════════════════════════════════

function ContentTab({ content }: { content: any }) {
  if (!content || !content.hasEnoughData) {
    return <EmptyState message="אין מספיק מודעות עם נתוני ביצועים לניתוח תוכן" />;
  }

  const working: ContentInsight[] = content.working || [];
  const notWorking: ContentInsight[] = content.notWorking || [];
  const topCreatives = content.topCreatives || [];

  return (
    <div>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>🎨 אינטליגנציית תוכן</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginBottom: '1rem' }}>
        {content.totalAdsAnalyzed} מודעות נותחו
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* מה עובד */}
        <div>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#22c55e', marginBottom: '0.5rem' }}>✅ מה עובד</h3>
          {working.length > 0 ? working.map((w, i) => (
            <div key={i} style={{
              background: 'rgba(34,197,94,0.04)', borderRadius: '0.5rem', padding: '0.6rem',
              border: '1px solid rgba(34,197,94,0.1)', marginBottom: '0.4rem',
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{w.title}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginTop: '0.2rem' }}>{w.detail}</div>
            </div>
          )) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>לא זוהו דפוסים חיוביים</div>
          )}
        </div>

        {/* מה לא עובד */}
        <div>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.5rem' }}>❌ מה לא עובד</h3>
          {notWorking.length > 0 ? notWorking.map((w, i) => (
            <div key={i} style={{
              background: 'rgba(239,68,68,0.04)', borderRadius: '0.5rem', padding: '0.6rem',
              border: '1px solid rgba(239,68,68,0.1)', marginBottom: '0.4rem',
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{w.title}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginTop: '0.2rem' }}>{w.detail}</div>
            </div>
          )) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>לא זוהו דפוסים שליליים</div>
          )}
        </div>
      </div>

      {/* Top Creatives */}
      {topCreatives.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>🏆 מודעות מובילות</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {topCreatives.slice(0, 5).map((ad: any, i: number) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--surface)', borderRadius: '0.5rem', padding: '0.6rem 0.85rem',
                border: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{ad.adName || ad.headline || `מודעה ${i + 1}`}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)' }}>
                    CTR {ad.ctr?.toFixed(1)}% · {ad.leads} לידים · ₪{(ad.spend || 0).toLocaleString('he-IL')}
                  </div>
                </div>
                <div style={{
                  fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px',
                  background: '#22c55e15', color: '#22c55e',
                }}>
                  ציון: {ad.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CROSS-CLIENT TAB
// ═══════════════════════════════════════════════════════════════════

function CrossClientTab({ crossClient }: { crossClient: any }) {
  if (!crossClient || !crossClient.hasEnoughData) {
    return <EmptyState message="נדרשים לפחות 2 לקוחות פעילים לניתוח חוצה-לקוחות" />;
  }

  const insights: CrossClientInsight[] = crossClient.insights || [];
  const benchmarks: IndustryBenchmark[] = crossClient.industryBenchmarks || [];

  return (
    <div>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>🔗 תובנות חוצה-לקוחות</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginBottom: '1rem' }}>
        {crossClient.totalActiveClients} לקוחות · {crossClient.totalActiveCampaigns} קמפיינים · CPL ממוצע ₪{crossClient.globalAvgCpl?.toFixed(0) || '—'} · CTR {crossClient.globalAvgCtr?.toFixed(1) || '—'}%
      </p>

      {/* Insights */}
      {insights.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>תובנות</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {insights.map((ins, i) => (
              <div key={i} style={{
                background: 'var(--surface)', borderRadius: '0.5rem', padding: '0.7rem',
                border: '1px solid var(--border)',
                borderRight: `3px solid ${ins.severity === 'positive' ? '#22c55e' : ins.severity === 'warning' ? '#f59e0b' : '#3b82f6'}`,
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{ins.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginTop: '0.2rem' }}>{ins.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Industry Benchmarks */}
      {benchmarks.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>📊 Benchmarks לפי תחום</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {benchmarks.map((b, i) => (
              <div key={i} style={{
                background: 'var(--surface)', borderRadius: '0.5rem', padding: '0.75rem',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>{b.industry}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span>{b.clientCount} לקוחות</span>
                  <span>CPL: {b.avgCpl > 0 ? `₪${b.avgCpl.toFixed(0)}` : '—'}</span>
                  <span>CTR: {b.avgCtr > 0 ? `${b.avgCtr.toFixed(1)}%` : '—'}</span>
                  <span>{b.totalLeads} לידים · ₪{b.totalSpend.toLocaleString('he-IL')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.length === 0 && benchmarks.length === 0 && (
        <EmptyState message="אין מספיק נתונים לתובנות חוצה-לקוחות" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WARNINGS TAB
// ═══════════════════════════════════════════════════════════════════

function WarningsTab({ warnings }: { warnings: any }) {
  const list: EarlyWarning[] = warnings?.warnings || [];

  if (list.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--foreground-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>אין התראות פעילות</div>
        <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>הכל תקין כרגע</div>
      </div>
    );
  }

  const severityColors: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#6b7280',
  };
  const severityLabels: Record<string, string> = {
    critical: 'קריטי', high: 'גבוה', medium: 'בינוני', low: 'נמוך',
  };

  return (
    <div>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>⚠️ מערכת התראות מוקדמות</h2>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['critical', 'high', 'medium'].map(sev => {
          const count = list.filter(w => w.severity === sev).length;
          return count > 0 ? (
            <span key={sev} style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px',
              background: `${severityColors[sev]}15`, color: severityColors[sev],
            }}>
              {count} {severityLabels[sev]}
            </span>
          ) : null;
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {list.map((w, i) => (
          <div key={i} style={{
            background: 'var(--surface)', borderRadius: '0.75rem', padding: '1rem',
            border: '1px solid var(--border)',
            borderRight: `3px solid ${severityColors[w.severity] || '#6b7280'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{w.title}</span>
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px',
                background: `${severityColors[w.severity]}15`, color: severityColors[w.severity],
              }}>{severityLabels[w.severity]}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', marginBottom: '0.25rem' }}>{w.detail}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}>💡 {w.actionSuggestion}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PLATFORMS TAB
// ═══════════════════════════════════════════════════════════════════

const PLATFORM_ICONS: Record<string, string> = {
  facebook: '📘', instagram: '📸', tiktok: '🎵', google: '🔍', multi_platform: '🌐',
};
const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877f2', instagram: '#e4405f', tiktok: '#000000', google: '#4285f4', multi_platform: '#6366f1',
};

function PlatformsTab({ platforms }: { platforms: any }) {
  if (!platforms) {
    return <EmptyState message="אין מספיק נתונים להשוואת פלטפורמות" />;
  }

  // Handle both global (comparePlatforms) and client-specific (compareClientPlatforms) shapes
  const platformList: any[] = platforms.platforms || [];
  const bestBy = platforms.bestBy || {};
  const insights: any[] = platforms.insights || [];
  const hasSufficientData = platforms.hasSufficientData ?? (platformList.length >= 2);

  if (platformList.length === 0) {
    return <EmptyState message="אין נתוני פלטפורמות — חברו פלטפורמת פרסום כדי לצפות בהשוואה" />;
  }

  const totalSpend = platformList.reduce((s: number, p: any) => s + (p.totalSpend || 0), 0);

  return (
    <div>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📡 השוואת פלטפורמות פרסום</h2>

      {/* KPI strip — best by */}
      {hasSufficientData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {bestBy.cpl && (
            <div style={{ background: 'var(--surface)', borderRadius: '0.75rem', padding: '0.85rem', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)', marginBottom: '0.15rem' }}>CPL הכי נמוך</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{PLATFORM_ICONS[bestBy.cpl]} {bestBy.cpl}</div>
            </div>
          )}
          {bestBy.ctr && (
            <div style={{ background: 'var(--surface)', borderRadius: '0.75rem', padding: '0.85rem', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)', marginBottom: '0.15rem' }}>CTR הכי גבוה</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{PLATFORM_ICONS[bestBy.ctr]} {bestBy.ctr}</div>
            </div>
          )}
          {bestBy.cpc && (
            <div style={{ background: 'var(--surface)', borderRadius: '0.75rem', padding: '0.85rem', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)', marginBottom: '0.15rem' }}>CPC הכי נמוך</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{PLATFORM_ICONS[bestBy.cpc]} {bestBy.cpc}</div>
            </div>
          )}
          {bestBy.conversions && (
            <div style={{ background: 'var(--surface)', borderRadius: '0.75rem', padding: '0.85rem', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)', marginBottom: '0.15rem' }}>הכי הרבה המרות</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{PLATFORM_ICONS[bestBy.conversions]} {bestBy.conversions}</div>
            </div>
          )}
        </div>
      )}

      {/* Platform cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {platformList.map((p: any) => {
          const spendShare = totalSpend > 0 ? ((p.totalSpend || 0) / totalSpend * 100).toFixed(0) : '0';
          const color = PLATFORM_COLORS[p.platform] || '#6366f1';
          return (
            <div key={p.platform} style={{
              background: 'var(--surface)', borderRadius: '0.75rem', padding: '1.25rem',
              border: '1px solid var(--border)', borderTop: `3px solid ${color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{PLATFORM_ICONS[p.platform] || '📊'}</span>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{p.label || p.platform}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)' }}>
                    {p.campaignCount} קמפיינים, {p.adCount} מודעות
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <MetricBox label="הוצאה" value={`₪${(p.totalSpend || 0).toLocaleString()}`} sub={`${spendShare}% מהכולל`} />
                <MetricBox label="CTR" value={`${(p.avgCtr || 0).toFixed(2)}%`} />
                <MetricBox label="CPC" value={`₪${(p.avgCpc || 0).toFixed(1)}`} />
                <MetricBox label="CPM" value={`₪${(p.avgCpm || 0).toFixed(0)}`} />
                <MetricBox label="המרות" value={String(p.totalConversions || 0)} />
                <MetricBox label="CPL" value={p.avgCpl > 0 ? `₪${(p.avgCpl).toFixed(0)}` : '—'} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>💡 תובנות פלטפורמה</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {insights.map((ins: any) => {
              const typeColors: Record<string, string> = {
                winner: '#22c55e', trend: '#3b82f6', warning: '#f59e0b', recommendation: '#8b5cf6',
              };
              const typeIcons: Record<string, string> = {
                winner: '🏆', trend: '📈', warning: '⚠️', recommendation: '💡',
              };
              return (
                <div key={ins.id} style={{
                  background: 'var(--surface)', borderRadius: '0.75rem', padding: '1rem',
                  border: '1px solid var(--border)',
                  borderRight: `3px solid ${typeColors[ins.type] || '#6b7280'}`,
                }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    {typeIcons[ins.type] || '📊'} {ins.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>{ins.detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surface-raised, var(--background))', borderRadius: '0.375rem',
      padding: '0.5rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--foreground-muted)', marginBottom: '0.1rem' }}>{label}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.58rem', color: 'var(--foreground-muted)' }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '3rem', background: 'var(--surface)',
      borderRadius: '0.75rem', color: 'var(--foreground-muted)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
      <div style={{ fontSize: '0.85rem' }}>{message}</div>
    </div>
  );
}
