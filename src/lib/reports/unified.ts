/**
 * Unified client report — one premium monthly story that fuses every channel:
 * the PIXEL Score (organic + GEO + authority), Google Ads performance, and AI
 * visibility. Instead of three separate screens the client gets a single
 * narrative. Self-contained printable RTL HTML. Pure read; no side effects.
 */

import { seoPlans } from '@/lib/db';
import { getSupabase } from '@/lib/db/store';
import { getClientById } from '@/lib/db/client-helpers';
import { computePixelScore, type PixelScore } from '@/lib/seo/geo-visibility/pixel-score';

const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : null);

interface UnifiedData {
  clientName: string; month: string; pixel: PixelScore | null;
  geo: any | null; ads: any | null; planId: string | null;
}

async function findPlanForClient(clientId: string): Promise<any | null> {
  try { const all: any[] = await seoPlans.getAllAsync(); return all.find((p) => p.clientId === clientId) || null; }
  catch { return null; }
}

export async function buildUnifiedReportData(clientId: string): Promise<UnifiedData> {
  const sb = getSupabase();
  const client: any = await getClientById(clientId);
  const clientName = client?.name || 'לקוח';
  const plan = await findPlanForClient(clientId);

  let pixel: PixelScore | null = null;
  if (plan?.id) { try { pixel = await computePixelScore(plan.id); } catch { /* */ } }

  let geo: any = null;
  try {
    const { data } = await sb.from('geo_visibility_monthly_aggregations').select('*').eq('client_id', clientId).order('month', { ascending: false }).limit(2);
    if (data && data.length) geo = { latest: data[0], prev: data[1] || null };
  } catch { /* */ }

  let ads: any = null;
  try {
    const { listReportsForClient } = await import('@/lib/google-ads/db');
    const reports = await listReportsForClient(clientId);
    const latest = (reports || []).find((r: any) => r.jsonData) || (reports || [])[0] || null;
    if (latest) {
      const t = latest.jsonData?.totals || latest.jsonData?.current || latest.jsonData || {};
      ads = { summary: latest.summaryText || '', cost: num(t.cost ?? t.spend), clicks: num(t.clicks), conversions: num(t.conversions ?? t.leads), cpl: num(t.cpl ?? t.costPerLead), dateFrom: latest.dateFrom, dateTo: latest.dateTo };
    }
  } catch { /* */ }

  const month = geo?.latest?.month || new Date().toISOString().slice(0, 7);
  return { clientName, month, pixel, geo, ads, planId: plan?.id || null };
}

function esc(s: any): string { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const scColor = (n: number) => (n >= 75 ? '#10B981' : n >= 50 ? '#F59E0B' : '#EF4444');

export async function buildUnifiedReportHtml(clientId: string): Promise<{ html: string; clientName: string; month: string }> {
  const d = await buildUnifiedReportData(clientId);
  const today = new Date().toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' });
  const C = { primary: '#00B5FE', primaryDark: '#0095D0', text: '#1A1A2E', sub: '#5A5A7A', bg: '#F7F9FC', border: '#E8EAF0' };

  const kpi = (label: string, val: any, color?: string) =>
    `<div style="flex:1;min-width:120px;text-align:center;padding:14px;background:#fff;border:1px solid ${C.border};border-radius:14px"><div style="font-size:26px;font-weight:900;color:${color || C.text}">${val}</div><div style="font-size:12px;color:${C.sub};margin-top:2px">${label}</div></div>`;

  const pixelBlock = d.pixel ? `
    <div style="background:linear-gradient(135deg,${C.primary},${C.primaryDark});border-radius:18px;padding:26px 28px;color:#fff;margin-bottom:18px">
      <div style="font-size:12px;font-weight:700;opacity:.9;letter-spacing:1px">PIXEL SCORE · ציון מאוחד</div>
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-top:8px">
        <div style="font-size:56px;font-weight:900;line-height:1">${d.pixel.overall}</div>
        <div style="flex:1;min-width:240px">
          ${d.pixel.pillars.map((p) => `<div style="margin-bottom:6px;opacity:${p.measured ? 1 : 0.55}">
            <div style="display:flex;justify-content:space-between;font-size:12.5px"><span>${esc(p.label)}</span><b>${p.measured ? p.score : '—'}</b></div>
            <div style="height:6px;border-radius:999px;background:rgba(255,255,255,.25);overflow:hidden"><div style="width:${p.measured ? p.score : 0}%;height:100%;background:#fff"></div></div>
          </div>`).join('')}
        </div>
      </div>
      <div style="font-size:13px;opacity:.95;margin-top:8px">${esc(d.pixel.story)}</div>
    </div>` : '';

  const geoBlock = d.geo?.latest ? `
    <h3 style="margin:22px 0 8px">📡 נראות במנועי AI (GEO)</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${kpi('ציון נראות', d.geo.latest.visibility_score ?? 0, scColor(d.geo.latest.visibility_score || 0))}
      ${kpi('אזכורים', d.geo.latest.total_mentions ?? 0, C.primary)}
      ${kpi('נתח קול', `${Math.round((d.geo.latest.share_of_ai_voice || 0) * 100)}%`)}
      ${kpi('ציטוטים', d.geo.latest.total_citations ?? 0, C.primary)}
    </div>` : '';

  const adsBlock = d.ads ? `
    <h3 style="margin:22px 0 8px">🎯 Google Ads</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${d.ads.cost != null ? kpi('הוצאה', `₪${Math.round(d.ads.cost).toLocaleString('he-IL')}`) : ''}
      ${d.ads.clicks != null ? kpi('קליקים', d.ads.clicks.toLocaleString('he-IL'), C.primary) : ''}
      ${d.ads.conversions != null ? kpi('המרות', d.ads.conversions.toLocaleString('he-IL'), '#10B981') : ''}
      ${d.ads.cpl != null ? kpi('עלות לליד', `₪${Math.round(d.ads.cpl).toLocaleString('he-IL')}`) : ''}
    </div>
    ${d.ads.summary ? `<p style="font-size:13.5px;color:${C.sub};margin-top:10px">${esc(d.ads.summary)}</p>` : ''}` : '';

  const hasData = d.pixel || d.geo?.latest || d.ads;

  const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>דוח מאוחד — ${esc(d.clientName)} — ${esc(d.month)}</title>
<style>@media print{.noprint{display:none}}body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:${C.text};background:${C.bg};max-width:840px;margin:0 auto;padding:28px;line-height:1.7}h3{font-size:16px}</style></head><body>
<div class="noprint" style="text-align:left;margin-bottom:14px"><button onclick="window.print()" style="background:${C.primary};color:#fff;border:none;border-radius:9px;padding:9px 20px;font-weight:700;cursor:pointer">🖨 שמור כ-PDF</button></div>
<h1 style="font-size:26px;margin:0">🧩 דוח ביצועים מאוחד</h1>
<p style="color:${C.sub};margin:4px 0 18px">${esc(d.clientName)} · ${esc(d.month)} · הופק ${today}</p>
${pixelBlock}
${geoBlock}
${adsBlock}
${!hasData ? `<div style="background:#fff;border:1px solid ${C.border};border-radius:14px;padding:24px;text-align:center;color:${C.sub}">אין עדיין מספיק נתונים לדוח. הרץ בדיקות נראות / סנכרן Google Ads / הוסף תוכנית SEO.</div>` : ''}
<p style="font-size:11px;color:#aaa;margin-top:26px;border-top:1px solid ${C.border};padding-top:10px">דוח מאוחד · Studio Pixel · PixelManageAI · ${today}</p>
</body></html>`;

  return { html, clientName: d.clientName, month: d.month };
}
