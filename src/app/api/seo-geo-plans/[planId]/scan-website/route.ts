import { NextRequest, NextResponse } from 'next/server';
import type { SeoWebsiteScan, SeoScannedPage } from '@/lib/db/schema';
import {
  ok,
  err,
  loadPlan,
  updatePlanSafe,
  logActivity,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';
import { analyzeSemantics } from '@/lib/seo/semantic-intelligence';
import { calculateStrategicScore } from '@/lib/seo/strategic-scoring';

const TIMEOUT_MS = 10000;
const MAX_PAGES_TO_SCAN = 5;

// ── Types ───────────────────────────────────────────────────────────────────

interface ParsedPage {
  title: string;
  metaDescription: string;
  h1Tags: string[];
  h2Tags: string[];
  hasSchema: boolean;
  hasOG: boolean;
  hasCanonical: boolean;
  wordCount: number;
  links: string[];
}

interface ScanPageResult {
  url: string;
  title: string;
  missingMeta: boolean;
  missingH1: boolean;
  missingAlt: boolean;
  wordCount: number;
  hasSchema: boolean;
  scannedAt: string;
}

// ── Fetch wrapper with timeout ──────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs: number = TIMEOUT_MS): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebScanner/1.0)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    return null;
  }
}

// ── HTML parser using regex ────────────────────────────────────────────────

function parseHtml(html: string, pageUrl: string): ParsedPage {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract meta description
  const metaDescMatch = html.match(/<meta\s+name=["']?description["']?\s+content=["']([^"']+)["']/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';

  // Extract h1 tags
  const h1Regex = /<h1[^>]*>([^<]+)<\/h1>/gi;
  const h1Tags: string[] = [];
  let h1Match;
  while ((h1Match = h1Regex.exec(html)) !== null) {
    h1Tags.push(h1Match[1].trim());
  }

  // Extract h2 tags
  const h2Regex = /<h2[^>]*>([^<]+)<\/h2>/gi;
  const h2Tags: string[] = [];
  let h2Match;
  while ((h2Match = h2Regex.exec(html)) !== null) {
    h2Tags.push(h2Match[1].trim());
  }

  // Check for structured data (JSON-LD)
  const hasSchema = /<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(html);

  // Check for Open Graph tags
  const hasOG = /<meta\s+property=["']og:/.test(html);

  // Check for canonical tag
  const hasCanonical = /<link\s+rel=["']?canonical["']?/i.test(html);

  // Count words (rough estimate: text content between tags)
  const textContent = html.replace(/<[^>]+>/g, ' ');
  const wordCount = textContent.trim().split(/\s+/).length;

  // Extract internal links
  const linkRegex = /href=["']([^"']+)["']/gi;
  const links: string[] = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const link = linkMatch[1];
    if (link && !link.startsWith('#') && !link.startsWith('mailto:') && !link.startsWith('tel:')) {
      try {
        const resolved = new URL(link, pageUrl).href;
        const resolvedUrl = new URL(resolved);
        const pageUrlObj = new URL(pageUrl);
        // Only include same-domain links
        if (resolvedUrl.hostname === pageUrlObj.hostname) {
          links.push(resolved);
        }
      } catch {
        // Skip invalid URLs
      }
    }
  }

  return {
    title,
    metaDescription,
    h1Tags,
    h2Tags,
    hasSchema,
    hasOG,
    hasCanonical,
    wordCount,
    links: [...new Set(links)], // Deduplicate
  };
}

// ── Check if URL returns 200 ────────────────────────────────────────────────

async function checkUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebScanner/1.0)',
      },
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    // Fall back to GET if HEAD fails
    try {
      const html = await fetchWithTimeout(url, 5000);
      return html !== null;
    } catch {
      return false;
    }
  }
}

// ── Scan a single page ──────────────────────────────────────────────────────

async function scanPage(url: string): Promise<ScanPageResult | null> {
  const startTime = Date.now();
  const html = await fetchWithTimeout(url);

  if (!html) return null;

  const parsed = parseHtml(html, url);
  const scannedAt = new Date().toISOString();

  return {
    url,
    title: parsed.title || url,
    missingMeta: !parsed.metaDescription,
    missingH1: parsed.h1Tags.length === 0,
    missingAlt: false, // Would need more sophisticated parsing
    wordCount: parsed.wordCount,
    hasSchema: parsed.hasSchema,
    scannedAt,
  };
}

// ── Main website scanner ────────────────────────────────────────────────────

async function scanWebsite(websiteUrl: string): Promise<{ scan: SeoWebsiteScan; pages: ScanPageResult[] } | null> {
  const startTime = Date.now();

  let urlObj: URL;
  try {
    urlObj = new URL(websiteUrl);
  } catch {
    return null;
  }

  // Fetch homepage
  const homepageHtml = await fetchWithTimeout(websiteUrl);
  if (!homepageHtml) {
    return null;
  }

  const loadTimeMs = Date.now() - startTime;
  const parsed = parseHtml(homepageHtml, websiteUrl);
  const isHttps = urlObj.protocol === 'https:';

  // Check for robots.txt and sitemap.xml
  const robotsTxtUrl = `${urlObj.protocol}//${urlObj.hostname}/robots.txt`;
  const sitemapUrl = `${urlObj.protocol}//${urlObj.hostname}/sitemap.xml`;

  const hasRobotsTxt = await checkUrl(robotsTxtUrl);
  const hasSitemap = await checkUrl(sitemapUrl);

  // Scan additional internal pages
  const scannedPages: ScanPageResult[] = [];
  const pagesToVisit = parsed.links.slice(0, MAX_PAGES_TO_SCAN);

  for (const pageUrl of pagesToVisit) {
    const pageResult = await scanPage(pageUrl);
    if (pageResult) {
      scannedPages.push(pageResult);
    }
  }

  // Scan homepage as first page
  const homepageResult = await scanPage(websiteUrl);
  if (homepageResult) {
    scannedPages.unshift(homepageResult);
  }

  // Build the scan result
  const scan: SeoWebsiteScan = {
    url: websiteUrl,
    scannedAt: new Date().toISOString(),
    hasSSL: isHttps,
    loadTimeMs,
    mobileOptimized: false, // Would need viewport meta tag analysis
    metaTitle: parsed.title,
    metaDescription: parsed.metaDescription,
    h1Tags: parsed.h1Tags,
    totalPages: scannedPages.length + 1, // Found pages + homepage
    indexedPages: scannedPages.length, // Simplified: assume all found are indexed
    brokenLinks: 0, // Would need comprehensive link checking
    hasRobotsTxt,
    hasSitemap,
    domainAuthority: 0, // Cannot determine without external API
    techStack: [], // Would need header/HTML analysis
    cmsDetected: 'Unknown',
    structuredData: parsed.hasSchema,
    openGraph: parsed.hasOG,
    canonicalTags: parsed.hasCanonical,
    issues: buildIssues(parsed, scannedPages),
  };

  return { scan, pages: scannedPages };
}

// ── Build issues from scan data ─────────────────────────────────────────────

function buildIssues(parsed: ParsedPage, pages: ScanPageResult[]) {
  const issues = [];

  // Check for missing title
  if (!parsed.title) {
    issues.push({
      type: 'critical' as const,
      category: 'technical' as const,
      title: 'Missing title tag on homepage',
      description: 'The homepage has no title tag. This affects SEO and browser display.',
      impact: 'high' as const,
    });
  }

  // Check for missing meta description
  if (!parsed.metaDescription) {
    issues.push({
      type: 'warning' as const,
      category: 'technical' as const,
      title: 'Missing meta description on homepage',
      description: 'The homepage has no meta description. This may reduce CTR in search results.',
      impact: 'medium' as const,
    });
  }

  // Check for missing H1
  if (parsed.h1Tags.length === 0) {
    issues.push({
      type: 'critical' as const,
      category: 'content' as const,
      title: 'Missing H1 tag on homepage',
      description: 'No H1 tag found on the homepage. H1 tags are important for SEO and accessibility.',
      impact: 'high' as const,
    });
  }

  // Check pages with missing meta descriptions
  const missingMetaCount = pages.filter(p => p.missingMeta).length;
  if (missingMetaCount > 0) {
    issues.push({
      type: 'warning' as const,
      category: 'content' as const,
      title: `${missingMetaCount} pages missing meta descriptions`,
      description: `Found ${missingMetaCount} scanned pages without meta descriptions.`,
      impact: 'medium' as const,
    });
  }

  // Check pages with missing H1
  const missingH1Count = pages.filter(p => p.missingH1).length;
  if (missingH1Count > 0) {
    issues.push({
      type: 'warning' as const,
      category: 'content' as const,
      title: `${missingH1Count} pages missing H1 tags`,
      description: `Found ${missingH1Count} scanned pages without H1 tags.`,
      impact: 'medium' as const,
    });
  }

  // Check for missing SSL
  // (Already checked in main scan function)

  // Check for no structured data
  if (!parsed.hasSchema) {
    issues.push({
      type: 'info' as const,
      category: 'technical' as const,
      title: 'No structured data found',
      description: 'No JSON-LD structured data detected. Consider adding schema markup.',
      impact: 'low' as const,
    });
  }

  // Check for no Open Graph tags
  if (!parsed.hasOG) {
    issues.push({
      type: 'info' as const,
      category: 'technical' as const,
      title: 'No Open Graph tags found',
      description: 'Open Graph tags can improve social media sharing.',
      impact: 'low' as const,
    });
  }

  return issues;
}

// ── Main API handler ────────────────────────────────────────────────────────

async function _POST(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);

  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  try {
    // Perform real website scan
    const scanResult = await scanWebsite(plan.websiteUrl);

    if (!scanResult) {
      // Fetch failed - return minimal result with unavailable status
      const updated = await updatePlanSafe(planId, {
        websiteScan: {
          url: plan.websiteUrl,
          scannedAt: new Date().toISOString(),
          hasSSL: false,
          loadTimeMs: 0,
          mobileOptimized: false,
          metaTitle: '',
          metaDescription: '',
          h1Tags: [],
          totalPages: 0,
          indexedPages: 0,
          brokenLinks: 0,
          hasRobotsTxt: false,
          hasSitemap: false,
          domainAuthority: 0,
          techStack: [],
          cmsDetected: 'Unknown',
          structuredData: false,
          openGraph: false,
          canonicalTags: false,
          issues: [
            {
              type: 'critical',
              category: 'technical',
              title: 'Unable to scan website',
              description: 'The website could not be reached. Please verify the URL is correct and accessible.',
              impact: 'high',
            },
          ],
        } as SeoWebsiteScan,
        scannedPages: [],
        status: 'scanning',
      });

      if (!updated) {
        return err('Failed to save scan results', 500);
      }

      logActivity(planId, 'scan_website_unavailable', {
        url: plan.websiteUrl,
        reason: 'Website unreachable',
      });

      return ok({
        scan: updated.websiteScan,
        scannedPages: updated.scannedPages || [],
        status: 'unavailable',
      });
    }

    // Run semantic intelligence on crawl data
    let semanticAnalysis = null;
    let strategicScoreResult = null;
    try {
      if (scanResult.pages && scanResult.pages.length > 0) {
        const businessName = (plan as any).businessProfile?.business_name || (plan as any).clientName || '';
        const products = (plan as any).businessProfile?.main_products_or_services || [];
        semanticAnalysis = analyzeSemantics(
          scanResult.pages.map((p: any) => ({
            url: p.url,
            title: p.title || '',
            metaDescription: p.metaDescription || '',
            h1Tags: p.h1Tags || [],
            h2Tags: p.h2Tags || [],
            paragraphs: p.paragraphs || [],
            internalLinks: p.internalLinks || [],
            wordCount: p.wordCount || 0,
            schemaMarkup: p.schemaMarkup || [],
          })),
          businessName,
          products
        );
        console.log(`[SEO-SCAN] Semantic analysis: ${semanticAnalysis.topicalMap.length} clusters, ${semanticAnalysis.entities.length} entities, score ${semanticAnalysis.semanticScore}`);

        // Calculate strategic score
        strategicScoreResult = calculateStrategicScore({
          semanticAnalysis,
          crawlData: {
            totalPages: scanResult.pages.length,
            avgWordCount: scanResult.pages.length > 0
              ? Math.round(scanResult.pages.reduce((s: number, p: any) => s + (p.wordCount || 0), 0) / scanResult.pages.length)
              : 0,
            pagesWithSchema: scanResult.pages.filter((p: any) => p.schemaMarkup && p.schemaMarkup.length > 0).length,
            pagesWithH1: scanResult.pages.filter((p: any) => p.h1Tags && p.h1Tags.length > 0).length,
            pagesWithMeta: scanResult.pages.filter((p: any) => p.metaDescription && p.metaDescription.length > 0).length,
            brokenLinks: scanResult.scan.brokenLinks || 0,
            hasSSL: scanResult.scan.hasSSL || false,
            hasSitemap: scanResult.scan.hasSitemap || false,
            hasRobotsTxt: scanResult.scan.hasRobotsTxt || false,
            mobileOptimized: scanResult.scan.mobileOptimized || false,
            avgLoadTimeMs: scanResult.scan.loadTimeMs || 2000,
          },
        });
        console.log(`[SEO-SCAN] Strategic score: ${strategicScoreResult.overall} (${strategicScoreResult.grade})`);
      }
    } catch (semErr: any) {
      console.error('[SEO-SCAN] Semantic analysis error (non-blocking):', semErr.message);
    }

    // Update plan with real scan results + intelligence
    const updatePayload: any = {
      websiteScan: scanResult.scan,
      scannedPages: scanResult.pages,
      status: 'scanning',
    };
    if (semanticAnalysis) updatePayload.semanticAnalysis = semanticAnalysis;
    if (strategicScoreResult) updatePayload.strategicScore = strategicScoreResult;

    const updated = await updatePlanSafe(planId, updatePayload);

    if (!updated) {
      return err('Failed to save scan results', 500);
    }

    logActivity(planId, 'scan_website', {
      url: plan.websiteUrl,
      totalPages: scanResult.scan.totalPages,
      scannedPages: scanResult.pages.length,
      loadTimeMs: scanResult.scan.loadTimeMs,
      hasSSL: scanResult.scan.hasSSL,
      semanticScore: semanticAnalysis?.semanticScore || null,
      strategicGrade: strategicScoreResult?.grade || null,
    });

    return ok({
      scan: scanResult.scan,
      scannedPages: scanResult.pages,
      semanticAnalysis: semanticAnalysis ? {
        semanticScore: semanticAnalysis.semanticScore,
        clusters: semanticAnalysis.topicalMap.length,
        entities: semanticAnalysis.entities.length,
        pillarPages: semanticAnalysis.pillarPages.length,
        orphanPages: semanticAnalysis.orphanPages.length,
      } : null,
      strategicScore: strategicScoreResult ? {
        overall: strategicScoreResult.overall,
        grade: strategicScoreResult.grade,
        categories: strategicScoreResult.categories.map(c => ({ id: c.id, nameHe: c.nameHe, score: c.score })),
      } : null,
      status: 'success',
    });
  } catch (error) {
    console.error('[SEO-API] POST /seo-geo-plans/[planId]/scan-website error:', error);
    return err('Failed to scan website', 500);
  }
}

export const POST = withErrorBoundary(_POST);
