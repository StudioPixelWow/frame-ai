/**
 * Premium, branded, 2-page A4 RTL Google Ads report (HTML + inline CSS).
 * Light premium theme with glass cards, gradients and the client's brand color.
 * Print-ready (window.print → PDF). No negative language, marketing-grade.
 */

import type { AdsData } from './provider';
import type { GoogleAdsReportInsight, GoogleAdsReportRecommendation } from './db';

export interface ReportHtmlInput {
  clientName: string;
  brandColor: string;
  clientLogoUrl?: string;
  reportTypeHe: string;       // "שבועי" | "חודשי" | "מותאם"
  periodLabel: string;        // "1–7 ביוני 2026"
  data: AdsData;
  deltas: Record<string, number>;
  insights: GoogleAdsReportInsight[];
  recommendations: GoogleAdsReportRecommendation[];
  summary: string;
  closing: string;
  isDemo: boolean;
}

const money = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`;
const num = (n: number) => Math.round(n).toLocaleString('he-IL');
const deltaChip = (v: number | undefined, good: 'up' | 'down' = 'up') => {
  if (v === undefined || v === 0) return '';
  const positive = good === 'up' ? v > 0 : v < 0;
  const color = positive ? '#10B981' : '#6366F1'; // never red — neutral indigo for "opportunity"
  const arrow = v > 0 ? '▲' : '▼';
  return `<span style="font-size:11px;font-weight:800;color:${color};margin-inline-start:6px">${arrow} ${Math.abs(v)}%</span>`;
};

function trendSvg(data: AdsData, color: string): string {
  const pts = data.trend.length ? data.trend : [];
  if (pts.length < 2) return '';
  const W = 640, H = 150, pad = 24;
  const vals = pts.map((p) => p.conversions);
  const max = Math.max(1, ...vals);
  const xy = pts.map((p, i) => {
    const x = pad + (i * (W - 2 * pad)) / (pts.length - 1);
    const y = H - pad - (p.conversions / max) * (H - 2 * pad);
    return { x, y };
  });
  const line = xy.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pad},${H - pad} ${line} ${xy[xy.length - 1].x},${H - pad}`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
    <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${[0.33, 0.66].map((f) => `<line x1="${pad}" y1="${pad + f * (H - 2 * pad)}" x2="${W - pad}" y2="${pad + f * (H - 2 * pad)}" stroke="#E8EAF0" stroke-width="1"/>`).join('')}
    <polygon points="${area}" fill="url(#tg)"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${xy.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${color}" stroke="#fff" stroke-width="1.5"/>`).join('')}
  </svg>`;
}

const STUDIO_LOGO = `<div style="display:flex;align-items:center;gap:8px"><div style="width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#00B5FE,#0095D0);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15px">P</div><div style="font-weight:900;font-size:15px;color:#1A1A2E">Studio Pixel</div></div>`;

export function buildReportHtml(input: ReportHtmlInput): string {
  const { clientName, brandColor, clientLogoUrl, reportTypeHe, periodLabel, data, deltas, insights, recommendations, summary, closing, isDemo } = input;
  const c = data.current;
  const brand = brandColor || '#00B5FE';
  const topCampaign = [...data.campaigns].sort((a, b) => b.conversions - a.conversions)[0];

  const kpis: { label: string; value: string; delta?: number; good?: 'up' | 'down' }[] = [
    { label: 'חשיפות', value: num(c.impressions), delta: deltas.impressions },
    { label: 'קליקים', value: num(c.clicks), delta: deltas.clicks },
    { label: 'CTR', value: `${c.ctr}%`, delta: deltas.ctr },
    { label: 'עלות לקליק', value: money(c.avgCpc), delta: deltas.cost, good: 'down' },
    { label: 'לידים / המרות', value: num(c.conversions), delta: deltas.conversions },
    { label: 'עלות לליד', value: money(c.costPerConv), delta: deltas.costPerConv, good: 'down' },
    { label: 'אחוז המרה', value: `${c.convRate}%`, delta: deltas.convRate },
    { label: 'תקציב שנוצל', value: money(c.cost) },
  ];

  const ACTION_ICON: Record<string, string> = { strengthen: '🚀', expand: '📈', refine: '🎯', creative: '🎨', landing: '🧭' };

  const kpiCards = kpis.map((k) => `
    <div class="kpi">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}${deltaChip(k.delta, k.good || 'up')}</div>
    </div>`).join('');

  const insightCards = insights.map((i) => `
    <div class="insight">
      <div class="insight-dot"></div>
      <div><div class="insight-title">${i.title}${i.metricValue ? `<span class="badge">${i.metricValue}</span>` : ''}</div>
      <div class="insight-desc">${i.description}</div></div>
    </div>`).join('');

  const recCards = recommendations.map((r) => `
    <div class="rec">
      <div class="rec-ico">${ACTION_ICON[r.actionType] || '✨'}</div>
      <div><div class="rec-title">${r.title}</div><div class="rec-desc">${r.description}</div></div>
    </div>`).join('');

  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>דוח Google Ads — ${clientName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--brand:${brand};--ink:#1A1A2E;--sub:#5A5A7A;--muted:#9A9AB0;--bg:#F4F7FB;--card:#FFFFFF;--border:#E8EAF0}
  body{font-family:'Heebo',Arial,sans-serif;background:var(--bg);color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:794px;min-height:1123px;margin:0 auto 20px;background:var(--bg);padding:34px 38px;position:relative}
  .noprint{position:fixed;top:14px;left:14px;z-index:99}
  .pbtn{background:var(--brand);color:#fff;border:none;border-radius:10px;padding:9px 16px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(0,0,0,.15)}
  /* header */
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--border);padding-bottom:16px;margin-bottom:18px}
  .hdr .logos{display:flex;align-items:center;gap:14px}
  .hdr .clogo{height:34px;max-width:120px;object-fit:contain}
  .eyebrow{font-size:11px;letter-spacing:2px;font-weight:800;color:var(--brand)}
  h1{font-size:25px;font-weight:900;margin-top:2px}
  .meta{text-align:left;font-size:12.5px;color:var(--sub);font-weight:600;line-height:1.7}
  .pill{display:inline-block;background:linear-gradient(135deg,var(--brand),color-mix(in srgb,var(--brand) 65%,#000));color:#fff;border-radius:99px;padding:3px 12px;font-size:11px;font-weight:800}
  .demo{background:#EFF8FF;border:1px solid #B9E3FF;border-radius:10px;padding:8px 12px;font-size:11.5px;color:#0077B6;font-weight:600;margin-bottom:14px}
  /* kpi */
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
  .kpi{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px 16px;box-shadow:0 2px 10px rgba(16,24,40,.04)}
  .kpi-label{font-size:11.5px;color:var(--sub);font-weight:600;margin-bottom:4px}
  .kpi-value{font-size:23px;font-weight:900;color:var(--ink);display:flex;align-items:baseline}
  /* sections */
  .card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:18px 20px;box-shadow:0 2px 10px rgba(16,24,40,.04);margin-bottom:16px}
  .sec-title{font-size:15px;font-weight:900;margin-bottom:10px;display:flex;align-items:center;gap:8px}
  .sec-title::before{content:'';width:5px;height:18px;border-radius:3px;background:var(--brand)}
  .summary{font-size:14px;line-height:1.85;color:var(--ink)}
  .top-strip{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  .chip{background:color-mix(in srgb,var(--brand) 10%,#fff);border:1px solid color-mix(in srgb,var(--brand) 30%,#fff);border-radius:10px;padding:6px 12px;font-size:12px;font-weight:700;color:color-mix(in srgb,var(--brand) 75%,#000)}
  .insight{display:flex;gap:10px;padding:9px 0;border-bottom:1px dashed var(--border)}
  .insight:last-child{border-bottom:none}
  .insight-dot{width:9px;height:9px;border-radius:99px;background:var(--brand);margin-top:6px;flex:0 0 auto}
  .insight-title{font-size:13.5px;font-weight:800}
  .badge{background:#10B98115;color:#059669;border-radius:6px;font-size:10.5px;font-weight:800;padding:1px 7px;margin-inline-start:8px}
  .insight-desc{font-size:12.5px;color:var(--sub);line-height:1.6;margin-top:2px}
  .rec{display:flex;gap:11px;padding:9px 0;border-bottom:1px dashed var(--border)}
  .rec:last-child{border-bottom:none}
  .rec-ico{font-size:20px;flex:0 0 auto}
  .rec-title{font-size:13.5px;font-weight:800}
  .rec-desc{font-size:12.5px;color:var(--sub);line-height:1.6;margin-top:2px}
  .closing{background:linear-gradient(135deg,var(--brand),color-mix(in srgb,var(--brand) 60%,#000));color:#fff;border-radius:18px;padding:20px 24px;font-size:15px;font-weight:700;line-height:1.7;text-align:center}
  .foot{margin-top:14px;font-size:10.5px;color:var(--muted);text-align:center;border-top:1px solid var(--border);padding-top:10px}
  @media print{.noprint{display:none}.page{margin:0;box-shadow:none}@page{size:A4;margin:0}}
</style></head><body>
<div class="noprint"><button class="pbtn" onclick="window.print()">🖨 שמור כ-PDF</button></div>

<!-- ───────── PAGE 1 ───────── -->
<div class="page">
  <div class="hdr">
    <div class="logos">
      ${STUDIO_LOGO}
      ${clientLogoUrl ? `<img class="clogo" src="${clientLogoUrl}" alt="${clientName}"/>` : `<div style="font-weight:800;font-size:15px;color:var(--ink);border-inline-start:1px solid var(--border);padding-inline-start:14px">${clientName}</div>`}
    </div>
    <div class="meta">
      <div class="eyebrow">GOOGLE ADS</div>
      <h1>דוח ביצועי Google Ads</h1>
      <div style="margin-top:6px"><span class="pill">דוח ${reportTypeHe}</span></div>
      <div style="margin-top:6px">${clientName} · ${periodLabel}</div>
    </div>
  </div>

  ${isDemo ? `<div class="demo">ℹ️ נתוני דוגמה להמחשה — הדוח יתמלא בנתוני אמת לאחר חיבור חשבון ה-Google Ads של הלקוח.</div>` : ''}

  <div class="kpis">${kpiCards}</div>

  <div class="card">
    <div class="sec-title">תקציר מנהלים</div>
    <div class="summary">${summary}</div>
    <div class="top-strip">
      ${topCampaign ? `<span class="chip">קמפיין מוביל · ${topCampaign.name}</span>` : ''}
      ${data.devices[0] ? `<span class="chip">מכשיר מוביל · ${[...data.devices].sort((a,b)=>b.conversions-a.conversions)[0].label}</span>` : ''}
      ${data.locations[0] ? `<span class="chip">אזור מוביל · ${[...data.locations].sort((a,b)=>b.conversions-a.conversions)[0].label}</span>` : ''}
      ${data.optimizationScore != null ? `<span class="chip">Optimization Score · ${data.optimizationScore}/100</span>` : ''}
    </div>
  </div>

  <div class="card">
    <div class="sec-title">מגמת המרות לאורך התקופה</div>
    ${trendSvg(data, brand) || '<div style="color:var(--muted);font-size:12px">מגמה תוצג לאחר צבירת נתונים</div>'}
  </div>

  <div class="foot">עמוד 1 מתוך 2 · הופק על ידי Studio Pixel · ${new Date().toLocaleDateString('he-IL')}</div>
</div>

<!-- ───────── PAGE 2 ───────── -->
<div class="page">
  <div class="card">
    <div class="sec-title">תובנות מרכזיות</div>
    ${insightCards || '<div style="color:var(--muted);font-size:12px">—</div>'}
  </div>

  <div class="card">
    <div class="sec-title">מסקנות והמלצות להמשך</div>
    ${recCards}
  </div>

  <div class="closing">${closing}</div>

  <div class="foot">עמוד 2 מתוך 2 · ${clientName} · דוח ${reportTypeHe} · ${periodLabel} · Studio Pixel</div>
</div>
</body></html>`;
}
