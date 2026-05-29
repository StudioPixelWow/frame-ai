/**
 * Lead Research — Branded PDF Generator
 * Generates HTML-based PDF for lead research reports.
 * Branded with Studio Pixel logo, colors, and CTA page.
 * Hebrew RTL throughout.
 */

export interface PdfOptions {
  leadName: string;
  websiteUrl: string;
  scores: any;
  websiteFacts: any;
  socialPresence: any;
  googlePresence: any;
  seoAnalysis: any;
  geoAnalysis: any;
  competitorAnalysis: any;
  salesOpportunities: any[];
  quarterPlan: any;
  report: any;
}

function escapeHtml(text: string): string {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

export function generateLeadResearchPdfHtml(options: PdfOptions): string {
  const { leadName, websiteUrl, scores, websiteFacts, socialPresence, googlePresence,
          seoAnalysis, geoAnalysis, competitorAnalysis, salesOpportunities, quarterPlan, report } = options;

  const overallScore = scores?.overall ?? 0;
  const grade = scores?.grade || gradeFromScore(overallScore);
  const date = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דוח מחקר דיגיטלי — ${escapeHtml(leadName)} | Studio Pixel</title>
  <style>
    @page { size: A4; margin: 20mm; }
    @media print {
      .page-break { page-break-before: always; }
      .no-print { display: none !important; }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Arial', sans-serif;
      direction: rtl;
      color: #1a1a2e;
      line-height: 1.6;
      background: #fff;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 3px solid #00B5FE;
      margin-bottom: 24px;
    }
    .header-logo {
      font-size: 18px;
      font-weight: 800;
      color: #00B5FE;
      letter-spacing: -0.5px;
    }
    .header-info {
      font-size: 11px;
      color: #666;
      text-align: left;
    }

    h1 { font-size: 28px; color: #1a1a2e; margin: 16px 0; }
    h2 { font-size: 20px; color: #00B5FE; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    h3 { font-size: 16px; color: #1a1a2e; margin: 16px 0 8px; }
    p { margin: 8px 0; font-size: 14px; }

    .subtitle { font-size: 16px; color: #666; margin-bottom: 24px; }

    .score-hero {
      text-align: center;
      padding: 32px;
      background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
      border-radius: 12px;
      margin: 24px 0;
    }
    .score-circle {
      display: inline-block;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      line-height: 120px;
      font-size: 42px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 8px;
    }
    .score-grade {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a2e;
      margin-top: 8px;
    }
    .score-label { font-size: 14px; color: #666; }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 16px 0;
    }
    .metric-card {
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .metric-value {
      font-size: 28px;
      font-weight: 700;
      color: #00B5FE;
    }
    .metric-label {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }

    .opp-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin: 12px 0;
      border-right: 4px solid #00B5FE;
    }
    .opp-card.critical { border-right-color: #ef4444; }
    .opp-card.high { border-right-color: #f97316; }
    .opp-card.medium { border-right-color: #eab308; }
    .opp-card.low { border-right-color: #22c55e; }
    .opp-service { font-size: 16px; font-weight: 700; color: #1a1a2e; }
    .opp-reason { font-size: 13px; color: #555; margin: 6px 0; }
    .opp-evidence { font-size: 12px; color: #888; }
    .opp-pitch { font-size: 13px; color: #333; margin-top: 8px; font-style: italic; }
    .opp-value { font-size: 14px; font-weight: 600; color: #00B5FE; }

    .platform-row {
      display: flex;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
      gap: 12px;
    }
    .platform-name { font-weight: 600; min-width: 120px; }
    .platform-status { font-size: 18px; }
    .platform-detail { font-size: 13px; color: #666; }

    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { background: #f0f9ff; color: #00B5FE; font-weight: 600; text-align: right; }
    th, td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #e5e7eb; }

    .cta-page {
      background: #00B5FE;
      color: #fff;
      text-align: center;
      padding: 60px 40px;
      border-radius: 12px;
      margin-top: 40px;
    }
    .cta-title {
      font-size: 32px;
      font-weight: 800;
      margin-bottom: 16px;
    }
    .cta-subtitle {
      font-size: 18px;
      margin-bottom: 32px;
      opacity: 0.9;
    }
    .cta-button {
      display: inline-block;
      background: #F0FF02;
      color: #1a1a2e;
      font-size: 20px;
      font-weight: 700;
      padding: 16px 48px;
      border-radius: 8px;
      text-decoration: none;
      margin-bottom: 24px;
    }
    .cta-contact {
      font-size: 16px;
      margin-top: 16px;
    }
    .cta-contact a { color: #F0FF02; text-decoration: none; }

    .footer {
      text-align: center;
      padding: 16px 0;
      font-size: 11px;
      color: #999;
      border-top: 1px solid #e5e7eb;
      margin-top: 32px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-logo">Studio Pixel | סטודיו פיקסל</div>
    <div class="header-info">${date}<br/>${escapeHtml(websiteUrl)}</div>
  </div>

  <!-- Title -->
  <h1>דוח מחקר דיגיטלי</h1>
  <div class="subtitle">${escapeHtml(leadName)} — ניתוח מצב נוכחי ותוכנית צמיחה</div>

  <!-- Overall Score -->
  <div class="score-hero">
    <div class="score-circle" style="background: ${scoreColor(overallScore)}">${overallScore}</div>
    <div class="score-grade">ציון ${grade}</div>
    <div class="score-label">ציון דיגיטלי כולל מתוך 100</div>
  </div>

  <!-- Key Metrics -->
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-value">${seoAnalysis?.technicalScore ?? '—'}</div>
      <div class="metric-label">ציון SEO טכני</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${seoAnalysis?.contentScore ?? '—'}</div>
      <div class="metric-label">ציון תוכן</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${geoAnalysis?.overallVisibility ?? '—'}%</div>
      <div class="metric-label">נראות AI</div>
    </div>
  </div>

  <!-- Section: Social Presence -->
  <div class="page-break"></div>
  <div class="header">
    <div class="header-logo">Studio Pixel | סטודיו פיקסל</div>
    <div class="header-info">${date}</div>
  </div>

  <h2>נוכחות ברשתות חברתיות</h2>
  ${socialPresence ? `
    <div class="platform-row">
      <span class="platform-status">${socialPresence.facebook?.found ? '✅' : '❌'}</span>
      <span class="platform-name">Facebook</span>
      <span class="platform-detail">${socialPresence.facebook?.url ? escapeHtml(socialPresence.facebook.url) : 'לא נמצא'}</span>
    </div>
    <div class="platform-row">
      <span class="platform-status">${socialPresence.instagram?.found ? '✅' : '❌'}</span>
      <span class="platform-name">Instagram</span>
      <span class="platform-detail">${socialPresence.instagram?.url ? escapeHtml(socialPresence.instagram.url) : 'לא נמצא'}</span>
    </div>
    <div class="platform-row">
      <span class="platform-status">${socialPresence.linkedin?.found ? '✅' : '❌'}</span>
      <span class="platform-name">LinkedIn</span>
      <span class="platform-detail">${socialPresence.linkedin?.url ? escapeHtml(socialPresence.linkedin.url) : 'לא נמצא'}</span>
    </div>
    <div class="platform-row">
      <span class="platform-status">${socialPresence.tiktok?.found ? '✅' : '❌'}</span>
      <span class="platform-name">TikTok</span>
      <span class="platform-detail">${socialPresence.tiktok?.url ? escapeHtml(socialPresence.tiktok.url) : 'לא נמצא'}</span>
    </div>
  ` : '<p>לא בוצעה סריקת רשתות חברתיות</p>'}

  <!-- Section: Google Presence -->
  <h2>נוכחות בגוגל</h2>
  ${googlePresence ? `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value">${googlePresence.gbpFound ? '✅' : '❌'}</div>
        <div class="metric-label">Google Business Profile</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${googlePresence.gbpRating ? googlePresence.gbpRating + '/5' : '—'}</div>
        <div class="metric-label">דירוג</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${googlePresence.gbpReviewCount ?? '—'}</div>
        <div class="metric-label">ביקורות</div>
      </div>
    </div>
    ${googlePresence.organicResults?.length ? `
      <h3>תוצאות אורגניות</h3>
      <table>
        <tr><th>שאילתה</th><th>מיקום</th></tr>
        ${googlePresence.organicResults.map((r: any) => `<tr><td>${escapeHtml(r.query)}</td><td>${r.position}</td></tr>`).join('')}
      </table>
    ` : ''}
  ` : '<p>לא בוצעה בדיקת גוגל</p>'}

  <!-- Section: AI Visibility -->
  <div class="page-break"></div>
  <div class="header">
    <div class="header-logo">Studio Pixel | סטודיו פיקסל</div>
    <div class="header-info">${date}</div>
  </div>

  <h2>נראות במנועי AI</h2>
  ${geoAnalysis ? `
    <div class="score-hero" style="padding: 20px;">
      <div class="metric-value" style="font-size: 48px;">${geoAnalysis.overallVisibility}%</div>
      <div class="score-label">נראות כוללת במנועי AI</div>
    </div>
    ${geoAnalysis.platforms?.map((p: any) => `
      <div class="platform-row">
        <span class="platform-status">${p.found ? '✅' : '❌'}</span>
        <span class="platform-name">${escapeHtml(p.platformName || p.platformId)}</span>
        <span class="platform-detail">${p.found ? 'מוזכר' : 'לא מוזכר'}</span>
      </div>
    `).join('') || ''}
  ` : '<p>לא בוצעה בדיקת נראות AI</p>'}

  <!-- Section: Competitors -->
  ${competitorAnalysis?.competitors?.length ? `
    <h2>ניתוח מתחרים</h2>
    <table>
      <tr><th>מתחרה</th><th>דומיין</th><th>חפיפה</th></tr>
      ${competitorAnalysis.competitors.slice(0, 5).map((c: any) => `
        <tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.domain)}</td><td>${c.overlapScore || '—'}%</td></tr>
      `).join('')}
    </table>
  ` : ''}

  <!-- Section: Sales Opportunities -->
  <div class="page-break"></div>
  <div class="header">
    <div class="header-logo">Studio Pixel | סטודיו פיקסל</div>
    <div class="header-info">${date}</div>
  </div>

  <h2>הזדמנויות צמיחה</h2>
  ${salesOpportunities?.length ? salesOpportunities.map((opp: any) => `
    <div class="opp-card ${typeof opp.priority === 'number' ? (opp.priority <= 1 ? 'critical' : opp.priority <= 2 ? 'high' : opp.priority <= 4 ? 'medium' : 'low') : opp.priority}">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div class="opp-service">${escapeHtml(opp.serviceHe)}</div>
        <div class="opp-value">₪${(opp.estimatedValue || 0).toLocaleString()}</div>
      </div>
      <div class="opp-reason">${escapeHtml(opp.reasonHe)}</div>
      <div class="opp-pitch">${escapeHtml(opp.pitch)}</div>
      <div class="opp-evidence">${(Array.isArray(opp.evidence) ? opp.evidence : [opp.evidence || opp.evidenceHe]).filter(Boolean).map((e: string) => escapeHtml(e)).join(' • ')}</div>
    </div>
  `).join('') : '<p>לא זוהו הזדמנויות ספציפיות</p>'}

  <!-- Section: Quarter Plan -->
  ${quarterPlan?.goals?.length ? `
    <div class="page-break"></div>
    <div class="header">
      <div class="header-logo">Studio Pixel | סטודיו פיקסל</div>
      <div class="header-info">${date}</div>
    </div>

    <h2>תוכנית צמיחה רבעונית — ${escapeHtml(quarterPlan.quarter || '90 יום')}</h2>
    ${quarterPlan.goals.map((g: any) => `
      <h3>${escapeHtml(g.titleHe || g.title)}</h3>
      <p>מדד: ${escapeHtml(g.metric || '')} | נוכחי: ${escapeHtml(g.currentValue || '')} → יעד: ${escapeHtml(g.targetValue || '')}</p>
      ${g.actions?.length ? `
        <table>
          <tr><th>שבוע</th><th>פעולה</th><th>אחראי</th></tr>
          ${g.actions.map((a: any) => `<tr><td>${a.week}</td><td>${escapeHtml(a.actionHe || a.action)}</td><td>${escapeHtml(a.responsible || '')}</td></tr>`).join('')}
        </table>
      ` : ''}
    `).join('')}
    ${quarterPlan.estimatedROI ? `<p><strong>ROI משוער:</strong> ${escapeHtml(quarterPlan.estimatedROI)}</p>` : ''}
  ` : ''}

  <!-- CTA Page -->
  <div class="page-break"></div>
  <div class="cta-page">
    <div class="cta-title">בואו נהפוך את הנתונים לתוצאות</div>
    <div class="cta-subtitle">הצוות של Studio Pixel מוכן להתחיל לעבוד על הצמיחה הדיגיטלית שלכם</div>
    <a href="https://s-pixel.co.il" class="cta-button">תיאום פגישת ייעוץ חינם</a>
    <div class="cta-contact">
      <p>054-636-5333</p>
      <p><a href="https://s-pixel.co.il">s-pixel.co.il</a></p>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    דוח זה הופק אוטומטית על ידי מערכת PIXEL MANAGE AI | Studio Pixel © ${new Date().getFullYear()}
  </div>
</body>
</html>`;
}
