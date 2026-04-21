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

const FILE_TYPE_LABELS: Record<string, string> = {
  invoice: "חשבונית",
  receipt: "קבלה",
  report: "דוח",
  tax: "מס",
  other: "אחר",
};

export async function GET(req: NextRequest) {
  const periodId = req.nextUrl.searchParams.get("period") || "";
  const year = parseInt(req.nextUrl.searchParams.get("year") || String(new Date().getFullYear()));

  const periodName = PERIODS[periodId] || periodId;
  const title = `מסמכי רואה חשבון — ${periodName} ${year}`;

  // Query app_client_files filtered by category='accountant'
  const allFiles = await clientFiles.getAllAsync();
  const docs = allFiles.filter((f: any) => {
    if (f.category !== 'accountant') return false;
    if (f.period && f.year) {
      return f.period === periodId && Number(f.year) === year;
    }
    return false;
  });

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    @media print {
      body { padding: 20px !important; }
      .no-print { display: none !important; }
      @page { size: A4; margin: 15mm; }
    }
    body { font-family: Arial, 'Segoe UI', sans-serif; padding: 40px; direction: rtl; color: #1a1a2e; background: #fff; margin: 0; }
    .no-print { text-align: center; padding: 16px; background: #f0fdf4; border-bottom: 2px solid #10b981; margin: -40px -40px 30px -40px; }
    .no-print button { background: #10b981; color: white; border: none; padding: 10px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
    .no-print button:hover { background: #059669; }
    .no-print p { margin: 8px 0 0; font-size: 13px; color: #6b7280; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 3px solid #10b981; padding-bottom: 16px; }
    .header h1 { font-size: 24px; color: #1a1a2e; margin: 0 0 6px; }
    .header .sub { font-size: 14px; color: #6b7280; }
    .doc-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .doc-table th { background: #10b981; color: white; padding: 10px; text-align: right; font-size: 13px; }
    .doc-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
    .doc-table tr:nth-child(even) { background: #f8f9fa; }
    .type-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #ecfdf5; color: #059669; }
    .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    .summary { text-align: center; margin-bottom: 20px; font-size: 14px; color: #374151; }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ שמור כ-PDF / הדפס</button>
    <p>לחץ על הכפתור או השתמש ב-Ctrl+P כדי לשמור כקובץ PDF</p>
  </div>
  <div class="header">
    <h1>${title}</h1>
    <div class="sub">סטודיו פיקסל — דוח מסמכים לתקופה</div>
  </div>
  <div class="summary">סה״כ מסמכים בתקופה: <strong>${docs.length}</strong></div>
  <table class="doc-table">
    <thead>
      <tr><th>#</th><th>שם קובץ</th><th>סוג</th><th>הערות</th><th>תאריך העלאה</th></tr>
    </thead>
    <tbody>
      ${docs.length > 0 ? docs.map((doc: any, i: number) => {
        const dateStr = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("he-IL") : "";
        return `<tr>
          <td>${i + 1}</td>
          <td>${doc.fileName || ""}</td>
          <td><span class="type-badge">${FILE_TYPE_LABELS[doc.documentType] || doc.documentType || FILE_TYPE_LABELS[doc.fileType] || doc.fileType || ""}</span></td>
          <td>${doc.notes || "—"}</td>
          <td>${dateStr}</td>
        </tr>`;
      }).join("") : '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:24px;">אין מסמכים בתקופה זו</td></tr>'}
    </tbody>
  </table>
  <div class="footer">
    נוצר על ידי סטודיו פיקסל · PixelFrameAI · ${new Date().toLocaleDateString("he-IL")}
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="documents-${periodId}-${year}.html"`,
    },
  });
}
