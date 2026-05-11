import { NextRequest } from 'next/server';
import {
  ok,
  err,
  loadPlan,
  updatePlanSafe,
  logActivity,
  withErrorBoundary,
} from '@/lib/seo/api-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/seo-geo-plans/[planId]/rescan
 *
 * Re-runs the website scan, saves baseline on first run,
 * and builds comparison data showing progress over time.
 */

const TIMEOUT_MS = 10000;

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PixelSEO/1.0)' },
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PixelSEO/1.0)' } });
    clearTimeout(tid);
    return res.ok;
  } catch { return false; }
}

function parseHtml(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const metaMatch = html.match(/<meta\s+name=["']?description["']?\s+content=["']([^"']+)["']/i);
  const metaDescription = metaMatch ? metaMatch[1].trim() : '';

  const h1Regex = /<h1[^>]*>([^<]+)<\/h1>/gi;
  const h1Tags: string[] = [];
  let m;
  while ((m = h1Regex.exec(html)) !== null) h1Tags.push(m[1].trim());

  const h2Regex = /<h2[^>]*>([^<]+)<\/h2>/gi;
  const h2Tags: string[] = [];
  while ((m = h2Regex.exec(html)) !== null) h2Tags.push(m[1].trim());

  const hasSchema = /<script\s+type=["']application\/ld\+json["'][^>]*>/i.test(html);
  const hasOG = /<meta\s+property=["']og:/i.test(html);
  const hasCanonical = /<link\s+rel=["']?canonical["']?/i.test(html);

  const textContent = html.replace(/<[^>]+>/g, ' ');
  const wordCount = textContent.trim().split(/\s+/).length;

  return { title, metaDescription, h1Tags, h2Tags, hasSchema, hasOG, hasCanonical, wordCount };
}

function calcTechnicalScore(scan: any): number {
  let score = 0;
  if (scan.hasSSL) score += 15;
  if (scan.hasSitemap) score += 15;
  if (scan.hasRobotsTxt) score += 10;
  if (scan.metaTitle) score += 15;
  if (scan.metaDescription) score += 15;
  if (scan.h1Tags?.length > 0) score += 10;
  if (scan.structuredData) score += 10;
  if (scan.openGraph) score += 10;
  return Math.min(score, 100);
}

export const POST = withErrorBoundary(async (req: NextRequest, context: { params: Promise<{ planId: string }> }) => {
  const { planId } = await context.params;
  console.log(`[RESCAN] Starting rescan for plan: ${planId}`);

  const { plan, error } = await loadPlan(planId, req);
  if (error) {
    console.error('[RESCAN] loadPlan error');
    return error;
  }
  if (!plan) return err('תוכנית לא נמצאה', 404);

  const now = new Date().toISOString();
  const planAny = plan as any;
  const websiteUrl = planAny.websiteUrl || planAny.url || planAny.domain || '';

  console.log(`[RESCAN] Plan loaded. URL: ${websiteUrl}, clientName: ${planAny.clientName || planAny.businessName}`);
  if (!websiteUrl) return err('כתובת אתר חסרה בתוכנית', 400);

  // ── Save baseline on first rescan ──
  const isFirstRescan = !planAny.baselineScan;
  let baselineUpdate: any = {};
  if (isFirstRescan && planAny.websiteScan) {
    baselineUpdate = {
      baselineScan: planAny.websiteScan,
      baselineKeywordRanks: (planAny.clientKeywords || []).map((kw: any) => ({
        keyword: typeof kw === 'string' ? kw : kw.keyword,
        rank: typeof kw === 'string' ? null : (kw.currentRank || null),
        checkedAt: now,
      })),
      baselineCapturedAt: now,
    };
  }

  // ── Re-scan website ──
  let urlObj: URL;
  try { urlObj = new URL(websiteUrl); } catch { return err('כתובת אתר לא תקינה', 400); }

  const startTime = Date.now();
  const html = await fetchPage(websiteUrl);

  if (!html) {
    console.log(`[RESCAN] Website unreachable: ${websiteUrl}`);
    return ok({
      status: 'unavailable',
      message: `האתר ${websiteUrl} לא נגיש כרגע. נסה שוב מאוחר יותר.`,
    });
  }
  console.log(`[RESCAN] Fetched ${html.length} bytes in ${Date.now() - startTime}ms`);

  const loadTimeMs = Date.now() - startTime;
  const parsed = parseHtml(html);
  const isHttps = urlObj.protocol === 'https:';

  // Check robots.txt and sitemap.xml in parallel
  const [hasRobotsTxt, hasSitemap] = await Promise.all([
    checkUrlExists(`${urlObj.protocol}//${urlObj.hostname}/robots.txt`),
    checkUrlExists(`${urlObj.protocol}//${urlObj.hostname}/sitemap.xml`),
  ]);

  // Build new scan object
  const newScan = {
    url: websiteUrl,
    scannedAt: now,
    hasSSL: isHttps,
    loadTimeMs,
    mobileOptimized: false,
    metaTitle: parsed.title,
    metaDescription: parsed.metaDescription,
    h1Tags: parsed.h1Tags,
    totalPages: planAny.websiteScan?.totalPages || 1,
    indexedPages: planAny.websiteScan?.indexedPages || 1,
    brokenLinks: 0,
    hasRobotsTxt,
    hasSitemap,
    domainAuthority: planAny.websiteScan?.domainAuthority || 0,
    techStack: planAny.websiteScan?.techStack || [],
    cmsDetected: planAny.websiteScan?.cmsDetected || 'Unknown',
    structuredData: parsed.hasSchema,
    openGraph: parsed.hasOG,
    canonicalTags: parsed.hasCanonical,
    issues: [],
    // Preserve existing AI queries
    aiQueries: planAny.websiteScan?.aiQueries || [],
    platformStatuses: planAny.websiteScan?.platformStatuses || [],
    aiScanCompletedAt: planAny.websiteScan?.aiScanCompletedAt || null,
  };

  const technicalScore = calcTechnicalScore(newScan);

  // ── Build comparison against baseline ──
  const baseline = planAny.baselineScan || planAny.websiteScan || {};
  const baselineTechScore = calcTechnicalScore(baseline);

  const technicalChanges: any[] = [];
  const checkField = (field: string, label: string, newVal: any, oldVal: any) => {
    if (newVal !== oldVal) {
      technicalChanges.push({
        field, label,
        before: oldVal, after: newVal,
        improved: Boolean(newVal) && !Boolean(oldVal),
      });
    }
  };

  checkField('hasSSL', 'SSL/HTTPS', newScan.hasSSL, baseline.hasSSL);
  checkField('hasSitemap', 'Sitemap.xml', newScan.hasSitemap, baseline.hasSitemap);
  checkField('hasRobotsTxt', 'Robots.txt', newScan.hasRobotsTxt, baseline.hasRobotsTxt);
  checkField('structuredData', 'Schema מובנה', newScan.structuredData, baseline.structuredData);
  checkField('openGraph', 'Open Graph', newScan.openGraph, baseline.openGraph);
  checkField('canonicalTags', 'Canonical Tags', newScan.canonicalTags, baseline.canonicalTags);
  if (newScan.metaTitle !== baseline.metaTitle) {
    technicalChanges.push({ field: 'metaTitle', label: 'כותרת האתר', before: baseline.metaTitle, after: newScan.metaTitle, improved: !!newScan.metaTitle });
  }
  if (newScan.metaDescription !== baseline.metaDescription) {
    technicalChanges.push({ field: 'metaDescription', label: 'תיאור מטא', before: baseline.metaDescription, after: newScan.metaDescription, improved: !!newScan.metaDescription });
  }

  // Visibility comparison
  const currentAiQueries = newScan.aiQueries || [];
  const baselineAiQueries = planAny.baselineAiQueries || planAny.websiteScan?.aiQueries || [];
  const currentMentions = currentAiQueries.filter((q: any) => q.found).length;
  const baselineMentions = baselineAiQueries.filter((q: any) => q.found).length;
  const visibilityScore = planAny.visibilityScore || 0;

  // Build wins and issues
  const wins: string[] = [];
  const issues: string[] = [];

  if (technicalScore > baselineTechScore) wins.push(`ציון טכני עלה מ-${baselineTechScore} ל-${technicalScore}`);
  if (technicalScore < baselineTechScore) issues.push(`ציון טכני ירד מ-${baselineTechScore} ל-${technicalScore}`);
  if (currentMentions > baselineMentions) wins.push(`אזכורים ב-AI עלו מ-${baselineMentions} ל-${currentMentions}`);
  if (currentMentions < baselineMentions) issues.push(`אזכורים ב-AI ירדו מ-${baselineMentions} ל-${currentMentions}`);

  for (const change of technicalChanges) {
    if (change.improved) wins.push(`${change.label} תוקן/נוסף`);
    else if (!change.after && change.before) issues.push(`${change.label} נעלם`);
  }

  if (newScan.loadTimeMs < (baseline.loadTimeMs || 99999)) wins.push(`זמן טעינה השתפר: ${newScan.loadTimeMs}ms`);
  if (newScan.loadTimeMs > (baseline.loadTimeMs || 0) + 500) issues.push(`זמן טעינה עלה: ${newScan.loadTimeMs}ms`);

  // Generate Hebrew summary
  const summaryParts: string[] = [];
  if (wins.length > 0) summaryParts.push(`הישגים: ${wins.join(', ')}`);
  if (issues.length > 0) summaryParts.push(`דורש שיפור: ${issues.join(', ')}`);
  if (summaryParts.length === 0) summaryParts.push('ללא שינויים משמעותיים מאז הסריקה הקודמת');
  const summary = summaryParts.join('. ');

  // ── Append to scan history ──
  const scanHistory = [...(planAny.scanHistory || [])];
  scanHistory.push({
    scanId: crypto.randomUUID(),
    scannedAt: now,
    websiteScan: newScan,
    keywordRanks: (planAny.clientKeywords || []).map((kw: any) => ({
      keyword: typeof kw === 'string' ? kw : kw.keyword,
      rank: typeof kw === 'string' ? null : (kw.currentRank || null),
    })),
    visibilityScore,
    technicalScore,
    overallScore: Math.round((technicalScore + visibilityScore) / 2),
    summary,
  });

  // ── Save to DB ──
  const updated = await updatePlanSafe(planId, {
    ...baselineUpdate,
    websiteScan: newScan,
    scanHistory,
    lastRescanAt: now,
  } as any);

  if (!updated) {
    console.error('[RESCAN] updatePlanSafe returned null');
    return err('שגיאה בשמירת תוצאות הסריקה', 500);
  }
  console.log(`[RESCAN] Saved successfully. Technical: ${technicalScore}, Scans: ${scanHistory.length}`);

  logActivity(planId, 'rescan', {
    technicalScore,
    baselineTechScore,
    wins: wins.length,
    issues: issues.length,
    isFirstRescan,
    loadTimeMs: newScan.loadTimeMs,
  });

  return ok({
    status: 'success',
    isFirstRescan,
    comparison: {
      technicalChanges,
      visibilityChanges: {
        currentMentions,
        baselineMentions,
        change: currentMentions - baselineMentions,
      },
      wins,
      issues,
      summary,
    },
    scores: {
      technical: technicalScore,
      technicalBaseline: baselineTechScore,
      visibility: visibilityScore,
      overall: Math.round((technicalScore + visibilityScore) / 2),
    },
    scanHistory,
    baseline: isFirstRescan ? { capturedAt: now } : { capturedAt: planAny.baselineCapturedAt },
  });
});
