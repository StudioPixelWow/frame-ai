/**
 * AI Visibility alert notifier — when a monitoring run detects high-severity
 * answer changes (we dropped out of an answer, lost a citation, a competitor
 * overtook us), the team gets an email so action can be taken fast. Throttled to
 * avoid spam (max one notification per plan per 12h). Best-effort & non-fatal —
 * a failed send never breaks a run. The alerts also already flow to the Action
 * Center; this is the outbound push on top.
 */

import { visSb, vid } from './db';
import { seoPlans } from '@/lib/db';

const THROTTLE_HOURS = 12;

export interface AlertLike {
  alert_type?: string; severity?: string; title?: string; description?: string;
  action_recommendation?: string | null; related_query_id?: string | null;
}

export async function notifyVisibilityAlerts(planId: string, clientId: string | null, alerts: AlertLike[]): Promise<{ notified: boolean; channel?: string; reason?: string }> {
  try {
    const high = (alerts || []).filter((a) => a.severity === 'high' || a.alert_type === 'citation_lost');
    if (!high.length) return { notified: false, reason: 'no_high_alerts' };

    const sb = visSb();

    // Throttle: skip if we already notified for this plan recently.
    try {
      const since = new Date(Date.now() - THROTTLE_HOURS * 3600 * 1000).toISOString();
      const { data: recent } = await sb.from('geo_visibility_logs').select('id').eq('plan_id', planId).eq('event_type', 'alert_notified').gte('created_at', since).limit(1);
      if (recent && recent.length) return { notified: false, reason: 'throttled' };
    } catch { /* if logs unavailable, continue */ }

    const { sendEmail, getSenderEmail, isEmailConfigured } = await import('@/lib/email/email-service');
    if (!(await isEmailConfigured())) return { notified: false, reason: 'email_not_configured' };
    const to = await getSenderEmail();
    if (!to) return { notified: false, reason: 'no_recipient' };

    const plan: any = await seoPlans.getByIdAsync(planId);
    const clientName = plan?.clientName || plan?.businessProfile?.businessName || 'לקוח';
    const link = `${(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')}/seo-geo/${planId}/visibility`;

    const rows = high.slice(0, 12).map((a) => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#EF4444;font-weight:700">${esc(a.title || a.alert_type || 'התראה')}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#555">${esc(a.description || '')}${a.action_recommendation ? `<br><span style="color:#0095D0">💡 ${esc(a.action_recommendation)}</span>` : ''}</td>
    </tr>`).join('');

    const html = `<!doctype html><html dir="rtl" lang="he"><body style="font-family:Arial,Helvetica,sans-serif;color:#1A1A2E;max-width:640px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 4px">📡 התראת נראות AI — ${esc(clientName)}</h2>
      <p style="color:#5A5A7A;margin:0 0 16px">זוהו ${high.length} שינויים משמעותיים בנראות במנועי ה-AI בריצת הניטור האחרונה.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>
        <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #ddd">מה קרה</th>
        <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #ddd">פירוט והמלצה</th>
      </tr></thead><tbody>${rows}</tbody></table>
      ${link ? `<p style="margin-top:18px"><a href="${esc(link)}" style="background:#00B5FE;color:#fff;text-decoration:none;border-radius:8px;padding:9px 18px;font-weight:700;display:inline-block">פתח את מרכז הנראות ←</a></p>` : ''}
      <p style="font-size:11px;color:#999;margin-top:20px;border-top:1px solid #eee;padding-top:10px">התראה אוטומטית · Studio Pixel · PixelManageAI</p>
    </body></html>`;

    const res: any = await sendEmail({ to, subject: `📡 התראת נראות AI — ${clientName} — ${high.length} שינויים`, html });
    if (res && res.success === false && res.error) return { notified: false, reason: `email_failed: ${res.error}` };

    try { await sb.from('geo_visibility_logs').insert({ id: vid('vlog'), plan_id: planId, level: 'warn', event_type: 'alert_notified', message: `notified ${high.length} high alerts to ${to}`, created_at: new Date().toISOString() }); } catch { /* */ }
    return { notified: true, channel: 'email' };
  } catch (e) {
    return { notified: false, reason: e instanceof Error ? e.message : 'error' };
  }
}

function esc(s: string): string { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
