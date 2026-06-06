'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';

const BRAND = '#00B5FE';

const BUSINESS_TYPES = ['נדל״ן', 'מסעדה', 'חנות', 'קליניקה', 'שירות', 'לוגיסטיקה', 'אולם', 'אחר'];
const GOALS = ['חשיפה', 'לידים', 'מכירה', 'ביקור במקום', 'השקת עסק', 'הצגת יתרונות'];
const TONES = ['צעיר', 'פרימיום', 'רשמי', 'אותנטי', 'מצחיק', 'חד ומכירתי'];
const DURATIONS = [15, 25, 30, 45];
const STYLES = ['אותנטי מהשטח', 'פרימיום עסקי', 'צעיר וטיקטוקי', 'נדל״ן מכירתי', 'המלצה אישית'];

function role() { try { return localStorage.getItem('app_role') || 'admin'; } catch { return 'admin'; } }
const H = () => ({ 'Content-Type': 'application/json', 'x-app-role': role() });

interface Pkg { variations: any[]; qc: { passed: boolean; checks: { id: string; label: string; ok: boolean }[] } }

export default function UgcPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState('');
  const [form, setForm] = useState({
    businessName: '', businessType: 'נדל״ן', goal: 'לידים', targetAudience: '', tone: 'אותנטי',
    sellingPoints: '', location: '', presenterType: 'real', existingAssets: '', duration: 30, language: 'he', style: 'אותנטי מהשטח',
  });
  const [busy, setBusy] = useState('');
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState('');
  // Product-link scrape
  const [productUrl, setProductUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  // HeyGen render (reuses the existing avatars/voices/generate/status integration)
  const [avatars, setAvatars] = useState<any[]>([]);
  const [voices, setVoices] = useState<any[]>([]);
  const [avatarId, setAvatarId] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [heygenReady, setHeygenReady] = useState<boolean | null>(null);
  const [rendering, setRendering] = useState(false);
  const [video, setVideo] = useState<{ status: string; url?: string } | null>(null);
  const [sceneImages, setSceneImages] = useState<Record<string, string[]>>({}); // variationId → [dataURL per shot]
  const [scenesBusy, setScenesBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [av, vo] = await Promise.all([
          fetch('/api/data/heygen/avatars').then((r) => r.ok ? r.json() : []),
          fetch('/api/data/heygen/voices').then((r) => r.ok ? r.json() : []),
        ]);
        const avList = Array.isArray(av) ? av : [];
        const voList = Array.isArray(vo) ? vo : [];
        setAvatars(avList); setVoices(voList);
        setHeygenReady(avList.length > 0);
        // Default to a Hebrew voice if present.
        const he = voList.find((v: any) => /he|hebrew|עברית/i.test(`${v.language || ''} ${v.name || ''}`));
        if (he) setVoiceId(he.voice_id || he.id || '');
        if (avList[0]) setAvatarId(avList[0].avatar_id || avList[0].id || '');
      } catch { setHeygenReady(false); }
    })();
  }, []);

  const scrapeProduct = async () => {
    if (!productUrl.trim()) return;
    setScraping(true); setErr('');
    try {
      const r = await fetch('/api/ugc/scrape-product', { method: 'POST', headers: H(), body: JSON.stringify({ url: productUrl.trim() }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'שגיאה');
      const p = j.prefill || {};
      setForm((f) => ({
        ...f,
        businessName: p.businessName || f.businessName,
        businessType: ['נדל״ן', 'מסעדה', 'חנות', 'קליניקה', 'שירות', 'לוגיסטיקה', 'אולם', 'אחר'].includes(p.businessType) ? p.businessType : f.businessType,
        sellingPoints: p.sellingPoints || f.sellingPoints,
        targetAudience: p.targetAudience || f.targetAudience,
        existingAssets: (j.images || []).slice(0, 3).join(', ') || f.existingAssets,
      }));
      setMsg(`✓ נשאבו פרטי המוצר מהקישור${j.images?.length ? ` (${j.images.length} תמונות)` : ''}.`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה בשאיבה'); }
    finally { setScraping(false); }
  };

  const genScenes = async () => {
    const v = pkg?.variations[active];
    if (!v?.shots?.length) return;
    setScenesBusy(true); setErr('');
    const imgs: string[] = [];
    try {
      for (const s of v.shots) {
        try {
          const r = await fetch('/api/ugc/scene-image', { method: 'POST', headers: H(), body: JSON.stringify({ shotType: s.shotType, vo: s.vo, direction: s.direction, businessName: form.businessName, businessType: form.businessType, style: form.style }) });
          const j = await r.json();
          imgs.push(r.ok && j.image ? j.image : '');
        } catch { imgs.push(''); }
        setSceneImages((m) => ({ ...m, [v.id]: [...imgs] }));
      }
    } finally { setScenesBusy(false); }
  };

  const renderVideo = async () => {
    const v = pkg?.variations[active];
    if (!v) return;
    if (!avatarId || !voiceId) { setErr('בחר דמות וקול'); return; }
    setRendering(true); setVideo({ status: 'pending' }); setErr('');
    try {
      const gen = await fetch('/api/data/heygen/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatarId, voiceId, script: v.fullScript, dimension: { width: 1080, height: 1920 } }) });
      const gj = await gen.json();
      if (!gen.ok || !gj.videoId) throw new Error(gj.error || 'יצירת הווידאו נכשלה');
      const videoId = gj.videoId;
      // Poll status (up to ~5 min).
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const st = await fetch(`/api/data/heygen/status?videoId=${videoId}`).then((r) => r.json());
        if (st.status === 'completed' && st.videoUrl) {
          setVideo({ status: 'completed', url: st.videoUrl });
          // Auto-save the finished video into the client's Files tab.
          if (clientId) {
            try {
              await fetch('/api/data/client-files', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-role': 'admin' }, body: JSON.stringify({ clientId, fileName: `UGC · ${form.businessName || 'סרטון'} · ${new Date().toLocaleDateString('he-IL')}`, fileUrl: st.videoUrl, fileType: 'video', category: 'social_media', fileSize: 0, uploadedBy: null, notes: 'נוצר במחולל UGC' }) });
              setMsg('✓ הווידאו נשמר אוטומטית לקבצי הלקוח.');
            } catch {}
          }
          break;
        }
        if (st.status === 'failed') { setVideo({ status: 'failed' }); throw new Error(st.error || 'הרינדור נכשל'); }
        setVideo({ status: st.status || 'processing' });
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה ברינדור'); }
    finally { setRendering(false); }
  };

  const loadProjects = async () => {
    try { const r = await fetch('/api/ugc/projects', { headers: H() }); const j = await r.json(); setProjects(j.projects || []); } catch {}
  };
  useEffect(() => { loadProjects(); }, []);
  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/data/clients', { headers: { 'x-app-role': role() } }); const d = await r.json(); setClients(Array.isArray(d) ? d : d.clients || []); } catch {}
    })();
  }, []);

  // When a client is picked, auto-fill the brief from everything we know about them.
  const pickClient = async (id: string) => {
    setClientId(id);
    if (!id) return;
    try {
      const r = await fetch(`/api/ugc/client-prefill?clientId=${id}`, { headers: H() });
      const j = await r.json();
      const p = j.prefill || {};
      setForm((f) => ({
        ...f,
        businessName: p.businessName || f.businessName,
        businessType: p.businessType && ['נדל״ן', 'מסעדה', 'חנות', 'קליניקה', 'שירות', 'לוגיסטיקה', 'אולם', 'אחר'].includes(p.businessType) ? p.businessType : f.businessType,
        targetAudience: p.targetAudience || f.targetAudience,
        sellingPoints: p.sellingPoints || f.sellingPoints,
        tone: p.tone && ['צעיר', 'פרימיום', 'רשמי', 'אותנטי', 'מצחיק', 'חד ומכירתי'].includes(p.tone) ? p.tone : f.tone,
        location: p.location || f.location,
      }));
      setMsg(j.hasKnowledge ? '✓ הבריף מולא מתוך הידע על הלקוח — התסריט יתבסס על המיצוב, הקהל והטון שלו.' : 'הלקוח נטען (אין עדיין חקר לקוח — מומלץ להריץ חקר לקוח לתוצאה מדויקת יותר).');
    } catch { /* ignore */ }
  };

  // Deep-link: /ugc?clientId=… → auto-select the client once the list loads.
  useEffect(() => {
    if (!clients.length || clientId) return;
    try { const q = new URLSearchParams(window.location.search).get('clientId'); if (q) pickClient(q); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients.length]);

  const generate = async () => {
    if (!form.businessName.trim()) { setErr('שם העסק נדרש'); return; }
    setErr(''); setPkg(null); setBusy('יוצר פרויקט…');
    try {
      const cr = await fetch('/api/ugc/projects', { method: 'POST', headers: H(), body: JSON.stringify({ ...form, clientId: clientId || undefined }) });
      const cj = await cr.json();
      if (!cr.ok) throw new Error(cj.error || 'שגיאה ביצירת פרויקט');
      setBusy('כותב תסריט, סטוריבורד ופרומפטים… (כ-30 שניות)');
      const gr = await fetch('/api/ugc/generate', { method: 'POST', headers: H(), body: JSON.stringify({ projectId: cj.project.id }) });
      const gj = await gr.json();
      if (!gr.ok) throw new Error(gj.error || 'שגיאה ביצירה');
      setPkg(gj.package); setActive(0); loadProjects();
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); }
    finally { setBusy(''); }
  };

  const openProject = async (id: string) => {
    try {
      const r = await fetch(`/api/ugc/projects/${id}`, { headers: H() }); const j = await r.json();
      if (j.project?.result_json) { setPkg(j.project.result_json); setActive(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else setErr('לפרויקט זה אין עדיין תוצר — צור חדש');
    } catch {}
  };

  const copy = (t: string) => { navigator.clipboard?.writeText(t).catch(() => {}); };

  const exportMd = () => {
    if (!pkg) return;
    const v = pkg.variations[active];
    const md = [
      `# UGC — ${form.businessName} (${v.label})`,
      `\n## Hook\n${v.hook}`,
      `\n## תסריט מלא\n${v.fullScript}`,
      `\n## סטוריבורד`,
      ...v.shots.map((s: any) => `- ${s.time} · ${s.shotType}: ${s.vo} | כתובית: ${s.caption} | צילום: ${s.direction}`),
      `\n## כתוביות\n${(v.captions || []).join('\n')}`,
      `\n## CTA\n${v.cta}`,
      `\n## פרומפטים לכלים`,
      ...v.toolPrompts.map((p: any) => `### ${p.tool} (${p.type})\n${p.prompt}`),
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `UGC-${form.businessName}-${v.label}.md`; a.click();
  };

  const card: React.CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e7eb)', borderRadius: 14, padding: '1.1rem 1.25rem', marginBottom: 16 };
  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'var(--foreground-muted,#6b7280)', display: 'block', marginBottom: 5 };

  return (
    <div dir="rtl" style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem 4rem', color: 'var(--foreground,#111)' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>🎬 UGC Business Video Generator</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 22 }}>חבילת הפקה מלאה לסרטון UGC עסקי 9:16 — תסריט, סטוריבורד, שוטים, כתוביות, קריינות, פרומפטים ל-AI ו-3 וריאציות.</p>

      {/* Brief */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>בריף קצר</div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>🔗 הדבק קישור מוצר/דף נחיתה — ונמלא את הבריף אוטומטית</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input ux-input" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') scrapeProduct(); }} placeholder="https://…" style={{ flex: 1 }} dir="ltr" />
            <button className="mod-btn-ghost ux-btn" onClick={scrapeProduct} disabled={scraping || !productUrl.trim()} style={{ fontSize: 13, whiteSpace: 'nowrap', opacity: scraping || !productUrl.trim() ? 0.5 : 1 }}>{scraping ? '⏳ שואב…' : '↧ שאב פרטים'}</button>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>🔗 שייך ללקוח (ימלא את הבריף וישתמש בכל הידע עליו)</label>
          <select className="form-select ux-input" value={clientId} onChange={(e) => pickClient(e.target.value)} style={{ width: '100%' }}>
            <option value="">— ללא שיוך (בריף ידני) —</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lbl}>שם העסק / פרויקט *</label><input className="form-input ux-input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} style={{ width: '100%' }} /></div>
          <div><label style={lbl}>תחום</label><select className="form-select ux-input" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} style={{ width: '100%' }}>{BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label style={lbl}>מטרה</label><select className="form-select ux-input" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} style={{ width: '100%' }}>{GOALS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label style={lbl}>טון דיבור</label><select className="form-select ux-input" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} style={{ width: '100%' }}>{TONES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label style={lbl}>קהל יעד</label><input className="form-input ux-input" value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} style={{ width: '100%' }} /></div>
          <div><label style={lbl}>מיקום / כתובת</label><input className="form-input ux-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ width: '100%' }} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>נקודות מכירה מרכזיות</label><textarea className="form-input ux-input" rows={2} value={form.sellingPoints} onChange={(e) => setForm({ ...form, sellingPoints: e.target.value })} style={{ width: '100%', resize: 'vertical' }} /></div>
          <div><label style={lbl}>פרזנטור</label><select className="form-select ux-input" value={form.presenterType} onChange={(e) => setForm({ ...form, presenterType: e.target.value })} style={{ width: '100%' }}><option value="real">פרזנטור אמיתי</option><option value="ai">פרזנטור AI (לייצר)</option></select></div>
          <div><label style={lbl}>משך (שניות)</label><select className="form-select ux-input" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} style={{ width: '100%' }}>{DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>חומרים קיימים (וידאו/תמונות/לוגו/צבעי מותג)</label><input className="form-input ux-input" value={form.existingAssets} onChange={(e) => setForm({ ...form, existingAssets: e.target.value })} style={{ width: '100%' }} /></div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={lbl}>סגנון</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STYLES.map((s) => (
              <button key={s} onClick={() => setForm({ ...form, style: s })}
                style={{ padding: '0.45rem 0.85rem', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${form.style === s ? BRAND : 'var(--border,#e5e7eb)'}`, background: form.style === s ? 'rgba(0,181,254,0.1)' : 'transparent', color: form.style === s ? BRAND : 'var(--foreground)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {err && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12, fontWeight: 600 }}>{err}</div>}
        <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={generate} disabled={!!busy}
          style={{ marginTop: 16, width: '100%', fontSize: 15, fontWeight: 800, padding: '0.8rem', opacity: busy ? 0.7 : 1 }}>
          {busy || '✨ צור חבילת הפקה (3 וריאציות)'}
        </button>
      </div>

      {/* Result */}
      {pkg && (
        <>
          {/* QC */}
          <div style={{ ...card, border: `1px solid ${pkg.qc.passed ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.4)'}`, background: pkg.qc.passed ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: pkg.qc.passed ? '#16a34a' : '#b45309' }}>{pkg.qc.passed ? '✅ Quality Check עבר' : '⚠️ Quality Check — שים לב'}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pkg.qc.checks.map((c) => (
                <span key={c.id} style={{ fontSize: 11.5, fontWeight: 600, padding: '0.25rem 0.6rem', borderRadius: 999, background: c.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: c.ok ? '#16a34a' : '#dc2626' }}>{c.ok ? '✓' : '✕'} {c.label}</span>
              ))}
            </div>
          </div>

          {/* Variation tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {pkg.variations.map((v, i) => (
              <button key={v.id || i} onClick={() => setActive(i)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: `1px solid ${active === i ? BRAND : 'var(--border,#e5e7eb)'}`, background: active === i ? 'rgba(0,181,254,0.08)' : 'transparent', color: active === i ? BRAND : 'var(--foreground)' }}>
                {v.label}
              </button>
            ))}
          </div>

          {(() => {
            const v = pkg.variations[active]; if (!v) return null;
            return (
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{v.label}</div>
                  <button className="mod-btn-ghost ux-btn" onClick={exportMd} style={{ fontSize: 12.5 }}>⬇ ייצוא Markdown</button>
                </div>
                {v.abNote && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>A/B: {v.abNote}</div>}

                <Section title="🎣 Hook" text={v.hook} onCopy={copy} />
                <Section title="📝 תסריט מלא" text={v.fullScript} onCopy={copy} pre />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>🎞 סטוריבורד / שוטים</span>
                  <button className="mod-btn-ghost ux-btn" onClick={genScenes} disabled={scenesBusy} style={{ fontSize: 12 }}>{scenesBusy ? '⏳ מצייר סצנות…' : '🖼 צור תמונות סצנה'}</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(v.shots || []).map((s: any, i: number) => {
                    const img = sceneImages[v.id]?.[i];
                    return (
                    <div key={i} style={{ border: '1px solid var(--border,#eee)', borderRadius: 10, padding: '0.6rem 0.8rem', background: 'var(--surface-raised,#fafafa)', display: 'flex', gap: 10 }}>
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" style={{ width: 78, height: 138, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: BRAND, background: 'rgba(0,181,254,0.1)', borderRadius: 6, padding: '2px 7px' }}>{s.time}</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{s.shotType}</span>
                        </div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>🎤 {s.vo}</div>
                        {s.caption && <div style={{ fontSize: 12, color: '#0066FF', marginTop: 2 }}>💬 {s.caption}</div>}
                        {s.direction && <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>🎥 {s.direction}</div>}
                      </div>
                    </div>
                  ); })}
                </div>

                {v.captions?.length > 0 && (
                  <>
                    <div style={{ fontSize: 13.5, fontWeight: 800, margin: '14px 0 8px' }}>💬 כתוביות</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{v.captions.map((c: string, i: number) => <span key={i} style={{ fontSize: 12, background: 'var(--surface-raised,#f3f4f6)', borderRadius: 8, padding: '0.3rem 0.6rem' }}>{c}</span>)}</div>
                  </>
                )}

                <Section title="📣 CTA" text={v.cta} onCopy={copy} />

                {/* ── Render a real talking-avatar video (reuses the existing HeyGen integration) ── */}
                <div style={{ fontSize: 13.5, fontWeight: 800, margin: '16px 0 8px' }}>🎬 הפקת וידאו עם דמות מדברת (HeyGen)</div>
                {heygenReady === false ? (
                  <div style={{ fontSize: 12, color: '#b45309', background: 'rgba(245,158,11,0.08)', borderRadius: 10, padding: '0.7rem 0.9rem' }}>
                    HeyGen לא מחובר (חסר HEYGEN_API_KEY) — התסריט והפרומפטים מוכנים; להפקת וידאו אוטומטית הוסף מפתח HeyGen.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border,#eee)', borderRadius: 12, padding: '0.8rem 0.9rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={lbl}>דמות</label>
                        <select className="form-select ux-input" value={avatarId} onChange={(e) => setAvatarId(e.target.value)} style={{ width: '100%' }}>
                          {avatars.map((a: any) => <option key={a.avatar_id || a.id} value={a.avatar_id || a.id}>{a.avatar_name || a.name || a.avatar_id}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>קול (עברית מומלץ)</label>
                        <select className="form-select ux-input" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} style={{ width: '100%' }}>
                          {voices.map((vo: any) => <option key={vo.voice_id || vo.id} value={vo.voice_id || vo.id}>{(vo.name || vo.voice_id)}{vo.language ? ` · ${vo.language}` : ''}</option>)}
                        </select>
                      </div>
                    </div>
                    <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={renderVideo} disabled={rendering || heygenReady === null}
                      style={{ width: '100%', fontSize: 13.5, fontWeight: 800, padding: '0.7rem', opacity: rendering ? 0.6 : 1 }}>
                      {rendering ? `⏳ מפיק וידאו… (${video?.status || 'pending'})` : '🎬 הפק וידאו מהתסריט הזה'}
                    </button>
                    {video?.status === 'completed' && video.url && (
                      <div style={{ marginTop: 10 }}>
                        <video src={video.url} controls style={{ width: '100%', maxHeight: 480, borderRadius: 10, background: '#000' }} />
                        <a href={video.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: BRAND, fontWeight: 700, display: 'inline-block', marginTop: 6 }}>⬇ הורד וידאו</a>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ fontSize: 13.5, fontWeight: 800, margin: '14px 0 8px' }}>🤖 פרומפטים לכלי AI</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(v.toolPrompts || []).map((p: any, i: number) => (
                    <div key={i} style={{ border: '1px solid var(--border,#eee)', borderRadius: 10, padding: '0.6rem 0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800 }}>{p.tool} <span style={{ fontSize: 10.5, color: '#6b7280', fontWeight: 500 }}>· {p.type}</span></span>
                        <button onClick={() => copy(p.prompt)} style={{ fontSize: 11, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>העתק</button>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--foreground)', whiteSpace: 'pre-wrap', direction: p.type === 'video' ? 'ltr' : 'rtl', textAlign: p.type === 'video' ? 'left' : 'right' }}>{p.prompt}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Past projects */}
      {projects.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>פרויקטים אחרונים</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {projects.slice(0, 12).map((p) => (
              <button key={p.id} onClick={() => openProject(p.id)} style={{ textAlign: 'right', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px solid var(--border,#eee)', background: 'var(--surface-raised,#fafafa)', cursor: 'pointer' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.business_name} <span style={{ color: '#6b7280', fontWeight: 400 }}>· {p.business_type}</span></span>
                <span style={{ fontSize: 10.5, color: '#6b7280' }}>{p.status === 'generated' ? '✓ מוכן' : 'טיוטה'} · {new Date(p.created_at).toLocaleDateString('he-IL')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, text, onCopy, pre }: { title: string; text: string; onCopy: (t: string) => void; pre?: boolean }) {
  if (!text) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>{title}</span>
        <button onClick={() => onCopy(text)} style={{ fontSize: 11, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>העתק</button>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: pre ? 'pre-wrap' : 'normal', background: 'var(--surface-raised,#fafafa)', borderRadius: 10, padding: '0.7rem 0.9rem' }}>{text}</div>
    </div>
  );
}
