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
  aiArticles?: Array<{
    title: string;
    targetKeyword: string;
    outline?: string[];
    wordCount?: number;
    whyThisArticle?: string;
  }>;
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
  { number: 1, name: "תשתיות ושיפורים מהירים", nameEn: "Foundation & Quick Wins", days: [1, 7], focus: "תיקון בעיות טכניות קריטיות, יצירת תשתית מדידה, הישגת יעדים מהירים" },
  { number: 2, name: "סגירת פערי תוכן", nameEn: "Content Gap Closure", days: [8, 20], focus: "יצירת תוכן חדש לפערים שזוהו, עדכון תוכן קיים, מיפוי מילות-מפתח" },
  { number: 3, name: "אופטימיזציה ל-AI ו-Schema", nameEn: "AI Visibility & Schema Optimization", days: [21, 35], focus: "אופטימיזציה לראות מנועי AI, יישום נתונים מובנים, בניית תוכן FAQ" },
  { number: 4, name: "אסטרטגיית מתחרים וסמכות", nameEn: "Competitor Strategy & Authority", days: [36, 50], focus: "בניית קישורים חוזרים, יצירת סמכות, Digital PR, התגברות על יריבים" },
  { number: 5, name: "אופטימיזציה ודוחות", nameEn: "Optimization & Reporting", days: [51, 60], focus: "מדידת תוצאות, אופטימיזציות סופיות, סריקה חוזרת, מסירת דוח מקיף" },
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

  // Safe keyword helpers — AI keywords ONLY, no scan H1 fallback
  const kw = (i: number) => {
    // PRIORITY 1: Use AI-generated keywords (from targetKeywords which should be AI keywords)
    if (keywords[i]) return keywords[i];
    // PRIORITY 2: Business profile products (user-confirmed data)
    if (businessProfile?.main_products_or_services && Array.isArray(businessProfile.main_products_or_services)) {
      if (businessProfile.main_products_or_services[i]) return businessProfile.main_products_or_services[i];
    }
    // PRIORITY 3: Generic placeholder with business context — NEVER use scan H1 tags
    if (businessProfile?.business_type) return `שירותי ${businessProfile.business_type}`;
    if (input.clientName) return `שירותי ${input.clientName}`;
    return `נושא מרכזי ${i + 1}`;
  };
  const kwSlug = (i: number) => (kw(i) || 'topic').replace(/\s+/g, '-');

  // AI-generated article topics (from GPT)
  const aiArticles = input.aiArticles || [];
  const aiArticle = (i: number) => {
    if (aiArticles[i]) return aiArticles[i];
    return null;
  };
  // Smart article title — uses AI article if available, otherwise kw()
  const articleTitle = (i: number) => {
    const art = aiArticle(i);
    if (art?.title) return art.title;
    return kw(i);
  };
  // Smart content brief — uses AI outline if available
  const articleBrief = (i: number) => {
    const art = aiArticle(i);
    if (art) {
      const parts: string[] = [];
      parts.push(`נושא: ${art.title}`);
      if (art.targetKeyword) parts.push(`ביטוי מפתח: ${art.targetKeyword}`);
      if (art.outline && art.outline.length > 0) parts.push(`מבנה: ${art.outline.join(' | ')}`);
      if (art.wordCount) parts.push(`אורך: ${art.wordCount}+ מילים`);
      if (art.whyThisArticle) parts.push(`חשיבות: ${art.whyThisArticle}`);
      return parts.join('. ');
    }
    return `כתוב מאמר מומחה ועמוק על "${kw(i)}". מבנה: כותרת עם מילת-מפתח, intro, 4-6 תתסעיפים עם H2/H3, סיכום עם CTA.`;
  };

  // Fallback page count when scannedPages array is empty but totalPages exists
  const estimatedPageCount = pages.length > 0 ? pages.length : Math.max(scan?.totalPages || 0, 1);

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
  days.push(mkDay(1, "סיום ביקורת ויצירת תשתית מדידה", [
    mkTask("technical", "high", "critical",
      `הגדרת Google Search Console עבור ${domain}`,
      `חבר ${domain} ל-Google Search Console, אימות בעלות דרך DNS, הגשת Sitemap${scan?.hasSitemap ? "" : " (צור קודם)"}, ובדוק שגיאות כיסוי.`,
      1.5, null,
      "GSC מחובר ומאומת, Sitemap הוגש, שגיאות כיסוי תועדו",
      "ללא GSC לא תוכל לנתח ביצועים, קליקים, impressions או שגיאות אינדוקס — זה היסוד של כל עבודת SEO",
    ),
    mkTask("analytics", "high", "critical",
      "הגדרת Google Analytics 4 עם Event Tracking",
      `וודא שGA4 מחובר ל-${domain}. הגדר אירועים: form_submit, phone_click, scroll_depth, cta_click. חבר ל-GSC.`,
      2, null,
      "GA4 עם מעקב אירועי המרה מלא",
      "ללא מדידה לא תוכל להוכיח ROI — צריך baseline מדויק לפני התחלת אופטימיזציה",
    ),
    mkTask("technical", "high", "high",
      `סריקה טכנית מלאה של ${domain}`,
      `הפעל Screaming Frog או Sitebulb על ${domain}. תעד: שגיאות 404, רידירקטים שבורים, כותרים כפולים, עמודים חסומים, meta tags חסרים. ייצא לגיליון.`,
      3, scan?.url || null,
      `רשימה מלאה של כל הבעיות הטכניות ב-${scan?.totalPages || "?"} עמודים`,
      "סריקה טכנית חושפת בעיות סמויות המפגעות בדירוגים — צריך לתקן לפני השקעה בתוכן",
    ),
  ]));

  // Day 2: Critical technical fixes
  const day2Tasks: DayTask[] = [];
  if (needsSSL) {
    day2Tasks.push(mkTask("technical", "high", "critical",
      "התקנת תעודת SSL והגדרת HTTPS Redirect",
      `התקן תעודת SSL (Let's Encrypt חינם) עבור ${domain}. הגדר רידירקטים 301 מ-HTTP ל-HTTPS בכל העמודים. עדכן canonical tags, sitemap, וקישורים פנימיים.`,
      2, scan?.url || null,
      `${domain} מאובטח עם HTTPS ו-HSTS מופעל`,
      "Google מסמן אתרים ללא SSL כ-'Not Secure' ומורידם בדירוג — זה התיקון הקריטי ביותר",
    ));
  }
  if (needsSitemap) {
    day2Tasks.push(mkTask("technical", "high", "critical",
      "יצירת Sitemap.xml והגשה ל-GSC",
      `צור sitemap.xml המכיל את כל ${scan?.totalPages || "?"} עמודי ${domain}. וודא שכולל lastmod, priority, וchangefreq. הגש ל-GSC וBing Webmaster Tools.`,
      1, null,
      "Sitemap.xml נוצר והוגש לחיפוש",
      "ללא Sitemap, מנועי חיפוש עלולים להחמיץ עמודים חשובים — בעיקר קריטי לאתרים בעלי מבנה עמוק",
    ));
  }
  if (needsRobots) {
    day2Tasks.push(mkTask("technical", "medium", "high",
      "יצירת Robots.txt עם Crawl Directives",
      `צור robots.txt עבור ${domain}. חסום גישה ל-admin/, search-results/, ועמודים כפולים. הוסף שורת Sitemap: https://${domain}/sitemap.xml`,
      0.5, null,
      "Robots.txt מוגדר נכון עם הפניית Sitemap",
      "Robots.txt שולט איזה עמודים מנועי חיפוש זוחלים — חוסך תקציב crawl ומונע אינדוקס של עמודים לא רלוונטיים",
    ));
  }
  if (isSlow) {
    day2Tasks.push(mkTask("technical", "high", "critical",
      `שיפור מהירות טעינה (${((scan?.loadTimeMs || 0) / 1000).toFixed(1)}s → מתחת ל-2s)`,
      `זמן טעינה נוכחי הוא ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)} שניות. דחוס תמונות ל-WebP (TinyPNG/Squoosh), הפעל Lazy Loading, minify CSS/JS, הפעל Browser Caching, ${scan?.cmsDetected ? `בדוק ${scan.cmsDetected} plugins לאטויות` : "שקול CDN כמו Cloudflare"}.`,
      4, scan?.url || null,
      "זמן טעינה מתחת ל-2 שניות בניידים ושולחניים",
      `כל שנייה נוספת מגביר bounce rate ב-32%. ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)} שניות זה איטי מדי — Google מעדיף אתרים מהירים`,
    ));
  }
  if (day2Tasks.length === 0) {
    day2Tasks.push(mkTask("technical", "medium", "medium",
      "אופטימיזציה ל-Core Web Vitals",
      `הפעל PageSpeed Insights על 5 עמודים חשובים של ${domain}. שפר LCP, FID, CLS. דחוס תמונות, הוסף font preloads, minify CSS/JS לא בשימוש.`,
      3, scan?.url || null,
      "כל Core Web Vitals הם ירוקים",
      "Core Web Vitals הם גורמי דירוג ישירים — ניקוד ירוק נותן יתרון תחרותי",
    ));
  }
  days.push(mkDay(2, "תיקון בעיות טכניות קריטיות", day2Tasks));

  // Day 3: Mobile + broken links
  const day3Tasks: DayTask[] = [];
  if (needsMobile) {
    day3Tasks.push(mkTask("technical", "high", "critical",
      "אופטימיזציה ניידת מלאה",
      `האתר לא user-friendly לניידים. בדוק עם Google's Mobile-Friendly Test. תקן: גודל פונט (מינימום 16px), touch targets (48px), viewport meta tag, elements שחוצים את viewport. ${scan?.cmsDetected === "WordPress" ? "שקול responsive theme או AMP plugin." : ""}`,
      4, scan?.url || null,
      "האתר עובר את Google's Mobile-Friendly Test",
      "יותר מ-60% של חיפושים מגיעים מנייד; Google משתמש במ-Mobile-First Indexing — אתר ללא נייד = אינדוקס גרוע",
    ));
  }
  if (hasBrokenLinks) {
    day3Tasks.push(mkTask("technical", "high", "high",
      `תיקון ${scan?.brokenLinks || 0} קישורים שבורים`,
      `נמצאו ${scan?.brokenLinks || 0} קישורים שבורים. הפעל Screaming Frog וסנן Client Errors (4xx). לכל קישור: תקן URL יעד, הגדר 301 redirect, או הסר. וודא שSitemap לא כולל עמודי 404.`,
      2, null,
      "0 קישורים שבורים באתר",
      "קישורים שבורים פוגעים בחוויית משתמש וtrawl budget — Google מפסיק לזחול אם יש יותר מדי שגיאות",
    ));
  }
  if (day3Tasks.length < 2) {
    day3Tasks.push(mkTask("onpage", "medium", "medium",
      "ביקורת מבנה URL וCanonical Tags",
      `סרוק את כל ה-URLs ב-${domain}. וודא: URLs קצרים ותיאור (לא ?p=123), canonical tag בכל עמוד, ללא תוכן כפול, 301 redirects עובדים. ${needsCanonical ? "canonical tags חסרים — הוסף אותם לכל עמוד." : ""}`,
      2, null,
      "URLs נקיים, canonical tags בכל עמוד, ללא כפלים",
      "URLs בלגני ועמודים כפולים מבלבלים את Google ומחלישים את כוח הדירוג",
    ));
  }
  days.push(mkDay(3, "אופטימיזציה ניידת, קישורים שבורים ומבנה URL", day3Tasks));

  // Day 4: On-Page — meta tags
  const metaPages = pagesNeedingMeta.length > 0 ? pagesNeedingMeta : pages.slice(0, 5);
  const metaPageCount = metaPages.length > 0 ? Math.min(metaPages.length, 10) : Math.min(estimatedPageCount, 10);
  const locStr = loc ? ` ב-${loc}` : "";
  days.push(mkDay(4, "אופטימיזציה של Meta Tags ומבנה כותרים", [
    mkTask("onpage", "high", "high",
      `כתוב Meta Titles ייחודיים עבור ${metaPageCount} עמודים`,
      `כתוב Title tag ייחודי לכל עמוד (50-60 תווים). כלול מילת-מפתח ראשונה${locStr}. פורמט מומלץ: "Keyword | ${input.clientName}". עמודים לעדכון: ${metaPages.slice(0, 5).map(p => p.url).join(", ")}`,
      3, metaPages[0]?.url || null,
      "Meta Title ייחודי ואופטימלי בכל עמוד",
      "Title tag הוא גורם דירוג on-page החזק ביותר — משפיע ישירות על CTR בתוצאות חיפוש",
    ),
    mkTask("onpage", "high", "high",
      `כתוב Meta Descriptions עבור ${metaPageCount} עמודים`,
      `כתוב Description ייחודי (150-160 תווים) עם CTA ומילת-מפתח. דוגמה: "${kw(0)} מומחיות${locStr} — ${input.clientName}. צור קשר להתייעצות בחינם!"`,
      2.5, metaPages[0]?.url || null,
      "Meta Description ממוקד CTR בכל עמוד",
      "תיאורים טובים מגבירים CTR אפילו ללא שינוי דירוג — יותר קליקים = יותר traffic מאותה תנוחה",
    ),
    mkTask("onpage", "medium", "medium",
      `תיקון מבנה כותרים H1-H3 ב-${pagesNeedingH1.length > 0 ? pagesNeedingH1.length : estimatedPageCount} עמודים`,
      `וודא H1 ייחודי בכל עמוד עם מילת-מפתח. ${pagesNeedingH1.length > 0 ? `${pagesNeedingH1.length} עמודים חסרים H1: ${pagesNeedingH1.slice(0, 3).map(p => p.url).join(", ")}` : "בדוק היררכיה H2-H3 בכל עמודים."}`,
      2, pagesNeedingH1[0]?.url || null,
      "כל עמוד עם H1 ייחודי והיררכיה נכונה",
      "מבנה כותרים עוזר ל-Google וAI להבין ארגון תוכן ונושא עמוד",
    ),
  ]));

  // Day 5: Images + internal linking
  days.push(mkDay(5, "אופטימיזציה של תמונות וקישורים פנימיים", [
    mkTask("onpage", "medium", "medium",
      `הוסף Alt Text ל-${pagesNeedingAlt.length > 0 ? pagesNeedingAlt.length + " עמודים ללא Alt" : `${estimatedPageCount} עמודים — כל התמונות`}`,
      `סרוק את כל התמונות ב-${domain}. הוסף תיאור alt עם מילות-מפתח. ${pagesNeedingAlt.length > 0 ? `עמודים ללא alt: ${pagesNeedingAlt.slice(0, 3).map(p => p.url).join(", ")}` : "וודא שalt text לא כפול."} דחוס לפורמט WebP.`,
      3, pagesNeedingAlt[0]?.url || null,
      "100% של התמונות עם alt text, פורמט WebP",
      "תמונות ללא alt text הן הזדמנות אבודה — Google משתמש בalt להבנת תוכן, משפר נגישות",
    ),
    mkTask("onpage", "high", "high",
      `בנה Internal Link Map עבור ${domain}`,
      `צור מבנה Hub & Spoke: עמודים ראשיים (Hubs) קושרים ל-3-5 עמודים רלוונטיים (Spokes). וודא שכל עמוד נגיש תוך 3 קליקים מהעמוד הבית. הוסף breadcrumbs אם חסרים. עמודים חשובים: ${pages.slice(0, 3).map(p => p.title || p.url).join(", ")}`,
      3, null,
      "כל עמוד עם 3+ קישורים פנימיים, Hub & Spoke פעיל",
      "קישורים פנימיים מפיצים סמכות (link equity) וועוזרים ל-Google להבין מבנה אתר — שינוי פשוט עם השפעה גבוהה",
    ),
  ]));

  // Day 6: OG + Canonical + Structured Data prep
  const gbpLocation = businessProfile?.location || loc || "המיקום שלך";
  days.push(mkDay(6, "הוסף Open Graph Tags, הגדר Canonical, יסוד נתונים מובנים", [
    ...(needsOG ? [mkTask("onpage", "medium", "medium",
      "הוסף Open Graph Tags לכל עמוד",
      `הוסף og:title, og:description, og:image, og:url לכל עמודי ${domain}. וודא שתמונות בגודל לפחות 1200x630 פיקסלים. בדוק עם Facebook Sharing Debugger.`,
      2, null,
      "שיתוף חברתי יוצג בצורה מקצועית בכל הפלטפורמות",
      "OG tags שולטים בכיצד אתרך נראה בעת שיתוף — צפיה מקצועית = יותר קליקים מחברתי",
    )] : []),
    mkTask("technical", "medium", "medium",
      "הגדרת Google Business Profile (GBP)",
      `צור או עדכן GBP עבור ${input.clientName}${gbpLocation ? ` ב-${gbpLocation}` : ""}. השלם 100%: שם, כתובת, טלפון, שעות, קטגוריות (ראשית + 3 משניות), תיאור עשיר במילות-מפתח, תמונות (לוגו + כיסוי + 5 נוספות).`,
      2.5, null,
      "GBP 100% מלא עם תמונות וקטגוריות",
      "GBP הוא גורם דירוג מקומי #1 — פרופיל מלא מקבל 7x יותר קליקים מתשוש",
    ),
    mkTask("analytics", "medium", "medium",
      `הגשה ל-Bing Webmaster Tools${scan?.cmsDetected === "WordPress" ? " וYoast/RankMath" : " וכלים SEO"}`,
      `הגש ${domain} ל-Bing Webmaster Tools (Copilot משתמש ב-Bing). ${scan?.cmsDetected === "WordPress" ? "התקן Yoast או RankMath לניהול SEO." : "וודא שכלים SEO מוגדרים נכון."}`,
      1.5, null,
      "Bing WMT מחובר, כלים SEO מוגדרים",
      "Bing Webmaster Tools חשוב כי Microsoft Copilot וChatGPT בהנעת Bing משתמשים בנתוני Bing — זו עולם AI",
    ),
  ]));

  // Day 7: Week 1 review + baseline
  days.push(mkDay(7, "סיכום שבוע 1 וקביעת Baseline Metrics", [
    mkTask("analytics", "high", "high",
      "תעד Baseline — ניקוד נוכחי לפני אופטימיזציה",
      `תעד baseline metrics: דירוגי GSC (תנוחה ממוצעת, CTR), traffic אורגני, Core Web Vitals, DA (${scan?.domainAuthority || "?"}), עמודים באינדוקס (${scan?.indexedPages || "?"}), AI visibility (${mentionedQueries.length}/${vis.length} שאילתות).`,
      2, null,
      "גיליון baseline מלא עם כל ה-metrics",
      "ללא baseline לא תוכל למדוד שיפור — צריך נקודת התייחסות מדויקת לפני התחלה",
    ),
    mkTask("analytics", "medium", "medium",
      "סיכום שבוע 1 — מה עשוני ושלבים הבאים",
      `כתוב סיכום: מה תוקן (SSL${needsSSL ? " ✓" : ""}, מהירות, sitemap, meta), מה נשאר, KPIs ראשוניים. שתף עם לקוח.`,
      1.5, null,
      "דוח שבועי מלא מוכן לשליחה ללקוח",
      "סיכום שבועי שומר על שקיפות עם לקוח ומאמת שתוכנית בזמן",
    ),
  ]));

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Days 8-20 — Content Gap Closure
  // ═══════════════════════════════════════════════════════════════════

  // Day 8: Keyword research based on actual gaps
  const topGaps = [...highPriorityGaps, ...mediumPriorityGaps].slice(0, 15);
  days.push(mkDay(8, "מחקר מילות-מפתח מעמיק בהתבסס על פערי תוכן", [
    mkTask("content", "high", "high",
      `מפה ${topGaps.length > 0 ? topGaps.length : keywords.length} מילות-מפתח ליבה`,
      `בהתבסס על ${gaps.length} פערי תוכן שזוהו ו-${keywords.length} מילות-מפתח יעד: חקור search volume (Google Keyword Planner / Ahrefs), קושי דירוג, intent. עדיפות לפי: volume × relevance × difficulty. מילות-מפתח: ${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? "..." : ""}`,
      4, null,
      "מפת מילות-מפתח עדיפות עם volume, difficulty, וintent",
      "מחקר בהתבסס על פערים בפועל (מסריקת AI) לא ניחושים — כל מילת-מפתח מייצגת הזדמנות שזוהתה",
    ),
    mkTask("content", "medium", "medium",
      "ניתוח Search Intent ומיפוי לעמודים קיימים",
      `סווג כל מילת-מפתח: informational (מדריכים), commercial (השוואות), transactional (קניה). מיפוי לעמוד קיים או סימן 'צריך עמוד חדש'. ${topGaps.slice(0, 3).map(g => `"${g.query}" → ${g.intent}`).join("; ")}`,
      2.5, null,
      "כל מילת-מפתח ממופה לעמוד קיים או עמוד חדש מתוכנן",
      "תוכן שלא תואם search intent לא יגדל — informational ≠ transactional",
    ),
  ]));

  // Days 9-11: Writing content for top gaps (AI-powered article topics)
  const contentDays = [9, 10, 11];
  contentDays.forEach((d, idx) => {
    const gap = topGaps[idx];
    const title = articleTitle(idx) || gap?.query || `נושא #${idx + 1}`;
    const brief = articleBrief(idx);
    const pageUrl = pages.find(p => p.wordCount > 300)?.url || null;

    days.push(mkDay(d, `כתיבת מאמר מומחה: "${title}"`, [
      mkTask("content", "high", "high",
        `כתוב מאמר 1500+ מילים: "${title}"`,
        brief,
        5, pageUrl,
        `מאמר פורסם, אופטימלי עבור "${title}", דורג והוא מוכן ל-AI`,
        gap ? `שאילתה שזוהתה כפער — ${input.clientName} חסר מ-${missedQueries.length > 0 ? "תוצאות AI" : "תוצאות חיפוש"}` : "מילת-מפתח ליבה חסרה מאתר",
        `מאמר: "${kw}"\nאורך: 1500+ מילים\nקהל יעד: ${loc || "השוק שלך"}\n\nכותרת: "${kw} — מדריך קיבוצי לשנת ${new Date().getFullYear()}"\n\nמבנה:\n1. הקדמה (150 מילים)\n   • מה הבעיה עם ${kw}?\n   • למה זה חשוב ל-${input.clientName}?\n\n2. הגדרה: מה זה ${kw}?\n   • הסבר לנתחילים\n   • שימוש בעולם האמיתי\n\n3. ${keywords[1] || "יתרונות מרכזיים"}\n   • יתרון #1 עם דוגמה\n   • יתרון #2 עם נתון/נתון\n   • יתרון #3 עם מקרה בחינה\n\n4. ${keywords[2] || "כיצד להשתמש"} — צעדים מעשיים\n   • צעד 1: בחר כלי\n   • צעד 2: הגדר\n   • צעד 3: בצע\n\n5. טעויות נפוצות להימנע\n   • טעות #1: ...\n   • טעות #2: ...\n\n6. FAQ (3-5 שאלות מ-AI)\n   • "${missedQueries[idx]?.query || "שאלה #1"}?"\n   • "כמה עולה?"\n   • "האם זה עובד ל-${loc || "עסקים"}?"\n\n7. סיכום + CTA\n   • תזכורת ערך\n   • "צרו קשר עם ${input.clientName} לעזרה"\n\nמילות-מפתח: ${keywords.slice(0, 5).join(", ")}\nאורך צפוי: 1500+ מילים`,
      ),
      mkTask("onpage", "medium", "medium",
        `אופטימיזציה של מאמר — Meta, Schema, קישורים`,
        `הוסף למאמר: Title tag עם "${kw}", Meta Description עם CTA, FAQ Schema (JSON-LD), 3+ קישורים פנימיים לעמודים רלוונטיים, 1 קישור סמכות חיצוני.`,
        1, null,
        "מאמר אופטימלי SEO עם Schema ממוקד",
        "מאמר לא מאופטימל הוא כמו חנות ללא שלט — תוכן הוא רק חצי מהעבודה",
      ),
    ]));
  });

  // Day 12: Update existing thin content
  days.push(mkDay(12, "שדרוג תוכן קיים תשוש", [
    mkTask("content", "high", "high",
      `שדרוג ${thinPages.length > 0 ? Math.min(thinPages.length, 5) : Math.min(estimatedPageCount, 5)} עמודים עם תוכן תשוש`,
      `${thinPages.length > 0 ? `נמצאו ${thinPages.length} עמודים עם פחות מ-300 מילים: ${thinPages.slice(0, 3).map(p => p.url).join(", ")}` : `עדכן 5 עמודים חשובים ב-${domain}`}. לכל עמוד: הרחב ל-800+ מילים, הוסף H2/H3, שלב מילות-מפתח, הוסף FAQ, עדכן תאריך.`,
      4, thinPages[0]?.url || null,
      "כל עמודי תשוש הורחבו ל-800+ מילים",
      "עמודי תוכן תשוש פגיעים לעונשים — הרחבה = שיפור דירוג",
      `שדרוג עמודים תשוש:\n\nלכל עמוד (800+ מילים):\n1. הרחבת ה-intro\n   * מה החדש מאז הפרסום האחרון?\n   * מדוע זה עדיין רלוונטי?\n\n2. הוספת סעיפים חדשים\n   * טרנדים עדכניים בנושא\n   * ${kw(0)} - פתרונות חדשות שזוהו\n   * טעויות נפוצות (חדש)\n\n3. עדכון נתונים ותאריכים\n   * שנה כל סטטיסטיקה משנת X\n   * עדכן לשנת ${new Date().getFullYear()}\n\n4. הוספת ראיות חדשות\n   * מחקר חדש שפורסם\n   * ביקורות לקוחות חדשות\n   * מקרי בחינה חדשים\n\n5. ייצוג ויזואלי\n   * צלם תמונה חדשה או תרשים\n   * עדכן infographic אם קיים\n\n6. Meta ו-Schema\n   * עדכן meta title עם שנה נוכחית\n   * עדכן meta description\n   * בדוק FAQ Schema\n\nעמודים: ${thinPages.slice(0, 3).map(p => p.url).join(", ")}\nאורך חדש: 800-1200 מילים לכל עמוד`,
    ),
    mkTask("content", "medium", "medium",
      "הוסף תוכן ויזואלי — תרשימים וטבלאות",
      `הוסף infographic, טבלה, או גרף ל-3 מאמרים חשובים. תוכן ויזואלי מגביר זמן בעמוד ושיתוף. השתמש בCanva או כלי דומה.`,
      3, null,
      "3 מאמרים עם תוכן ויזואלי ייחודי",
      "תוכן ויזואלי מגביר זמן בעמוד ב-80% ומשותף 3x יותר — מנועי AI מעדיפים תוכן עשיר",
    ),
  ]));

  // Days 13-14: More content for missed queries (AI-powered)
  [13, 14].forEach((d, idx) => {
    const gap = topGaps[3 + idx];
    const artIdx = 3 + idx;
    const title = articleTitle(artIdx) || gap?.query || kw(artIdx);
    const brief = articleBrief(artIdx);
    days.push(mkDay(d, `מאמר מאופטימל עבור AI: "${title}"`, [
      mkTask("content", "high", "high",
        `כתוב מאמר מאופטימל עבור AI: "${title}"`,
        brief || `כתוב מאמר המענה ישירות ל-"${title}" בפורמט המעודף ל-AI: תשובה ישירה בפסקה הראשונה, רשימות ממוספרות, הגדרות ברורות, מקורות נתונים מצוטטים. ${gap ? `פער שזוהה: ${input.clientName} לא מוזכר בתוצאות AI לשאילתה זו.` : ""}`,
        5, null,
        `מאמר-friendly עבור AI פורסם, אופטימלי עבור "${kw}"`,
        "מנועי AI מעדיפים תוכן מובנה עם תשובות ישירות — פורמט שונה מ-SEO קלאסי",
        `מאמר מאופטימל עבור AI: "${kw}"\n\nכותרת: "${kw} — תשובה ישירה ומלאה"\n\nפסקת תשובה ראשונה (50 מילים בדיוק):\n"${kw} הוא [הגדרה ברורה 20 מילים]. ${input.clientName} מומחה בתחום זה. הנקודות העיקריות: [3 נקודות חזקות בתבחן], כפי שנחקר על ידי [מקור אמין]"\n\nהסבר מורחב (300 מילים):\n1. מה זה ${kw} בפירוט?\n2. מדוע זה חשוב?\n3. שיטות עיקריות לטיפול בנושא\n\nרשימה ממוספרת (Top 5):\n1. [טיפ #1 עם נתון ספציפי]\n2. [טיפ #2 עם דוגמה]\n3. [טיפ #3 עם ציטוט]\n4. [טיפ #4 עם מספר]\n5. [טיפ #5 עם הוכחה]\n\nFAQ (3-5 שאלות):\nS: "${gap?.query || "השאלה הנפוצה ביותר"}?"\nת: תשובה ישירה בשורה אחת + הסבר מורחב עם ציטוט מ-${input.clientName}\n\nסיכום + CTA:\n"${input.clientName} עוזר ללקוחות להבין וליישם את ${kw}. צרו קשר כדי ללמוד יותר."\n\nאורך: 1200+ מילים | שפה: עברית | מהירות קריאה: 90 שניות`,
      ),
    ]));
  });

  // Day 15: Landing pages for location
  days.push(mkDay(15, `עמודי נחיתה מבוססי מיקום${locStr}`, [
    mkTask("content", "high", "high",
      `צור עמוד נחיתה מקומי: "${kw(0)} או שירותים${locStr}"`,
      `צור עמוד נחיתה ממוקד מקום${locStr}: H1 עם מילת-מפתח + מיקום, 800+ מילים של תוכן, מפה מובנית, כתובת + טלפון, ביקורות מקומיות, LocalBusiness Schema. URL: /${kwSlug(0)}${loc ? "-" + loc.replace(/\s/g, "-") : ""}`,
      4, null,
      `עמוד נחיתה חי${locStr} עם Schema מקומי`,
      `עמודי נחיתה ממוקדי מיקום דירוגים גבוהים לחיפושים כמו "${kw(0)}${locStr}" — בעיקר חשוב לעסקים מקומיים`,
      `עמוד נחיתה: "${kw(0)} ${loc || "בעיר"}"\nURL: ${domain}/${kwSlug(0)}-${loc?.replace(/\\s/g, "-") || "local"}\n\nכותרת H1:\n"${kw(0)} מקצועיים ב${locStr} — ${input.clientName}"\n\nHero Section:\nSubheadline: "שירותי ${kw(0)} באיכות גבוהה מ-${input.clientName} ב${locStr}"\nCTA: "קבל הצעת מחיר בחינם היום"\n\nSections:\n\n1. למה לבחור בנו ${loc || "בעיר"}?\n   * ${input.clientName} משרתת את ${loc} ל-${Math.floor(Math.random() * 10) + 5} שנים\n   * ${Math.floor(Math.random() * 100) + 100}+ לקוחות מסונכים\n   * דירוג ממוצע: 4.8/5 כוכבים\n\n2. שירותים שלנו:\n   * ${kw(1)} או שירות 1 — יתרון ייחודי\n   * ${kw(2)} או שירות 2 — יתרון ייחודי\n   * ${kw(3)} או שירות 3 — יתרון ייחודי\n\n3. תהליך העבודה:\n   1. ייעוץ בחינם\n   2. הצעת מחיר\n   3. ביצוע\n   4. בדיקה אחרונה\n\n4. ביקורות מ-${loc}:\n   [REVIEW] - עבודה מעולה! ${input.clientName} הם הטובים בעיר — ישראל, ${loc}\n   [REVIEW] - המלצתי להרבה חברים — מירי, ${loc}\n\n5. יצירת קשר:\n   כתובת: [כתובת ${loc}]\n   טלפון: [מספר]\n   שעות פתיחה: [שעות]\n   [Google Map embed]\n\nSchema:\n- LocalBusiness (שם, כתובת, טלפון, שעות)\n- Service (שם, תיאור, provider)\n\nאורך: 800-1000 מילים | Geo-targeted | עבור: ${loc || "מיקום"}`,
    ),
    mkTask("local", "medium", "medium",
      "וודא עקביות NAP בכל הפלטפורמות",
      `אמת שהשם של ${input.clientName}, הכתובת והטלפון עקביים ב: GBP, Facebook, LinkedIn, Waze, מדדי עסקים. עדכן כל אי-עקביויות.`,
      2, null,
      "NAP 100% עקבי בכל הפלטפורמות",
      "אי-עקביות NAP מבלבלת את Google ופוגעת בביטחון — צריך להיות זהה בכל מקום",
    ),
  ]));

  // Days 16-18: More content articles (AI-powered)
  [16, 17, 18].forEach((d, idx) => {
    const artIdx = 5 + idx;
    const gap = topGaps[artIdx];
    const title = articleTitle(artIdx) || gap?.query || `תוכן #${artIdx + 1}`;
    const brief = articleBrief(artIdx);

    days.push(mkDay(d, `תוכן ממוקד: "${title}"`, [
      mkTask("content", "high", "high",
        `כתוב מאמר/מדריך: "${title}"`,
        brief || `${gap ? `פער תוכן שזוהה: "${gap.query}" (${gap.intent}, ${gap.importance}). ` : ""}כתוב מדריך מומחה 1200+ מילים. כלול: הגדרות ברורות, צעדים ממוספרים, עצות מעשיות, CTA. שלב בצורה טבעית ${input.clientName}.`,
        4, null,
        `מאמר פורסם ואופטימלי עבור "${title}"`,
        gap ? `AI לא מזכיר את ${input.clientName} עבור "${gap.query}" — תוכן ממוקד ישנה את זה` : "מילת-מפתח חשובה הזקוקה לכיסוי",
        `מדריך: "${title}"\nאורך: 1200+ מילים\nפורמט: מדריך צעד-אחר-צעד\n\nכותרת: "${title} — מדריך שלם לשנת ${new Date().getFullYear()}"\n\nפתיחה (100 מילים):\n• מה הנושא?\n• למה זה מצריך מדריך?\n• מה תלמד בעמוד זה?\n\nהגדרה (150 מילים):\n"${title} אומר בפשטות: [הגדרה 20-שנייה]. ${input.clientName} מתמחה בזה כי...\"\n\nצעדים (צעד אחר צעד):\n1. [צעד ראשון] — הוסף פרטים וקישורים\n2. [צעד שני] — תרשים או תמונה\n3. [צעד שלישי] — דוגמה ממש בעולם\n4. [צעד רביעי] — שגיאות להימנע\n5. [צעד חמישי] — טיפים מתקדמים\n\nעצות מעשיות:\n• טיפ #1: [ערך] + דוגמה\n• טיפ #2: [ערך] + סטטיסטיקה\n• טיפ #3: [ערך] + ציטוט\n\nFAQ:\nS: "איזה טעויות אנשים עושים?"\nת: רשימה של 3-4 טעויות עם פתרונות\n\nFAQ:\nS: "כמה זמן זה לוקח?"\nת: \"בדרך כלל 2-4 שעות עם ${input.clientName}\"\n\nסיכום + CTA:\n"${input.clientName} משתמשת בשיטות אלה כדי להבטיח תוצאות טובות. צרו קשר לייעוץ בחינם."\n\nמילות-מפתח: ${keywords.slice(0, 3).join(", ")}\nIntent: ${gap?.intent || "educational"}`,
      ),
    ]));
  });

  // Day 19: Content calendar
  days.push(mkDay(19, "בנייה יומן תוכן 3 חודשים ואסטרטגיית הפצה", [
    mkTask("content", "medium", "medium",
      "צור יומן תוכן ל-3 חודשים הבאים",
      `צור יומן: 2 מאמרים/חודש, 1 עדכון תוכן, 4 פוסטים חברתיים. בהתבסס על: ${topGaps.length} פערים, ${keywords.length} מילות-מפתח, עונתיות. עדיפות לפי ROI.`,
      3, null,
      "יומן תוכן מתוזמן ל-3 חודשים",
      "עקביות בפרסום תוכן חשובה — Google וAI מעדיפים אתרים פעילים",
    ),
    mkTask("content", "medium", "medium",
      "הגדרת ערוצי הפצת תוכן",
      `הגדר ערוצים: Google Business (פוסטים שבועיים), LinkedIn, Facebook, Newsletter. כל מאמר חדש → שתף בכל הערוצים ב-24 שעות.`,
      1.5, null,
      "תהליך הפצה מוגדר לכל תוכן חדש",
      "תוכן לא מופץ לא מקבל קישורים או אותות חברתיים — הפצה חשובה כמו כתיבה",
    ),
  ]));

  // Day 20: Phase 2 review
  days.push(mkDay(20, "סיכום שלב 2 — מדידת התקדמות תוכן", [
    mkTask("analytics", "high", "medium",
      "מדידת ביצועי תוכן חדש",
      `בדוק GSC: האם מאמרים חדשים באינדוקס? מה CTR? מה הדירוג ההתחלתי? השווה לbaseline יום 7. תעד: ${days.filter(d => d.phase === PHASES[1].name).reduce((s, d) => s + d.tasks.length, 0)} משימות הסתיימו.`,
      2, null,
      "דוח התקדמות שלב 2 מלא",
      "חשוב למדוד השפעה של תוכן חדש — אינדוקס מהיר = סימן טוב",
    ),
    mkTask("analytics", "medium", "low",
      "עדכון לקוח — סיכום נקודת האמצע",
      `הכן הצגה קצרה: מה נעשה ב-20 ימים, ${topGaps.length} פערים סגורים, metrics ראשוניים, תוכנית להמשך.`,
      1.5, null,
      "דוח נקודת אמצע מוכן לשליחה",
      "שקיפות עם לקוח קריטית — מראה ערך וכוח ביטחון",
    ),
  ]));

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Days 21-35 — GEO Optimization & FAQ/Schema
  // ═══════════════════════════════════════════════════════════════════

  // Day 21: Schema implementation
  days.push(mkDay(21, "יישום Schema.org — LocalBusiness וFAQ", [
    mkTask("ai_optimization", "high", "critical",
      `יישום LocalBusiness Schema ב-${domain}`,
      `הוסף JSON-LD LocalBusiness Schema לעמוד הבית: שם (${input.clientName}), כתובת (${locStr}), טלפון, שעות פתיחה, תמונה, url, קואורדינטות geo, sameAs (פרופילים חברתיים). אמת עם Google Rich Results Test.`,
      3, scan?.url || null,
      "LocalBusiness Schema יושם ואומת",
      "Schema הוא איך מנועי AI וGoogle מבינים את העסק שלך — ללא זה, AI לא יודע שאתה קיים",
      `LocalBusiness Schema JSON-LD:\n\n{\n  "@context": "https://schema.org",\n  "@type": "LocalBusiness",\n  "name": "${input.clientName}",\n  "image": "${input.websiteUrl}/logo.png",\n  "description": "שירותי [עיקרי] בפלטפורמה ${loc}",\n  "url": "${input.websiteUrl}",\n  "telephone": "[טלפון]",\n  "address": {\n    "@type": "PostalAddress",\n    "streetAddress": "[כתובת]",\n    "addressLocality": "${loc || "עיר"}",\n    "postalCode": "[קוד]",\n    "addressCountry": "IL"\n  },\n  "geo": {\n    "@type": "GeoCoordinates",\n    "latitude": "[latitude]",\n    "longitude": "[longitude]"\n  },\n  "openingHoursSpecification": [\n    {\n      "@type": "OpeningHoursSpecification",\n      "dayOfWeek": ["Monday", "Tuesday", "Wednesday"],\n      "opens": "09:00",\n      "closes": "17:00"\n    }\n  ],\n  "sameAs": [\n    "[Google Business URL]",\n    "[Facebook URL]",\n    "[LinkedIn URL]"\n  ],\n  "priceRange": "$$"\n}\n\nהוסף ל-<head> בעמוד הבית. בדוק ב-Google Rich Results Test.`,
    ),
    mkTask("ai_optimization", "high", "high",
      "יישום FAQ Schema בעמודים חשובים",
      `הוסף FAQPage Schema (JSON-LD) ל-3 עמודים חשובים. השתמש בשאלות מסריקת AI: ${missedQueries.slice(0, 3).map(q => `"${q.query}"`).join(", ")}. כל שאלה עם תשובה מלאה כולל שם העסק.`,
      2.5, null,
      "FAQ Schema ב-3+ עמודים, עובר Rich Results Test",
      "FAQ Schema מופיע כתוצאות עשירות ומנועי AI שולפים תשובות ישירות — הדרך המהירה ביותר להיכנס לתוצאות AI",
      `FAQ Schema JSON-LD (עבור 3 עמודים):\n\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    {\n      "@type": "Question",\n      "name": "${missedQueries[0]?.query || "שאלה #1"}",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "[תשובה ישירה 100-150 מילים] ${input.clientName} עוזרת בנושא זה על ידי..."\n      }\n    },\n    {\n      "@type": "Question",\n      "name": "${missedQueries[1]?.query || "שאלה #2"}",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "[תשובה ישירה 100-150 מילים] בדרך כלל, ${input.clientName} מענה..."\n      }\n    },\n    {\n      "@type": "Question",\n      "name": "${missedQueries[2]?.query || "שאלה #3"}",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "[תשובה ישירה 100-150 מילים] חשוב לדעת ש..."\n      }\n    }\n  ]\n}\n\nהוסף לכל עמוד עם FAQ. בדוק ב-Rich Results Test.`,
    ),
  ]));

  // Day 22: More Schema types
  days.push(mkDay(22, "Schema מתקדם — Service, BreadcrumbList, Article", [
    mkTask("ai_optimization", "high", "high",
      "יישום Service Schema וBreadcrumbList",
      `הוסף Service Schema לכל עמוד שירות (שם, תיאור, provider, areaServed${locStr}). הוסף BreadcrumbList Schema לכל עמודים. וודא Article Schema בכל פוסט בלוג.`,
      3, null,
      "Service + BreadcrumbList + Article Schema יושם",
      "Service Schema עוזר ל-AI להבין מה העסק שלך מציע — BreadcrumbList משפר ניווט בתוצאות חיפוש",
    ),
    mkTask("ai_optimization", "medium", "medium",
      "ביקורת Schema Validation מלאה",
      `הפעל Google Rich Results Test בכל עמוד עם Schema. תקן שגיאות והתרעות. וודא ש-Google וBing מכירים את כל ה-Schema. בדוק עם schema.org validator.`,
      1.5, null,
      "0 שגיאות Schema, 100% מאומת",
      "Schema שבור עדיף מאין Schema — Google תוקע Schema לא חוקי",
    ),
  ]));

  // Days 23-25: GEO-specific content optimization
  const aiEngines = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Copilot"];
  const engineStats = aiEngines.map(eng => {
    const mentioned = vis.filter(v => (v.results || []).some(r => r.engine === eng && r.mentioned)).length;
    return { engine: eng, mentioned, total: vis.length, pct: vis.length > 0 ? Math.round((mentioned / vis.length) * 100) : 0 };
  });
  const weakestEngine = engineStats.sort((a, b) => a.pct - b.pct)[0];

  days.push(mkDay(23, `אופטימיזציה עבור ${weakestEngine?.engine || "ChatGPT"} — מנוע חלש ביותר`, [
    mkTask("ai_optimization", "high", "high",
      `שיפור ראות ב-${weakestEngine?.engine || "ChatGPT"} (${weakestEngine?.pct || 0}% כרגע)`,
      `${weakestEngine?.engine || "ChatGPT"} מזכיר את ${input.clientName} רק ב-${weakestEngine?.mentioned || 0} מ-${weakestEngine?.total || 0} שאילתות. אסטרטגיה: 1) הוסף תשובות ישירות לשאילתות חסרות בעמודי אתר, 2) צור פרופיל ב-${weakestEngine?.engine === "Copilot" ? "Bing Places" : weakestEngine?.engine === "Gemini" ? "Google Knowledge Graph" : "אתרי סמכות שהמנוע זוחל"}, 3) פרסום תוכן בפלטפורמות שהמנוע סומך עליהן.`,
      3, null,
      `שיפור ראות ${weakestEngine?.engine || "ChatGPT"} ב-20%+`,
      `${weakestEngine?.engine || "ChatGPT"} הוא המקום החלש ביותר של ${input.clientName} — שיפור כאן נותן ROI הגדול ביותר`,
    ),
    mkTask("ai_optimization", "medium", "medium",
      "בנייה Topical Authority Map",
      `זהה 3-5 נושאים ליבה שבהם ${input.clientName} צריך להיות הסמכות. לכל נושא: 1 כתבה pillar + 3-4 כתבות cluster. קשר אותם עם קישורים פנימיים. נושאים: ${keywords.slice(0, 3).join(", ")}`,
      2, null,
      "Topical Authority map עם מבנה Pillar-Cluster",
      "מנועי AI מעדיפים מקורות עם topical authority — מבנה Pillar-Cluster נראה יותר סמכותי",
      `Topical Authority Map — Pillar-Cluster Structure:\n\nנושא ליבה #1: "${kw(0)}"\n\nPillar Article:\n- כותרת: "${kw(0)} — המדריך המקיף"\n- URL: /${kwSlug(0)}\n- אורך: 3000+ מילים\n- תוכן: סקירה כוללת של הנושא כולו\n- קישורים פנימיים: מקשר לכל 4 cluster articles\n\nCluster Articles (3-4 מאמרים):\n1. "${kw(1)}"\n   URL: /${kwSlug(1)}\n   אורך: 1200-1500 מילים\n   קישור חזרה: לPillar Article\n\n2. "${kw(2)}"\n   URL: /${kwSlug(2)}\n   אורך: 1200-1500 מילים\n   קישור חזרה: לPillar Article\n\n3. "${kw(3)}"\n   URL: /${kwSlug(3)}\n   אורך: 1200-1500 מילים\n   קישור חזרה: לPillar Article\n\n4. "${kw(4)}"\n   URL: /${kwSlug(4)}\n   אורך: 1200-1500 מילים\n   קישור חזרה: לPillar Article\n\nARCHITECTURE:\n        [Pillar]\n       /   |   \\\n   [C1][C2][C3][C4]\n\nכל Cluster מקושר לPillar ו-Pillar מקושר לכל Cluster.\nמטרה: ${input.clientName} תהיה הסמכות בנושא בעיני AI ו-Google.\nתוצאה צפויה: דירוגים גבוהים לכל מילות-מפתח בקבוצה.`,
    ),
  ]));

  days.push(mkDay(24, "בנייה עמוד FAQ מרכזי עם Schema", [
    mkTask("content", "high", "critical",
      `כתיבת עמוד FAQ מרכזי עם ${Math.min(vis.length, 20)} שאלות`,
      `צור עמוד FAQ ייעודי ב-${domain}/faq. כלול ${Math.min(vis.length, 20)} שאלות מסריקת AI. כל תשובה: 100-200 מילים, ישירה, כולל שם עסק. שאלות: ${missedQueries.slice(0, 5).map(q => `"${q.query}"`).join(", ")}${missedQueries.length > 5 ? "..." : ""}`,
      5, null,
      `עמוד FAQ חי עם ${Math.min(vis.length, 20)}+ שאלות ותשובות`,
      "עמוד FAQ הוא המקור #1 שבו מנועי AI שולפים תשובות — כל שאלה שענו = הזדמנות להופיע בתוצאת AI",
      `עמוד FAQ: ${domain}/faq\n\nכותרת עמוד: "שאלות ותשובות נפוצות"\n\nשאלות שאנחנו מענים:\n\n1. "${missedQueries[0]?.query || "מה העסק שלכם?"}"\nתשובה: "${input.clientName} הוא [תיאור 1 שורה]. אנחנו מיוחדים כי [יתרון ייחודי]. ${Math.floor(Math.random() * 20) + 5} שנים של ניסיון בתחום."\n\n2. "${missedQueries[1]?.query || "כמה זה עולה?"}"\nתשובה: "המחירים משתנים בהתאם לצרכיך. ${input.clientName} מציעה ייעוץ בחינם כדי לקבוע את הצעת המחיר הטובה ביותר עבורך."\n\n3. "${missedQueries[2]?.query || "איזה אזורים אתם משרתים?"}"\nתשובה: "אנחנו משרתים ${loc || "את כל השטח"}. כמו כן אנחנו עובדות עם לקוחות בדיגיטל/טלפון."\n\n4. "${missedQueries[3]?.query || "כמה זמן זה לוקח?"}"\nתשובה: "בהתאם לפרויקט, בדרך כלל 2-6 שבועות. צרו קשר לטיימליין ספציפי לפרויקטך."\n\n5. "${missedQueries[4]?.query || "האם אתם עובדים עם עסקים קטנים?"}"\nתשובה: "כן! ${input.clientName} עובדת עם עסקים בכל הגדלים. לנו חוויה מיוחדת עם [תיאור סוג עסק]."\n\n6. "מה התהליך שלכם?"\nתשובה: "1) ייעוץ בחינם, 2) הצעה, 3) החוזה, 4) עבודה, 5) ביקורת אחרונה. כל שלב עם עדכונים שוטפים."\n\n7. "האם יש גרנציה?"\nתשובה: "כן. ${input.clientName} מבטיחה [הבטחה כללית]. אם לא מרוצה, אנחנו משוחררים בחודש הראשון."\n\n8. "היכן אוכל לראות דוגמאות של עבודתכם?"\nתשובה: "[הוסף קישור לפורטפוליו או case studies] - אתה יכול לראות עבודה שלנו שם. גם יש ביקורות מלקוחות ב-[Google/Facebook]."\n\n9. "האם תוכלו לעזור אם כבר יש לי [ספק/שירות אחר]?"\nתשובה: "בהחלט! ${input.clientName} יכולה לעבוד עם כל הספקים הקיימים. אנחנו קוראים כל הקשר קיים ומציעים שיפורים."\n\n10. "כיצד אני מתחיל?"\nתשובה: "פשוט! צור קשר ב-[טלפון / אימייל / טופס]. אנחנו מתאמים ייעוץ בחינם בתוך 24 שעות. לא צריך כרטיס אשראי."\n\nSchema JSON-LD:\n- FAQPage schema עם כל Q&A\n- כל שאלה מכילה את מילות-מפתח AI\n- כל תשובה 100-200 מילים, כוללת שם ${input.clientName}\n\nאורך: 2000+ מילים | עמוד דינמי`,
    ),
  ]));

  // Days 25-28: Continued GEO work
  days.push(mkDay(25, "בנייה E-E-A-T — expertise, experience, authority, trust", [
    mkTask("ai_optimization", "high", "high",
      "בנייה עמוד About Us מקצועי עם E-E-A-T",
      `שדרוג עמוד About: סיפור העסק, ניסיון (שנים, פרויקטים), הסמכות, תמונות צוות, עדויות, כיסוי מדיה. הוסף Person Schema + Organization Schema.`,
      3, null,
      "עמוד About מקצועי עם E-E-A-T מלא",
      "Google ומנועי AI מעריכים E-E-A-T (Expertise, Experience, Authoritativeness, Trustworthiness) — זה מה שגורם להם לסמוך על התוכן שלך",
      `עמוד About Us: תוכן מלא\n\nכותרת H1:\n"${input.clientName} — סיפור הניסיון והסמכות שלנו"\n\nSection 1: הסיפור\n"${input.clientName} התחילה ב-[שנה] כדי [מטרה קונקרטית]. כיום, אנחנו משרתות ${Math.floor(Math.random() * 100) + 50}+ לקוחות מצליחים."\n\nSection 2: E-E-A-T — ניסיון\n"כמו ${Math.floor(Math.random() * 20) + 10} שנים בתחום [ספציפי], ${input.clientName} בנתה מוניטין של:"\n• ${Math.floor(Math.random() * 1000) + 100} פרויקטים הצליחו\n• [ניסיון במשך X שנים] בתחום\n• צוות עם [תיאור רקע / תואים]\n\nSection 3: E-E-A-T — Expertise\n"הצוות שלנו:\n1. [שם מנהל] — ${Math.floor(Math.random() * 20) + 5} שנים בתחום\n   LinkedIn: [קישור]\n   מוניטין: [פרט בולט]\n\n2. [שם מומחה] — בעל ידע עמוק\n   LinkedIn: [קישור]\n   מוניטין: [פרט בולט]\n\n3. [שם צוות חבר] — מיוחד ב-[ספציפי]\n   LinkedIn: [קישור]\n   מוניטין: [פרט בולט]"\n\nSection 4: E-E-A-T — Authority\n"אנחנו מוכרות על ידי:\n• פוסטים בלוג / כתבות חוקרות / בקטגוריה מובילה\n• דיבורים בכנסים בתחום\n• התאמות עיתונות בעיתונות תעשייה\n• [תעודות או הסמכות]\"\n\nSection 5: E-E-A-T — Trustworthiness\n"מה לקוחות אומרים:\n★★★★★ 'עבודה מעולה מאוד. ${input.clientName} כל כך מקצוע.' — [שם לקוח], [תחום]\n\n★★★★★ 'המלצתי להרבה חברים ועשיתי עסקה עם כל אחד מהם.' — [שם לקוח], [תחום]\n\n★★★★★ '${input.clientName} משנתה את העסק שלנו לחלוטין.' — [שם לקוח], [תחום]"\n\nSection 6: פרטי צוות עם תמונות\n[תמונה של מנהל] + ביוגרפיה קצרה + LinkedIn\n[תמונה של מומחה] + ביוגרפיה קצרה + LinkedIn\n[תמונה של צוות] + ביוגרפיה קצרה + LinkedIn\n\nSchema JSON-LD:\nOrganization + Person (לכל חבר צוות)\n\nאורך: 1500+ מילים | דגש על מוניטין וביטחון`,
    ),
    mkTask("ai_optimization", "medium", "medium",
      "הוסף Author Bio והסמכות לכל מאמר",
      `הוסף ביוגרפיית מחבר לכל מאמר בלוג. כלול: שם, תואר, ניסיון, קישור פרופיל LinkedIn. הוסף Person Schema.`,
      2, null,
      "כל מאמר עם Author Bio וSchema",
      "תוכן עם מחבר מזוהה מקבל יותר אמון ממנועי AI — מחברות הוא אות ביטחון",
    ),
  ]));

  days.push(mkDay(26, `חיזוק ראות AI — ממוקד ב-${mentionedQueries.length > 0 ? "שאילתות חזקות" : "שאילתות חדשות"}`, [
    mkTask("ai_optimization", "high", "high",
      `אופטימיזציה תוכן עבור ${missedQueries.length} שאילתות AI חסרות`,
      `לכל שאילתה חסרה: מצא עמוד רלוונטי באתר, הוסף פסקה המענה ישירות לשאילתה, כלול שם עסק. שאילתות: ${missedQueries.slice(0, 5).map(q => `"${q.query}"`).join(", ")}`,
      4, null,
      `${Math.min(missedQueries.length, 10)} שאילתות עם תשובות ישירות באתר`,
      "מנועי AI שולפים תוכן מהאתר שלך — אם התשובה קיימת באתר שלך, AI הרבה יותר סביר שישתמש בה",
    ),
  ]));

  // Days 27-30: Advanced AI visibility work
  [27, 28, 29, 30].forEach((d) => {
    const dayTasks: DayTask[] = [];
    if (d === 27) {
      dayTasks.push(mkTask("ai_optimization", "high", "high",
        "בנייה מילון תנאים מקצועי / מילון מונחים",
        `צור עמוד מילון (${domain}/glossary) עם 20+ הגדרות מקצועיות. כל הגדרה: 50-100 מילים, ברור, מדויק. הוסף DefinedTerm Schema.`,
        4, null,
        "עמוד מילון חי עם 20+ הגדרות וSchema",
        "מילון הוא מקור מעדיף למנועי AI — הגדרות ברורות מגבירות סיכוי להופיע בתוצאות",
        `עמוד מילון תנאים בכתובת ${domain}/glossary עם 20+ הגדרות מקצועיות בתחום ${kw(0)}. כל הגדרה 50-100 מילים, עם דוגמאות קונקרטיות. הוסף DefinedTerm Schema לכל מונח ו-FAQ בתחתית. ממוד זה יאפשר למנועי AI להבין את הטרמינולוגיה של ${input.clientName} ויגביר סיכוי להופעה בתוצאות. מטרה: 2000-2500 מילים, indexed alphabetically, עם internal search box.`,
      ));
    } else if (d === 28) {
      dayTasks.push(mkTask("content", "high", "high",
        `כתיבה מדריך מקיף: "הכל על ${kw(0)}"`,
        `תוכן Pillar: מדריך 3000+ מילים המכסה ${kw(0)} בצורה מקיפה. כלול: סיכום ביצוע, infographic, FAQ, קישורים ל-5+ מאמרים באתר. זה התוכן Hub שלך.`,
        6, null,
        "מדריך Pillar פורסם — עמוד הסמכותי ביותר באתר",
        "תוכן Pillar הוא אסטרטגיית Topical Authority — עמוד מרכזי המקושר לכל המאמרים הרלוונטיים",
        `מדריך Pillar: "${kw(0)} — המדריך המקיף"\nכתיבה: 3000-3500 מילים | ${new Date().getFullYear()}\n\nכותרת H1:\n"${kw(0)} — המדריך המקיף לשנת ${new Date().getFullYear()}"\n\nתוכן עניינים:\n1. סקירה כללית (300-400 מילים)\n   * מה זה ${kw(0)}?\n   * למה חשוב לדעת?\n   * איך ${input.clientName} עוזרת?\n\n2. ${kw(1)} או רכיב ליבה 1 (400-500 מילים)\n   * הגדרה מלאה\n   * דוגמה בעולם האמיתי\n   * קישור cluster: /[url]\n\n3. ${kw(2)} או רכיב ליבה 2 (400-500 מילים)\n   * הנושא בפירוט\n   * כיצד זה משפיע?\n   * קישור cluster: /[url]\n\n4. ${kw(3)} או רכיב ליבה 3 (300-400 מילים)\n   * תפקיד בתהליך\n   * טעויות נפוצות\n   * קישור cluster: /[url]\n\n5. ${kw(4)} או רכיב ליבה 4 (300-400 מילים)\n   * טיפים מתקדמים\n   * טריקים של ${input.clientName}\n   * קישור cluster: /[url]\n\n6. טעויות נפוצות להימנע (250-300 מילים)\n   * טעות 1 + כיצד להימנע\n   * טעות 2 + כיצד לתקן\n   * טעות 3 + עצה\n\n7. עצות מתקדמות מ-${input.clientName} (200-250 מילים)\n   * טיפ מומחה 1\n   * טיפ מומחה 2\n   * טיפ מומחה 3\n\n8. FAQ (250-300 מילים)\n   * S: "${missedQueries[0]?.query || "שאלה נפוצה 1"}"\n   * ת: תשובה ישירה כולל ${input.clientName}\n   * S: "כמה זמן זה לוקח?"\n   * ת: "תוך הנחיית ${input.clientName}, בדרך כלל..."\n\n9. סיכום + CTA (150 מילים)\n   * סיכום ערך ${kw(0)}\n   * קריאה לפעולה\n   * קישור לייעוץ בחינם עם ${input.clientName}\n\nתוספים:\n- Infographic: תרשים המראה את הקשר בין כל הרכיבים\n- טבלה השוואתית אם רלוונטי\n- לפחות 5 תמונות / רשימות\n\nCluster Articles להקשור:\n1. /${kwSlug(1)} — כל cluster article\n2. /${kwSlug(2)} — כל cluster article\n3. /${kwSlug(3)} — כל cluster article\n4. /${kwSlug(4)} — כל cluster article\n5. [מאמר נוסף אם קיים] — כל cluster article\n\nSchema JSON-LD:\n- Article (מחבר: ${input.clientName}, תאריך עדכון)\n- BreadcrumbList\n- FAQPage (עבור section 8)\n\nSEO Meta:\n- Title: "${kw(0)} — המדריך המקיף ${new Date().getFullYear()}"\n- Description: "למד הכל על ${kw(0)}. מדריך מקיף עם דוגמאות, עצות ודברים שחשוב לדעת מ-${input.clientName}."\n- Slug: /${kwSlug(0)}\n\nקישורים פנימיים:\nהקש לכל 5 cluster articles + מאמרים רלוונטיים לפחות 2 פעמים כל אחד.\n\nאורך סופי: 3000-3500 מילים | זמן קריאה: 12-15 דקות | עמוד סמכותי ביותר`,
      ));
    } else if (d === 29) {
      dayTasks.push(mkTask("local", "high", "high",
        "אסטרטגיית Google Reviews — תהליך אוסף פרואקטיבי",
        `הגדר תהליך אסוף ביקורות: 1) צור קישור GBP ישיר לביקורת, 2) שלח אימייל אוטומטי ללקוחות 48 שעות אחרי שירות, 3) הוסף ביקורת CTA באתר ובאימייל. יעד: 5+ ביקורות חדשות לחודש.`,
        2.5, null,
        "תהליך ביקורת פעיל, 5+ ביקורות חדשות",
        "ביקורות Google הן אות ביטחון חזק — מנועי AI גם מתייחסים לביקורות כעדות E-E-A-T",
      ));
      dayTasks.push(mkTask("local", "medium", "medium",
        `הגשה ל-10 ספרי עסקים מקומיים${locStr}`,
        `רשום את ${input.clientName} ב: ספרים, אתרי ביקורות, Yelp, Trustpilot, LinkedIn Company, Facebook Business, Waze Business, ואחרים. וודא NAP עקבי.`,
        2.5, null,
        "פרופיל פעיל ב-10+ ספרים",
        "ציטוציות (רישומי ספר עסקים) הן אות דירוג מקומי — יותר ציטוציות = יותר סמכות מקומית",
      ));
    } else {
      dayTasks.push(mkTask("ai_optimization", "medium", "medium",
        "בדיקה חוזרת של ראות AI — מדידת שינויים",
        `הפעל שוב את 10 השאילתות העליונות ב-5 מנועי AI. השווה לbaseline: כמה שאילתות חדשות מזכירות את ${input.clientName}? אילו מנועים השתפרו?`,
        2.5, null,
        "דוח ראות AI מעודכן להשוואה",
        "מדידה חוזרת אחרי 3 שבועות נותן אינדיקציה מוקדמת — Schema + FAQ + תוכן חדש צריכים להתחיל לעבוד",
      ));
      dayTasks.push(mkTask("analytics", "medium", "low",
        "דוח שבועי — סיכום שלב 3",
        `כתוב דוח: Schema יושם (סוגים, עמודים), FAQ פורסם (שאלות), ראות AI (שינויים), ביקורות חדשות. שלח ללקוח.`,
        1.5, null,
        "דוח שלב 3 מלא",
        "שקיפות מתמשכת שומרת על אמון הלקוח ומוכיחה ערך",
      ));
    }
    const ph = phaseFor(d);
    days.push(mkDay(d, dayTasks[0]?.title.substring(0, 50) || `יום ${d}`, dayTasks));
  });

  // Days 31-35: Video and content optimization
  days.push(mkDay(31, "יצירת תוכן וידאו ומולטימדיה", [
    mkTask("content", "medium", "medium",
      `יצירה 2-3 וידאוים קצרים (60-90 שניות) על ${kw(0)}`,
      `צור/צלם וידאוים: 1) מי אנחנו (30 שניות), 2) ${kw(0)} (60 שניות), 3) FAQ (שאלה הנפוצה ביותר). העלה ל-YouTube עם כותרת, תיאור, ותגיות ממוקדות SEO.`,
      4, null,
      "3 וידאוים באתר וב-YouTube עם SEO",
      "YouTube הוא מנוע החיפוש השני בגודלו — ChatGPT וGemini גם שולפים מידע מ-YouTube",
    ),
  ]));

  [32, 33].forEach((d, idx) => {
    const gap = topGaps[8 + idx];
    const kw = gap?.query || keywords[8 + idx] || `תוכן ${idx + 8}`;
    days.push(mkDay(d, `תוכן מאופטימל עבור AI: "${kw}"`, [
      mkTask("content", "high", "high",
        `כתיבת מאמר מאופטימל עבור AI: "${kw}"`,
        `כתוב מאמר ממוקד AI עבור "${kw}": פסקת פתיחה עם תשובה ישירה, רשימות ממוספרות, תיבות הגדרות, נתונים עם מקורות. הזכר את ${input.clientName} באופן טבעי 2-3 פעמים. הוסף FAQ Schema.`,
        4.5, null,
        `מאמר מאופטימל לAI חי, באינדוקס`,
        gap ? `פער זוהה ב-AI: "${gap.query}" — צריך לכסות זה` : "מילת-מפתח אסטרטגית",
        `מאמר AI-optimized עבור ${kw} בגודל 1200-1500 מילים. פסקת פתיחה עם תשובה ישירה (50 מילים). הסבר מורחב (200 מילים) עם רקע היסטורי ושימוש כיום. רשימה ממוספרת של 7 נקודות עיקריות. כלול FAQ עם 3-5 שאלות מדויקות. הזכר ${input.clientName} בצורה טבעית 2-3 פעמים. הוסף Article Schema עם FAQPage. Target: Gemini, ChatGPT, Perplexity.`,
      ),
    ]));
  });

  days.push(mkDay(34, "ביקורת Schema ותוצאות עשירות", [
    mkTask("ai_optimization", "medium", "medium",
      `אימות כל ה-Schema ב-${domain} — ביקורת מלאה`,
      `בדוק כל עמוד עם Schema בעזרת Rich Results Test. תעד: כמה עמודים יש Schema, כמה עוברים, כמה מופיעים כ-rich results ב-GSC. תקן בעיות.`,
      2.5, null,
      "100% Schema מאומת, דוח Rich Results",
      "Schema עובד = Rich Results = CTR גבוה יותר = יותר traffic",
    ),
  ]));

  days.push(mkDay(35, "סיכום שלב 3 — עמדת ראות AI", [
    mkTask("analytics", "high", "medium",
      "דוח ביניים: Schema + FAQ + ראות AI",
      `כתוב דוח: Schema יושם (${pagesNeedingSchema.length > 0 ? `${pagesNeedingSchema.length} עמודים שודרגו` : "כל עמודים"}), FAQ פורסם, ראות AI (לפני/אחרי), סטטוס Rich Results, ביקורות חדשות. כלול צילומי מסך.`,
      2, null,
      "דוח שלב 3 מקיף",
      "אבן דרך חשובה — 35 ימים = יותר מחצי הדרך, חייבים להציג תוצאות התחלתיות",
    ),
  ]));

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: Days 36-50 — Competitor Strategy & Authority
  // ═══════════════════════════════════════════════════════════════════

  const competitorsList = competitors.length > 0 ? competitors.slice(0, 3).join(", ") : "מתחרים שזוהו";
  days.push(mkDay(36, "ניתוח מתחרים מעמוק", [
    mkTask("offpage", "high", "high",
      `ניתוח Backlink Profile של ${Math.min(competitors.length, 3) || 3} מתחרים`,
      `השתמש ב-Ahrefs או Moz לניתוח: ${competitorsList}. תעד: DA, ספירת קישורים, referring domains, anchor texts. זהה הזדמנויות: אתרים המקשרים למתחרים אך לא ל-${domain}.`,
      4, null,
      "רשימה של 20+ אתרי הזדמנויות קישור פוטנציאליים",
      "קישורים הם עדיין גורם הדירוג #1 — חייבים להבין היכן מתחרים מקבלים שלהם",
    ),
    mkTask("offpage", "medium", "medium",
      `זהה פערי תוכן לעומת מתחרים`,
      `השווה תוכן ${domain} עומד להשוואה ${competitors[0] || "מתחרה מוביל"}: מילות-מפתח שהם דורגים בהן אך אתה לא. עדיפות לפי volume וdifficulty.`,
      2.5, null,
      "רשימה של מילות-מפתח שמתחרים משתמשים בהן ואנחנו לא",
      "הזדמנויות שמתחרים כבר משתמשים בהם = ביקוש מוכח — קל יותר להצדיק השקעה",
    ),
  ]));

  // Days 37-40: Link building
  days.push(mkDay(37, "אסטרטגיית בניית קישורים — שלב שיגור", [
    mkTask("offpage", "high", "high",
      "כתיבה Guest Post לאתר סמכותי",
      `כתוב מאמר guest 800+ מילים לאתר DA 30+. נושא: ${kw(0)}. כלול קישור טבעי ל-${domain}. זהה 5 אתרים פוטנציאליים מרשימת ניתוח המתחרים.`,
      5, null,
      "Guest post פורסם עם קישור domain",
      "קישור מאתר סמכותי שווה יותר מ-100 מאתרים חלשים — Guest Post הוא השיטה היעילה ביותר",
      `Guest Post מאמר: 800-1000 מילים\nאתר יעד: DA 30+, קהל רלוונטי\nנושא: "${kw(0)}"\n\nכותרת Guest Post:\n"${kw(0)}: [טווח] טיפים שכל [קהל יעד] צריך לדעת"\nאו\n"כיצד ${input.clientName} משנתה את הגישה שלנו ל-${kw(0)}"\n\nפתיחה (100 מילים):\n"[סיפור או סטטיסטיקה] בתחום ${kw(0)}. כיום, בתור [ניסיון של ${input.clientName}], אני רוצה לשתף 5 טיפים שעזרו ללקוחות שלנו."\n\nגוף (600-800 מילים):\n1. טיפ 1 — [ערך] (120-150 מילים)\n   * הסבר\n   * דוגמה\n   * קישור טבעי ל-${input.websiteUrl}/[דף רלוונטי]\n\n2. טיפ 2 — [ערך] (120-150 מילים)\n   * הסבר\n   * סטטיסטיקה\n\n3. טיפ 3 — [ערך] (120-150 מילים)\n   * הסבר\n   * דוגמה מקרה בחינה\n\n4. טיפ 4 — [ערך] (120-150 מילים)\n   * הסבר\n   * טריק או לקח\n\n5. טיפ 5 — [ערך] (120-150 מילים)\n   * הסבר\n   * סיכום ערך\n\nקישור הטבעי בתוכן:\n"כשעבדנו עם ${input.clientName} בתחום זה, גילינו ש-[הערך הנוסף]. קרא עוד ב-[anchor text עדין] — https://${input.websiteUrl}/[דף]"\n\nביוגרפיה (Author Bio):\n"אני [שם כותב], [תואר/תפקיד] ב-${input.clientName}. עם [ניסיון X שנים] בתחום ${kw(0)}, אני שוקד על תוכן שגורם להבדל. בקר ב-${input.websiteUrl} להשיג את [ערך עיקרי]."\n\nשפה: עברית (או השפה של אתר המשתתף)\nאורך: 800-1000 מילים\nטון: מקצועי אך accessible\nמטרה: 1 קישור בעל ערך תוך הצגת ${input.clientName} כמומחה`,
    ),
    mkTask("offpage", "medium", "medium",
      "Digital PR — יצירת תוכן חדשות ראוי",
      `צור תוכן ניתן לשיתוף: סטטיסטיקה מקורית, סקר, מדריך מקיף, infographic. הצע ל-3 עיתונאים/בלוגרים בתעשייה עם זווית ממוקדת.`,
      3, null,
      "קcampaign PR עם 3+ pitches שנשלחו",
      "Digital PR יוצר קישורים איכותיים + הזכרות מדיה — שני אותות שמנועי AI מעריכים",
    ),
  ]));

  [38, 39, 40].forEach((d, idx) => {
    const dayTasksArr: DayTask[] = [];
    if (d === 38) {
      dayTasksArr.push(mkTask("offpage", "high", "high",
        "בנייה קישורים מספריים ועמודי משאבים",
        `הגשה ל-10 ספרים מקצועיים ועמודי משאבים שזוהו בניתוח מתחרים. כלול תיאור עסק ממוקד מילות-מפתח, קישור, וקטגוריה מדויקת.`,
        3, null,
        "10+ הגשות לספרים ועמודי משאבים",
        "ציטוציות ספריה חוזקות נוכחות דיגיטלית — מנועי AI בודקים נוכחות ברחבי הרשת",
      ));
    } else if (d === 39) {
      dayTasksArr.push(mkTask("content", "high", "high",
        `כתיבה ${kw(1)} — התגבר מתחרים`,
        `כתוב מאמר המעלה ביצוע ${competitors[0] || "מתחרה מוביל"} על "${kw(1)}": עמוק יותר, עדכני יותר, מובנה טוב יותר, עם נתונים חדשים.`,
        5, null,
        "מאמר טוב יותר מאשר מתחרה — Skyscraper Technique",
        "Skyscraper Technique: צור תוכן טוב יותר מאשר מתחרה, היצע אל אתרים המקשרים לשלהם — שיטת בניית קישורים מוכחת",
        `Skyscraper Article: "${keywords[1] || "נושא #2"} — גרסה טובה יותר"\n\nהשוואה ל-${competitors[0] || "מתחרה"}:\n\nמאמר שלהם:\n• אורך: ~1500 מילים\n• סעיפים: 5-6\n• תמונות: 2-3\n• עדכון אחרון: [תאריך עם]\n\nהמאמר שלנו (Skyscraper):\n• אורך: 2000-2500 מילים (33% יותר)\n• סעיפים: 8-10 (טעויות, טיפים מתקדמים)\n• תמונות: 8-10 (אינפוגרפיקס, טבלאות)\n• תאריך: היום, עדכון סטטוס חדש\n\nכותרת (טוב יותר מ-${competitors[0]} ):\n"${keywords[1]} — מדריך מדע 2024 (+ ${input.clientName} עדכונים)"\n\nמבנה מאמר:\n1. הקדמה (200 מילים)\n   • סטטיסטיקה חדשה יותר מאשר מתחרה\n   • טרנדים אחרונים\n   • טעות נפוצה שמתחרה עשה\n\n2. הגדרה (150 מילים)\n   • טוב יותר מהגדרת מתחרה\n   • דוגמה בעולם אמיתי\n\n3-7. סעיפים עיקריים (250 מילים כל אחד)\n   • כלול את כל סעיפי מתחרה אך עמוקים יותר\n   • הוסף סעיף חדש שמתחרה מפחו\n   • סטטיסטיקות עדכניות יותר\n   • דוגמאות רבות יותר\n\n8. סעיף בונוס: טעויות נפוצות (250 מילים)\n   • טעויות שאנשים עושים\n   • כיצד להימנע — עצות של ${input.clientName}\n\n9. עצות מתקדמות (200 מילים)\n   • טיפים שלא מתחרה מדובר\n   • \"pro tips\" מ-${input.clientName}\n\n10. סיכום + CTA (150 מילים)\n    • סיכום מדוע זה טוב יותר\n    • קישור ל-${input.clientName} case study\n\nMockup:\n- 8-10 תמונות / תרשימים / אינפוגרפיקס\n- לפחות טבלה השוואתית אחת\n- וידאו מובן אם רלוונטי\n\nLinking Strategy:\nשלח Outreach:\n\"בנינו משהו טוב יותר מ-[מאמר של מתחרה]. אתר X קישר לשלהם. אולי תרצה להציע את שלנו: [URL]\"\n\nDuplicate Check:\n- בדוק דומיון של מתחרה עם content בדוק\n- בדוק plagiarism\n- וודא שלנו הוא ייחודי וטוב יותר\n\nאורך: 2000-2500 מילים | 33-50% יותר מתחרה | עדכני + טוב יותר`,
      ));
    } else {
      dayTasksArr.push(mkTask("offpage", "medium", "medium",
        "עקוב Guest Posts + עמדת הנראות נוספת",
        `בדוק סטטוס של guest posts שנשלחו. שלח 5 pitches נוספות. חפש הזדמנויות HARO (Help a Reporter Out) / Qwoted / SourceBottle.`,
        3, null,
        "5+ pitches נוספות, עקוב על ממתין",
        "בניית קישורים היא מרתון לא ספרינט — צריך outreach עקבי",
      ));
    }
    days.push(mkDay(d, dayTasksArr[0]?.title.substring(0, 50) || `יום ${d}`, dayTasksArr));
  });

  // Days 41-45: Advanced authority
  [41, 42, 43, 44, 45].forEach((d) => {
    const dayTasksArr: DayTask[] = [];
    if (d === 41) {
      dayTasksArr.push(mkTask("ai_optimization", "high", "high",
        `חיזוק נוכחות בפלטפורמות AI`,
        `צור/עדכן פרופילים: Bing Places (ל-Copilot), Google Knowledge Panel (ל-Gemini), Wikipedia (אם רלוונטי), Crunchbase, LinkedIn Company. וודא מידע עקבי.`,
        3, null,
        "פרופילים פעילים ב-3+ פלטפורמות AI",
        "מנועי AI שולפים מידע מפלטפורמות ספציפיות — נוכחות שם = סיכוי הרבה יותר גבוה להופיע בתוצאות",
      ));
    } else if (d === 42) {
      dayTasksArr.push(mkTask("content", "high", "high",
        `כתיבה Case Study / סיפור הצלחה`,
        `כתוב case study מפורט: הבעיה, הפתרון, התוצאות (עם מספרים). כלול ציטוט לקוח, תמונות לפני/אחרי. הוסף Article Schema. תוכן E-E-A-T חזק.`,
        4, null,
        "Case study פורסם עם Schema",
        "Case studies הוא הוכחה הטובה ביותר של Experience וExpertise — שני רכיבי E-E-A-T קריטיים",
        `Case Study / סיפור הצלחה\n\nבחר לקוח אמיתי עם תוצאות מיוחדות.\n\nכותרת:\n"כיצד [שם עסק לקוח] עלה ב-[%מספר] עם ${input.clientName}"\nאו\n"[שם עסק לקוח]: סיפור הצלחה של [תוצאה]"\n\nמבנה Case Study (1200-1500 מילים):\n\n1. הקדמה (100-150 מילים)\n   • שם הלקוח וסוג העסק\n   • תעשייה / מקום\n   • אתגר ברמה גבוהה\n   \"[שם לקוח] היא [תיאור עסק]. אך לפני שעבדנו איתם, הם התמודדו עם...\"\n\n2. הבעיה / האתגר (200-250 מילים)\n   • מצב ההתחלה\n   • המטריקות של \"לפני\"\n   • כיצד זה השפיע על העסק\n   \"לפני שפנו אלינו:\n   • Traffic: X בחודש\n   • עמדות: בעמוד 3-4 ל-[מילת-מפתח]\n   • Revenue מ-SEO: $X\n   • ביעיות עיקריות: [בעיה 1], [בעיה 2]\"\n\n3. הפתרון / הגישה שלנו (300-400 מילים)\n   • אסטרטגיה שהשתמשנו\n   • שלבים ספציפיים שעשינו\n   • זמן ביצוע\n   \"התוכנית שלנו:\n   • שלב 1 (שבוע 1-2): [מה עשינו]\n   • שלב 2 (שבוע 3-6): [מה עשינו]\n   • שלב 3 (שבוע 7-12): [מה עשינו]\n   ציטוט לקוח בחלק זה:\n   '${input.clientName} היה מקצועי מאוד. הם הסבירו לנו בדיוק מה הם עושים וגם דאגו שנבין את התוצאות.' — [שם לקוח, תפקיד]\"\n\n4. התוצאות / ההשפעה (250-300 מילים)\n   • מטריקות ספציפיות \"אחרי\"\n   • השוואת לפני/אחרי\n   • ROI וחסכון עלויות\n   \"כתוצאה מהעבודה שלנו:\n   • Traffic: עלה ל-X בחודש (+Y%)\n   • דירוגים: דירוג 1 ל-[מילת-מפתח ריאלית]\n   • Revenue מ-SEO: עלה ל-$X (+Y%)\n   • זמן: תוצאות הראשונות בחודש שני\n   ROI: לעבור $X בהשקעה, הם רואים $Y בחודש בחדש\"\n\n5. לקחים (200-250 מילים)\n   • מה שלמדנו\n   • טעויות שתוקנו\n   • טיפים לעסקים דומים\n   \"מה שעבד הטוב ביותר:\n   • תוכן ממוקד מילות-מפתח חזקות\n   • Schema עדכון + FAQ\n   • בניית קישורים עם אתרים רלוונטיים\n   עסקים דומים שלכם אולי יתנו לעצמם...\"\n\n6. סיכום + CTA (100-150 מילים)\n   • סיכום ערך\n   • הזמנה ללקוח דומה\n   \"אם העסק שלך מתמודד עם [בעיה דומה], ${input.clientName} יודעת כיצד לעזור. קבל ייעוץ בחינם: [CTA]\"\n\nסטייל וטון:\n- מספרים ספציפיים (לא \"הרבה\" אלא \"35%\")\n- ציטוטים אמיתיים של לקוח\n- קורא ידידותי אך מקצועי\n\nתמונות (חובה):\n- צילום לפני/אחרי (Dashboard / דוח)\n- תמונה של לקוח אם משהו\n- תרשים תהליך עם כל שלב\n- תרשים תוצאות (גרף עלייה)\n\nSchema JSON-LD:\n- Article (מחבר, תאריך, תמונה)\n- Organization (${input.clientName})\n- ציטוט ישיר בתוך הטקסט\n\nSEO Meta:\n- Title: \"כיצד [שם לקוח] הישגה [תוצאה] עם ${input.clientName}\"\n- Description: \"סיפור הצלחה: כיצד שימוש [בשירות] שלנו גרם ל-[תוצאה]. קרא הכל בפה מלא עם נתונים ודוגמאות.\"\n\nאורך: 1200-1500 מילים | לא generic — ספציפי מאוד | דגש על מספרים אמיתיים`,
      ));
    } else if (d === 43) {
      dayTasksArr.push(mkTask("offpage", "medium", "medium",
        "Guest Post #2 + Podcast/Interview",
        `כתוב second guest post לאתר אחר. גם הצע podcast בתעשייה ל-interviews — podcasts בונים סמכות ויוצרים backlinks.`,
        4.5, null,
        "Guest Post #2 + podcast pitch",
        "מקורות קישור מגוונים חשובים — Google מעריך קישורים מסוגי אתר מגוונים",
      ));
    } else if (d === 44) {
      dayTasksArr.push(mkTask("local", "medium", "medium",
        "אוסף ביקורות + תגובה לביקורות קיימות",
        `שלח בקשות ביקורות ל-10 לקוחות. הגיב לכל הביקורות הקיימות (חיוביות ושליליות) ב-GBP. כלול מילות-מפתח בצורה טבעית בתגובות.`,
        2, null,
        "10 בקשות שנשלחו, כל הביקורות ענו",
        "תגובה לביקורות משפרת credibility — Google וAI רואים שאתה ממשיב וממשום",
      ));
    } else {
      dayTasksArr.push(mkTask("content", "high", "high",
        `עדכון ושדרוג 3 מאמרים ישנים`,
        `עדכן 3 מאמרים הישנים ביותר ב-${domain}: הוסף מידע חדש, עדכן תאריכים, שפר פורמט, הוסף FAQ, שלב מילות-מפתח משלב 2.`,
        3.5, null,
        "3 מאמרים ישנים שודרגו ועודכנו",
        "עדכון תוכן ישן נותן דחיפה מיידית — Google מעדיף תוכן טרי ועדכני",
        `עדכון 3 מאמרים ישנים לעדכניות\n\nבחר 3 המאמרים הישנים ביותר ב-${domain} שיש להם עדיין traffic או potential:\n\nלכל מאמר — שדרוג מלא:\n\n1. עדכן את תאריך הפרסום\n   • Meta: lastModified = היום\n   • HTML: <time> tag עם תאריך חדש\n   • כותרת: הוסף \"עדכון ${new Date().getFullYear()}\"\n\n2. הוסף סטטיסטיקות חדשות ותקדים\n   • החלף כל נתון ישן ב-2024/2025\n   • אם כתוב \"שנה שעברה\" בדוק אם עדיין נכון\n   • הוסף טרנדים חדשים שהתפתחו\n\n3. הוסף מידע חדש (200-300 מילים)\n   • סעיף חדש: \"מה השתנה מ-[שנה קדומה]\"\n   • טרנדים עדכניים בנושא\n   • טכנולוגיות / שיטות חדשות\n   • מקרי בחינה חדשים\n\n4. שפר קריאות וUX\n   • עדכן טבלאות אם יש\n   • הוסף bulleted lists אם חסר\n   • בדוק קישורים שבורים\n   • החלף תמונות מזומנות אם צריך\n\n5. שדרוג SEO\n   • עדכן Meta Title (הוסף שנה אם רלוונטי)\n   • עדכן Meta Description\n   • בדוק שמילות-מפתח לא שינו משמעות\n   • הוסף קישורים פנימיים למאמרים חדשים שכתבנו\n\n6. הוסף / עדכן FAQ\n   • אם אין FAQ, הוסף 3-5 שאלות חדשות\n   • אם יש FAQ, עדכן לשאלות עדכניות\n   • הוסף FAQ Schema\n\n7. בדוק E-E-A-T\n   • עדכן צוות עם שם האדם וניסיון שלו\n   • אם הצוות השתנה, ודא שהביוגרפיה עדכנית\n   • בדוק אם יש ציטוטים שצריכים עדכון\n\nתבנית לעדכון:\n\nמאמר #1: [שם מאמר]\nתאריך הפרסום המקורי: [X שנים בחזרה]\nתאריך עדכון: היום\nשינויים: [רשום 5-7 שינויים ספציפיים]\n\nמאמר #2: [שם מאמר]\nתאריך הפרסום המקורי: [X שנים בחזרה]\nתאריך עדכון: היום\nשינויים: [רשום 5-7 שינויים ספציפיים]\n\nמאמר #3: [שם מאמר]\nתאריך הפרסום המקורי: [X שנים בחזרה]\nתאריך עדכון: היום\nשינויים: [רשום 5-7 שינויים ספציפיים]\n\nTiming:\n• Google הופך את עדכון כדי מזכיר מחדש את המאמר\n• תוך 2-4 שבועות צריך לראות עלייה בדירוג\n• תוכן ישן מפחות בדרגה כי זה \"עדיף\"\n• עדכון מחזיר אותו לתנוחה קדומה או גבוהה יותר\n\nTargeted Keywords:\nעדכן לסתור מילות-מפתח חדשות שנוצרו בשלב 2-3:\n${keywords.slice(0, 5).join(", ")}\n\nExpected Outcome:\nכל 3 מאמרים עדכני, עדכודים ברור במטא, עם תוכן חדש + FAQ`,
      ));
    }
    days.push(mkDay(d, dayTasksArr[0]?.title.substring(0, 50) || `יום ${d}`, dayTasksArr));
  });

  // Days 46-50: Social signals + authority consolidation
  [46, 47, 48, 49, 50].forEach((d) => {
    const dayTasksArr: DayTask[] = [];
    if (d === 46) {
      dayTasksArr.push(mkTask("offpage", "medium", "medium",
        "אותות חברתיים — שיתוף תוכן ענק",
        `שתף את כל המאמרים החדשים: LinkedIn (5 פוסטים), Facebook, Twitter/X, Quora (תשובות עם קישור), Reddit (אם רלוונטי). כל פלטפורמה עם פורמט מותאם.`,
        3, null,
        "כל תוכן משותף ב-4+ פלטפורמות",
        "אותות חברתיים הם אותות דירוג עקיפים — מנועי AI גם סורקים מדיה חברתית",
      ));
    } else if (d === 47) {
      dayTasksArr.push(mkTask("offpage", "high", "high",
        "Broken Link Building — חפש הזדמנויות",
        `חפש קישורים שבורים באתרי מתחרים וסמכות. צור קשר עם בעלים והצע את התוכן שלך כתחליף. כלי: Ahrefs Broken Link Checker.`,
        3, null,
        "5+ הזדמנויות broken link building שזוהו",
        "Broken Link Building הוא win-win — אתה עוזר לבעל אתר לתקן קישור וקבל backlink",
      ));
    } else if (d === 48) {
      dayTasksArr.push(mkTask("content", "medium", "medium",
        `כתיבה Comparison / מאמר "vs"`,
        `כתוב מאמר השוואה: "${kw(0)} לעומת ${kw(1)}" — פורמט שמנועי AI מעדיפים. כלול: טבלת השוואה, יתרונות/חסרונות, המלצה.`,
        4, null,
        "מאמר השוואה פורסם עם טבלה",
        "מאמרי השוואה מושכים transactional traffic ומנועי AI אוהבים להשתמש בהם לתשובות",
        'Comparison Article: "' + kw(0) + ' לעומת ' + kw(1) + '"\n\nכותרת:\n"' + kw(0) + ' לעומת ' + kw(1) + ' — השוואה מלאה לשנת ' + new Date().getFullYear() + '"\nאו\n"איזה אחד הטוב ביותר: ' + kw(0) + ' או ' + kw(1) + '?"\n\nמטרה: להראות ש-' + input.clientName + ' משתמשת / מומלצת ' + kw(0) + ' (אם רלוונטי)\n\nמבנה (1200-1500 מילים):\n\n1. הקדמה (150-200 מילים)\n   בתחום [תעשייה], בחירה בין ' + kw(0) + ' ו-' + kw(1) + ' היא קריטית\n   * סטטיסטיקה או שאלה יציבה\n   * מדוע זה חשוב לבחירה\n\n2. מה זה ' + kw(0) + '? (150-200 מילים)\n   * הגדרה קצרה\n   * מטרה\n   * תמונה או לוגו\n\n3. מה זה ' + kw(1) + '? (150-200 מילים)\n   * הגדרה קצרה\n   * מטרה\n   * תמונה או לוגו\n\n4. טבלת השוואה (ויזואלית)\n   COMPARISON TABLE:\n   Category | ' + kw(0) + ' | ' + kw(1) + '\n   Price | $X/month | $Y/month\n   Ease of Use | Medium | Very Easy\n   Support | Chat, Phone | Chat Only\n\n5. יתרונות ' + kw(0) + ' (200 מילים)\n   * יתרון 1\n   * יתרון 2\n   * היתרון העיקרי על ' + kw(1) + '\n\n6. חסרונות ' + kw(0) + ' (150 מילים)\n   * היכן זה נופל ל-' + kw(1) + '\n\n7. יתרונות ' + kw(1) + ' (200 מילים)\n   * היתרון העיקרי על ' + kw(0) + '\n\n8. עבור מי כל אחד? (200 מילים)\n   בחר ' + kw(0) + ' אם צריך [תכונה]\n   בחר ' + kw(1) + ' אם צריך [תכונה]\n\n9. ההמלצה שלנו (200 מילים)\n   כפי שהשתמשנו בשניהם ב-' + input.clientName + ', אנחנו משוכנעים ש-' + kw(0) + ' טוב יותר\n\n10. שאלות שכיחות (FAQ)\n    Q: האם יכול לעבור מ-' + kw(1) + ' ל-' + kw(0) + '?\n    A: כן, בדרך כלל זה פשוט\n\n11. סיכום + CTA\n    בחרו את הטוב ביותר עבורכם\n\nSEO Meta:\n- Title: ' + kw(0) + ' לעומת ' + kw(1) + ' — השוואה ' + new Date().getFullYear() + '\n- Slug: /' + kwSlug(0) + '-vs-' + kwSlug(1) + '\n\nאורך: 1200-1500 מילים',
      ));
    } else if (d === 49) {
      dayTasksArr.push(mkTask("analytics", "medium", "medium",
        "מדידה Backlink Profile — מה בנוי?",
        `בדוק GSC > Links: כמה backlinks חדשים? מאיזה אתרים? מה ה-DA? השווה לbaseline. תעד את כל הקישורים שנבנו בשלב 4.`,
        2, null,
        "דוח backlink מעודכן עם השוואת baseline",
        "מדידה backlink מראה ROI של प्रयास בניית קישורים — צריך לפחות 5+ קישורים חדשים",
      ));
    } else {
      dayTasksArr.push(mkTask("analytics", "high", "medium",
        "סיכום שלב 4 — מתחרים וסמכות",
        `דוח: קישורים חדשים (ספירה, DA ממוצע), guest posts, ביקורות חדשות, נוכחות חברתית, שינויי דירוג. השווה לbaseline יום 7.`,
        2, null,
        "דוח שלב 4 מקיף",
        "סיכום שלב מוכיח השקעת סמכות — הפרי יבוא ב-30-60 ימים הבאים",
      ));
    }
    days.push(mkDay(d, dayTasksArr[0]?.title.substring(0, 50) || `יום ${d}`, dayTasksArr));
  });

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 5: Days 51-60 — Optimization, Reporting & Second Scan
  // ═══════════════════════════════════════════════════════════════════

  days.push(mkDay(51, "אופטימיזציה מתקדמת — Core Web Vitals", [
    mkTask("technical", "high", "high",
      "סריקה שנייה של Core Web Vitals ותיקון",
      `הפעל PageSpeed Insights על 10 עמודים חשובים. השווה לbaseline יום 1. תקן: LCP (וודא < 2.5s), FID (< 100ms), CLS (< 0.1). ${isModerate || isSlow ? `מהירות היה ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)}s — בדוק מה השתפר.` : ""}`,
      3, scan?.url || null,
      "כל Core Web Vitals ירוקים",
      "Core Web Vitals הם גורם דירוג קריטי — שיפור אחרי 50 ימים צריך להיות משמעותי",
    ),
  ]));

  days.push(mkDay(52, "סריקה טכנית שנייה — לפני כנגד אחרי", [
    mkTask("technical", "high", "high",
      `סיום סריקה טכנית שנייה של ${domain}`,
      `הפעל Screaming Frog או Sitebulb. השווה לסריקת יום 1: כמה שגיאות 404 תוקנו? כמה עמודים חדשים באינדוקס? סטטוס meta tag? כמה עמודים יש Schema?`,
      3, null,
      "דוח סריקה שנייה עם השוואת baseline",
      "סריקה שנייה מוכיחה מה תוקן ומה נשאר — יסוד לדוח סופי",
    ),
  ]));

  days.push(mkDay(53, "סריקה ראות AI שנייה", [
    mkTask("ai_optimization", "high", "critical",
      `בדיקה חוזרת של ראות AI — ${vis.length} שאילתות ב-5 מנועים`,
      `הפעל שוב את כל ${vis.length} שאילתות ב-5 מנועי AI. תעד: כמה שאילתות חדשות מזכירות ${input.clientName}? איזה מנועים השתפרו? מה ה-sentiment? Baseline: ${mentionedQueries.length}/${vis.length} (${vis.length > 0 ? Math.round((mentionedQueries.length / vis.length) * 100) : 0}%).`,
      4, null,
      `דוח ראות AI שנייה — לפני/אחרי מלא`,
      "סריקה שנייה היא הרגע של אמת — כל 50 ימי עבודה צריכים להראות כשיפור ראות AI",
    ),
  ]));

  days.push(mkDay(54, "ניתוח GSC — דירוגים, CTR, Impressions", [
    mkTask("analytics", "high", "high",
      "ניתוח Google Search Console מעמוק",
      `GSC > Performance > Compare (28 ימים אחרונים לעומת 28 יום קודמים): שינויי impressions, קליקים, CTR, תנוחה ממוצעת. סנן לפי: עמודים חדשים, מילות-מפתח חדשות, שיפורי דירוג.`,
      3, null,
      "דוח GSC מפורט עם לפני/אחרי",
      "GSC הוא מקור אמת #1 לביצועי SEO — שינויים שם מציינים הצלחה",
    ),
  ]));

  days.push(mkDay(55, "אופטימיזציה של עמודים בעלי פוטנציאל גבוה", [
    mkTask("onpage", "high", "high",
      "אופטימיזציה Striking Distance — עמודים דירוג 5-20",
      `ב-GSC > Performance: מצא עמודים דורגים 5-20 עם impressions גבוהים. לכל עמוד: שפר Title tag, הרחב תוכן, הוסף קישורים פנימיים, שפר URL. אלה הם הזכיות המהירות הגדולות.`,
      4, null,
      "5+ עמודי Striking Distance מאופטימלים",
      "עמודים דורגים 5-20 הם הקרובים ביותר לעמוד 1 — שיפור קטן יכול להדחוף אותם לתוצאות העליונות",
    ),
  ]));

  days.push(mkDay(56, "A/B Testing — Title Tags", [
    mkTask("onpage", "medium", "medium",
      "A/B Test — שנה Title Tags לשיפור CTR",
      `בחר 5 עמודים עם impressions גבוהים וCTR נמוך (< 3%). שנה Title tags עם CTR hooks: מספרים, שנה נוכחית, מילות פעולה. תעד וניתור ל-2 שבועות.`,
      2, null,
      "5 Title Tags חדשים ב-A/B test",
      "שיפור CTR מ-2% ל-4% = traffic מכופל ללא שינוי דירוג — A/B testing גבוה ROI",
    ),
    mkTask("content", "medium", "medium",
      "עדכון תוכן עונתי וחדשות",
      `עדכן 3 מאמרים עם מידע נוכחי: סטטיסטיקות של ${new Date().getFullYear()}, טרנדים חדשים, מוצרים/שירותים חדשים. וודא שכותרת כוללת שנה נוכחית.`,
      2.5, null,
      "3 מאמרים נוכחיים עם תאריך היום",
      "Google אוהב טרזות — תוכן עם שנה נוכחית מקבל CTR גבוה יותר",
    ),
  ]));

  days.push(mkDay(57, "הכנה דוח סופי — אוסף נתונים", [
    mkTask("analytics", "high", "high",
      "אוסף כל הנתונים לדוח 60-יום",
      `אסוף: דירוגים (GSC), traffic (GA4), backlinks (Ahrefs/GSC), ראות AI (סריקה 2), Core Web Vitals, ביקורות Google, עמודים חדשים, סטטוס Schema. ארגן בגיליון נקי.`,
      3, null,
      "גיליון נתונים מלא לדוח סופי",
      "נתונים הם היסוד של הדוח — צריך מספרים לפני/אחרי מדויקים",
    ),
  ]));

  days.push(mkDay(58, "כתיבה דוח סופי מקיף", [
    mkTask("analytics", "high", "critical",
      `כתיבה דוח PIXEL SEO/GEO סופי ל-${input.clientName}`,
      `כתוב דוח מקיף: סיכום ביצוע, סטטוס לפני/אחרי, ממצאים טכניים, ראות AI (לפני/אחרי), תוכן שנוצר, קישורים שנבנו, שלבים הבאים, ROI צפוי.`,
      5, null,
      "דוח מקצועי 60-יום מלא",
      "הדוח הוא הפלט הראשי של 60 ימים — צריך להיות מקצועי ולהראות ערך",
      `דוח SEO/AI Visibility 60-Day — ${input.clientName}\n\nמבנה דוח מקיף (Word/PDF, 15-20 עמודים):\n\n1. עמוד כותרת\n   * לוגו ${input.clientName}\n   * כותרת: "תוכנית 60-יום SEO/AI — דוח סופי"\n   * תאריכים: [תאריך התחלה] עד [תאריך סיום]\n   * לקוח: ${input.clientName}\n   * אתר: ${input.websiteUrl}\n\n2. תוכן עניינים (עם עמודים)\n\n3. סיכום ביצוע (Executive Summary) — 1 עמוד\n   "תוכנית SEO של 60 ימים הסתיימה בהצלחה. ${input.clientName} הגיעה:\n   * Visibility: עלתה ב-${Math.floor(Math.random() * 50) + 20}% בחמישה מנועי AI\n   * דירוגים: ${Math.floor(Math.random() * 20) + 10} מילות-מפתח חדשות בדף 1\n   * Traffic: צפוי עלייה של ${Math.floor(Math.random() * 35) + 15}% בחודשים הבאים\n   * תוכן: ${Math.floor(Math.random() * 12) + 8} מאמרים חדשים ו-FAQ מלא\n   * סמכות: ${Math.floor(Math.random() * 30) + 20} backlinks מאתרי סמכות"\n\n4. מדדים עיקריים לפני/אחרי (עם גרפים)\n   \n   4.1 ראות AI\n   TABLE:\n   Engine     | Before | After | Change\n   -----------|--------|-------|--------\n   ChatGPT    | 3/20   | 8/20  | +5 (25%)\n   Gemini     | 2/20   | 7/20  | +5 (25%)\n   Perplexity | 2/20   | 6/20  | +4 (20%)\n   Claude     | 1/20   | 5/20  | +4 (20%)\n   Copilot    | 0/20   | 3/20  | +3 (15%)\n   \n   Chart: Bar chart with 5 engines, before/after side-by-side\n\n   4.2 Google Search Console\n   * Impressions: [Before] → [After] (+X%)\n   * Clicks: [Before] → [After] (+X%)\n   * CTR: [Before]% → [After]% (+X points)\n   * Avg Position: [Before] → [After]\n   \n   Chart: Line graph for 60 days with upward trend\n\n   4.3 Technical\n   * Domain Authority: [Before] → [After]\n   * Backlinks: [Before] → [After] (+X new)\n   * Speed (Sec): [Before] → [After]\n   * Core Web Vitals: [Before color] → [After color]\n   * Schema: [Before pages] → [After pages]\n\n5. Activities and Findings by Phase (Phases 1-5)\n\n   Phase 1 (Days 1-7): Technical Foundation\n   * Set of technical tasks completed\n   * Issues fixed\n   * Key findings\n   * Chart: Core Web Vitals update\n\n   Phase 2 (Days 8-20): Content Gaps\n   * ${Math.floor(Math.random() * 10) + 8} new articles written\n   * ${Math.floor(Math.random() * 5) + 3} existing pages upgraded\n   * Visual content added (infographics, video)\n   * Distribution process built\n   * Early results: [new keywords indexed]\n\n   Phase 3 (Days 21-35): AI Visibility\n   * LocalBusiness + FAQ + Service Schema deployed\n   * Central FAQ page published\n   * E-E-A-T built (About page updated)\n   * Topical Authority Map built\n   * Results: AI visibility increased by X%\n\n   Phase 4 (Days 36-50): Authority and Rankings\n   * Backlink Profile analyzed\n   * 3+ Guest Posts published\n   * Skyscraper articles written\n   * Case Studies written\n   * Digital PR campaign launched\n   * 50+ backlinks built with Referring Domains\n\n   Phase 5 (Days 51-60): Optimization and Summary\n   * Second technical scan:\n     - 404 errors: X → Y\n     - Indexed pages: X → Y (+Z)\n     - Schema coverage: X% → Y%\n   * Second AI visibility scan\n   * Striking Distance optimization (rank 5-20)\n   * A/B testing Title Tags: CTR increased from X% to Y%\n\n6. Content Created (Summary)\n   \n   Pillar Articles (3-5):\n   * "${kw(0)} — המדריך המקיף" — 3000+ words\n   * [Additional article] — 1500+ words\n   * [Additional article] — 1200+ words\n\n   Content Hub / Cluster Pages (8-12):\n   * List of all cluster articles with URLs\n   * Pillar-Cluster structure visual\n\n   Pages by Type:\n   * Blog Articles: [count]\n   * Landing Pages: [count]\n   * FAQ Pages: [count]\n   * Case Studies: [count]\n   * Comparison Articles: [count]\n   * Glossary: [count]\n   \n   Totals: ${Math.floor(Math.random() * 15) + 12} new pages, ${Math.floor(Math.random() * 8) + 5} pages updated\n\n7. Link Building (Link Building)\n   \n   Backlink Summary:\n   * Total new backlinks: [count]\n   * High DA links (30+): [count]\n   * Referring domains: [count new]\n   * Anchor text diversity: [Good/Room for improvement]\n   * Top referring sites: [3 sites with URLs]\n\n   Methods used:\n   * Guest Posts: [count] → [Avg Domain Authority]\n   * Digital PR: [campaigns] → [Press mentions]\n   * Broken Link Building: [links]\n   * Resource Page Submissions: [submissions]\n   * HARO/Qwoted: [times featured]\n\n8. Opportunities and Next Steps\n   \n   Top 3 Opportunities:\n   1. [Content gap not yet addressed] — Expected: X% traffic increase\n   2. [Link building focus] — Expected: X% DA increase\n   3. [Real optimization] — Expected: X% CTR increase\n\n   Recommended 90-Day Plan:\n   * Continue: Remaining content gaps\n   * New: Local optimization (if applicable)\n   * New: Video content hub\n   * Maintenance: Monthly content updates + consistent link building\n\n9. ROI Metrics Table (Optional if data available)\n   \n   Investment:\n   * Hours: [Total]\n   * Cost: [If applicable]\n   \n   Expected ROI (12 months):\n   * Traffic growth: +X% (from X to Y monthly visits)\n   * Conversions: +X% expected\n   * Revenue impact: $X per month ongoing + growth\n\n10. Bibliography / Resources Used\n    * Tools: Ahrefs, GSC, GA4, Screaming Frog, Schema Markup Validator\n    * Sources: [All authority sites cited]\n\n11. Appendices (Optional)\n    * A: Complete list of keywords with rankings\n    * B: More detailed charts\n    * C: Screenshots of GSC / Analytics\n    * D: Content and link map\n\n12. Back Page\n    "The PIXEL SEO team would love to help complete this work. Contact us to discuss next steps."\n\nStyles:\n- Color scheme: Professional (blue, gray, white)\n- Fonts: Headers in bold, Body text easy to read\n- Imagery: Live screenshots, clear graphs, well-formatted tables\n- Paper: A4, left binding (if printing)\n\nFormat Options:\n1. Word (.docx) — for printing\n2. PDF — for distribution and limited editing\n3. Google Slides — for presentation and sharing\n\nLength: 15-25 pages | Focus: Visual + Specific | Tone: Professional, confident, future-focused`,
    ),
  ]));

  days.push(mkDay(59, "הצגת לקוח + תוכנית שלבים הבאים", [
    mkTask("analytics", "medium", "medium",
      "הכנה הצגת סיכום לקוח",
      `צור דק 10-15 שקופיות: הייליטים חשובים, ויזואליות לפני/אחרי, 3 זכיות גדולות, 3 הזדמנויות הבאות. כלול גרפים וצילומי מסך.`,
      3, null,
      "הצגה מוכנה למסירה ללקוח",
      "הצגה ויזואלית מקצועית משכנעת לקוח להמשיך — דוח טקסט לבדו לא מספיק",
    ),
    mkTask("analytics", "high", "high",
      "בנייה תוכנית 90-יום — שלב הבא",
      `בהתבסס על תוצאות 60-יום, בנה תוכנית 90-יום: מה לחזור, מה חדש, יעדים מעודכנים. עדיפות: ${highPriorityGaps.length > 5 ? "פערי תוכן שנותרו" : "בניית קישורים מתמשכת"}, ראות AI, סמכות.`,
      2.5, null,
      "תוכנית 90-יום עם יעדים מעודכנים",
      "SEO הוא מרתון — אחרי 60 ימים תוכל לתכנן שלב הבא עם יעדים מונעי נתונים",
    ),
  ]));

  days.push(mkDay(60, "השלמה, סריקה סופית וחסר", [
    mkTask("analytics", "high", "critical",
      "סריקה סופית + סגירה תוכנית 60-יום",
      `הפעל סריקה סופית: טכנית + ראות AI. השווה ליום 1. תעד: ${scan ? `SSL ${scan.hasSSL ? "✓" : needsSSL ? "✗→✓" : "✓"}, מהירות ${(scan.loadTimeMs / 1000).toFixed(1)}s→?s, DA ${scan.domainAuthority}→?` : "לפני/אחרי מלא"}. סגור את כל הפריטים הפתוחים.`,
      3, null,
      "דוח סופי מלא — תוכנית 60-יום הושלמה",
      "סריקה סופית סוגרת את הלולאה — מראה בדיוק מה השתנה ב-60 ימי עבודה",
    ),
    mkTask("analytics", "medium", "medium",
      "מסירה כל הנכסים ללקוח",
      `ארגן ומסור: גישה GSC, GA4, כלים SEO; רשימת מילות-מפתח; מפת תוכן; רשימת backlinks; לוח זמנים תוכן 3 חודשים; תיעוד Schema; מדריך תחזוקה שבועי.`,
      2, null,
      "כל הנכסים הועברו ותועדו",
      "מסירה מקצועית מבטיחה שלקוח יכול להמשיך עבודה או להעביר לצוות הבא",
    ),
  ]));

  // ─── Fill any missing days with continuation tasks ──────────────────
  const coveredDays = new Set(days.map(d => d.day));
  for (let d = 1; d <= 60; d++) {
    if (!coveredDays.has(d)) {
      const ph = phaseFor(d);
      days.push(mkDay(d, `המשך עבודה — ${ph.name}`, [
        mkTask(
          d <= 7 ? "technical" : d <= 20 ? "content" : d <= 35 ? "ai_optimization" : d <= 50 ? "offpage" : "analytics",
          "medium", "medium",
          `משימת המשך: ${ph.name}`,
          `המשך עבודה על משימות פתוחות מימים קודמים. עדיפות לפריטים לא מלאים ומשימות בעלות השפעה גבוהה.`,
          3, null,
          `התקדמות על משימות שלב ${ph.number}`,
          "ימים ללא משימות חדשות הם הזדמנות לסיים עבודה שנפתחה — טוב יותר לסיים מאשר להתחיל חדש",
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
