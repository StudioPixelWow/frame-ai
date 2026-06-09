/**
 * Premium, branded, "wow" Google Ads report (HTML + inline CSS), RTL.
 * Light premium system look (brand #00B5FE), big hero numbers, rich charts
 * (trend, campaigns, devices, regions), large readable explanations.
 * Print-ready (window.print → PDF), ~2-3 A4 pages.
 */

import type { AdsData } from './provider';
import type { GoogleAdsReportInsight, GoogleAdsReportRecommendation } from './db';

export interface ReportHtmlInput {
  clientName: string;
  brandColor: string;
  clientLogoUrl?: string;
  reportTypeHe: string;
  periodLabel: string;
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
  if (v === undefined || v === 0 || Number.isNaN(v)) return '';
  const positive = good === 'up' ? v > 0 : v < 0;
  const color = positive ? '#10B981' : '#6366F1';
  const bg = positive ? 'rgba(16,185,129,.12)' : 'rgba(99,102,241,.12)';
  const arrow = v > 0 ? '▲' : '▼';
  return `<span style="font-size:11px;font-weight:800;color:${color};background:${bg};border-radius:6px;padding:1px 6px;margin-inline-start:6px;white-space:nowrap">${arrow} ${Math.abs(v)}%</span>`;
};

/* ── charts ─────────────────────────────────────────────────────────────── */
function trendSvg(data: AdsData, color: string): string {
  const pts = data.trend || [];
  if (pts.length < 2) return '';
  const W = 660, H = 170, pad = 26;
  const vals = pts.map((p) => p.conversions);
  const max = Math.max(1, ...vals);
  const xy = pts.map((p, i) => ({
    x: pad + (i * (W - 2 * pad)) / (pts.length - 1),
    y: H - pad - (p.conversions / max) * (H - 2 * pad),
  }));
  const line = xy.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pad},${H - pad} ${line} ${xy[xy.length - 1].x},${H - pad}`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
    <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".30"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${[0.25, 0.5, 0.75].map((f) => `<line x1="${pad}" y1="${pad + f * (H - 2 * pad)}" x2="${W - pad}" y2="${pad + f * (H - 2 * pad)}" stroke="#EEF1F6" stroke-width="1"/>`).join('')}
    <polygon points="${area}" fill="url(#tg)"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${xy.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2.5"/>`).join('')}
  </svg>`;
}

function hBars(rows: { label: string; value: number; sub?: string }[], color: string): string {
  if (!rows.length) return '<div style="color:#9A9AB0;font-size:12px">—</div>';
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.slice(0, 5).map((r) => `
    <div style="margin:9px 0">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
        <span style="font-weight:700;color:#1A1A2E">${r.label}</span>
        <span style="font-weight:800;color:${color}">${num(r.value)}${r.sub ? `<span style="color:#9A9AB0;font-weight:600"> ${r.sub}</span>` : ''}</span>
      </div>
      <div style="height:9px;background:#F0F3F8;border-radius:99px;overflow:hidden">
        <div style="width:${Math.max(4, (r.value / max) * 100)}%;height:100%;background:linear-gradient(90deg,${color},color-mix(in srgb,${color} 55%,#000));border-radius:99px"></div>
      </div>
    </div>`).join('');
}

const STUDIO_LOGO = `<div style="display:flex;align-items:center;gap:9px"><div style="width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#00B5FE,#0095D0);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:17px">P</div><div style="font-weight:900;font-size:16px;color:#1A1A2E">Studio Pixel</div></div>`;

export function buildReportHtml(input: ReportHtmlInput): string {
  const { clientName, brandColor, clientLogoUrl, reportTypeHe, periodLabel, data, deltas, insights, recommendations, summary, closing, isDemo } = input;
  const c = data.current;
  const brand = brandColor || '#00B5FE';
  const campaignsByConv = [...data.campaigns].sort((a, b) => b.conversions - a.conversions);
  const topCampaign = campaignsByConv[0];

  const kpis: { icon: string; label: string; value: string; delta?: number; good?: 'up' | 'down' }[] = [
    { icon: '👁', label: 'חשיפות', value: num(c.impressions), delta: deltas.impressions },
    { icon: '🖱', label: 'קליקים', value: num(c.clicks), delta: deltas.clicks },
    { icon: '📊', label: 'CTR', value: `${c.ctr}%`, delta: deltas.ctr },
    { icon: '💰', label: 'עלות לקליק', value: money(c.avgCpc), delta: deltas.cost, good: 'down' },
    { icon: '🎯', label: 'לידים / המרות', value: num(c.conversions), delta: deltas.conversions },
    { icon: '🧾', label: 'עלות לליד', value: money(c.costPerConv), delta: deltas.costPerConv, good: 'down' },
    { icon: '✅', label: 'אחוז המרה', value: `${c.convRate}%`, delta: deltas.convRate },
    { icon: '💳', label: 'תקציב שנוצל', value: money(c.cost) },
  ];

  const kpiCards = kpis.map((k) => `
    <div class="kpi">
      <div class="kpi-top"><span class="kpi-ico">${k.icon}</span><span class="kpi-label">${k.label}</span></div>
      <div class="kpi-value">${k.value}</div>
      <div>${deltaChip(k.delta, k.good || 'up') || '<span class="kpi-flat">·</span>'}</div>
    </div>`).join('');

  const ACTION_ICON: Record<string, string> = { strengthen: '🚀', expand: '📈', refine: '🎯', creative: '🎨', landing: '🧭' };

  const insightCards = insights.map((i, idx) => `
    <div class="insight">
      <div class="insight-num">${idx + 1}</div>
      <div style="flex:1">
        <div class="insight-title">${i.title}${i.metricValue ? `<span class="badge">${i.metricValue}</span>` : ''}</div>
        <div class="insight-desc">${i.description}</div>
      </div>
    </div>`).join('');

  const recCards = recommendations.map((r) => `
    <div class="rec">
      <div class="rec-ico">${ACTION_ICON[r.actionType] || '✨'}</div>
      <div style="flex:1"><div class="rec-title">${r.title}</div><div class="rec-desc">${r.description}</div></div>
    </div>`).join('');

  // headline hero numbers
  const hero = [
    { label: 'לידים / המרות', value: num(c.conversions), delta: deltas.conversions },
    { label: 'קליקים', value: num(c.clicks), delta: deltas.clicks },
    { label: 'תקציב שנוצל', value: money(c.cost) },
  ];
  const heroCards = hero.map((h) => `
    <div class="hero-card">
      <div class="hero-val">${h.value}</div>
      <div class="hero-lbl">${h.label} ${deltaChip(h.delta, 'up')}</div>
    </div>`).join('');

  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>דוח Google Ads — ${clientName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--brand:${brand};--ink:#1A1A2E;--sub:#5A5A7A;--muted:#9A9AB0;--bg:#F4F7FB;--card:#FFFFFF;--border:#E8EAF0}
  body{font-family:'Heebo',Arial,sans-serif;background:var(--bg);color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:794px;min-height:1123px;margin:0 auto 22px;background:var(--bg);padding:30px 34px;position:relative}
  .noprint{position:fixed;top:14px;left:14px;z-index:99}
  .pbtn{background:var(--brand);color:#fff;border:none;border-radius:10px;padding:9px 16px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(0,0,0,.15)}
  /* hero header */
  .hero{background:linear-gradient(135deg,var(--brand),color-mix(in srgb,var(--brand) 55%,#001b2e));border-radius:22px;padding:22px 26px;color:#fff;position:relative;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.12)}
  .hero::after{content:'';position:absolute;left:-40px;top:-40px;width:200px;height:200px;background:rgba(255,255,255,.10);border-radius:50%}
  .hero-head{display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1}
  .hero .eyebrow{font-size:11px;letter-spacing:3px;font-weight:800;opacity:.85}
  .hero h1{font-size:30px;font-weight:900;margin-top:3px}
  .hero .pill{display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);border-radius:99px;padding:3px 13px;font-size:11.5px;font-weight:800;margin-top:8px}
  .hero .who{text-align:left;font-size:13px;font-weight:700;line-height:1.6}
  .hero .clogo{height:38px;max-width:130px;object-fit:contain;background:#fff;border-radius:8px;padding:4px 8px;margin-bottom:6px}
  .hero-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px;position:relative;z-index:1}
  .hero-card{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:14px;padding:12px 16px;backdrop-filter:blur(4px)}
  .hero-val{font-size:30px;font-weight:900;line-height:1}
  .hero-lbl{font-size:12px;font-weight:600;opacity:.92;margin-top:5px}
  .demo{background:#EFF8FF;border:1px solid #B9E3FF;border-radius:10px;padding:8px 12px;font-size:11.5px;color:#0077B6;font-weight:600;margin:14px 0}
  /* kpi */
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}
  .kpi{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:13px 15px;box-shadow:0 2px 10px rgba(16,24,40,.04)}
  .kpi-top{display:flex;align-items:center;gap:6px;margin-bottom:6px}
  .kpi-ico{font-size:15px}
  .kpi-label{font-size:11.5px;color:var(--sub);font-weight:700}
  .kpi-value{font-size:24px;font-weight:900;color:var(--ink);line-height:1}
  .kpi-flat{color:var(--muted);font-weight:800}
  /* sections */
  .card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:18px 20px;box-shadow:0 2px 10px rgba(16,24,40,.04);margin-bottom:16px;page-break-inside:avoid}
  .sec-title{font-size:16px;font-weight:900;margin-bottom:12px;display:flex;align-items:center;gap:9px}
  .sec-title::before{content:'';width:6px;height:20px;border-radius:3px;background:var(--brand)}
  .summary{font-size:15.5px;line-height:2;color:var(--ink)}
  .top-strip{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
  .chip{background:color-mix(in srgb,var(--brand) 10%,#fff);border:1px solid color-mix(in srgb,var(--brand) 28%,#fff);border-radius:10px;padding:6px 13px;font-size:12.5px;font-weight:700;color:color-mix(in srgb,var(--brand) 78%,#000)}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .insight{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #F0F3F8}
  .insight:last-child{border-bottom:none}
  .insight-num{width:28px;height:28px;border-radius:9px;background:color-mix(in srgb,var(--brand) 12%,#fff);color:color-mix(in srgb,var(--brand) 80%,#000);font-weight:900;font-size:14px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
  .insight-title{font-size:15px;font-weight:800}
  .badge{background:#10B98115;color:#059669;border-radius:6px;font-size:11px;font-weight:800;padding:1px 8px;margin-inline-start:8px}
  .insight-desc{font-size:13.5px;color:var(--sub);line-height:1.75;margin-top:3px}
  .rec{display:flex;gap:13px;padding:12px 0;border-bottom:1px solid #F0F3F8}
  .rec:last-child{border-bottom:none}
  .rec-ico{font-size:24px;flex:0 0 auto;line-height:1.2}
  .rec-title{font-size:15px;font-weight:800}
  .rec-desc{font-size:13.5px;color:var(--sub);line-height:1.75;margin-top:3px}
  .closing{background:linear-gradient(135deg,var(--brand),color-mix(in srgb,var(--brand) 55%,#001b2e));color:#fff;border-radius:20px;padding:24px 28px;font-size:17px;font-weight:800;line-height:1.7;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.12)}
  .foot{margin-top:14px;font-size:10.5px;color:var(--muted);text-align:center;border-top:1px solid var(--border);padding-top:10px}
  @media print{.noprint{display:none}.page{margin:0}@page{size:A4;margin:0}}
</style></head><body>
<div class="noprint"><button class="pbtn" onclick="window.print()">🖨 שמור כ-PDF</button></div>

<!-- ───────── PAGE 1 ───────── -->
<div class="page">
  <div class="hero">
    <div class="hero-head">
      <div>
        <div class="eyebrow">GOOGLE ADS PERFORMANCE</div>
        <h1>דוח ביצועי Google Ads</h1>
        <span class="pill">דוח ${reportTypeHe} · ${periodLabel}</span>
      </div>
      <div class="who">
        ${clientLogoUrl ? `<img class="clogo" src="${clientLogoUrl}" alt="${clientName}"/><br/>` : ''}
        ${clientName}
        <div style="margin-top:10px;opacity:.9">${STUDIO_LOGO.replace(/#1A1A2E/g, '#fff')}</div>
      </div>
    </div>
    <div class="hero-cards">${heroCards}</div>
  </div>

  ${isDemo ? `<div class="demo">ℹ️ נתוני דוגמה להמחשה — הדוח יתמלא בנתוני אמת לאחר העלאת קובץ Google Ads או חיבור החשבון.</div>` : ''}

  <div class="kpis">${kpiCards}</div>

  <div class="card">
    <div class="sec-title">תקציר מנהלים</div>
    <div class="summary">${summary}</div>
    <div class="top-strip">
      ${topCampaign ? `<span class="chip">🏆 קמפיין מוביל · ${topCampaign.name}</span>` : ''}
      ${data.devices[0] ? `<span class="chip">📱 מכשיר מוביל · ${[...data.devices].sort((a,b)=>b.conversions-a.conversions)[0].label}</span>` : ''}
      ${data.locations[0] ? `<span class="chip">📍 אזור מוביל · ${[...data.locations].sort((a,b)=>b.conversions-a.conversions)[0].label}</span>` : ''}
      ${data.optimizationScore != null ? `<span class="chip">⚙️ Optimization Score · ${data.optimizationScore}/100</span>` : ''}
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
  <div class="two">
    <div class="card" style="margin:0">
      <div class="sec-title">קמפיינים מובילים</div>
      ${hBars(campaignsByConv.map((c) => ({ label: c.name, value: c.conversions, sub: 'המרות' })), brand)}
    </div>
    <div class="card" style="margin:0">
      <div class="sec-title">פילוח לפי מכשיר</div>
      ${hBars([...data.devices].sort((a,b)=>b.conversions-a.conversions).map((d) => ({ label: d.label, value: d.conversions, sub: 'המרות' })), '#0095D0')}
      ${data.locations.length ? `<div style="height:1px;background:#F0F3F8;margin:14px 0"></div><div style="font-size:12.5px;font-weight:800;color:var(--sub);margin-bottom:8px">אזורים מובילים</div>${hBars([...data.locations].sort((a,b)=>b.conversions-a.conversions).map((l) => ({ label: l.label, value: l.conversions, sub: 'המרות' })), '#7C5CFF')}` : ''}
    </div>
  </div>

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
