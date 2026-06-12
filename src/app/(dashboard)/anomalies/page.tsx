'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/saas-kit';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', bg: '#F7F9FC', card: '#FFFFFF',
  text: '#1A1A2E', sub: '#5A5A7A', muted: '#9A9AB0', border: '#E8EAF0',
  high: '#EF4444', med: '#F59E0B', low: '#3B82F6',
};
const SEV: Record<string, { l: string; c: string }> = {
  high: { l: 'חמור', c: C.high }, medium: { l: 'בינוני', c: C.med }, low: { l: 'קל', c: C.low },
};
const CHANNEL_ICON: Record<string, string> = { GEO: '📡', SEO: '🔍', 'Google Ads': '🎯' };

export default function AnomaliesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { const r = await fetch('/api/anomalies', { cache: 'no-store' }); const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.error || 'שגיאה'); setData(d); }
    catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const anomalies = data?.anomalies || [];
  const counts = { high: anomalies.filter((a: any) => a.severity === 'high').length, medium: anomalies.filter((a: any) => a.severity === 'medium').length, low: anomalies.filter((a: any) => a.severity === 'low').length };

  return (
    <div dir="rtl" style={{ maxWidth: 1000, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <PageHeader
        title="🚨 מכ״ם אנומליות"
        subtitle="זיהוי אוטומטי של שינויים חריגים בכל הלקוחות — נראות AI, דירוגים אורגניים ו-Google Ads."
        primaryAction={{ label: loading ? '⏳ סורק…' : '🔄 סרוק שוב', onClick: () => { if (!loading) load(); } }}
      />

      {err && <div style={{ background: '#FEF2F2', border: `1px solid ${C.high}40`, color: C.high, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠ {err}</div>}

      {!loading && data && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[['חמור', counts.high, C.high], ['בינוני', counts.medium, C.med], ['קל', counts.low, C.low]].map(([l, n, c]: any) => (
            <div key={l} style={{ flex: 1, minWidth: 120, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.8rem 1rem', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: c }}>{n}</div>
              <div style={{ fontSize: 12, color: C.sub }}>{l}</div>
            </div>
          ))}
          <div style={{ flex: 1, minWidth: 120, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.8rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.text }}>{data.clientsScanned}</div>
            <div style={{ fontSize: 12, color: C.sub }}>לקוחות נסרקו</div>
          </div>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: '4rem', color: C.muted }}>סורק את כל הלקוחות…</div> :
        anomalies.length === 0 ? <div style={{ textAlign: 'center', padding: '3rem', background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, color: C.sub }}>✓ לא זוהו אנומליות. הכל יציב.</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {anomalies.map((a: any, i: number) => {
              const s = SEV[a.severity] || SEV.low;
              return (
                <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderInlineStart: `4px solid ${s.c}`, borderRadius: 12, padding: '0.9rem 1.1rem', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 22 }}>{CHANNEL_ICON[a.channel] || '⚠'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{a.clientName}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: s.c, background: `${s.c}18`, borderRadius: 6, padding: '1px 7px' }}>{s.l}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{a.channel} · {a.metric}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: a.direction === 'down' ? C.high : C.med }}>{a.direction === 'down' ? '▼' : '▲'}{a.changePct != null ? ` ${Math.abs(a.changePct)}%` : ''}</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.text, marginTop: 4, lineHeight: 1.6 }}>{a.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
