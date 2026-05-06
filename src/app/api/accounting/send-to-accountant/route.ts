import { NextRequest, NextResponse } from "next/server";
import { clientFiles } from "@/lib/db";
import { sendEmail } from "@/lib/email/email-service";

const PERIODS: Record<string, { name: string; startMonth: number; endMonth: number }> = {
  "jan-feb": { name: "ינואר-פברואר", startMonth: 0, endMonth: 1 },
  "mar-apr": { name: "מרץ-אפריל", startMonth: 2, endMonth: 3 },
  "may-jun": { name: "מאי-יוני", startMonth: 4, endMonth: 5 },
  "jul-aug": { name: "יולי-אוגוסט", startMonth: 6, endMonth: 7 },
  "sep-oct": { name: "ספטמבר-אוקטובר", startMonth: 8, endMonth: 9 },
  "nov-dec": { name: "נובמבר-דצמבר", startMonth: 10, endMonth: 11 },
};

/**
 * POST /api/accounting/send-to-accountant
 *
 * Gathers all uploaded files for a given period + year,
 * validates they exist and have accessible URLs,
 * and sends (or simulates sending) an email to the accountant
 * with the actual files attached.
 *
 * Body: { period: string, year: number, documentIds?: string[], accountantEmail?: string, message?: string }
 *
 * Returns: { success, emailPreview: { to, subject, body, attachments[] } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { period, year, documentIds, accountantEmail, message } = body;

    if (!period || !year) {
      return NextResponse.json(
        { error: "חסר פרמטרים: period ו-year נדרשים" },
        { status: 400 }
      );
    }

    const periodInfo = PERIODS[period];
    const periodName = periodInfo?.name || period;

    // ── Fetch documents ──
    // Strategy: if client sent documentIds, use those (guaranteed match with UI).
    // Otherwise, replicate the EXACT same filtering the UI uses.
    const allFiles = await clientFiles.getAllAsync();
    let docs: any[];

    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      // Direct ID match — client already filtered, just verify they exist
      const idSet = new Set(documentIds);
      docs = allFiles.filter((f: any) => idSet.has(f.id) && f.category === "accountant");
      console.log(`[SendToAccountant] Using ${docs.length} docs from ${documentIds.length} provided IDs`);
    } else {
      // Fallback: replicate the UI's getDocumentsForPeriod logic EXACTLY
      docs = allFiles.filter((f: any) => {
        if (f.category !== "accountant") return false;
        // Primary: match by explicit period + year fields
        if (f.period && f.year) {
          return f.period === period && Number(f.year) === Number(year);
        }
        // Fallback for legacy documents: match by createdAt date
        if (!periodInfo) return false;
        const docDate = new Date(f.createdAt || f.uploadDate);
        if (isNaN(docDate.getTime())) return false;
        const docYear = docDate.getFullYear();
        const docMonth = docDate.getMonth();
        return docYear === Number(year) && docMonth >= periodInfo.startMonth && docMonth <= periodInfo.endMonth;
      });
      console.log(`[SendToAccountant] Filtered ${docs.length} docs from ${allFiles.length} total files for period=${period} year=${year}`);
    }

    // ── Validate: must have files ──
    if (docs.length === 0) {
      return NextResponse.json(
        { error: `אין מסמכים לתקופה ${periodName} ${year}. העלה מסמכים לפני שליחה.` },
        { status: 400 }
      );
    }

    // ── Build attachment list with real URLs ──
    const attachments = docs.map((doc: any) => ({
      id: doc.id,
      fileName: doc.fileName || "מסמך ללא שם",
      fileUrl: doc.fileUrl || null,
      fileSize: doc.fileSize || 0,
      documentType: doc.documentType || doc.fileType || "other",
      notes: doc.notes || "",
      uploadedAt: doc.createdAt || null,
      accessible: !!(doc.fileUrl && doc.fileUrl.startsWith("http")),
    }));

    const inaccessible = attachments.filter((a: any) => !a.accessible);

    // ── Build email content ──
    const to = accountantEmail || "accountant@example.com";
    const subject = `מסמכים לתקופה ${periodName} ${year} — סטודיו פיקסל`;
    const totalSize = attachments.reduce((sum: number, a: any) => sum + (a.fileSize || 0), 0);
    const logoUrl = 'https://s-pixel.co.il/wp-content/uploads/2025/12/rdgik.png';
    const emailBody = [
      `── PixelManageAI | Studio Pixel ──`,
      `Logo: ${logoUrl}`,
      ``,
      `שלום,`,
      ``,
      `מצורפים ${docs.length} מסמכים לתקופה ${periodName} ${year}.`,
      message ? `\nהערה: ${message}` : "",
      ``,
      `פירוט קבצים מצורפים:`,
      ...attachments.map((a: any, i: number) =>
        `  ${i + 1}. ${a.fileName} (${(a.fileSize / 1024).toFixed(0)} KB)`
      ),
      ``,
      `גודל כולל: ${(totalSize / 1024).toFixed(0)} KB`,
      ``,
      `בברכה,`,
      `סטודיו פיקסל — PixelManageAI`,
    ].filter(Boolean).join("\n");

    // ── Mark documents as sent ──
    const sentAt = new Date().toISOString();
    for (const doc of docs) {
      try {
        await clientFiles.updateAsync(doc.id, {
          sentToAccountant: true,
          sentAt,
        });
      } catch (e) {
        // Non-critical — continue even if marking fails
        console.warn(`[SendToAccountant] Failed to mark doc ${doc.id} as sent:`, e);
      }
    }

    // ── Build HTML email body ──
    const htmlBody = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px 32px; color: white;">
      <img src="${logoUrl}" alt="PIXEL Studio" style="height: 32px; margin-bottom: 8px;" />
      <div style="font-size: 20px; font-weight: 700;">מסמכים לרואה חשבון</div>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 15px; color: #334155;">שלום,</p>
      <p style="font-size: 15px; color: #334155;">מצורפים ${docs.length} מסמכים לתקופה <strong>${periodName} ${year}</strong>.</p>
      ${message ? `<p style="font-size: 14px; color: #64748b; background: #f1f5f9; padding: 12px; border-radius: 8px;">📝 ${message}</p>` : ''}
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead><tr style="background: #f8fafc;">
          <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #64748b;">#</th>
          <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #64748b;">קובץ</th>
          <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #64748b;">גודל</th>
        </tr></thead>
        <tbody>${attachments.map((a: any, i: number) => `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${i + 1}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${a.accessible ? `<a href="${a.fileUrl}" style="color: #2563eb;">${a.fileName}</a>` : a.fileName}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${(a.fileSize / 1024).toFixed(0)} KB</td>
        </tr>`).join('')}</tbody>
      </table>
      <p style="font-size: 13px; color: #94a3b8;">גודל כולל: ${(totalSize / 1024).toFixed(0)} KB</p>
    </div>
    <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 12px; color: #94a3b8; text-align: center;">נשלח באמצעות PixelManageAI · סטודיו פיקסל</div>
    </div>
  </div>
</body>
</html>`;

    // ── Build file attachments for email ──
    const emailAttachments = attachments
      .filter((a: any) => a.accessible && a.fileUrl)
      .map((a: any) => ({
        filename: a.fileName,
        url: a.fileUrl,
        contentType: a.documentType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      }));

    // ── Send real email via Gmail SMTP ──
    const result = await sendEmail({
      to,
      subject,
      html: htmlBody,
      text: emailBody,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });

    return NextResponse.json({
      success: result.success,
      mock: result.mock || false,
      emailPreview: {
        to,
        subject,
        body: emailBody,
        attachments,
        inaccessibleCount: inaccessible.length,
        totalFiles: docs.length,
        totalSize,
        sentAt,
        periodName,
        year,
      },
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (error) {
    console.error("[SendToAccountant] Error:", error);
    return NextResponse.json(
      { error: "שגיאה בשליחה לרואה חשבון" },
      { status: 500 }
    );
  }
}
