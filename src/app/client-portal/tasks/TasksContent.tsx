'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const STATUS: Record<string, { label: string; color: string }> = {
  new:          { label: 'התקבלה', color: '#3b82f6' },
  pending:      { label: 'התקבלה', color: '#3b82f6' },
  in_progress:  { label: 'בעבודה', color: '#f59e0b' },
  under_review: { label: 'בבדיקה', color: '#a855f7' },
  returned:     { label: 'בתיקון', color: '#f97316' },
  approved:     { label: 'אושרה', color: '#22c55e' },
  completed:    { label: 'הושלמה', color: '#15803d' },
};

function parseFile(e: string) { const i = e.indexOf('|'); return i === -1 ? { name: e, url: e } : { name: e.slice(0, i), url: e.slice(i + 1) }; }

function Inner() {
  const sp = useSearchParams();
  const clientId = sp.get('clientId') || (typeof window !== 'undefined' ? (localStorage.getItem('portal_client_id') || localStorage.getItem('frameai_client_id')) : '') || '';
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    (async () => {
      try {
        // Read from the reliable portal store (employee-tasks JSONB), which always
        // persists regardless of the flat tasks-table schema. Returns ONLY the
        // client's portal-submitted requests.
        const r = await fetch(`/api/portal/my-tasks?clientId=${encodeURIComponent(clientId)}`);
        const d = await r.json();
        setTasks(Array.isArray(d.tasks) ? d.tasks : []);
      } catch {} finally { setLoading(false); }
    })();
  }, [clientId]);

  const shown = useMemo(() => filter === 'all' ? tasks : tasks.filter((t) => (STATUS[t.status]?.label || '') === filter), [tasks, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of tasks) { const l = STATUS[t.status]?.label || 'אחר'; c[l] = (c[l] || 0) + 1; }
    return c;
  }, [tasks]);

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: '1rem 1.15rem', marginBottom: 12 };

  return (
    <div style={{ direction: 'rtl', maxWidth: 860, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📋 המשימות שלי</h1>
      <p style={{ color: 'var(--foreground-muted,#6b7280)', fontSize: 13.5, marginBottom: 18 }}>כל המשימות ששלחת והסטטוס שלהן.</p>

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setFilter('all')} style={chip(filter === 'all')}>הכל ({tasks.length})</button>
        {Object.entries(counts).map(([l, n]) => (
          <button key={l} onClick={() => setFilter(l)} style={chip(filter === l)}>{l} ({n})</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--foreground-muted,#888)', textAlign: 'center', padding: '2rem' }}>טוען…</div>
      ) : shown.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--foreground-muted,#888)' }}>
          {tasks.length === 0 ? 'עוד לא שלחת משימות. אפשר להגיש משימה חדשה מהדשבורד.' : 'אין משימות בסטטוס הזה.'}
        </div>
      ) : (
        shown.map((t) => {
          const st = STATUS[t.status] || { label: t.status, color: '#6b7280' };
          const files = [...(Array.isArray(t.files) ? t.files : []), ...(Array.isArray(t.submittedFiles) ? t.submittedFiles : [])].map(parseFile).filter((f) => f.url);
          const typeTag = (t.tags || []).find((x: string) => x !== 'בקשת לקוח');
          return (
            <div key={t.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>{t.title}</div>
                  {typeTag && <span style={{ fontSize: 11, fontWeight: 700, color: '#0066FF', background: 'rgba(0,102,255,0.08)', borderRadius: 6, padding: '2px 7px', marginTop: 4, display: 'inline-block' }}>{typeTag}</span>}
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: st.color, borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>{st.label}</span>
              </div>
              {t.description && <div style={{ fontSize: 13, color: 'var(--foreground-muted,#555)', marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.description}</div>}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 11.5, color: 'var(--foreground-subtle,#999)' }}>
                {t.createdAt && <span>נשלחה: {new Date(t.createdAt).toLocaleDateString('he-IL')}</span>}
                {t.dueDate && <span>יעד: {new Date(t.dueDate).toLocaleDateString('he-IL')}</span>}
              </div>
              {files.length > 0 && (() => {
                const isImg = (u: string) => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u);
                const isVid = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);
                const media = files.filter((f) => isImg(f.url) || isVid(f.url));
                const docs = files.filter((f) => !isImg(f.url) && !isVid(f.url));
                const done = t.status === 'completed' || t.status === 'approved';
                return (
                  <div style={{ marginTop: 12 }}>
                    {done && media.length > 0 && <div style={{ fontSize: 12.5, fontWeight: 800, color: '#16a34a', marginBottom: 6 }}>✅ התוצר מוכן — תצוגה מקדימה:</div>}
                    {media.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: docs.length ? 8 : 0 }}>
                        {media.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" title={f.name} style={{ display: 'block', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
                            {isImg(f.url)
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={f.url} alt={f.name} loading="lazy" style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block', background: 'var(--surface-raised,#f3f4f6)' }} />
                              : <video src={f.url} muted playsInline preload="metadata" style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block', background: '#000' }} />}
                          </a>
                        ))}
                      </div>
                    )}
                    {docs.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {docs.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#0066FF', fontWeight: 600, textDecoration: 'none', background: 'var(--surface-raised,#f3f4f6)', borderRadius: 8, padding: '0.3rem 0.6rem' }}>📎 {f.name.replace(/^🎨\s*/, '')}</a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })
      )}
    </div>
  );
}

function chip(active: boolean): React.CSSProperties {
  return { border: `1px solid ${active ? '#0066FF' : 'var(--border,#e5e7eb)'}`, borderRadius: 999, padding: '0.3rem 0.8rem', background: active ? 'rgba(0,102,255,0.08)' : 'transparent', color: active ? '#0066FF' : 'var(--foreground)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' };
}

export default function TasksContent() {
  return <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>טוען…</div>}><Inner /></Suspense>;
}
