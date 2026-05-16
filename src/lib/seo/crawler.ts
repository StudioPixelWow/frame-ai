// @ts-ignore - cheerio installed at deploy time
import { load } from 'cheerio';
import { URL } from 'url';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  timeout?: number;
  followExternalLinks?: boolean;
  respectRobotsTxt?: boolean;
  userAgent?: string;
}

export interface CrawledPage {
  url: string;
  statusCode: number;
  loadTimeMs: number;
  html: string;
  redirectedTo?: string;
}

export interface ParsedPageData {
  url: string;
  title: string | null;
  metaDescription: string | null;
  metaKeywords: string[];
  h1Tags: string[];
  h2Tags: string[];
  h3Tags: string[];
  paragraphs: string[];
  internalLinks: string[];
  externalLinks: string[];
  images: { src: string; alt: string }[];
  hasSSL: boolean;
  canonicalUrl: string | null;
  ogTags: Record<string, string>;
  schemaMarkup: any[];
  wordCount: number;
  language: string | null;
  robotsMeta: string | null;
}

export interface CrawlResult {
  startUrl: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  pagesScanned: number;
  pagesFailed: number;
  pages: ParsedPageData[];
  siteStructure: {
    hasSSL: boolean;
    hasSitemap: boolean;
    hasRobotsTxt: boolean;
    sitemapUrls: string[];
    robotsTxtContent: string | null;
  };
  technicalIssues: TechnicalIssue[];
}

export interface TechnicalIssue {
  type:
    | 'missing_title'
    | 'missing_meta'
    | 'missing_h1'
    | 'duplicate_title'
    | 'broken_link'
    | 'slow_page'
    | 'no_ssl'
    | 'no_canonical'
    | 'thin_content'
    | 'missing_alt';
  severity: 'critical' | 'warning' | 'info';
  url: string;
  description: string;
  evidence: string;
}

// ============================================================================
// Internal State
// ============================================================================

interface CrawlState {
  visited: Set<string>;
  queue: Array<{ url: string; depth: number }>;
  results: ParsedPageData[];
  issues: TechnicalIssue[];
  failedPages: Array<{ url: string; error: string }>;
  robotsTxtContent: string | null;
  disallowPatterns: string[];
  sitemapUrls: string[];
  baseUrl: URL;
  options: Required<CrawlOptions>;
}

// ============================================================================
// Utility Functions
// ============================================================================

function normalizeUrl(urlString: string, baseUrl?: URL): string {
  try {
    const url = new URL(urlString, baseUrl?.href);
    // Remove fragment
    url.hash = '';
    // Normalize trailing slash
    let normalized = url.href;
    if (normalized.endsWith('/') && normalized !== url.origin + '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return '';
  }
}

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSameDomain(urlString: string, baseUrl: URL): boolean {
  try {
    const url = new URL(urlString);
    return url.hostname === baseUrl.hostname;
  } catch {
    return false;
  }
}

function isNonHtmlResource(url: string): boolean {
  const ext = url.split('?')[0].toLowerCase().split('.').pop() || '';
  const nonHtmlExts = [
    'pdf',
    'jpg',
    'jpeg',
    'png',
    'gif',
    'svg',
    'webp',
    'ico',
    'css',
    'js',
    'woff',
    'woff2',
    'ttf',
    'eot',
    'zip',
    'exe',
    'dmg',
    'iso',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'mp3',
    'mp4',
    'mov',
  ];
  return nonHtmlExts.includes(ext);
}

function parseRobotsTxt(content: string): string[] {
  const disallowPatterns: string[] = [];
  const lines = content.split('\n');
  let isRelevantSection = false;

  for (const line of lines) {
    const trimmed = line.trim().split('#')[0].trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().startsWith('user-agent:')) {
      const agent = trimmed.substring(11).trim().toLowerCase();
      isRelevantSection = agent === '*' || agent === 'pixelseo-crawler';
    }

    if (isRelevantSection && trimmed.toLowerCase().startsWith('disallow:')) {
      const pattern = trimmed.substring(9).trim();
      if (pattern) {
        disallowPatterns.push(pattern);
      }
    }
  }

  return disallowPatterns;
}

function isDisallowedByRobots(
  path: string,
  disallowPatterns: string[]
): boolean {
  if (!disallowPatterns.length) return false;

  for (const pattern of disallowPatterns) {
    if (pattern === '/') return true; // Disallow all
    if (path.startsWith(pattern)) return true;
    if (pattern === '*') return true;
  }

  return false;
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

// ============================================================================
// Core Crawling Functions
// ============================================================================

export async function crawlSinglePage(
  url: string,
  timeoutMs: number = 10000,
  userAgent: string = 'PixelSEO-Crawler/1.0 (+https://pixel-digital.co.il)'
): Promise<CrawledPage | null> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    // Only process HTML
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return null;
    }

    if (!response.ok && response.status !== 301 && response.status !== 302) {
      return null;
    }

    const html = await response.text();
    const loadTimeMs = Date.now() - startTime;

    const result: CrawledPage = {
      url: response.url,
      statusCode: response.status,
      loadTimeMs,
      html,
    };

    if (response.url !== url) {
      result.redirectedTo = response.url;
    }

    return result;
  } catch (error) {
    return null;
  }
}

export function extractPageData(
  html: string,
  url: string
): ParsedPageData {
  const $ = load(html);
  const pageUrl = new URL(url);

  // Extract basic metadata
  const title =
    $('title').text() || $('meta[property="og:title"]').attr('content') || null;

  const metaDescription =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    null;

  const metaKeywordsStr = $('meta[name="keywords"]').attr('content') || '';
  const metaKeywords = metaKeywordsStr
    .split(',')
    .map((k: any) => k.trim())
    .filter((k: any) => k.length > 0);

  // Extract headings
  const h1Tags = $('h1')
    .map((_: any, el: any) => $(el).text().trim())
    .get()
    .filter((t: any) => t.length > 0);

  const h2Tags = $('h2')
    .map((_: any, el: any) => $(el).text().trim())
    .get()
    .filter((t: any) => t.length > 0);

  const h3Tags = $('h3')
    .map((_: any, el: any) => $(el).text().trim())
    .get()
    .filter((t: any) => t.length > 0);

  // Extract paragraphs (first 20)
  const paragraphs = $('p')
    .map((_: any, el: any) => $(el).text().trim())
    .get()
    .filter((t: any) => t.length > 0)
    .slice(0, 20);

  // Extract links
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];

  $('a[href]').each((_: any, el: any) => {
    const href = $(el).attr('href') || '';
    if (!href) return;

    try {
      const linkUrl = new URL(href, url);
      const normalized = normalizeUrl(linkUrl.href);

      if (isSameDomain(linkUrl.href, pageUrl)) {
        internalLinks.push(normalized);
      } else {
        externalLinks.push(normalized);
      }
    } catch {
      // Invalid URL, skip
    }
  });

  // Remove duplicates
  const uniqueInternal = Array.from(new Set(internalLinks));
  const uniqueExternal = Array.from(new Set(externalLinks));

  // Extract images
  const images = $('img')
    .map((_: any, el: any) => ({
      src: $(el).attr('src') || '',
      alt: $(el).attr('alt') || '',
    }))
    .get()
    .filter((img: any) => img.src.length > 0);

  // Check SSL
  const hasSSL = pageUrl.protocol === 'https:';

  // Extract canonical
  const canonicalUrl =
    $('link[rel="canonical"]').attr('href') ||
    $('meta[property="og:url"]').attr('content') ||
    null;

  // Extract OG tags
  const ogTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_: any, el: any) => {
    const property = $(el).attr('property') || '';
    const content = $(el).attr('content') || '';
    if (property && content) {
      const key = property.replace('og:', '');
      ogTags[key] = content;
    }
  });

  // Extract JSON-LD schema markup
  const schemaMarkup: any[] = [];
  $('script[type="application/ld+json"]').each((_: any, el: any) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      schemaMarkup.push(json);
    } catch {
      // Invalid JSON, skip
    }
  });

  // Calculate word count
  const fullText = $('body').text();
  const wordCount = countWords(fullText);

  // Extract language
  const language = $('html').attr('lang') || null;

  // Extract robots meta
  const robotsMeta = $('meta[name="robots"]').attr('content') || null;

  return {
    url,
    title,
    metaDescription,
    metaKeywords,
    h1Tags,
    h2Tags,
    h3Tags,
    paragraphs,
    internalLinks: uniqueInternal,
    externalLinks: uniqueExternal,
    images,
    hasSSL,
    canonicalUrl,
    ogTags,
    schemaMarkup,
    wordCount,
    language,
    robotsMeta,
  };
}

// ============================================================================
// Main Crawler
// ============================================================================

export async function crawlWebsite(
  url: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // Normalize options
  const opts: Required<CrawlOptions> = {
    maxPages: options.maxPages ?? 10,
    maxDepth: options.maxDepth ?? 2,
    timeout: options.timeout ?? 10000,
    followExternalLinks: options.followExternalLinks ?? false,
    respectRobotsTxt: options.respectRobotsTxt ?? true,
    userAgent: options.userAgent ?? 'PixelSEO-Crawler/1.0 (+https://pixel-digital.co.il)',
  };

  // Clamp values
  opts.maxPages = Math.min(Math.max(opts.maxPages, 1), 50);
  opts.maxDepth = Math.max(opts.maxDepth, 1);
  opts.timeout = Math.max(opts.timeout, 1000);

  const normalizedUrl = normalizeUrl(url);
  if (!isValidUrl(normalizedUrl)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  const baseUrl = new URL(normalizedUrl);

  const state: CrawlState = {
    visited: new Set(),
    queue: [{ url: normalizedUrl, depth: 0 }],
    results: [],
    issues: [],
    failedPages: [],
    robotsTxtContent: null,
    disallowPatterns: [],
    sitemapUrls: [],
    baseUrl,
    options: opts,
  };

  // Step 1: Fetch and parse robots.txt
  if (opts.respectRobotsTxt) {
    const robotsUrl = `${baseUrl.origin}/robots.txt`;
    const robotsPage = await crawlSinglePage(robotsUrl, opts.timeout, opts.userAgent);
    if (robotsPage) {
      state.robotsTxtContent = robotsPage.html;
      state.disallowPatterns = parseRobotsTxt(robotsPage.html);

      // Extract sitemap URLs from robots.txt
      const sitemapMatches = robotsPage.html.match(/Sitemap:\s*(.+)/gi);
      if (sitemapMatches) {
        for (const match of sitemapMatches) {
          const sitemapUrl = match.replace(/Sitemap:\s*/i, '').trim();
          if (isValidUrl(sitemapUrl)) {
            state.sitemapUrls.push(sitemapUrl);
          }
        }
      }
    }
  }

  // Also check /sitemap.xml
  const sitemapXmlUrl = `${baseUrl.origin}/sitemap.xml`;
  const sitemapPage = await crawlSinglePage(
    sitemapXmlUrl,
    opts.timeout,
    opts.userAgent
  );
  if (sitemapPage && !state.sitemapUrls.includes(sitemapXmlUrl)) {
    state.sitemapUrls.push(sitemapXmlUrl);
  }

  // Step 2: BFS crawl
  while (state.queue.length > 0 && state.results.length < opts.maxPages) {
    const item = state.queue.shift();
    if (!item) break;

    const { url: pageUrl, depth } = item;

    // Check depth limit
    if (depth > opts.maxDepth) continue;

    // Check if already visited
    if (state.visited.has(pageUrl)) continue;
    state.visited.add(pageUrl);

    // Check robots.txt
    if (opts.respectRobotsTxt) {
      try {
        const urlObj = new URL(pageUrl);
        const path = urlObj.pathname + urlObj.search;
        if (isDisallowedByRobots(path, state.disallowPatterns)) {
          state.failedPages.push({
            url: pageUrl,
            error: 'Disallowed by robots.txt',
          });
          continue;
        }
      } catch {
        // Skip if URL parsing fails
        continue;
      }
    }

    // Skip non-HTML resources
    if (isNonHtmlResource(pageUrl)) continue;

    // Fetch page
    const crawledPage = await crawlSinglePage(
      pageUrl,
      opts.timeout,
      opts.userAgent
    );

    if (!crawledPage) {
      state.failedPages.push({
        url: pageUrl,
        error: 'Failed to fetch or parse',
      });
      continue;
    }

    // Parse page
    const parsedData = extractPageData(crawledPage.html, crawledPage.url);
    state.results.push(parsedData);

    // Detect technical issues
    detectIssues(parsedData, crawledPage.loadTimeMs, state);

    // Extract links for next depth
    if (depth < opts.maxDepth) {
      const linksToProcess = opts.followExternalLinks
        ? [...parsedData.internalLinks, ...parsedData.externalLinks]
        : parsedData.internalLinks;

      for (const link of linksToProcess) {
        if (!state.visited.has(link) && state.queue.length < opts.maxPages * 2) {
          // Prevent queue from growing too large
          if (opts.followExternalLinks || isSameDomain(link, baseUrl)) {
            state.queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    }
  }

  // Step 3: Build result
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  return {
    startUrl: normalizedUrl,
    startedAt,
    completedAt,
    durationMs,
    pagesScanned: state.results.length,
    pagesFailed: state.failedPages.length,
    pages: state.results,
    siteStructure: {
      hasSSL: baseUrl.protocol === 'https:',
      hasSitemap: state.sitemapUrls.length > 0,
      hasRobotsTxt: !!state.robotsTxtContent,
      sitemapUrls: state.sitemapUrls,
      robotsTxtContent: state.robotsTxtContent,
    },
    technicalIssues: state.issues,
  };
}

// ============================================================================
// Issue Detection
// ============================================================================

function detectIssues(
  page: ParsedPageData,
  loadTimeMs: number,
  state: CrawlState
): void {
  // Missing title
  if (!page.title) {
    state.issues.push({
      type: 'missing_title',
      severity: 'critical',
      url: page.url,
      description: 'Page has no title tag',
      evidence: 'Title tag or og:title not found',
    });
  } else if (state.results.some((p) => p.title === page.title && p.url !== page.url)) {
    // Duplicate title
    state.issues.push({
      type: 'duplicate_title',
      severity: 'warning',
      url: page.url,
      description: 'Page title is duplicated on another page',
      evidence: `Title: "${page.title}"`,
    });
  }

  // Missing meta description
  if (!page.metaDescription) {
    state.issues.push({
      type: 'missing_meta',
      severity: 'warning',
      url: page.url,
      description: 'Page has no meta description',
      evidence: 'Meta description tag not found',
    });
  }

  // Missing H1
  if (page.h1Tags.length === 0) {
    state.issues.push({
      type: 'missing_h1',
      severity: 'warning',
      url: page.url,
      description: 'Page has no H1 tag',
      evidence: 'No H1 tags found on page',
    });
  }

  // Thin content (< 300 words)
  if (page.wordCount < 300) {
    state.issues.push({
      type: 'thin_content',
      severity: 'warning',
      url: page.url,
      description: 'Page has thin content (less than 300 words)',
      evidence: `Word count: ${page.wordCount}`,
    });
  }

  // No SSL
  if (!page.hasSSL) {
    state.issues.push({
      type: 'no_ssl',
      severity: 'critical',
      url: page.url,
      description: 'Page is not served over HTTPS',
      evidence: `Protocol: ${page.url.split('://')[0]}`,
    });
  }

  // No canonical tag
  if (!page.canonicalUrl) {
    state.issues.push({
      type: 'no_canonical',
      severity: 'info',
      url: page.url,
      description: 'Page has no canonical tag',
      evidence: 'Canonical link not found',
    });
  }

  // Missing alt text on images
  const imagesWithoutAlt = page.images.filter((img) => !img.alt);
  if (imagesWithoutAlt.length > 0) {
    state.issues.push({
      type: 'missing_alt',
      severity: 'warning',
      url: page.url,
      description: `${imagesWithoutAlt.length} image(s) missing alt text`,
      evidence: `Images: ${imagesWithoutAlt.map((img) => img.src).join(', ')}`,
    });
  }

  // Slow page (> 3 seconds)
  if (loadTimeMs > 3000) {
    state.issues.push({
      type: 'slow_page',
      severity: 'info',
      url: page.url,
      description: 'Page load time exceeds 3 seconds',
      evidence: `Load time: ${loadTimeMs}ms`,
    });
  }
}
