'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Report } from '@/lib/db/schema';

const REPORT_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  campaign: { label: 'דוח קמפיין', icon: '📊' },
  client_monthly: { label: 'דוח חודשי', icon: '📋' },
  internal_manager: { label: 'דוח ביצועים', icon: '📈' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function ReportsContentInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch reports on mount
  useState(() => {
    if (!clientId) return;
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    try {
      const role = localStorage.getItem('frameai_role');
      const cId = localStorage.getItem('frameai_client_id');
      if (role) headers['x-app-role'] = role;
      if (cId) headers['x-app-client-id'] = cId;
    } catch {}

    fetch(`/api/data/reports?clientId=${clientId}`, { cache: 'no-store', headers })
      .then(res => res.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          // Only show client_facing reports
          setReports(data.filter((r: Report) => r.mode === 'client_facing'));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  });

  const handlePreview = (reportId: string) => {
    window.open(`/api/data/reports/${reportId}?format=html`, '_blank');
  };

  return (
    <div style={{ direction: 'rtl', maxWidth: '700px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <a href={`/client-portal/dashboard?clientId=${clientId}`} style={{
          fontSize: '0.8rem', color: 'var(--foreground-muted)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem',
        }}>
          ← חזרה לדשבורד
        </a>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>הדוחות שלך</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: 0 }}>
          סיכומי ביצועים, קמפיינים ותוצאות
        </p>
      </div>

      {/* Reports List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '1.5rem', animation: 'pulse 1.5s infinite', marginBottom: '0.5rem' }}>📊</div>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem' }}>טוען דוחות...</p>
        </div>
      ) : reports.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reports.map(report => {
            const meta = REPORT_TYPE_LABELS[report.type] || { label: 'דוח', icon: '📄' };
            const data = report.data as any;
            return (
              <div key={report.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '0.75rem', padding: '1.25rem', transition: 'border-color 200ms',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{
                    width: '3rem', height: '3rem', borderRadius: '0.75rem',
                    background: 'rgba(0,181,254,0.08)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0,
                  }}>{meta.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
                      {report.title}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px',
                        background: 'rgba(0,181,254,0.1)', color: '#00B5FE',
                      }}>{meta.label}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)' }}>
                        {formatDate(report.createdAt)}
                      </span>
                      {report.periodStart && report.periodEnd && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--foreground-subtle)' }}>
                          {new Date(report.periodStart).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} – {new Date(report.periodEnd).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    {/* Quick summary */}
                    {data && (
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                        {data.totalLeads != null && <span>{data.totalLeads} לידים</span>}
                        {data.totalSpend != null && data.totalSpend > 0 && <span>₪{data.totalSpend.toLocaleString('he-IL')} הוצאה</span>}
                        {data.avgCpl != null && data.avgCpl > 0 && <span>₪{data.avgCpl.toFixed(0)} לליד</span>}
                      </div>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button onClick={() => handlePreview(report.id)} style={{
                    flex: 1, padding: '0.6rem', border: '1px solid var(--border)',
                    background: 'var(--surface)', borderRadius: '0.5rem',
                    color: 'var(--foreground)', fontSize: '0.8rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 200ms',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#00B5FE'; (e.currentTarget as HTMLElement).style.color = '#00B5FE'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; }}
                  >
                    📄 צפה בדוח
                  </button>
                  <button onClick={() => handlePreview(report.id)} style={{
                    padding: '0.6rem 1rem', border: 'none',
                    background: '#00B5FE', borderRadius: '0.5rem',
                    color: '#fff', fontSize: '0.8rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'opacity 200ms',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '0.9'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '1'; }}
                  >
                    ⬇ הורד PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '1rem', padding: '3.5rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
          <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--foreground-muted)', margin: '0 0 0.25rem 0' }}>
            עדיין אין דוחות
          </p>
          <p style={{ color: 'var(--foreground-subtle)', fontSize: '0.85rem', margin: 0 }}>
            ברגע שנכין עבורך דוח ביצועים, הוא יופיע כאן
          </p>
        </div>
      )}
    </div>
  );
}

export default function ReportsContent() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...טוען</div>}>
      <ReportsContentInner />
    </Suspense>
  );
}
