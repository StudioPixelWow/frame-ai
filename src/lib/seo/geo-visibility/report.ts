/**
 * AI Visibility report builder — assembles a monthly client report (data + CSV +
 * standalone printable HTML). The HTML is self-contained and print-to-PDF ready.
 * Pure read; no side effects.
 */

import { seoPlans } from '@/lib/db';
import { getSupabase } from '@/lib/db/store';

export interface VisibilityReport {
  planId: string; clientName: string; clientEmail: string | null; clientId: string | null;
  month: string; data: any; csv: string; html: string;
}

export async function buildVisibilityReport(planId: string): Promise<VisibilityReport> {
  const sb = getSupabase();
  const plan: any = await seoPlans.getByIdAsync(planId);
  const clientName = plan?.clientName || plan?.businessProfile?.businessName || 'הלקוח';

  const [aggRes, alertRes, runRes, citHistRes, compRes] = await Promise.all([
    sb.from('geo_visibility_monthly_aggregations').select('*').eq('plan_id', planId).order('month', { ascending: true }).limit(12),
    sb.from('geo_visibility_alerts').select('*').eq('plan_id', planId).neq('status', 'dismissed').order('detected_at', { ascending: false }).limit(20),
    sb.from('geo_visibility_runs').select('*').eq('plan_id', planId).order('created_at', { ascending: false }).limit(1),
    sb.from('geo_citation_history').select('*').eq('plan_id', planId).eq('is_own_site', true).order('total_times_seen', { ascending: false }).limit(15),
    sb.from('geo_visibility_competitor_mentions').select('competitor_name').eq('plan_id', planId).limit(500),
  ]);
  const agg = aggRes.data || [];
  const latest = agg[agg.length - 1] || {};
  const prev = agg.length > 1 ? agg[agg.length - 2] : null;
  const alerts = alertRes.data || [];
  const lastRun = (runRes.data || [])[0] || null;
  const citPages = citHistRes.data || [];
  const compCounts: Record<string, number> = {};
  for (const c of (compRes.data || [])) compCounts[c.competitor_name] = (compCounts[c.competitor_name] || 0) + 1;
  const competitors = Object.entries(compCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const month = latest.month || new Date().toISOString().slice(0, 7);
  const delta = prev ? (latest.visibility_score || 0) - (prev.visibility_score || 0) : 0;
  const data = { clientName, month, latest, prev, delta, agg, alerts, lastRun, citPages, competitors };

  // ── CSV ──
  const csvRows: string[] = [['חודש', 'ציון נראות', 'אזכורים', 'ציטוטים', 'נתח קול %', 'חשיפה (אומדן)'].join(',')];
  for (const m of agg) csvRows.push([m.month, m.visibility_score || 0, m.total_mentions || 0, m.total_citations || 0, Math.round((m.share_of_ai_voice || 0) * 100), m.estimated_ai_reach || 0].join(','));
  const csv = '﻿' + csvRows.join('\n'); // BOM for Hebrew Excel

  // ── HTML (printable → PDF) ──
  const sc = (n: number) => (n >= 75 ? '#10B981' : n >= 50 ? '#F59E0B' : '#EF4444');
  const maxM = Math.max(1, ...agg.map((m: any) => m.total_mentions || 0));
  const bars = agg.slice(-6).map((m: any) => `<td style="text-align:center;vertical-align:bottom;padding:0 4px"><div style="height:${(m.total_mentions / maxM) * 80}px;background:#00B5FE;border-radius:3px 3px 0 0;min-height:2px"></div><div style="font-size:10px;color:#888;margin-top:3px">${(m.month || '').slice(5)}</div><div style="font-size:11px;font-weight:700">${m.total_mentions || 0}</div></td>`).join('');
  const alertRows = alerts.slice(0, 10).map((a: any) => `<li style="margin:4px 0;color:${a.severity === 'high' ? '#EF4444' : a.severity === 'medium' ? '#F59E0B' : '#555'}">${a.title} — <span style="color:#666;font-size:12px">${a.description || ''}</span></li>`).join('');
  const citRows = citPages.map((c: any) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${c.cited_url}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${c.current_visibility_status}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${c.total_times_seen}</td></tr>`).join('');
  const compRows = competitors.map((c: any) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${c.name}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${c.count}</td></tr>`).join('');
  const kpi = (label: string, val: any, color?: string) => `<div style="flex:1;min-width:120px;text-align:center;padding:12px;background:#F7F9FC;border-radius:12px"><div style="font-size:28px;font-weight:800;color:${color || '#1A1A2E'}">${val}</div><div style="font-size:12px;color:#5A5A7A">${label}</div></div>`;

  const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>דוח נראות AI — ${clientName} — ${month}</title>
<style>@media print{.noprint{display:none}}body{font-family:Arial,Helvetica,sans-serif;color:#1A1A2E;max-width:820px;margin:0 auto;padding:28px;background:#fff}</style></head><body>
<div class="noprint" style="text-align:left;margin-bottom:12px"><button onclick="window.print()" style="background:#00B5FE;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-weight:700;cursor:pointer">🖨 שמור כ-PDF</button></div>
<h1 style="font-size:24px;margin:0">📡 דוח נראות במנועי AI</h1>
<p style="color:#5A5A7A;margin:4px 0 20px">${clientName} · חודש ${month}</p>
<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
${kpi('ציון נראות', `${latest.visibility_score || 0}${delta ? (delta > 0 ? ' ▲' : ' ▼') : ''}`, sc(latest.visibility_score || 0))}
${kpi('אזכורים', latest.total_mentions || 0, '#00B5FE')}
${kpi('ציטוטים', latest.total_citations || 0, '#00B5FE')}
${kpi('נתח קול', `${Math.round((latest.share_of_ai_voice || 0) * 100)}%`)}
${kpi('חשיפה (אומדן)', latest.estimated_ai_reach || 0)}
</div>
<h3>מגמת אזכורים</h3>
<table style="width:100%;height:120px;border-collapse:collapse;margin-bottom:20px"><tr>${bars || '<td style="color:#888">אין נתונים</td>'}</tr></table>
<h3>מה קרה החודש</h3><ul style="padding-inline-start:18px">${alertRows || '<li style="color:#888">אין אירועים מיוחדים</li>'}</ul>
<h3>עמודים מצוטטים שלך</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:right;padding:4px 8px;border-bottom:2px solid #ddd">URL</th><th style="padding:4px 8px;border-bottom:2px solid #ddd">סטטוס</th><th style="padding:4px 8px;border-bottom:2px solid #ddd">פעמים</th></tr></thead><tbody>${citRows || '<tr><td colspan="3" style="color:#888;padding:8px">אין ציטוטים עדיין</td></tr>'}</tbody></table>
<h3 style="margin-top:20px">מתחרים בתשובות AI</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:right;padding:4px 8px;border-bottom:2px solid #ddd">מתחרה</th><th style="padding:4px 8px;border-bottom:2px solid #ddd">הופעות</th></tr></thead><tbody>${compRows || '<tr><td colspan="2" style="color:#888;padding:8px">—</td></tr>'}</tbody></table>
<p style="font-size:11px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:10px">* הנתונים מבוססים על ניטור שאילתות מול מנועי AI (אומדן מבוקר), ולא על נתון רשמי של שימוש בפועל. הופק ע"י Studio Pixel.</p>
</body></html>`;

  return { planId, clientName, clientEmail: plan?.clientEmail || null, clientId: plan?.clientId || null, month, data, csv, html };
}
