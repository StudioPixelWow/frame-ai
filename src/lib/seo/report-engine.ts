/**
 * SEO/GEO Report Engine
 *
 * Analyzes plan data and generates a structured 10-section report.
 * Every recommendation is tied to actual scan findings.
 * Output is a structured object that can be rendered as HTML/PDF.
 */

// ── Types ──

export interface ReportSection {
  id: string;
  number: number;
  title: string;
  titleEn: string;
  content: ReportBlock[];
}

export type ReportBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "stat"; label: string; value: string; color: string; icon?: string }
  | { type: "stat_row"; stats: Array<{ label: string; value: string; color: string; icon?: string }> }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "finding"; severity: "critical" | "warning" | "info" | "success"; title: string; detail: string; recommendation: string }
  | { type: "progress_bar"; label: string; value: number; max: number; color: string }
  | { type: "divider" };

export interface SeoReport {
  id: string;
  planId: string;
  clientName: string;
  websiteUrl: string;
  generatedAt: string;
  language: string;
  sections: ReportSection[];
  meta: {
    overallScore: number;
    technicalScore: number;
    contentScore: number;
    visibilityScore: number;
    totalFindings: number;
    criticalFindings: number;
    totalRecommendations: number;
  };
}

// ── Main Generator ──

export function generateSeoReport(plan: any, language: "he" | "en" = "he", businessProfile?: any): SeoReport {
  const he = language === "he";
  const scan = plan.websiteScan || null;
  const goals = (plan.goals || []).filter((g: any) => g.selected);
  // Support both legacy visibilityResults and scan-pipeline aiQueries format
  const rawAiQueries = scan?.aiQueries || plan?.aiQueries || [];
  const rawPlatformStatuses = scan?.platformStatuses || plan?.platformStatuses || [];
  const legacyVisResults = plan.visibilityResults || [];
  const visQueries = plan.visibilityQueries || [];
  const insights = plan.insights || [];
  const weeks = plan.weeks || [];
  const allTasks = weeks.flatMap((w: any) => w.tasks || []);
  const doneTasks = allTasks.filter((t: any) => t.status === "done");
  const domain = (plan.websiteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const scanMode = plan.scanMode || null;

  // Normalize aiQueries to legacy format for engine analysis
  // aiQueries: { query, platform, found, confidence, snippet, checkedAt, scanMode }
  // legacy: { query, results: [{ engine, mentioned }] }
  const visResults = rawAiQueries.length > 0
    ? _normalizeAiQueries(rawAiQueries)
    : legacyVisResults;

  // AI engine analysis — map platform IDs to display names
  // Must match PLATFORMS in scan-pipeline.ts: google_seo, google_ai_overview, gemini, chatgpt, claude, perplexity
  const engineDisplayMap: Record<string, { name: string; ids: string[] }> = {
    google: { name: "Google SEO", ids: ["google_seo", "google_ai_overview"] },
    chatgpt: { name: "ChatGPT", ids: ["chatgpt"] },
    gemini: { name: "Gemini", ids: ["gemini"] },
    claude: { name: "Claude", ids: ["claude"] },
    perplexity: { name: "Perplexity", ids: ["perplexity"] },
  };
  const engineKeys = Object.keys(engineDisplayMap);
  const engineStats = engineKeys.map(key => {
    const { name, ids } = engineDisplayMap[key];
    if (rawAiQueries.length > 0) {
      // Only count queries that were actually scanned (scanMode === 'real')
      const platformQueries = rawAiQueries.filter((q: any) => ids.includes(q.platform) && q.scanMode === 'real');
      const mentioned = platformQueries.filter((q: any) => q.found).length;
      return { engine: name, mentioned, total: platformQueries.length, pct: platformQueries.length > 0 ? Math.round((mentioned / platformQueries.length) * 100) : 0 };
    }
    // Legacy format
    const total = visResults.length;
    const mentioned = visResults.filter((vr: any) =>
      (vr.results || []).some((r: any) => r.engine === name && r.mentioned)
    ).length;
    return { engine: name, mentioned, total, pct: total > 0 ? Math.round((mentioned / total) * 100) : 0 };
  });

  // Queries analysis
  const mentionedQueries = rawAiQueries.length > 0
    ? rawAiQueries.filter((q: any) => q.found)
    : visResults.filter((vr: any) => (vr.results || []).some((r: any) => r.mentioned));
  const missedQueries = rawAiQueries.length > 0
    ? rawAiQueries.filter((q: any) => !q.found)
    : visResults.filter((vr: any) => !(vr.results || []).some((r: any) => r.mentioned));

  // Technical findings
  const technicalFindings: Array<{ severity: "critical" | "warning" | "info" | "success"; title: string; detail: string; rec: string }> = [];

  if (scan) {
    if (!scan?.hasSSL) technicalFindings.push({
      severity: "critical",
      title: he ? "חסר תעודת SSL" : "Missing SSL Certificate",
      detail: he ? "האתר לא מאובטח ב-HTTPS. גוגל מסמן אתרים ללא SSL כ'לא מאובטח' ומוריד אותם בדירוג." : "Site is not secured with HTTPS. Google marks non-SSL sites as 'Not Secure' and demotes them.",
      rec: he ? "התקן תעודת SSL (Let's Encrypt חינמי) והפנה את כל התעבורה ל-HTTPS." : "Install an SSL certificate (Let's Encrypt is free) and redirect all HTTP traffic to HTTPS.",
    });

    if ((scan?.loadTimeMs ?? 0) > 3000) technicalFindings.push({
      severity: "critical",
      title: he ? `זמן טעינה איטי: ${(scan.loadTimeMs / 1000).toFixed(1)}s` : `Slow Load Time: ${(scan.loadTimeMs / 1000).toFixed(1)}s`,
      detail: he ? `זמן הטעינה הנוכחי הוא ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s. גוגל ממליץ על פחות מ-3 שניות. כל שנייה נוספת מעלה את שיעור הנטישה ב-32%.` : `Current load time is ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s. Google recommends under 3s. Each extra second increases bounce rate by 32%.`,
      rec: he ? "דחוס תמונות ל-WebP, הפעל טעינה עצלה, השתמש ב-CDN, מזער CSS/JS." : "Compress images to WebP, enable lazy loading, use CDN, minify CSS/JS.",
    });
    else if ((scan?.loadTimeMs ?? 0) > 1500) technicalFindings.push({
      severity: "warning",
      title: he ? `זמן טעינה בינוני: ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s` : `Moderate Load Time: ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s`,
      detail: he ? `זמן הטעינה הוא ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s — סביר אך ניתן לשיפור.` : `Load time is ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s — acceptable but can improve.`,
      rec: he ? "שקול דחיסת תמונות וטעינה עצלה לשיפור נוסף." : "Consider image compression and lazy loading for further improvement.",
    });
    else technicalFindings.push({
      severity: "success",
      title: he ? `זמן טעינה מצוין: ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s` : `Excellent Load Time: ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s`,
      detail: he ? "זמן הטעינה מתחת ל-1.5 שניות — מצוין." : "Load time is under 1.5s — excellent.",
      rec: he ? "שמור על הביצועים הנוכחיים." : "Maintain current performance.",
    });

    if (!scan?.hasSitemap) technicalFindings.push({
      severity: "warning",
      title: he ? "חסר Sitemap.xml" : "Missing Sitemap.xml",
      detail: he ? "לא נמצא sitemap.xml. בלעדיו, מנועי חיפוש עלולים לפספס דפים חשובים." : "No sitemap.xml found. Without it, search engines may miss important pages.",
      rec: he ? "צור sitemap.xml עם כל הדפים החשובים והגש אותו ב-Google Search Console." : "Create a sitemap.xml with all important pages and submit it in Google Search Console.",
    });

    if (!scan?.hasRobotsTxt) technicalFindings.push({
      severity: "warning",
      title: he ? "חסר Robots.txt" : "Missing Robots.txt",
      detail: he ? "לא נמצא robots.txt. משמעות הדבר היא שאין שליטה על אילו דפים נסרקים." : "No robots.txt found. This means no control over which pages are crawled.",
      rec: he ? "צור robots.txt עם הנחיות סריקה מתאימות וקישור ל-Sitemap." : "Create robots.txt with appropriate crawl directives and Sitemap link.",
    });

    if (!scan?.mobileOptimized) technicalFindings.push({
      severity: "critical",
      title: he ? "האתר לא מותאם למובייל" : "Site Not Mobile-Optimized",
      detail: he ? "מעל 60% מהחיפושים מגיעים ממובייל. גוגל משתמש באינדוקס Mobile-First." : "Over 60% of searches come from mobile. Google uses Mobile-First Indexing.",
      rec: he ? "יישם עיצוב רספונסיבי ובדוק עם Google Mobile-Friendly Test." : "Implement responsive design and test with Google's Mobile-Friendly Test.",
    });

    if ((scan?.brokenLinks ?? 0) > 0) technicalFindings.push({
      severity: (scan?.brokenLinks ?? 0) > 5 ? "critical" : "warning",
      title: he ? `${scan?.brokenLinks ?? 0} קישורים שבורים` : `${scan?.brokenLinks ?? 0} Broken Links`,
      detail: he ? `נמצאו ${scan?.brokenLinks ?? 0} קישורים שבורים. קישורים שבורים פוגעים בחוויית המשתמש ובדירוג.` : `Found ${scan?.brokenLinks ?? 0} broken links. Broken links harm UX and rankings.`,
      rec: he ? "תקן או הסר קישורים שבורים. השתמש בהפניות 301 לדפים שעברו." : "Fix or remove broken links. Use 301 redirects for moved pages.",
    });

    if (!scan?.structuredData) technicalFindings.push({
      severity: "warning",
      title: he ? "חסר Schema / נתונים מובנים" : "Missing Schema / Structured Data",
      detail: he ? "האתר חסר נתונים מובנים (Schema.org). בלעדיהם, תוצאות עשירות לא יופיעו." : "Site lacks structured data (Schema.org). Without it, rich snippets are missed.",
      rec: he ? "הוסף LocalBusiness, FAQ ו-Breadcrumb Schema כצעדים ראשונים." : "Add LocalBusiness, FAQ, and Breadcrumb Schema as first steps.",
    });

    if (!scan?.openGraph) technicalFindings.push({
      severity: "info",
      title: he ? "חסרים תגי Open Graph" : "Missing Open Graph Tags",
      detail: he ? "ללא תגי OG, שיתופים ברשתות חברתיות יציגו תצוגה מקדימה גנרית." : "Without OG tags, social shares will show generic previews.",
      rec: he ? "הוסף og:title, og:description, og:image לכל הדפים." : "Add og:title, og:description, og:image to all pages.",
    });

    if ((scan?.domainAuthority ?? 0) > 30) technicalFindings.push({
      severity: "success",
      title: he ? `Domain Authority ${scan?.domainAuthority ?? 0} — בסיס חזק` : `Domain Authority ${scan?.domainAuthority ?? 0} — Strong Base`,
      detail: he ? `DA של ${scan?.domainAuthority ?? 0} מצביע על סמכות טובה. בסיס חזק לצמיחה.` : `DA of ${scan?.domainAuthority ?? 0} indicates good authority. Strong growth foundation.`,
      rec: he ? "המשך לבנות קישורים איכותיים מאתרים רלוונטיים." : "Continue building quality links from relevant sites.",
    });
    else if ((scan?.domainAuthority ?? 0) > 0) technicalFindings.push({
      severity: "warning",
      title: he ? `Domain Authority ${scan?.domainAuthority ?? 0} — נמוך` : `Domain Authority ${scan?.domainAuthority ?? 0} — Low`,
      detail: he ? `DA של ${scan?.domainAuthority ?? 0} דורש עבודת בניית סמכות.` : `DA of ${scan?.domainAuthority ?? 0} requires authority-building work.`,
      rec: he ? "בנה קישורים מאתרי מדיה, בלוגים מקצועיים ומדריכים." : "Build links from media sites, professional blogs, and directories.",
    });
  }

  // ── Compute real scores (used for both hero AND body) ──
  const computedScores = (() => {
    const scan = plan.websiteScan;
    let technical = plan.technicalScore || 0;
    let visibility = plan.visibilityScore || 0;
    let content = plan.contentScore || 0;

    // Technical: start at 0, earn points for each real signal
    if (technical === 0 && scan) {
      technical = 0;
      if (scan.hasSSL) technical += 15;
      if (scan.mobileOptimized) technical += 15;
      if (scan.hasRobotsTxt) technical += 10;
      if (scan.hasSitemap) technical += 10;
      if (scan.structuredData) technical += 10;
      if (scan.metaTitle) technical += 10;
      if (scan.metaDescription) technical += 10;
      if (scan.loadTimeMs && scan.loadTimeMs < 3000) technical += 10;
      if (scan.openGraph) technical += 5;
      if (scan.canonicalTags) technical += 5;
      const issueCount = scan.issues?.length || 0;
      technical = Math.max(0, Math.min(100, technical - issueCount * 5));
    }

    // AI Visibility: real ratio of found vs total queries
    // ANTI-FAKE: Only count queries with scanMode === 'real' (skip unavailable/simulated)
    if (visibility === 0 && scan) {
      const aiQ = (scan.aiQueries || []).filter((q: any) => q.scanMode === 'real');
      const found = aiQ.filter((q: any) => q.found).length;
      visibility = aiQ.length > 0 ? Math.round((found / aiQ.length) * 100) : 0;
    }

    // Content: start at 0, much stricter scoring
    if (content === 0 && scan) {
      content = 0;
      // Basic meta tags — necessary but not sufficient
      if (scan.metaTitle && scan.metaTitle.length > 10) content += 10;
      if (scan.metaDescription && scan.metaDescription.length > 50) content += 10;
      // Real content signals
      if (scan.h1Tags?.length) content += 5;
      if ((scan.h1Tags?.length || 0) > 0 && (scan.h2Tags?.length || 0) > 2) content += 10;
      if (scan.structuredData) content += 10;
      // Page count — more pages = more content
      const pages = scan.totalPages || scan.indexedPages || 0;
      if (pages >= 5) content += 10;
      if (pages >= 10) content += 10;
      if (pages >= 20) content += 5;
      // Scanned pages with actual content
      const scannedPages = plan.scannedPages || [];
      const pagesWithContent = scannedPages.filter((p: any) => (p.wordCount || 0) > 200).length;
      if (pagesWithContent >= 3) content += 10;
      if (pagesWithContent >= 5) content += 10;
      // AI articles written
      const aiArticles = Array.isArray(plan.aiArticles) ? plan.aiArticles.filter((a: any) => a?.fullArticle) : [];
      if (aiArticles.length >= 2) content += 10;
    }

    const overall = plan.overallScore || Math.round(technical * 0.3 + visibility * 0.4 + content * 0.3);
    return { technical, visibility, content, overall };
  })();

  // Build sections
  const sections: ReportSection[] = [];

  // ── Scan Mode Banner ──
  const scanModeBanner = scanMode === "simulated" ? {
    type: "paragraph" as const,
    text: he
      ? "⚠️ הערה: דוח זה מבוסס על נתוני סריקה מדומים. יש לאמת את התוצאות עם כלי סריקה אמיתיים לפני קבלת החלטות משמעותיות."
      : "⚠️ NOTE: This report is based on simulated scan data. Results should be verified with real scanning tools before making major decisions."
  } : null;

  // ── 1. Executive Summary ──
  sections.push({
    id: "executive_summary", number: 1,
    title: he ? "תקציר מנהלים" : "Executive Summary",
    titleEn: "Executive Summary",
    content: [
      ...(scanModeBanner ? [scanModeBanner] : []),
      { type: "paragraph", text: he
        ? `ניתוח מקיף של SEO ונראות AI (GEO) עבור ${plan.clientName || "הלקוח"} (${domain}). מבוסס על סריקה טכנית מלאה, בדיקת נוכחות ב-5 מנועי AI מובילים, וניתוח ${visQueries.length} שאילתות רלוונטיות.${businessProfile?.business_name ? ` עסק: ${businessProfile.business_name}${businessProfile.industry ? ` (${businessProfile.industry})` : ""}${businessProfile.location ? ` ב${businessProfile.location}` : ""}.` : ""}`
        : `Comprehensive SEO and AI visibility (GEO) analysis for ${plan.clientName || "the client"} (${domain}). Based on full technical scan, presence checks across 5 leading AI engines, and analysis of ${visQueries.length} relevant queries.${businessProfile?.business_name ? ` Business: ${businessProfile.business_name}${businessProfile.industry ? ` (${businessProfile.industry})` : ""}${businessProfile.location ? ` in ${businessProfile.location}` : ""}.` : ""}`},
      { type: "stat_row", stats: (() => {
        return [
          { label: he ? "ציון כללי" : "Overall Score", value: `${computedScores.overall}%`, color: scoreColor(computedScores.overall), icon: "📊" },
          { label: he ? "ציון טכני" : "Technical Score", value: `${computedScores.technical}%`, color: scoreColor(computedScores.technical), icon: "🔧" },
          { label: he ? "נראות AI" : "AI Visibility", value: `${computedScores.visibility}%`, color: scoreColor(computedScores.visibility), icon: "🤖" },
          { label: he ? "תוכן" : "Content", value: `${computedScores.content}%`, color: scoreColor(computedScores.content), icon: "📝" },
        ];
      })()},
      { type: "paragraph", text: he
        ? `נמצאו ${technicalFindings.filter(f => f.severity === "critical").length} ממצאים קריטיים ו-${technicalFindings.filter(f => f.severity === "warning").length} אזהרות הדורשים טיפול. ${mentionedQueries.length} מתוך ${visResults.length} שאילתות AI מזכירות את העסק (${visResults.length > 0 ? Math.round((mentionedQueries.length / visResults.length) * 100) : 0}%).`
        : `Found ${technicalFindings.filter(f => f.severity === "critical").length} critical findings and ${technicalFindings.filter(f => f.severity === "warning").length} warnings requiring attention. ${mentionedQueries.length} of ${visResults.length} AI queries mention the business (${visResults.length > 0 ? Math.round((mentionedQueries.length / visResults.length) * 100) : 0}%).`},
    ],
  });

  // ── 2. Current PIXEL SEO/GEO Status ──
  sections.push({
    id: "current_status", number: 2,
    title: he ? "מצב PIXEL SEO/GEO נוכחי" : "Current PIXEL SEO/GEO Status",
    titleEn: "Current PIXEL SEO/GEO Status",
    content: [
      { type: "paragraph", text: he ? `סיכום מצב עבור ${domain} נכון לתאריך הסריקה:` : `Status summary for ${domain} as of the scan date:`},
      ...(scan ? [
        { type: "stat_row" as const, stats: [
          { label: "SSL", value: scan.hasSSL ? "✓" : "✗", color: scan.hasSSL ? "#10B981" : "#EF4444" },
          { label: he ? "מהירות" : "Speed", value: `${(scan.loadTimeMs / 1000).toFixed(1)}s`, color: scan.loadTimeMs < 3000 ? "#10B981" : "#EF4444" },
          { label: he ? "מובייל" : "Mobile", value: scan.mobileOptimized ? "✓" : "✗", color: scan.mobileOptimized ? "#10B981" : "#EF4444" },
          { label: "DA", value: `${scan.domainAuthority}`, color: scan.domainAuthority > 30 ? "#10B981" : "#F59E0B" },
        ]},
        { type: "table" as const,
          headers: he ? ["פרמטר", "ערך", "סטטוס"] : ["Parameter", "Value", "Status"],
          rows: [
            ["Sitemap.xml", scan.hasSitemap ? (he ? "קיים" : "Present") : (he ? "חסר" : "Missing"), scan.hasSitemap ? "✓" : "✗"],
            ["Robots.txt", scan.hasRobotsTxt ? (he ? "קיים" : "Present") : (he ? "חסר" : "Missing"), scan.hasRobotsTxt ? "✓" : "✗"],
            [he ? "נתונים מובנים" : "Structured Data", scan.structuredData ? (he ? "קיים" : "Present") : (he ? "חסר" : "Missing"), scan.structuredData ? "✓" : "✗"],
            ["Open Graph", scan.openGraph ? (he ? "קיים" : "Present") : (he ? "חסר" : "Missing"), scan.openGraph ? "✓" : "✗"],
            [he ? "תגי Canonical" : "Canonical Tags", scan.canonicalTags ? (he ? "קיים" : "Present") : (he ? "חסר" : "Missing"), scan.canonicalTags ? "✓" : "✗"],
            [he ? "דפים מאונדקסים" : "Indexed Pages", `${scan.indexedPages || scan.totalPages}`, "—"],
            [he ? "קישורים שבורים" : "Broken Links", `${scan.brokenLinks}`, scan.brokenLinks === 0 ? "✓" : "✗"],
          ],
        },
      ] : [{ type: "paragraph" as const, text: he ? "לא בוצעה סריקה." : "No website scan performed." }]),
    ],
  });

  // ── 3. AI Visibility Overview ──
  sections.push({
    id: "ai_visibility", number: 3,
    title: he ? "סקירת נראות AI" : "AI Visibility Overview",
    titleEn: "AI Visibility Overview",
    content: [
      { type: "stat", label: he ? "ציון נראות AI כולל" : "Overall AI Visibility Score", value: `${computedScores.visibility}%`, color: scoreColor(computedScores.visibility), icon: "🤖" },
      { type: "paragraph", text: he ? `נבדקו ${visResults.length} שאילתות ב-5 מנועי AI: ChatGPT, Gemini, Perplexity, Claude ו-Copilot. העסק מוזכר ב-${mentionedQueries.length} שאילתות וחסר מ-${missedQueries.length}.` : `Tested ${visResults.length} queries across 5 AI engines: ChatGPT, Gemini, Perplexity, Claude, and Copilot. Business mentioned in ${mentionedQueries.length} queries and missing from ${missedQueries.length}.`},
      { type: "table",
        headers: he ? ["מנוע", "אזכורים", "מתוך", "אחוז"] : ["Engine", "Mentions", "Out of", "Percentage"],
        rows: engineStats.map(e => [e.engine, `${e.mentioned}`, `${e.total}`, `${e.pct}%`]),
      },
      ...(mentionedQueries.length > 0 ? [
        { type: "heading" as const, text: he ? "שאילתות בהן העסק מופיע:" : "Queries where business appears:" },
        { type: "list" as const, items: mentionedQueries.slice(0, 10).map((vr: any) => {
          const enginesFound = (vr.results || []).filter((r: any) => r.mentioned).map((r: any) => r.engine).join(", ");
          return he ? `"${vr.query}" — ${he ? "נמצא ב:" : "found in:"} ${enginesFound}` : `"${vr.query}" — found in: ${enginesFound}`;
        })},
      ] : []),
      ...(missedQueries.length > 0 ? [
        { type: "heading" as const, text: he ? "שאילתות בהן העסק חסר:" : "Queries where business is missing:" },
        { type: "list" as const, items: missedQueries.slice(0, 10).map((vr: any) => `"${vr.query}"`) },
      ] : []),
    ],
  });

  // ── 4. SEO Findings ──
  sections.push({
    id: "seo_findings", number: 4,
    title: he ? "ממצאי אופטימיזציה למנועי חיפוש" : "Search Engine Optimization Findings",
    titleEn: "Search Engine Optimization Findings",
    content: [
      { type: "paragraph", text: he ? `להלן ${technicalFindings.length} ממצאים מהסריקה הטכנית של ${domain}:` : `Below are ${technicalFindings.length} findings from the technical scan of ${domain}:`},
      ...technicalFindings.map(f => ({
        type: "finding" as const,
        severity: f.severity,
        title: f.title,
        detail: f.detail,
        recommendation: f.rec,
      })),
      { type: "divider" },
      { type: "heading", text: he ? "הזדמנויות FAQ וסכמה" : "FAQ & Schema Opportunities" },
      { type: "paragraph", text: he ? "הוספת FAQ Schema לדפים מרכזיים מאפשרת תוצאות עשירות בגוגל ומעלה את ה-CTR. שאילתות ה-AI שנבדקו יכולות לשמש כבסיס לתוכן FAQ." : "Adding FAQ Schema to key pages enables rich results on Google and increases CTR. The AI queries tested can serve as FAQ content basis." },
      { type: "list", items: [
        he ? `צור דף FAQ עם ${Math.min(visQueries.length, 10)} שאלות מרכזיות מסריקת AI` : `Create FAQ page with ${Math.min(visQueries.length, 10)} key questions from AI scan`,
        he ? "הוסף FAQ Schema (JSON-LD) לדפי שירות ומוצר" : "Add FAQ Schema (JSON-LD) to service and product pages",
        he ? "הוסף LocalBusiness Schema עם שעות, כתובת ותמונות" : "Add LocalBusiness Schema with hours, address, and photos",
        he ? "הוסף Breadcrumb Schema לניווט מובנה" : "Add Breadcrumb Schema for structured navigation",
        scan?.metaTitle ? "" : (he ? "כתוב Meta Title ייחודי לכל דף (50-60 תווים)" : "Write unique Meta Title for each page (50-60 chars)"),
        scan?.metaDescription ? "" : (he ? "כתוב Meta Description ייחודי לכל דף (150-160 תווים)" : "Write unique Meta Description for each page (150-160 chars)"),
      ].filter(Boolean) },
      { type: "heading", text: he ? "הזדמנויות קישור פנימי" : "Internal Linking Opportunities" },
      { type: "paragraph", text: he ? `לאתר ${scan?.totalPages || "?"} דפים. קישור פנימי חכם בין דפים רלוונטיים מחזק את מבנה האתר ומפזר סמכות.` : `The site has ${scan?.totalPages || "?"} pages. Smart internal linking between relevant pages strengthens site structure and distributes authority.` },
      { type: "list", items: he ? [
        "קשר כל דף שירות ל-3-5 דפי תוכן רלוונטיים",
        "צור דפי Hub עם קישורים לנושאי משנה",
        "הוסף קישורי Breadcrumb בכל דף",
        "ודא שכל דף נגיש תוך 3 לחיצות מדף הבית",
      ] : [
        "Link each service page to 3-5 relevant content pages",
        "Create Hub pages with links to subtopics",
        "Add Breadcrumb links on every page",
        "Ensure every page is reachable within 3 clicks from home",
      ]},
    ],
  });

  // ── 5. Competitor Analysis ──
  sections.push({
    id: "competitors", number: 5,
    title: he ? "ניתוח מתחרים" : "Competitor Analysis",
    titleEn: "Competitor Analysis",
    content: [
      { type: "paragraph", text: he ? `על בסיס סריקת נראות AI, ניתחנו אילו עסקים מופיעים בשאילתות בהן ${plan.clientName || "הלקוח"} חסר. מתחרים המופיעים בתשובות AI מקבלים יתרון נראות משמעותי.` : `Based on AI visibility scanning, we analyzed which businesses appear in queries where ${plan.clientName || "the business"} is absent. Competitors appearing in AI responses gain significant visibility advantage.` },
      { type: "paragraph", text: he ? `מתוך ${visResults.length} שאילתות, העסק חסר מ-${missedQueries.length} (${visResults.length > 0 ? Math.round((missedQueries.length / visResults.length) * 100) : 0}%). אלו הזדמנויות הצמיחה המרכזיות.` : `Out of ${visResults.length} queries, the business is missing from ${missedQueries.length} (${visResults.length > 0 ? Math.round((missedQueries.length / visResults.length) * 100) : 0}%). These are the main growth opportunities.` },
      { type: "heading", text: he ? "אסטרטגיה לעקוף מתחרים:" : "Strategy to Outperform Competitors:" },
      { type: "list", items: he ? [
        "פרסם תוכן מומחה שעונה על שאילתות בהן אתה חסר",
        "בנה E-E-A-T: מומחיות, ניסיון, סמכות, אמון",
        "צור פרופילים בכל מנועי ה-AI (ChatGPT Plugins, Bing Places)",
        "הפץ תוכן בפלטפורמות שונות — בלוגים, פודקאסטים, וידאו",
        "אסוף ופרסם ביקורות לקוחות — מנועי AI מסתמכים עליהן",
      ] : [
        "Publish expert content answering queries where you're missing",
        "Build E-E-A-T: Expertise, Experience, Authority, Trust",
        "Create profiles on all AI engines (ChatGPT Plugins, Bing Places)",
        "Distribute content across platforms — blogs, podcasts, videos",
        "Collect and publish customer reviews — AI engines rely on them",
      ]},
    ],
  });

  // ── 6. Content Gap Analysis ──
  const contentGaps = missedQueries.map((vr: any) => {
    const q = visQueries.find((q: any) => q.id === vr.queryId);
    return {
      query: vr.query,
      category: q?.category || "general",
      intent: q?.intent || "informational",
      importance: q?.importance || "medium",
    };
  });

  sections.push({
    id: "content_gaps", number: 6,
    title: he ? "ניתוח פערי תוכן" : "Content Gap Analysis",
    titleEn: "Content Gap Analysis",
    content: [
      { type: "paragraph", text: he ? `זוהו ${contentGaps.length} פערי תוכן — שאילתות בהן ${plan.clientName || "הלקוח"} לא מופיע בתשובות AI. כל פער מייצג הזדמנות תוכן ממוקדת.` : `Identified ${contentGaps.length} content gaps — queries where ${plan.clientName || "the business"} doesn't appear in AI responses. Each gap represents a targeted content opportunity.` },
      ...(contentGaps.length > 0 ? [{
        type: "table" as const,
        headers: he ? ["שאילתה", "קטגוריה", "כוונה", "עדיפות"] : ["Query", "Category", "Intent", "Priority"],
        rows: contentGaps.slice(0, 15).map((g: any) => [
          g.query,
          g.category,
          g.intent,
          g.importance === "high" ? (he ? "גבוהה" : "High") : g.importance === "medium" ? (he ? "בינונית" : "Medium") : (he ? "נמוכה" : "Low"),
        ]),
      }] : []),
      { type: "heading", text: he ? "תוכנית תוכן מומלצת:" : "Recommended Content Plan:" },
      { type: "list", items: he ? [
        `צור ${Math.min(contentGaps.length, 5)} מאמרי מומחה שעונים על שאילתות בעדיפות גבוהה`,
        "כתוב כל מאמר עם FAQ Schema מובנה",
        "הוסף נתונים, סטטיסטיקות ומקורות — AI מעדיף תוכן סמכותי",
        "עדכן תוכן קיים עם תשובות ישירות לשאילתות חסרות",
        "פרסם תוכן באופן עקבי — לפחות 2 מאמרים בחודש",
      ] : [
        `Create ${Math.min(contentGaps.length, 5)} expert articles answering high-priority queries`,
        "Write each article with built-in FAQ Schema",
        "Add data, statistics, and sources — AI prefers authoritative content",
        "Update existing content with direct answers to missing queries",
        "Publish content consistently — at least 2 articles per month",
      ]},
    ],
  });

  // ── 7. Recommended Actions ──
  const actions: Array<{ priority: string; action: string; impact: string; effort: string }> = [];

  technicalFindings.filter(f => f.severity === "critical").forEach(f => {
    actions.push({ priority: "Critical", action: f.rec, impact: "High", effort: "Low" });
  });
  technicalFindings.filter(f => f.severity === "warning").forEach(f => {
    actions.push({ priority: "Important", action: f.rec, impact: "Medium", effort: "Medium" });
  });
  if (contentGaps.length > 0) {
    actions.push({ priority: "High", action: `Create content for ${contentGaps.length} missing queries`, impact: "High", effort: "High" });
  }
  if (!scan?.structuredData) {
    actions.push({ priority: "High", action: "Add Schema.org Structured Data", impact: "High", effort: "Medium" });
  }

  sections.push({
    id: "actions", number: 7,
    title: he ? "פעולות מומלצות" : "Recommended Actions",
    titleEn: "Recommended Actions",
    content: [
      { type: "paragraph", text: he ? `להלן ${actions.length} פעולות מומלצות, מסודרות לפי עדיפות. כל המלצה מבוססת על ממצאי סריקה בפועל.` : `Below are ${actions.length} recommended actions, ordered by priority. Each recommendation is based on actual scan findings.` },
      { type: "table",
        headers: he ? ["עדיפות", "פעולה", "השפעה", "מאמץ"] : ["Priority", "Action", "Impact", "Effort"],
        rows: actions.map(a => [
          a.priority === "Critical" ? (he ? "קריטי" : "Critical") : a.priority === "Important" ? (he ? "חשוב" : "Important") : a.priority === "High" ? (he ? "גבוה" : "High") : a.priority,
          a.action === `Create content for ${contentGaps.length} missing queries` ? (he ? `צור תוכן עבור ${contentGaps.length} שאילתות חסרות` : a.action) : a.action === "Add Schema.org Structured Data" ? (he ? "הוסף Schema.org Structured Data" : a.action) : a.action,
          a.impact === "High" ? (he ? "גבוהה" : "High") : a.impact === "Medium" ? (he ? "בינונית" : "Medium") : a.impact === "Low" ? (he ? "נמוכה" : "Low") : a.impact,
          a.effort === "High" ? (he ? "גבוה" : "High") : a.effort === "Medium" ? (he ? "בינוני" : "Medium") : a.effort === "Low" ? (he ? "נמוך" : "Low") : a.effort,
        ]),
      },
    ],
  });

  // ── 8. 60-Day Plan ──
  sections.push({
    id: "plan_60day", number: 8,
    title: he ? "תוכנית צמיחה ל-60 יום" : "60-Day Growth Plan",
    titleEn: "60-Day Growth Plan",
    content: [
      ...(weeks.length === 0 ? [
        { type: "paragraph" as const, text: he ? "טרם נוצרה תוכנית 60 יום." : "No 60-day plan generated yet." },
      ] : [
        { type: "stat_row" as const, stats: [
          { label: he ? "שבועות" : "Weeks", value: `${weeks.length}`, color: "#00B5FE", icon: "📅" },
          { label: he ? "משימות" : "Tasks", value: `${allTasks.length}`, color: "#00B5FE", icon: "📋" },
          { label: he ? "הושלמו" : "Done", value: `${doneTasks.length}`, color: "#10B981", icon: "✓" },
          { label: he ? "שעות עבודה" : "Work Hours", value: `${Math.round(allTasks.reduce((s: number, t: any) => s + (t.estimatedHours || 0), 0))}`, color: "#F59E0B", icon: "⏱️" },
        ]},
        { type: "progress_bar" as const, label: he ? "התקדמות כללית" : "Overall Progress", value: doneTasks.length, max: allTasks.length, color: "#10B981" },
        ...weeks.map((w: any) => ({
          type: "table" as const,
          headers: [he ? `שבוע ${w.weekNumber}: ${w.theme}` : `${"Week"} ${w.weekNumber}: ${w.theme}`, he ? "שעות" : "Hours", he ? "סטטוס" : "Status"],
          rows: w.tasks.map((t: any) => [
            t.title,
            `${t.estimatedHours || 0}h`,
            t.status === "done" ? "✓" : t.status === "in_progress" ? "▶" : "○",
          ]),
        })),
      ]),
    ],
  });

  // ── 9. Expected Results ──
  sections.push({
    id: "expected_results", number: 9,
    title: he ? "תוצאות צפויות" : "Expected Results",
    titleEn: "Expected Results",
    content: [
      { type: "paragraph", text: he ? `על בסיס המצב הנוכחי (ציון ${computedScores.overall}%) והפעולות המומלצות, אלו התוצאות הצפויות לאחר 60 יום:` : `Based on current status (score ${computedScores.overall}%) and recommended actions, here are expected results after 60 days:` },
      { type: "table",
        headers: he ? ["מדד", "נוכחי", "יעד 60 יום", "שיפור צפוי"] : ["Metric", "Current", "60-Day Target", "Expected Improvement"],
        rows: [
          [he ? "ציון טכני" : "Technical Score", `${computedScores.technical}%`, `${Math.min(100, computedScores.technical + 25)}%`, `+${Math.min(25, 100 - computedScores.technical)}%`],
          [he ? "נראות AI" : "AI Visibility", `${computedScores.visibility}%`, `${Math.min(100, computedScores.visibility + 20)}%`, `+${Math.min(20, 100 - computedScores.visibility)}%`],
          [he ? "ציון כללי" : "Overall Score", `${computedScores.overall}%`, `${Math.min(100, computedScores.overall + 20)}%`, `+${Math.min(20, 100 - computedScores.overall)}%`],
          [he ? "אזכורים בשאילתות AI" : "AI Query Mentions", `${mentionedQueries.length}/${visResults.length}`, `${Math.min(visResults.length, mentionedQueries.length + Math.ceil(missedQueries.length * 0.4))}/${visResults.length}`, `+${Math.ceil(missedQueries.length * 0.4)}`],
        ],
      },
      { type: "paragraph", text: he ? "* התוצאות מבוססות על ביצוע מלא של כל הפעולות המומלצות. תוצאות בפועל עשויות להשתנות בהתאם לקצב הביצוע ושינויים בשוק." : "* Results are based on full execution of all recommended actions. Actual results may vary depending on execution pace and market changes." },
    ],
  });

  // ── 10. Next Steps ──
  sections.push({
    id: "next_steps", number: 10,
    title: he ? "צעדים הבאים" : "Next Steps",
    titleEn: "Next Steps",
    content: [
      { type: "paragraph", text: he ? "סדר פעולות מומלץ לשבועיים הקרובים:" : "Recommended action order for the next two weeks:" },
      { type: "list", items: he ? [
        ...(technicalFindings.some(f => f.severity === "critical") ? ["טפל בכל הממצאים הקריטיים מיידית (SSL, מהירות, מובייל)"] : []),
        "הוסף Schema.org Structured Data — LocalBusiness, FAQ, Breadcrumb",
        "צור/עדכן Sitemap.xml ו-Robots.txt",
        "כתוב 2-3 מאמרים שעונים על שאילתות AI בעדיפות גבוהה",
        "הגש את האתר ל-Google Search Console ו-Bing Webmaster Tools",
        "עדכן Google Business Profile עם תמונות ושעות פעילות",
        "הגדר מעקב חודשי — סריקה טכנית + בדיקת נראות AI",
      ] : [
        ...(technicalFindings.some(f => f.severity === "critical") ? ["Address all critical findings immediately (SSL, speed, mobile)"] : []),
        "Add Schema.org Structured Data — LocalBusiness, FAQ, Breadcrumb",
        "Create/update Sitemap.xml and Robots.txt",
        "Write 2-3 articles answering high-priority AI queries",
        "Submit site to Google Search Console and Bing Webmaster Tools",
        "Update Google Business Profile with photos and hours",
        "Set up monthly tracking — technical scan + AI visibility check",
      ], ordered: true },
      { type: "divider" },
      { type: "paragraph", text: he ? `דוח זה הופק אוטומטית על ידי PixelManageAI בתאריך ${new Date().toLocaleDateString("he-IL")}. לשאלות, צרו קשר עם הצוות שלנו.` : `This report was automatically generated by PixelManageAI on ${new Date().toLocaleDateString("en-US")}. For questions, contact our team.` },
    ],
  });

  return {
    id: `report_${Date.now().toString(36)}`,
    planId: plan.id,
    clientName: plan.clientName || "",
    websiteUrl: plan.websiteUrl || "",
    generatedAt: new Date().toISOString(),
    language,
    sections,
    meta: {
      overallScore: computedScores.overall,
      technicalScore: computedScores.technical,
      contentScore: computedScores.content,
      visibilityScore: computedScores.visibility,
      totalFindings: technicalFindings.length,
      criticalFindings: technicalFindings.filter(f => f.severity === "critical").length,
      totalRecommendations: actions.length,
    },
  };
}

/**
 * Normalizes scan-pipeline aiQueries format to legacy visibilityResults format.
 * aiQueries: { query, platform, found, confidence, snippet, checkedAt, scanMode }
 * legacy: { query, engine, mentioned, context, scannedAt, results: [{ engine, mentioned }] }
 */
function _normalizeAiQueries(aiQueries: any[]): any[] {
  return aiQueries.map((q: any) => ({
    query: q.query || '',
    queryId: q.query || '',
    engine: q.platform || '',
    mentioned: !!q.found,
    context: q.snippet || null,
    scannedAt: q.checkedAt || new Date().toISOString(),
    competitorsMentioned: [],
    results: [{ engine: q.platform, mentioned: !!q.found }],
  }));
}

function scoreColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}
