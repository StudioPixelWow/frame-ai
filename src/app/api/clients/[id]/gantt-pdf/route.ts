import { NextRequest, NextResponse } from "next/server";
import { clients, clientGanttItems } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";

const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

const STATUS_MAP: Record<string, string> = {
  draft: "טיוטה",
  planned: "מתוכנן",
  in_progress: "בעבודה",
  submitted_for_approval: "ממתין לאישור",
  returned_for_changes: "הוחזר לתיקון",
  approved: "מאושר",
  scheduled: "מתוזמן",
  published: "פורסם",
  cancelled: "בוטל",
};

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  ensureSeeded();
  const { id } = await context.params;
  const client = clients.getById(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const now = new Date();
  const month = parseInt(req.nextUrl.searchParams.get("month") || String(now.getMonth() + 1));
  const year = parseInt(req.nextUrl.searchParams.get("year") || String(now.getFullYear()));
  const type = req.nextUrl.searchParams.get("type") || "monthly";

  const monthName = HEB_MONTHS[month - 1] || "";

  let items;
  let title: string;

  if (type === "annual") {
    items = clientGanttItems.getAll().filter(
      (g) => g.clientId === client.id && g.ganttType === "annual" && g.year === year
    );
    title = `תכנון שנתי — ${year}`;
  } else {
    items = clientGanttItems.getAll().filter(
      (g) => g.clientId === client.id && g.month === month && g.year === year && g.ganttType !== "annual"
    );
    title = `גאנט חודשי — ${monthName} ${year}`;
  }

  const isAnnual = type === "annual";

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${client.name} - ${title}</title>
  <style>
    * { box-sizing: border-box; }
    @media print {
      body { padding: 20px !important; }
      .no-print { display: none !important; }
      @page { size: A4 landscape; margin: 15mm; }
    }
    body { font-family: Arial, 'Segoe UI', sans-serif; padding: 40px; direction: rtl; color: #1a1a2e; background: #fff; margin: 0; }
    .no-print { text-align: center; padding: 16px; background: #f0f9ff; border-bottom: 2px solid #00B5FE; margin: -40px -40px 30px -40px; }
    .no-print button { background: #00B5FE; color: white; border: none; padding: 10px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
    .no-print button:hover { background: #0099d6; }
    .no-print p { margin: 8px 0 0; font-size: 13px; color: #6b7280; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 3px solid #00B5FE; padding-bottom: 16px; }
    .client-name { font-size: 28px; font-weight: bold; color: #1a1a2e; }
    .subtitle { font-size: 17px; color: #6b7280; margin-top: 6px; }
    .meta { display: flex; justify-content: center; gap: 24px; margin-top: 10px; font-size: 13px; color: #9ca3af; }
    .gantt-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .gantt-table th { background: #00B5FE; color: white; padding: 10px 8px; text-align: right; font-size: 12px; white-space: nowrap; }
    .gantt-table td { padding: 9px 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; vertical-align: top; line-height: 1.5; }
    .gantt-table tr:nth-child(even) { background: #f8f9fa; }
    .gantt-table tr:hover { background: #f0f7ff; }
    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .status-draft { background: #f3f4f6; color: #6b7280; }
    .status-approved { background: #dcfce7; color: #16a34a; }
    .status-published { background: #dbeafe; color: #2563eb; }
    .status-scheduled { background: #e0e7ff; color: #4338ca; }
    .status-planned { background: #f0f9ff; color: #0284c7; }
    .status-in_progress { background: #fef3c7; color: #d97706; }
    .status-submitted_for_approval { background: #fef3c7; color: #d97706; }
    .status-returned_for_changes { background: #fff7ed; color: #ea580c; }
    .status-cancelled { background: #fee2e2; color: #dc2626; }
    .platform-badge { display: inline-block; padding: 1px 8px; border-radius: 8px; font-size: 10px; font-weight: 600; background: #f3e8ff; color: #7c3aed; }
    .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    .summary { display: flex; justify-content: center; gap: 32px; margin-bottom: 20px; }
    .summary-card { text-align: center; padding: 12px 20px; background: #f8f9fa; border-radius: 10px; border: 1px solid #e5e7eb; }
    .summary-card .num { font-size: 24px; font-weight: 700; color: #00B5FE; }
    .summary-card .label { font-size: 12px; color: #6b7280; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ שמור כ-PDF / הדפס</button>
    <p>לחץ על הכפתור או השתמש ב-Ctrl+P כדי לשמור כקובץ PDF</p>
  </div>
  <div class="header">
    <div class="client-name">${client.name}</div>
    <div class="subtitle">${title}</div>
    <div class="meta">
      <span>סה״כ פריטים: ${items.length}</span>
      <span>תחום: ${client.businessField || "—"}</span>
      <span>נוצר: ${new Date().toLocaleDateString("he-IL")}</span>
    </div>
  </div>

  <div class="summary">
    <div class="summary-card"><div class="num">${items.length}</div><div class="label">סה״כ פריטים</div></div>
    <div class="summary-card"><div class="num">${items.filter(i => i.status === "draft").length}</div><div class="label">טיוטות</div></div>
    <div class="summary-card"><div class="num">${items.filter(i => i.status === "approved" || i.status === "submitted_for_approval").length}</div><div class="label">מאושרים</div></div>
    <div class="summary-card"><div class="num">${items.filter(i => i.status === "published").length}</div><div class="label">פורסמו</div></div>
  </div>

  <table class="gantt-table">
    <thead>
      <tr>
        <th>#</th>
        ${isAnnual ? '<th>חודש</th>' : '<th>תאריך</th>'}
        <th>כותרת</th>
        ${isAnnual ? '<th>נושא החודש</th><th>קצב מומלץ</th><th>הזדמנויות</th>' : '<th>טקסט גרפי</th><th>כיתוב</th><th>פלטפורמה</th>'}
        <th>סטטוס</th>
      </tr>
    </thead>
    <tbody>
      ${items.length > 0 ? items.map((item, i) => {
        const statusClass = "status-" + (item.status || "draft");
        const statusText = STATUS_MAP[item.status || "draft"] || item.status || "טיוטה";
        if (isAnnual) {
          const mName = HEB_MONTHS[(item.month || 1) - 1] || "";
          return `<tr>
            <td>${i + 1}</td>
            <td><strong>${mName}</strong></td>
            <td>${item.title || ""}</td>
            <td>${(item as any).monthTheme || ""}</td>
            <td>${(item as any).suggestedRhythm || ""}</td>
            <td>${(item as any).keyOpportunities || ""}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          </tr>`;
        } else {
          const dateStr = item.date ? new Date(item.date).toLocaleDateString("he-IL") : "";
          const captionShort = (item.caption || "").substring(0, 80) + ((item.caption || "").length > 80 ? "..." : "");
          return `<tr>
            <td>${i + 1}</td>
            <td>${dateStr}</td>
            <td><strong>${item.title || ""}</strong></td>
            <td>${item.graphicText || ""}</td>
            <td style="max-width:180px">${captionShort}</td>
            <td><span class="platform-badge">${item.platform || ""}</span></td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          </tr>`;
        }
      }).join("") : '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:24px;">אין פריטים בגאנט</td></tr>'}
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
      "Content-Disposition": `inline; filename="gantt-${client.name}-${isAnnual ? year : monthName + "-" + year}.html"`,
    },
  });
}
