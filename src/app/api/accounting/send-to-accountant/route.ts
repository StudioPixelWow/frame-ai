import { NextRequest, NextResponse } from "next/server";
import { clientFiles } from "@/lib/db";

const PERIODS: Record<string, string> = {
  "jan-feb": "ינואר-פברואר",
  "mar-apr": "מרץ-אפריל",
  "may-jun": "מאי-יוני",
  "jul-aug": "יולי-אוגוסט",
  "sep-oct": "ספטמבר-אוקטובר",
  "nov-dec": "נובמבר-דצמבר",
};

/**
 * POST /api/accounting/send-to-accountant
 *
 * Gathers all uploaded files for a given period + year,
 * validates they exist and have accessible URLs,
 * and sends (or simulates sending) an email to the accountant
 * with the actual files attached.
 *
 * Body: { period: string, year: number, accountantEmail?: string, message?: string }
 *
 * Returns: { success, emailPreview: { to, subject, body, attachments[] } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { period, year, accountantEmail, message } = body;

    if (!period || !year) {
      return NextResponse.json(
        { error: "חסר פרמטרים: period ו-year נדרשים" },
        { status: 400 }
      );
    }

    const periodName = PERIODS[period] || period;

    // ── Fetch all documents for this period ──
    const allFiles = await clientFiles.getAllAsync();
    const docs = allFiles.filter((f: any) => {
      if (f.category !== "accountant") return false;
      if (f.period && f.year) {
        return f.period === period && Number(f.year) === Number(year);
      }
      return false;
    });

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
