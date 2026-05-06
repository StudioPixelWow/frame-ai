export interface TaskGuide {
  /** Task type identifier matching plan task titles */
  taskType: string;
  /** Hebrew display title */
  title: string;
  /** Step-by-step guide in Hebrew */
  steps: string[];
  /** Ready-to-use code, template, or snippet */
  codeSnippet?: string;
  /** Type of code snippet */
  snippetLanguage?: 'html' | 'json' | 'php' | 'text' | 'htaccess' | 'xml';
  /** Can this task be auto-executed via WordPress API? */
  autoExecutable: boolean;
  /** What the automation does (Hebrew) */
  automationDescription?: string;
  /** Estimated time savings with automation */
  manualMinutes: number;
  autoMinutes: number;
  /** Tips and warnings */
  tips?: string[];
  /** External resource links */
  resources?: { title: string; url: string }[];
}

export const TASK_GUIDES: Record<string, TaskGuide> = {
  meta_titles: {
    taskType: 'meta_titles',
    title: 'כתיבת Meta Titles ייחודיים',
    steps: [
      'פתחו כל דף בעורך WordPress (Yoast SEO)',
      'כתבו title tag ייחודי לכל עמוד בעורך Yoast SEO',
      'הכללו את המילה הראשית בתחילת ה-title tag',
      'הוסיפו את שם הברנד בסוף ה-title (אחרי |)',
      'שמרו על אורך של 50-60 תווים (יתורגם לעברית)',
      'בדקו ב-Google Search Console שה-title מופיע כראוי בתוצאות החיפוש',
      'חזרו על התהליך לכל דף חשוב באתר'
    ],
    codeSnippet: '<meta name="title" content="כותרות מתאימות | שם העסק" />\n<meta name="og:title" content="כותרות מתאימות | שם העסק" />',
    snippetLanguage: 'html',
    autoExecutable: true,
    automationDescription: 'מערכת יוצרת meta titles אוטומטיים בהתאם לנוסחה שהוגדרה (keyword | brand) עבור כל עמודי WordPress',
    manualMinutes: 45,
    autoMinutes: 5,
    tips: [
      'משתמשים "וקטוריה" או "|" כמפריד בין המילה לברנד',
      'אל תכניסו יותר מ-3 מילים ראשיות בתוך title אחד',
      'כל עמוד צריך title ייחודי - אל תעתיקו title מעמוד אחר',
      'נמנעו מתווי מיוחדים או סימני קוד (כמו @, #, $)',
      'בדקו שהתרגום לעברית לא משתנה באורך באופן משמעותי'
    ],
    resources: [
      { title: 'Yoast SEO - Meta Titles Guide', url: 'https://yoast.com/meta-descriptions/' },
      { title: 'Google Search Central - Title Tags', url: 'https://developers.google.com/search/docs/appearance/title-link' }
    ]
  },

  meta_descriptions: {
    taskType: 'meta_descriptions',
    title: 'כתיבת Meta Descriptions',
    steps: [
      'גשו לכל דף בעורך WordPress',
      'פתחו את הכרטיסייה Yoast SEO בקצה עמוד העריכה',
      'כתבו meta description שמתחיל בפעולה (למשל "גלו", "למדו", "חדשות")',
      'הכללו את המילה הראשית בטבע (לא בתור כיתוב)',
      'הוסיפו קריאה לפעולה (CTA) בסוף - "בקרו בעמוד שלנו", "קבלו ייעוץ חינם"',
      'שמרו על 140-155 תווים בעברית',
      'נסו שהתיאור מעודד קליק מתוך תוצאות החיפוש',
      'שמרו את הדף'
    ],
    codeSnippet: '<meta name="description" content="גלו כיצד אנחנו עוזרים לעסקים בתעשייה - פתרונות מותאמים אישית וטכנולוגיה מתקדמת. קבלו ייעוץ חינם היום." />',
    snippetLanguage: 'html',
    autoExecutable: true,
    automationDescription: 'מערכת יוצרת meta descriptions אוטומטיים בהתאם לתבנית שהוגדרה: [פעולה] + [description] + [CTA]',
    manualMinutes: 40,
    autoMinutes: 3,
    tips: [
      'כל meta description צריכה להיות ייחודית וקשורה לתוכן העמוד בדיוק',
      'התחילו בפעולה חזקה - "גלו", "למדו", "הזמינו", "צפו"',
      'נמנעו מחזרות של אותה description בכל העמודים',
      'בדקו בתוצאות חיפוש של Google כיצד התיאור מופיע בפועל',
      'אל תעתיקו אותה description מעמוד אחר - כל עמוד בעל זהות משלו'
    ],
    resources: [
      { title: 'Google Search Central - Meta Descriptions', url: 'https://developers.google.com/search/docs/appearance/snippet' },
      { title: 'Yoast SEO - Meta Description Best Practices', url: 'https://yoast.com/meta-descriptions/' }
    ]
  },

  robots_txt: {
    taskType: 'robots_txt',
    title: 'יצירת Robots.txt',
    steps: [
      'התחברו לשרת דרך FTP או File Manager',
      'גשו לתיקיית השורש (root) של האתר',
      'צרו קובץ חדש בשם "robots.txt"',
      'הוסיפו את הנתונים בהתאם לדוגמה המוצגת',
      'ודאו שמקומות מידע (admin, wp-admin) חסומים',
      'הוסיפו את הנתיב של sitemap.xml בתחתית הקובץ',
      'שמרו את הקובץ',
      'בדקו ב-Google Search Console שקובץ robots.txt נקרא בהצלחה'
    ],
    codeSnippet: 'User-agent: *\nAllow: /\nDisallow: /wp-admin/\nDisallow: /wp-includes/\nDisallow: /wp-content/plugins/\nDisallow: /?s=\nDisallow: /*?replytocom=\nDisallow: /feed/\nDisallow: /comments/feed/\n\nUser-agent: *\nAllow: /wp-content/uploads/\n\nSitemap: https://example.com/sitemap.xml',
    snippetLanguage: 'text',
    autoExecutable: true,
    automationDescription: 'מערכת יוצרת robots.txt אוטומטי בהתאם להגדרות WordPress, מחסימה תיקיות רגישות, ומוסיפה sitemap reference',
    manualMinutes: 25,
    autoMinutes: 2,
    tips: [
      'robots.txt חייב להיות בתיקיית השורש (root) בדיוק',
      'אל תחסימו את /wp-content/uploads/ כי שם מאוחסנות התמונות שלכם',
      'Googlebot וBingbot בדרך כלל מתעלמים מ-robots.txt אך עוזר עבור crawlers קטנים',
      'בדקו בסדר יומי שאף עמוד חשוב לא חסום בטעות',
      'ודאו שכל disallow מתחיל בslash (/)'
    ],
    resources: [
      { title: 'Google Search Central - Robots.txt', url: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro' },
      { title: 'Robots.txt - Complete Guide', url: 'https://www.robotstxt.org/' }
    ]
  },

  canonical_tags: {
    taskType: 'canonical_tags',
    title: 'ביקורת Canonical Tags ומבנה URL',
    steps: [
      'בדקו את כל ה-URLs בפרמטרים לדוגמא (utm_source, utm_medium)',
      'זהו עמודים שעשויים להיות דופליקטים (קטגוריה עם עמודים מרובים)',
      'בכל עמוד, הוספו canonical tag המצביע לעמוד ה"מקור"',
      'בדקו ש-canonical תמיד מצביע לעמוד HTTPS (לא HTTP)',
      'ודאו שכל עמוד מצביע לעצמו או לגרסה המועדפת של עצמו',
      'בואו ב-Search Console וודאו שאין בעיות canonical שגויות',
      'בדקו sites: בחיפוש Google כדי לוודא שמופיע רק ה-canonical'
    ],
    codeSnippet: '<link rel="canonical" href="https://www.example.com/page/" />',
    snippetLanguage: 'html',
    autoExecutable: true,
    automationDescription: 'מערכת בודקת canonical tags בכל עמוד, משנה canonical לגרסה עדיפה, וודאה עדכון זמני cache',
    manualMinutes: 60,
    autoMinutes: 10,
    tips: [
      'כל עמוד צריך להיות עם canonical, גם אם הוא מצביע על עצמו',
      'canonical תמיד צריך להיות absolute URL (כולל https://www)',
      'אל תשתמשו ב-canonical כדי להפנות לעמוד שונה לחלוטין - זה למקרים של duplicate content בלבד',
      'בדקו שאין chain של canonicals (דף A→B, דף B→C)',
      'בדקו שלא יש canonical מחוץ לאתר (external canonical עלול להיות בעיה)'
    ],
    resources: [
      { title: 'Google Search Central - Canonical Tags', url: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls' },
      { title: 'SEMrush - Canonical URL Guide', url: 'https://www.semrush.com/blog/canonical-url/' }
    ]
  },

  heading_structure: {
    taskType: 'heading_structure',
    title: 'תיקון מבנה כותרים H1-H3',
    steps: [
      'פתחו כל עמוד בעורך WordPress (Visual Editor)',
      'בדקו שיש בדיוק H1 אחד בעמוד (בדרך כלל זה כותרת העמוד הראשית)',
      'הנחו את המילה הראשית בתוך ה-H1 (אבל לא בתור כל התוכן)',
      'הוסיפו H2s לסעיפים עיקריים של התוכן',
      'הוסיפו H3s לתת-סעיפים תחת כל H2',
      'ודאו שיש הדרגתיות לוגית (אל תדלגו מ-H1 ישר ל-H3)',
      'הסירו כל H4s, H5s אם אינם נחוצים (שמרו על פשטות)',
      'בדקו ב-Yoast SEO שמבנה הכותרים תקין',
      'שמרו את הדף'
    ],
    codeSnippet: '<h1>כותרת הדף הראשית - מילה ראשית</h1>\n<p>פיסקה מבוא...</p>\n<h2>סעיף עיקרי 1</h2>\n<p>תוכן...</p>\n<h3>תת-סעיף 1.1</h3>\n<p>תוכן...</p>\n<h2>סעיף עיקרי 2</h2>\n<p>תוכן...</p>',
    snippetLanguage: 'html',
    autoExecutable: true,
    automationDescription: 'מערכת בודקת מבנה כותרים, מתקנת H1 כפול (משאירה רק אחד), ומוודאת הדרגתיות לוגית בין כותרים',
    manualMinutes: 35,
    autoMinutes: 5,
    tips: [
      'H1 צריך להיות כותרת דף ראשית וחד-ערכית בעמוד',
      'כל עמוד צריך בדיוק H1 אחד בלבד',
      'אל תשתמשו בכותרים רק לעיצוב חזותי - השתמשו בה-tags בעורך',
      'מבנה הכותרים צריך לעקוב אחרי הלוגיקה של התוכן',
      'בדקו שכל H2 וH3 קשורים בעברית - עברית מזמינה מבנה ברור'
    ],
    resources: [
      { title: 'Google Search Central - Heading Tags', url: 'https://developers.google.com/search/docs/appearance/headings' },
      { title: 'W3C - HTML Headings', url: 'https://www.w3.org/WAI/tutorials/page-structure/headings/' }
    ]
  },

  schema_markup: {
    taskType: 'schema_markup',
    title: 'הוספת נתונים מובנים Schema',
    steps: [
      'בחרו את סוג ה-schema המתאים (LocalBusiness, FAQ, BreadcrumbList)',
      'כנסו ל-WordPress בעורך Yoast SEO או קוד ישירות',
      'הוסיפו את ה-JSON-LD code בתוך <head> או בעורך',
      'מלאו את כל הנתונים בנוגע לעסק (שם, כתובת, טלפון, שעות פתיחה)',
      'לעמודי FAQ: הוסיפו שאלות ותשובות בפורמט Schema',
      'בדקו את ה-schema ב-Google Rich Results Test',
      'ודאו שאין שגיאות ב-validation',
      'שמרו את הדף'
    ],
    codeSnippet: '{\n  "@context": "https://schema.org",\n  "@type": "LocalBusiness",\n  "name": "שם העסק שלך",\n  "image": "https://example.com/logo.png",\n  "description": "תיאור העסק",\n  "address": {\n    "@type": "PostalAddress",\n    "streetAddress": "רחוב 123",\n    "addressLocality": "תל אביב",\n    "postalCode": "67890",\n    "addressCountry": "IL"\n  },\n  "telephone": "+972-1-123-4567",\n  "url": "https://example.com",\n  "openingHoursSpecification": [\n    {\n      "@type": "OpeningHoursSpecification",\n      "dayOfWeek": "Monday",\n      "opens": "09:00",\n      "closes": "17:00"\n    }\n  ],\n  "sameAs": [\n    "https://www.facebook.com/example",\n    "https://www.instagram.com/example"\n  ]\n}',
    snippetLanguage: 'json',
    autoExecutable: true,
    automationDescription: 'מערכת מוסיפה LocalBusiness schema אוטומטי עם פרטי העסק מחורבן WordPress, ומעדכנת FAQ schema לעמודים בקטגוריה FAQ',
    manualMinutes: 50,
    autoMinutes: 8,
    tips: [
      'בדקו שכל תאריך ושעה בפורמט ISO 8601 (למשל 09:00)',
      'הוסיפו תמונה של לוגו בגודל לפחות 200x200 pixels',
      'כלול מספר טלפון בפורמט בינלאומי (+972...)',
      'בדקו ב-Google Rich Results Test כדי לוודא parsing נכון',
      'Schema מובנה משפר את הצגת התוצאות ב-Google'
    ],
    resources: [
      { title: 'Google Rich Results Test', url: 'https://search.google.com/test/rich-results' },
      { title: 'Schema.org - LocalBusiness', url: 'https://schema.org/LocalBusiness' },
      { title: 'JSON-LD Guide for SEO', url: 'https://www.schema.org/docs/jsonldcontext.json' }
    ]
  },

  image_optimization: {
    taskType: 'image_optimization',
    title: 'אופטימיזציית תמונות',
    steps: [
      'בדקו את גודל כל תמונה באתר (גדול מ-500KB? צריך דחיסה)',
      'קמצו תמונות עם כלים כמו TinyPNG או ImageOptim',
      'הוסיפו alt text דו"חי לכל תמונה בעורך WordPress',
      'הוסיפו שמות קבצים בעברית או אנגלית תיאוריים (לא "image-123.jpg")',
      'רודפו אחרי WebP format (WordPress plugins עוזרים)',
      'הוסיפו lazy loading לתמונות נמוכות בדף (loading="lazy")',
      'בדקו responsive images (srcset) לתמונות גדולות',
      'בדקו מהירות דף ב-PageSpeed Insights אחרי עריכות'
    ],
    codeSnippet: '<img\n  src="https://example.com/product.jpg"\n  alt="תיאור קצר של התמונה"\n  loading="lazy"\n  srcset="product-small.jpg 480w, product-medium.jpg 768w, product-large.jpg 1200w"\n  sizes="(max-width: 480px) 480px, (max-width: 768px) 768px, 1200px"\n  width="1200"\n  height="800"\n/>',
    snippetLanguage: 'html',
    autoExecutable: false,
    automationDescription: 'ניתן לאוטומציה: הוספת alt text אוטומטית (דקדוק בעברית), דחיסה אוטומטית, מרת WebP',
    manualMinutes: 90,
    autoMinutes: 0,
    tips: [
      'Alt text צריך להיות קצר ותיאורי - לא יותר מ-120 תווים',
      'אל תכניסו "תמונה של" או "תמונה" בעצמה בalt text',
      'WebP יכול להקטין גודל תמונה עד 25% לעומת JPG',
      'lazy loading=lazy משפר מהירות דף במיוחד לעמודים עם תמונות הרבה',
      'צפו לשינויים במהירות דף בעד 30% אחרי אופטימיזציית תמונות'
    ],
    resources: [
      { title: 'Google PageSpeed Insights', url: 'https://pagespeed.web.dev/' },
      { title: 'TinyPNG - Image Compression', url: 'https://tinypng.com/' },
      { title: 'MDN - Responsive Images', url: 'https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images' }
    ]
  },

  internal_linking: {
    taskType: 'internal_linking',
    title: 'בניית קישורים פנימיים',
    steps: [
      'זהו עמודי "hub" מרכזיים בקטגוריה (דוגמא: "שירותים" או "סעיפי עזרה")',
      'בנו תבנית linking: hub pages → עמודי ביניים → עמודי מוצר/שירות',
      'כתבו anchor text תיאורי ובעברית ברורה (לא "לחצו כאן")',
      'קישרו עמודים קשורים זה לזה בתוך תוכן הטקסט',
      'בדקו שלא יש יותר מ-5-6 קישורים פנימיים בעמוד בודד',
      'בנו breadcrumb navigation בחלק העליון של כל עמוד',
      'בדקו ב-SEMrush או Ahrefs את המבנה הפנימי',
      'שדרגו hub pages עם קישורים מעמודים רבים'
    ],
    codeSnippet: '<a href="https://example.com/services/" title="כל השירותים שלנו">שירותים עיקריים</a>\n\n<!-- Breadcrumb Navigation -->\n<nav aria-label="Breadcrumb">\n  <ol>\n    <li><a href="/">בית</a></li>\n    <li><a href="/services/">שירותים</a></li>\n    <li aria-current="page">שירות ספציפי</li>\n  </ol>\n</nav>',
    snippetLanguage: 'html',
    autoExecutable: false,
    automationDescription: 'ניתן לחלקית: בנית breadcrumb אוטומטית בהתאם לקטגוריות, הצעות קישורים קשורים אוטומטיות',
    manualMinutes: 75,
    autoMinutes: 0,
    tips: [
      'anchor text חייב להיות תיאורי ולא "לחצו כאן" או "עוד"',
      'קישרו כל עמוד לפחות משתי עמודים אחרים',
      'בנו עץ תוכן ברור: קטגוריה → עמוד → שירות/מוצר',
      'בדקו שאין "silos" מלאכותיים - אתר צריך להיות רשת מחוברת',
      'בדקו ב-Google Analytics באיזה עמודים יש הכי הרבה קליקים פנימיים'
    ],
    resources: [
      { title: 'Moz - Internal Linking', url: 'https://moz.com/learn/seo/internal-link' },
      { title: 'Yoast - Internal Linking Guide', url: 'https://yoast.com/internal-linking-seo/' }
    ]
  },

  content_gap: {
    taskType: 'content_gap',
    title: 'סגירת פערי תוכן',
    steps: [
      'ערכו research של מילים חיוביות המתייחסות לעסק (דוגמא: "עסקים בתל אביב")',
      'בדקו ב-Google Search Console: באילו שאלות יש "impressions" אבל מעט "clicks"?',
      'בדקו עמודים מתחרים (top 5 בתוצאות חיפוש) - מה הם מכסים שאתם לא?',
      'זהו נושאים שחסרים באתר (content gaps)',
      'כתבו תוכן חדש או עדכנו תוכן קיים כדי לכסות נושאים אלה',
      'הוסיפו תוכן עם טבעיות - אל תכנסו מילים חיוביות בכוח',
      'קישרו תוכן חדש לעמודים קיימים',
      'בדקו בחודש בחודש באיזה נושאים נחסר תוכן'
    ],
    codeSnippet: '',
    snippetLanguage: undefined,
    autoExecutable: false,
    automationDescription: '',
    manualMinutes: 120,
    autoMinutes: 0,
    tips: [
      'השתמשו בגוגל Search Console כדי לבדוק מילים חיוביות עם CTR נמוך',
      'צפו בחיפושים "long tail" - אלה קלים יותר לדרוג עליהם',
      'צרו מטריקס: מילה חיובית → נושא → האם יש תוכן לנושא זה?',
      'עדיפו כתיבת תוכן חדש על פני עדכון תוכן קיים (כשיש הבדל משמעותי)',
      'בדקו ב-SEMrush keyword gap נגד מתחרים'
    ],
    resources: [
      { title: 'Google Search Console - Performance Report', url: 'https://support.google.com/webmasters/answer/9366651' },
      { title: 'Ahrefs - Content Gap Analysis', url: 'https://ahrefs.com/blog/content-gap/' },
      { title: 'SEMrush - Keyword Gap Tool', url: 'https://www.semrush.com/features/keyword-gap/' }
    ]
  },

  site_speed: {
    taskType: 'site_speed',
    title: 'שיפור מהירות אתר',
    steps: [
      'בדקו מהירות בחזית עם Google PageSpeed Insights',
      'הפעילו caching בשרת (בדרך כלל דרך plugin כמו WP Super Cache)',
      'הקטינו התקנות לא נדרשות של JavaScript ו-CSS',
      'שדרגו תמונות (ראו task image_optimization)',
      'בדקו שTheme לא כבד מדי (בחרו theme קל)',
      'השתמשו ב-CDN (Content Delivery Network) כדי להגיש תמונות וקבצים',
      'הוסיפו caching headers ב-.htaccess (ראו קוד מטה)',
      'בדקו ב-GTmetrix או Lighthouse שזמן טעינה הוקטן'
    ],
    codeSnippet: '# Enable GZIP Compression\n<IfModule mod_deflate.c>\n  AddOutputFilterByType DEFLATE text/plain\n  AddOutputFilterByType DEFLATE text/html\n  AddOutputFilterByType DEFLATE text/xml\n  AddOutputFilterByType DEFLATE text/css\n  AddOutputFilterByType DEFLATE text/javascript\n  AddOutputFilterByType DEFLATE application/xml\n  AddOutputFilterByType DEFLATE application/xhtml+xml\n  AddOutputFilterByType DEFLATE application/rss+xml\n  AddOutputFilterByType DEFLATE application/javascript\n  AddOutputFilterByType DEFLATE application/x-javascript\n</IfModule>\n\n# Browser Caching\n<IfModule mod_expires.c>\n  ExpiresActive On\n  ExpiresByType image/jpeg "access plus 1 year"\n  ExpiresByType image/gif "access plus 1 year"\n  ExpiresByType image/png "access plus 1 year"\n  ExpiresByType text/css "access plus 1 month"\n  ExpiresByType text/javascript "access plus 1 month"\n  ExpiresByType application/javascript "access plus 1 month"\n  ExpiresDefault "access plus 2 days"\n</IfModule>',
    snippetLanguage: 'htaccess',
    autoExecutable: false,
    automationDescription: 'ניתן לחלקית: הפעלת caching אוטומטית, GZIP compression, CDN integration',
    manualMinutes: 120,
    autoMinutes: 0,
    tips: [
      'מהירות עמודים משפיעה על র"צ Google - עדיפות גבוהה',
      'תוקפו תחילה את התמונות (בדרך כלל הם הגורם הגדול ביותר)',
      'דחיסת GZIP יכולה להקטין גודל HTML עד 70%',
      'בדקו browser caching - תור צפיית קבצים (CSS, JS) מחודשת',
      'שימו לב ל-Core Web Vitals: LCP, FID, CLS'
    ],
    resources: [
      { title: 'Google PageSpeed Insights', url: 'https://pagespeed.web.dev/' },
      { title: 'GTmetrix - Speed Testing', url: 'https://gtmetrix.com/' },
      { title: 'WordPress Speed Optimization Guide', url: 'https://wordpress.org/support/article/optimization/' }
    ]
  },

  mobile_optimization: {
    taskType: 'mobile_optimization',
    title: 'אופטימיזציה לנייד',
    steps: [
      'בדקו את האתר בטלפון (iPhone ו-Android)',
      'וודאו שה-viewport meta tag נוסף (בדרך כלל יש בכל WordPress)',
      'בדקו שכל הכפתורים קליקים קלים (לפחות 48x48 pixels)',
      'בדקו שהטקסט קראוק ובגודל הולם (לא קטן מדי)',
      'בדקו שאין horizontal scroll בנייד',
      'השתמשו ב-Google Mobile-Friendly Test',
      'וודאו שzoom אפשרית אבל לא חובה בטופס',
      'בדקו ב-Google Search Console עבור "Mobile Usability" issues'
    ],
    codeSnippet: '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">\n\n/* CSS Media Query Example */\n@media (max-width: 768px) {\n  body {\n    font-size: 16px;\n  }\n  button, a {\n    padding: 12px 16px;\n    min-height: 48px;\n  }\n  .container {\n    padding: 16px;\n  }\n}',
    snippetLanguage: 'html',
    autoExecutable: false,
    automationDescription: 'ניתן לחלקית: בדיקה אוטומטית של viewport, סימון אזהרות עבור touch target size קטן',
    manualMinutes: 45,
    autoMinutes: 0,
    tips: [
      'Viewport tag חייב להיות בכל עמוד',
      'כפתורים צריכים להיות לפחות 48x48px עם padding מסביב',
      'טקסט בנייד צריך להיות לפחות 16px',
      'תעדיפו design mobile-first - זה קל יותר להרחיב לדסקטופ',
      'בדקו ב-Chrome DevTools ב"Device Mode" - זה חיוני לבדיקה'
    ],
    resources: [
      { title: 'Google Mobile-Friendly Test', url: 'https://search.google.com/test/mobile-friendly' },
      { title: 'Google Search Central - Mobile SEO', url: 'https://developers.google.com/search/mobile-sites' },
      { title: 'MDN - Responsive Design', url: 'https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design' }
    ]
  },

  xml_sitemap: {
    taskType: 'xml_sitemap',
    title: 'יצירת XML Sitemap',
    steps: [
      'בדקו שיש לכם plugin SEO מותקן (Yoast SEO או Rank Math)',
      'כנסו לתפריט ה-SEO plugin ובחרו ב"XML Sitemap"',
      'הפעילו את יצירת ה-sitemap אוטומטית',
      'סימנו "Include posts" ו"Include pages"',
      'בחרו ב"Include images" אם יש תמונות רבות',
      'סימנו "Include archives" עבור blog posts',
      'שמרו את ההגדרות',
      'בדקו שה-sitemap נגיש בכתובת https://example.com/sitemap.xml',
      'הוסיפו את ה-sitemap ב-Google Search Console',
      'הוסיפו את ה-sitemap ב-Robots.txt (Disallow: ...)'
    ],
    codeSnippet: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/page-1/</loc>\n    <lastmod>2024-05-01</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://example.com/page-2/</loc>\n    <lastmod>2024-04-25</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n</urlset>',
    snippetLanguage: 'xml',
    autoExecutable: true,
    automationDescription: 'מערכת יוצרת ומעדכנת XML Sitemap אוטומטית כל שעה, מוסיפה עמודים חדשים ומעדכנים lastmod dates',
    manualMinutes: 20,
    autoMinutes: 2,
    tips: [
      'Sitemap.xml יוצא אוטומטי עם כל plugin SEO אם הוא מופעל',
      'בדקו שyoast וRank Math מופעלים כראוי - לא תמיד ברירת המחדל',
      'עדכנו את ה-priority רק אם יש דף שחשוב יותר משאר (לרוב אל תשנו)',
      'בדקו שכל URL בסיטמפ קיים בגלישה (אל תוסיפו URLים בעיות)',
      'סיטמפ.xml צריך להיות accessible אנציקלופדיה - אין סיסוד'
    ],
    resources: [
      { title: 'Google Sitemaps Documentation', url: 'https://www.sitemaps.org/' },
      { title: 'Google Search Console - Sitemap Submission', url: 'https://support.google.com/webmasters/answer/183669' },
      { title: 'Yoast SEO - XML Sitemap', url: 'https://yoast.com/xml-sitemap/' }
    ]
  },

  ssl_https: {
    taskType: 'ssl_https',
    title: 'בדיקת HTTPS ואבטחה',
    steps: [
      'בדקו שיש לכם SSL certificate (בדרך כלל מהשרת)',
      'כנסו למערכת הניהול של WordPress',
      'עדכנו את Home URL ו-Site URL להתחיל ב"https://" (לא "http://")',
      'הוסיפו בקובץ .htaccess כללי הפניה מ-HTTP ל-HTTPS',
      'הפעילו HSTS header בקובץ .htaccess',
      'בדקו שאין "mixed content" (תוכן HTTP בעמודים HTTPS)',
      'בדקו ב-SSL Checker שה-certificate תקין',
      'בדקו ב-Google Search Console שאין אזהרות אבטחה',
      'זמנו בצורה חוזרת כדי לוודא שלא חזרתם ל-HTTP'
    ],
    codeSnippet: '# Force HTTPS\n<IfModule mod_rewrite.c>\n  RewriteEngine On\n  RewriteCond %{HTTPS} off\n  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\nRewriteCond %{HTTP_HOST} ^www\\.(.*) [NC]\nRewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\n</IfModule>\n\n# Add HSTS Header\n<IfModule mod_headers.c>\n  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"\n</IfModule>\n\n# Disable Directory Listing\nOptions -Indexes',
    snippetLanguage: 'htaccess',
    autoExecutable: false,
    automationDescription: 'ניתן לחלקית: הוספת HTTPS redirect אוטומטית, בדיקת mixed content אוטומטית',
    manualMinutes: 40,
    autoMinutes: 0,
    tips: [
      'HTTPS הוא חובה לכל אתר - Google תדרג יותר טוב אתרים עם HTTPS',
      'SSL certificate צריך להיות valid (בדקו את תוקף)',
      'אל תשכחו לעדכן כתובות בתוך טפסים ו-plugins',
      'בדקו mixed content עם Chrome DevTools (Console tab)',
      'HSTS header מונע מהדפדפן לחזור ל-HTTP'
    ],
    resources: [
      { title: 'Let\'s Encrypt - Free SSL Certificates', url: 'https://letsencrypt.org/' },
      { title: 'Qualys SSL Server Test', url: 'https://www.ssllabs.com/ssltest/' },
      { title: 'Google Security Blog - HTTPS Everywhere', url: 'https://security.googleblog.com/' }
    ]
  },

  google_business: {
    taskType: 'google_business',
    title: 'אופטימיזציית Google Business Profile',
    steps: [
      'כנסו ל-Google Business Profile (business.google.com)',
      'מלאו את כל הפרטים: שם עסק, כתובת מלאה, טלפון, שעות פתיחה',
      'הוסיפו תמונת לוגו בגודל תקין (500x500px כ-minimum)',
      'הוסיפו 3-5 תמונות של המוצרים/שירותים שלכם',
      'כתבו תיאור של העסק (120-160 תווים בעברית)',
      'הוסיפו 2-3 קטגוריות רלוונטיות',
      'בקשו מלקוחות להשאיר ביקורות (reviews)',
      'ענו על כל הביקורות תוך 24-48 שעות',
      'עדכנו שעות פתיחה מיוחדות (holiday hours)',
      'בדקו שהעסק מופיע בגוגל מפות'
    ],
    codeSnippet: '',
    snippetLanguage: undefined,
    autoExecutable: false,
    automationDescription: '',
    manualMinutes: 90,
    autoMinutes: 0,
    tips: [
      'Google Business Profile משפיע גדול על local SEO',
      'תמונות באיכות גבוהה מעלות ביקורים ממפות גוגל',
      'שעות פתיחה צריכות להיות מדויקות - עדכנו מיד כשמשתנות',
      'ענו אדיבות על כל ביקורת (גם שליליות)',
      'עדיפו ביקורות חדשות - הן משפיעות יותר על דירוג'
    ],
    resources: [
      { title: 'Google Business Profile Help Center', url: 'https://support.google.com/business/answer/3038063' },
      { title: 'Google Maps Optimization Guide', url: 'https://www.google.com/business/' },
      { title: 'Local SEO Best Practices', url: 'https://moz.com/local-seo' }
    ]
  },

  faq_section: {
    taskType: 'faq_section',
    title: 'יצירת סעיף שאלות נפוצות FAQ',
    steps: [
      'ערכו research של שאלות נפוצות שלקוחות שואלים',
      'בדקו ב-Google Search Console "Queries" עבור שאלות (מילים עם "איך", "מה", "למה")',
      'רשמו 5-10 שאלות והתשובות בעברית טבעית',
      'צרו עמוד חדש או סעיף בעמוד הנוכחי עבור FAQ',
      'כתבו כל שאלה כ-H3 (או Accordion element)',
      'כתבו תשובות ברורות וקצרות (מספר פסקאות)',
      'הוסיפו schema markup (JSON-LD) עבור FAQ',
      'בדקו ב-Google Rich Results Test שה-schema נקרא נכון',
      'בדקו אחרי שבוע אם FAQ מופיע בתוצאות חיפוש'
    ],
    codeSnippet: '{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    {\n      "@type": "Question",\n      "name": "מה הוא עיקרון ה-SEO?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "SEO (Search Engine Optimization) הוא תהליך שיפור אתר כדי לדרוג גבוה יותר בתוצאות חיפוש של Google."\n      }\n    },\n    {\n      "@type": "Question",\n      "name": "כמה זמן לוקח לראות תוצאות SEO?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "בדרך כלל, תוצאות SEO ניתן לראות בתוך 3-6 חודשים, בהתאם לתחרות בתעשייה."\n      }\n    }\n  ]\n}',
    snippetLanguage: 'json',
    autoExecutable: true,
    automationDescription: 'מערכת מוסיפה FAQ schema JSON-LD אוטומטי עבור כל Q&A section, מעדכנת את ה-schema כשמוסיפים שאלות חדשות',
    manualMinutes: 60,
    autoMinutes: 5,
    tips: [
      'FAQ עמודים יכולים להופיע בחיפוש גוגל כ"People also ask" סעיפים',
      'כתבו שאלות בדיוק כמו שאנשים שואלים (טבעי, לא בעברית ספרותית)',
      'תשובות צריכות להיות קצרות (עד 2-3 פסקאות)',
      'אל תעשו אפופ של מוצר בתשובות FAQ - זה יהיה ברור ולא טוב',
      'עדכנו את FAQ כל 3 חודשים עם שאלות חדשות'
    ],
    resources: [
      { title: 'Google FAQ Schema Documentation', url: 'https://developers.google.com/search/docs/appearance/faq-rich-result' },
      { title: 'Answer the Public - Find People\'s Questions', url: 'https://answerthepublic.com/' },
      { title: 'Google Search Console - Performance Report', url: 'https://support.google.com/webmasters/answer/9366651' }
    ]
  },

  backlink_strategy: {
    taskType: 'backlink_strategy',
    title: 'אסטרטגיית קישורים חוזרים',
    steps: [
      'ערכו audit של קישורים חוזרים הנוכחיים (Ahrefs, SEMrush)',
      'זהו דומיינים בעברית וקטגוריות תעשייתיות',
      'כתבו תוכן guest post איכותי (1500+ מילים בעברית)',
      'יצרו רשימת אתרים רלוונטיים וקבלו contact information',
      'שלחו pitch מהודר לעורכים (בעברית טבעית)',
      'שנו את ה-guest post בהתאם לעדכונים של האתר',
      'ודאו שהקישור חוזר נוסף באתר אחרי פרסום',
      'בקשו מדוריכים רלוונטיים (משפחה, חברים, עסקיים)',
      'עקבו אחרי קישורים חדשים בחודש'
    ],
    codeSnippet: '',
    snippetLanguage: undefined,
    autoExecutable: false,
    automationDescription: '',
    manualMinutes: 300,
    autoMinutes: 0,
    tips: [
      'קישורים חוזרים מ-high authority sites חשובים יותר מ-hundreds של קישורים חלשים',
      'focus על דומיינים בעברית - הם רלוונטיים יותר לאתר בעברית',
      'guest posts צריכים להיות איכותיים - אל תעשו spam',
      'בנו קישורים בהדרגה (5-10 חודשים) - לא כל בבת אחת',
      'בדקו את domain authority של האתר לפני guest post (DA 30+)'
    ],
    resources: [
      { title: 'Ahrefs Backlink Analysis', url: 'https://ahrefs.com/backlink-checker' },
      { title: 'SEMrush Backlink Analytics', url: 'https://www.semrush.com/analytics/backlinks/' },
      { title: 'Moz - Link Building Guide', url: 'https://moz.com/learn/seo/link-building' }
    ]
  },

  content_refresh: {
    taskType: 'content_refresh',
    title: 'רענון תוכן קיים',
    steps: [
      'זהו עמודים שדורגו בעבר אבל עכשיו יורדים (Google Analytics)',
      'בדקו בחיפוש הגוגל לראות עמודים מתחרים חדשים',
      'קראו את התוכן הנוכחי שלכם וזהו תוכן שנשמר או שגוי',
      'הוסיפו סעיפים חדשים עם טרנדים אחרונים או טיפים חדשים',
      'עדכנו תמונות (הוסיפו infographics או תמונות חדשות)',
      'שדרגו את הstructure (h2s, h3s לפי בחירה)',
      'הוסיפו קישורים פנימיים לעמודים חדשים',
      'בדקו את עדכוני הגוגל (Search Console) לראות הוטלה יוצאת משדרוג זה'
    ],
    codeSnippet: '',
    snippetLanguage: undefined,
    autoExecutable: false,
    automationDescription: '',
    manualMinutes: 90,
    autoMinutes: 0,
    tips: [
      'עמודים שיורדים בדרוג בדרך כלל צריכים רענון תוכן',
      'לא צריך לכתוב מחדש כל דבר - עדכנו סעיפים ספציפיים',
      'הוסיפו 20-30% תוכן חדש לעמוד קיים',
      'תמונות חדשות עוזרות לעמוד להראות עדכני ורלוונטי',
      'בדקו audience engagement אחרי רענון (מספר מעלות, צפיות)'
    ],
    resources: [
      { title: 'HubSpot - Content Refresh Guide', url: 'https://www.hubspot.com/content-refresh' },
      { title: 'Yoast - Content Optimization', url: 'https://yoast.com/content-seo/' },
      { title: 'Google Search Central - Freshness Algorithm', url: 'https://developers.google.com/search/docs/appearance/freshness' }
    ]
  },

  crawl_directives: {
    taskType: 'crawl_directives',
    title: 'הגדרת Crawl Directives',
    steps: [
      'זהו עמודים שלא צריכים להיות בתוצאות חיפוש (admin, login, search results)',
      'בדקו באתר "Yoast SEO" ובחרו "Advanced" בכל עמוד',
      'הוסיפו "noindex" לעמודים שלא צריכים בתוצאות חיפוש',
      'הוסיפו "nofollow" לקישורים שלא צריכים להעביר סמכות (affiliate, untrusted)',
      'בדקו שעמודי admin לא מופיעים בחיפוש (צריכים noindex)',
      'בדקו שדפי search results מסומנים כ"noindex"',
      'עדכנו את Robots.txt עם Disallow: אותם עמודים',
      'בדקו ב-Google Search Console ודאו שלא בחיפוש'
    ],
    codeSnippet: '<!-- noindex meta tag -->\n<meta name="robots" content="noindex, nofollow" />\n\n<!-- noindex + follow (index) -->\n<meta name="robots" content="index, nofollow" />\n\n<!-- nofollow link -->\n<a href="https://example.com/affiliate" rel="nofollow">Affiliate Link</a>\n\n<!-- sponsored link -->\n<a href="https://example.com/ad" rel="sponsored">Sponsored Link</a>\n\n<!-- ugc link (user generated content) -->\n<a href="https://example.com/comment" rel="ugc">User Comment</a>',
    snippetLanguage: 'html',
    autoExecutable: true,
    automationDescription: 'מערכת מוסיפה noindex אוטומטי לעמודי admin, search, login וארכיונים ישנים, מעדכנת meta robots tags',
    manualMinutes: 30,
    autoMinutes: 3,
    tips: [
      'noindex אומר לגוגל לא לאינדקס עמוד, אבל crawlers עדיין יכולים להגיע אליו',
      'nofollow אומר לגוגל לא להעביר authority דרך קישור',
      'pages of admin/wp-admin צריכים להיות מחסומים ברובטס.txt וב-noindex',
      'affiliate links יכולים להיות sponsored או nofollow (לא אחד מהם לא)',
      'בדקו ב-Google Search Console שעמודים עם noindex לא מופיעים בפתוצאות'
    ],
    resources: [
      { title: 'Google Search Central - Robots Meta Tag', url: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag' },
      { title: 'Google Search Central - Noindex Guide', url: 'https://developers.google.com/search/docs/crawling-indexing/block-indexing' },
      { title: 'Moz - Noindex, Nofollow Guide', url: 'https://moz.com/learn/seo/robots-meta-tag' }
    ]
  }
};

/**
 * Match a Hebrew task title to a TaskGuide using fuzzy keyword matching
 * Examples:
 * - "כתוב Meta Titles ייחודיים עבור 5 עמודים" → meta_titles
 * - "יצירת Robots.txt עם Crawl Directives" → robots_txt
 * - "תיקון מבנה כותרים H1-H3 בכל עמודים" → heading_structure
 */
export function getGuideForTask(taskTitle: string): TaskGuide | null {
  if (!taskTitle || typeof taskTitle !== 'string') {
    return null;
  }

  const taskTitleLower = taskTitle.toLowerCase().trim();

  // Create keyword patterns for fuzzy matching
  const patterns: Array<{
    keywords: string[];
    taskType: keyof typeof TASK_GUIDES;
  }> = [
    {
      keywords: ['meta titles', 'titles', 'title tags', 'כותרת'],
      taskType: 'meta_titles'
    },
    {
      keywords: ['meta description', 'description', 'descriptions', 'תיאור'],
      taskType: 'meta_descriptions'
    },
    {
      keywords: ['robots.txt', 'robots', 'crawl'],
      taskType: 'robots_txt'
    },
    {
      keywords: ['canonical', 'canonical tags', 'url structure'],
      taskType: 'canonical_tags'
    },
    {
      keywords: ['heading', 'h1', 'h2', 'h3', 'כותרים', 'כותרות'],
      taskType: 'heading_structure'
    },
    {
      keywords: ['schema', 'schema markup', 'structured data', 'json-ld'],
      taskType: 'schema_markup'
    },
    {
      keywords: ['image', 'optimization', 'images', 'תמונות'],
      taskType: 'image_optimization'
    },
    {
      keywords: ['internal', 'internal linking', 'links', 'קישורים'],
      taskType: 'internal_linking'
    },
    {
      keywords: ['content gap', 'gap', 'פערים'],
      taskType: 'content_gap'
    },
    {
      keywords: ['speed', 'performance', 'מהירות'],
      taskType: 'site_speed'
    },
    {
      keywords: ['mobile', 'responsive', 'נייד'],
      taskType: 'mobile_optimization'
    },
    {
      keywords: ['sitemap', 'xml', 'סיטמפ'],
      taskType: 'xml_sitemap'
    },
    {
      keywords: ['https', 'ssl', 'certificate', 'secure', 'אבטחה'],
      taskType: 'ssl_https'
    },
    {
      keywords: ['google business', 'business profile', 'local', 'עסק'],
      taskType: 'google_business'
    },
    {
      keywords: ['faq', 'questions', 'q&a', 'שאלות'],
      taskType: 'faq_section'
    },
    {
      keywords: ['backlink', 'links', 'link building', 'guest post'],
      taskType: 'backlink_strategy'
    },
    {
      keywords: ['refresh', 'update', 'content', 'רענון'],
      taskType: 'content_refresh'
    },
    {
      keywords: ['crawl', 'directive', 'noindex', 'nofollow', 'robots'],
      taskType: 'crawl_directives'
    }
  ];

  // Try to match keywords in the task title
  for (const pattern of patterns) {
    for (const keyword of pattern.keywords) {
      if (taskTitleLower.includes(keyword.toLowerCase())) {
        return TASK_GUIDES[pattern.taskType] || null;
      }
    }
  }

  return null;
}
