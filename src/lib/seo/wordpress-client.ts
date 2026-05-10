// וורדפרס REST API לקוח לאוטומציית SEO
// WordPress REST API Client for SEO Automation

export interface WPConnection {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface YoastMeta {
  title: string;
  description: string;
  canonical: string;
  focusKeyword: string;
}

export interface WPPage {
  id: number;
  title: string;
  slug: string;
  url: string;
  content: string;
  yoastMeta?: Partial<YoastMeta>;
  headings: { tag: string; text: string }[];
  hasSchema: boolean;
}

export interface WPConnectionTestResult {
  success: boolean;
  siteName?: string;
  wpVersion?: string;
  yoastInstalled?: boolean;
  pagesCount?: number;
  error?: string;
}

export interface WPUpdateResult {
  success: boolean;
  pageId?: number;
  field?: string;
  oldValue?: string;
  newValue?: string;
  error?: string;
}

export interface HeadingAnalysis {
  headings: { tag: string; text: string }[];
  issues: string[];
  isValid: boolean;
}

export interface SiteInfo {
  title: string;
  tagline: string;
  url: string;
  permalinkStructure: string;
  wpVersion?: string;
}

// עזר: יצירת כותרת Basic Auth
// Helper: Create Basic Auth header
function createAuthHeader(username: string, applicationPassword: string): string {
  const credentials = `${username}:${applicationPassword}`;
  const encoded = Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
}

// עזר: נרמול URL אתר
// Helper: Normalize site URL — add https://, strip /wp-admin, trailing slash
function normalizeSiteUrl(raw: string): string {
  let url = raw.trim();
  // הוסף פרוטוקול אם חסר
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // הסר /wp-admin ונתיבים מיותרים
  url = url.replace(/\/wp-admin\/?.*$/i, '');
  // הסר סלאש בסוף
  url = url.replace(/\/+$/, '');
  return url;
}

// עזר: בניית URL API
// Helper: Build API URL
function buildApiUrl(siteUrl: string, endpoint: string): string {
  const baseUrl = normalizeSiteUrl(siteUrl);
  return `${baseUrl}/wp-json/wp/v2${endpoint}`;
}

// עזר: ביצוע בקשת fetch עם Auth
// Helper: Make authenticated fetch request
async function fetchWithAuth(
  url: string,
  authHeader: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return response;
}

// בדוק חיבור לאתר וורדפרס
// Test WordPress connection and retrieve site information
export async function testConnection(
  conn: WPConnection
): Promise<WPConnectionTestResult> {
  try {
    // נרמל ובדוק URL
    const normalizedUrl = normalizeSiteUrl(conn.siteUrl);
    try {
      new URL(normalizedUrl);
    } catch {
      return { success: false, error: `כתובת אתר לא תקינה: ${conn.siteUrl}. יש להזין כתובת כמו https://example.com` };
    }

    const authHeader = createAuthHeader(conn.username, conn.applicationPassword);

    // בדוק משתמש (כדי לוודא הרשאה)
    // Check user endpoint to verify credentials
    const userUrl = buildApiUrl(normalizedUrl, '/users/me');
    await fetchWithAuth(userUrl, authHeader);

    // קבל מידע אתר
    // Get site settings
    const settingsUrl = buildApiUrl(conn.siteUrl, '/settings');
    const settingsResponse = await fetchWithAuth(settingsUrl, authHeader);
    const settingsData = await settingsResponse.json();

    // בדוק אם Yoast מותקן
    // Check if Yoast is installed by trying to fetch plugins
    let yoastInstalled = false;
    try {
      const pluginsUrl = buildApiUrl(conn.siteUrl, '/plugins');
      const pluginsResponse = await fetchWithAuth(pluginsUrl, authHeader);
      if (pluginsResponse.ok) {
        const plugins = await pluginsResponse.json();
        yoastInstalled = plugins.some(
          (p: any) => p.plugin && p.plugin.includes('yoast')
        );
      }
    } catch {
      // אם לא ניתן לקבל את רשימת התוסעים, דלג
      // If cannot fetch plugins, skip
    }

    // ספור דפים
    // Count pages
    const pagesUrl = buildApiUrl(conn.siteUrl, '/pages?per_page=1');
    const pagesResponse = await fetchWithAuth(pagesUrl, authHeader);
    const pagesCount = parseInt(
      pagesResponse.headers.get('X-WP-Total') || '0'
    );

    return {
      success: true,
      siteName: settingsData.title || 'WordPress Site',
      wpVersion: settingsData.version,
      yoastInstalled,
      pagesCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// קבל את כל הדפים עם metadata
// Get all pages with metadata
export async function getPages(conn: WPConnection): Promise<WPPage[]> {
  try {
    const authHeader = createAuthHeader(conn.username, conn.applicationPassword);
    const pages: WPPage[] = [];

    // בקש את כל הדפים (עם pagination)
    // Fetch all pages with pagination
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = buildApiUrl(conn.siteUrl, `/pages?per_page=100&page=${page}`);
      const response = await fetchWithAuth(url, authHeader);
      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of data) {
        const page = parseWPPage(item, conn.siteUrl);
        pages.push(page);
      }

      page++;
    }

    return pages;
  } catch (error) {
    console.error('Error fetching pages:', error);
    return [];
  }
}

// קבל את כל הפוסטים עם metadata
// Get all posts with metadata
export async function getPosts(conn: WPConnection): Promise<WPPage[]> {
  try {
    const authHeader = createAuthHeader(conn.username, conn.applicationPassword);
    const posts: WPPage[] = [];

    // בקש את כל הפוסטים (עם pagination)
    // Fetch all posts with pagination
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = buildApiUrl(conn.siteUrl, `/posts?per_page=100&page=${page}`);
      const response = await fetchWithAuth(url, authHeader);
      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of data) {
        const post = parseWPPage(item, conn.siteUrl);
        posts.push(post);
      }

      page++;
    }

    return posts;
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

// פרסר: המר WP item ל WPPage
// Parser: Convert WordPress API item to WPPage
function parseWPPage(item: any, siteUrl: string): WPPage {
  const headings = extractHeadings(item.content?.rendered || '');
  const hasSchema = containsJsonLd(item.content?.rendered || '');

  const yoastMeta: Partial<YoastMeta> = {};

  // חלץ Yoast metadata מ meta fields
  // Extract Yoast metadata from meta fields
  if (item.meta) {
    if (item.meta.yoast_wpseo_title) {
      yoastMeta.title = item.meta.yoast_wpseo_title;
    }
    if (item.meta.yoast_wpseo_metadesc) {
      yoastMeta.description = item.meta.yoast_wpseo_metadesc;
    }
    if (item.meta.yoast_wpseo_canonical) {
      yoastMeta.canonical = item.meta.yoast_wpseo_canonical;
    }
    if (item.meta.yoast_wpseo_focuskw) {
      yoastMeta.focusKeyword = item.meta.yoast_wpseo_focuskw;
    }
  }

  return {
    id: item.id,
    title: item.title?.rendered || '',
    slug: item.slug || '',
    url: item.link || '',
    content: item.content?.rendered || '',
    yoastMeta: Object.keys(yoastMeta).length > 0 ? yoastMeta : undefined,
    headings,
    hasSchema,
  };
}

// חלץ כותרות מתוכן HTML
// Extract headings from HTML content
function extractHeadings(html: string): { tag: string; text: string }[] {
  const headings: { tag: string; text: string }[] = [];

  // regex להוצאת H1, H2, H3 עם טקסט
  // Regex to extract H1, H2, H3 with text
  const headingRegex = /<h([1-3])(?:\s[^>]*)?>([^<]+)<\/h\1>/gi;
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const tag = `h${match[1]}`;
    const text = match[2].trim();
    headings.push({ tag, text });
  }

  return headings;
}

// בדוק אם יש JSON-LD schema בתוכן
// Check if content contains JSON-LD schema
function containsJsonLd(html: string): boolean {
  return (
    html.includes('application/ld+json') || html.includes('<script') &&
    html.includes('ld+json')
  );
}

// עדכן Yoast SEO metadata של דף
// Update Yoast SEO metadata for a page
export async function updateYoastMeta(
  conn: WPConnection,
  pageId: number,
  meta: Partial<YoastMeta>
): Promise<WPUpdateResult> {
  try {
    const authHeader = createAuthHeader(conn.username, conn.applicationPassword);

    // בנה את השדות meta ל Yoast
    // Build meta fields for Yoast
    const metaBody: any = {};

    if (meta.title !== undefined) {
      metaBody.yoast_wpseo_title = meta.title;
    }
    if (meta.description !== undefined) {
      metaBody.yoast_wpseo_metadesc = meta.description;
    }
    if (meta.canonical !== undefined) {
      metaBody.yoast_wpseo_canonical = meta.canonical;
    }
    if (meta.focusKeyword !== undefined) {
      metaBody.yoast_wpseo_focuskw = meta.focusKeyword;
    }

    const url = buildApiUrl(conn.siteUrl, `/pages/${pageId}`);
    const response = await fetchWithAuth(url, authHeader, {
      method: 'POST',
      body: JSON.stringify({ meta: metaBody }),
    });

    const result = await response.json();

    return {
      success: true,
      pageId,
      field: 'yoast_meta',
      newValue: JSON.stringify(meta),
    };
  } catch (error) {
    return {
      success: false,
      pageId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// עדכן תוכן דף
// Update page content
export async function updatePageContent(
  conn: WPConnection,
  pageId: number,
  content: string
): Promise<WPUpdateResult> {
  try {
    const authHeader = createAuthHeader(conn.username, conn.applicationPassword);

    const url = buildApiUrl(conn.siteUrl, `/pages/${pageId}`);
    const response = await fetchWithAuth(url, authHeader, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });

    const result = await response.json();

    return {
      success: true,
      pageId,
      field: 'content',
      newValue: content.substring(0, 100) + '...',
    };
  } catch (error) {
    return {
      success: false,
      pageId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// קבל את קובץ robots.txt הנוכחי
// Get current robots.txt file
export async function getRobotsTxt(conn: WPConnection): Promise<string> {
  try {
    const robotsUrl = `${
      conn.siteUrl.endsWith('/') ? conn.siteUrl.slice(0, -1) : conn.siteUrl
    }/robots.txt`;

    const response = await fetch(robotsUrl);

    if (!response.ok) {
      return ''; // אם לא קיים, החזר ריק
      // If not found, return empty
    }

    return await response.text();
  } catch (error) {
    console.error('Error fetching robots.txt:', error);
    return '';
  }
}

// יצור robots.txt אופטימלי
// Generate optimal robots.txt
export function generateOptimalRobotsTxt(siteUrl: string): string {
  const baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
  const domain = new URL(baseUrl).hostname;

  return `# וורדפרס אתר robots.txt
# WordPress Site robots.txt
# ${domain}

User-agent: *
Allow: /
Disallow: /wp-admin/
Disallow: /wp-includes/
Disallow: /wp-content/plugins/
Disallow: /wp-content/themes/
Disallow: /?s=
Disallow: /search/
Disallow: /feed/
Disallow: /feeds/
Disallow: /comments/feed/
Disallow: /trackback/
Disallow: /*?*orderby=
Disallow: /*?*sort=
Disallow: /cart/
Disallow: /checkout/
Disallow: /account/

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/sitemap_index.xml

# דירוגי עדיפות לבוטים
# Crawl-Delay directives
User-agent: Googlebot
Crawl-Delay: 0

User-agent: Bingbot
Crawl-Delay: 1
`;
}

// נתח את מבנה הכותרות של דף
// Analyze heading structure of a page
export function analyzeHeadings(page: WPPage): HeadingAnalysis {
  const issues: string[] = [];
  let isValid = true;

  // בדוק אם אין H1
  // Check for missing H1
  const h1Count = page.headings.filter((h) => h.tag === 'h1').length;
  if (h1Count === 0) {
    issues.push('חסר H1 כותרת ראשית - Missing H1 heading');
    isValid = false;
  }

  // בדוק אם יש יותר מ H1 אחד
  // Check for multiple H1s
  if (h1Count > 1) {
    issues.push(`מספר H1s (${h1Count}) - Multiple H1 headings (${h1Count})`);
    isValid = false;
  }

  // בדוק היררכיה של כותרות
  // Check heading hierarchy
  let prevLevel = 0;
  for (const heading of page.headings) {
    const level = parseInt(heading.tag[1]);
    if (prevLevel > 0 && level > prevLevel + 1) {
      issues.push(
        `קפיצה ברמה מ H${prevLevel} ל H${level} - Heading level jump from H${prevLevel} to H${level}`
      );
      isValid = false;
    }
    prevLevel = level;
  }

  return {
    headings: page.headings,
    issues,
    isValid,
  };
}

// קבל מידע אתר (כותרת, tagline, וכו')
// Get site information (title, tagline, etc.)
export async function getSiteInfo(conn: WPConnection): Promise<SiteInfo> {
  try {
    const authHeader = createAuthHeader(conn.username, conn.applicationPassword);

    // קבל הגדרות אתר
    // Get site settings
    const settingsUrl = buildApiUrl(conn.siteUrl, '/settings');
    const settingsResponse = await fetchWithAuth(settingsUrl, authHeader);
    const settingsData = await settingsResponse.json();

    return {
      title: settingsData.title || '',
      tagline: settingsData.description || '',
      url: settingsData.url || conn.siteUrl,
      permalinkStructure: settingsData.permalink_structure || '/?p=%post_id%',
      wpVersion: settingsData.version,
    };
  } catch (error) {
    console.error('Error getting site info:', error);

    return {
      title: '',
      tagline: '',
      url: conn.siteUrl,
      permalinkStructure: '',
    };
  }
}

// ============================================================================
// יצירת פוסטים ותמונות — Article Publishing
// ============================================================================

export interface WPPostCreateResult {
  success: boolean;
  postId?: number;
  postUrl?: string;
  error?: string;
}

export interface WPMediaUploadResult {
  success: boolean;
  mediaId?: number;
  mediaUrl?: string;
  error?: string;
}

/**
 * Upload media (image) to WordPress media library
 */
export async function uploadMedia(
  conn: WPConnection,
  imageBuffer: Buffer,
  filename: string,
  mimeType: string = 'image/png'
): Promise<WPMediaUploadResult> {
  try {
    const normalizedUrl = normalizeSiteUrl(conn.siteUrl);
    const authHeader = createAuthHeader(conn.username, conn.applicationPassword);
    const url = `${normalizedUrl}/wp-json/wp/v2/media`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Upload failed (${response.status}): ${errorText}` };
    }

    const result = await response.json();
    return {
      success: true,
      mediaId: result.id,
      mediaUrl: result.source_url || result.guid?.rendered,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Media upload failed',
    };
  }
}

/**
 * Create a WordPress post (article) with optional featured image and scheduled time
 */
export async function createPost(
  conn: WPConnection,
  options: {
    title: string;
    content: string;
    status?: 'publish' | 'draft' | 'future';   // 'future' = scheduled
    date?: string;                               // ISO 8601 for scheduled publish
    featuredMediaId?: number;                    // Featured image media ID
    categories?: number[];
    tags?: number[];
    metaTitle?: string;                          // Yoast meta title
    metaDescription?: string;                    // Yoast meta description
    focusKeyword?: string;                       // Yoast focus keyword
  }
): Promise<WPPostCreateResult> {
  try {
    const authHeader = createAuthHeader(conn.username, conn.applicationPassword);
    const url = buildApiUrl(conn.siteUrl, '/posts');

    const body: Record<string, any> = {
      title: options.title,
      content: options.content,
      status: options.status || 'publish',
    };

    if (options.date) body.date = options.date;
    if (options.featuredMediaId) body.featured_media = options.featuredMediaId;
    if (options.categories?.length) body.categories = options.categories;
    if (options.tags?.length) body.tags = options.tags;

    // Yoast meta fields
    if (options.metaTitle || options.metaDescription || options.focusKeyword) {
      body.meta = {};
      if (options.metaTitle) body.meta.yoast_wpseo_title = options.metaTitle;
      if (options.metaDescription) body.meta.yoast_wpseo_metadesc = options.metaDescription;
      if (options.focusKeyword) body.meta.yoast_wpseo_focuskw = options.focusKeyword;
    }

    const response = await fetchWithAuth(url, authHeader, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const result = await response.json();

    return {
      success: true,
      postId: result.id,
      postUrl: result.link || result.guid?.rendered,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Post creation failed',
    };
  }
}

/**
 * Get or create a WordPress category by name.
 * Returns the category ID, or null on failure.
 */
export async function getOrCreateCategory(
  conn: WPConnection,
  categoryName: string
): Promise<number | null> {
  try {
    const authHeader = createAuthHeader(conn.username, conn.applicationPassword);

    // Search for existing category
    const searchUrl = buildApiUrl(conn.siteUrl, `/categories?search=${encodeURIComponent(categoryName)}&per_page=100`);
    const searchRes = await fetchWithAuth(searchUrl, authHeader, { method: 'GET' });
    const categories = await searchRes.json();

    if (Array.isArray(categories)) {
      const exact = categories.find((c: any) => c.name === categoryName || c.slug === categoryName.toLowerCase());
      if (exact) {
        console.log(`[WP-CLIENT] Found existing category "${categoryName}" → ID=${exact.id}`);
        return exact.id;
      }
    }

    // Category not found — create it
    const createUrl = buildApiUrl(conn.siteUrl, '/categories');
    const createRes = await fetchWithAuth(createUrl, authHeader, {
      method: 'POST',
      body: JSON.stringify({ name: categoryName }),
    });
    const created = await createRes.json();

    if (created?.id) {
      console.log(`[WP-CLIENT] Created new category "${categoryName}" → ID=${created.id}`);
      return created.id;
    }

    console.warn(`[WP-CLIENT] Failed to create category "${categoryName}":`, created);
    return null;
  } catch (error) {
    console.warn(`[WP-CLIENT] getOrCreateCategory error:`, error);
    return null;
  }
}

// עזר: הוסף או עדכן LocalBusiness schema
// Helper: Add or update LocalBusiness schema to page
export function generateLocalBusinessSchema(
  businessName: string,
  businessUrl: string,
  address?: string,
  phone?: string
): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: businessName,
    url: businessUrl,
    ...(phone && { telephone: phone }),
    ...(address && { address: address }),
  };

  return `<script type="application/ld+json">${JSON.stringify(
    schema
  )}</script>`;
}

// עזר: מחלץ JSON-LD מתוכן
// Helper: Extract JSON-LD from content
export function extractJsonLd(html: string): any[] {
  const schemas: any[] = [];

  // Regex להוצאת JSON-LD blocks
  // Regex to extract JSON-LD blocks
  const jsonLdRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const schema = JSON.parse(match[1]);
      schemas.push(schema);
    } catch {
      // דלג על JSON שגוי
      // Skip invalid JSON
    }
  }

  return schemas;
}
