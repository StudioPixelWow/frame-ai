import { NextRequest, NextResponse } from "next/server";
import { clientFiles } from "@/lib/db";

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
    const emailBody = [
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

    // ── In production: send via SMTP/SendGrid with real attachments ──
    // For now, return the full email preview so the UI can display it
    // TODO: Integrate with email service (SendGrid/Resend/Nodemailer)
    //
    // Production implementation would:
    // 1. Fetch each fileUrl as a blob
    // 2. Attach to email via SendGrid/Resend API
    // 3. Send to accountantEmail

    return NextResponse.json({
      success: true,
      mock: true, // Flag: real email not yet configured
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
    });
  } catch (error) {
    console.error("[SendToAccountant] Error:", error);
    return NextResponse.json(
      { error: "שגיאה בשליחה לרואה חשבון" },
      { status: 500 }
    );
  }
}
