'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';

const C = {
  primary: '#00B5FE', primaryDark: '#0095D0', primaryLight: '#E6F7FF',
  bg: '#F7F9FC', card: '#FFFFFF', text: '#1A1A2E', sub: '#5A5A7A', muted: '#9A9AB0',
  border: '#E8EAF0', success: '#10B981', warning: '#F59E0B', danger: '#EF4444',
};

type Eligible = { id: string; name: string; businessField: string; color: string };
type RowStatus = 'pending' | 'working' | 'done' | 'failed';
interface Row {
  client: Eligible;
  status: RowStatus;
  replaced?: boolean;
  title?: string;
  graphicText?: string;
  error?: string;
}

const PLATFORMS = [
  { v: 'all', l: 'כל הפלטפורמות' }, { v: 'instagram', l: 'אינסטגרם' },
  { v: 'facebook', l: 'פייסבוק' }, { v: 'tiktok', l: 'טיקטוק' },
];
const FORMATS = [
  { v: 'image', l: 'תמונה' }, { v: 'video', l: 'וידאו' },
  { v: 'reel', l: 'ריל' }, { v: 'story', l: 'סטורי' }, { v: 'carousel', l: 'קרוסלה' },
];

export default function RtmBroadcastPage() {
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // form
  const today = new Date().toISOString().slice(0, 10);
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState(today);
  const [platform, setPlatform] = useState('all');
  const [format, setFormat] = useState('image');
  const [notes, setNotes] = useState('');

  // run
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/rtm-broadcast', { cache: 'no-store' });
      const d = await r.json();
      setEligible(d.clients || []);
    } catch { setEligible([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    total: rows.length,
    done: rows.filter((r) => r.status === 'done').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    replaced: rows.filter((r) => r.status === 'done' && r.replaced).length,
  }), [rows]);
  const progressPct = rows.length ? Math.round(((counts.done + counts.failed) / rows.length) * 100) : 0;

  const startBroadcast = async () => {
    if (!topic.trim() || !date) return;
    setRunning(true); setDone(false);
    const initial: Row[] = eligible.map((c) => ({ client: c, status: 'pending' }));
    setRows(initial);

    for (let i = 0; i < eligible.length; i++) {
      const c = eligible[i];
      setRows((prev) => prev.map((r) => (r.client.id === c.id ? { ...r, status: 'working' } : r)));
      try {
        const res = await fetch('/api/rtm-broadcast', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: c.id, topic, date, platform, format, notes }),
        });
        const d = await res.json();
        if (!res.ok || !d.success) throw new Error(d.error || 'שגיאה');
        setRows((prev) => prev.map((r) => (r.client.id === c.id
          ? { ...r, status: 'done', replaced: d.result?.replaced, title: d.result?.title, graphicText: d.result?.graphicText }
          : r)));
      } catch (e) {
        setRows((prev) => prev.map((r) => (r.client.id === c.id
          ? { ...r, status: 'failed', error: e instanceof Error ? e.message : 'שגיאה' }
          : r)));
      }
    }
    setRunning(false); setDone(true);
  };

  const closeModal = () => { if (running) return; setOpen(false); setRows([]); setDone(false); };

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' });

  const STATUS_UI: Record<RowStatus, { l: string; c: string; icon: string }> = {
    pending: { l: 'ממתין', c: C.muted, icon: '○' },
    working: { l: 'מפתח רעיון…', c: C.primary, icon: '◐' },
    done: { l: 'שובץ', c: C.success, icon: '✓' },
    failed: { l: 'נכשל', c: C.danger, icon: '✕' },
  };

  return (
    <div dir="rtl" style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', color: C.text, background: C.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 12, color: C.primary, letterSpacing: 2, fontWeight: 800 }}>REAL-TIME MARKETING</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: '2px 0' }}>⚡ שיבוץ RTM לכל הלקוחות</h1>
          <p style={{ color: C.sub, fontSize: 13.5, margin: 0 }}>
            קרה משהו עכשיו? שבץ תוכן RTM בתאריך אחד — המערכת מפתחת את הרעיון בנפרד לכל לקוח פרסום ומחליפה את התוכן שתוכנן לאותו יום.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={loading || eligible.length === 0}
          style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '0.7rem 1.3rem', fontWeight: 800, fontSize: 14.5, cursor: eligible.length ? 'pointer' : 'not-allowed', boxShadow: '0 4px 14px rgba(0,181,254,0.3)' }}>
          + שיבוץ תוכן RTM
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '1.2rem 1.4rem' }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>לקוחות פרסום פעילים שיקבלו שיבוץ</div>
        {loading ? (
          <div style={{ color: C.muted, fontSize: 13 }}>טוען…</div>
        ) : eligible.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13 }}>אין כרגע לקוחות פרסום פעילים (clientType=marketing, status=active).</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {eligible.map((c) => (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 99, padding: '5px 12px', fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: c.color }} />{c.name}
              </span>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: C.sub }}>סה״כ {eligible.length} לקוחות</div>
      </div>

      {open && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', zIndex: 50, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 20, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(16,24,40,0.25)', overflow: 'hidden' }}>
            <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff', padding: '16px 22px' }}>
              <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, letterSpacing: 1 }}>RTM BROADCAST</div>
              <div style={{ fontSize: 19, fontWeight: 900 }}>שיבוץ תוכן RTM לכל הלקוחות</div>
            </div>

            <div style={{ padding: '20px 22px' }}>
              {rows.length === 0 ? (
                <>
                  <Field label="מה קרה? נושא ה-RTM">
                    <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3}
                      placeholder="לדוגמה: ישראל זכתה במדליה אולימפית / גל חום קיצוני / טרנד חדש ברשת…"
                      style={ta} />
                  </Field>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Field label="תאריך לשיבוץ בגאנט" style={{ flex: 1, minWidth: 160 }}>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
                    </Field>
                    <Field label="פלטפורמה" style={{ flex: 1, minWidth: 140 }}>
                      <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inp}>
                        {PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                      </select>
                    </Field>
                    <Field label="פורמט" style={{ flex: 1, minWidth: 120 }}>
                      <select value={format} onChange={(e) => setFormat(e.target.value)} style={inp}>
                        {FORMATS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="הנחיות נוספות (אופציונלי)">
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="טון, זווית, הצעה ספציפית…" style={inp} />
                  </Field>

                  <div style={{ background: C.primaryLight, border: `1px solid ${C.primary}33`, borderRadius: 12, padding: '12px 14px', fontSize: 12.5, color: C.primaryDark, margin: '4px 0 16px' }}>
                    ⚡ יישובצו <b>{eligible.length}</b> לקוחות בתאריך <b>{fmtDate(date)}</b>. לכל לקוח יפותח פוסט נפרד ומותאם, ויחליף את התוכן שתוכנן לאותו יום (אם קיים).
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start' }}>
                    <button onClick={startBroadcast} disabled={!topic.trim()} style={{ background: topic.trim() ? C.primary : C.border, color: '#fff', border: 'none', borderRadius: 12, padding: '0.7rem 1.4rem', fontWeight: 800, fontSize: 14, cursor: topic.trim() ? 'pointer' : 'not-allowed' }}>
                      התחל שיבוץ ({eligible.length})
                    </button>
                    <button onClick={closeModal} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.7rem 1.2rem', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: C.sub }}>ביטול</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700 }}>{done ? 'הסתיים' : 'מפתח ומשבץ…'} ({counts.done + counts.failed}/{counts.total})</span>
                      <span style={{ color: C.sub }}>{counts.done} שובצו{counts.failed ? ` · ${counts.failed} נכשלו` : ''}</span>
                    </div>
                    <div style={{ height: 8, background: C.bg, borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${progressPct}%`, height: '100%', background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`, transition: 'width .3s' }} />
                    </div>
                  </div>

                  <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {rows.map((r) => {
                      const s = STATUS_UI[r.status];
                      return (
                        <div key={r.client.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px' }}>
                          <span style={{ color: s.c, fontWeight: 900, width: 16, textAlign: 'center' }}>{s.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.client.name}</div>
                            {r.status === 'done' && r.title && <div style={{ fontSize: 11.5, color: C.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.replaced ? '↻ הוחלף · ' : '+ נוצר · '}{r.title}</div>}
                            {r.status === 'failed' && <div style={{ fontSize: 11.5, color: C.danger }}>{r.error}</div>}
                          </div>
                          <span style={{ fontSize: 11.5, color: s.c, fontWeight: 700 }}>{s.l}</span>
                        </div>
                      );
                    })}
                  </div>

                  {done && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button onClick={closeModal} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '0.7rem 1.4rem', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>סיום</button>
                      {counts.failed > 0 && (
                        <button onClick={startBroadcast} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 12, padding: '0.7rem 1.2rem', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: C.sub }}>הרץ שוב</button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 13.5, color: C.text, background: '#fff', fontFamily: 'inherit' };
const ta: React.CSSProperties = { ...inp, resize: 'vertical' as const };

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.sub, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
