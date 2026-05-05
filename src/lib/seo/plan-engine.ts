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
  const locStr = loc ? ` ב-${loc}` : "";
  days.push(mkDay(4, "אופטימיזציה של Meta Tags ומבנה כותרים", [
    mkTask("onpage", "high", "high",
      `כתוב Meta Titles ייחודיים עבור ${Math.min(metaPages.length, 10)} עמודים`,
      `כתוב Title tag ייחודי לכל עמוד (50-60 תווים). כלול מילת-מפתח ראשונה${locStr}. פורמט מומלץ: "Keyword | ${input.clientName}". עמודים לעדכון: ${metaPages.slice(0, 5).map(p => p.url).join(", ")}`,
      3, metaPages[0]?.url || null,
      "Meta Title ייחודי ואופטימלי בכל עמוד",
      "Title tag הוא גורם דירוג on-page החזק ביותר — משפיע ישירות על CTR בתוצאות חיפוש",
    ),
    mkTask("onpage", "high", "high",
      `כתוב Meta Descriptions עבור ${Math.min(metaPages.length, 10)} עמודים`,
      `כתוב Description ייחודי (150-160 תווים) עם CTA ומילת-מפתח. דוגמה: "${keywords[0] || "שירות"} מומחיות${locStr} — ${input.clientName}. צור קשר להתייעצות בחינם!"`,
      2.5, metaPages[0]?.url || null,
      "Meta Description ממוקד CTR בכל עמוד",
      "תיאורים טובים מגבירים CTR אפילו ללא שינוי דירוג — יותר קליקים = יותר traffic מאותה תנוחה",
    ),
    mkTask("onpage", "medium", "medium",
      `תיקון מבנה כותרים H1-H3 ב-${pagesNeedingH1.length > 0 ? pagesNeedingH1.length : "כל"} עמודים`,
      `וודא H1 ייחודי בכל עמוד עם מילת-מפתח. ${pagesNeedingH1.length > 0 ? `${pagesNeedingH1.length} עמודים חסרים H1: ${pagesNeedingH1.slice(0, 3).map(p => p.url).join(", ")}` : "בדוק היררכיה H2-H3 בכל עמודים."}`,
      2, pagesNeedingH1[0]?.url || null,
      "כל עמוד עם H1 ייחודי והיררכיה נכונה",
      "מבנה כותרים עוזר ל-Google וAI להבין ארגון תוכן ונושא עמוד",
    ),
  ]));

  // Day 5: Images + internal linking
  days.push(mkDay(5, "אופטימיזציה של תמונות וקישורים פנימיים", [
    mkTask("onpage", "medium", "medium",
      `הוסף Alt Text ל-${pagesNeedingAlt.length > 0 ? pagesNeedingAlt.length + " עמודים ללא Alt" : "כל התמונות"}`,
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

  // Days 9-11: Writing content for top gaps
  const contentDays = [9, 10, 11];
  contentDays.forEach((d, idx) => {
    const gap = topGaps[idx];
    const kw = gap?.query || keywords[idx] || `נושא #${idx + 1}`;
    const pageUrl = pages.find(p => p.wordCount > 300)?.url || null;

    days.push(mkDay(d, `כתיבת מאמר מומחה: "${kw}"`, [
      mkTask("content", "high", "high",
        `כתוב מאמר 1500+ מילים: "${kw}"`,
        `כתוב מאמר מומחה ועמוק המענה ל-"${kw}". מבנה: כותרת עם מילת-מפתח, intro (150 מילים), 4-6 תתסעיפים עם H2/H3, סיכום עם CTA. כלול נתונים, דוגמאות, ציטוטי מומחים. הוסף FAQ עם 3-5 שאלות בתחתית.`,
        5, pageUrl,
        `מאמר פורסם, אופטימלי עבור "${kw}", דורג והוא מוכן ל-AI`,
        gap ? `שאילתה שזוהתה כפער — ${input.clientName} חסר מ-${missedQueries.length > 0 ? "תוצאות AI" : "תוצאות חיפוש"}` : "מילת-מפתח ליבה חסרה מאתר",
        `מאמר: "${kw}"\nאורך: 1500+ מילים\nקהל יעד: ${loc || "השוק שלך"}\nמבנה:\n1. הקדמה — מה הבעיה/צורך\n2. ${kw} — הסבר מקיף\n3. יתרונות / שיטות / עצות\n4. דוגמאות / מקרי בחינה\n5. FAQ (3-5 שאלות)\n6. סיכום + CTA\nמילות-מפתח משניות: ${keywords.slice(0, 3).join(", ")}`,
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
      `שדרוג ${Math.min(thinPages.length, 5) || 5} עמודים עם תוכן תשוש`,
      `${thinPages.length > 0 ? `נמצאו ${thinPages.length} עמודים עם פחות מ-300 מילים: ${thinPages.slice(0, 3).map(p => p.url).join(", ")}` : `עדכן 5 עמודים חשובים ב-${domain}`}. לכל עמוד: הרחב ל-800+ מילים, הוסף H2/H3, שלב מילות-מפתח, הוסף FAQ, עדכן תאריך.`,
      4, thinPages[0]?.url || null,
      "כל עמודי תשוש הורחבו ל-800+ מילים",
      "עמודי תוכן תשוש פגיעים לעונשים — הרחבה = שיפור דירוג",
    ),
    mkTask("content", "medium", "medium",
      "הוסף תוכן ויזואלי — תרשימים וטבלאות",
      `הוסף infographic, טבלה, או גרף ל-3 מאמרים חשובים. תוכן ויזואלי מגביר זמן בעמוד ושיתוף. השתמש בCanva או כלי דומה.`,
      3, null,
      "3 מאמרים עם תוכן ויזואלי ייחודי",
      "תוכן ויזואלי מגביר זמן בעמוד ב-80% ומשותף 3x יותר — מנועי AI מעדיפים תוכן עשיר",
    ),
  ]));

  // Days 13-14: More content for missed queries
  [13, 14].forEach((d, idx) => {
    const gap = topGaps[3 + idx];
    const kw = gap?.query || keywords[3 + idx] || `נושא ${idx + 4}`;
    days.push(mkDay(d, `מאמר מאופטימל עבור AI: "${kw}"`, [
      mkTask("content", "high", "high",
        `כתוב מאמר מאופטימל עבור AI: "${kw}"`,
        `כתוב מאמר המענה ישירות ל-"${kw}" בפורמט המעודף ל-AI: תשובה ישירה בפסקה הראשונה, רשימות ממוספרות, הגדרות ברורות, מקורות נתונים מצוטטים. ${gap ? `פער שזוהה: ${input.clientName} לא מוזכר בתוצאות AI לשאילתה זו.` : ""}`,
        5, null,
        `מאמר-friendly עבור AI פורסם, אופטימלי עבור "${kw}"`,
        "מנועי AI מעדיפים תוכן מובנה עם תשובות ישירות — פורמט שונה מ-SEO קלאסי",
        `מאמר מאופטימל עבור AI: "${kw}"\nאורך: 1200+ מילים\nפורמט: תשובה ישירה בפתיחה (50 מילים) → הסבר מורחב → רשימה ממוספרת → FAQ\nחשוב: כלול שם העסק (${input.clientName}) באופן טבעי 2-3 פעמים`,
      ),
    ]));
  });

  // Day 15: Landing pages for location
  days.push(mkDay(15, `עמודי נחיתה מבוססי מיקום${locStr}`, [
    mkTask("content", "high", "high",
      `צור עמוד נחיתה מקומי: "${keywords[0] || "שירותים"}${locStr}"`,
      `צור עמוד נחיתה ממוקד מקום${locStr}: H1 עם מילת-מפתח + מיקום, 800+ מילים של תוכן, מפה מובנית, כתובת + טלפון, ביקורות מקומיות, LocalBusiness Schema. URL: /${keywords[0] ? keywords[0].replace(/\s/g, "-") : "services"}${loc ? "-" + loc.replace(/\s/g, "-") : ""}`,
      4, null,
      `עמוד נחיתה חי${locStr} עם Schema מקומי`,
      `עמודי נחיתה ממוקדי מיקום דירוגים גבוהים לחיפושים כמו "${keywords[0] || "שירות"}${locStr}" — בעיקר חשוב לעסקים מקומיים`,
      `עמוד נחיתה: "${keywords[0] || "שירות"}${locStr}"\nH1: ${keywords[0] || "שירות"} מקצועי${locStr}\nסעיפים: אודותינו, שירותים, למה לבחור בנו, ביקורות, יצירת קשר\nSchema: LocalBusiness + Service`,
    ),
    mkTask("local", "medium", "medium",
      "וודא עקביות NAP בכל הפלטפורמות",
      `אמת שהשם של ${input.clientName}, הכתובת והטלפון עקביים ב: GBP, Facebook, LinkedIn, Waze, מדדי עסקים. עדכן כל אי-עקביויות.`,
      2, null,
      "NAP 100% עקבי בכל הפלטפורמות",
      "אי-עקביות NAP מבלבלת את Google ופוגעת בביטחון — צריך להיות זהה בכל מקום",
    ),
  ]));

  // Days 16-18: More content articles
  [16, 17, 18].forEach((d, idx) => {
    const gapIdx = 5 + idx;
    const gap = topGaps[gapIdx];
    const kw = gap?.query || keywords[gapIdx] || `תוכן #${gapIdx + 1}`;

    days.push(mkDay(d, `תוכן ממוקד: "${kw}"`, [
      mkTask("content", "high", "high",
        `כתוב מאמר/מדריך: "${kw}"`,
        `${gap ? `פער תוכן שזוהה: "${gap.query}" (${gap.intent}, ${gap.importance}). ` : ""}כתוב מדריך מומחה 1200+ מילים. כלול: הגדרות ברורות, צעדים ממוספרים, עצות מעשיות, CTA. שלב בצורה טבעית ${input.clientName}.`,
        4, null,
        `מאמר פורסם ואופטימלי עבור "${kw}"`,
        gap ? `AI לא מזכיר את ${input.clientName} עבור "${gap.query}" — תוכן ממוקד ישנה את זה` : "מילת-מפתח חשובה הזקוקה לכיסוי",
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
    ),
    mkTask("ai_optimization", "high", "high",
      "יישום FAQ Schema בעמודים חשובים",
      `הוסף FAQPage Schema (JSON-LD) ל-3 עמודים חשובים. השתמש בשאלות מסריקת AI: ${missedQueries.slice(0, 3).map(q => `"${q.query}"`).join(", ")}. כל שאלה עם תשובה מלאה כולל שם העסק.`,
      2.5, null,
      "FAQ Schema ב-3+ עמודים, עובר Rich Results Test",
      "FAQ Schema מופיע כתוצאות עשירות ומנועי AI שולפים תשובות ישירות — הדרך המהירה ביותר להיכנס לתוצאות AI",
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
    ),
  ]));

  days.push(mkDay(24, "בנייה עמוד FAQ מרכזי עם Schema", [
    mkTask("content", "high", "critical",
      `כתיבת עמוד FAQ מרכזי עם ${Math.min(vis.length, 20)} שאלות`,
      `צור עמוד FAQ ייעודי ב-${domain}/faq. כלול ${Math.min(vis.length, 20)} שאלות מסריקת AI. כל תשובה: 100-200 מילים, ישירה, כולל שם עסק. שאלות: ${missedQueries.slice(0, 5).map(q => `"${q.query}"`).join(", ")}${missedQueries.length > 5 ? "..." : ""}`,
      5, null,
      `עמוד FAQ חי עם ${Math.min(vis.length, 20)}+ שאלות ותשובות`,
      "עמוד FAQ הוא המקור #1 שבו מנועי AI שולפים תשובות — כל שאלה שענו = הזדמנות להופיע בתוצאת AI",
      `עמוד FAQ: ${domain}/faq\n${missedQueries.slice(0, 10).map((q, i) => `${i + 1}. "${q.query}"\n   תשובה: [תשובה ישירה 100-200 מילים כולל "${input.clientName}"]`).join("\n")}`,
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
      ));
    } else if (d === 28) {
      dayTasks.push(mkTask("content", "high", "high",
        `כתיבה מדריך מקיף: "הכל על ${keywords[0] || "הנושא"}"`,
        `תוכן Pillar: מדריך 3000+ מילים המכסה ${keywords[0] || "topic"} בצורה מקיפה. כלול: סיכום ביצוע, infographic, FAQ, קישורים ל-5+ מאמרים באתר. זה התוכן Hub שלך.`,
        6, null,
        "מדריך Pillar פורסם — עמוד הסמכותי ביותר באתר",
        "תוכן Pillar הוא אסטרטגיית Topical Authority — עמוד מרכזי המקושר לכל המאמרים הרלוונטיים",
        `מדריך Pillar: "${keywords[0] || "נושא"} — מדריך מקיף ${new Date().getFullYear()}"\nאורך: 3000+ מילים\nסעיפים:\n1. סקירה כללית\n2. ${keywords[1] || "תת-נושא 1"}\n3. ${keywords[2] || "תת-נושא 2"}\n4. ${keywords[3] || "תת-נושא 3"}\n5. טעויות נפוצות\n6. עצות מתקדמות\n7. FAQ\n8. סיכום\nקישורים פנימיים: ${pages.slice(0, 5).map(p => p.url).join(", ")}`,
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
      `יצירה 2-3 וידאוים קצרים (60-90 שניות) על ${keywords[0] || "נושא"}`,
      `צור/צלם וידאוים: 1) מי אנחנו (30 שניות), 2) ${keywords[0] || "עצה מומחה"} (60 שניות), 3) FAQ (שאלה הנפוצה ביותר). העלה ל-YouTube עם כותרת, תיאור, ותגיות ממוקדות SEO.`,
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
      `כתוב מאמר guest 800+ מילים לאתר DA 30+. נושא: ${keywords[0] || "נושא ליבה"}. כלול קישור טבעי ל-${domain}. זהה 5 אתרים פוטנציאליים מרשימת ניתוח המתחרים.`,
      5, null,
      "Guest post פורסם עם קישור domain",
      "קישור מאתר סמכותי שווה יותר מ-100 מאתרים חלשים — Guest Post הוא השיטה היעילה ביותר",
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
        `כתיבה ${keywords[1] || "נושא #2"} — התגבר מתחרים`,
        `כתוב מאמר המעלה ביצוע ${competitors[0] || "מתחרה מוביל"} על "${keywords[1] || "נושא #2"}": עמוק יותר, עדכני יותר, מובנה טוב יותר, עם נתונים חדשים.`,
        5, null,
        "מאמר טוב יותר מאשר מתחרה — Skyscraper Technique",
        "Skyscraper Technique: צור תוכן טוב יותר מאשר מתחרה, היצע אל אתרים המקשרים לשלהם — שיטת בניית קישורים מוכחת",
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
        `כתוב מאמר השוואה: "${keywords[0] || "שירות A"} לעומת ${keywords[1] || "שירות B"}" — פורמט שמנועי AI מעדיפים. כלול: טבלת השוואה, יתרונות/חסרונות, המלצה.`,
        4, null,
        "מאמר השוואה פורסם עם טבלה",
        "מאמרי השוואה מושכים transactional traffic ומנועי AI אוהבים להשתמש בהם לתשובות",
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
