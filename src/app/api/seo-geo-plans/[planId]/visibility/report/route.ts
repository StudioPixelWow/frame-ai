/**
 * AI Visibility report export + send.
 *
 * GET  ?format=csv|html|json   → download/inline report (html is print-to-PDF ready)
 * POST { channel: 'email' | 'whatsapp' }  → send the report to the client
 *
 * Staff only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ok, err, loadPlan, notFound, requireStaff } from '@/lib/seo/api-helpers';
import { buildVisibilityReport } from '@/lib/seo/geo-visibility/report';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ planId: string }> }) {
  const g = requireStaff(req); if (g) return g;
  const { planId } = await ctx.params;
  const { plan, error } = await loadPlan(planId, req); if (error) return error; if (!plan) return notFound('Plan');
  const format = req.nextUrl.searchParams.get('format') || 'html';
  const rep = await buildVisibilityReport(planId);
  if (format === 'csv') return new NextResponse(rep.csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ai-visibility-${rep.month}.csv"` } });
  if (format === 'json') return NextResponse.json(rep.data);
  return new NextResponse(rep.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ planId: string }> }) {
  const g = requireStaff(req); if (g) return g;
  const { planId } = await ctx.params;
  const { plan, error } = await loadPlan(planId, req); if (error) return error; if (!plan) return notFound('Plan');
  let body: any = {}; try { body = await req.json(); } catch { /* */ }
  const channel = body.channel || 'email';
  const rep = await buildVisibilityReport(planId);

  if (channel === 'email') {
    const { sendEmail, getSenderEmail, isEmailConfigured } = await import('@/lib/email/email-service');
    if (!(await isEmailConfigured())) return err('אימייל לא מוגדר במערכת', 503);
    const to = rep.clientEmail || (await getSenderEmail());
    if (!to) return err('אין כתובת מייל ללקוח', 400);
    const res = await sendEmail({ to, subject: `📡 דוח נראות AI — ${rep.clientName} — ${rep.month}`, html: rep.html });
    if (!(res as any).success && (res as any).error) return err(`שליחת מייל נכשלה: ${(res as any).error}`, 502);
    return ok({ sent: 'email', to });
  }

  if (channel === 'whatsapp') {
    const { isWhatsAppConfigured, sendTextMessage, normalizeIsraeliPhone } = await import('@/lib/whatsapp/whatsapp-client');
    if (!isWhatsAppConfigured()) return err('WhatsApp לא מוגדר', 503);
    let phone = '';
    try { const { data } = await getSupabase().from('clients').select('phone').eq('id', rep.clientId).maybeSingle(); phone = (data as any)?.phone || ''; } catch { /* */ }
    if (!phone) return err('אין מספר טלפון ללקוח', 400);
    const d = rep.data.latest || {};
    const msg = `📡 *דוח נראות AI — ${rep.month}*\n\nציון נראות: ${d.visibility_score || 0}/100\nאזכורים: ${d.total_mentions || 0}\nציטוטים: ${d.total_citations || 0}\nנתח קול: ${Math.round((d.share_of_ai_voice || 0) * 100)}%\n\n— Studio Pixel`;
    const res = await sendTextMessage(normalizeIsraeliPhone(phone), msg);
    if (!(res as any)?.success && (res as any)?.error) return err(`WhatsApp נכשל: ${(res as any).error}`, 502);
    return ok({ sent: 'whatsapp', to: phone });
  }
  return err('channel לא נתמך');
}
