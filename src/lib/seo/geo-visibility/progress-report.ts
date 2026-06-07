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

  // ── GEO Score growth curve (SVG area) ──
  const W = 720, H = 240, pad = 36;
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
    const bars = rows.map((e) => `<div style="display:flex;align-items:center;gap:8px;margin:6px 0"><span style="width:74px;font-size:12px;color:#9fb0c3">${ENGINE_LABEL[e] || e}</span><span style="width:34px;text-align:left;font-size:12px;color:#cfe;font-weight:700">${eng[e]}</span><div style="flex:1;height:6px;background:#1b2430;border-radius:99px;overflow:hidden"><div style="width:${((eng[e] || 0) / maxE) * 100}%;height:100%;background:linear-gradient(90deg,#00e676,#00b8d4)"></div></div></div>`).join('') || '<div style="color:#5f6b7a;font-size:12px">אין נתונים</div>';
    return `<div style="flex:1;min-width:200px;background:#0f1620;border:1px solid #1e2733;border-radius:14px;padding:16px">
      <div style="font-size:11px;color:#7d8aa0">${hebMonth(m.month)}</div>
      <div style="font-size:34px;font-weight:800;color:#00e676;margin:2px 0 10px">${(m.total_mentions || 0).toLocaleString()}</div>
      <div style="font-size:11px;color:#7d8aa0;margin-bottom:6px">אזכורי AI לפי מנוע</div>
      ${bars}
    </div>`;
  }).join('');

  const kpi = (val: string, label: string, color: string) => `<div style="flex:1;min-width:150px;background:#0f1620;border:1px solid #1e2733;border-radius:14px;padding:16px;text-align:center"><div style="font-size:30px;font-weight:800;color:${color}">${val}</div><div style="font-size:12px;color:#7d8aa0;margin-top:2px">${label}</div></div>`;

  const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>דוח צמיחת נראות AI — ${clientName}</title>
<style>@media print{.noprint{display:none}} *{box-sizing:border-box} body{margin:0;font-family:'Heebo',Arial,sans-serif;background:#070b11;color:#e8eef5;padding:28px;max-width:860px;margin:0 auto}</style></head><body>
<div class="noprint" style="text-align:left;margin-bottom:14px"><button onclick="window.print()" style="background:#00e676;color:#062;border:none;border-radius:9px;padding:9px 18px;font-weight:800;cursor:pointer">🖨 שמור כ-PDF</button></div>
<div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px;margin-bottom:6px">
  <div><div style="font-size:13px;color:#00e676;letter-spacing:2px;font-weight:700">GEO PROGRESS</div><h1 style="margin:2px 0;font-size:26px">דוח צמיחת נראות AI</h1></div>
  <div style="color:#7d8aa0;font-size:13px">${clientName}</div>
</div>

${!hasData ? `<div style="background:#0f1620;border:1px solid #1e2733;border-radius:14px;padding:40px;text-align:center;color:#7d8aa0;margin-top:20px">עדיין אין נתוני ריצה. הרץ "⚡ הרץ בדיקה" ב-AI Visibility (פעמיים+ לאורך זמן) כדי לראות צמיחה.</div>` : `
<!-- Growth curve -->
<div style="background:linear-gradient(180deg,#0c121b,#0a0f17);border:1px solid #1e2733;border-radius:18px;padding:18px;margin:14px 0">
  <div style="font-size:16px;font-weight:800">גרף צמיחת סמכות AI</div>
  <div style="font-size:12px;color:#00e676;letter-spacing:1px;margin-bottom:8px">GEO SCORE · ${scoreSeq}</div>
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00e676" stop-opacity="0.45"/><stop offset="1" stop-color="#00e676" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#g)"/>
    <polyline points="${line}" fill="none" stroke="#00e676" stroke-width="3" stroke-linejoin="round"/>
    ${pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#00e676"/><text x="${p.x}" y="${p.y - 12}" fill="#e8eef5" font-size="15" font-weight="800" text-anchor="middle">${p.s}</text><text x="${p.x}" y="${H - 12}" fill="#7d8aa0" font-size="11" text-anchor="middle">${p.label}</text>`).join('')}
  </svg>
</div>

<!-- KPI tiles -->
<div style="display:flex;gap:12px;flex-wrap:wrap;margin:14px 0">
  ${kpi(totalMentions.toLocaleString(), 'סה״כ אזכורי AI', '#00e676')}
  ${kpi(totalCitations.toLocaleString(), 'סה״כ ציטוטים', '#00b8d4')}
  ${kpi(growthX >= 1 ? `${growthX.toFixed(1)}×` : '—', 'צמיחת אזכורים', '#ffd54f')}
  ${kpi(`${scores[scores.length - 1] || 0}`, 'GEO Score נוכחי', '#00e676')}
</div>

<!-- Monthly per-engine breakdown -->
<div style="font-size:15px;font-weight:800;margin:18px 0 8px">פילוח חודשי לפי מנוע AI</div>
<div style="display:flex;gap:12px;flex-wrap:wrap">${monthCols}</div>
`}

<p style="font-size:11px;color:#5f6b7a;margin-top:24px;border-top:1px solid #1e2733;padding-top:10px">* נתונים מבוססים על ניטור מבוקר של שאילתות מול מנועי AI (אומדן מבוקר), לא נתון רשמי של שימוש בפועל. הופק ע"י Studio Pixel · ${new Date().toLocaleDateString('he-IL')}</p>
</body></html>`;

  return { clientName, html, hasData };
}
