// WordPress Content Inventory Service
// שירות מלאי תוכן וורדפרס — בסיס נתונים לכל מנועי האוטומציה
// סורק את כל הדפים והפוסטים ובונה תמונת מצב מלאה של האתר

import { WPConnection, getPages, getPosts, WPPage, extractJsonLd } from './wordpress-client';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface ContentItem {
  id: number;
  type: 'page' | 'post';
  title: string;
  slug: string;
  url: string;
  content: string;              // raw HTML
  plainText: string;            // stripped text
  wordCount: number;
  headings: { tag: string; text: string }[];
  h1Count: number;
  h2Count: number;
  h3Count: number;
  images: ImageInfo[];
  internalLinks: LinkInfo[];
  externalLinks: LinkInfo[];
  hasSchema: boolean;
  schemaTypes: string[];        // e.g. ['LocalBusiness', 'Article', 'FAQPage']
  hasFAQ: boolean;
  yoastMeta: {
    title: string;
    description: string;
    canonical: string;
    focusKeyword: string;
  };
  hasCTA: boolean;
  ctaTypes: string[];           // ['whatsapp', 'phone', 'form', 'email']
  estimatedReadTime: number;    // minutes
  lastModified?: string;
  categories?: string[];
  tags?: string[];
}

export interface ImageInfo {
  src: string;
  alt: string;
  title: string;
  hasAlt: boolean;
  hasTitle: boolean;
  isExternal: boolean;
}

export interface LinkInfo {
  href: string;
  anchorText: string;
  isInternal: boolean;
  targetPageId?: number;       // resolved WP page ID if internal
  context: string;             // surrounding text (30 chars each side)
}

export interface ContentInventory {
  items: ContentItem[];
  pages: ContentItem[];
  posts: ContentItem[];
  totalWordCount: number;
  averageWordCount: number;
  thinContentPages: ContentItem[];    // < 300 words
  pagesWithoutSchema: ContentItem[];
  pagesWithoutFAQ: ContentItem[];
  pagesWithoutCTA: ContentItem[];
  orphanPages: ContentItem[];         // no internal links pointing to them
  deadEndPages: ContentItem[];        // no internal links going out
  imagesWithoutAlt: ImageInfo[];
  duplicateMetaTitles: Map<string, ContentItem[]>;
  duplicateMetaDescriptions: Map<string, ContentItem[]>;
  internalLinkMap: Map<number, number[]>;  // pageId → [linked pageIds]
  siteUrl: string;
  scannedAt: string;
}

// ============================================================================
// עוזרים — Helper Functions
// ============================================================================

/**
 * הסרת תגיות HTML מטקסט
 * Strip all HTML tags and decode common entities
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  let text = html;

  // הסר תגיות script ו-style עם תוכנן
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // הסר כל תגיות HTML
  text = text.replace(/<[^>]+>/g, ' ');

  // פענוח entities נפוצים
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#\d+;/g, '');
  text = text.replace(/&[a-zA-Z]+;/g, ' ');

  // נקה רווחים מיותרים
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * חילוץ קישורים מתוכן HTML
 * Extract all links from HTML content, classify internal vs external
 */
export function extractLinksFromContent(content: string, siteUrl: string): LinkInfo[] {
  if (!content) return [];

  const links: LinkInfo[] = [];
  const siteDomain = extractDomain(siteUrl);

  // regex לחילוץ קישורים — anchor tags עם href
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const href = match[1].trim();
    const rawAnchorText = stripHtml(match[2]).trim();

    // דלג על אנקורים ריקים, javascript:, או #
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;

    // בדוק אם קישור פנימי
    const isInternal = isInternalUrl(href, siteDomain, siteUrl);

    // חלץ הקשר — 30 תווים מכל צד
    const matchIndex = match.index;
    const plainContent = stripHtml(content);
    const anchorInPlain = plainContent.indexOf(rawAnchorText);
    let context = '';
    if (anchorInPlain >= 0) {
      const start = Math.max(0, anchorInPlain - 30);
      const end = Math.min(plainContent.length, anchorInPlain + rawAnchorText.length + 30);
      context = plainContent.slice(start, end).trim();
    }

    links.push({
      href,
      anchorText: rawAnchorText || href,
      isInternal,
      context,
    });
  }

  return links;
}

/**
 * חילוץ תמונות מתוכן HTML
 * Extract all images from HTML content
 */
export function extractImagesFromContent(content: string, siteUrl: string): ImageInfo[] {
  if (!content) return [];

  const images: ImageInfo[] = [];
  const siteDomain = extractDomain(siteUrl);

  // regex לחילוץ תגיות img
  const imgRegex = /<img\s+[^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    const imgTag = match[0];

    const src = extractAttribute(imgTag, 'src');
    const alt = extractAttribute(imgTag, 'alt');
    const title = extractAttribute(imgTag, 'title');

    if (!src) continue;

    const isExternal = !isInternalUrl(src, siteDomain, siteUrl);

    images.push({
      src,
      alt,
      title,
      hasAlt: alt.length > 0,
      hasTitle: title.length > 0,
      isExternal,
    });
  }

  return images;
}

/**
 * זיהוי סוגי Schema מתוך JSON-LD בתוכן
 * Detect schema types from JSON-LD in content
 */
export function detectSchemaTypes(content: string): string[] {
  if (!content) return [];

  const schemas = extractJsonLd(content);
  const types: Set<string> = new Set();

  for (const schema of schemas) {
    extractSchemaType(schema, types);
  }

  return Array.from(types);
}

/**
 * זיהוי סוגי CTA בתוכן
 * Detect Call-to-Action types present in content
 */
export function detectCTATypes(content: string): string[] {
  if (!content) return [];

  const ctaTypes: string[] = [];
  const lowerContent = content.toLowerCase();

  // וואטסאפ — WhatsApp links
  if (
    lowerContent.includes('wa.me/') ||
    lowerContent.includes('api.whatsapp.com') ||
    lowerContent.includes('whatsapp.com/send') ||
    lowerContent.includes('whatsapp')
  ) {
    ctaTypes.push('whatsapp');
  }

  // טלפון — Phone links
  if (lowerContent.includes('tel:') || lowerContent.includes('href="tel')) {
    ctaTypes.push('phone');
  }

  // טופס — Form elements
  if (
    lowerContent.includes('<form') ||
    lowerContent.includes('wpforms') ||
    lowerContent.includes('contact-form') ||
    lowerContent.includes('elementor-form') ||
    lowerContent.includes('wpcf7')
  ) {
    ctaTypes.push('form');
  }

  // אימייל — Email links
  if (lowerContent.includes('mailto:')) {
    ctaTypes.push('email');
  }

  return ctaTypes;
}

// ============================================================================
// עוזרים פנימיים — Internal Helpers
// ============================================================================

/**
 * חלץ דומיין מ-URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * בדוק אם URL הוא פנימי (שייך לאותו דומיין)
 */
function isInternalUrl(href: string, siteDomain: string, siteUrl: string): boolean {
  // נתיבים יחסיים הם תמיד פנימיים
  if (href.startsWith('/') && !href.startsWith('//')) return true;

  try {
    const linkDomain = extractDomain(href);
    if (!linkDomain) return true; // relative URL
    return linkDomain === siteDomain || linkDomain === `www.${siteDomain}` || `www.${linkDomain}` === siteDomain;
  } catch {
    return false;
  }
}

/**
 * חלץ attribute מתגית HTML
 */
function extractAttribute(tag: string, attr: string): string {
  const regex = new RegExp(`${attr}=["']([^"']*)["']`, 'i');
  const match = tag.match(regex);
  return match ? match[1] : '';
}

/**
 * חלץ סוגי schema רקורסיבי (כולל @graph)
 */
function extractSchemaType(schema: any, types: Set<string>): void {
  if (!schema || typeof schema !== 'object') return;

  if (schema['@type']) {
    const schemaType = schema['@type'];
    if (Array.isArray(schemaType)) {
      schemaType.forEach((t: string) => types.add(t));
    } else {
      types.add(schemaType);
    }
  }

  // טפל ב-@graph — מערך של schemas
  if (Array.isArray(schema['@graph'])) {
    for (const item of schema['@graph']) {
      extractSchemaType(item, types);
    }
  }
}

/**
 * זיהוי האם יש FAQ בתוכן
 * בודק: FAQ schema, כותרות עם מילות מפתח של שאלות נפוצות
 */
function detectFAQ(content: string, headings: { tag: string; text: string }[], schemaTypes: string[]): boolean {
  // בדוק FAQ schema
  if (schemaTypes.includes('FAQPage')) return true;

  // מילות מפתח לזיהוי FAQ בכותרות
  const faqKeywords = [
    'faq', 'שאלות נפוצות', 'שאלות ותשובות', 'שאלות שנשאלות',
    'frequently asked', 'q&a', 'questions', 'שאלות',
  ];

  for (const heading of headings) {
    const lowerText = heading.text.toLowerCase();
    if (faqKeywords.some(kw => lowerText.includes(kw))) return true;
  }

  // בדוק גם בתוכן — FAQ markup patterns
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('faqpage') || lowerContent.includes('mainentity')) return true;

  return false;
}

/**
 * חישוב זמן קריאה משוער (בדקות)
 * Average reading speed: ~200 words/minute for Hebrew, ~250 for English
 */
function estimateReadTime(wordCount: number): number {
  if (wordCount === 0) return 0;
  return Math.max(1, Math.ceil(wordCount / 220));
}

/**
 * ספור מילים בטקסט
 */
function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  // פיצול על רווחים — תומך גם בעברית וגם באנגלית
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

// ============================================================================
// בניית ContentItem מ-WPPage — Core Builder
// ============================================================================

function buildContentItem(
  wpPage: WPPage,
  type: 'page' | 'post',
  siteUrl: string
): ContentItem {
  const plainText = stripHtml(wpPage.content);
  const wordCount = countWords(plainText);
  const images = extractImagesFromContent(wpPage.content, siteUrl);
  const allLinks = extractLinksFromContent(wpPage.content, siteUrl);
  const internalLinks = allLinks.filter(l => l.isInternal);
  const externalLinks = allLinks.filter(l => !l.isInternal);
  const schemaTypes = detectSchemaTypes(wpPage.content);
  const hasSchema = wpPage.hasSchema || schemaTypes.length > 0;
  const hasFAQ = detectFAQ(wpPage.content, wpPage.headings, schemaTypes);
  const ctaTypes = detectCTATypes(wpPage.content);

  // ספירת כותרות לפי רמה
  const h1Count = wpPage.headings.filter(h => h.tag === 'h1').length;
  const h2Count = wpPage.headings.filter(h => h.tag === 'h2').length;
  const h3Count = wpPage.headings.filter(h => h.tag === 'h3').length;

  // פרסור Yoast meta — עם ערכי ברירת מחדל
  const yoastMeta = {
    title: wpPage.yoastMeta?.title || '',
    description: wpPage.yoastMeta?.description || '',
    canonical: wpPage.yoastMeta?.canonical || '',
    focusKeyword: wpPage.yoastMeta?.focusKeyword || '',
  };

  return {
    id: wpPage.id,
    type,
    title: wpPage.title,
    slug: wpPage.slug,
    url: wpPage.url,
    content: wpPage.content,
    plainText,
    wordCount,
    headings: wpPage.headings,
    h1Count,
    h2Count,
    h3Count,
    images,
    internalLinks,
    externalLinks,
    hasSchema,
    schemaTypes,
    hasFAQ,
    yoastMeta,
    hasCTA: ctaTypes.length > 0,
    ctaTypes,
    estimatedReadTime: estimateReadTime(wordCount),
  };
}

// ============================================================================
// פונקציה ראשית — Main: Build Content Inventory
// ============================================================================

/**
 * בניית מלאי תוכן מלא מאתר וורדפרס
 * שולף את כל הדפים והפוסטים ומנתח כל אחד מהם
 */
export async function buildContentInventory(connection: WPConnection): Promise<ContentInventory> {
  const siteUrl = connection.siteUrl;
  const scannedAt = new Date().toISOString();

  // 1. שלוף דפים ופוסטים במקביל
  const [wpPages, wpPosts] = await Promise.all([
    getPages(connection),
    getPosts(connection),
  ]);

  // 2. בנה ContentItem עבור כל דף ופוסט
  const pages: ContentItem[] = wpPages.map(p => buildContentItem(p, 'page', siteUrl));
  const posts: ContentItem[] = wpPosts.map(p => buildContentItem(p, 'post', siteUrl));
  const items = [...pages, ...posts];

  // 3. בנה מפת URL → pageId לזיהוי קישורים פנימיים
  const urlToIdMap = new Map<string, number>();
  const slugToIdMap = new Map<string, number>();
  for (const item of items) {
    if (item.url) urlToIdMap.set(normalizeUrl(item.url), item.id);
    if (item.slug) slugToIdMap.set(item.slug, item.id);
  }

  // 4. רזולוציית targetPageId לקישורים פנימיים + בניית מפת קישורים
  const internalLinkMap = new Map<number, number[]>();

  for (const item of items) {
    const linkedIds: number[] = [];

    for (const link of item.internalLinks) {
      const targetId = resolveInternalLinkTarget(link.href, siteUrl, urlToIdMap, slugToIdMap);
      if (targetId !== undefined && targetId !== item.id) {
        link.targetPageId = targetId;
        if (!linkedIds.includes(targetId)) {
          linkedIds.push(targetId);
        }
      }
    }

    internalLinkMap.set(item.id, linkedIds);
  }

  // 5. זהה דפים יתומים — אף דף אחר לא מקשר אליהם
  const inboundCounts = new Map<number, number>();
  for (const item of items) {
    inboundCounts.set(item.id, 0);
  }
  for (const [, linkedIds] of internalLinkMap) {
    for (const targetId of linkedIds) {
      inboundCounts.set(targetId, (inboundCounts.get(targetId) || 0) + 1);
    }
  }
  const orphanPages = items.filter(item => (inboundCounts.get(item.id) || 0) === 0);

  // 6. זהה דפים מבוי סתום — אין קישורים פנימיים יוצאים
  const deadEndPages = items.filter(item => {
    const outLinks = internalLinkMap.get(item.id) || [];
    return outLinks.length === 0;
  });

  // 7. תוכן דליל — פחות מ-300 מילים
  const thinContentPages = items.filter(item => item.wordCount < 300);

  // 8. דפים ללא schema, FAQ, CTA
  const pagesWithoutSchema = items.filter(item => !item.hasSchema);
  const pagesWithoutFAQ = items.filter(item => !item.hasFAQ);
  const pagesWithoutCTA = items.filter(item => !item.hasCTA);

  // 9. תמונות ללא alt
  const imagesWithoutAlt: ImageInfo[] = [];
  for (const item of items) {
    for (const img of item.images) {
      if (!img.hasAlt) {
        imagesWithoutAlt.push(img);
      }
    }
  }

  // 10. מצא כותרות meta ותיאורים כפולים
  const duplicateMetaTitles = findDuplicates(items, item => item.yoastMeta.title);
  const duplicateMetaDescriptions = findDuplicates(items, item => item.yoastMeta.description);

  // 11. חשב סטטיסטיקות
  const totalWordCount = items.reduce((sum, item) => sum + item.wordCount, 0);
  const averageWordCount = items.length > 0 ? Math.round(totalWordCount / items.length) : 0;

  return {
    items,
    pages,
    posts,
    totalWordCount,
    averageWordCount,
    thinContentPages,
    pagesWithoutSchema,
    pagesWithoutFAQ,
    pagesWithoutCTA,
    orphanPages,
    deadEndPages,
    imagesWithoutAlt,
    duplicateMetaTitles,
    duplicateMetaDescriptions,
    internalLinkMap,
    siteUrl,
    scannedAt,
  };
}

// ============================================================================
// עוזרים פנימיים לבניית Inventory
// ============================================================================

/**
 * נרמול URL להשוואה — הסר פרוטוקול, www, סלאש בסוף
 */
function normalizeUrl(url: string): string {
  try {
    let normalized = url.toLowerCase().trim();
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/^www\./, '');
    normalized = normalized.replace(/\/+$/, '');
    return normalized;
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * רזולוציית קישור פנימי ל-pageId
 * מנסה התאמה לפי URL מלא, ואז לפי slug
 */
function resolveInternalLinkTarget(
  href: string,
  siteUrl: string,
  urlToIdMap: Map<string, number>,
  slugToIdMap: Map<string, number>
): number | undefined {
  // נסה התאמה לפי URL מלא
  let fullUrl = href;
  if (href.startsWith('/')) {
    // נתיב יחסי — הפוך ל-URL מלא
    try {
      const base = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
      fullUrl = `${base.origin}${href}`;
    } catch {
      return undefined;
    }
  }

  const normalized = normalizeUrl(fullUrl);
  const idByUrl = urlToIdMap.get(normalized);
  if (idByUrl !== undefined) return idByUrl;

  // נסה התאמה לפי slug — חלץ את החלק האחרון של ה-URL
  try {
    const urlObj = new URL(fullUrl.startsWith('http') ? fullUrl : `https://${fullUrl}`);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const slug = pathParts[pathParts.length - 1];
      const idBySlug = slugToIdMap.get(slug);
      if (idBySlug !== undefined) return idBySlug;
    }
  } catch {
    // אם ה-URL לא תקין, דלג
  }

  return undefined;
}

/**
 * מצא ערכים כפולים — מחזיר Map של ערך → דפים עם אותו ערך
 * מתעלם מערכים ריקים
 */
function findDuplicates(
  items: ContentItem[],
  extractor: (item: ContentItem) => string
): Map<string, ContentItem[]> {
  const groups = new Map<string, ContentItem[]>();

  for (const item of items) {
    const value = extractor(item);
    if (!value || value.trim().length === 0) continue;

    const existing = groups.get(value);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(value, [item]);
    }
  }

  // שמור רק כפילויות (2+ דפים עם אותו ערך)
  const duplicates = new Map<string, ContentItem[]>();
  for (const [key, items] of groups) {
    if (items.length > 1) {
      duplicates.set(key, items);
    }
  }

  return duplicates;
}
