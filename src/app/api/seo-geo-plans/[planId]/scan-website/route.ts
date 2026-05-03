import { NextRequest, NextResponse } from 'next/server';
import type { SeoWebsiteScan, SeoScannedPage } from '@/lib/db/schema';
import {
  ok,
  err,
  loadPlan,
  updatePlanSafe,
  logActivity,
  generateId,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';

// Mock scan generator
function generateMockScan(url: string): SeoWebsiteScan {
  const now = new Date().toISOString();
  const domain = new URL(url).hostname;

  return {
    url,
    scannedAt: now,
    hasSSL: true,
    loadTimeMs: Math.floor(Math.random() * 2000) + 500,
    mobileOptimized: Math.random() > 0.3,
    metaTitle: `Home | ${domain}`,
    metaDescription: `Welcome to ${domain}. High-quality products and services.`,
    h1Tags: ['Welcome to our website', 'Quality Services & Products'],
    totalPages: Math.floor(Math.random() * 50) + 10,
    indexedPages: Math.floor(Math.random() * 45) + 5,
    brokenLinks: Math.floor(Math.random() * 15),
    hasRobotsTxt: true,
    hasSitemap: true,
    domainAuthority: Math.floor(Math.random() * 40) + 20,
    techStack: ['Next.js', 'React', 'Vercel', 'Node.js'],
    cmsDetected: 'Custom',
    structuredData: Math.random() > 0.4,
    openGraph: Math.random() > 0.3,
    canonicalTags: Math.random() > 0.2,
    issues: [
      {
        type: 'warning',
        category: 'performance',
        title: 'Slow loading on mobile',
        description: 'Mobile pages load slower than recommended.',
        impact: 'medium',
      },
      {
        type: 'info',
        category: 'content',
        title: 'Missing meta descriptions',
        description: 'Some pages lack meta descriptions for SEO.',
        impact: 'medium',
      },
      {
        type: 'critical',
        category: 'technical',
        title: 'Broken internal links',
        description: `Found ${Math.floor(Math.random() * 5) + 1} broken internal links.`,
        impact: 'high',
      },
    ],
  };
}

// Mock scanned pages generator
function generateMockScannedPages(domain: string, count = 4): SeoScannedPage[] {
  const now = new Date().toISOString();
  const pages: SeoScannedPage[] = [];

  const pagePaths = ['/', '/about', '/services', '/contact', '/blog', '/pricing'];
  for (let i = 0; i < Math.min(count, pagePaths.length); i++) {
    pages.push({
      url: `https://${domain}${pagePaths[i]}`,
      title: `${pagePaths[i] === '/' ? 'Home' : pagePaths[i].slice(1)} | ${domain}`,
      missingMeta: Math.random() > 0.7,
      missingH1: Math.random() > 0.8,
      missingAlt: Math.random() > 0.6,
      wordCount: Math.floor(Math.random() * 2000) + 300,
      hasSchema: Math.random() > 0.5,
      scannedAt: now,
    });
  }

  return pages;
}

async function POST(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
): Promise<NextResponse> {
  const { planId } = await context.params;
  const { plan, error: loadErr } = await loadPlan(planId, req);

  if (loadErr) return loadErr;
  if (!plan) return err('Plan not found', 404);

  try {
    const domain = new URL(plan.websiteUrl).hostname;

    // Generate mock scan
    const scanResult = generateMockScan(plan.websiteUrl);

    // Generate mock scanned pages
    const scannedPages = generateMockScannedPages(domain, 4);

    // Update plan with scan results
    const updated = await updatePlanSafe(planId, {
      websiteScan: scanResult,
      scannedPages,
      status: 'scanning',
    });

    if (!updated) {
      return err('Failed to save scan results', 500);
    }

    logActivity(planId, 'scan_website', {
      url: plan.websiteUrl,
      totalPages: scanResult.totalPages,
      scannedPages: scannedPages.length,
    });

    return ok({
      scan: scanResult,
      scannedPages,
    });
  } catch (error) {
    console.error('[SEO-API] POST /seo-geo-plans/[planId]/scan-website error:', error);
    return err('Failed to scan website', 500);
  }
}

export const POST = withErrorBoundary(POST);
