'use client';

import { useEffect, useState } from 'react';

/** Client-facing AI Visibility scorecard. Renders nothing until data exists. */
export default function PortalVisibility({ clientId }: { clientId: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try { const r = await fetch(`/api/portal/visibility?clientId=${encodeURIComponent(clientId)}`); const j = await r.json(); if (j.available) setD(j); } catch { /* */ }
    })();
  }, [clientId]);
  if (!d) return null;

  const sc = (n: number) => (n >= 75 ? '#10B981' : n >= 50 ? '#F59E0B' : '#EF4444');
  const maxM = Math.max(1, ...(d.trend || []).map((t: any) => t.mentions || 0));
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem' };
  const kpi = (label: string, value: any, color?: string, sub?: string) => (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--foreground)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--foreground-subtle,#999)' }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ ...card, marginBottom: '1.5rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>📡 הנראות שלך במנועי AI</h3>
        <span style={{ fontSize: 10.5, color: 'var(--foreground-muted)', background: 'var(--surface-raised,#f3f4f6)', borderRadius: 6, padding: '2px 8px' }}>חודש {d.month}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {kpi('ציון נראות', d.score, sc(d.score), d.scoreDelta ? `${d.scoreDelta > 0 ? '▲' : '▼'} ${Math.abs(d.scoreDelta)}` : undefined)}
        {kpi('אזכורים', d.mentions, '#00B5FE')}
        {kpi('ציטוטים', d.citations, '#00B5FE')}
        {kpi('נתח קול', `${d.shareOfVoice}%`)}
        {kpi('חשיפה (אומדן)', d.estimatedReach)}
      </div>

      {(d.trend || []).length > 1 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 70, marginBottom: 12 }}>
          {d.trend.map((t: any) => (
            <div key={t.month} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: `${(t.mentions / maxM) * 50}px`, background: '#00B5FE', borderRadius: '3px 3px 0 0', minHeight: 2 }} />
              <div style={{ fontSize: 9, color: 'var(--foreground-subtle,#999)', marginTop: 3 }}>{t.month?.slice(5)}</div>
            </div>
          ))}
        </div>
      )}

      {(d.alerts || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {d.alerts.map((a: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.tone === 'good' ? '#10B981' : '#F59E0B', flexShrink: 0 }} />
              <span style={{ color: 'var(--foreground)' }}>{a.label}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--foreground-subtle,#999)', marginTop: 10 }}>* מבוסס על ניטור שאילתות מול מנועי AI — אומדן, לא נתון רשמי של שימוש בפועל.</div>
    </div>
  );
}
