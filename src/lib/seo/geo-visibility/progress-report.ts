/**
 * GEO Progress Report — a premium, dark, shareable visual report of the brand's
 * AI-visibility growth over time (mentions per month, per-engine breakdown, GEO
 * score growth curve, totals + growth multiplier). Built entirely from measured
 * data already stored (monthly aggregations + mentions). Standalone HTML, RTL.
 */

import { seoPlans } from '@/lib/db';
import { getSupabase } from '@/lib/db/store';

const ENGINES = ['chatgpt', 'gemini', 'claude', 'perplexity', 'google_ai_overview'];
const ENGINE_LABEL: Record<string, string> = { chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude', perplexity: 'Perplexity', google_ai_overview: 'Google AI' };
const hebMonth = (m: string) => { const [y, mo] = (m || '').split('-'); const names = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']; return `${names[(+mo || 1) - 1]} ${y || ''}`; };

export async function buildGeoProgressReport(planId: string): Promise<{ clientName: string; html: string; hasData: boolean }> {
  const sb = getSupabase();
  const plan: any = await seoPlans.getByIdAsync(planId);
  const clientName = plan?.clientName || plan?.businessProfile?.businessName || 'הלקוח';

  const { data: aggData } = await sb.from('geo_visibility_monthly_aggregations').select('*').eq('plan_id', planId).order('month', { ascending: true }).limit(12);
  const agg = aggData || [];
  // Per-engine mentions per month (measured).
  const { data: men } = await sb.from('geo_visibility_mentions').select('ai_engine, created_at').eq('plan_id', planId).limit(5000);
  const perMonthEngine: Record<string, Record<string, number>> = {};
  for (const m of (men || [])) {
    const mk = (m.created_at || '').slice(0, 7);
    if (!mk) continue;
    (perMonthEngine[mk] ||= {})[m.ai_engine] = (perMonthEngine[mk]?.[m.ai_engine] || 0) + 1;
  }

  const hasData = agg.length > 0;
  const months = agg.slice(-6);
  const scores = months.map((m: any) => m.visibility_score || 0);
  const mentionsArr = months.map((m: any) => m.total_mentions || 0);
  const totalMentions = mentionsArr.reduce((a, b) => a + b, 0);
  const totalCitations = months.reduce((a: number, m: any) => a + (m.total_citations || 0), 0);
  const first = mentionsArr.find((n) => n > 0) || 0;
  const last = mentionsArr.length ? mentionsArr[mentionsArr.length - 1] : 0;
  const growthX = first > 0 ? (last / first) : 0;

  // Brand palette (system design language — light & premium).
  const C = { primary: '#00B5FE', primaryDark: '#0095D0', text: '#1A1A2E', sub: '#5A5A7A', muted: '#9A9AB0', bg: '#F7F9FC', card: '#FFFFFF', border: '#E8EAF0', success: '#10B981', amber: '#F59E0B' };

  // ── GEO Score growth curve (SVG area) ──
  const W = 720, H = 240, pad = 38;
  const maxS = Math.max(100, ...scores);
  const pts = scores.map((s, i) => {
    const x = pad + (scores.length === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (scores.length - 1));
    const y = H - pad - (s / maxS) * (H - 2 * pad);
    return { x, y, s, label: hebMonth(months[i].month) };
  });
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pad},${H - pad} ${line} ${pts.length ? pts[pts.length - 1].x : pad},${H - pad}`;
  const scoreSeq = scores.join(' → ');

  // ── Monthly columns with per-engine breakdown ──
  const monthCols = [...months].reverse().slice(0, 3).map((m: any) => {
    const eng = perMonthEngine[m.month] || {};
    const rows = ENGINES.filter((e) => eng[e]).sort((a, b) => (eng[b] || 0) - (eng[a] || 0));
    const maxE = Math.max(1, ...rows.map((e) => eng[e] || 0));
    const bars = rows.map((e) => `<div style="display:flex;align-items:center;gap:8px;margin:7px 0"><span style="width:74px;font-size:12px;color:${C.sub}">${ENGINE_LABEL[e] || e}</span><span style="width:34px;text-align:left;font-size:12px;color:${C.text};font-weight:800">${eng[e]}</span><div style="flex:1;height:7px;background:${C.bg};border-radius:99px;overflow:hidden"><div style="width:${((eng[e] || 0) / maxE) * 100}%;height:100%;background:linear-gradient(90deg,${C.primary},${C.primaryDark})"></div></div></div>`).join('') || `<div style="color:${C.muted};font-size:12px">אין נתונים</div>`;
    return `<div style="flex:1;min-width:200px;background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(16,24,40,0.04)">
      <div style="font-size:11px;color:${C.muted};font-weight:700">${hebMonth(m.month)}</div>
      <div style="font-size:34px;font-weight:900;color:${C.primary};margin:2px 0 10px">${(m.total_mentions || 0).toLocaleString()}</div>
      <div style="font-size:11px;color:${C.muted};margin-bottom:6px">אזכורי AI לפי מנוע</div>
      ${bars}
    </div>`;
  }).join('');

  const kpi = (val: string, label: string, color: string) => `<div style="flex:1;min-width:150px;background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:18px;text-align:center;box-shadow:0 1px 3px rgba(16,24,40,0.04)"><div style="font-size:30px;font-weight:900;color:${color}">${val}</div><div style="font-size:12px;color:${C.sub};margin-top:2px">${label}</div></div>`;

  const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>דוח צמיחת נראות AI — ${clientName}</title>
<style>@media print{.noprint{display:none}} *{box-sizing:border-box} body{margin:0;font-family:'Heebo',Arial,sans-serif;background:${C.bg};color:${C.text};padding:28px;max-width:880px;margin:0 auto}</style></head><body>
<div class="noprint" style="text-align:left;margin-bottom:14px"><button onclick="window.print()" style="background:${C.primary};color:#fff;border:none;border-radius:10px;padding:9px 18px;font-weight:800;cursor:pointer">🖨 שמור כ-PDF</button></div>
<div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px;margin-bottom:6px">
  <div><div style="font-size:12px;color:${C.primary};letter-spacing:2px;font-weight:800">GEO PROGRESS</div><h1 style="margin:2px 0;font-size:26px;color:${C.text}">דוח צמיחת נראות AI</h1></div>
  <div style="color:${C.sub};font-size:13px;font-weight:600">${clientName}</div>
</div>

${!hasData ? `<div style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:40px;text-align:center;color:${C.muted};margin-top:20px">עדיין אין נתוני ריצה. הרץ "⚡ הרץ בדיקה" ב-AI Visibility (פעמיים+ לאורך זמן) כדי לראות צמיחה.</div>` : `
<!-- Growth curve -->
<div style="background:${C.card};border:1px solid ${C.border};border-radius:18px;padding:20px;margin:14px 0;box-shadow:0 1px 3px rgba(16,24,40,0.04)">
  <div style="font-size:16px;font-weight:800;color:${C.text}">גרף צמיחת סמכות AI</div>
  <div style="font-size:12px;color:${C.primary};letter-spacing:1px;margin-bottom:8px;font-weight:700">GEO SCORE · ${scoreSeq}</div>
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.primary}" stop-opacity="0.28"/><stop offset="1" stop-color="${C.primary}" stop-opacity="0"/></linearGradient></defs>
    ${[0.25, 0.5, 0.75].map((f) => `<line x1="${pad}" y1="${pad + f * (H - 2 * pad)}" x2="${W - pad}" y2="${pad + f * (H - 2 * pad)}" stroke="${C.border}" stroke-width="1"/>`).join('')}
    <polygon points="${area}" fill="url(#g)"/>
    <polyline points="${line}" fill="none" stroke="${C.primary}" stroke-width="3" stroke-linejoin="round"/>
    ${pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${C.primary}" stroke="#fff" stroke-width="2"/><text x="${p.x}" y="${p.y - 12}" fill="${C.text}" font-size="15" font-weight="800" text-anchor="middle">${p.s}</text><text x="${p.x}" y="${H - 12}" fill="${C.muted}" font-size="11" text-anchor="middle">${p.label}</text>`).join('')}
  </svg>
</div>

<!-- KPI tiles -->
<div style="display:flex;gap:12px;flex-wrap:wrap;margin:14px 0">
  ${kpi(totalMentions.toLocaleString(), 'סה״כ אזכורי AI', C.primary)}
  ${kpi(totalCitations.toLocaleString(), 'סה״כ ציטוטים', C.primaryDark)}
  ${kpi(growthX >= 1 ? `${growthX.toFixed(1)}×` : '—', 'צמיחת אזכורים', C.success)}
  ${kpi(`${scores[scores.length - 1] || 0}`, 'GEO Score נוכחי', C.primary)}
</div>

<!-- Monthly per-engine breakdown -->
<div style="font-size:15px;font-weight:800;margin:18px 0 8px;color:${C.text}">פילוח חודשי לפי מנוע AI</div>
<div style="display:flex;gap:12px;flex-wrap:wrap">${monthCols}</div>
`}

<p style="font-size:11px;color:${C.muted};margin-top:24px;border-top:1px solid ${C.border};padding-top:10px">* נתונים מבוססים על ניטור מבוקר של שאילתות מול מנועי AI (אומדן מבוקר), לא נתון רשמי של שימוש בפועל. הופק ע"י Studio Pixel · ${new Date().toLocaleDateString('he-IL')}</p>
</body></html>`;

  return { clientName, html, hasData };
}
