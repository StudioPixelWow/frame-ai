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
  const [msg, setMsg] = useState('');
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
  const [renderStartedAt, setRenderStartedAt] = useState<number | null>(null);
  const [renderStage, setRenderStage] = useState('');
  const [, forceTick] = useState(0);
  const VIDEO_FORMATS: { id: string; label: string; w: number; h: number }[] = [
    { id: 'story', label: 'Story 9:16', w: 1080, h: 1920 },
    { id: 'feed', label: 'Feed 4:5', w: 1080, h: 1350 },
    { id: 'square', label: 'Square 1:1', w: 1080, h: 1080 },
    { id: 'wide', label: 'Wide 16:9', w: 1920, h: 1080 },
  ];
  const [videoFormat, setVideoFormat] = useState('story');
  const [assembling, setAssembling] = useState(false);
  const [assembleStage, setAssembleStage] = useState('');
  const [assembleStartedAt, setAssembleStartedAt] = useState<number | null>(null);
  const [assembled, setAssembled] = useState<string | null>(null);
  const [sceneClips, setSceneClips] = useState<Record<string, string[]>>({});
  const [clipBusyKey, setClipBusyKey] = useState('');
  const BROLL_MODELS = [{ id: 'kwaivgi/kling-v1.6-standard', label: 'Kling 1.6' }, { id: 'luma/ray', label: 'Luma Ray' }, { id: 'minimax/video-01', label: 'Hailuo (MiniMax)' }, { id: 'stability-ai/stable-video-diffusion', label: 'Stable Video' }];
  const MUSIC_OPTS = [{ id: 'none', label: 'ללא מוזיקה' }, { id: 'energetic', label: 'אנרגטי' }, { id: 'upbeat', label: 'קצבי' }, { id: 'calm', label: 'רגוע' }, { id: 'corporate', label: 'תאגידי' }];
  const TRANSITION_OPTS = [{ id: 'fade', label: 'Fade' }, { id: 'slideLeft', label: 'Slide' }, { id: 'zoom', label: 'Zoom' }, { id: 'wipeLeft', label: 'Wipe' }, { id: 'carouselLeft', label: 'Carousel' }];
  const [brollModel, setBrollModel] = useState(BROLL_MODELS[0].id);
  const [videoMusic, setVideoMusic] = useState('upbeat');
  const [videoTransition, setVideoTransition] = useState('fade');
  const [captionsOn, setCaptionsOn] = useState(true);
  const [videoLogo, setVideoLogo] = useState('');
  const [videoCta, setVideoCta] = useState('לפרטים נוספים — צרו קשר');
  const [pipOn, setPipOn] = useState(true);
  const [hookOn, setHookOn] = useState(true);
  const [sceneImages, setSceneImages] = useState<Record<string, string[]>>({}); // variationId → [dataURL per shot]
  const [scenesBusy, setScenesBusy] = useState(false);
  const [presenterApproved, setPresenterApproved] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]); // scraped product images (visual reference)
  const [scenePrompt, setScenePrompt] = useState<Record<string, string>>({}); // `${vid}:${i}` → edited prompt
  const [sceneBusyKey, setSceneBusyKey] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const [av, vo] = await Promise.all([
          fetch('/api/data/heygen/avatars').then((r) => r.ok ? r.json() : []),
          fetch('/api/data/heygen/voices').then((r) => r.ok ? r.json() : []),
        ]);
        const avList = Array.isArray(av) ? av : [];
        const voListAll = Array.isArray(vo) ? vo : [];
        // Hebrew voices only (fall back to all if HeyGen returns none flagged Hebrew).
        const heVoices = voListAll.filter((v: any) => /hebrew|עברית|\bhe\b|he-il|iw/i.test(`${v.language || ''} ${v.locale || ''} ${v.name || ''}`));
        const voList = heVoices.length ? heVoices : voListAll;
        setAvatars(avList); setVoices(voList);
        setHeygenReady(avList.length > 0);
        if (voList[0]) setVoiceId(voList[0].voice_id || voList[0].id || '');
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
      setProductImages(Array.isArray(j.images) ? j.images : []);
      setMsg(`✓ נשאבו פרטי המוצר מהקישור${j.images?.length ? ` (${j.images.length} תמונות)` : ''}.`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה בשאיבה'); }
    finally { setScraping(false); }
  };

  // Selected avatar preview image (so the storyboard presenter matches the avatar).
  const avatarImageUrl = (() => {
    const a = avatars.find((x: any) => (x.avatar_id || x.id) === avatarId);
    return a?.preview_image_url || a?.preview_image || a?.image_url || '';
  })();

  // Generate one scene image for a shot — uses the chosen avatar likeness + product.
  const genOneScene = async (v: any, i: number) => {
    const s = v.shots[i]; if (!s) return;
    if (heygenReady !== false && !presenterApproved) { setErr('בחר ואשר דמות וקול (שלב 2) לפני יצירת תמונות הסטוריבורד'); return; }
    const key = `${v.id}:${i}`;
    setSceneBusyKey(key); setErr('');
    try {
      const r = await fetch('/api/ugc/scene-image', { method: 'POST', headers: H(), body: JSON.stringify({
        prompt: scenePrompt[key]?.trim() || undefined,
        shotType: s.shotType, vo: s.vo, direction: s.direction,
        businessName: form.businessName, businessType: form.businessType, style: form.style,
        productName: form.businessName, productImageUrl: productImages[0] || undefined,
        avatarImageUrl: avatarImageUrl || undefined,
      }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'שגיאה');
      setSceneImages((m) => { const arr = [...(m[v.id] || [])]; arr[i] = j.image; return { ...m, [v.id]: arr }; });
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה ביצירת תמונה'); }
    finally { setSceneBusyKey(''); }
  };

  const genScenes = async () => {
    const v = pkg?.variations[active];
    if (!v?.shots?.length) return;
    setScenesBusy(true); setErr('');
    try {
      for (let i = 0; i < v.shots.length; i++) {
        await genOneScene(v, i);
      }
    } finally { setScenesBusy(false); }
  };

  // Tick every second while rendering/assembling so timers + progress bars update live.
  useEffect(() => {
    if (!rendering && !assembling) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [rendering, assembling]);

  // Generate a real B-roll VIDEO clip for one shot (image → motion via Replicate).
  const genClip = async (v: any, i: number) => {
    const img = sceneImages[v.id]?.[i];
    if (!img) { setErr('צור קודם תמונת סטוריבורד לשוט הזה'); return; }
    const key = `${v.id}:${i}`;
    setClipBusyKey(key); setErr('');
    try {
      const prompt = scenePrompt[key]?.trim() || v.shots?.[i]?.direction || v.shots?.[i]?.vo || '';
      const r = await fetch('/api/ugc/broll', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-role': 'admin' }, body: JSON.stringify({ image: img, prompt, model: brollModel }) });
      const j = await r.json();
      if (!r.ok || !j.predictionId) throw new Error(j.error || 'יצירת הקליפ נכשלה');
      for (let k = 0; k < 60; k++) {
        await new Promise((res) => setTimeout(res, 4000));
        const st = await fetch(`/api/ugc/broll/status?id=${j.predictionId}`, { headers: { 'x-app-role': 'admin' } }).then((x) => x.json());
        if (st.status === 'succeeded' && st.url) { setSceneClips((m) => { const arr = [...(m[v.id] || [])]; arr[i] = st.url; return { ...m, [v.id]: arr }; }); break; }
        if (st.status === 'failed' || st.status === 'canceled') throw new Error(st.error || 'יצירת הקליפ נכשלה');
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה ביצירת קליפ'); }
    finally { setClipBusyKey(''); }
  };

  // Assemble the FULL clip (avatar speech + Ken-Burns B-roll) via Shotstack.
  const assembleVideo = async () => {
    const v = pkg?.variations[active];
    if (!v || !video?.url) { setErr('הפק קודם וידאו דמות (HeyGen)'); return; }
    const imgs = (sceneImages[v.id] || []).filter(Boolean);
    const fmt = VIDEO_FORMATS.find((f) => f.id === videoFormat) || VIDEO_FORMATS[0];
    setAssembling(true); setAssembled(null); setErr(''); setAssembleStartedAt(Date.now()); setAssembleStage('מעלה תמונות B‑roll…');
    try {
      const clips = (sceneClips[v.id] || []).filter(Boolean);
      const r = await fetch('/api/ugc/assemble', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-role': 'admin' }, body: JSON.stringify({ avatarUrl: video.url, images: imgs, brollVideos: clips, durationSec: form.duration, format: { width: fmt.w, height: fmt.h }, businessName: form.businessName, brandColor: '#00B5FE', music: videoMusic, transition: videoTransition, script: v.fullScript, captionsOn, logoUrl: videoLogo.trim() || undefined, ctaText: videoCta, pip: pipOn, hookOn }) });
      const j = await r.json();
      if (!r.ok || !j.renderId) throw new Error(j.error || 'הרכבת הווידאו נכשלה');
      setAssembleStage('בתור עיבוד…');
      for (let i = 0; i < 90; i++) {
        await new Promise((res) => setTimeout(res, 4000));
        const st = await fetch(`/api/ugc/assemble/status?id=${j.renderId}`, { headers: { 'x-app-role': 'admin' } }).then((x) => x.json());
        if (st.stage) setAssembleStage(st.stage);
        if (st.status === 'done' && st.url) {
          setAssembled(st.url);
          if (clientId) { try { await fetch('/api/data/client-files', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-role': 'admin' }, body: JSON.stringify({ clientId, fileName: `UGC סרטון מלא · ${form.businessName || ''} · ${new Date().toLocaleDateString('he-IL')}`, fileUrl: st.url, fileType: 'video', category: 'social_media', fileSize: 0, uploadedBy: null, notes: 'סרטון מורכב (דמות + B-roll) ממחולל UGC' }) }); setMsg('✓ הסרטון המלא נשמר אוטומטית לקבצי הלקוח.'); } catch {} }
          break;
        }
        if (st.status === 'failed') throw new Error(st.error || 'ההרכבה נכשלה');
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה בהרכבה'); }
    finally { setAssembling(false); }
  };

  const renderVideo = async () => {
    const v = pkg?.variations[active];
    if (!v) return;
    if (!avatarId || !voiceId) { setErr('בחר דמות וקול'); return; }
    setRendering(true); setVideo({ status: 'pending' }); setErr('');
    setRenderStartedAt(Date.now()); setRenderStage('שולח תסריט ל‑HeyGen…');
    try {
      const fmt = VIDEO_FORMATS.find((f) => f.id === videoFormat) || VIDEO_FORMATS[0];
      const gen = await fetch('/api/data/heygen/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatarId, voiceId, script: v.fullScript, dimension: { width: fmt.w, height: fmt.h } }) });
      const gj = await gen.json();
      if (!gen.ok || !gj.videoId) throw new Error(gj.error || 'יצירת הווידאו נכשלה');
      const videoId = gj.videoId;
      setRenderStage('הווידאו בתור עיבוד אצל HeyGen…');
      // Poll status (up to ~5 min).
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const st = await fetch(`/api/data/heygen/status?videoId=${videoId}`).then((r) => r.json());
        if (st.status === 'processing' || st.status === 'pending' || st.status === 'waiting') setRenderStage('מעבד את הווידאו (רינדור הדמות + הקול)…');
        if (st.status === 'completed' && st.videoUrl) {
          setRenderStage('כמעט מוכן — שומר…');
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
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: 'var(--foreground)' }}>🎬 UGC Business Video Generator</h1>
      <p style={{ color: 'var(--foreground-muted,#6b7280)', fontSize: 14, marginBottom: 18 }}>חבילת הפקה מלאה לסרטון UGC עסקי 9:16 — מקישור מוצר או מהלקוח ועד וידאו אמיתי עם דמות מדברת.</p>

      {/* Process stepper — always shows where you are and what's next (no surprises) */}
      {(() => {
        const steps = ['דמות + קול', 'בריף', 'תסריט (3 וריאציות)', 'סטוריבורד + תמונות', 'וידאו מוכן'];
        const cur = video?.status === 'completed' ? 4
          : (sceneImages[pkg?.variations[active]?.id || ''] || []).some(Boolean) ? 3
          : pkg ? 2
          : presenterApproved ? 1
          : 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 22, flexWrap: 'wrap' }}>
            {steps.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: i < cur ? '#22c55e' : i === cur ? BRAND : 'var(--surface-raised,#eef)', color: i <= cur ? '#fff' : 'var(--foreground-muted,#999)', border: i <= cur ? 'none' : '1px solid var(--border,#e5e7eb)' }}>{i < cur ? '✓' : i + 1}</span>
                  <span style={{ fontSize: 12.5, fontWeight: i === cur ? 800 : 600, color: i === cur ? BRAND : 'var(--foreground-muted,#888)' }}>{s}</span>
                </div>
                {i < steps.length - 1 && <span style={{ width: 28, height: 2, background: i < cur ? '#22c55e' : 'var(--border,#e5e7eb)', margin: '0 8px' }} />}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Step 1: Presenter (avatar + voice) — chosen FIRST so everything downstream
            (storyboard images + the final talking-avatar video) is built around it ── */}
      {heygenReady !== false && (
        <div style={{ ...card, border: presenterApproved ? '2px solid #22c55e' : `1px solid var(--border,#e5e7eb)` }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🧑‍🎤 שלב 1 · בחירת דמות וקול</div>
          <div style={{ fontSize: 12, color: 'var(--foreground-muted,#6b7280)', marginBottom: 12 }}>בחר קודם את הפרזנטור והקול (עברית), שמע ותראה תצוגה מקדימה, ואשר. הווידאו הסופי יופק עם הדמות הזו — ותמונות הסטוריבורד יישענו עליה.</div>
          {(() => {
            const av = avatars.find((a: any) => (a.avatar_id || a.id) === avatarId);
            const avImg = av?.preview_image_url || av?.preview_image || av?.image_url;
            const avVid = av?.preview_video_url || av?.preview_video;
            const vo = voices.find((x: any) => (x.voice_id || x.id) === voiceId);
            const sample = vo?.preview_audio || vo?.sample || vo?.preview_url;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
                <div>
                  <label style={lbl}>דמות — לחץ על תמונה לבחירה</label>
                  {/* Visual gallery: every avatar shows its photo so you choose by look, not by name */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto', padding: 4, border: '1px solid var(--border,#eee)', borderRadius: 10, background: 'var(--surface-raised,#fafafa)' }}>
                    {avatars.length === 0 && <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: '#999', textAlign: 'center', padding: 12 }}>טוען דמויות…</div>}
                    {avatars.map((a: any) => {
                      const id = a.avatar_id || a.id;
                      const img = a.preview_image_url || a.preview_image || a.image_url;
                      const sel = id === avatarId;
                      return (
                        <button key={id} type="button" onClick={() => { setAvatarId(id); setPresenterApproved(false); }} title={a.avatar_name || a.name || id}
                          style={{ padding: 0, border: `2px solid ${sel ? BRAND : 'transparent'}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: '#fff', boxShadow: sel ? `0 0 0 2px ${BRAND}40` : 'none' }}>
                          <div style={{ aspectRatio: '3/4', background: '#eef2f6' }}>
                            {img
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={img} alt={a.avatar_name || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, color: '#999' }}>אין תמונה</div>}
                          </div>
                          <div style={{ fontSize: 9.5, fontWeight: sel ? 800 : 600, color: sel ? BRAND : 'var(--foreground-muted,#6b7280)', padding: '3px 2px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(a.avatar_name || a.name || id)}</div>
                        </button>
                      );
                    })}
                  </div>
                  {/* Live preview of the chosen avatar (video if available) */}
                  {(avVid || avImg) && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ borderRadius: 10, overflow: 'hidden', border: `2px solid ${BRAND}`, aspectRatio: '3/4', width: 88, flexShrink: 0 }}>
                        {avVid ? <video src={avVid} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : /* eslint-disable-next-line @next/next/no-img-element */ <img src={avImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--foreground)' }}>נבחר: <b>{avatars.find((a: any) => (a.avatar_id || a.id) === avatarId)?.avatar_name || '—'}</b><div style={{ fontSize: 10.5, color: 'var(--foreground-muted,#6b7280)' }}>זו הדמות שתופיע בווידאו</div></div>
                    </div>
                  )}
                </div>
                <div>
                  <label style={lbl}>קול (עברית בלבד)</label>
                  <select className="form-select ux-input" value={voiceId} onChange={(e) => { setVoiceId(e.target.value); setPresenterApproved(false); }} style={{ width: '100%' }}>
                    {voices.map((x: any) => <option key={x.voice_id || x.id} value={x.voice_id || x.id}>{(x.name || x.voice_id)}{x.gender ? ` · ${x.gender}` : ''}</option>)}
                  </select>
                  <button type="button" onClick={() => { if (sample) { try { new Audio(sample).play(); } catch {} } }} disabled={!sample}
                    style={{ marginTop: 8, width: '100%', padding: '0.5rem', borderRadius: 8, border: `1px solid ${sample ? BRAND : 'var(--border,#e5e7eb)'}`, background: sample ? 'rgba(0,181,254,0.08)' : 'transparent', color: sample ? BRAND : '#999', fontWeight: 700, fontSize: 12.5, cursor: sample ? 'pointer' : 'default' }}>
                    {sample ? '▶ השמע דוגמת קול' : 'אין דוגמת קול'}
                  </button>
                  {voices.length === 0 && <div style={{ fontSize: 11, color: '#b45309', marginTop: 6 }}>לא נמצאו קולות בעברית בחשבון HeyGen.</div>}
                </div>
              </div>
            );
          })()}
          <button onClick={() => setPresenterApproved(true)} disabled={!avatarId || !voiceId}
            style={{ marginTop: 14, width: '100%', padding: '0.7rem', borderRadius: 10, border: 'none', background: presenterApproved ? '#22c55e' : BRAND, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: (!avatarId || !voiceId) ? 0.5 : 1 }}>
            {presenterApproved ? '✓ הדמות אושרה — אפשר להמשיך לבריף ולסטוריבורד' : '✓ אשר דמות והמשך'}
          </button>
        </div>
      )}

      {/* Brief */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>שלב 2 · בריף קצר</div>
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
        {msg && <div style={{ color: '#16a34a', fontSize: 13, marginTop: 10, fontWeight: 600 }}>{msg}</div>}
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 4px' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>🎞 סטוריבורד / שוטים</span>
                  <button className="mod-btn-ghost ux-btn" onClick={genScenes} disabled={scenesBusy} style={{ fontSize: 12 }}>{scenesBusy ? '⏳ מצייר סצנות…' : '🖼 צור את כל התמונות'}</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--foreground-muted,#6b7280)', marginBottom: 8 }}>
                  {avatarImageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={avatarImageUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    : null}
                  התמונות נוצרות לפי הדמות שנבחרה{avatarImageUrl ? '' : ' (בחר דמות בשלב 1)'} {productImages[0] ? '+ המוצר מהקישור' : ''}. ניתן לערוך את התיאור לכל תמונה לפני יצירה.
                </div>
                <div style={{ fontSize: 11, color: '#b45309', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '0.5rem 0.7rem', marginBottom: 10, lineHeight: 1.6 }}>
                  ℹ️ הסטוריבורד הוא <b>תכנון/המחשה</b> — תמונת קונספט לכל שוט (לתסריט וכ‑B‑roll אופציונלי). <b>הווידאו הסופי מופק ע"י HeyGen עם הדמות שבחרת ולכן עקבי לאורך כל הסרטון.</b> תמונות הקונספט נוצרות בנפרד לכל שוט (עם הדמות+המוצר כרפרנס) ולכן ייתכן הבדל קל ביניהן — זה לא משפיע על אחידות הווידאו עצמו.
                </div>
                {err && (
                  <div style={{ fontSize: 12.5, color: '#dc2626', fontWeight: 700, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, padding: '0.6rem 0.8rem', marginBottom: 10 }}>
                    ⚠ {err}
                  </div>
                )}
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
                        {/* Editable image prompt — tweak before generating */}
                        <textarea
                          value={scenePrompt[`${v.id}:${i}`] ?? (s.direction || s.vo || '')}
                          onChange={(e) => setScenePrompt((m) => ({ ...m, [`${v.id}:${i}`]: e.target.value }))}
                          rows={2}
                          placeholder="תיאור התמונה ל-AI (ניתן לערוך)…"
                          style={{ width: '100%', marginTop: 6, fontSize: 11.5, lineHeight: 1.5, borderRadius: 8, border: '1px solid var(--border,#e5e7eb)', background: 'var(--surface,#fff)', color: 'var(--foreground)', padding: '0.4rem 0.5rem', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 5 }}>
                          <button onClick={() => genOneScene(v, i)} disabled={sceneBusyKey === `${v.id}:${i}`}
                            style={{ fontSize: 11.5, fontWeight: 700, color: BRAND, background: 'rgba(0,181,254,0.08)', border: `1px solid ${BRAND}`, borderRadius: 8, padding: '0.3rem 0.7rem', cursor: 'pointer' }}>
                            {sceneBusyKey === `${v.id}:${i}` ? '⏳ יוצר…' : img ? '🔄 צור מחדש' : '🖼 צור תמונה'}
                          </button>
                          {img && (
                            <button onClick={() => genClip(v, i)} disabled={clipBusyKey === `${v.id}:${i}`}
                              style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', background: 'rgba(124,58,237,0.08)', border: '1px solid #7c3aed', borderRadius: 8, padding: '0.3rem 0.7rem', cursor: 'pointer' }}>
                              {clipBusyKey === `${v.id}:${i}` ? '⏳ מייצר קליפ…' : sceneClips[v.id]?.[i] ? '🎥 קליפ מוכן · צור שוב' : '🎥 הפוך לקליפ וידאו'}
                            </button>
                          )}
                          {sceneClips[v.id]?.[i] && <span style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 700 }}>✓ B-roll וידאו</span>}
                        </div>
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
                    {(() => {
                      const av = avatars.find((a: any) => (a.avatar_id || a.id) === avatarId);
                      const avImg = av?.preview_image_url || av?.preview_image || av?.image_url;
                      const vo = voices.find((x: any) => (x.voice_id || x.id) === voiceId);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          {avImg && /* eslint-disable-next-line @next/next/no-img-element */ <img src={avImg} alt="" style={{ width: 40, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border,#eee)' }} />}
                          <div style={{ fontSize: 12.5, color: 'var(--foreground-muted,#6b7280)' }}>
                            דמות: <b style={{ color: 'var(--foreground)' }}>{av?.avatar_name || av?.name || '—'}</b> · קול: <b style={{ color: 'var(--foreground)' }}>{vo?.name || '—'}</b>
                            <div style={{ fontSize: 11, marginTop: 2 }}>לשינוי — חזור לשלב 2 (דמות + קול) למעלה.</div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Video format selector — choose the output aspect (was locked to 9:16). */}
                    {!rendering && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={lbl}>פורמט וידאו</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {VIDEO_FORMATS.map((f) => (
                            <button key={f.id} type="button" onClick={() => setVideoFormat(f.id)}
                              style={{ padding: '0.4rem 0.8rem', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${videoFormat === f.id ? BRAND : 'var(--border,#e5e7eb)'}`, background: videoFormat === f.id ? 'rgba(0,181,254,0.1)' : 'transparent', color: videoFormat === f.id ? BRAND : 'var(--foreground)' }}>
                              {f.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--foreground-muted,#6b7280)', marginTop: 6, lineHeight: 1.6 }}>
                          💡 HeyGen מפיק את <b>שוט הדמות המדברת</b> בפורמט שתבחר. ל‑<b>B‑roll, תנועתיות ופריימים שונים כמו בסטוריבורד</b> — השתמש בפרומפטים לכלי הווידאו (Sora/Runway/Kling/Veo) שמופיעים למטה, וערוך יחד עם שוט הדמות בעורך. בחר פורמט שתואם למסגרת הדמות כדי שלא יופיעו פסים.
                        </div>
                      </div>
                    )}
                    {rendering ? (() => {
                      const elapsed = renderStartedAt ? Math.floor((Date.now() - renderStartedAt) / 1000) : 0;
                      const EST = 120; // typical HeyGen render ~2 min
                      const pct = Math.min(96, Math.round(6 + (elapsed / EST) * 90));
                      const mm = String(Math.floor(elapsed / 60)).padStart(1, '0'); const ss = String(elapsed % 60).padStart(2, '0');
                      const remain = Math.max(0, EST - elapsed);
                      return (
                        <div style={{ border: `1px solid ${BRAND}40`, background: 'rgba(0,181,254,0.06)', borderRadius: 12, padding: '0.9rem 1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800, color: BRAND }}>🎬 מפיק את הווידאו…</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground-muted,#6b7280)' }}>{mm}:{ss}</span>
                          </div>
                          <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-raised,#eef2f6)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${BRAND}, #7c5cff)`, borderRadius: 999, transition: 'width 0.8s ease' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
                            <span style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 600 }}>{renderStage || 'מתחיל…'}</span>
                            <span style={{ fontSize: 11.5, color: 'var(--foreground-muted,#9aa0ad)' }}>{pct}% · נותרו ~{remain}s</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--foreground-muted,#9aa0ad)', marginTop: 6 }}>זמן הרינדור תלוי ב‑HeyGen (בד״כ 1–3 דקות). אפשר להישאר במסך — נעדכן אוטומטית כשהווידאו מוכן.</div>
                        </div>
                      );
                    })() : (
                      <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={renderVideo} disabled={heygenReady === null || !presenterApproved}
                        style={{ width: '100%', fontSize: 13.5, fontWeight: 800, padding: '0.7rem' }}>
                        🎬 הפק וידאו מהתסריט הזה
                      </button>
                    )}
                    {video?.status === 'completed' && video.url && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground-muted,#6b7280)', marginBottom: 4 }}>🗣 שוט דמות (HeyGen)</div>
                        <video src={video.url} controls style={{ width: '100%', maxHeight: 420, borderRadius: 10, background: '#000' }} />
                        <a href={video.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: BRAND, fontWeight: 700, display: 'inline-block', marginTop: 6 }}>⬇ הורד שוט דמות</a>

                        {/* ── Full assembly: avatar + storyboard B-roll → one finished clip ── */}
                        <div style={{ marginTop: 14, borderTop: '1px dashed var(--border,#e5e7eb)', paddingTop: 12 }}>
                          {assembling ? (() => {
                            const el = assembleStartedAt ? Math.floor((Date.now() - assembleStartedAt) / 1000) : 0;
                            const EST = 90; const pct = Math.min(96, Math.round(6 + (el / EST) * 90));
                            const mm = Math.floor(el / 60); const ss = String(el % 60).padStart(2, '0');
                            return (
                              <div style={{ border: `1px solid ${BRAND}40`, background: 'rgba(0,181,254,0.06)', borderRadius: 12, padding: '0.9rem 1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 13.5, fontWeight: 800, color: BRAND }}>🎬 מרכיב סרטון מלא…</span><span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--foreground-muted,#6b7280)' }}>{mm}:{ss}</span></div>
                                <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-raised,#eef2f6)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${BRAND}, #7c5cff)`, transition: 'width 0.8s ease' }} /></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}><span style={{ fontSize: 12, fontWeight: 600 }}>{assembleStage || 'מתחיל…'}</span><span style={{ fontSize: 11.5, color: 'var(--foreground-muted,#9aa0ad)' }}>{pct}%</span></div>
                              </div>
                            );
                          })() : assembled ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#16a34a', marginBottom: 4 }}>✅ סרטון מלא (דמות + B‑roll + קול)</div>
                              <video src={assembled} controls style={{ width: '100%', maxHeight: 480, borderRadius: 10, background: '#000' }} />
                              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                                <a href={assembled} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: BRAND, fontWeight: 700 }}>⬇ הורד סרטון מלא</a>
                                <button onClick={assembleVideo} style={{ background: 'none', border: 'none', color: 'var(--foreground-muted,#6b7280)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>🔄 הרכב מחדש</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Timeline preview — see the structure before rendering */}
                              {(() => {
                                const T = Number(form.duration) || 30;
                                const OPEN = 4, CLIP = 3.2, GAP = 2, TAIL = 2.5;
                                const clips = (sceneClips[v.id] || []).filter(Boolean);
                                const imgs = (sceneImages[v.id] || []).filter(Boolean);
                                const useVideo = clips.length > 0;
                                const itemsN = useVideo ? clips.length : imgs.length;
                                const INTRO = form.businessName ? 2.2 : 0;
                                const OUTRO = (form.businessName || videoCta) ? 2.6 : 0;
                                const slots: { start: number; len: number }[] = [];
                                let tt = OPEN; while (itemsN && tt + CLIP <= T - TAIL) { slots.push({ start: tt, len: CLIP }); tt += CLIP + GAP; }
                                const pc = (x: number) => `${(x / T) * 100}%`;
                                return (
                                  <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--foreground-muted,#6b7280)', marginBottom: 5 }}>תצוגת Timeline ({T}s)</div>
                                    <div dir="ltr" style={{ position: 'relative', height: 34, borderRadius: 8, overflow: 'hidden', background: 'rgba(0,181,254,0.12)', border: '1px solid var(--border,#e5e7eb)' }}>
                                      {/* avatar base label */}
                                      <span style={{ position: 'absolute', left: 8, top: 9, fontSize: 10, color: BRAND, fontWeight: 700 }}>🗣 דמות</span>
                                      {INTRO > 0 && <div style={{ position: 'absolute', left: 0, width: pc(INTRO), height: '100%', background: '#00B5FE', opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 800 }}>אינטרו</div>}
                                      {slots.map((s, i) => <div key={i} title={`${useVideo ? 'B-roll וידאו' : 'B-roll תמונה'} @${s.start.toFixed(1)}s`} style={{ position: 'absolute', left: pc(s.start), width: pc(s.len), height: '100%', background: useVideo ? '#7c3aed' : '#0ea5e9', opacity: 0.9 }} />)}
                                      {OUTRO > 0 && <div style={{ position: 'absolute', left: pc(T - OUTRO), width: pc(OUTRO), height: '100%', background: '#00B5FE', opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 800 }}>אאוטרו</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10.5, color: 'var(--foreground-muted,#6b7280)', marginTop: 5 }}>
                                      <span><span style={{ display: 'inline-block', width: 9, height: 9, background: useVideo ? '#7c3aed' : '#0ea5e9', borderRadius: 2, marginInlineEnd: 3 }} />{useVideo ? `${slots.length} חיתוכי B-roll וידאו` : itemsN ? `${slots.length} חיתוכי B-roll (תמונות)` : 'אין B-roll (רק דמות)'}</span>
                                      {videoMusic !== 'none' && <span>🎵 מוזיקה</span>}
                                      {captionsOn && <span>💬 כתוביות</span>}
                                      <span>📐 {VIDEO_FORMATS.find((f) => f.id === videoFormat)?.label}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                              {/* Output options: B-roll AI model, soundtrack, transitions */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                                <div>
                                  <label style={{ ...lbl, fontSize: 10.5 }}>מודל B‑roll וידאו</label>
                                  <select className="form-select ux-input" value={brollModel} onChange={(e) => setBrollModel(e.target.value)} style={{ width: '100%', fontSize: 11.5 }}>
                                    {BROLL_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ ...lbl, fontSize: 10.5 }}>מוזיקת רקע</label>
                                  <select className="form-select ux-input" value={videoMusic} onChange={(e) => setVideoMusic(e.target.value)} style={{ width: '100%', fontSize: 11.5 }}>
                                    {MUSIC_OPTS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ ...lbl, fontSize: 10.5 }}>מעבר</label>
                                  <select className="form-select ux-input" value={videoTransition} onChange={(e) => setVideoTransition(e.target.value)} style={{ width: '100%', fontSize: 11.5 }}>
                                    {TRANSITION_OPTS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                <div><label style={{ ...lbl, fontSize: 10.5 }}>לוגו (URL — לאינטרו/אאוטרו)</label><input className="form-input ux-input" value={videoLogo} onChange={(e) => setVideoLogo(e.target.value)} placeholder="https://…/logo.png" dir="ltr" style={{ width: '100%', fontSize: 11.5 }} /></div>
                                <div><label style={{ ...lbl, fontSize: 10.5 }}>קריאה לפעולה (אאוטרו)</label><input className="form-input ux-input" value={videoCta} onChange={(e) => setVideoCta(e.target.value)} style={{ width: '100%', fontSize: 11.5 }} /></div>
                              </div>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={captionsOn} onChange={(e) => setCaptionsOn(e.target.checked)} /> 💬 כתוביות</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }} title="הדמות מדברת בפינה בזמן שה-B-roll מלא מסך"><input type="checkbox" checked={pipOn} onChange={(e) => setPipOn(e.target.checked)} /> 🧑‍🎤 פרזנטור בתוך הסצנה (PIP)</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }} title="כותרת Hook גדולה ב-3 השניות הראשונות"><input type="checkbox" checked={hookOn} onChange={(e) => setHookOn(e.target.checked)} /> 🎯 Hook פתיחה</label>
                              </div>
                              <button className="mod-btn-primary ux-btn ux-btn-glow" onClick={assembleVideo} style={{ width: '100%', fontSize: 13.5, fontWeight: 800, padding: '0.7rem' }}>
                                🎬 הרכב סרטון מלא (דמות + B‑roll + תנועה)
                              </button>
                              <div style={{ fontSize: 11, color: 'var(--foreground-muted,#6b7280)', marginTop: 6, lineHeight: 1.6 }}>
                                מחבר את שוט הדמות עם תמונות הסטוריבורד כ‑B‑roll עם תנועת מצלמה (Ken Burns), מעברים, ופס הקול של הדמות — לסרטון אחד מוכן. {(sceneImages[v.id] || []).filter(Boolean).length === 0 ? <b style={{ color: '#b45309' }}>צור קודם תמונות סטוריבורד למעלה לקבלת B‑roll.</b> : `${(sceneImages[v.id] || []).filter(Boolean).length} תמונות סטוריבורד יוטמעו.`}
                              </div>
                            </>
                          )}
                        </div>
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
