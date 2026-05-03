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
  { number: 1, name: "תשתית וניצחונות מהירים", nameEn: "Foundation & Quick Wins", days: [1, 7], focus: "תיקון בעיות טכניות קריטיות, הקמת תשתית מדידה, ניצחונות מהירים" },
  { number: 2, name: "סגירת פערי תוכן", nameEn: "Content Gap Closure", days: [8, 20], focus: "יצירת תוכן חדש לפערים שזוהו, עדכון תוכן קיים, מיפוי מילות מפתח" },
  { number: 3, name: "GEO, Schema ו-FAQ", nameEn: "GEO Optimization & Schema", days: [21, 35], focus: "אופטימיזציה לנראות במנועי AI, הטמעת Schema, בניית FAQ" },
  { number: 4, name: "אסטרטגיית מתחרים וסמכות", nameEn: "Competitor Strategy & Authority", days: [36, 50], focus: "בניית קישורים, סמכות, Digital PR, התמודדות עם מתחרים" },
  { number: 5, name: "אופטימיזציה, דיווח וסריקה חוזרת", nameEn: "Optimization & Reporting", days: [51, 60], focus: "מדידת תוצאות, אופטימיזציה נוספת, סריקה חוזרת, דוח סיכום" },
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
  const loc = input.targetLocation || "ישראל";
  const lang = input.targetLanguage || "עברית";
  const goals = (input.goals || []).filter(g => g.selected !== false);
  const gaps = input.contentGaps || [];
  const vis = input.visibilityResults || [];
  const queries = input.visibilityQueries || [];
  const pages = input.scannedPages || [];
  const competitors = input.competitors || [];
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
  days.push(mkDay(1, "סקירה מלאה והקמת תשתית מדידה", [
    mkTask("technical", "high", "critical",
      `הגדרת Google Search Console עבור ${domain}`,
      `חבר את ${domain} ל-Google Search Console, אמת בעלות באמצעות DNS, הגש את ה-Sitemap${scan?.hasSitemap ? "" : " (יש ליצור אחד קודם)"}, ובדוק שגיאות כיסוי.`,
      1.5, null,
      "GSC מחובר ומאומת, Sitemap מוגש, שגיאות ידועות",
      "ללא GSC אין יכולת לנטר ביצועים, קליקים, חשיפות ושגיאות אינדוקס — זה הבסיס לכל עבודת SEO",
    ),
    mkTask("analytics", "high", "critical",
      "הגדרת Google Analytics 4 עם מעקב אירועים",
      `ודא חיבור GA4 ל-${domain}. הגדר אירועים: form_submit, phone_click, scroll_depth, cta_click. חבר ל-GSC.`,
      2, null,
      "GA4 עם מעקב אירועי המרה מלא",
      "ללא מדידה לא ניתן להוכיח ROI — צריך baseline מדויק לפני תחילת האופטימיזציה",
    ),
    mkTask("technical", "high", "high",
      `סריקה טכנית מלאה של ${domain}`,
      `הרץ Screaming Frog / Sitebulb על ${domain}. תעד: שגיאות 404, redirects שבורים, duplicate titles, דפים חסומים ב-robots, דפים ללא מטא. ייצא לגיליון.`,
      3, scan?.url || null,
      `רשימה מלאה של כל הבעיות הטכניות ב-${scan?.totalPages || "?"} דפים`,
      "הסריקה הטכנית חושפת בעיות שנסתרות מהמשתמש אבל פוגעות בדירוג — חייבים לתקן לפני שמשקיעים בתוכן",
    ),
  ]));

  // Day 2: Critical technical fixes
  const day2Tasks: DayTask[] = [];
  if (needsSSL) {
    day2Tasks.push(mkTask("technical", "high", "critical",
      "התקנת תעודת SSL והפניית HTTP→HTTPS",
      `התקן תעודת SSL (Let's Encrypt חינמית) עבור ${domain}. הגדר הפניית 301 מ-HTTP ל-HTTPS בכל הדפים. עדכן canonical tags, sitemap, וקישורים פנימיים.`,
      2, scan?.url || null,
      `${domain} מאובטח ב-HTTPS עם HSTS מופעל`,
      "Google מסמן אתרים ללא SSL כ'לא בטוח' ומוריד את הדירוג שלהם — זה התיקון הקריטי ביותר",
    ));
  }
  if (needsSitemap) {
    day2Tasks.push(mkTask("technical", "high", "critical",
      "יצירת Sitemap.xml והגשתו ל-GSC",
      `צור sitemap.xml הכולל את כל ${scan?.totalPages || "?"} הדפים של ${domain}. ודא שכולל lastmod, priority, changefreq. הגש ל-GSC ול-Bing Webmaster Tools.`,
      1, null,
      "Sitemap.xml חי ומוגש למנועי חיפוש",
      "ללא Sitemap, מנועי חיפוש עלולים לפספס דפים חשובים — במיוחד באתר עם מבנה עמוק",
    ));
  }
  if (needsRobots) {
    day2Tasks.push(mkTask("technical", "medium", "high",
      "יצירת Robots.txt עם הוראות סריקה",
      `צור robots.txt עבור ${domain}. חסום גישה ל-admin/, search-results/, duplicate pages. הוסף שורת Sitemap: https://${domain}/sitemap.xml`,
      0.5, null,
      "Robots.txt מוגדר נכון עם הפניה ל-Sitemap",
      "Robots.txt שולט אילו דפים מנועי חיפוש סורקים — חיסכון ב-crawl budget ומניעת אינדוקס של דפים לא רלוונטיים",
    ));
  }
  if (isSlow) {
    day2Tasks.push(mkTask("technical", "high", "critical",
      `שיפור מהירות טעינה (${((scan?.loadTimeMs || 0) / 1000).toFixed(1)} שניות → מתחת ל-2 שניות)`,
      `מהירות הטעינה הנוכחית ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)} שניות. דחס תמונות ל-WebP (TinyPNG/Squoosh), הפעל Lazy Loading, מזער CSS/JS, הפעל Browser Caching, ${scan?.cmsDetected ? `בדוק תוספי ${scan.cmsDetected} מאטים` : "שקול CDN כמו Cloudflare"}.`,
      4, scan?.url || null,
      "זמן טעינה מתחת ל-2 שניות ב-Mobile ו-Desktop",
      `כל שנייה נוספת מגדילה נטישה ב-32%. ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)} שניות זה הרבה מדי — Google מעדיף אתרים מהירים`,
    ));
  }
  if (day2Tasks.length === 0) {
    day2Tasks.push(mkTask("technical", "medium", "medium",
      "אופטימיזציית Core Web Vitals",
      `הרץ PageSpeed Insights על 5 דפים מרכזיים ב-${domain}. שפר LCP, FID, CLS. דחס תמונות, הוסף preload לפונטים, מזער CSS/JS לא בשימוש.`,
      3, scan?.url || null,
      "כל Core Web Vitals ירוקים",
      "Core Web Vitals הם גורם דירוג ישיר — ירוק = יתרון על מתחרים",
    ));
  }
  days.push(mkDay(2, "תיקונים טכניים קריטיים", day2Tasks));

  // Day 3: Mobile + broken links
  const day3Tasks: DayTask[] = [];
  if (needsMobile) {
    day3Tasks.push(mkTask("technical", "high", "critical",
      "אופטימיזציית מובייל מלאה",
      `האתר לא מותאם למובייל. בדוק ב-Mobile-Friendly Test של Google. תקן: font-size (מינימום 16px), touch targets (48px), viewport meta tag, אלמנטים חורגים ממסך. ${scan?.cmsDetected === "WordPress" ? "שקול תבנית responsive או תוסף AMP." : ""}`,
      4, scan?.url || null,
      "האתר עובר את Mobile-Friendly Test של Google",
      "60%+ מהחיפושים ממובייל, Google משתמש ב-Mobile-First Indexing — אתר לא מותאם = אינדוקס לקוי",
    ));
  }
  if (hasBrokenLinks) {
    day3Tasks.push(mkTask("technical", "high", "high",
      `תיקון ${scan?.brokenLinks || 0} קישורים שבורים`,
      `נמצאו ${scan?.brokenLinks || 0} קישורים שבורים. הרץ Screaming Frog → Filter: Client Errors (4xx). לכל קישור: תקן ליעד הנכון, הגדר 301 redirect, או הסר. ודא שה-Sitemap לא כולל דפי 404.`,
      2, null,
      "0 קישורים שבורים באתר",
      "קישורים שבורים פוגעים בחוויית המשתמש וב-crawl budget — גוגל מפסיק לסרוק אם יש יותר מדי שגיאות",
    ));
  }
  if (day3Tasks.length < 2) {
    day3Tasks.push(mkTask("onpage", "medium", "medium",
      "ביקורת URL Structure ו-Canonical Tags",
      `סרוק את כל ה-URLs ב-${domain}. ודא: URLs קצרים ותיאוריים (לא ?p=123), canonical tag בכל דף, אין duplicate content, הפניות 301 עבודות. ${needsCanonical ? "חסרים canonical tags — יש להוסיפם לכל דף." : ""}`,
      2, null,
      "URLs נקיים, canonical tags בכל דף, אין duplicates",
      "URLs מבולגנים ודפים כפולים מבלבלים את Google ומפזרים את כוח הדירוג",
    ));
  }
  days.push(mkDay(3, "מובייל, קישורים שבורים ומבנה URLs", day3Tasks));

  // Day 4: On-Page — meta tags
  const metaPages = pagesNeedingMeta.length > 0 ? pagesNeedingMeta : pages.slice(0, 5);
  days.push(mkDay(4, "אופטימיזציית Meta Tags ו-H1", [
    mkTask("onpage", "high", "high",
      `כתיבת Meta Title ייחודי ל-${Math.min(metaPages.length, 10)} דפים`,
      `כתוב Title tag ייחודי לכל דף (50-60 תווים). כלול מילת מפתח ראשית + ${loc}. פורמט מומלץ: "מילת מפתח | ${input.clientName}". דפים לטיפול: ${metaPages.slice(0, 5).map(p => p.url).join(", ")}`,
      3, metaPages[0]?.url || null,
      "Meta Title ייחודי ומותאם בכל דף",
      "Title tag הוא גורם הדירוג החזק ביותר באופטימיזציה On-Page — ישירות משפיע על CTR מתוצאות החיפוש",
    ),
    mkTask("onpage", "high", "high",
      `כתיבת Meta Description ל-${Math.min(metaPages.length, 10)} דפים`,
      `כתוב Description ייחודי (150-160 תווים) עם CTA ומילת מפתח. דוגמה: "${keywords[0] || "שירות"} מקצועי ב${loc} — ${input.clientName}. צרו קשר לייעוץ חינם!"`,
      2.5, metaPages[0]?.url || null,
      "Meta Description ממוקד CTR בכל דף",
      "Description טוב מגדיל CTR גם ללא שינוי בדירוג — יותר קליקים = יותר תנועה מאותו מיקום",
    ),
    mkTask("onpage", "medium", "medium",
      `תיקון מבנה כותרות H1-H3 ב-${pagesNeedingH1.length > 0 ? pagesNeedingH1.length : "כל ה"}דפים`,
      `ודא H1 ייחודי בכל דף עם מילת מפתח. ${pagesNeedingH1.length > 0 ? `${pagesNeedingH1.length} דפים חסרי H1: ${pagesNeedingH1.slice(0, 3).map(p => p.url).join(", ")}` : "בדוק היררכיית כותרות H2-H3 בכל הדפים."}`,
      2, pagesNeedingH1[0]?.url || null,
      "כל דף עם H1 ייחודי ומבנה היררכי תקין",
      "מבנה כותרות עוזר לגוגל ול-AI להבין את מבנה התוכן ולזהות את הנושא של כל דף",
    ),
  ]));

  // Day 5: Images + internal linking
  days.push(mkDay(5, "אופטימיזציית תמונות וקישורים פנימיים", [
    mkTask("onpage", "medium", "medium",
      `הוספת Alt Text ל-${pagesNeedingAlt.length > 0 ? pagesNeedingAlt.length + " דפים חסרים" : "כל התמונות"}`,
      `סרוק את כל התמונות ב-${domain}. הוסף alt text תיאורי עם מילות מפתח. ${pagesNeedingAlt.length > 0 ? `דפים חסרי alt: ${pagesNeedingAlt.slice(0, 3).map(p => p.url).join(", ")}` : "ודא שהאלטים לא כפולים."} דחס לפורמט WebP.`,
      3, pagesNeedingAlt[0]?.url || null,
      "100% תמונות עם alt text, פורמט WebP",
      "תמונות ללא alt הן הזדמנות אבודה — גוגל משתמש ב-alt להבנת תוכן, וזה משפר גם נגישות",
    ),
    mkTask("onpage", "high", "high",
      `בניית מפת קישורים פנימיים ל-${domain}`,
      `צור מבנה Hub & Spoke: דפים ראשיים (Hub) מקשרים ל-3-5 דפים רלוונטיים (Spokes). ודא שכל דף נגיש בתוך 3 קליקים מדף הבית. הוסף breadcrumbs אם חסרים. דפים חשובים: ${pages.slice(0, 3).map(p => p.title || p.url).join(", ")}`,
      3, null,
      "כל דף עם 3+ קישורים פנימיים, מבנה Hub & Spoke פעיל",
      "קישורים פנימיים מפזרים סמכות (link equity) ועוזרים לגוגל להבין את מבנה האתר — זה שינוי פשוט עם אימפקט גבוה",
    ),
  ]));

  // Day 6: OG + Canonical + Structured Data prep
  days.push(mkDay(6, "Open Graph, Canonical ותשתית Schema", [
    ...(needsOG ? [mkTask("onpage", "medium", "medium",
      "הוספת תגי Open Graph לכל דף",
      `הוסף og:title, og:description, og:image, og:url לכל דף ב-${domain}. ודא שהתמונות בגודל 1200x630 לפחות. בדוק עם Facebook Sharing Debugger.`,
      2, null,
      "שיתופים ברשתות חברתיות עם תצוגה מקצועית",
      "תגי OG משפיעים על איך האתר נראה כשמשתפים אותו — תצוגה מקצועית = יותר קליקים מרשתות חברתיות",
    )] : []),
    mkTask("technical", "medium", "medium",
      "הגדרת Google Business Profile (GBP)",
      `צור או עדכן GBP עבור ${input.clientName} ב${loc}. מלא 100%: שם, כתובת, טלפון, שעות פעילות, קטגוריות (ראשית + 3 משניות), תיאור עם מילות מפתח, תמונות (לוגו + cover + 5 תמונות נוספות).`,
      2.5, null,
      "GBP מלא ב-100% עם תמונות וקטגוריות",
      "GBP הוא הגורם #1 בדירוג מקומי — פרופיל מלא מקבל 7x יותר קליקים מפרופיל חלקי",
    ),
    mkTask("analytics", "medium", "medium",
      `רישום ב-Bing Webmaster Tools ו-${scan?.cmsDetected === "WordPress" ? "Yoast/RankMath" : "כלי SEO"}`,
      `הגש את ${domain} ל-Bing Webmaster Tools (Copilot משתמש ב-Bing). ${scan?.cmsDetected === "WordPress" ? "התקן Yoast או RankMath לניהול SEO." : "ודא שכלי ה-SEO מוגדרים נכון."}`,
      1.5, null,
      "Bing WMT מחובר, כלי SEO מוגדרים",
      "Bing Webmaster Tools חשוב כי Microsoft Copilot ו-ChatGPT (Bing) משתמשים בנתוני Bing — זה עולם ה-GEO",
    ),
  ]));

  // Day 7: Week 1 review + baseline
  days.push(mkDay(7, "סיכום שבוע 1 ו-Baseline מלא", [
    mkTask("analytics", "high", "high",
      "תיעוד Baseline — ציונים נוכחיים לפני אופטימיזציה",
      `תעד ציוני baseline: דירוגים ב-GSC (עמדה ממוצעת, CTR), תנועה אורגנית, Core Web Vitals, DA (${scan?.domainAuthority || "?"}), מספר דפים באינדקס (${scan?.indexedPages || "?"}), נראות AI (${mentionedQueries.length}/${vis.length} שאילתות).`,
      2, null,
      "גיליון Baseline מלא עם כל המטריקות",
      "בלי baseline לא ניתן למדוד שיפור — צריך נקודת ייחוס מדויקת לפני שמתחילים",
    ),
    mkTask("analytics", "medium", "medium",
      "סיכום שבוע 1 — מה בוצע ומה ההמשך",
      `כתוב סיכום: מה תוקן (SSL${needsSSL ? " ✓" : ""}, מהירות, sitemap, meta), מה נותר, KPIs ראשוניים. שתף עם הלקוח.`,
      1.5, null,
      "דוח שבועי שלם לשליחה ללקוח",
      "סיכום שבועי שומר על שקיפות עם הלקוח ומוודא שהתוכנית מתקדמת בקצב הנכון",
    ),
  ]));

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Days 8-20 — Content Gap Closure
  // ═══════════════════════════════════════════════════════════════════

  // Day 8: Keyword research based on actual gaps
  const topGaps = [...highPriorityGaps, ...mediumPriorityGaps].slice(0, 15);
  days.push(mkDay(8, "מחקר מילות מפתח מעמיק מבוסס פערים", [
    mkTask("content", "high", "high",
      `מיפוי ${topGaps.length > 0 ? topGaps.length : keywords.length} מילות מפתח מרכזיות`,
      `על בסיס ${gaps.length} פערי תוכן שזוהו ו-${keywords.length} מילות מפתח יעד: חקור נפח חיפוש (Google Keyword Planner / Ahrefs), קושי דירוג, כוונת חיפוש. תעדף לפי: volume × relevance × difficulty. מילות מפתח: ${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? "..." : ""}`,
      4, null,
      "מפת מילות מפתח מתועדפת עם נפח, קושי וכוונה",
      "מחקר מבוסס פערים אמיתיים (מסריקת AI) ולא ניחושים — כל מילת מפתח מייצגת הזדמנות שזוהתה",
    ),
    mkTask("content", "medium", "medium",
      "ניתוח כוונת חיפוש ומיפוי לדפים קיימים",
      `חלק כל מילת מפתח: informational (מדריכים), commercial (השוואות), transactional (רכישה). מפה לדפים קיימים או סמן כ'דף חדש נדרש'. ${topGaps.slice(0, 3).map(g => `"${g.query}" → ${g.intent}`).join("; ")}`,
      2.5, null,
      "כל מילת מפתח ממופה לדף קיים או מתוכנן",
      "תוכן שלא תואם לכוונת החיפוש לא ידורג — informational ≠ transactional",
    ),
  ]));

  // Days 9-11: Writing content for top gaps
  const contentDays = [9, 10, 11];
  contentDays.forEach((d, idx) => {
    const gap = topGaps[idx];
    const kw = gap?.query || keywords[idx] || `נושא מרכזי #${idx + 1}`;
    const pageUrl = pages.find(p => p.wordCount > 300)?.url || null;

    days.push(mkDay(d, `כתיבת מאמר מקצועי: "${kw}"`, [
      mkTask("content", "high", "high",
        `כתיבת מאמר 1500+ מילים: "${kw}"`,
        `כתוב מאמר מקצועי ומעמיק שעונה על "${kw}". מבנה: כותרת עם מילת מפתח, הקדמה (150 מילים), 4-6 תת-סעיפים עם H2/H3, סיכום עם CTA. כלול נתונים, דוגמאות, ${lang === "עברית" ? "ציטוטי מומחים בעברית" : "expert quotes"}. הוסף FAQ עם 3-5 שאלות בתחתית.`,
        5, pageUrl,
        `מאמר מפורסם, ממוקד "${kw}", מותאם לדירוג וה-AI`,
        gap ? `שאילתה זו זוהתה כפער — ${input.clientName} לא מופיע ב-${missedQueries.length > 0 ? "תשובות ה-AI" : "תוצאות החיפוש"} עליה` : "מילת מפתח מרכזית שחסרה באתר",
        `מאמר: "${kw}"\nאורך: 1500+ מילים\nקהל יעד: ${loc}\nמבנה:\n1. הקדמה — מה הבעיה/צורך\n2. ${kw} — הסבר מקיף\n3. יתרונות / שיטות / טיפים\n4. דוגמאות / Case Studies\n5. FAQ (3-5 שאלות)\n6. סיכום + CTA\nמילות מפתח משניות: ${keywords.slice(0, 3).join(", ")}`,
      ),
      mkTask("onpage", "medium", "medium",
        `אופטימיזציית המאמר — Meta, Schema, Links`,
        `הוסף למאמר: Title tag עם "${kw}", Meta Description עם CTA, FAQ Schema (JSON-LD), 3+ קישורים פנימיים לדפים רלוונטיים, 1 קישור חיצוני לסמכות.`,
        1, null,
        "מאמר מותאם SEO עם Schema ממוקד",
        "מאמר בלי אופטימיזציה זה כמו חנות בלי שלט — התוכן הוא רק חצי מהעבודה",
      ),
    ]));
  });

  // Day 12: Update existing thin content
  days.push(mkDay(12, "שדרוג תוכן קיים דליל", [
    mkTask("content", "high", "high",
      `שדרוג ${Math.min(thinPages.length, 5) || 5} דפים עם תוכן דליל`,
      `${thinPages.length > 0 ? `נמצאו ${thinPages.length} דפים עם פחות מ-300 מילים: ${thinPages.slice(0, 3).map(p => p.url).join(", ")}` : `עדכן 5 דפים מרכזיים ב-${domain}`}. לכל דף: הרחב ל-800+ מילים, הוסף H2/H3, שלב מילות מפתח, הוסף FAQ, עדכן תאריך.`,
      4, thinPages[0]?.url || null,
      "כל הדפים הדלילים מורחבים ל-800+ מילים",
      "דפים עם תוכן דליל נחשבים ל-thin content ויכולים לגרור עונש — הרחבה = שיפור דירוג",
    ),
    mkTask("content", "medium", "medium",
      "הוספת תוכן ויזואלי — אינפוגרפיקות וטבלאות",
      `הוסף אינפוגרפיקה, טבלה, או גרף ל-3 מאמרים מרכזיים. תוכן ויזואלי מגדיל זמן שהייה ומשותף יותר. השתמש ב-Canva או כלי דומה.`,
      3, null,
      "3 מאמרים עם תוכן ויזואלי ייחודי",
      "תוכן ויזואלי מגדיל זמן שהייה ב-80% ומשותף 3x יותר — מנועי AI מעדיפים תוכן עשיר",
    ),
  ]));

  // Days 13-14: More content for missed queries
  [13, 14].forEach((d, idx) => {
    const gap = topGaps[3 + idx];
    const kw = gap?.query || keywords[3 + idx] || `נושא ${idx + 4}`;
    days.push(mkDay(d, `מאמר ממוקד AI: "${kw}"`, [
      mkTask("content", "high", "high",
        `כתיבת מאמר AI-optimized: "${kw}"`,
        `כתוב מאמר שעונה ישירות על "${kw}" — הפורמט שמנועי AI מעדיפים: תשובה ישירה בפסקה הראשונה, רשימות ממוספרות, definitions ברורות, נתונים עם מקורות. ${gap ? `זוהה כפער: ${input.clientName} לא מוזכר בתשובות AI לשאילתה זו.` : ""}`,
        5, null,
        `מאמר AI-friendly מפורסם, ממוקד "${kw}"`,
        "מנועי AI מעדיפים תוכן מובנה עם תשובות ישירות — פורמט שונה מ-SEO קלאסי",
        `מאמר AI-Optimized: "${kw}"\nאורך: 1200+ מילים\nפורמט: תשובה ישירה בפתיחה (50 מילים) → הסבר מורחב → רשימה ממוספרת → FAQ\nחשוב: כלול את שם העסק (${input.clientName}) באופן טבעי 2-3 פעמים`,
      ),
    ]));
  });

  // Day 15: Landing pages for location
  days.push(mkDay(15, `דפי נחיתה מקומיים — ${loc}`, [
    mkTask("content", "high", "high",
      `יצירת דף נחיתה מקומי: "${keywords[0] || "שירותים"} ב${loc}"`,
      `צור דף נחיתה ממוקד ${loc}: H1 עם מילת מפתח + מיקום, תוכן 800+ מילים, מפה מוטמעת, כתובת + טלפון, ביקורות מקומיות, Schema LocalBusiness. URL: /${keywords[0] ? keywords[0].replace(/\s/g, "-") : "services"}-${loc.replace(/\s/g, "-")}`,
      4, null,
      `דף נחיתה חי ל-${loc} עם Schema מקומי`,
      `דפי נחיתה מקומיים מדורגים גבוה בחיפושים כמו "${keywords[0] || "שירות"} ב${loc}" — חשוב במיוחד לעסקים מקומיים`,
      `דף נחיתה: "${keywords[0] || "שירות"} ב${loc}"\nH1: ${keywords[0] || "שירות"} מקצועי ב${loc}\nסעיפים: מי אנחנו, שירותים, למה לבחור בנו, ביקורות, יצירת קשר\nSchema: LocalBusiness + Service`,
    ),
    mkTask("local", "medium", "medium",
      "עקביות NAP בכל הפלטפורמות",
      `ודא שהשם (${input.clientName}), כתובת וטלפון זהים ב: GBP, Facebook, LinkedIn, Waze, ספריות עסקיות. עדכן כל חוסר עקביות.`,
      2, null,
      "NAP עקבי ב-100% מהפלטפורמות",
      "חוסר עקביות ב-NAP מבלבל את Google ומוריד אמון — צריך להיות זהה בכל מקום",
    ),
  ]));

  // Days 16-18: More content articles
  [16, 17, 18].forEach((d, idx) => {
    const gapIdx = 5 + idx;
    const gap = topGaps[gapIdx];
    const kw = gap?.query || keywords[gapIdx] || `תוכן #${gapIdx + 1}`;

    days.push(mkDay(d, `תוכן ממוקד: "${kw}"`, [
      mkTask("content", "high", "high",
        `כתיבת מאמר/מדריך: "${kw}"`,
        `${gap ? `פער תוכן שזוהה: "${gap.query}" (${gap.intent}, ${gap.importance}). ` : ""}כתוב מדריך מקצועי 1200+ מילים. כלול: definitions ברורות, שלבים ממוספרים, טיפים מעשיים, CTA. שלב את שם ${input.clientName} באופן טבעי.`,
        4, null,
        `מאמר מפורסם ומותאם ל-"${kw}"`,
        gap ? `AI לא מזכיר את ${input.clientName} בשאילתה "${gap.query}" — תוכן ממוקד ישנה את זה` : "מילת מפתח חשובה שצריך לכסות",
      ),
    ]));
  });

  // Day 19: Content calendar
  days.push(mkDay(19, "לוח תוכן חודשי ואסטרטגיית פרסום", [
    mkTask("content", "medium", "medium",
      "בניית לוח תוכן ל-3 חודשים הבאים",
      `צור לוח: 2 מאמרים בחודש, 1 עדכון תוכן קיים, 4 פוסטים חברתיים. בסס על: ${topGaps.length} פערים, ${keywords.length} מילות מפתח, עונתיות. תעדף לפי ROI.`,
      3, null,
      "לוח תוכן מתוזמן ל-3 חודשים",
      "עקביות בפרסום תוכן חשובה — Google ו-AI מעדיפים אתרים פעילים",
    ),
    mkTask("content", "medium", "medium",
      "הגדרת Content Distribution — ערוצי הפצה",
      `הגדר ערוצים: Google Business (פוסטים שבועיים), LinkedIn, Facebook, Newsletter. כל מאמר חדש → שיתוף בכל הערוצים תוך 24 שעות.`,
      1.5, null,
      "תהליך הפצה מוגדר לכל תוכן חדש",
      "תוכן שלא מופץ לא מקבל קישורים ואותות חברתיים — ההפצה חשובה כמו הכתיבה",
    ),
  ]));

  // Day 20: Phase 2 review
  days.push(mkDay(20, "סיכום שלב 2 — מדידת התקדמות תוכן", [
    mkTask("analytics", "high", "medium",
      "מדידת ביצועי תוכן חדש",
      `בדוק ב-GSC: האם המאמרים החדשים נאינדקסו? מה ה-CTR? מה הדירוג הראשוני? השווה ל-Baseline של יום 7. תעד: ${days.filter(d => d.phase === PHASES[1].name).reduce((s, d) => s + d.tasks.length, 0)} משימות שהושלמו.`,
      2, null,
      "דוח התקדמות שלב 2 מלא",
      "חשוב למדוד את האפקט של התוכן החדש — אינדוקס מהיר = סימן טוב",
    ),
    mkTask("analytics", "medium", "low",
      "עדכון לקוח — סיכום חצי דרך",
      `הכן מצגת קצרה: מה בוצע ב-20 ימים, ${topGaps.length} פערים שנסגרו, מטריקות ראשוניות, תוכנית להמשך.`,
      1.5, null,
      "דוח חצי-דרך מוכן לשליחה",
      "שקיפות מול הלקוח חיונית — מראה ערך ושומר על אמון",
    ),
  ]));

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Days 21-35 — GEO Optimization & FAQ/Schema
  // ═══════════════════════════════════════════════════════════════════

  // Day 21: Schema implementation
  days.push(mkDay(21, "הטמעת Schema.org — LocalBusiness + FAQ", [
    mkTask("ai_optimization", "high", "critical",
      `הטמעת LocalBusiness Schema ב-${domain}`,
      `הוסף JSON-LD Schema מסוג LocalBusiness לדף הבית: name (${input.clientName}), address (${loc}), telephone, openingHours, image, url, geo coordinates, sameAs (רשתות חברתיות). בדוק ב-Google Rich Results Test.`,
      3, scan?.url || null,
      "LocalBusiness Schema מוטמע ומאומת",
      "Schema הוא השפה שבה מנועי AI ו-Google מבינים את העסק — בלי Schema, ה-AI לא יודע שהעסק קיים",
    ),
    mkTask("ai_optimization", "high", "high",
      "הטמעת FAQ Schema בדפים מרכזיים",
      `הוסף FAQPage Schema (JSON-LD) ל-3 דפים מרכזיים. השתמש בשאלות מסריקת ה-AI: ${missedQueries.slice(0, 3).map(q => `"${q.query}"`).join(", ")}. כל שאלה עם תשובה מלאה הכוללת את שם העסק.`,
      2.5, null,
      "FAQ Schema ב-3+ דפים, עובר Rich Results Test",
      "FAQ Schema מופיע כתוצאות עשירות בגוגל ומנועי AI שואבים תשובות ישירות מ-FAQ — זו הדרך המהירה ביותר להיכנס לתשובות AI",
    ),
  ]));

  // Day 22: More Schema types
  days.push(mkDay(22, "Schema מתקדם — Service, BreadcrumbList, Article", [
    mkTask("ai_optimization", "high", "high",
      "הטמעת Service Schema ו-BreadcrumbList",
      `הוסף Service Schema לכל דף שירות (name, description, provider, areaServed: ${loc}). הוסף BreadcrumbList Schema לכל הדפים. ודא ש-Article Schema מוטמע בכל מאמר בבלוג.`,
      3, null,
      "Service + BreadcrumbList + Article Schema מוטמעים",
      "Service Schema עוזר ל-AI להבין מה העסק מציע — BreadcrumbList משפר ניווט בתוצאות החיפוש",
    ),
    mkTask("ai_optimization", "medium", "medium",
      "בדיקת Schema Validation מלאה",
      `הרץ את Google Rich Results Test על כל דף עם Schema. תקן שגיאות ואזהרות. ודא ש-Google ו-Bing מזהים את כל ה-Schema. בדוק גם ב-schema.org validator.`,
      1.5, null,
      "0 שגיאות Schema, 100% validated",
      "Schema שבור גרוע יותר מ-Schema חסר — Google מתעלם מ-Schema לא תקין",
    ),
  ]));

  // Days 23-25: GEO-specific content optimization
  const aiEngines = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Copilot"];
  const engineStats = aiEngines.map(eng => {
    const mentioned = vis.filter(v => (v.results || []).some(r => r.engine === eng && r.mentioned)).length;
    return { engine: eng, mentioned, total: vis.length, pct: vis.length > 0 ? Math.round((mentioned / vis.length) * 100) : 0 };
  });
  const weakestEngine = engineStats.sort((a, b) => a.pct - b.pct)[0];

  days.push(mkDay(23, `אופטימיזציה ל-${weakestEngine?.engine || "ChatGPT"} — המנוע החלש ביותר`, [
    mkTask("ai_optimization", "high", "high",
      `שיפור נראות ב-${weakestEngine?.engine || "ChatGPT"} (${weakestEngine?.pct || 0}% נוכחי)`,
      `${weakestEngine?.engine || "ChatGPT"} מזכיר את ${input.clientName} רק ב-${weakestEngine?.mentioned || 0} מתוך ${weakestEngine?.total || 0} שאילתות. אסטרטגיה: 1) הוסף תשובות ישירות לשאילתות חסרות בדפי האתר, 2) צור פרופיל ${weakestEngine?.engine === "Copilot" ? "ב-Bing Places" : weakestEngine?.engine === "Gemini" ? "ב-Google Knowledge Graph" : "באתרי סמכות שהמנוע סורק"}, 3) פרסם תוכן בפלטפורמות שהמנוע סומך עליהן.`,
      3, null,
      `שיפור נראות ב-${weakestEngine?.engine || "ChatGPT"} ב-20%+`,
      `${weakestEngine?.engine || "ChatGPT"} הוא המנוע שבו ${input.clientName} הכי חלש — שיפור כאן נותן את ה-ROI הגדול ביותר`,
    ),
    mkTask("ai_optimization", "medium", "medium",
      "יצירת Topical Authority Map",
      `זהה 3-5 נושאים מרכזיים שבהם ${input.clientName} צריך להיות הסמכות. לכל נושא: 1 מאמר-אם (pillar) + 3-4 מאמרי-בת (cluster). קשר ביניהם עם internal links. נושאים: ${keywords.slice(0, 3).join(", ")}`,
      2, null,
      "מפת Topical Authority עם Pillar-Cluster מוגדרים",
      "מנועי AI מעדיפים מקורות עם סמכות נושאית — אתר עם מבנה Pillar-Cluster נתפס כסמכותי יותר",
    ),
  ]));

  days.push(mkDay(24, "בניית דף FAQ מרכזי עם Schema", [
    mkTask("content", "high", "critical",
      `כתיבת דף FAQ מרכזי עם ${Math.min(vis.length, 20)} שאלות`,
      `צור דף FAQ ייעודי ב-${domain}/faq. כלול ${Math.min(vis.length, 20)} שאלות מסריקת ה-AI. כל תשובה: 100-200 מילים, ישירה, כוללת שם העסק. שאלות: ${missedQueries.slice(0, 5).map(q => `"${q.query}"`).join(", ")}${missedQueries.length > 5 ? "..." : ""}`,
      5, null,
      `דף FAQ חי עם ${Math.min(vis.length, 20)}+ שאלות ותשובות`,
      "דף FAQ הוא המקור #1 שממנו מנועי AI שואבים תשובות — כל שאלה שנענית = סיכוי להיכלל בתשובת AI",
      `דף FAQ: ${domain}/faq\n${missedQueries.slice(0, 10).map((q, i) => `${i + 1}. "${q.query}"\n   תשובה: [תשובה ישירה ב-100-200 מילים הכוללת "${input.clientName}"]`).join("\n")}`,
    ),
  ]));

  // Days 25-28: Continued GEO work
  days.push(mkDay(25, "E-E-A-T — חיזוק מומחיות וסמכות", [
    mkTask("ai_optimization", "high", "high",
      "בניית דף About Us מקצועי עם E-E-A-T",
      `שדרג את דף About: סיפור העסק, ניסיון (שנים, פרויקטים), הסמכות, תמונות צוות, ביקורות, פרסום במדיה. הוסף Person Schema + Organization Schema.`,
      3, null,
      "דף About מקצועי עם E-E-A-T מלא",
      "Google ומנועי AI מעריכים E-E-A-T (Expertise, Experience, Authoritativeness, Trustworthiness) — זה מה שגורם להם לסמוך על התוכן שלך",
    ),
    mkTask("ai_optimization", "medium", "medium",
      "הוספת Author Bio ו-Credentials לכל מאמר",
      `הוסף ביוגרפיה של הכותב לכל מאמר בבלוג. כלול: שם, תפקיד, ניסיון, קישור לפרופיל LinkedIn. הוסף Person Schema.`,
      2, null,
      "כל מאמר עם Author Bio ו-Schema",
      "תוכן עם כותב מזוהה מקבל יותר אמון ממנועי AI — Authorship הוא אות אמינות",
    ),
  ]));

  days.push(mkDay(26, `חיזוק נראות AI — ממוקד ${mentionedQueries.length > 0 ? "שאילתות חזקות" : "שאילתות חדשות"}`, [
    mkTask("ai_optimization", "high", "high",
      `אופטימיזציית תוכן ל-${missedQueries.length} שאילתות AI חסרות`,
      `לכל שאילתה חסרה: מצא דף רלוונטי באתר, הוסף פסקה שעונה ישירות על השאילתה, כלול שם העסק. שאילתות: ${missedQueries.slice(0, 5).map(q => `"${q.query}"`).join(", ")}`,
      4, null,
      `${Math.min(missedQueries.length, 10)} שאילתות עם תשובה ישירה באתר`,
      "מנועי AI שואבים תוכן מהאתר — אם התשובה קיימת באתר, הסיכוי שה-AI ישתמש בה גבוה משמעותית",
    ),
  ]));

  // Days 27-30: More GEO + structured content
  [27, 28, 29, 30].forEach((d) => {
    const dayTasks: DayTask[] = [];
    if (d === 27) {
      dayTasks.push(mkTask("ai_optimization", "high", "high",
        "יצירת Glossary / מילון מונחים מקצועי",
        `צור דף מילון מונחים (${domain}/glossary) עם 20+ הגדרות מקצועיות בתחום. כל הגדרה: 50-100 מילים, ברורה, מדויקה. הוסף DefinedTerm Schema.`,
        4, null,
        "דף Glossary חי עם 20+ הגדרות ו-Schema",
        "Glossary הוא מקור מועדף למנועי AI — הגדרות ברורות מגדילות את הסיכוי להיכלל בתשובות",
      ));
    } else if (d === 28) {
      dayTasks.push(mkTask("content", "high", "high",
        `כתיבת מדריך מקיף: "כל מה שצריך לדעת על ${keywords[0] || "הנושא"}"`,
        `Pillar Content: מדריך 3000+ מילים שמכסה את ${keywords[0] || "הנושא"} מכל זווית. כלול: סיכום מנהלים, אינפוגרפיקה, FAQ, קישורים ל-5+ מאמרים באתר. זה יהיה ה-Hub Content.`,
        6, null,
        "מדריך Pillar מפורסם — הדף הסמכותי ביותר באתר",
        "Pillar Content הוא אסטרטגיית Topical Authority — דף מרכזי שמקשר לכל המאמרים הרלוונטיים",
        `מדריך Pillar: "${keywords[0] || "הנושא"} — מדריך מקיף ${new Date().getFullYear()}"\nאורך: 3000+ מילים\nסעיפים:\n1. הקדמה וסקירה\n2. ${keywords[1] || "תת-נושא 1"}\n3. ${keywords[2] || "תת-נושא 2"}\n4. ${keywords[3] || "תת-נושא 3"}\n5. טעויות נפוצות\n6. טיפים מתקדמים\n7. FAQ\n8. סיכום\nקישורים פנימיים: ${pages.slice(0, 5).map(p => p.url).join(", ")}`,
      ));
    } else if (d === 29) {
      dayTasks.push(mkTask("local", "high", "high",
        "אסטרטגיית ביקורות Google — תהליך יזום",
        `הגדר תהליך איסוף ביקורות: 1) צור קישור ישיר לביקורת GBP, 2) שלח אימייל אוטומטי ללקוחות 48 שעות אחרי שירות, 3) הוסף CTA לביקורת באתר ובמייל. יעד: 5+ ביקורות חדשות בחודש.`,
        2.5, null,
        "תהליך ביקורות פעיל, 5+ ביקורות חדשות",
        "ביקורות Google הן אות חזק לאמינות — גם מנועי AI מתייחסים לביקורות כראיה ל-E-E-A-T",
      ));
      dayTasks.push(mkTask("local", "medium", "medium",
        `רישום ב-10 ספריות עסקיות מקומיות (${loc})`,
        `רשום את ${input.clientName} ב: d106, infoglobus, b144, zap, yelp, trustpilot, LinkedIn Company, Facebook Business, Waze Business, ועוד. ודא NAP עקבי.`,
        2.5, null,
        "פרופיל פעיל ב-10+ ספריות",
        "Citations (אזכורים בספריות) הם אות דירוג מקומי — יותר citations = יותר סמכות מקומית",
      ));
    } else {
      dayTasks.push(mkTask("ai_optimization", "medium", "medium",
        "סקירה חוזרת של נראות AI — מדידת שינויים",
        `הרץ שוב את 10 השאילתות המרכזיות ב-5 מנועי AI. השווה ל-baseline: כמה שאילתות חדשות מזכירות את ${input.clientName}? אילו מנועים השתפרו?`,
        2.5, null,
        "דוח נראות AI עדכני להשוואה",
        "מדידה חוזרת אחרי 3 שבועות נותנת אינדיקציה ראשונית — Schema + FAQ + תוכן חדש אמורים להתחיל לעבוד",
      ));
      dayTasks.push(mkTask("analytics", "medium", "low",
        "דוח שבועי — סיכום שלב GEO",
        `כתוב דוח: Schema מוטמע (סוגים, דפים), FAQ פורסם (שאלות), נראות AI (שינויים), ביקורות חדשות. שלח ללקוח.`,
        1.5, null,
        "דוח שלב 3 מוכן",
        "שקיפות מתמשכת שומרת על אמון הלקוח ומוכיחה ערך",
      ));
    }
    const ph = phaseFor(d);
    days.push(mkDay(d, dayTasks[0]?.title.substring(0, 50) || `יום ${d}`, dayTasks));
  });

  // Days 31-35: Advanced GEO
  days.push(mkDay(31, "Video SEO ותוכן מולטימדיה", [
    mkTask("content", "medium", "medium",
      `יצירת 2-3 סרטונים קצרים (60-90 שניות) על ${keywords[0] || "הנושא"}`,
      `צלם/צור סרטונים: 1) מי אנחנו (30 שניות), 2) ${keywords[0] || "טיפ מקצועי"} (60 שניות), 3) FAQ (#1 שאלה נפוצה). העלה ל-YouTube עם title, description, tags ממוקדי SEO.`,
      4, null,
      "3 סרטונים באתר ו-YouTube עם SEO",
      "YouTube הוא מנוע החיפוש השני בגודלו — וגם ChatGPT ו-Gemini שואבים מידע מ-YouTube",
    ),
  ]));

  [32, 33].forEach((d, idx) => {
    const gap = topGaps[8 + idx];
    const kw = gap?.query || keywords[8 + idx] || `תוכן ${idx + 8}`;
    days.push(mkDay(d, `תוכן GEO ממוקד: "${kw}"`, [
      mkTask("content", "high", "high",
        `מאמר GEO-optimized: "${kw}"`,
        `כתוב מאמר ממוקד GEO עבור "${kw}": פסקת פתיחה עם תשובה ישירה, רשימות ממוספרות, definition boxes, נתונים עם מקורות. אזכור ${input.clientName} 2-3 פעמים באופן טבעי. הוסף FAQ Schema.`,
        4.5, null,
        `מאמר GEO חי ומאינדקס`,
        gap ? `זוהה כפער ב-AI: "${gap.query}" — צריך לכסות אותו` : "מילת מפתח אסטרטגית",
      ),
    ]));
  });

  days.push(mkDay(34, "סקירת Schema ו-Rich Results", [
    mkTask("ai_optimization", "medium", "medium",
      `בדיקת כל ה-Schema ב-${domain} — ולידציה מלאה`,
      `בדוק כל דף עם Schema ב-Rich Results Test. תעד: כמה דפים עם Schema, כמה עוברים, כמה מופיעים כ-Rich Results ב-GSC. תקן בעיות.`,
      2.5, null,
      "100% Schema validated, דוח Rich Results",
      "Schema שעובד = Rich Results = CTR גבוה יותר = יותר תנועה",
    ),
  ]));

  days.push(mkDay(35, "סיכום שלב 3 — GEO מידרג", [
    mkTask("analytics", "high", "medium",
      "דוח ביניים: GEO + Schema + נראות AI",
      `כתוב דוח: Schema מוטמע (${pagesNeedingSchema.length > 0 ? `${pagesNeedingSchema.length} דפים שודרגו` : "כל הדפים"}), FAQ פורסם, נראות AI (before/after), Rich Results status, ביקורות חדשות. צרף צילומי מסך.`,
      2, null,
      "דוח GEO מקיף לסיום שלב 3",
      "נקודת ציון חשובה — 35 ימים = יותר מחצי התוכנית, צריך להראות תוצאות ראשוניות",
    ),
  ]));

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: Days 36-50 — Competitor Strategy & Authority
  // ═══════════════════════════════════════════════════════════════════

  days.push(mkDay(36, "ניתוח מתחרים מעמיק", [
    mkTask("offpage", "high", "high",
      `ניתוח Backlink Profile של ${Math.min(competitors.length, 3) || 3} מתחרים`,
      `השתמש ב-Ahrefs / Moz לניתוח: ${competitors.slice(0, 3).join(", ") || "3 מתחרים מובילים"}. תעד: DA, מספר קישורים, אתרים מקשרים, anchor texts. זהה הזדמנויות: אתרים שמקשרים למתחרים אבל לא ל-${domain}.`,
      4, null,
      "רשימת 20+ אתרים פוטנציאליים לקישורים",
      "קישורים הם עדיין הגורם #1 בדירוג — צריך לדעת מאיפה המתחרים מקבלים את שלהם",
    ),
    mkTask("offpage", "medium", "medium",
      `זיהוי Content Gaps מול מתחרים`,
      `השווה תוכן ${domain} מול ${competitors[0] || "המתחרה המוביל"}: מילות מפתח שהמתחרה מדורג בהן ו-${domain} לא. תעדף לפי volume ו-difficulty.`,
      2.5, null,
      "רשימת מילות מפתח שהמתחרים מנצלים ואנחנו לא",
      "הזדמנויות שהמתחרים כבר מנצלים = ביקוש מוכח — קל יותר להצדיק השקעה",
    ),
  ]));

  // Days 37-40: Link building
  days.push(mkDay(37, "אסטרטגיית בניית קישורים — התחלה", [
    mkTask("offpage", "high", "high",
      "כתיבת Guest Post לאתר סמכותי",
      `כתוב מאמר אורח 800+ מילים לאתר עם DA 30+. נושא: ${keywords[0] || "הנושא המרכזי"}. כלול קישור ל-${domain} ב-anchor text טבעי. זהה 5 אתרים פוטנציאליים מרשימת ניתוח המתחרים.`,
      5, null,
      "Guest Post מפורסם עם קישור ל-domain",
      "קישור מאתר סמכותי שווה יותר מ-100 קישורים מאתרים חלשים — Guest Post הוא השיטה היעילה ביותר",
    ),
    mkTask("offpage", "medium", "medium",
      "Digital PR — יצירת Newsworthy Content",
      `צור תוכן שאפשר להפיץ: סטטיסטיקה מקורית, סקר, מדריך מקיף, אינפוגרפיקה. פנה ל-3 כתבים/בלוגרים בתחום עם pitch ממוקד.`,
      3, null,
      "קמפיין PR עם 3+ pitches שנשלחו",
      "Digital PR מייצר קישורים איכותיים + אזכורים בתקשורת — שני אותות שמנועי AI מעריכים",
    ),
  ]));

  [38, 39, 40].forEach((d, idx) => {
    const dayTasksArr: DayTask[] = [];
    if (d === 38) {
      dayTasksArr.push(mkTask("offpage", "high", "high",
        "בניית קישורים מספריות ו-Resource Pages",
        `הגש ל-10 ספריות מקצועיות ו-resource pages שזוהו בניתוח המתחרים. כלול תיאור עסקי ממוקד מילות מפתח, קישור, וקטגוריה מדויקת.`,
        3, null,
        "10+ הגשות לספריות ו-resource pages",
        "Citations בספריות מקצועיות מחזקות את הנוכחות הדיגיטלית — מנועי AI בודקים את הנוכחות ברחבי הרשת",
      ));
    } else if (d === 39) {
      dayTasksArr.push(mkTask("content", "high", "high",
        `כתיבת מאמר ${keywords[1] || "נושא #2"} — Competitor Counter`,
        `כתוב מאמר שעולה על התוכן של ${competitors[0] || "המתחרה"} בנושא "${keywords[1] || "נושא #2"}": יותר מעמיק, יותר מעודכן, יותר מובנה, עם נתונים חדשים.`,
        5, null,
        "מאמר שעולה על המתחרה — Skyscraper Technique",
        "Skyscraper Technique: צור תוכן טוב יותר מהמתחרה ופנה לאתרים שמקשרים אליו — שיטה מוכחת לבניית קישורים",
      ));
    } else {
      dayTasksArr.push(mkTask("offpage", "medium", "medium",
        "מעקב Guest Post + Outreach נוסף",
        `בדוק סטטוס Guest Posts שנשלחו. שלח 5 pitches נוספים. חפש הזדמנויות ל-HARO (Help a Reporter Out) / Qwoted / SourceBottle.`,
        3, null,
        "5+ pitches נוספים, מעקב אחרי pending",
        "בניית קישורים היא מרתון, לא ספרינט — צריך outreach מתמשך",
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
        `צור/עדכן פרופילים: Bing Places (לCopilot), Google Knowledge Panel (לGemini), Wikipedia (אם רלוונטי), Crunchbase, LinkedIn Company. ודא עקביות מידע.`,
        3, null,
        "פרופילים פעילים ב-3+ פלטפורמות AI",
        "מנועי AI שואבים מידע מפלטפורמות ספציפיות — נוכחות בהן = סיכוי גבוה יותר להיכלל בתשובות",
      ));
    } else if (d === 42) {
      dayTasksArr.push(mkTask("content", "high", "high",
        `כתיבת Case Study / סיפור הצלחה`,
        `כתוב case study מפורט: הבעיה, הפתרון, התוצאות (עם מספרים). כלול ציטוט לקוח, תמונות לפני/אחרי. הוסף Schema מסוג Article. זה תוכן E-E-A-T חזק.`,
        4, null,
        "Case Study מפורסם עם Schema",
        "Case Studies הם ההוכחה הטובה ביותר ל-Experience ו-Expertise — שני מרכיבים קריטיים ב-E-E-A-T",
      ));
    } else if (d === 43) {
      dayTasksArr.push(mkTask("offpage", "medium", "medium",
        "Guest Post #2 + פודקאסט / ראיון",
        `כתוב Guest Post שני לאתר נוסף. בנוסף, פנה לפודקאסט בתחום כדי להתראיין — פודקאסטים מגדילים סמכות ומייצרים backlinks.`,
        4.5, null,
        "Guest Post #2 + pitch לפודקאסט",
        "גיוון מקורות הקישורים חשוב — Google מעריך קישורים ממגוון סוגי אתרים",
      ));
    } else if (d === 44) {
      dayTasksArr.push(mkTask("local", "medium", "medium",
        "איסוף ביקורות + תגובה לביקורות קיימות",
        `שלח בקשות ביקורת ל-10 לקוחות. הגב לכל הביקורות הקיימות (חיוביות ושליליות) ב-GBP. כלול מילות מפתח בתגובות באופן טבעי.`,
        2, null,
        "10 בקשות נשלחו, כל הביקורות נענו",
        "תגובה לביקורות משפרת אמינות — Google ומנועי AI רואים שהעסק מגיב ומעורב",
      ));
    } else {
      dayTasksArr.push(mkTask("content", "high", "high",
        `עדכון ושדרוג 3 מאמרים ישנים`,
        `עדכן את 3 המאמרים הוותיקים ביותר ב-${domain}: הוסף מידע חדש, עדכן תאריכים, שפר את הפורמט, הוסף FAQ, שלב מילות מפתח שנמצאו בשלב 2.`,
        3.5, null,
        "3 מאמרים ישנים משודרגים ומעודכנים",
        "עדכון תוכן ישן נותן boost מיידי — Google מעדיף תוכן fresh ו-updated",
      ));
    }
    days.push(mkDay(d, dayTasksArr[0]?.title.substring(0, 50) || `יום ${d}`, dayTasksArr));
  });

  // Days 46-50: Social signals + authority consolidation
  [46, 47, 48, 49, 50].forEach((d) => {
    const dayTasksArr: DayTask[] = [];
    if (d === 46) {
      dayTasksArr.push(mkTask("offpage", "medium", "medium",
        "Social Signals — שיתוף מאסיבי של תוכן",
        `שתף את כל המאמרים החדשים: LinkedIn (5 פוסטים), Facebook, Twitter/X, Quora (תשובות עם קישור), Reddit (אם רלוונטי). כל פלטפורמה עם format מותאם.`,
        3, null,
        "כל התוכן משותף ב-4+ פלטפורמות",
        "Social signals הם אות עקיף לדירוג — ומנועי AI סורקים גם רשתות חברתיות",
      ));
    } else if (d === 47) {
      dayTasksArr.push(mkTask("offpage", "high", "high",
        "Broken Link Building — מציאת הזדמנויות",
        `חפש קישורים שבורים באתרי מתחרים ואתרי סמכות. פנה לבעלי האתרים והצע את התוכן שלך כתחליף. כלי: Ahrefs Broken Link Checker.`,
        3, null,
        "5+ הזדמנויות broken link building מזוהות",
        "Broken Link Building הוא win-win — אתה עוזר לבעל האתר לתקן קישור שבור ומקבל backlink",
      ));
    } else if (d === 48) {
      dayTasksArr.push(mkTask("content", "medium", "medium",
        `כתיבת מאמר השוואתי / "vs" article`,
        `כתוב מאמר השוואה: "${keywords[0] || "שירות A"} vs ${keywords[1] || "שירות B"}" — פורמט פופולרי שמנועי AI מעדיפים. כלול: טבלת השוואה, יתרונות/חסרונות, המלצה.`,
        4, null,
        "מאמר השוואתי מפורסם עם טבלה",
        "מאמרי השוואה מושכים תנועה transactional ומנועי AI אוהבים להשתמש בהם לתשובות",
      ));
    } else if (d === 49) {
      dayTasksArr.push(mkTask("analytics", "medium", "medium",
        "מדידת Backlink Profile — מה נבנה?",
        `בדוק ב-GSC > Links: כמה backlinks חדשים? מאילו אתרים? מה ה-DA? השווה ל-baseline. תעד את כל הקישורים שנבנו בשלב 4.`,
        2, null,
        "דוח backlinks עדכני עם השוואה ל-baseline",
        "מדידת backlinks מראה את ה-ROI של מאמצי Link Building — צריך לפחות 5+ קישורים חדשים",
      ));
    } else {
      dayTasksArr.push(mkTask("analytics", "high", "medium",
        "סיכום שלב 4 — מתחרים וסמכות",
        `דוח שלב 4: קישורים חדשים (מספר, DA ממוצע), Guest Posts, ביקורות חדשות, Social presence, שינויים בדירוג. השווה ל-baseline יום 7.`,
        2, null,
        "דוח שלב 4 מקיף",
        "סיכום השלב מראה את ההשקעה בסמכות — הפירות יבואו ב-30-60 הימים הבאים",
      ));
    }
    days.push(mkDay(d, dayTasksArr[0]?.title.substring(0, 50) || `יום ${d}`, dayTasksArr));
  });

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 5: Days 51-60 — Optimization, Reporting & Second Scan
  // ═══════════════════════════════════════════════════════════════════

  days.push(mkDay(51, "אופטימיזציה מתקדמת — Core Web Vitals", [
    mkTask("technical", "high", "high",
      "סריקת Core Web Vitals שנייה ותיקון",
      `הרץ PageSpeed Insights על 10 דפים מרכזיים. השווה ל-baseline יום 1. תקן: LCP (ודא < 2.5s), FID (< 100ms), CLS (< 0.1). ${isModerate || isSlow ? `מהירות הייתה ${((scan?.loadTimeMs || 0) / 1000).toFixed(1)}s — בדוק מה השתפר.` : ""}`,
      3, scan?.url || null,
      "כל Core Web Vitals ירוקים",
      "Core Web Vitals קריטיים לדירוג — שיפור אחרי 50 ימים של עבודה אמור להיות משמעותי",
    ),
  ]));

  days.push(mkDay(52, "סריקה טכנית שנייה — Before vs After", [
    mkTask("technical", "high", "high",
      `סריקה טכנית מלאה שנייה של ${domain}`,
      `הרץ Screaming Frog / Sitebulb. השווה ל-סריקה מיום 1: כמה שגיאות 404 תוקנו? כמה דפים חדשים נאינדקסו? מה מצב ה-meta tags? כמה דפים עם Schema?`,
      3, null,
      "דוח סריקה שנייה עם השוואה ל-baseline",
      "סריקה שנייה מוכיחה מה תוקן ומה נשאר — זו הבסיס לדוח הסופי",
    ),
  ]));

  days.push(mkDay(53, "סריקת AI Visibility שנייה", [
    mkTask("ai_optimization", "high", "critical",
      `בדיקת נראות AI שנייה — ${vis.length} שאילתות ב-5 מנועים`,
      `הרץ את כל ${vis.length} השאילתות שוב ב-5 מנועי AI. תעד: כמה שאילתות חדשות מזכירות את ${input.clientName}? אילו מנועים השתפרו? מה ה-sentiment? baseline: ${mentionedQueries.length}/${vis.length} (${vis.length > 0 ? Math.round((mentionedQueries.length / vis.length) * 100) : 0}%).`,
      4, null,
      `דוח נראות AI שני — before/after מלא`,
      "הסריקה השנייה היא רגע האמת — כל העבודה ב-50 ימים אמורה להתבטא בשיפור נראות AI",
    ),
  ]));

  days.push(mkDay(54, "ניתוח GSC — דירוגים, CTR, חשיפות", [
    mkTask("analytics", "high", "high",
      "ניתוח Google Search Console מעמיק",
      `GSC > Performance > Compare (אחרונים 28 ימים vs 28 ימים לפני כן): שינויי חשיפות, קליקים, CTR, עמדה ממוצעת. פילטר לפי: דפים חדשים, מילות מפתח חדשות, שיפורי דירוג.`,
      3, null,
      "דוח GSC מפורט עם before/after",
      "GSC הוא מקור האמת #1 לביצועי SEO — השינויים שם מעידים על ההצלחה",
    ),
  ]));

  days.push(mkDay(55, "אופטימיזציית דפים עם פוטנציאל גבוה", [
    mkTask("onpage", "high", "high",
      "אופטימיזציית Striking Distance — דפים בעמדות 5-20",
      `ב-GSC > Performance: מצא דפים בעמדות 5-20 עם חשיפות גבוהות. לכל דף: שפר Title tag, הרחב תוכן, הוסף internal links, שפר URL. אלו הם ה-Quick Wins הגדולים.`,
      4, null,
      "5+ דפים Striking Distance מאופטמזים",
      "דפים בעמדות 5-20 הם הכי קרובים לעמוד 1 — שיפור קטן יכול להכניס אותם לתוצאות הראשונות",
    ),
  ]));

  days.push(mkDay(56, "A/B Testing — Title Tags", [
    mkTask("onpage", "medium", "medium",
      "A/B Test — שינוי Title Tags לשיפור CTR",
      `בחר 5 דפים עם חשיפות גבוהות ו-CTR נמוך (< 3%). שנה Title tags עם CTR hooks: מספרים, שנה, מילות פעולה. תעד ועקוב שבועיים.`,
      2, null,
      "5 Title Tags חדשים ב-A/B Test",
      "שיפור CTR מ-2% ל-4% = הכפלת התנועה בלי שינוי בדירוג — A/B Testing הוא ROI גבוה",
    ),
    mkTask("content", "medium", "medium",
      "עדכון תוכן עונתי ואקטואלי",
      `עדכן 3 מאמרים עם מידע אקטואלי: סטטיסטיקות ${new Date().getFullYear()}, מגמות חדשות, מוצרים/שירותים חדשים. ודא שה-title כולל את השנה.`,
      2.5, null,
      "3 מאמרים עדכניים עם תאריך נוכחי",
      "Google אוהב freshness — תוכן עם שנה נוכחית מקבל CTR גבוה יותר",
    ),
  ]));

  days.push(mkDay(57, "הכנת דוח סופי — איסוף נתונים", [
    mkTask("analytics", "high", "high",
      "איסוף כל הנתונים לדוח 60 יום",
      `אסוף: דירוגים (GSC), תנועה (GA4), backlinks (Ahrefs/GSC), נראות AI (סריקה 2), Core Web Vitals, ביקורות Google, דפים חדשים, Schema status. ארגן בגיליון מסודר.`,
      3, null,
      "גיליון נתונים מלא לדוח סופי",
      "הנתונים הם הבסיס לדוח — צריך מספרים מדויקים ל-before/after",
    ),
  ]));

  days.push(mkDay(58, "כתיבת דוח סופי מקיף", [
    mkTask("analytics", "high", "critical",
      `כתיבת דוח SEO/GEO סופי עבור ${input.clientName}`,
      `כתוב דוח מקיף: תקציר מנהלים, מצב לפני ואחרי, ממצאים טכניים, נראות AI (before/after), תוכן שנוצר, קישורים שנבנו, המלצות להמשך, ROI צפוי.`,
      5, null,
      "דוח 60 יום מקיף ומקצועי",
      "הדוח הוא הפלט העיקרי של 60 ימים — חייב להיות מקצועי ולהראות ערך",
    ),
  ]));

  days.push(mkDay(59, "מצגת לקוח + תוכנית המשך", [
    mkTask("analytics", "medium", "medium",
      "הכנת מצגת סיכום ללקוח",
      `הכן מצגת 10-15 שקפים: highlights מרכזיים, before/after ויזואלי, 3 הישגים גדולים, 3 הזדמנויות להמשך. כלול גרפים וצילומי מסך.`,
      3, null,
      "מצגת מוכנה לשליחה/הצגה ללקוח",
      "מצגת ויזואלית מקצועית משכנעת את הלקוח להמשיך — דוח טקסט לא מספיק",
    ),
    mkTask("analytics", "high", "high",
      "בניית תוכנית 90 יום — השלב הבא",
      `על בסיס התוצאות של 60 יום, בנה תוכנית 90 יום: מה לחזור ולעשות, מה חדש, יעדים מעודכנים. תעדף: ${highPriorityGaps.length > 5 ? "פערי תוכן שנותרו" : "בניית קישורים מתמשכת"}, נראות AI, authority.`,
      2.5, null,
      "תוכנית 90 יום עם יעדים מעודכנים",
      "SEO הוא מרתון — אחרי 60 יום אפשר לראות לאן ממשיכים עם יעדים חדשים מבוססי נתונים",
    ),
  ]));

  days.push(mkDay(60, "סיום, סריקה סופית ו-Handoff", [
    mkTask("analytics", "high", "critical",
      "סריקה סופית + סגירת תוכנית 60 יום",
      `הרץ סריקה אחרונה: טכנית + AI visibility. השווה ל-Day 1. תעד: ${scan ? `SSL ${scan.hasSSL ? "✓" : needsSSL ? "✗→✓" : "✓"}, מהירות ${(scan.loadTimeMs / 1000).toFixed(1)}s→?s, DA ${scan.domainAuthority}→?` : "before/after מלא"}. סגור את כל הפריטים הפתוחים.`,
      3, null,
      "דוח סופי מלא — תוכנית 60 יום הושלמה",
      "הסריקה הסופית סוגרת את המעגל — מראה בדיוק מה השתנה ב-60 ימים של עבודה",
    ),
    mkTask("analytics", "medium", "medium",
      "העברת כל הנכסים ללקוח",
      `ארגן ומסור: גישה ל-GSC, GA4, כלי SEO; רשימת מילות מפתח; מפת תוכן; רשימת backlinks; לוח תוכן 3 חודשים; תיעוד Schema; מדריך תחזוקה שבועי.`,
      2, null,
      "כל הנכסים מועברים ומתועדים",
      "Handoff מקצועי מבטיח שהלקוח יכול להמשיך את העבודה או להעביר לצוות הבא",
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
          `המשך עבודה על המשימות הפתוחות מהימים הקודמים. עדף פריטים שלא הושלמו ומשימות עם impact גבוה.`,
          3, null,
          "התקדמות במשימות שלב " + ph.number,
          "ימים ללא משימה חדשה הם הזדמנות לסיים עבודה שנפתחה — עדיף לסיים מאשר להתחיל חדש",
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
