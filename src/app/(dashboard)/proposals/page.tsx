'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useClients } from '@/lib/api/use-entity';
import { PageHeader } from '@/components/ui/saas-kit';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', bg: '#F7F9FC', card: '#FFFFFF',
  text: '#1A1A2E', sub: '#5A5A7A', muted: '#9A9AB0', border: '#E8EAF0', success: '#10B981',
};
const SERVICES = ['ניהול סושיאל', 'Google Ads', 'Meta Ads', 'SEO/GEO', 'בניית אתר', 'תוכן ווידאו (UGC)', 'מיתוג ועיצוב', 'אסטרטגיה שיווקית', 'ניוזלטר/דיוור', 'ניהול קהילה'];
const TONES = ['מקצועי', 'חם', 'חד'] as const;

export default function ProposalsPage() {
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [businessField, setBusinessField] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [goals, setGoals] = useState('');
  const [tone, setTone] = useState<typeof TONES[number]>('מקצועי');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<any>(null);

  const toggle = (s: string) => setServices((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  const pickClient = (id: string) => {
    setClientId(id);
    const c: any = (clients || []).find((x: any) => x.id === id);
    if (c) { setClientName(c.name || ''); setBusinessField((c as any).clientType || businessField); }
  };

  const generate = async () => {
    if (!clientName.trim()) { setErr('נדרש שם לקוח'); return; }
    setBusy(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/proposals/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, clientName, businessField, services, budget, goals, tone }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'שגיאה');
      setRes(d);
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); }
    finally { setBusy(false); }
  };

  const openPrint = () => {
    if (!res?.html) return;
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(res.html); w.document.close();
  };

  const inp: React.CSSProperties = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.55rem 0.8rem', fontSize: 13.5, marginBottom: 10, fontFamily: 'inherit' };
  const p = res?.proposal;

  return (
    <div dir="rtl" style={{ maxWidth: 980, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <PageHeader
        title="📝 מחולל הצעות עבודה"
        subtitle="בנה הצעת עבודה מקצועית ומשכנעת בעברית תוך שניות — מותאמת ללקוח, לשירותים ולתקציב."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem 1.2rem' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>לקוח קיים (אופציונלי)</label>
          <select value={clientId} onChange={(e) => pickClient(e.target.value)} style={inp}>
            <option value="">— בחר לקוח לטעינה אוטומטית —</option>
            {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>שם הלקוח *</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="שם העסק/הלקוח" style={inp} />
          <label style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>תחום העסק</label>
          <input value={businessField} onChange={(e) => setBusinessField(e.target.value)} placeholder="לדוגמה: מסעדה, קליניקה, חנות אונליין" style={inp} />
          <label style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>תקציב/טווח (אופציונלי)</label>
          <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="לדוגמה: ₪5,000 לחודש" style={inp} />
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '1rem 1.2rem' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>שירותים מבוקשים</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 12px' }}>
            {SERVICES.map((s) => (
              <button key={s} onClick={() => toggle(s)} style={{ border: 'none', borderRadius: 999, padding: '0.35rem 0.8rem', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: services.includes(s) ? C.primary : C.bg, color: services.includes(s) ? '#fff' : C.sub, boxShadow: services.includes(s) ? 'none' : `inset 0 0 0 1px ${C.border}` }}>{services.includes(s) ? '✓ ' : ''}{s}</button>
            ))}
          </div>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>מטרות הלקוח</label>
          <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={3} placeholder="מה הלקוח רוצה להשיג? (פניות, מכירות, מודעות…)" style={{ ...inp, resize: 'vertical' }} />
          <label style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>טון</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {TONES.map((t) => <button key={t} onClick={() => setTone(t)} style={{ flex: 1, border: 'none', borderRadius: 10, padding: '0.5rem', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: tone === t ? C.primary : C.bg, color: tone === t ? '#fff' : C.sub, boxShadow: tone === t ? 'none' : `inset 0 0 0 1px ${C.border}` }}>{t}</button>)}
          </div>
        </div>
      </div>

      <button onClick={generate} disabled={busy || !clientName.trim()} style={{ marginTop: 14, background: busy ? '#cbd5e1' : C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '0.75rem 1.8rem', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
        {busy ? '⏳ בונה הצעה…' : '✨ צור הצעת עבודה'}
      </button>
      {err && <div style={{ marginTop: 10, color: '#B45309', fontSize: 13, fontWeight: 600 }}>{err}</div>}

      {p && (
        <div style={{ marginTop: 22, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '1.4rem 1.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>{p.headline}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={openPrint} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 9, padding: '0.45rem 0.9rem', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>🖨 PDF / הדפסה</button>
              <button onClick={() => navigator.clipboard?.writeText(plainText(p))} style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 9, padding: '0.45rem 0.9rem', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>📋 העתק</button>
            </div>
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.8 }}>{p.intro}</p>
          <Section title="הבנת הצורך"><p style={{ color: C.sub, fontSize: 14, lineHeight: 1.8 }}>{p.understanding}</p></Section>
          <Section title="מה כולל השירות">
            {(p.deliverables || []).map((d: any, i: number) => (
              <div key={i} style={{ background: C.bg, borderRadius: 12, padding: '0.8rem 1rem', marginBottom: 8 }}>
                <div style={{ fontWeight: 800, color: C.primaryDark, marginBottom: 4 }}>{d.service}</div>
                <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13.5, lineHeight: 1.9 }}>{(d.items || []).map((it: string, j: number) => <li key={j}>{it}</li>)}</ul>
              </div>
            ))}
          </Section>
          <Section title="מבנה החבילה"><div style={{ background: C.bg, border: `2px solid ${C.primary}30`, borderRadius: 12, padding: '0.8rem 1rem', fontSize: 14 }}>{p.packageSummary}</div></Section>
          <Section title="איך עובדים">
            {(p.process || []).map((s: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 7 }}>
                <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: C.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{i + 1}</span>
                <span style={{ fontSize: 13.5, paddingTop: 2 }}>{s}</span>
              </div>
            ))}
          </Section>
          <Section title="למה Studio Pixel"><ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 14, lineHeight: 1.9 }}>{(p.whyUs || []).map((w: string, i: number) => <li key={i}>{w}</li>)}</ul></Section>
          <div style={{ marginTop: 14, textAlign: 'center', background: C.bg, borderRadius: 12, padding: '1rem' }}><b style={{ fontSize: 15 }}>{p.closing}</b></div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '16px 0' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.primary, letterSpacing: 1, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function plainText(p: any): string {
  const parts = [p.headline, '', p.intro, '', 'הבנת הצורך:', p.understanding, ''];
  for (const d of (p.deliverables || [])) { parts.push(`${d.service}:`); for (const i of (d.items || [])) parts.push(`• ${i}`); parts.push(''); }
  parts.push('מבנה החבילה:', p.packageSummary, '', 'איך עובדים:', ...(p.process || []).map((s: string, i: number) => `${i + 1}. ${s}`), '', 'למה אנחנו:', ...(p.whyUs || []).map((w: string) => `• ${w}`), '', p.closing);
  return parts.join('\n');
}
