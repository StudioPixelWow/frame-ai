/**
 * SEO/GEO 60-Day Action Plan Engine
 *
 * Generates a daily action plan based on actual scan data, AI visibility results,
 * content gaps, competitor intel, goals, and target location/language.
 *
 * Every task is specific to the client website — no generic filler.
 *
 * 5 phases:
 *   Days 1-7   — Foundation & technical quick wins
 *   Days 8-20  — Content gap closure
 *   Days 21-35 — GEO optimization & FAQ/Schema
 *   Days 36-50 — Competitor counter-strategy & authority
 *   Days 51-60 — Optimization, reporting & second scan
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanInput {
  clientName: string;
  websiteUrl: string;
  websiteScan: WebsiteScanInput | null;
  scannedPages: ScannedPage[];
  visibilityResults: VisibilityResultInput[];
  visibilityQueries: VisibilityQueryInput[];
  competitors: string[];
  contentGaps: ContentGapInput[];
  goals: GoalInput[];
  targetKeywords: string[];
  targetLocation: string;
  targetLanguage: string;
  insights: InsightInput[];
  businessProfile?: {
    business_name: string;
    business_type: string;
    industry: string;
    location: string;
    main_products_or_services: string[];
    target_audience: string;
    known_competitors: string[];
    confirmed: boolean;
  };
}

export interface WebsiteScanInput {
  url: string;
  hasSSL: boolean;
  loadTimeMs: number;
  mobileOptimized: boolean;
  metaTitle: string;
  metaDescription: string;
  h1Tags: string[];
  totalPages: number;
  indexedPages: number;
  brokenLinks: number;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  domainAuthority: number;
  structuredData: boolean;
  openGraph: boolean;
  canonicalTags: boolean;
  techStack: string[];
  cmsDetected: string;
  issues: Array<{ type: string; category: string; title: string; description: string; impact: string }>;
}

export interface ScannedPage {
  url: string;
  title: string;
  missingMeta: boolean;
  missingH1: boolean;
  missingAlt: boolean;
  wordCount: number;
  hasSchema: boolean;
}

export interface VisibilityQueryInput {
  id: string;
  query: string;
  category: string;
  intent: string;
  importance: string;
}

export interface VisibilityResultInput {
  queryId: string;
  query: string;
  results: Array<{ engine: string; mentioned: boolean; position: number | null; sentiment: string }>;
}

export interface ContentGapInput {
  query: string;
  category: string;
  intent: string;
  importance: string;
}

export interface GoalInput {
  id: string;
  type: string;
  label: string;
  selected?: boolean;
  targetMetric: string;
  currentValue: number;
  targetValue: number;
  priority: string;
}

export interface InsightInput {
  id: string;
  category: string; // opportunity | threat | strength | weakness
  title: string;
  description: string;
  impact: string;
  action: string;
}

export type TaskCategory = "technical" | "content" | "onpage" | "offpage" | "local" | "ai_optimization" | "analytics";
export type TaskPriority = "high" | "medium" | "low";
export type ImpactLevel = "critical" | "high" | "medium" | "low";

export interface DayPlan {
  day: number;
  date: string;
  phase: string;
  phaseNumber: number;
  focusTitle: string;
  tasks: DayTask[];
}

export interface DayTask {
  id: string;
  title: string;
  type: TaskCategory;
  description: string;
  impactLevel: ImpactLevel;
  effortHours: number;
  relatedPageUrl: string | null;
  expectedOutcome: string;
  reason: string;
  contentBrief: string | null;
}

export interface GeneratedPlan {
  days: DayPlan[];
  totalTasks: number;
  totalHours: number;
  phases: PhaseOverview[];
  generatedAt: string;
}

export interface PhaseOverview {
  number: number;
  name: string;
  dayRange: string;
  taskCount: number;
  hours: number;
  focus: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES = [
  { number: 1, name: "Foundation & Quick Wins", nameEn: "Foundation & Quick Wins", days: [1, 7], focus: "Fix critical technical issues, establish measurement infrastructure, achieve quick wins" },
  { number: 2, name: "Content Gap Closure", nameEn: "Content Gap Closure", days: [8, 20], focus: "Create new content for identified gaps, update existing content, map target keywords" },
  { number: 3, name: "AI Visibility & Schema Optimization", nameEn: "AI Visibility & Schema Optimization", days: [21, 35], focus: "Optimize for AI engine visibility, implement structured data, build FAQ content" },
  { number: 4, name: "Competitor Strategy & Authority", nameEn: "Competitor Strategy & Authority", days: [36, 50], focus: "Build backlinks, establish authority, Digital PR, outcompete rivals" },
  { number: 5, name: "Optimization & Reporting", nameEn: "Optimization & Reporting", days: [51, 60], focus: "Measure results, final optimizations, rescan, deliver comprehensive report" },
];

// ─── Main Generator ───────────────────────────────────────────────────────────

export function generate60DayPlan(input: PlanInput): GeneratedPlan {
  // Validate critical inputs
  if (!input?.websiteUrl || input.websiteUrl.trim() === "") {
    throw new Error("Website URL is required to generate a 60-day plan");
  }
  if (!input?.clientName || input.clientName.trim() === "") {
    throw new Error("Client name is required to generate a 60-day plan");
  }

  const scan = input.websiteScan;
  const domain = (input.websiteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const businessProfile = input.businessProfile;
  const loc = businessProfile?.location || input.targetLocation || "";
  const lang = input.targetLanguage || "English";
  const goals = (input.goals || []).filter(g => g.selected !== false);
  const gaps = input.contentGaps || [];
  const vis = input.visibilityResults || [];
  const queries = input.visibilityQueries || [];
  const pages = input.scannedPages || [];
  const competitors = businessProfile?.known_competitors || input.competitors || [];
  const insights = input.insights || [];
  const keywords = input.targetKeywords || [];

  // Derived analytics
  const mentionedQueries = vis.filter(v => (v.results || []).some(r => r.mentioned));
  const missedQueries = vis.filter(v => !(v.results || []).some(r => r.mentioned));
  const criticalIssues = scan?.issues?.filter(i => i.type === "critical" || i.impact === "high") || [];
  const warningIssues = scan?.issues?.filter(i => i.type === "warning" || i.impact === "medium") || [];
  const pagesNeedingMeta = pages.filter(p => p.missingMeta);
  const pagesNeedingH1 = pages.filter(p => p.missingH1);
  const pagesNeedingAlt = pages.filter(p => p.missingAlt);
  const pagesNeedingSchema = pages.filter(p => !p.hasSchema);
  const thinPages = pages.filter(p => p.wordCount < 300);
  const highPriorityGaps = gaps.filter(g => g.importance === "high");
  const mediumPriorityGaps = gaps.filter(g => g.importance === "medium");
  const opportunities = insights.filter(i => i.category === "opportunity");
  const threats = insights.filter(i => i.category === "threat");

  // Has-flags from scan
  const needsSSL = scan && !scan.hasSSL;
  const needsSitemap = scan && !scan.hasSitemap;
  const needsRobots = scan && !scan.hasRobotsTxt;
  const needsMobile = scan && !scan.mobileOptimized;
  const isSlow = scan && scan.loadTimeMs > 3000;
  const isModerate = scan && scan.loadTimeMs > 1500 && scan.loadTimeMs <= 3000;
  const hasBrokenLinks = scan && scan.brokenLinks > 0;
  const needsSchema = scan && !scan.structuredData;
  const needsOG = scan && !scan.openGraph;
  const needsCanonical = scan && !scan.canonicalTags;
  const lowDA = scan && scan.domainAuthority < 25;

  const now = new Date();
  let taskCounter = 0;
  const mkId = () => `t60_${++taskCounter}`;

  const days: DayPlan[] = [];

  // Helper: find the phase for a given day
  const phaseFor = (d: number) => PHASES.find(p => d >= p.days[0] && d <= p.days[1])!;

  // Helper: date string for a day offset
  const dayDate = (d: number) => {
    const dt = new Date(now);
    dt.setDate(now.getDate() + d - 1);
    return dt.toISOString().split("T")[0];
  };

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Days 1-7 — Foundation & Technical Quick Wins
  // ═══════════════════════════════════════════════════════════════════

  // Day 1: Audit & Setup
  days.push(mkDay(1, "Complete Audit & Measurement Infrastructure Setup", [
    mkTask("technical", "high", "critical",
      `Set up Google Search Console for ${domain}`,
      `Connect ${domain} to Google Search Console, verify ownership via DNS, submit Sitemap${scan?.hasSitemap ? "" : " (create one first)"}, and check coverage errors.`,
      1.5, null,
      "GSC connected and verified, Sitemap submitted, coverage errors documented",
      "Without GSC you cannot monitor performance, clicks, impressions, or indexing errors — this is the foundation of all SEO work",
    ),
    mkTask("analytics", "high", "critical",
      "Set up Google Analytics 4 with Event Tracking",
      `Ensure GA4 is connected to ${domain}. Configure events: form_submit, phone_click, scroll_depth, cta_click. Connect to GSC.`,
      2, null,
      "GA4 with complete conversion event tracking",
      "Without measurement you cannot prove ROI — need accurate baseline before optimization begins",
    ),
    mkTask("technical", "high", "high",
      `Complete Technical Scan of ${domain}`,
      `Run Screaming Frog or Sitebulb on ${domain}. Document: 404 errors, broken redirects, duplicate titles, blocked pages, missing meta tags. Export to spreadsheet.`,
      3, scan?.url || null,
      `Complete list of all technical issues across ${scan?.totalPages || "?"} pages`,
      "Technical scan reveals hidden problems that damage rankings — must fix before investing in content",
    ),
  ]));

  // Day 2: Critical technical fixes
  const day2Tasks: DayTask[] = [];
  if (needsSSL) {
    day2Tasks.push(mkTask("technical", "high", "critical",
      "Install SSL Certificate and Configure HTTPS Redirect",
      `Install SSL certificate (Let's Encrypt is free) for ${domain}. Set up 301 redirects from HTTP to HTTPS on all pages. Update canonical tags, sitemap, and internal links.`,
      2, scan?.url || null,
      `${domain} secured with HTTPS and HSTS enabled`,
      "Google marks non-SSL sites as 'Not Secure' and demotes them in rankings — this is the most critical fix",
    ));
  }
  if (needsSitemap) {
    day2Tasks.push(mkTask("technical", "high", "critical",
      "Create Sitemap.xml and Submit to GSC",
      `Create sitemap.xml containing all ${scan?.totalPages || "?"} pages of ${domain}. Ensure it includes lastmod, priority, and changefreq. Submit to GSC and Bing Webmaster Tools.`,
      1, null,
      "Sitemap.xml created and submitted to search engines",
      "Without a Sitemap, search engines may miss important pages — especially critical for sites with deep structure",
    ));
  }
  if (needsRobots) {
    day2Tasks.push(mkTask("technical", "medium", "high",
      "Create Robots.txt with Crawl Directives",
      `Create robots.txt for ${domain}. Block access to admin/, search-results/, and duplicate pages. Add Sitemap line: https://${domain}/sitemap.xml`,
      0.5, null,
      "Robots.txt configured correctly with Sitemap reference",
      "Robots.txt controls which pages search engines crawl — saves crawl budget and prevents indexing irrelevant pages",
    ));
  }
  if (isSlow) {
    day2Tasks.push(mkTask("technical", "high", "critical",
      `Improve Page Load Speed (${((scan?.loadTimeMs || 0) / 1000).toFixed(1)}s → below 2s)`,
      `Current load time is ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)} seconds. Compress images to WebP (TinyPNG/Squoosh), enable Lazy Loading, minify CSS/JS, enable Browser Caching, ${scan?.cmsDetected ? `audit ${scan.cmsDetected} plugins for slowdowns` : "consider CDN like Cloudflare"}.`,
      4, scan?.url || null,
      "Load time under 2 seconds on mobile and desktop",
      `Each extra second increases bounce rate by 32%. ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)} seconds is too slow — Google favors faster sites`,
    ));
  }
  if (day2Tasks.length === 0) {
    day2Tasks.push(mkTask("technical", "medium", "medium",
      "Optimize Core Web Vitals",
      `Run PageSpeed Insights on 5 key pages of ${domain}. Improve LCP, FID, CLS. Compress images, add font preloads, minify unused CSS/JS.`,
      3, scan?.url || null,
      "All Core Web Vitals are green",
      "Core Web Vitals are direct ranking factors — green scores give competitive advantage",
    ));
  }
  days.push(mkDay(2, "Critical Technical Fixes", day2Tasks));

  // Day 3: Mobile + broken links
  const day3Tasks: DayTask[] = [];
  if (needsMobile) {
    day3Tasks.push(mkTask("technical", "high", "critical",
      "Complete Mobile Optimization",
      `Site is not mobile-friendly. Test with Google's Mobile-Friendly Test. Fix: font-size (minimum 16px), touch targets (48px), viewport meta tag, elements extending beyond viewport. ${scan?.cmsDetected === "WordPress" ? "Consider responsive theme or AMP plugin." : ""}`,
      4, scan?.url || null,
      "Site passes Google's Mobile-Friendly Test",
      "Over 60% of searches come from mobile; Google uses Mobile-First Indexing — non-mobile site = poor indexing",
    ));
  }
  if (hasBrokenLinks) {
    day3Tasks.push(mkTask("technical", "high", "high",
      `Fix ${scan?.brokenLinks || 0} Broken Links`,
      `Found ${scan?.brokenLinks || 0} broken links. Run Screaming Frog and filter Client Errors (4xx). For each: fix target URL, set 301 redirect, or remove. Ensure Sitemap excludes 404 pages.`,
      2, null,
      "0 broken links on site",
      "Broken links harm user experience and crawl budget — Google stops crawling if too many errors exist",
    ));
  }
  if (day3Tasks.length < 2) {
    day3Tasks.push(mkTask("onpage", "medium", "medium",
      "Audit URL Structure and Canonical Tags",
      `Scan all URLs on ${domain}. Ensure: short, descriptive URLs (not ?p=123), canonical tag on every page, no duplicate content, working 301 redirects. ${needsCanonical ? "Missing canonical tags — add them to every page." : ""}`,
      2, null,
      "Clean URLs, canonical tags on every page, no duplicates",
      "Messy URLs and duplicate pages confuse Google and dilute ranking power",
    ));
  }
  days.push(mkDay(3, "Mobile Optimization, Broken Links & URL Structure", day3Tasks));

  // Day 4: On-Page — meta tags
  const metaPages = pagesNeedingMeta.length > 0 ? pagesNeedingMeta : pages.slice(0, 5);
  const locStr = loc ? ` in ${loc}` : "";
  days.push(mkDay(4, "Optimize Meta Tags and Heading Structure", [
    mkTask("onpage", "high", "high",
      `Write Unique Meta Titles for ${Math.min(metaPages.length, 10)} Pages`,
      `Write unique Title tag for each page (50-60 characters). Include primary keyword${locStr}. Recommended format: "Keyword | ${input.clientName}". Pages to update: ${metaPages.slice(0, 5).map(p => p.url).join(", ")}`,
      3, metaPages[0]?.url || null,
      "Unique, optimized Meta Title on every page",
      "Title tag is the strongest on-page ranking factor — directly impacts CTR in search results",
    ),
    mkTask("onpage", "high", "high",
      `Write Meta Descriptions for ${Math.min(metaPages.length, 10)} Pages`,
      `Write unique Description (150-160 characters) with CTA and keyword. Example: "${keywords[0] || "Service"} expertise${locStr} — ${input.clientName}. Contact for free consultation!"`,
      2.5, metaPages[0]?.url || null,
      "CTR-focused Meta Description on every page",
      "Good descriptions increase CTR even without ranking changes — more clicks = more traffic from same position",
    ),
    mkTask("onpage", "medium", "medium",
      `Fix H1-H3 Heading Structure on ${pagesNeedingH1.length > 0 ? pagesNeedingH1.length : "All"}Pages`,
      `Ensure unique H1 on each page with keyword. ${pagesNeedingH1.length > 0 ? `${pagesNeedingH1.length} pages missing H1: ${pagesNeedingH1.slice(0, 3).map(p => p.url).join(", ")}` : "Check H2-H3 hierarchy on all pages."}`,
      2, pagesNeedingH1[0]?.url || null,
      "Every page has unique H1 and proper hierarchy",
      "Heading structure helps Google and AI understand content organization and page topic",
    ),
  ]));

  // Day 5: Images + internal linking
  days.push(mkDay(5, "Optimize Images and Internal Linking", [
    mkTask("onpage", "medium", "medium",
      `Add Alt Text to ${pagesNeedingAlt.length > 0 ? pagesNeedingAlt.length + " Pages Missing Alt" : "All Images"}`,
      `Scan all images on ${domain}. Add descriptive alt text with keywords. ${pagesNeedingAlt.length > 0 ? `Pages missing alt: ${pagesNeedingAlt.slice(0, 3).map(p => p.url).join(", ")}` : "Ensure alt text is not duplicated."} Compress to WebP format.`,
      3, pagesNeedingAlt[0]?.url || null,
      "100% of images have alt text, WebP format",
      "Images without alt text are missed opportunity — Google uses alt for content understanding, improves accessibility",
    ),
    mkTask("onpage", "high", "high",
      `Build Internal Link Map for ${domain}`,
      `Create Hub & Spoke structure: main pages (Hubs) link to 3-5 relevant pages (Spokes). Ensure every page is reachable within 3 clicks from home. Add breadcrumbs if missing. Key pages: ${pages.slice(0, 3).map(p => p.title || p.url).join(", ")}`,
      3, null,
      "Every page has 3+ internal links, Hub & Spoke active",
      "Internal links distribute authority (link equity) and help Google understand site structure — simple change with high impact",
    ),
  ]));

  // Day 6: OG + Canonical + Structured Data prep
  const gbpLocation = businessProfile?.location || loc || "your location";
  days.push(mkDay(6, "Add Open Graph Tags, Set Canonical, Structure Data Foundation", [
    ...(needsOG ? [mkTask("onpage", "medium", "medium",
      "Add Open Graph Tags to Every Page",
      `Add og:title, og:description, og:image, og:url to all pages on ${domain}. Ensure images are at least 1200x630 pixels. Test with Facebook Sharing Debugger.`,
      2, null,
      "Social shares display professionally across platforms",
      "OG tags control how your site looks when shared — professional preview = more clicks from social",
    )] : []),
    mkTask("technical", "medium", "medium",
      "Set Up Google Business Profile (GBP)",
      `Create or update GBP for ${input.clientName}${gbpLocation ? ` in ${gbpLocation}` : ""}. Complete 100%: name, address, phone, hours, categories (primary + 3 secondary), keyword-rich description, photos (logo + cover + 5 additional).`,
      2.5, null,
      "GBP 100% complete with photos and categories",
      "GBP is the #1 local ranking factor — complete profile gets 7x more clicks than incomplete",
    ),
    mkTask("analytics", "medium", "medium",
      `Submit to Bing Webmaster Tools${scan?.cmsDetected === "WordPress" ? " and Yoast/RankMath" : " and SEO Tools"}`,
      `Submit ${domain} to Bing Webmaster Tools (Copilot uses Bing). ${scan?.cmsDetected === "WordPress" ? "Install Yoast or RankMath for SEO management." : "Ensure SEO tools are configured correctly."}`,
      1.5, null,
      "Bing WMT connected, SEO tools configured",
      "Bing Webmaster Tools matters because Microsoft Copilot and Bing-powered ChatGPT use Bing data — this is the AI world",
    ),
  ]));

  // Day 7: Week 1 review + baseline
  days.push(mkDay(7, "Week 1 Summary & Establish Baseline Metrics", [
    mkTask("analytics", "high", "high",
      "Document Baseline — Current Scores Before Optimization",
      `Document baseline metrics: GSC rankings (average position, CTR), organic traffic, Core Web Vitals, DA (${scan?.domainAuthority || "?"}), indexed pages (${scan?.indexedPages || "?"}), AI visibility (${mentionedQueries.length}/${vis.length} queries).`,
      2, null,
      "Complete baseline spreadsheet with all metrics",
      "Without baseline you cannot measure improvement — need accurate reference point before starting",
    ),
    mkTask("analytics", "medium", "medium",
      "Week 1 Summary — What's Done and Next Steps",
      `Write summary: what was fixed (SSL${needsSSL ? " ✓" : ""}, speed, sitemap, meta), what remains, initial KPIs. Share with client.`,
      1.5, null,
      "Complete weekly report ready to send to client",
      "Weekly summary maintains transparency with client and verifies plan is on schedule",
    ),
  ]));

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Days 8-20 — Content Gap Closure
  // ═══════════════════════════════════════════════════════════════════

  // Day 8: Keyword research based on actual gaps
  const topGaps = [...highPriorityGaps, ...mediumPriorityGaps].slice(0, 15);
  days.push(mkDay(8, "In-Depth Keyword Research Based on Content Gaps", [
    mkTask("content", "high", "high",
      `Map ${topGaps.length > 0 ? topGaps.length : keywords.length} Core Keywords`,
      `Based on ${gaps.length} identified content gaps and ${keywords.length} target keywords: research search volume (Google Keyword Planner / Ahrefs), ranking difficulty, search intent. Prioritize by: volume × relevance × difficulty. Keywords: ${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? "..." : ""}`,
      4, null,
      "Prioritized keyword map with volume, difficulty, and intent",
      "Research based on actual gaps (from AI scan) not guesses — each keyword represents an identified opportunity",
    ),
    mkTask("content", "medium", "medium",
      "Analyze Search Intent and Map to Existing Pages",
      `Categorize each keyword: informational (guides), commercial (comparisons), transactional (purchase). Map to existing pages or mark 'new page needed'. ${topGaps.slice(0, 3).map(g => `"${g.query}" → ${g.intent}`).join("; ")}`,
      2.5, null,
      "Every keyword mapped to existing page or planned new page",
      "Content that doesn't match search intent won't rank — informational ≠ transactional",
    ),
  ]));

  // Days 9-11: Writing content for top gaps
  const contentDays = [9, 10, 11];
  contentDays.forEach((d, idx) => {
    const gap = topGaps[idx];
    const kw = gap?.query || keywords[idx] || `Topic #${idx + 1}`;
    const pageUrl = pages.find(p => p.wordCount > 300)?.url || null;

    days.push(mkDay(d, `Write Expert Article: "${kw}"`, [
      mkTask("content", "high", "high",
        `Write 1500+ Word Article: "${kw}"`,
        `Write expert, in-depth article answering "${kw}". Structure: headline with keyword, intro (150 words), 4-6 subsections with H2/H3, conclusion with CTA. Include data, examples, expert quotes. Add FAQ with 3-5 questions at bottom.`,
        5, pageUrl,
        `Article published, optimized for "${kw}", ranked and AI-ready`,
        gap ? `Query identified as gap — ${input.clientName} missing from ${missedQueries.length > 0 ? "AI responses" : "search results"} for this` : "Core keyword missing from site",
        `Article: "${kw}"\nLength: 1500+ words\nTarget audience: ${loc || "your market"}\nStructure:\n1. Introduction — what's the problem/need\n2. ${kw} — comprehensive explanation\n3. Benefits / Methods / Tips\n4. Examples / Case Studies\n5. FAQ (3-5 questions)\n6. Conclusion + CTA\nSecondary keywords: ${keywords.slice(0, 3).join(", ")}`,
      ),
      mkTask("onpage", "medium", "medium",
        `Optimize Article — Meta, Schema, Links`,
        `Add to article: Title tag with "${kw}", Meta Description with CTA, FAQ Schema (JSON-LD), 3+ internal links to relevant pages, 1 external authority link.`,
        1, null,
        "SEO-optimized article with targeted Schema",
        "Unoptimized article is like a store with no sign — content is only half the work",
      ),
    ]));
  });

  // Day 12: Update existing thin content
  days.push(mkDay(12, "Upgrade Thin Existing Content", [
    mkTask("content", "high", "high",
      `Upgrade ${Math.min(thinPages.length, 5) || 5} Pages with Thin Content`,
      `${thinPages.length > 0 ? `Found ${thinPages.length} pages with less than 300 words: ${thinPages.slice(0, 3).map(p => p.url).join(", ")}` : `Update 5 key pages on ${domain}`}. For each: expand to 800+ words, add H2/H3, integrate keywords, add FAQ, update date.`,
      4, thinPages[0]?.url || null,
      "All thin pages expanded to 800+ words",
      "Thin content pages are vulnerable to penalties — expansion = ranking improvement",
    ),
    mkTask("content", "medium", "medium",
      "Add Visual Content — Infographics and Tables",
      `Add infographic, table, or chart to 3 key articles. Visual content increases time on page and shareability. Use Canva or similar tool.`,
      3, null,
      "3 articles with unique visual content",
      "Visual content increases time on page by 80% and gets shared 3x more — AI engines prefer rich content",
    ),
  ]));

  // Days 13-14: More content for missed queries
  [13, 14].forEach((d, idx) => {
    const gap = topGaps[3 + idx];
    const kw = gap?.query || keywords[3 + idx] || `Topic ${idx + 4}`;
    days.push(mkDay(d, `AI-Optimized Article: "${kw}"`, [
      mkTask("content", "high", "high",
        `Write AI-Optimized Article: "${kw}"`,
        `Write article directly answering "${kw}" in AI-preferred format: direct answer in first paragraph, numbered lists, clear definitions, cited data sources. ${gap ? `Gap identified: ${input.clientName} not mentioned in AI responses for this query.` : ""}`,
        5, null,
        `AI-friendly article published, optimized for "${kw}"`,
        "AI engines prefer structured content with direct answers — different format from classic SEO",
        `AI-Optimized Article: "${kw}"\nLength: 1200+ words\nFormat: Direct answer in opening (50 words) → extended explanation → numbered list → FAQ\nImportant: Include business name (${input.clientName}) naturally 2-3 times`,
      ),
    ]));
  });

  // Day 15: Landing pages for location
  days.push(mkDay(15, `Location-Based Landing Pages${locStr}`, [
    mkTask("content", "high", "high",
      `Create Location Landing Page: "${keywords[0] || "Services"}${locStr}"`,
      `Create location-focused landing page${locStr}: H1 with keyword + location, 800+ words of content, embedded map, address + phone, local reviews, LocalBusiness Schema. URL: /${keywords[0] ? keywords[0].replace(/\s/g, "-") : "services"}${loc ? "-" + loc.replace(/\s/g, "-") : ""}`,
      4, null,
      `Live landing page${locStr} with local Schema`,
      `Location landing pages rank high for searches like "${keywords[0] || "service"}${locStr}" — especially important for local businesses`,
      `Landing Page: "${keywords[0] || "Service"}${locStr}"\nH1: Professional ${keywords[0] || "Service"}${locStr}\nSections: About us, Services, Why choose us, Reviews, Contact\nSchema: LocalBusiness + Service`,
    ),
    mkTask("local", "medium", "medium",
      "Ensure NAP Consistency Across All Platforms",
      `Verify ${input.clientName}'s name, address, and phone are consistent on: GBP, Facebook, LinkedIn, Waze, business directories. Update any inconsistencies.`,
      2, null,
      "NAP 100% consistent across all platforms",
      "NAP inconsistencies confuse Google and erode trust — must be identical everywhere",
    ),
  ]));

  // Days 16-18: More content articles
  [16, 17, 18].forEach((d, idx) => {
    const gapIdx = 5 + idx;
    const gap = topGaps[gapIdx];
    const kw = gap?.query || keywords[gapIdx] || `Content #${gapIdx + 1}`;

    days.push(mkDay(d, `Targeted Content: "${kw}"`, [
      mkTask("content", "high", "high",
        `Write Article/Guide: "${kw}"`,
        `${gap ? `Content gap identified: "${gap.query}" (${gap.intent}, ${gap.importance}). ` : ""}Write expert guide 1200+ words. Include: clear definitions, numbered steps, practical tips, CTA. Naturally incorporate ${input.clientName}.`,
        4, null,
        `Article published and optimized for "${kw}"`,
        gap ? `AI doesn't mention ${input.clientName} for "${gap.query}" — targeted content will change that` : "Important keyword that needs coverage",
      ),
    ]));
  });

  // Day 19: Content calendar
  days.push(mkDay(19, "Build 3-Month Content Calendar and Distribution Strategy", [
    mkTask("content", "medium", "medium",
      "Create Content Calendar for Next 3 Months",
      `Create calendar: 2 articles/month, 1 content update, 4 social posts. Base on: ${topGaps.length} gaps, ${keywords.length} keywords, seasonality. Prioritize by ROI.`,
      3, null,
      "Content calendar scheduled for 3 months",
      "Consistency in content publishing matters — Google and AI favor active sites",
    ),
    mkTask("content", "medium", "medium",
      "Set Up Content Distribution Channels",
      `Define channels: Google Business (weekly posts), LinkedIn, Facebook, Newsletter. Every new article → share across all channels within 24 hours.`,
      1.5, null,
      "Distribution process defined for all new content",
      "Undistributed content doesn't get links or social signals — distribution is as important as writing",
    ),
  ]));

  // Day 20: Phase 2 review
  days.push(mkDay(20, "Phase 2 Summary — Measure Content Progress", [
    mkTask("analytics", "high", "medium",
      "Measure Performance of New Content",
      `Check GSC: are new articles indexed? What's the CTR? What's the initial ranking? Compare to Day 7 baseline. Document: ${days.filter(d => d.phase === PHASES[1].name).reduce((s, d) => s + d.tasks.length, 0)} tasks completed.`,
      2, null,
      "Complete Phase 2 progress report",
      "Important to measure impact of new content — fast indexing = good sign",
    ),
    mkTask("analytics", "medium", "low",
      "Client Update — Midpoint Summary",
      `Prepare brief presentation: what was done in 20 days, ${topGaps.length} gaps closed, initial metrics, plan for remainder.`,
      1.5, null,
      "Midpoint report ready to send",
      "Transparency with client is critical — shows value and maintains trust",
    ),
  ]));

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Days 21-35 — GEO Optimization & FAQ/Schema
  // ═══════════════════════════════════════════════════════════════════

  // Day 21: Schema implementation
  days.push(mkDay(21, "Implement Schema.org — LocalBusiness & FAQ", [
    mkTask("ai_optimization", "high", "critical",
      `Implement LocalBusiness Schema on ${domain}`,
      `Add JSON-LD LocalBusiness Schema to home page: name (${input.clientName}), address (${locStr}), telephone, openingHours, image, url, geo coordinates, sameAs (social profiles). Validate with Google Rich Results Test.`,
      3, scan?.url || null,
      "LocalBusiness Schema implemented and verified",
      "Schema is how AI engines and Google understand your business — without it, AI doesn't know you exist",
    ),
    mkTask("ai_optimization", "high", "high",
      "Implement FAQ Schema on Key Pages",
      `Add FAQPage Schema (JSON-LD) to 3 key pages. Use questions from AI scan: ${missedQueries.slice(0, 3).map(q => `"${q.query}"`).join(", ")}. Each question with complete answer including business name.`,
      2.5, null,
      "FAQ Schema on 3+ pages, passes Rich Results Test",
      "FAQ Schema appears as rich results and AI engines pull answers directly — fastest way to get into AI responses",
    ),
  ]));

  // Day 22: More Schema types
  days.push(mkDay(22, "Advanced Schema — Service, BreadcrumbList, Article", [
    mkTask("ai_optimization", "high", "high",
      "Implement Service Schema and BreadcrumbList",
      `Add Service Schema to every service page (name, description, provider, areaServed${locStr}). Add BreadcrumbList Schema to all pages. Ensure Article Schema on every blog post.`,
      3, null,
      "Service + BreadcrumbList + Article Schema implemented",
      "Service Schema helps AI understand what your business offers — BreadcrumbList improves navigation in search results",
    ),
    mkTask("ai_optimization", "medium", "medium",
      "Complete Schema Validation Audit",
      `Run Google Rich Results Test on every page with Schema. Fix errors and warnings. Ensure Google and Bing recognize all Schema. Check with schema.org validator.`,
      1.5, null,
      "0 Schema errors, 100% validated",
      "Broken Schema is worse than no Schema — Google ignores invalid Schema",
    ),
  ]));

  // Days 23-25: GEO-specific content optimization
  const aiEngines = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Copilot"];
  const engineStats = aiEngines.map(eng => {
    const mentioned = vis.filter(v => (v.results || []).some(r => r.engine === eng && r.mentioned)).length;
    return { engine: eng, mentioned, total: vis.length, pct: vis.length > 0 ? Math.round((mentioned / vis.length) * 100) : 0 };
  });
  const weakestEngine = engineStats.sort((a, b) => a.pct - b.pct)[0];

  days.push(mkDay(23, `Optimize for ${weakestEngine?.engine || "ChatGPT"} — Weakest Engine`, [
    mkTask("ai_optimization", "high", "high",
      `Improve Visibility on ${weakestEngine?.engine || "ChatGPT"} (${weakestEngine?.pct || 0}% currently)`,
      `${weakestEngine?.engine || "ChatGPT"} only mentions ${input.clientName} in ${weakestEngine?.mentioned || 0} of ${weakestEngine?.total || 0} queries. Strategy: 1) Add direct answers to missing queries on site pages, 2) Create profile on ${weakestEngine?.engine === "Copilot" ? "Bing Places" : weakestEngine?.engine === "Gemini" ? "Google Knowledge Graph" : "authority sites the engine crawls"}, 3) Publish content on platforms the engine trusts.`,
      3, null,
      `Improve ${weakestEngine?.engine || "ChatGPT"} visibility by 20%+`,
      `${weakestEngine?.engine || "ChatGPT"} is where ${input.clientName} is weakest — improvement here gives biggest ROI`,
    ),
    mkTask("ai_optimization", "medium", "medium",
      "Build Topical Authority Map",
      `Identify 3-5 core topics where ${input.clientName} should be the authority. For each: 1 pillar article + 3-4 cluster articles. Link them with internal links. Topics: ${keywords.slice(0, 3).join(", ")}`,
      2, null,
      "Topical Authority map with Pillar-Cluster structure",
      "AI engines prefer sources with topical authority — Pillar-Cluster structure appears more authoritative",
    ),
  ]));

  days.push(mkDay(24, "Build Central FAQ Page with Schema", [
    mkTask("content", "high", "critical",
      `Write Central FAQ Page with ${Math.min(vis.length, 20)} Questions`,
      `Create dedicated FAQ page at ${domain}/faq. Include ${Math.min(vis.length, 20)} questions from AI scan. Each answer: 100-200 words, direct, includes business name. Questions: ${missedQueries.slice(0, 5).map(q => `"${q.query}"`).join(", ")}${missedQueries.length > 5 ? "..." : ""}`,
      5, null,
      `Live FAQ page with ${Math.min(vis.length, 20)}+ questions and answers`,
      "FAQ page is the #1 source where AI engines pull answers — each answered question = opportunity to appear in AI response",
      `FAQ Page: ${domain}/faq\n${missedQueries.slice(0, 10).map((q, i) => `${i + 1}. "${q.query}"\n   Answer: [Direct 100-200 word answer including "${input.clientName}"]`).join("\n")}`,
    ),
  ]));

  // Days 25-28: Continued GEO work
  days.push(mkDay(25, "Build E-E-A-T — Expertise, Experience, Authority, Trust", [
    mkTask("ai_optimization", "high", "high",
      "Build Professional About Us Page with E-E-A-T",
      `Upgrade About page: business story, experience (years, projects), credentials, team photos, testimonials, media coverage. Add Person Schema + Organization Schema.`,
      3, null,
      "Professional About page with complete E-E-A-T",
      "Google and AI engines evaluate E-E-A-T (Expertise, Experience, Authoritativeness, Trustworthiness) — this is what makes them trust your content",
    ),
    mkTask("ai_optimization", "medium", "medium",
      "Add Author Bio and Credentials to Every Article",
      `Add author biography to every blog article. Include: name, title, experience, LinkedIn profile link. Add Person Schema.`,
      2, null,
      "Every article with Author Bio and Schema",
      "Content with identified author gets more trust from AI engines — authorship is a trust signal",
    ),
  ]));

  days.push(mkDay(26, `Strengthen AI Visibility — Focus on ${mentionedQueries.length > 0 ? "Strong Queries" : "New Queries"}`, [
    mkTask("ai_optimization", "high", "high",
      `Optimize Content for ${missedQueries.length} Missing AI Queries`,
      `For each missed query: find relevant page on site, add paragraph directly answering the query, include business name. Queries: ${missedQueries.slice(0, 5).map(q => `"${q.query}"`).join(", ")}`,
      4, null,
      `${Math.min(missedQueries.length, 10)} queries with direct answers on site`,
      "AI engines pull content from your site — if answer exists on your site, AI is much more likely to use it",
    ),
  ]));

  // Days 27-30: Advanced AI visibility work
  [27, 28, 29, 30].forEach((d) => {
    const dayTasks: DayTask[] = [];
    if (d === 27) {
      dayTasks.push(mkTask("ai_optimization", "high", "high",
        "Build Professional Glossary / Terms Dictionary",
        `Create glossary page (${domain}/glossary) with 20+ professional definitions. Each definition: 50-100 words, clear, accurate. Add DefinedTerm Schema.`,
        4, null,
        "Live Glossary page with 20+ definitions and Schema",
        "Glossary is preferred source for AI engines — clear definitions increase chance of appearing in responses",
      ));
    } else if (d === 28) {
      dayTasks.push(mkTask("content", "high", "high",
        `Write Comprehensive Guide: "Everything About ${keywords[0] || "Topic"}"`,
        `Pillar Content: 3000+ word guide covering ${keywords[0] || "topic"} comprehensively. Include: executive summary, infographic, FAQ, links to 5+ articles on site. This is your Hub Content.`,
        6, null,
        "Pillar guide published — most authoritative page on site",
        "Pillar Content is Topical Authority strategy — central page linking to all relevant articles",
        `Pillar Guide: "${keywords[0] || "Topic"} — Comprehensive Guide ${new Date().getFullYear()}"\nLength: 3000+ words\nSections:\n1. Overview\n2. ${keywords[1] || "Subtopic 1"}\n3. ${keywords[2] || "Subtopic 2"}\n4. ${keywords[3] || "Subtopic 3"}\n5. Common Mistakes\n6. Advanced Tips\n7. FAQ\n8. Conclusion\nInternal links: ${pages.slice(0, 5).map(p => p.url).join(", ")}`,
      ));
    } else if (d === 29) {
      dayTasks.push(mkTask("local", "high", "high",
        "Google Reviews Strategy — Proactive Collection Process",
        `Set up review collection process: 1) Create direct GBP review link, 2) Send automated email to customers 48 hours after service, 3) Add review CTA on site and in email. Goal: 5+ new reviews per month.`,
        2.5, null,
        "Active review process, 5+ new reviews",
        "Google reviews are strong trust signal — AI engines also treat reviews as E-E-A-T evidence",
      ));
      dayTasks.push(mkTask("local", "medium", "medium",
        `Submit to 10 Local Business Directories${locStr}`,
        `List ${input.clientName} on: directories, review sites, Yelp, Trustpilot, LinkedIn Company, Facebook Business, Waze Business, and others. Ensure consistent NAP.`,
        2.5, null,
        "Active profile on 10+ directories",
        "Citations (directory listings) are local ranking signal — more citations = more local authority",
      ));
    } else {
      dayTasks.push(mkTask("ai_optimization", "medium", "medium",
        "Re-check AI Visibility — Measure Changes",
        `Re-run top 10 queries on 5 AI engines. Compare to baseline: how many new queries mention ${input.clientName}? Which engines improved?`,
        2.5, null,
        "Updated AI visibility report for comparison",
        "Re-measurement after 3 weeks gives early indication — Schema + FAQ + new content should start working",
      ));
      dayTasks.push(mkTask("analytics", "medium", "low",
        "Weekly Report — Phase 3 Summary",
        `Write report: Schema deployed (types, pages), FAQ published (questions), AI visibility (changes), new reviews. Send to client.`,
        1.5, null,
        "Phase 3 report complete",
        "Ongoing transparency maintains client trust and demonstrates value",
      ));
    }
    const ph = phaseFor(d);
    days.push(mkDay(d, dayTasks[0]?.title.substring(0, 50) || `Day ${d}`, dayTasks));
  });

  // Days 31-35: Video and content optimization
  days.push(mkDay(31, "Create Video Content and Multimedia", [
    mkTask("content", "medium", "medium",
      `Create 2-3 Short Videos (60-90 seconds) on ${keywords[0] || "Topic"}`,
      `Create/shoot videos: 1) Who we are (30 seconds), 2) ${keywords[0] || "Expert tip"} (60 seconds), 3) FAQ (most common question). Upload to YouTube with SEO-focused title, description, tags.`,
      4, null,
      "3 videos on site and YouTube with SEO",
      "YouTube is the second-largest search engine — ChatGPT and Gemini also pull information from YouTube",
    ),
  ]));

  [32, 33].forEach((d, idx) => {
    const gap = topGaps[8 + idx];
    const kw = gap?.query || keywords[8 + idx] || `Content ${idx + 8}`;
    days.push(mkDay(d, `AI-Optimized Content: "${kw}"`, [
      mkTask("content", "high", "high",
        `Write AI-Optimized Article: "${kw}"`,
        `Write AI-focused article for "${kw}": opening paragraph with direct answer, numbered lists, definition boxes, data with sources. Mention ${input.clientName} naturally 2-3 times. Add FAQ Schema.`,
        4.5, null,
        `Live AI-optimized article, indexed`,
        gap ? `Gap identified in AI: "${gap.query}" — must cover this` : "Strategic keyword",
      ),
    ]));
  });

  days.push(mkDay(34, "Audit Schema and Rich Results", [
    mkTask("ai_optimization", "medium", "medium",
      `Validate All Schema on ${domain} — Complete Audit`,
      `Test every page with Schema using Rich Results Test. Document: how many pages have Schema, how many pass, how many appear as rich results in GSC. Fix issues.`,
      2.5, null,
      "100% Schema validated, Rich Results report",
      "Working Schema = Rich Results = Higher CTR = More traffic",
    ),
  ]));

  days.push(mkDay(35, "Phase 3 Summary — AI Visibility Milestone", [
    mkTask("analytics", "high", "medium",
      "Interim Report: Schema + FAQ + AI Visibility",
      `Write report: Schema deployed (${pagesNeedingSchema.length > 0 ? `${pagesNeedingSchema.length} pages upgraded` : "all pages"}), FAQ published, AI visibility (before/after), Rich Results status, new reviews. Include screenshots.`,
      2, null,
      "Comprehensive Phase 3 report",
      "Key milestone — 35 days = over halfway through, must show initial results",
    ),
  ]));

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: Days 36-50 — Competitor Strategy & Authority
  // ═══════════════════════════════════════════════════════════════════

  const competitorsList = competitors.length > 0 ? competitors.slice(0, 3).join(", ") : "identified competitors";
  days.push(mkDay(36, "In-Depth Competitor Analysis", [
    mkTask("offpage", "high", "high",
      `Analyze Backlink Profile of ${Math.min(competitors.length, 3) || 3} Competitors`,
      `Use Ahrefs or Moz to analyze: ${competitorsList}. Document: DA, link count, referring domains, anchor texts. Identify opportunities: sites linking to competitors but not to ${domain}.`,
      4, null,
      "List of 20+ potential link opportunity sites",
      "Links are still the #1 ranking factor — must understand where competitors get theirs",
    ),
    mkTask("offpage", "medium", "medium",
      `Identify Content Gaps vs Competitors`,
      `Compare ${domain} content vs ${competitors[0] || "leading competitor"}: keywords they rank for but you don't. Prioritize by volume and difficulty.`,
      2.5, null,
      "List of keywords competitors use that we don't",
      "Opportunities competitors already use = proven demand — easier to justify investment",
    ),
  ]));

  // Days 37-40: Link building
  days.push(mkDay(37, "Link Building Strategy — Launch Phase", [
    mkTask("offpage", "high", "high",
      "Write Guest Post for Authority Site",
      `Write 800+ word guest article for DA 30+ site. Topic: ${keywords[0] || "core topic"}. Include natural link to ${domain}. Identify 5 potential sites from competitor analysis list.`,
      5, null,
      "Guest post published with domain link",
      "Link from authority site worth more than 100 from weak sites — Guest Post is most efficient method",
    ),
    mkTask("offpage", "medium", "medium",
      "Digital PR — Create Newsworthy Content",
      `Create shareable content: original statistic, survey, comprehensive guide, infographic. Pitch to 3 journalists/bloggers in industry with focused angle.`,
      3, null,
      "PR campaign with 3+ pitches sent",
      "Digital PR generates quality links + media mentions — two signals AI engines value",
    ),
  ]));

  [38, 39, 40].forEach((d, idx) => {
    const dayTasksArr: DayTask[] = [];
    if (d === 38) {
      dayTasksArr.push(mkTask("offpage", "high", "high",
        "Build Links from Directories and Resource Pages",
        `Submit to 10 professional directories and resource pages identified in competitor analysis. Include keyword-focused business description, link, and accurate category.`,
        3, null,
        "10+ submissions to directories and resource pages",
        "Directory citations strengthen digital presence — AI engines check presence across the web",
      ));
    } else if (d === 39) {
      dayTasksArr.push(mkTask("content", "high", "high",
        `Write ${keywords[1] || "Topic #2"} — Competitor Counter`,
        `Write article outperforming ${competitors[0] || "leading competitor"} on "${keywords[1] || "Topic #2"}": deeper, more current, better structured, with new data.`,
        5, null,
        "Article better than competitor — Skyscraper Technique",
        "Skyscraper Technique: create better content than competitor, reach out to sites linking to theirs — proven link-building method",
      ));
    } else {
      dayTasksArr.push(mkTask("offpage", "medium", "medium",
        "Follow Up Guest Posts + Additional Outreach",
        `Check status of sent guest posts. Send 5 more pitches. Look for HARO (Help a Reporter Out) / Qwoted / SourceBottle opportunities.`,
        3, null,
        "5+ additional pitches, follow-up on pending",
        "Link building is a marathon not a sprint — need consistent outreach",
      ));
    }
    days.push(mkDay(d, dayTasksArr[0]?.title.substring(0, 50) || `Day ${d}`, dayTasksArr));
  });

  // Days 41-45: Advanced authority
  [41, 42, 43, 44, 45].forEach((d) => {
    const dayTasksArr: DayTask[] = [];
    if (d === 41) {
      dayTasksArr.push(mkTask("ai_optimization", "high", "high",
        `Strengthen Presence on AI Platforms`,
        `Create/update profiles: Bing Places (for Copilot), Google Knowledge Panel (for Gemini), Wikipedia (if relevant), Crunchbase, LinkedIn Company. Ensure consistent information.`,
        3, null,
        "Active profiles on 3+ AI platforms",
        "AI engines pull information from specific platforms — presence there = much higher chance of appearing in responses",
      ));
    } else if (d === 42) {
      dayTasksArr.push(mkTask("content", "high", "high",
        `Write Case Study / Success Story`,
        `Write detailed case study: the problem, solution, results (with numbers). Include client quote, before/after photos. Add Article Schema. Strong E-E-A-T content.`,
        4, null,
        "Case study published with Schema",
        "Case studies are best proof of Experience and Expertise — two critical E-E-A-T components",
      ));
    } else if (d === 43) {
      dayTasksArr.push(mkTask("offpage", "medium", "medium",
        "Guest Post #2 + Podcast/Interview",
        `Write second guest post for another site. Also pitch podcasts in industry for interviews — podcasts build authority and generate backlinks.`,
        4.5, null,
        "Guest Post #2 + podcast pitch",
        "Diverse link sources matter — Google values links from variety of site types",
      ));
    } else if (d === 44) {
      dayTasksArr.push(mkTask("local", "medium", "medium",
        "Collect Reviews + Respond to Existing Reviews",
        `Send review requests to 10 customers. Respond to all existing reviews (positive and negative) on GBP. Include keywords naturally in responses.`,
        2, null,
        "10 requests sent, all reviews answered",
        "Responding to reviews improves trustworthiness — Google and AI see you're responsive and engaged",
      ));
    } else {
      dayTasksArr.push(mkTask("content", "high", "high",
        `Update and Upgrade 3 Old Articles`,
        `Update 3 oldest articles on ${domain}: add new information, update dates, improve format, add FAQ, integrate keywords from phase 2.`,
        3.5, null,
        "3 old articles upgraded and updated",
        "Updating old content gives immediate boost — Google prefers fresh and updated content",
      ));
    }
    days.push(mkDay(d, dayTasksArr[0]?.title.substring(0, 50) || `Day ${d}`, dayTasksArr));
  });

  // Days 46-50: Social signals + authority consolidation
  [46, 47, 48, 49, 50].forEach((d) => {
    const dayTasksArr: DayTask[] = [];
    if (d === 46) {
      dayTasksArr.push(mkTask("offpage", "medium", "medium",
        "Social Signals — Massive Content Sharing",
        `Share all new articles: LinkedIn (5 posts), Facebook, Twitter/X, Quora (answers with link), Reddit (if relevant). Each platform with tailored format.`,
        3, null,
        "All content shared on 4+ platforms",
        "Social signals are indirect ranking signals — AI engines also scan social media",
      ));
    } else if (d === 47) {
      dayTasksArr.push(mkTask("offpage", "high", "high",
        "Broken Link Building — Find Opportunities",
        `Search for broken links on competitor and authority sites. Contact owners and offer your content as replacement. Tool: Ahrefs Broken Link Checker.`,
        3, null,
        "5+ broken link building opportunities identified",
        "Broken Link Building is win-win — you help site owner fix link and get backlink",
      ));
    } else if (d === 48) {
      dayTasksArr.push(mkTask("content", "medium", "medium",
        `Write Comparison / "vs" Article`,
        `Write comparison article: "${keywords[0] || "Service A"} vs ${keywords[1] || "Service B"}" — format AI engines prefer. Include: comparison table, pros/cons, recommendation.`,
        4, null,
        "Comparison article published with table",
        "Comparison articles attract transactional traffic and AI engines love using them for answers",
      ));
    } else if (d === 49) {
      dayTasksArr.push(mkTask("analytics", "medium", "medium",
        "Measure Backlink Profile — What Was Built?",
        `Check GSC > Links: how many new backlinks? From which sites? What's the DA? Compare to baseline. Document all links built in phase 4.`,
        2, null,
        "Updated backlink report with baseline comparison",
        "Backlink measurement shows ROI of link-building effort — need at least 5+ new links",
      ));
    } else {
      dayTasksArr.push(mkTask("analytics", "high", "medium",
        "Phase 4 Summary — Competitors and Authority",
        `Report: new links (count, average DA), guest posts, new reviews, social presence, ranking changes. Compare to day 7 baseline.`,
        2, null,
        "Comprehensive Phase 4 report",
        "Phase summary demonstrates authority investment — fruit will come in next 30-60 days",
      ));
    }
    days.push(mkDay(d, dayTasksArr[0]?.title.substring(0, 50) || `Day ${d}`, dayTasksArr));
  });

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 5: Days 51-60 — Optimization, Reporting & Second Scan
  // ═══════════════════════════════════════════════════════════════════

  days.push(mkDay(51, "Advanced Optimization — Core Web Vitals", [
    mkTask("technical", "high", "high",
      "Second Core Web Vitals Scan and Fix",
      `Run PageSpeed Insights on 10 key pages. Compare to day 1 baseline. Fix: LCP (ensure < 2.5s), FID (< 100ms), CLS (< 0.1). ${isModerate || isSlow ? `Speed was ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)}s — check what improved.` : ""}`,
      3, scan?.url || null,
      "All Core Web Vitals green",
      "Core Web Vitals are critical ranking factor — improvement after 50 days should be significant",
    ),
  ]));

  days.push(mkDay(52, "Second Technical Scan — Before vs After", [
    mkTask("technical", "high", "high",
      `Complete Second Technical Scan of ${domain}`,
      `Run Screaming Frog or Sitebulb. Compare to day 1 scan: how many 404 errors fixed? How many new pages indexed? Meta tag status? How many pages have Schema?`,
      3, null,
      "Second scan report with baseline comparison",
      "Second scan proves what was fixed and what remains — foundation for final report",
    ),
  ]));

  days.push(mkDay(53, "Second AI Visibility Scan", [
    mkTask("ai_optimization", "high", "critical",
      `Re-check AI Visibility — ${vis.length} Queries on 5 Engines`,
      `Re-run all ${vis.length} queries on 5 AI engines. Document: how many new queries mention ${input.clientName}? Which engines improved? What's the sentiment? Baseline: ${mentionedQueries.length}/${vis.length} (${vis.length > 0 ? Math.round((mentionedQueries.length / vis.length) * 100) : 0}%).`,
      4, null,
      `Second AI visibility report — complete before/after`,
      "Second scan is the moment of truth — all 50 days of work should show as AI visibility improvement",
    ),
  ]));

  days.push(mkDay(54, "Analyze GSC — Rankings, CTR, Impressions", [
    mkTask("analytics", "high", "high",
      "In-Depth Google Search Console Analysis",
      `GSC > Performance > Compare (last 28 days vs 28 days prior): impression changes, clicks, CTR, average position. Filter by: new pages, new keywords, ranking improvements.`,
      3, null,
      "Detailed GSC report with before/after",
      "GSC is #1 truth source for SEO performance — changes there indicate success",
    ),
  ]));

  days.push(mkDay(55, "Optimize High-Potential Pages", [
    mkTask("onpage", "high", "high",
      "Optimize Striking Distance — Pages Ranking 5-20",
      `In GSC > Performance: find pages ranking 5-20 with high impressions. For each: improve Title tag, expand content, add internal links, improve URL. These are the big quick wins.`,
      4, null,
      "5+ Striking Distance pages optimized",
      "Pages ranking 5-20 are closest to page 1 — small improvement can push them into top results",
    ),
  ]));

  days.push(mkDay(56, "A/B Testing — Title Tags", [
    mkTask("onpage", "medium", "medium",
      "A/B Test — Change Title Tags for CTR Improvement",
      `Select 5 pages with high impressions and low CTR (< 3%). Change Title tags with CTR hooks: numbers, current year, action words. Document and monitor for 2 weeks.`,
      2, null,
      "5 new Title Tags in A/B test",
      "CTR improvement from 2% to 4% = double traffic without ranking change — high ROI A/B testing",
    ),
    mkTask("content", "medium", "medium",
      "Update Seasonal and Timely Content",
      `Update 3 articles with current information: statistics for ${new Date().getFullYear()}, new trends, new products/services. Ensure title includes current year.`,
      2.5, null,
      "3 current articles with today's date",
      "Google loves freshness — content with current year gets higher CTR",
    ),
  ]));

  days.push(mkDay(57, "Prepare Final Report — Collect Data", [
    mkTask("analytics", "high", "high",
      "Collect All Data for 60-Day Report",
      `Collect: rankings (GSC), traffic (GA4), backlinks (Ahrefs/GSC), AI visibility (scan 2), Core Web Vitals, Google reviews, new pages, Schema status. Organize in clean spreadsheet.`,
      3, null,
      "Complete data spreadsheet for final report",
      "Data is the foundation of the report — need accurate before/after numbers",
    ),
  ]));

  days.push(mkDay(58, "Write Comprehensive Final Report", [
    mkTask("analytics", "high", "critical",
      `Write Final PIXEL SEO/GEO Report for ${input.clientName}`,
      `Write comprehensive report: executive summary, before/after status, technical findings, AI visibility (before/after), content created, links built, next steps, expected ROI.`,
      5, null,
      "Complete 60-day professional report",
      "The report is the main output of 60 days — must be professional and show value",
    ),
  ]));

  days.push(mkDay(59, "Client Presentation + Next Steps Plan", [
    mkTask("analytics", "medium", "medium",
      "Prepare Client Summary Presentation",
      `Create 10-15 slide deck: key highlights, before/after visuals, 3 major wins, 3 next opportunities. Include charts and screenshots.`,
      3, null,
      "Presentation ready for delivery to client",
      "Professional visual presentation convinces client to continue — text report alone is not enough",
    ),
    mkTask("analytics", "high", "high",
      "Build 90-Day Plan — Next Phase",
      `Based on 60-day results, build 90-day plan: what to repeat, what's new, updated goals. Prioritize: ${highPriorityGaps.length > 5 ? "remaining content gaps" : "continuous link building"}, AI visibility, authority.`,
      2.5, null,
      "90-day plan with updated goals",
      "SEO is a marathon — after 60 days you can plan next phase with data-driven goals",
    ),
  ]));

  days.push(mkDay(60, "Complete, Final Scan & Handoff", [
    mkTask("analytics", "high", "critical",
      "Final Scan + Close 60-Day Plan",
      `Run final scan: technical + AI visibility. Compare to Day 1. Document: ${scan ? `SSL ${scan.hasSSL ? "✓" : needsSSL ? "✗→✓" : "✓"}, speed ${(scan.loadTimeMs / 1000).toFixed(1)}s→?s, DA ${scan.domainAuthority}→?` : "complete before/after"}. Close all open items.`,
      3, null,
      "Complete final report — 60-day plan completed",
      "Final scan closes the loop — shows exactly what changed in 60 days of work",
    ),
    mkTask("analytics", "medium", "medium",
      "Hand Over All Assets to Client",
      `Organize and deliver: GSC, GA4, SEO tools access; keyword list; content map; backlink list; 3-month content calendar; Schema documentation; weekly maintenance guide.`,
      2, null,
      "All assets transferred and documented",
      "Professional handoff ensures client can continue work or transfer to next team",
    ),
  ]));

  // ─── Fill any missing days with continuation tasks ──────────────────
  const coveredDays = new Set(days.map(d => d.day));
  for (let d = 1; d <= 60; d++) {
    if (!coveredDays.has(d)) {
      const ph = phaseFor(d);
      days.push(mkDay(d, `Continue Work — ${ph.name}`, [
        mkTask(
          d <= 7 ? "technical" : d <= 20 ? "content" : d <= 35 ? "ai_optimization" : d <= 50 ? "offpage" : "analytics",
          "medium", "medium",
          `Continuation Task: ${ph.name}`,
          `Continue work on open tasks from previous days. Prioritize incomplete items and high-impact tasks.`,
          3, null,
          `Progress on phase ${ph.number} tasks`,
          "Days without new tasks are opportunity to finish opened work — better to complete than start new",
        ),
      ]));
    }
  }

  // Sort by day
  days.sort((a, b) => a.day - b.day);

  // Calculate totals
  const totalTasks = days.reduce((s, d) => s + d.tasks.length, 0);
  const totalHours = Math.round(days.reduce((s, d) => s + d.tasks.reduce((ts, t) => ts + t.effortHours, 0), 0));

  // Build phase overviews
  const phaseOverviews: PhaseOverview[] = PHASES.map(p => {
    const phaseDays = days.filter(d => d.phaseNumber === p.number);
    const phaseTasks = phaseDays.reduce((s, d) => s + d.tasks.length, 0);
    const phaseHours = Math.round(phaseDays.reduce((s, d) => s + d.tasks.reduce((ts, t) => ts + t.effortHours, 0), 0));
    return {
      number: p.number,
      name: p.name,
      dayRange: `${p.days[0]}-${p.days[1]}`,
      taskCount: phaseTasks,
      hours: phaseHours,
      focus: p.focus,
    };
  });

  return {
    days,
    totalTasks,
    totalHours,
    phases: phaseOverviews,
    generatedAt: now.toISOString(),
  };

  // ─── Helper: make a day ──────────────────────────────────────────
  function mkDay(day: number, focusTitle: string, tasks: DayTask[]): DayPlan {
    const ph = phaseFor(day);
    return {
      day,
      date: dayDate(day),
      phase: ph.name,
      phaseNumber: ph.number,
      focusTitle,
      tasks,
    };
  }

  // ─── Helper: make a task ──────────────────────────────────────────
  function mkTask(
    type: TaskCategory, priority: TaskPriority, impact: ImpactLevel,
    title: string, description: string,
    effortHours: number, relatedPageUrl: string | null,
    expectedOutcome: string, reason: string,
    contentBrief?: string,
  ): DayTask {
    return {
      id: mkId(),
      title,
      type,
      description,
      impactLevel: impact,
      effortHours,
      relatedPageUrl,
      expectedOutcome,
      reason,
      contentBrief: contentBrief || null,
    };
  }
}
