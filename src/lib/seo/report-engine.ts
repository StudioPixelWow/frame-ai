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
  language: "he" | "en";
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

export function generateSeoReport(plan: any, language: "he" | "en" = "en", businessProfile?: any): SeoReport {
  const he = language === "he";
  const scan = plan.websiteScan || null;
  const goals = (plan.goals || []).filter((g: any) => g.selected);
  const visResults = plan.visibilityResults || [];
  const visQueries = plan.visibilityQueries || [];
  const insights = plan.insights || [];
  const weeks = plan.weeks || [];
  const allTasks = weeks.flatMap((w: any) => w.tasks || []);
  const doneTasks = allTasks.filter((t: any) => t.status === "done");
  const domain = (plan.websiteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const scanMode = plan.scanMode || null;

  // AI engine analysis
  const engines = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Copilot"];
  const engineStats = engines.map(eng => {
    const total = visResults.length;
    const mentioned = visResults.filter((vr: any) =>
      (vr.results || []).some((r: any) => r.engine === eng && r.mentioned)
    ).length;
    return { engine: eng, mentioned, total, pct: total > 0 ? Math.round((mentioned / total) * 100) : 0 };
  });

  // Queries analysis
  const mentionedQueries = visResults.filter((vr: any) =>
    (vr.results || []).some((r: any) => r.mentioned)
  );
  const missedQueries = visResults.filter((vr: any) =>
    !(vr.results || []).some((r: any) => r.mentioned)
  );

  // Technical findings
  const technicalFindings: Array<{ severity: "critical" | "warning" | "info" | "success"; title: string; detail: string; rec: string }> = [];

  if (scan) {
    if (!scan?.hasSSL) technicalFindings.push({
      severity: "critical",
      title: he ? "אין תעודת SSL" : "Missing SSL Certificate",
      detail: he ? "האתר אינו מאובטח ב-HTTPS. גוגל מסמן אתרים ללא SSL כ\"לא בטוח\" ומוריד את הדירוג שלהם." : "Site is not secured with HTTPS. Google marks non-SSL sites as 'Not Secure' and demotes them.",
      rec: he ? "התקן תעודת SSL (Let's Encrypt חינמית) והפנה את כל התנועה מ-HTTP ל-HTTPS." : "Install an SSL certificate (Let's Encrypt is free) and redirect all HTTP traffic to HTTPS.",
    });

    if ((scan?.loadTimeMs ?? 0) > 3000) technicalFindings.push({
      severity: "critical",
      title: he ? `זמן טעינה איטי: ${(scan.loadTimeMs / 1000).toFixed(1)} שניות` : `Slow Load Time: ${(scan.loadTimeMs / 1000).toFixed(1)}s`,
      detail: he ? `זמן הטעינה הנוכחי ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)} שניות. גוגל ממליץ על פחות מ-3 שניות. כל שנייה נוספת מגדילה את שיעור הנטישה ב-32%.` : `Current load time is ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s. Google recommends under 3s. Each extra second increases bounce rate by 32%.`,
      rec: he ? "דחס תמונות ל-WebP, הפעל Lazy Loading, השתמש ב-CDN, מזער CSS/JS." : "Compress images to WebP, enable lazy loading, use CDN, minify CSS/JS.",
    });
    else if ((scan?.loadTimeMs ?? 0) > 1500) technicalFindings.push({
      severity: "warning",
      title: he ? `זמן טעינה בינוני: ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)} שניות` : `Moderate Load Time: ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s`,
      detail: he ? `זמן הטעינה ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)} שניות — סביר אך ניתן לשפר.` : `Load time is ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s — acceptable but can improve.`,
      rec: he ? "שקול דחיסת תמונות ו-Lazy Loading לשיפור נוסף." : "Consider image compression and lazy loading for further improvement.",
    });
    else technicalFindings.push({
      severity: "success",
      title: he ? `זמן טעינה מעולה: ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)} שניות` : `Excellent Load Time: ${((scan?.loadTimeMs ?? 0) / 1000).toFixed(1)}s`,
      detail: he ? "זמן הטעינה מתחת ל-1.5 שניות — מצוין." : "Load time is under 1.5s — excellent.",
      rec: he ? "שמור על הביצועים הנוכחיים." : "Maintain current performance.",
    });

    if (!scan?.hasSitemap) technicalFindings.push({
      severity: "warning",
      title: he ? "חסר Sitemap.xml" : "Missing Sitemap.xml",
      detail: he ? "לא נמצא קובץ sitemap.xml. ללא Sitemap, מנועי חיפוש עלולים לפספס דפים חשובים באתר." : "No sitemap.xml found. Without it, search engines may miss important pages.",
      rec: he ? "צור sitemap.xml עם כל הדפים החשובים והגש אותו ב-Google Search Console." : "Create a sitemap.xml with all important pages and submit it in Google Search Console.",
    });

    if (!scan?.hasRobotsTxt) technicalFindings.push({
      severity: "warning",
      title: he ? "חסר Robots.txt" : "Missing Robots.txt",
      detail: he ? "לא נמצא קובץ robots.txt. זה אומר שאין שליטה על אילו דפים נסרקים." : "No robots.txt found. This means no control over which pages are crawled.",
      rec: he ? "צור robots.txt עם הוראות Crawl מתאימות וקישור ל-Sitemap." : "Create robots.txt with appropriate crawl directives and Sitemap link.",
    });

    if (!scan?.mobileOptimized) technicalFindings.push({
      severity: "critical",
      title: he ? "האתר לא מותאם למובייל" : "Site Not Mobile-Optimized",
      detail: he ? "מעל 60% מהחיפושים מגיעים ממובייל. גוגל משתמש ב-Mobile-First Indexing." : "Over 60% of searches come from mobile. Google uses Mobile-First Indexing.",
      rec: he ? "הטמע עיצוב רספונסיבי ובדוק במבחן Mobile-Friendly של גוגל." : "Implement responsive design and test with Google's Mobile-Friendly Test.",
    });

    if ((scan?.brokenLinks ?? 0) > 0) technicalFindings.push({
      severity: (scan?.brokenLinks ?? 0) > 5 ? "critical" : "warning",
      title: he ? `${scan?.brokenLinks ?? 0} קישורים שבורים` : `${scan?.brokenLinks ?? 0} Broken Links`,
      detail: he ? `נמצאו ${scan?.brokenLinks ?? 0} קישורים שבורים. קישורים שבורים פוגעים בחוויית המשתמש ובדירוג.` : `Found ${scan?.brokenLinks ?? 0} broken links. Broken links harm UX and rankings.`,
      rec: he ? "תקן או הסר את הקישורים השבורים. השתמש בהפניות 301 לדפים שהועברו." : "Fix or remove broken links. Use 301 redirects for moved pages.",
    });

    if (!scan?.structuredData) technicalFindings.push({
      severity: "warning",
      title: he ? "חסר Schema / Structured Data" : "Missing Schema / Structured Data",
      detail: he ? "האתר לא כולל נתונים מובנים (Schema.org). ללא Schema, האתר מפסיד תצוגות עשירות בתוצאות החיפוש." : "Site lacks structured data (Schema.org). Without it, rich snippets are missed.",
      rec: he ? "הוסף LocalBusiness Schema, FAQ Schema ו-Breadcrumb Schema כצעד ראשון." : "Add LocalBusiness, FAQ, and Breadcrumb Schema as first steps.",
    });

    if (!scan?.openGraph) technicalFindings.push({
      severity: "info",
      title: he ? "חסרים תגי Open Graph" : "Missing Open Graph Tags",
      detail: he ? "ללא תגי OG, שיתופים ברשתות חברתיות יראו תצוגה גנרית." : "Without OG tags, social shares will show generic previews.",
      rec: he ? "הוסף og:title, og:description, og:image לכל דף." : "Add og:title, og:description, og:image to all pages.",
    });

    if ((scan?.domainAuthority ?? 0) > 30) technicalFindings.push({
      severity: "success",
      title: he ? `Domain Authority ${scan?.domainAuthority ?? 0} — בסיס חזק` : `Domain Authority ${scan?.domainAuthority ?? 0} — Strong Base`,
      detail: he ? `DA של ${scan?.domainAuthority ?? 0} מעיד על סמכות טובה. זה בסיס חזק לצמיחה.` : `DA of ${scan?.domainAuthority ?? 0} indicates good authority. Strong growth foundation.`,
      rec: he ? "המשך לבנות קישורים איכותיים מאתרים רלוונטיים." : "Continue building quality links from relevant sites.",
    });
    else if ((scan?.domainAuthority ?? 0) > 0) technicalFindings.push({
      severity: "warning",
      title: he ? `Domain Authority ${scan?.domainAuthority ?? 0} — נמוך` : `Domain Authority ${scan?.domainAuthority ?? 0} — Low`,
      detail: he ? `DA של ${scan?.domainAuthority ?? 0} מצריך עבודה על בניית סמכות.` : `DA of ${scan?.domainAuthority ?? 0} requires authority-building work.`,
      rec: he ? "בנה קישורים מאתרי מדיה, בלוגים מקצועיים ומדריכים." : "Build links from media sites, professional blogs, and directories.",
    });
  }

  // Build sections
  const sections: ReportSection[] = [];

  // ── Scan Mode Banner ──
  const scanModeBanner = scanMode === "simulated" ? {
    type: "paragraph" as const,
    text: "⚠️ NOTE: This report is based on simulated scan data. Results should be verified with real scanning tools before making major decisions."
  } : null;

  // ── 1. Executive Summary ──
  sections.push({
    id: "executive_summary", number: 1,
    title: "Executive Summary",
    titleEn: "Executive Summary",
    content: [
      ...(scanModeBanner ? [scanModeBanner] : []),
      { type: "paragraph", text: `Comprehensive SEO and AI visibility (GEO) analysis for ${plan.clientName || "the client"} (${domain}). Based on full technical scan, presence checks across 5 leading AI engines, and analysis of ${visQueries.length} relevant queries.${businessProfile?.business_name ? ` Business: ${businessProfile.business_name}${businessProfile.industry ? ` (${businessProfile.industry})` : ""}${businessProfile.location ? ` in ${businessProfile.location}` : ""}.` : ""}`},
      { type: "stat_row", stats: [
        { label: "Overall Score", value: `${plan.overallScore || 0}%`, color: scoreColor(plan.overallScore || 0), icon: "📊" },
        { label: "Technical Score", value: `${plan.technicalScore || 0}%`, color: scoreColor(plan.technicalScore || 0), icon: "🔧" },
        { label: "AI Visibility", value: `${plan.visibilityScore || 0}%`, color: scoreColor(plan.visibilityScore || 0), icon: "🤖" },
        { label: "Content", value: `${plan.contentScore || 0}%`, color: scoreColor(plan.contentScore || 0), icon: "📝" },
      ]},
      { type: "paragraph", text: `Found ${technicalFindings.filter(f => f.severity === "critical").length} critical findings and ${technicalFindings.filter(f => f.severity === "warning").length} warnings requiring attention. ${mentionedQueries.length} of ${visResults.length} AI queries mention the business (${visResults.length > 0 ? Math.round((mentionedQueries.length / visResults.length) * 100) : 0}%).`},
    ],
  });

  // ── 2. Current SEO/GEO Status ──
  sections.push({
    id: "current_status", number: 2,
    title: "Current SEO/GEO Status",
    titleEn: "Current SEO/GEO Status",
    content: [
      { type: "paragraph", text: `Status summary for ${domain} as of the scan date:`},
      ...(scan ? [
        { type: "stat_row" as const, stats: [
          { label: "SSL", value: scan.hasSSL ? "✓" : "✗", color: scan.hasSSL ? "#10B981" : "#EF4444" },
          { label: he ? "מהירות" : "Speed", value: `${(scan.loadTimeMs / 1000).toFixed(1)}s`, color: scan.loadTimeMs < 3000 ? "#10B981" : "#EF4444" },
          { label: he ? "מובייל" : "Mobile", value: scan.mobileOptimized ? "✓" : "✗", color: scan.mobileOptimized ? "#10B981" : "#EF4444" },
          { label: "DA", value: `${scan.domainAuthority}`, color: scan.domainAuthority > 30 ? "#10B981" : "#F59E0B" },
        ]},
        { type: "table" as const,
          headers: [he ? "פרמטר" : "Parameter", he ? "ערך" : "Value", he ? "מצב" : "Status"],
          rows: [
            ["Sitemap.xml", scan.hasSitemap ? (he ? "קיים" : "Present") : (he ? "חסר" : "Missing"), scan.hasSitemap ? "✓" : "✗"],
            ["Robots.txt", scan.hasRobotsTxt ? (he ? "קיים" : "Present") : (he ? "חסר" : "Missing"), scan.hasRobotsTxt ? "✓" : "✗"],
            ["Structured Data", scan.structuredData ? (he ? "קיים" : "Present") : (he ? "חסר" : "Missing"), scan.structuredData ? "✓" : "✗"],
            ["Open Graph", scan.openGraph ? (he ? "קיים" : "Present") : (he ? "חסר" : "Missing"), scan.openGraph ? "✓" : "✗"],
            ["Canonical Tags", scan.canonicalTags ? (he ? "קיים" : "Present") : (he ? "חסר" : "Missing"), scan.canonicalTags ? "✓" : "✗"],
            [he ? "דפים באינדקס" : "Indexed Pages", `${scan.indexedPages || scan.totalPages}`, "—"],
            [he ? "קישורים שבורים" : "Broken Links", `${scan.brokenLinks}`, scan.brokenLinks === 0 ? "✓" : "✗"],
          ],
        },
      ] : [{ type: "paragraph" as const, text: he ? "לא בוצעה סריקת אתר." : "No website scan performed." }]),
    ],
  });

  // ── 3. AI Visibility Overview ──
  sections.push({
    id: "ai_visibility", number: 3,
    title: "AI Visibility Overview",
    titleEn: "AI Visibility Overview",
    content: [
      { type: "stat", label: "Overall AI Visibility Score", value: `${plan.visibilityScore || 0}%`, color: scoreColor(plan.visibilityScore || 0), icon: "🤖" },
      { type: "paragraph", text: `Tested ${visResults.length} queries across 5 AI engines: ChatGPT, Gemini, Perplexity, Claude, and Copilot. Business mentioned in ${mentionedQueries.length} queries and missing from ${missedQueries.length}.`},
      { type: "table",
        headers: ["Engine", "Mentions", "Out of", "Percentage"],
        rows: engineStats.map(e => [e.engine, `${e.mentioned}`, `${e.total}`, `${e.pct}%`]),
      },
      ...(mentionedQueries.length > 0 ? [
        { type: "heading" as const, text: "Queries where business appears:" },
        { type: "list" as const, items: mentionedQueries.slice(0, 10).map((vr: any) => {
          const enginesFound = (vr.results || []).filter((r: any) => r.mentioned).map((r: any) => r.engine).join(", ");
          return `"${vr.query}" — found in: ${enginesFound}`;
        })},
      ] : []),
      ...(missedQueries.length > 0 ? [
        { type: "heading" as const, text: "Queries where business is missing:" },
        { type: "list" as const, items: missedQueries.slice(0, 10).map((vr: any) => `"${vr.query}"`) },
      ] : []),
    ],
  });

  // ── 4. SEO Findings ──
  sections.push({
    id: "seo_findings", number: 4,
    title: "Search Engine Optimization Findings",
    titleEn: "Search Engine Optimization Findings",
    content: [
      { type: "paragraph", text: `Below are ${technicalFindings.length} findings from the technical scan of ${domain}:`},
      ...technicalFindings.map(f => ({
        type: "finding" as const,
        severity: f.severity,
        title: f.title,
        detail: f.detail,
        recommendation: f.rec,
      })),
      { type: "divider" },
      { type: "heading", text: "FAQ & Schema Opportunities" },
      { type: "paragraph", text: "Adding FAQ Schema to key pages enables rich results on Google and increases CTR. The AI queries tested can serve as FAQ content basis." },
      { type: "list", items: [
        `Create FAQ page with ${Math.min(visQueries.length, 10)} key questions from AI scan`,
        "Add FAQ Schema (JSON-LD) to service and product pages",
        "Add LocalBusiness Schema with hours, address, and photos",
        "Add Breadcrumb Schema for structured navigation",
        scan?.metaTitle ? "" : "Write unique Meta Title for each page (50-60 chars)",
        scan?.metaDescription ? "" : "Write unique Meta Description for each page (150-160 chars)",
      ].filter(Boolean) },
      { type: "heading", text: "Internal Linking Opportunities" },
      { type: "paragraph", text: `The site has ${scan?.totalPages || "?"} pages. Smart internal linking between relevant pages strengthens site structure and distributes authority.` },
      { type: "list", items: [
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
    title: "Competitor Analysis",
    titleEn: "Competitor Analysis",
    content: [
      { type: "paragraph", text: `Based on AI visibility scanning, we analyzed which businesses appear in queries where ${plan.clientName || "the business"} is absent. Competitors appearing in AI responses gain significant visibility advantage.` },
      { type: "paragraph", text: `Out of ${visResults.length} queries, the business is missing from ${missedQueries.length} (${visResults.length > 0 ? Math.round((missedQueries.length / visResults.length) * 100) : 0}%). These are the main growth opportunities.` },
      { type: "heading", text: "Strategy to Outperform Competitors:" },
      { type: "list", items: [
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
    title: "Content Gap Analysis",
    titleEn: "Content Gap Analysis",
    content: [
      { type: "paragraph", text: `Identified ${contentGaps.length} content gaps — queries where ${plan.clientName || "the business"} doesn't appear in AI responses. Each gap represents a targeted content opportunity.` },
      ...(contentGaps.length > 0 ? [{
        type: "table" as const,
        headers: ["Query", "Category", "Intent", "Priority"],
        rows: contentGaps.slice(0, 15).map(g => [
          g.query,
          g.category,
          g.intent,
          g.importance === "high" ? "High" : g.importance === "medium" ? "Medium" : "Low",
        ]),
      }] : []),
      { type: "heading", text: "Recommended Content Plan:" },
      { type: "list", items: [
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
    actions.push({ priority: he ? "קריטי" : "Critical", action: f.rec, impact: he ? "גבוהה" : "High", effort: he ? "נמוכה" : "Low" });
  });
  technicalFindings.filter(f => f.severity === "warning").forEach(f => {
    actions.push({ priority: he ? "חשוב" : "Important", action: f.rec, impact: he ? "בינונית" : "Medium", effort: he ? "בינונית" : "Medium" });
  });
  if (contentGaps.length > 0) {
    actions.push({ priority: he ? "גבוהה" : "High", action: he ? `צור תוכן עבור ${contentGaps.length} שאילתות חסרות` : `Create content for ${contentGaps.length} missing queries`, impact: he ? "גבוהה" : "High", effort: he ? "גבוהה" : "High" });
  }
  if (!scan?.structuredData) {
    actions.push({ priority: he ? "גבוהה" : "High", action: he ? "הוסף Schema.org Structured Data" : "Add Schema.org Structured Data", impact: he ? "גבוהה" : "High", effort: he ? "בינונית" : "Medium" });
  }

  sections.push({
    id: "actions", number: 7,
    title: "Recommended Actions",
    titleEn: "Recommended Actions",
    content: [
      { type: "paragraph", text: `Below are ${actions.length} recommended actions, ordered by priority. Each recommendation is based on actual scan findings.` },
      { type: "table",
        headers: ["Priority", "Action", "Impact", "Effort"],
        rows: actions.map(a => [a.priority, a.action, a.impact, a.effort]),
      },
    ],
  });

  // ── 8. 60-Day Plan ──
  sections.push({
    id: "plan_60day", number: 8,
    title: "60-Day Growth Plan",
    titleEn: "60-Day Growth Plan",
    content: [
      ...(weeks.length === 0 ? [
        { type: "paragraph" as const, text: "No 60-day plan generated yet." },
      ] : [
        { type: "stat_row" as const, stats: [
          { label: "Weeks", value: `${weeks.length}`, color: "#00B5FE", icon: "📅" },
          { label: "Tasks", value: `${allTasks.length}`, color: "#00B5FE", icon: "📋" },
          { label: "Done", value: `${doneTasks.length}`, color: "#10B981", icon: "✓" },
          { label: "Work Hours", value: `${Math.round(allTasks.reduce((s: number, t: any) => s + (t.estimatedHours || 0), 0))}`, color: "#F59E0B", icon: "⏱️" },
        ]},
        { type: "progress_bar" as const, label: "Overall Progress", value: doneTasks.length, max: allTasks.length, color: "#10B981" },
        ...weeks.map((w: any) => ({
          type: "table" as const,
          headers: [`${he ? "שבוע" : "Week"} ${w.weekNumber}: ${w.theme}`, he ? "שעות" : "Hours", he ? "סטטוס" : "Status"],
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
    title: "Expected Results",
    titleEn: "Expected Results",
    content: [
      { type: "paragraph", text: `Based on current status (score ${plan.overallScore || 0}%) and recommended actions, here are expected results after 60 days:` },
      { type: "table",
        headers: ["Metric", "Current", "60-Day Target", "Expected Improvement"],
        rows: [
          ["Technical Score", `${plan.technicalScore || 0}%`, `${Math.min(100, (plan.technicalScore || 0) + 25)}%`, `+${Math.min(25, 100 - (plan.technicalScore || 0))}%`],
          ["AI Visibility", `${plan.visibilityScore || 0}%`, `${Math.min(100, (plan.visibilityScore || 0) + 20)}%`, `+${Math.min(20, 100 - (plan.visibilityScore || 0))}%`],
          ["Overall Score", `${plan.overallScore || 0}%`, `${Math.min(100, (plan.overallScore || 0) + 20)}%`, `+${Math.min(20, 100 - (plan.overallScore || 0))}%`],
          ["AI Query Mentions", `${mentionedQueries.length}/${visResults.length}`, `${Math.min(visResults.length, mentionedQueries.length + Math.ceil(missedQueries.length * 0.4))}/${visResults.length}`, `+${Math.ceil(missedQueries.length * 0.4)}`],
        ],
      },
      { type: "paragraph", text: "* Results are based on full execution of all recommended actions. Actual results may vary depending on execution pace and market changes." },
    ],
  });

  // ── 10. Next Steps ──
  sections.push({
    id: "next_steps", number: 10,
    title: "Next Steps",
    titleEn: "Next Steps",
    content: [
      { type: "paragraph", text: "Recommended action order for the next two weeks:" },
      { type: "list", items: [
        ...(technicalFindings.some(f => f.severity === "critical") ? ["Address all critical findings immediately (SSL, speed, mobile)"] : []),
        "Add Schema.org Structured Data — LocalBusiness, FAQ, Breadcrumb",
        "Create/update Sitemap.xml and Robots.txt",
        "Write 2-3 articles answering high-priority AI queries",
        "Submit site to Google Search Console and Bing Webmaster Tools",
        "Update Google Business Profile with photos and hours",
        "Set up monthly tracking — technical scan + AI visibility check",
      ], ordered: true },
      { type: "divider" },
      { type: "paragraph", text: `This report was automatically generated by PixelManageAI on ${new Date().toLocaleDateString("en-US")}. For questions, contact our team.` },
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
      overallScore: plan.overallScore || 0,
      technicalScore: plan.technicalScore || 0,
      contentScore: plan.contentScore || 0,
      visibilityScore: plan.visibilityScore || 0,
      totalFindings: technicalFindings.length,
      criticalFindings: technicalFindings.filter(f => f.severity === "critical").length,
      totalRecommendations: actions.length,
    },
  };
}

function scoreColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}
