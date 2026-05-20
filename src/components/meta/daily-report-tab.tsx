'use client';

import { useState, useEffect } from 'react';
import type { DailyReport, CplTrend, OptimizationAction } from '@/lib/meta-ads/daily-optimizer';

/* ── Props ── */

interface DailyReportTabProps {
  clientId?: string;
  campaignId?: string;
}

/* ── Helpers ── */

const TREND_META: Record<string, { icon: string; label: string; color: string }> = {
  improving: { icon: '📉', label: 'במגמת ירידה', color: '#22c55e' },
  stable: { icon: '➡️', label: 'יציב', color: '#f59e0b' },
  worsening: { icon: '📈', label: 'במגמת עלייה', color: '#ef4444' },
};

const ACTION_TYPE_ICONS: Record<string, string> = {
  pause_ad: '⏸️',
  pause_adset: '⏸️',
  create_adset: '🎯',
  create_ad: '📝',
  scale_budget: '💰',
  new_audience: '👥',
};

function formatCurrency(n: number): string {
  return `₪${Math.round(n).toLocaleString()}`;
}

function formatPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

/* ── Component ── */

export default function DailyReportTab({ clientId, campaignId }: DailyReportTabProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [runningOptimizer, setRunningOptimizer] = useState(false);

  useEffect(() => {
    loadReports();
  }, [clientId, campaignId]);

  async function loadReports() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      if (campaignId) params.set('campaignId', campaignId);
      params.set('limit', '30');

      const res = await fetch(`/api/meta-business/daily-reports?${params.toString()}`);
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
      if (data.length > 0) setSelectedReport(data[0]);
    } catch (e) {
      console.error('[daily-report-tab] Load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function runOptimizer() {
    setRunningOptimizer(true);
    try {
      const res = await fetch('/api/meta-business/daily-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      await res.json();
      await loadReports();
    } catch (e) {
      console.error('[daily-report-tab] Optimizer error:', e);
    } finally {
      setRunningOptimizer(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--foreground-subtle)' }}>
        טוען דוחות יומיים...
      </div>
    );
  }

  const report = selectedReport;

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>
            📊 דוח יומי — אופטימיזציה אוטומטית
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--foreground-subtle)' }}>
            המערכת סורקת כל יום את הביצועים, משהה מפסידנים, יוצרת קהלים חדשים ומודעות דינמיות
          </p>
        </div>
        <button
          onClick={runOptimizer}
          disabled={runningOptimizer}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            background: runningOptimizer ? 'var(--border)' : 'var(--accent)',
            color: runningOptimizer ? 'var(--foreground-subtle)' : '#000',
            fontWeight: 600,
            fontSize: 13,
            cursor: runningOptimizer ? 'wait' : 'pointer',
          }}
        >
          {runningOptimizer ? '⏳ מריץ אופטימיזציה...' : '▶️ הרץ עכשיו'}
        </button>
      </div>

      {/* Report selector */}
      {reports.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {reports.slice(0, 14).map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedReport(r)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: `1px solid ${selectedReport?.id === r.id ? 'var(--accent)' : 'var(--border)'}`,
                background: selectedReport?.id === r.id ? 'var(--accent-bg)' : 'transparent',
                fontSize: 12,
                fontWeight: selectedReport?.id === r.id ? 600 : 400,
                cursor: 'pointer',
                color: 'var(--foreground)',
              }}
            >
              {r.date}
            </button>
          ))}
        </div>
      )}

      {!report ? (
        <div style={{
          padding: 48, textAlign: 'center', borderRadius: 12,
          border: '1px dashed var(--border)', color: 'var(--foreground-subtle)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>אין דוחות יומיים עדיין</div>
          <div style={{ fontSize: 13 }}>הדוח הראשון ייווצר אוטומטית מחר, או לחץ "הרץ עכשיו"</div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <SummaryCard
              label="הוצאה כוללת"
              value={formatCurrency(report.summary.totalSpend)}
              icon="💰"
            />
            <SummaryCard
              label="לידים"
              value={String(report.summary.totalLeads)}
              icon="📋"
            />
            <SummaryCard
              label="CPL ממוצע"
              value={formatCurrency(report.summary.avgCpl)}
              icon={TREND_META[report.summary.cplTrend]?.icon || '➡️'}
              accent={TREND_META[report.summary.cplTrend]?.color}
              sub={`${TREND_META[report.summary.cplTrend]?.label || ''} ${formatPct(report.summary.cplDeltaPct)}`}
            />
            <SummaryCard
              label="ציון בריאות"
              value={`${report.summary.healthScore}/100`}
              icon={report.summary.healthScore >= 70 ? '💚' : report.summary.healthScore >= 40 ? '🟡' : '🔴'}
              accent={report.summary.healthScore >= 70 ? '#22c55e' : report.summary.healthScore >= 40 ? '#f59e0b' : '#ef4444'}
            />
            <SummaryCard
              label="מודעות חדשות"
              value={String(report.summary.newAdsCreated)}
              icon="✨"
              accent="#3b82f6"
            />
            <SummaryCard
              label="מודעות שהושהו"
              value={String(report.summary.adsPaused)}
              icon="⏸️"
              accent="#f59e0b"
            />
          </div>

          {/* CPL Trends */}
          {report.cplTrends.length > 0 && (
            <div style={{
              padding: 20, borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface)',
            }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
                📉 מגמות CPL לפי קמפיין
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.cplTrends.map((trend: CplTrend) => {
                  const meta = TREND_META[trend.trend] || TREND_META.stable;
                  return (
                    <div key={trend.campaignId} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 8,
                      background: 'var(--background)',
                    }}>
                      <span style={{ fontSize: 18 }}>{meta.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                          {trend.campaignName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
                          CPL: {formatCurrency(trend.cplToday)}
                          {trend.cplYesterday > 0 && (
                            <span> (אתמול: {formatCurrency(trend.cplYesterday)})</span>
                          )}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        color: meta.color,
                        background: `${meta.color}15`,
                      }}>
                        {meta.label} {formatPct(trend.cplDeltaPct)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Campaign Performance Breakdown */}
          {report.campaigns.length > 0 && (
            <div style={{
              padding: 20, borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface)',
            }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
                🏆 ביצועי קמפיינים
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: 'var(--foreground-subtle)' }}>קמפיין</th>
                      <th style={{ textAlign: 'center', padding: '8px 8px', fontWeight: 600, color: 'var(--foreground-subtle)' }}>הוצאה</th>
                      <th style={{ textAlign: 'center', padding: '8px 8px', fontWeight: 600, color: 'var(--foreground-subtle)' }}>לידים</th>
                      <th style={{ textAlign: 'center', padding: '8px 8px', fontWeight: 600, color: 'var(--foreground-subtle)' }}>CPL</th>
                      <th style={{ textAlign: 'center', padding: '8px 8px', fontWeight: 600, color: 'var(--foreground-subtle)' }}>CTR</th>
                      <th style={{ textAlign: 'center', padding: '8px 8px', fontWeight: 600, color: 'var(--foreground-subtle)' }}>מגמה</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 600, color: 'var(--foreground-subtle)' }}>מוביל</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.campaigns.map((c) => {
                      const tMeta = TREND_META[c.cplTrend] || TREND_META.stable;
                      return (
                        <tr key={c.campaignId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 500 }}>{c.campaignName}</td>
                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>{formatCurrency(c.spend)}</td>
                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>{c.leads}</td>
                          <td style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>
                            {c.cpl > 0 ? formatCurrency(c.cpl) : '—'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>{c.ctr.toFixed(1)}%</td>
                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                            <span style={{ color: tMeta.color }}>{tMeta.icon} {tMeta.label}</span>
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--foreground-subtle)' }}>
                            {c.topAd ? `${c.topAd.name} (${formatCurrency(c.topAd.cpl)})` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions Taken */}
          {report.actions.length > 0 && (
            <div style={{
              padding: 20, borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface)',
            }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
                ⚡ פעולות שבוצעו ({report.actions.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.actions.map((action: OptimizationAction, i: number) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--background)',
                    borderRight: `3px solid ${action.success ? '#22c55e' : '#ef4444'}`,
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>
                      {ACTION_TYPE_ICONS[action.type] || '⚙️'}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                        {action.objectName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--foreground-subtle)', marginTop: 2 }}>
                        {action.description}
                      </div>
                    </div>
                    <span style={{
                      marginRight: 'auto', padding: '2px 8px', borderRadius: 12, fontSize: 11,
                      background: action.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: action.success ? '#22c55e' : '#ef4444',
                      fontWeight: 600, flexShrink: 0,
                    }}>
                      {action.success ? 'בוצע' : 'נכשל'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Audiences */}
          {report.audiencesGenerated.length > 0 && (
            <div style={{
              padding: 20, borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface)',
            }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>
                🎯 קהלים חדשים שנוצרו ({report.audiencesGenerated.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {report.audiencesGenerated.map((aud, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: 8,
                    background: 'var(--background)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>👥 {aud.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
                      גילאי {aud.ageMin}-{aud.ageMax}
                      {aud.genders.length === 1 && (aud.genders[0] === 1 ? ' • גברים' : ' • נשים')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 4 }}>
                      {aud.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {report.errors.length > 0 && (
            <div style={{
              padding: 16, borderRadius: 12,
              background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#ef4444' }}>
                ⚠️ שגיאות ({report.errors.length})
              </h4>
              {report.errors.map((err, i) => (
                <div key={i} style={{ fontSize: 12, color: '#ef4444', marginBottom: 4 }}>{err}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Summary Card ── */

function SummaryCard({
  label, value, icon, accent, sub,
}: {
  label: string; value: string; icon: string; accent?: string; sub?: string;
}) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 10,
      border: '1px solid var(--border)', background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || 'var(--foreground)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: accent || 'var(--foreground-subtle)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
