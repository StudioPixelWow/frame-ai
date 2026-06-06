'use client';

import { useEffect, useState, useCallback } from 'react';

const BRAND = '#00B5FE';
const COUNTRIES = [['IL', 'ישראל'], ['US', 'ארה״ב'], ['GB', 'בריטניה'], ['DE', 'גרמניה'], ['FR', 'צרפת']];

function role() { try { return localStorage.getItem('frameai_role') || localStorage.getItem('app_role') || 'admin'; } catch { return 'admin'; } }
const H = () => ({ 'Content-Type': 'application/json', 'x-app-role': role() });

interface Competitor { id: string; name: string; page_id: string | null; country: string; deepLink: string }
interface Ad { id: string; competitor_id: string; ad_id: string; page_name: string; body: string; title: string; snapshot_url: string; platforms: any; start_time: string | null; active: boolean; first_seen: string }

export default function TabCompetitors({ clientId }: { clientId: string }) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [name, setName] = useState('');
  const [pageId, setPageId] = useState('');
  const [country, setCountry] = useState('IL');
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/clients/${clientId}/competitors`, { headers: H() });
      const j = await r.json();
      setCompetitors(j.competitors || []);
      setAds(j.ads || []);
    } catch {}
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    try {
      const r = await fetch(`/api/clients/${clientId}/competitors`, { method: 'POST', headers: H(), body: JSON.stringify({ name: name.trim(), pageId: pageId.trim() || undefined, country }) });
      if (!r.ok) { const j = await r.json(); setMsg(j.error || 'שגיאה'); return; }
      setName(''); setPageId(''); load();
    } catch { setMsg('שגיאה בהוספה'); }
  };

  const del = async (id: string) => {
    if (!confirm('להסיר את המתחרה?')) return;
    await fetch(`/api/clients/${clientId}/competitors?competitorId=${id}`, { method: 'DELETE', headers: H() });
    load();
  };

  const scan = async () => {
    setScanning(true); setMsg('');
    try {
      const r = await fetch(`/api/clients/${clientId}/competitors/scan`, { method: 'POST', headers: H() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'שגיאה');
      const added = (j.summary || []).reduce((s: number, x: any) => s + (x.added || 0), 0);
      setMsg(`✓ סריקה הושלמה — ${added} מודעות חדשות. ${(j.summary || []).map((x: any) => `${x.competitor}: ${x.message}`).join(' · ')}`);
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'שגיאה'); }
    finally { setScanning(false); }
  };

  const isNew = (a: Ad) => (Date.now() - new Date(a.first_seen).getTime()) < 1000 * 60 * 60 * 24 * 3; // 3 days
  const shownAds = ads.filter((a) => filter === 'all' || a.competitor_id === filter);
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: 16 };

  return (
    <div dir="rtl">
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🕵️ חקר מתחרים — מודעות פעילות ב-Meta</div>
        <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)', marginBottom: 12 }}>
          הוסף מתחרים, ולחץ "סרוק עכשיו" כדי למשוך את המודעות הפעילות שלהם. למודעות מסחריות בישראל ה-API של Meta מוגבל — לכן לכל מתחרה יש גם קישור ישיר לספריית המודעות (מציג הכל).
        </div>

        {/* Add competitor */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label style={lbl}>שם המתחרה *</label>
            <input className="form-input ux-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם העסק / העמוד" style={{ width: '100%' }} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={lbl}>Page ID (אופציונלי)</label>
            <input className="form-input ux-input" value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="מזהה עמוד" style={{ width: '100%' }} dir="ltr" />
          </div>
          <div style={{ minWidth: 110 }}>
            <label style={lbl}>מדינה</label>
            <select className="form-select ux-input" value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: '100%' }}>
              {COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <button className="mod-btn-primary ux-btn" onClick={add} style={{ fontSize: 13 }}>+ הוסף</button>
          <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={scan} disabled={scanning || competitors.length === 0} style={{ fontSize: 13, background: BRAND, opacity: scanning || !competitors.length ? 0.6 : 1 }}>
            {scanning ? '⏳ סורק…' : '🔄 סרוק עכשיו'}
          </button>
        </div>
        {msg && <div style={{ fontSize: 12, marginTop: 10, color: msg.startsWith('✓') ? '#16a34a' : '#b45309' }}>{msg}</div>}
      </div>

      {/* Competitors list */}
      {competitors.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 10 }}>מתחרים במעקב ({competitors.length})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setFilter('all')} style={chip(filter === 'all')}>הכל</button>
            {competitors.map((c) => (
              <div key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${filter === c.id ? BRAND : 'var(--border)'}`, borderRadius: 999, padding: '0.3rem 0.7rem', background: filter === c.id ? 'rgba(0,181,254,0.08)' : 'transparent' }}>
                <button onClick={() => setFilter(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, color: filter === c.id ? BRAND : 'var(--foreground)' }}>{c.name}</button>
                <a href={c.deepLink} target="_blank" rel="noopener noreferrer" title="פתח בספריית המודעות" style={{ textDecoration: 'none', fontSize: 12 }}>↗</a>
                <button onClick={() => del(c.id)} title="הסר" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ads grid */}
      {shownAds.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {shownAds.map((a) => (
            <div key={a.id} style={{ border: `1px solid ${a.active ? 'var(--border)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', opacity: a.active ? 1 : 0.55 }}>
              <div style={{ position: 'relative', background: 'var(--surface-raised)', minHeight: 120 }}>
                {a.snapshot_url && (
                  <a href={a.snapshot_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '0.8rem', fontSize: 12, color: BRAND, fontWeight: 700, textDecoration: 'none' }}>↗ פתח מודעה בספרייה</a>
                )}
                <div style={{ position: 'absolute', top: 8, insetInlineStart: 8, display: 'flex', gap: 6 }}>
                  {isNew(a) && <span style={{ fontSize: 10, fontWeight: 800, background: '#22c55e', color: '#fff', borderRadius: 6, padding: '2px 6px' }}>חדש</span>}
                  {!a.active && <span style={{ fontSize: 10, fontWeight: 700, background: '#9ca3af', color: '#fff', borderRadius: 6, padding: '2px 6px' }}>ירדה</span>}
                </div>
              </div>
              <div style={{ padding: '0.7rem 0.8rem' }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{a.page_name}</div>
                {a.title && <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--foreground)', marginBottom: 2 }}>{a.title}</div>}
                <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.5, maxHeight: 80, overflow: 'hidden' }}>{a.body}</div>
                <div style={{ fontSize: 10, color: 'var(--foreground-subtle)', marginTop: 6 }}>{(Array.isArray(a.platforms) ? a.platforms : []).join(', ')}{a.start_time ? ` · מ-${new Date(a.start_time).toLocaleDateString('he-IL')}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...card, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
          {competitors.length === 0 ? 'הוסף מתחרה כדי להתחיל.' : 'אין מודעות שמורות עדיין — לחץ "סרוק עכשיו", או פתח את הקישור הישיר של כל מתחרה.'}
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--foreground-muted)', display: 'block', marginBottom: 4 };
function chip(active: boolean): React.CSSProperties {
  return { border: `1px solid ${active ? BRAND : 'var(--border)'}`, borderRadius: 999, padding: '0.3rem 0.8rem', background: active ? 'rgba(0,181,254,0.08)' : 'transparent', color: active ? BRAND : 'var(--foreground)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' };
}
