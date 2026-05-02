/**
 * PDF Report Generator
 *
 * Generates premium RTL Hebrew PDF reports as HTML strings.
 * The HTML is then converted to PDF via the API route using
 * a headless browser or returned as downloadable HTML.
 *
 * Design principles:
 *   - Clean, professional layout
 *   - Hebrew RTL support throughout
 *   - System logo header
 *   - Date, client name, business name
 *   - Graceful handling of missing data
 */

import type { Report, ReportData, ReportType } from '@/lib/db/schema';

// ── Shared Styles ────────────────────────────────────────────────────

const COLORS = {
  primary: '#00B5FE',
  primaryDark: '#0090cc',
  text: '#1a1a2e',
  textMuted: '#64748b',
  border: '#e2e8f0',
  surface: '#f8fafc',
  white: '#ffffff',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
};

function baseStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 20mm; }
    body {
      font-family: 'Segoe UI', 'Arial', 'Helvetica Neue', sans-serif;
      direction: rtl;
      text-align: right;
      color: ${COLORS.text};
      font-size: 11pt;
      line-height: 1.6;
      background: ${COLORS.white};
    }
    .page-break { page-break-before: always; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 3px solid ${COLORS.primary};
      margin-bottom: 24px;
    }
    .header-logo {
      font-size: 22pt;
      font-weight: 800;
      color: ${COLORS.primary};
      letter-spacing: -0.5px;
    }
    .header-meta {
      text-align: left;
      font-size: 9pt;
      color: ${COLORS.textMuted};
    }
    .report-title {
      font-size: 18pt;
      font-weight: 700;
      color: ${COLORS.text};
      margin-bottom: 4px;
    }
    .report-subtitle {
      font-size: 10pt;
      color: ${COLORS.textMuted};
      margin-bottom: 24px;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 13pt;
      font-weight: 700;
      color: ${COLORS.primaryDark};
      padding-bottom: 6px;
      border-bottom: 1px solid ${COLORS.border};
      margin-bottom: 12px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .metric-card {
      background: ${COLORS.surface};
      border: 1px solid ${COLORS.border};
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .metric-value {
      font-size: 16pt;
      font-weight: 700;
      color: ${COLORS.text};
    }
    .metric-label {
      font-size: 8pt;
      color: ${COLORS.textMuted};
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 9pt;
    }
    th {
      background: ${COLORS.surface};
      border: 1px solid ${COLORS.border};
      padding: 8px 10px;
      text-align: right;
      font-weight: 600;
      color: ${COLORS.textMuted};
    }
    td {
      border: 1px solid ${COLORS.border};
      padding: 6px 10px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 8pt;
      font-weight: 600;
    }
    .badge-success { background: rgba(34,197,94,0.12); color: ${COLORS.success}; }
    .badge-warning { background: rgba(245,158,11,0.12); color: ${COLORS.warning}; }
    .badge-danger { background: rgba(239,68,68,0.12); color: ${COLORS.danger}; }
    .list-item {
      padding: 6px 0;
      border-bottom: 1px solid ${COLORS.border};
      font-size: 10pt;
    }
    .list-item:last-child { border-bottom: none; }
    .highlight-box {
      background: ${COLORS.surface};
      border: 1px solid ${COLORS.border};
      border-right: 4px solid ${COLORS.primary};
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .executive-summary {
      background: linear-gradient(135deg, rgba(0,181,254,0.05), rgba(0,181,254,0.02));
      border: 1px solid rgba(0,181,254,0.15);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      font-size: 11pt;
      line-height: 1.7;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 8pt;
      color: ${COLORS.textMuted};
      padding: 8px 20mm;
      border-top: 1px solid ${COLORS.border};
    }
    .no-data-msg {
      background: rgba(245,158,11,0.08);
      border: 1px solid rgba(245,158,11,0.2);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      color: ${COLORS.warning};
      font-weight: 600;
      font-size: 12pt;
      margin: 40px 0;
    }
  `;
}

// ── Format Helpers ───────────────────────────────────────────────────

function fCurrency(n: number): string {
  if (!n) return '₪0';
  return '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 });
}

function fPercent(n: number): string {
  return n.toFixed(1) + '%';
}

function fNumber(n: number): string {
  return n.toLocaleString('he-IL');
}

function fDate(d: string): string {
  const date = new Date(d);
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function statusBadge(status: string): string {
  const map: Record<string, { cls: string; label: string }> = {
    active: { cls: 'badge-success', label: 'פעיל' },
    draft: { cls: 'badge-warning', label: 'טיוטה' },
    paused: { cls: 'badge-warning', label: 'מושהה' },
    completed: { cls: 'badge-success', label: 'הושלם' },
    approved: { cls: 'badge-success', label: 'מאושר' },
    rejected: { cls: 'badge-danger', label: 'נדחה' },
  };
  const info = map[status] || { cls: '', label: status };
  return `<span class="badge ${info.cls}">${info.label}</span>`;
}

// ── Report Header ────────────────────────────────────────────────────

function renderHeader(report: Report): string {
  return `
    <div class="header">
      <div>
        <div class="header-logo">PixelFrame AI</div>
      </div>
      <div class="header-meta">
        <div>${fDate(report.createdAt)}</div>
        <div>${report.clientName}</div>
      </div>
    </div>
  `;
}

// ── Insufficient Data Message ────────────────────────────────────────

function renderNoData(): string {
  return `<div class="no-data-msg">לא קיימים מספיק נתונים להפקת דוח מלא</div>`;
}

// ── Metrics Grid ─────────────────────────────────────────────────────

function renderMetricsGrid(data: ReportData): string {
  const metrics = [
    { label: 'הוצאה כוללת', value: fCurrency(data.totalSpend) },
    { label: 'לידים', value: fNumber(data.totalLeads) },
    { label: 'CPL', value: data.avgCpl > 0 ? fCurrency(data.avgCpl) : '—' },
    { label: 'CTR', value: data.avgCtr > 0 ? fPercent(data.avgCtr) : '—' },
  ];
  return `
    <div class="metrics-grid">
      ${metrics.map(m => `
        <div class="metric-card">
          <div class="metric-value">${m.value}</div>
          <div class="metric-label">${m.label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Campaign Report HTML ─────────────────────────────────────────────

function renderCampaignReport(report: Report): string {
  const data = report.data;
  const cs = data.campaignSummary;

  let html = renderHeader(report);
  html += `<div class="report-title">${report.title}</div>`;
  html += `<div class="report-subtitle">תקופה: ${fDate(report.periodStart)} — ${fDate(report.periodEnd)}</div>`;

  if (!data.hasEnoughData) {
    html += renderNoData();
    return wrapHtml(html);
  }

  // Metrics
  html += renderMetricsGrid(data);

  // Campaign summary
  if (cs) {
    html += `
      <div class="section">
        <div class="section-title">סיכום קמפיין</div>
        <div class="highlight-box">
          <strong>${cs.name}</strong> &nbsp; ${statusBadge(cs.status)} &nbsp;
          <span style="color:${COLORS.textMuted}; font-size:9pt">${cs.platform} • ${cs.adSetsCount} קבוצות מודעות • ${cs.adsCount} מודעות</span>
        </div>
      </div>
    `;
  }

  // Best performing ad
  if (data.bestPerformingAd) {
    const ba = data.bestPerformingAd;
    html += `
      <div class="section">
        <div class="section-title">🏆 מודעה מובילה</div>
        <div class="highlight-box">
          <strong>${ba.name}</strong>
          ${ba.headline ? `<div style="color:${COLORS.textMuted}; font-size:9pt; margin-top:4px">${ba.headline}</div>` : ''}
          <div style="margin-top:8px; font-size:10pt">
            לידים: <strong>${ba.leads}</strong> &nbsp;|&nbsp;
            CTR: <strong>${fPercent(ba.ctr * 100)}</strong> &nbsp;|&nbsp;
            CPL: <strong>${fCurrency(ba.cpl)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  // Ad Sets table
  if (data.adSetSummaries && data.adSetSummaries.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">קבוצות מודעות</div>
        <table>
          <thead><tr>
            <th>שם</th><th>סטטוס</th><th>מודעות</th><th>הוצאה</th><th>לידים</th><th>CPL</th>
          </tr></thead>
          <tbody>
            ${data.adSetSummaries.map(as => `
              <tr>
                <td>${as.name}</td>
                <td>${statusBadge(as.status)}</td>
                <td>${as.adsCount}</td>
                <td>${fCurrency(as.spend)}</td>
                <td>${as.leads}</td>
                <td>${as.cpl > 0 ? fCurrency(as.cpl) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Ad Performance table
  if (data.adPerformance && data.adPerformance.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">ביצועי מודעות</div>
        <table>
          <thead><tr>
            <th>שם</th><th>סטטוס</th><th>חשיפות</th><th>קליקים</th><th>הוצאה</th><th>לידים</th><th>CTR</th><th>CPL</th>
          </tr></thead>
          <tbody>
            ${data.adPerformance.map(ad => `
              <tr>
                <td>${ad.name}</td>
                <td>${statusBadge(ad.status)}</td>
                <td>${fNumber(ad.impressions)}</td>
                <td>${fNumber(ad.clicks)}</td>
                <td>${fCurrency(ad.spend)}</td>
                <td>${ad.leads}</td>
                <td>${ad.ctr > 0 ? fPercent(ad.ctr * 100) : '—'}</td>
                <td>${ad.cpl > 0 ? fCurrency(ad.cpl) : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Weak points
  if (data.weakPoints.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">⚠️ נקודות חולשה</div>
        ${data.weakPoints.map(w => `<div class="list-item">• ${w}</div>`).join('')}
      </div>
    `;
  }

  // Actions taken
  if (data.actionsTaken.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">✅ פעולות שבוצעו</div>
        ${data.actionsTaken.map(a => `<div class="list-item">• ${a}</div>`).join('')}
      </div>
    `;
  }

  // Pending actions
  if (data.pendingActions.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">⏳ פעולות ממתינות</div>
        ${data.pendingActions.map(a => `<div class="list-item">• ${a}</div>`).join('')}
      </div>
    `;
  }

  // Recommendations (internal only)
  if (data.recommendations.length > 0 && report.mode === 'internal') {
    html += `
      <div class="section">
        <div class="section-title">💡 המלצות AI</div>
        ${data.recommendations.map(r => `<div class="list-item">• ${r}</div>`).join('')}
      </div>
    `;
  }

  return wrapHtml(html);
}

// ── Client Monthly Report HTML ───────────────────────────────────────

function renderClientMonthlyReport(report: Report): string {
  const data = report.data;

  let html = renderHeader(report);
  html += `<div class="report-title">${report.title}</div>`;
  html += `<div class="report-subtitle">תקופה: ${fDate(report.periodStart)} — ${fDate(report.periodEnd)}</div>`;

  if (!data.hasEnoughData) {
    html += renderNoData();
    return wrapHtml(html);
  }

  // Executive Summary
  if (data.executiveSummary) {
    html += `
      <div class="section">
        <div class="section-title">סיכום מנהלים</div>
        <div class="executive-summary">${data.executiveSummary}</div>
      </div>
    `;
  }

  // Metrics
  const metrics = [
    { label: 'הוצאה כוללת', value: fCurrency(data.totalSpend) },
    { label: 'לידים', value: fNumber(data.totalLeads) },
    { label: 'קמפיינים פעילים', value: String(data.campaignsActive || 0) },
    { label: 'אישורים שהושלמו', value: String(data.approvalsCompleted || 0) },
  ];
  html += `
    <div class="metrics-grid">
      ${metrics.map(m => `
        <div class="metric-card">
          <div class="metric-value">${m.value}</div>
          <div class="metric-label">${m.label}</div>
        </div>
      `).join('')}
    </div>
  `;

  // Best ad
  if (data.bestPerformingAd) {
    const ba = data.bestPerformingAd;
    html += `
      <div class="section">
        <div class="section-title">🏆 מודעה מובילה</div>
        <div class="highlight-box">
          <strong>${ba.name}</strong>
          ${ba.headline ? `<div style="color:${COLORS.textMuted}; font-size:9pt">${ba.headline}</div>` : ''}
          <div style="margin-top:8px; font-size:10pt">
            לידים: <strong>${ba.leads}</strong> &nbsp;|&nbsp; CPL: <strong>${fCurrency(ba.cpl)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  // Work completed
  if (data.actionsTaken.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">✅ עבודה שבוצעה</div>
        ${data.actionsTaken.map(a => `<div class="list-item">• ${a}</div>`).join('')}
      </div>
    `;
  }

  // Weak points
  if (data.weakPoints.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">⚠️ נקודות לשיפור</div>
        ${data.weakPoints.map(w => `<div class="list-item">• ${w}</div>`).join('')}
      </div>
    `;
  }

  // Pending approvals
  if ((data.approvalsPending || 0) > 0) {
    html += `
      <div class="section">
        <div class="section-title">⏳ ממתינים לאישורכם</div>
        <div class="highlight-box">
          <strong>${data.approvalsPending}</strong> פעולות ממתינות לאישור
        </div>
      </div>
    `;
  }

  // Next month recommendations
  if (data.nextMonthRecommendations && data.nextMonthRecommendations.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">📅 המלצות לחודש הבא</div>
        ${data.nextMonthRecommendations.map(r => `<div class="list-item">• ${r}</div>`).join('')}
      </div>
    `;
  }

  return wrapHtml(html);
}

// ── Internal Manager Report HTML ─────────────────────────────────────

function renderManagerReport(report: Report): string {
  const data = report.data;

  let html = renderHeader(report);
  html += `<div class="report-title">${report.title}</div>`;
  html += `<div class="report-subtitle">דוח פנימי — ${fDate(report.periodStart)} — ${fDate(report.periodEnd)}</div>`;

  if (!data.hasEnoughData) {
    html += renderNoData();
    return wrapHtml(html);
  }

  // Client health
  const healthColor = data.clientHealth === 'טוב' ? COLORS.success
    : data.clientHealth === 'דורש תשומת לב' ? COLORS.warning
    : COLORS.danger;

  html += `
    <div class="section">
      <div class="section-title">🏥 בריאות לקוח</div>
      <div class="highlight-box" style="border-right-color: ${healthColor}">
        <span style="font-size:14pt; font-weight:700; color:${healthColor}">${data.clientHealth || '—'}</span>
      </div>
    </div>
  `;

  // Metrics
  html += renderMetricsGrid(data);

  // Budget waste risks
  if (data.budgetWasteRisks && data.budgetWasteRisks.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">💸 סיכוני בזבוז תקציב</div>
        ${data.budgetWasteRisks.map(r => `<div class="list-item" style="color:${COLORS.danger}">• ${r}</div>`).join('')}
      </div>
    `;
  }

  // Pending approvals
  if (data.pendingActions.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">⏳ ממתינים לאישור (${data.pendingActions.length})</div>
        ${data.pendingActions.slice(0, 10).map(a => `<div class="list-item">• ${a}</div>`).join('')}
        ${data.pendingActions.length > 10 ? `<div class="list-item" style="color:${COLORS.textMuted}">+ ${data.pendingActions.length - 10} נוספים</div>` : ''}
      </div>
    `;
  }

  // Automation actions
  if (data.automationActions && data.automationActions.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">🤖 פעולות אוטומציה</div>
        ${data.automationActions.map(a => `<div class="list-item">• ${a}</div>`).join('')}
      </div>
    `;
  }

  // Employee follow-ups
  if (data.employeeFollowUps && data.employeeFollowUps.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">📌 מעקב נדרש</div>
        ${data.employeeFollowUps.map(f => `<div class="list-item" style="font-weight:600">• ${f}</div>`).join('')}
      </div>
    `;
  }

  // Executive summary
  if (data.executiveSummary) {
    html += `
      <div class="section">
        <div class="section-title">סיכום</div>
        <div class="executive-summary">${data.executiveSummary}</div>
      </div>
    `;
  }

  return wrapHtml(html);
}

// ── HTML Wrapper ─────────────────────────────────────────────────────

function wrapHtml(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PixelFrame AI Report</title>
  <style>${baseStyles()}</style>
</head>
<body>
  ${bodyContent}
  <div class="footer">
    הופק אוטומטית על ידי PixelFrame AI &nbsp;|&nbsp; כל הזכויות שמורות
  </div>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────

export function generateReportHtml(report: Report): string {
  switch (report.type) {
    case 'campaign':
      return renderCampaignReport(report);
    case 'client_monthly':
      return renderClientMonthlyReport(report);
    case 'internal_manager':
      return renderManagerReport(report);
    default:
      return wrapHtml(`<div class="no-data-msg">סוג דוח לא מוכר</div>`);
  }
}
