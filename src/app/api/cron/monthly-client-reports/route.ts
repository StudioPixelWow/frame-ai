/**
 * Cron: Monthly Client Report Generator & Sender
 *
 * GET /api/cron/monthly-client-reports
 *
 * Called by Vercel Cron on the 1st of each month (03:00 IST).
 * Generates a professional PDF-quality HTML report for every active client
 * with an email address, saves it to DB, and sends via Gmail.
 *
 * Also supports manual trigger:
 *   GET /api/cron/monthly-client-reports?manual=true&clientId=xxx
 *
 * Auth: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { reports } from '@/lib/db';
import type { Report, Client } from '@/lib/db/schema';
import { generateClientMonthlyReportData } from '@/lib/reports/report-engine';
import { generateReportHtml } from '@/lib/reports/pdf-generator';
import { sendEmail, isEmailConfigured } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — reports can take time

// ═══════════════════════════════════════════════════════════════════════
// Date Helpers
// ═══════════════════════════════════════════════════════════════════════

function getPreviousMonthRange(): { start: string; end: string; monthName: string; year: number } {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1; // 0-indexed

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // Last day of month

  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    monthName: months[month],
    year,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Email Template
// ═══════════════════════════════════════════════════════════════════════

function buildEmailHtml(clientName: string, monthName: string, year: number): string {
  return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; text-align: right; background: #f8fafc; padding: 32px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #00B5FE, #0090cc); padding: 32px; text-align: center;">
      <div style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">PixelFrame AI</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.8); margin-top: 4px;">דוח חודשי אוטומטי</div>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <div style="font-size: 18px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px;">
        שלום ${clientName},
      </div>
      <div style="font-size: 14px; color: #64748b; line-height: 1.7; margin-bottom: 24px;">
        מצורף הדוח החודשי שלך עבור <strong>${monthName} ${year}</strong>.
        <br/>
        הדוח כולל סיכום ביצועים, לידים, קמפיינים פעילים והמלצות לחודש הבא.
      </div>

      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 13px; color: #0369a1; font-weight: 600;">
          📎 הדוח מצורף כקובץ HTML — פתחו בדפדפן לצפייה מלאה, או הדפיסו ל-PDF.
        </div>
      </div>

      <div style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
        דוח זה הופק אוטומטית על ידי מערכת PixelFrame AI.
        <br/>
        לשאלות או בקשות — צרו קשר עם מנהל החשבון שלכם.
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 11px; color: #94a3b8;">
        © ${year} PixelFrame AI — כל הזכויות שמורות
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// Fetch Active Clients
// ═══════════════════════════════════════════════════════════════════════

async function getActiveClients(specificClientId?: string): Promise<Client[]> {
  const sb = getSupabase();

  let query = sb
    .from('clients')
    .select('*')
    .eq('status', 'active');

  if (specificClientId) {
    query = query.eq('id', specificClientId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[monthly-reports] Failed to fetch clients:', error.message);
    return [];
  }

  // Map snake_case → camelCase for key fields
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    contactPerson: row.contact_person,
    status: row.status,
    clientType: row.client_type,
    retainerAmount: row.retainer_amount,
    ...row, // include all other fields
  })) as Client[];
}

// ═══════════════════════════════════════════════════════════════════════
// Generate + Send Report for One Client
// ═══════════════════════════════════════════════════════════════════════

interface ReportResult {
  clientId: string;
  clientName: string;
  status: 'sent' | 'saved' | 'skipped' | 'error';
  email?: string;
  error?: string;
  reportId?: string;
}

async function generateAndSendReport(
  client: Client,
  periodStart: string,
  periodEnd: string,
  monthName: string,
  year: number,
  shouldEmail: boolean,
): Promise<ReportResult> {
  const clientId = client.id;
  const clientName = client.name || client.company || 'לקוח';

  try {
    // 1. Generate report data
    const reportData = await generateClientMonthlyReportData(
      clientId,
      periodStart,
      periodEnd,
      'client_facing',
    );

    // 2. Create report record
    const title = `דוח חודשי — ${clientName} — ${monthName} ${year}`;
    const reportRecord: Omit<Report, 'id'> = {
      type: 'client_monthly',
      mode: 'client_facing',
      title,
      status: 'ready',
      clientId,
      clientName,
      campaignId: null,
      campaignName: null,
      periodStart,
      periodEnd,
      data: reportData,
      pdfUrl: null,
      generatedBy: 'auto_monthly_cron',
      sentTo: client.email || null,
      sentAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedReport = await reports.createAsync(reportRecord as Report);
    const reportId = savedReport?.id || 'unknown';

    // 3. Generate HTML for PDF/email attachment
    const fullReport: Report = {
      ...reportRecord,
      id: reportId,
    } as Report;

    const htmlContent = generateReportHtml(fullReport);

    // 4. Send email if client has email and Gmail is configured
    if (shouldEmail && client.email) {
      const emailResult = await sendEmail({
        to: client.email,
        subject: `📊 ${title}`,
        html: buildEmailHtml(clientName, monthName, year),
        attachments: [
          {
            filename: `report-${clientName}-${monthName}-${year}.html`,
            content: Buffer.from(htmlContent, 'utf-8').toString('base64'),
            contentType: 'text/html',
          },
        ],
      });

      if (emailResult.success) {
        // Update report with sent info
        try {
          const sb = getSupabase();
          await sb
            .from('app_reports')
            .update({
              sent_to: client.email,
              sent_at: new Date().toISOString(),
              status: 'sent',
            })
            .eq('id', reportId);
        } catch { /* non-critical */ }

        return {
          clientId,
          clientName,
          status: 'sent',
          email: client.email,
          reportId,
        };
      } else {
        return {
          clientId,
          clientName,
          status: 'saved',
          error: `Email failed: ${emailResult.error}`,
          reportId,
        };
      }
    }

    return {
      clientId,
      clientName,
      status: client.email ? 'saved' : 'skipped',
      reportId,
      error: !client.email ? 'אין כתובת אימייל' : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[monthly-reports] Error for ${clientName}:`, msg);
    return {
      clientId,
      clientName,
      status: 'error',
      error: msg,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ROUTE
// ═══════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const startTs = Date.now();

  // Auth check (skip for manual with no CRON_SECRET)
  const url = new URL(req.url);
  const isManual = url.searchParams.get('manual') === 'true';
  const specificClientId = url.searchParams.get('clientId') || undefined;

  if (process.env.CRON_SECRET && !isManual) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log(`[monthly-reports] Starting ${isManual ? 'manual' : 'scheduled'} report generation at ${new Date().toISOString()}`);

  try {
    // Check email configuration
    const emailReady = await isEmailConfigured();

    // Get date range for previous month
    const { start, end, monthName, year } = getPreviousMonthRange();
    console.log(`[monthly-reports] Period: ${start} — ${end} (${monthName} ${year})`);

    // Fetch active clients
    const clients = await getActiveClients(specificClientId);
    console.log(`[monthly-reports] Found ${clients.length} active clients`);

    if (clients.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'אין לקוחות פעילים',
        generated: 0,
        durationMs: Date.now() - startTs,
      });
    }

    // Generate reports for each client
    const results: ReportResult[] = [];

    for (const client of clients) {
      const result = await generateAndSendReport(
        client,
        start,
        end,
        monthName,
        year,
        emailReady,
      );
      results.push(result);
      console.log(`[monthly-reports] ${result.clientName}: ${result.status}${result.error ? ` (${result.error})` : ''}`);
    }

    // Summary
    const sent = results.filter(r => r.status === 'sent').length;
    const saved = results.filter(r => r.status === 'saved').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error');
    const durationMs = Date.now() - startTs;

    console.log(`[monthly-reports] Done. Sent: ${sent}, Saved: ${saved}, Skipped: ${skipped}, Errors: ${errors.length}. Duration: ${durationMs}ms`);

    return NextResponse.json({
      ok: true,
      period: { start, end, monthName, year },
      total: clients.length,
      sent,
      saved,
      skipped,
      errors: errors.length > 0 ? errors.map(e => ({ client: e.clientName, error: e.error })) : undefined,
      emailConfigured: emailReady,
      results,
      durationMs,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[monthly-reports] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'שגיאה ביצירת דוחות חודשיים',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
