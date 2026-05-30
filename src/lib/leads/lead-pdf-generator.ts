/**
 * Lead Research — Branded HTML/PDF Generator
 * Renders the FULL client-facing research report: scores, website, SEO/PageSpeed,
 * social (incl. deep per-platform analysis), Google presence, AI visibility,
 * a comprehensive competitor table, the full AI narrative report, and the quarter plan.
 * Branded with Studio Pixel. Hebrew RTL throughout.
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
  deepAnalysis?: any;
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

const PLATFORM_HE: Record<string, string> = {
  facebook: 'פייסבוק', instagram: 'אינסטגרם', linkedin: 'לינקדאין', tiktok: 'טיקטוק',
};

// Estimate PageSpeed from HTML facts when the record has no PageSpeed data.
function estimatePageSpeed(wf: any): any {
  if (!wf || !wf.title) return null;
  let perf = 100;
  const sizeKB = wf.pageSizeKB || 0;
  if (sizeKB > 5000) perf -= 35; else if (sizeKB > 3000) perf -= 25; else if (sizeKB > 1500) perf -= 15; else if (sizeKB > 800) perf -= 8;
  const js = wf.jsFileCount || 0;
  if (js > 20) perf -= 20; else if (js > 10) perf -= 12; else if (js > 5) perf -= 6;
  const css = wf.cssFileCount || 0;
  if (css > 10) perf -= 10; else if (css > 5) perf -= 5;
  const imgs = wf.imageCount || 0;
  if (!wf.hasLazyLoading && imgs > 15) perf -= 12; else if (!wf.hasLazyLoading && imgs > 5) perf -= 6;
  if (!wf.isHttps) perf -= 5;
  perf = Math.min(Math.max(perf, 10), 92);
  let acc = 90;
  if (!wf.hasMobileViewport) acc -= 25;
  if (!wf.detectedLanguages?.length) acc -= 10;
  if (imgs > 0 && !wf.ogImage) acc -= 5;
  acc = Math.min(Math.max(acc, 20), 95);
  let seoSc = 100;
  if (wf.title.length < 10 || wf.title.length > 70) seoSc -= 8;
  if (!wf.description) seoSc -= 15;
  if (!wf.h1) seoSc -= 12;
  if (!wf.hasMobileViewport) seoSc -= 15;
  if (!wf.isHttps) seoSc -= 10;
  if (!wf.canonical) seoSc -= 5;
  if (!wf.hasSchemaMarkup) seoSc -= 5;
  seoSc = Math.min(Math.max(seoSc, 20), 98);
  return { performanceScore: Math.round(perf), accessibilityScore: Math.round(acc), seoScore: Math.round(seoSc), estimated: true };
}

const yn = (v: any) => (v ? '✓' : '✗');
const ynColor = (v: any) => (v ? '#16a34a' : '#dc2626');

export function generateLeadResearchPdfHtml(options: PdfOptions): string {
  const { leadName, websiteUrl, scores, websiteFacts, socialPresence, googlePresence,
          seoAnalysis, geoAnalysis, competitorAnalysis, quarterPlan, report, deepAnalysis } = options;

  const wf = websiteFacts || {};
  const seo = seoAnalysis || {};
  const google = googlePresence || {};
  const geo = geoAnalysis || {};
  const social = socialPresence || {};
  const socialDeep = deepAnalysis?.socialDeepAnalysis || null;
  const overallScore = scores?.overall ?? 0;
  const grade = scores?.grade || gradeFromScore(overallScore);
  const date = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
  const pageSpeed = seo.pageSpeed || estimatePageSpeed(wf);

  // ── Reusable section header ──
  const sectionHeader = `
    <div class="header">
      <div class="header-logo">Studio Pixel | סטודיו פיקסל</div>
      <div class="header-info">${date}</div>
    </div>`;

  // ── Category scores ──
  const categoryScoresHtml = (scores?.categories?.length)
    ? `<div class="cat-grid">
        ${scores.categories.map((c: any) => `
          <div class="cat-card">
            <div class="cat-name">${escapeHtml(c.categoryHe || c.category)}</div>
            <div class="cat-score" style="color:${scoreColor(c.score)}">${c.score}</div>
            <div class="bar"><div class="bar-fill" style="width:${c.score}%;background:${scoreColor(c.score)}"></div></div>
            <div class="cat-grade">${escapeHtml(c.grade || '')}</div>
          </div>`).join('')}
       </div>`
    : '';

  // ── Website analysis ──
  const techChecks: Array<[string, any]> = [
    ['HTTPS מאובטח', wf.isHttps], ['מותאם למובייל', wf.hasMobileViewport],
    ['Schema Markup', wf.hasSchemaMarkup], ['Lazy Loading', wf.hasLazyLoading],
    ['Favicon', wf.hasFavicon], ['OG Image', wf.ogImage],
    ['Google Analytics', wf.hasGoogleAnalytics], ['טופס יצירת קשר', wf.hasContactForm],
    ['מספר טלפון', wf.hasPhoneNumber], ['WhatsApp', wf.hasWhatsApp], ['בלוג', wf.hasBlog],
  ];
  const websiteHtml = wf.title ? `
    <h2>ניתוח אתר</h2>
    ${wf.title ? `<p><strong>${escapeHtml(wf.title)}</strong></p>` : ''}
    ${wf.description ? `<p class="muted">${escapeHtml(wf.description)}</p>` : ''}
    <div class="check-grid">
      ${techChecks.map(([label, val]) => `
        <div class="check"><span style="color:${ynColor(val)};font-weight:700">${yn(val)}</span> ${escapeHtml(label)}</div>
      `).join('')}
    </div>
    <p class="muted">CMS: ${escapeHtml(wf.cms || 'לא זוהה')} · מילים: ${wf.wordCount ?? '—'} · תמונות: ${wf.imageCount ?? '—'} · לינקים פנימיים: ${wf.internalLinkCount ?? '—'} · גודל עמוד: ${wf.pageSizeKB ?? '—'}KB</p>
    ${seo.issues?.length ? `
      <h3>בעיות שזוהו (${seo.issues.length})</h3>
      <ul>${seo.issues.map((i: string) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
    ` : ''}
  ` : '';

  // ── PageSpeed ──
  const pageSpeedHtml = pageSpeed ? `
    <h2>ביצועי אתר — PageSpeed${pageSpeed.estimated ? ' <span class="badge">הערכה</span>' : ''}</h2>
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-value" style="color:${scoreColor(pageSpeed.performanceScore)}">${pageSpeed.performanceScore}</div><div class="metric-label">ביצועים</div></div>
      <div class="metric-card"><div class="metric-value" style="color:${scoreColor(pageSpeed.accessibilityScore)}">${pageSpeed.accessibilityScore}</div><div class="metric-label">נגישות</div></div>
      <div class="metric-card"><div class="metric-value" style="color:${scoreColor(pageSpeed.seoScore)}">${pageSpeed.seoScore}</div><div class="metric-label">SEO</div></div>
    </div>
    ${(pageSpeed.fcp || pageSpeed.lcp || pageSpeed.cls) ? `<p class="muted">FCP: ${escapeHtml(pageSpeed.fcp || '—')} · LCP: ${escapeHtml(pageSpeed.lcp || '—')} · CLS: ${escapeHtml(String(pageSpeed.cls ?? '—'))} · TBT: ${escapeHtml(pageSpeed.tbt || '—')}</p>` : ''}
  ` : '';

  // ── Social presence + deep analysis ──
  const platforms = ['facebook', 'instagram', 'linkedin', 'tiktok'];
  const socialHtml = `
    <h2>נוכחות ברשתות חברתיות</h2>
    ${platforms.map((p) => {
      const d = social[p] || {};
      return `<div class="platform-row">
        <span class="platform-status" style="color:${ynColor(d.found)}">${yn(d.found)}</span>
        <span class="platform-name">${PLATFORM_HE[p]}</span>
        <span class="platform-detail">${d.found
          ? `${d.followers != null ? `עוקבים: ${Number(d.followers).toLocaleString()} · ` : ''}${d.url ? escapeHtml(d.url) : ''}`
          : 'לא נמצא'}</span>
      </div>`;
    }).join('')}
    ${socialDeep ? `
      ${socialDeep.overallAssessment ? `<p>${escapeHtml(socialDeep.overallAssessment)}</p>` : ''}
      ${(socialDeep.platformAnalyses || []).map((pa: any) => `
        <div class="sub-card">
          <div class="sub-head">${escapeHtml(PLATFORM_HE[pa.platform] || pa.platform)}${pa.score != null ? ` <span style="color:${scoreColor(pa.score)}">${pa.score}/100</span>` : ''}</div>
          ${pa.analysis ? `<p>${escapeHtml(pa.analysis)}</p>` : ''}
          ${pa.recommendations?.length ? `<ul>${pa.recommendations.map((r: string) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
        </div>
      `).join('')}
      ${socialDeep.contentStrategy ? `<h3>אסטרטגיית תוכן</h3><p>${escapeHtml(socialDeep.contentStrategy)}</p>` : ''}
    ` : ''}
  `;

  // ── Google presence (correct field names) ──
  const googleHtml = `
    <h2>נוכחות בגוגל</h2>
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-value">${google.organic?.position ? '#' + google.organic.position : '—'}</div><div class="metric-label">מיקום אורגני</div></div>
      <div class="metric-card"><div class="metric-value" style="color:${ynColor(google.localPack?.found)}">${yn(google.localPack?.found)}</div><div class="metric-label">Local Pack / GBP</div></div>
      <div class="metric-card"><div class="metric-value">${google.reviews?.rating != null ? google.reviews.rating + '/5' : '—'}</div><div class="metric-label">ביקורות${google.reviews?.count ? ` (${google.reviews.count})` : ''}</div></div>
    </div>
    ${google.keywordResults?.length ? `
      <h3>מיקום במילות מפתח מסחריות</h3>
      <table>
        <tr><th>מילת מפתח</th><th>מיקום</th></tr>
        ${google.keywordResults.map((k: any) => `<tr><td>${escapeHtml(k.keyword)}</td><td>${k.found ? '#' + k.position : 'לא בעמוד הראשון'}</td></tr>`).join('')}
      </table>
    ` : ''}
  `;

  // ── AI visibility ──
  const aiHtml = geo?.platforms?.length ? `
    <h2>נראות במנועי AI</h2>
    <div class="score-hero" style="padding:20px">
      <div class="metric-value" style="font-size:42px;color:${scoreColor(geo.overallVisibility || 0)}">${geo.overallVisibility ?? 0}%</div>
      <div class="score-label">נראות כוללת במנועי AI</div>
    </div>
    ${geo.platforms.map((p: any) => `
      <div class="platform-row">
        <span class="platform-status" style="color:${ynColor(p.found)}">${yn(p.found)}</span>
        <span class="platform-name">${escapeHtml(p.platformName || p.platformId)}</span>
        <span class="platform-detail">${p.checked ? (p.found ? 'מוזכר' : 'לא מוזכר') : 'לא נבדק'}</span>
      </div>
    `).join('')}
  ` : '';

  // ── Competitor comparison (comprehensive) ──
  const competitorHtml = competitorAnalysis?.competitors?.length ? `
    <h2>ניתוח מתחרים</h2>
    ${competitorAnalysis.marketPosition ? `<p class="muted">מיקום בשוק: ${escapeHtml(competitorAnalysis.marketPosition)}</p>` : ''}
    <table>
      <tr><th>#</th><th>מתחרה</th><th>דומיין</th><th>מיקום בחיפוש</th><th>נראות משוערת</th></tr>
      ${competitorAnalysis.competitors.slice(0, 6).map((c: any, i: number) => {
        const pos = c.position ?? i + 1;
        const vis = Math.max(10, Math.round(100 - (pos - 1) * 18));
        return `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(c.name || c.domain || '')}${c.strengths?.[0] ? `<div class="muted small">${escapeHtml(c.strengths[0])}</div>` : ''}</td>
          <td dir="ltr" style="text-align:right;color:#00B5FE">${escapeHtml(c.domain || '')}</td>
          <td>#${pos}</td>
          <td><div class="bar inline"><div class="bar-fill" style="width:${vis}%;background:${scoreColor(vis)}"></div></div> ${vis}</td>
        </tr>`;
      }).join('')}
    </table>
  ` : '';

  // ── FULL AI narrative report (the core — was previously missing entirely) ──
  const reportHtml = report?.sections?.length ? `
    <div class="page-break"></div>
    ${sectionHeader}
    <h1 style="font-size:24px">דוח מחקר מלא</h1>
    ${report.sections.map((s: any) => `
      <h2>${escapeHtml(s.titleHe || s.title || '')}</h2>
      ${(s.content || []).map((b: any) => `<p>${escapeHtml(typeof b === 'string' ? b : (b?.text || ''))}</p>`).join('')}
    `).join('')}
  ` : '';

  // ── Quarter plan ──
  const quarterHtml = quarterPlan?.goals?.length ? `
    <div class="page-break"></div>
    ${sectionHeader}
    <h2>תוכנית צמיחה רבעונית — ${escapeHtml(quarterPlan.quarter || '90 יום')}</h2>
    ${quarterPlan.goals.map((g: any) => `
      <h3>${escapeHtml(g.titleHe || g.title)}</h3>
      <p class="muted">מדד: ${escapeHtml(g.metric || '')} | נוכחי: ${escapeHtml(String(g.currentValue ?? ''))} → יעד: ${escapeHtml(String(g.targetValue ?? ''))}</p>
      ${g.actions?.length ? `
        <table>
          <tr><th>שבוע</th><th>פעולה</th><th>אחראי</th></tr>
          ${g.actions.map((a: any) => `<tr><td>${a.week}</td><td>${escapeHtml(a.actionHe || a.action)}</td><td>${escapeHtml(a.responsible || '')}</td></tr>`).join('')}
        </table>
      ` : ''}
    `).join('')}
    ${quarterPlan.estimatedROI ? `<p><strong>ROI משוער:</strong> ${escapeHtml(quarterPlan.estimatedROI)}</p>` : ''}
  ` : '';

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דוח מחקר דיגיטלי — ${escapeHtml(leadName)} | Studio Pixel</title>
  <style>
    @page { size: A4; margin: 16mm; }
    @media print {
      .page-break { page-break-before: always; }
      body { background: #fff !important; }
      .container { max-width: none !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Arial', sans-serif;
      direction: rtl; color: #1a1a2e; line-height: 1.7; background: #eef1f5;
    }
    .container {
      max-width: 860px; margin: 28px auto; padding: 36px 44px 56px;
      background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 0; border-bottom: 3px solid #00B5FE; margin-bottom: 20px;
    }
    .header-logo { font-size: 18px; font-weight: 800; color: #00B5FE; }
    .header-info { font-size: 11px; color: #666; text-align: left; }

    h1 { font-size: 28px; color: #1a1a2e; margin: 14px 0; }
    h2 { font-size: 19px; color: #00B5FE; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    h3 { font-size: 15px; color: #1a1a2e; margin: 16px 0 8px; }
    p { margin: 9px 0; font-size: 13.5px; }
    ul { margin: 8px 24px; font-size: 13px; color: #444; }
    li { margin: 4px 0; }
    .muted { color: #6b7280; font-size: 12.5px; }
    .small { font-size: 11px; }
    .subtitle { font-size: 16px; color: #666; margin-bottom: 20px; }
    .badge { font-size: 11px; font-weight: 600; color: #f97316; background: #f9731620; padding: 2px 8px; border-radius: 10px; vertical-align: middle; }

    .score-hero { text-align: center; padding: 28px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-radius: 12px; margin: 20px 0; }
    .score-circle { display: inline-block; width: 110px; height: 110px; border-radius: 50%; line-height: 110px; font-size: 40px; font-weight: 800; color: #fff; }
    .score-grade { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-top: 8px; }
    .score-label { font-size: 13px; color: #666; }

    .cat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
    .cat-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 8px; text-align: center; }
    .cat-name { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
    .cat-score { font-size: 26px; font-weight: 800; }
    .cat-grade { font-size: 11px; font-weight: 700; color: #6b7280; margin-top: 2px; }
    .bar { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-top: 6px; }
    .bar.inline { display: inline-block; width: 70px; vertical-align: middle; margin: 0 0 0 6px; }
    .bar-fill { height: 100%; border-radius: 3px; }

    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 14px 0; }
    .metric-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
    .metric-value { font-size: 26px; font-weight: 700; color: #00B5FE; }
    .metric-label { font-size: 11.5px; color: #666; margin-top: 4px; }

    .check-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; margin: 12px 0; }
    .check { font-size: 12.5px; }

    .platform-row { display: flex; align-items: center; padding: 7px 0; border-bottom: 1px solid #f0f0f0; gap: 12px; }
    .platform-status { font-size: 16px; font-weight: 700; min-width: 18px; }
    .platform-name { font-weight: 600; min-width: 90px; font-size: 13px; }
    .platform-detail { font-size: 12px; color: #666; direction: ltr; text-align: right; }

    .sub-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin: 10px 0; background: #fcfcfd; }
    .sub-head { font-weight: 700; font-size: 13.5px; margin-bottom: 4px; }

    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { background: #f0f9ff; color: #00B5FE; font-weight: 600; text-align: right; }
    th, td { padding: 9px 12px; font-size: 12.5px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }

    .cta-page { background: #00B5FE; color: #fff; text-align: center; padding: 48px 36px; border-radius: 12px; margin-top: 36px; }
    .cta-title { font-size: 28px; font-weight: 800; margin-bottom: 14px; }
    .cta-subtitle { font-size: 16px; margin-bottom: 28px; opacity: 0.92; }
    .cta-button { display: inline-block; background: #F0FF02; color: #1a1a2e; font-size: 18px; font-weight: 700; padding: 14px 44px; border-radius: 8px; text-decoration: none; }
    .cta-contact { font-size: 15px; margin-top: 18px; }
    .cta-contact a { color: #F0FF02; text-decoration: none; }
    .footer { text-align: center; padding: 16px 0; font-size: 11px; color: #999; border-top: 1px solid #e5e7eb; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">Studio Pixel | סטודיו פיקסל</div>
      <div class="header-info">${date}<br/>${escapeHtml(websiteUrl)}</div>
    </div>

    <h1>דוח מחקר דיגיטלי</h1>
    <div class="subtitle">${escapeHtml(leadName)} — ניתוח מצב נוכחי ותוכנית צמיחה</div>

    <div class="score-hero">
      <div class="score-circle" style="background: ${scoreColor(overallScore)}">${overallScore}</div>
      <div class="score-grade">ציון ${grade}</div>
      <div class="score-label">ציון דיגיטלי כולל מתוך 100${scores?.confidence != null ? ` · רמת ביטחון ${scores.confidence}%` : ''}</div>
    </div>

    ${categoryScoresHtml}

    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-value">${seo.technicalScore ?? '—'}</div><div class="metric-label">SEO טכני</div></div>
      <div class="metric-card"><div class="metric-value">${seo.contentScore ?? '—'}</div><div class="metric-label">ציון תוכן</div></div>
      <div class="metric-card"><div class="metric-value">${geo.overallVisibility ?? '—'}%</div><div class="metric-label">נראות AI</div></div>
    </div>

    ${websiteHtml}
    ${pageSpeedHtml}

    <div class="page-break"></div>
    ${sectionHeader}
    ${socialHtml}
    ${googleHtml}
    ${aiHtml}
    ${competitorHtml}

    ${reportHtml}
    ${quarterHtml}

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

    <div class="footer">דוח זה הופק אוטומטית על ידי מערכת PIXEL MANAGE AI | Studio Pixel © ${new Date().getFullYear()}</div>
  </div>
</body>
</html>`;
}
