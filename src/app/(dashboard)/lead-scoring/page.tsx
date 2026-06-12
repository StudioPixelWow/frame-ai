'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/saas-kit';
import { useRouter } from 'next/navigation';
import { useLeads } from '@/lib/api/use-entity';
import { scoreAndRankLeads, TIER_META, type LeadTier } from '@/lib/leads/scoring';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', bg: '#F7F9FC', card: '#FFFFFF',
  text: '#1A1A2E', sub: '#5A5A7A', muted: '#9A9AB0', border: '#E8EAF0',
};
const sc = (n: number) => (n >= 70 ? '#EF4444' : n >= 45 ? '#F59E0B' : n >= 20 ? '#3B82F6' : '#9A9AB0');

export default function LeadScoringPage() {
  const { data: leads, loading } = useLeads();
  const router = useRouter();
  const [filter, setFilter] = useState<LeadTier | 'all'>('all');

  const ranked = useMemo(() => {
    const open = (leads || []).filter((l: any) => !['won', 'lost', 'not_relevant', 'duplicate'].includes(l.status));
    return scoreAndRankLeads(open);
  }, [leads]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { hot: 0, warm: 0, cold: 0, dead: 0 };
    for (const l of ranked) c[l._score.tier]++;
    return c;
  }, [ranked]);

  const shown = filter === 'all' ? ranked : ranked.filter((l) => l._score.tier === filter);

  return (
    <div dir="rtl" style={{ maxWidth: 1080, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <PageHeader
        title="🎯 דירוג לידים חמים"
        subtitle="הלידים מדורגים אוטומטית לפי סיכוי לסגירה — עבדו קודם את החמים ביותר."
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['all', `הכל (${ranked.length})`], ['hot', `${TIER_META.hot.label} (${counts.hot})`], ['warm', `${TIER_META.warm.label} (${counts.warm})`], ['cold', `${TIER_META.cold.label} (${counts.cold})`]] as [LeadTier | 'all', string][]).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ border: 'none', borderRadius: 10, padding: '0.45rem 0.9rem', fontSize: 12.5, fontWeight: filter === k ? 800 : 600, cursor: 'pointer', background: filter === k ? C.primary : C.card, color: filter === k ? '#fff' : C.sub, boxShadow: filter === k ? 'none' : `inset 0 0 0 1px ${C.border}` }}>{label}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '4rem', color: C.muted }}>טוען…</div> :
        shown.length === 0 ? <div style={{ textAlign: 'center', padding: '3rem', color: C.muted }}>אין לידים להצגה.</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {shown.map((l: any) => {
              const tm = TIER_META[l._score.tier as LeadTier];
              return (
                <div key={l.id} onClick={() => router.push(`/leads/${l.id}`)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '0.9rem 1.1rem', display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: `${sc(l._score.score)}18`, color: sc(l._score.score), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>{l._score.score}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 15 }}>{l.fullName || l.name || 'ליד'}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: tm.color, background: `${tm.color}18`, borderRadius: 6, padding: '1px 7px' }}>{tm.label}</span>
                      {l.company && <span style={{ fontSize: 12, color: C.muted }}>· {l.company}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{(l._score.reasons || []).join(' · ')}</div>
                    <div style={{ fontSize: 12, color: C.primaryDark, fontWeight: 700, marginTop: 3 }}>← {l._score.nextAction}</div>
                  </div>
                  <div style={{ textAlign: 'left', flexShrink: 0 }}>
                    {l.phone && <div style={{ fontSize: 12, color: C.sub }}>{l.phone}</div>}
                    {(l.proposalAmount || l.value) ? <div style={{ fontSize: 13, fontWeight: 800 }}>₪{Number(l.proposalAmount || l.value).toLocaleString('he-IL')}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
