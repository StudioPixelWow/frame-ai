/**
 * Core Web Vitals & PageSpeed Monitor
 * Uses Google PageSpeed Insights API (free tier)
 * All user-facing text in Hebrew
 */

const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// ── Interfaces ────────────────────────────────────────────────────────────────

export type VitalScore = 'good' | 'needs-improvement' | 'poor';

export interface VitalMetric {
  value: number;
  score: VitalScore;
}

export interface PageSpeedOpportunity {
  title: string;
  description: string;
  savings: string;
}

export interface PageSpeedDiagnostic {
  title: string;
  description: string;
}

export interface PageSpeedResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  performanceScore: number;
  lcp: VitalMetric;
  inp: VitalMetric;
  cls: VitalMetric;
  fcp: VitalMetric;
  ttfb: VitalMetric;
  opportunities: PageSpeedOpportunity[];
  diagnostics: PageSpeedDiagnostic[];
  screenshot?: string;
  analyzedAt: string;
}

// ── In-memory cache (24 hours) ────────────────────────────────────────────────

const cache = new Map<string, { result: PageSpeedResult; expires: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(url: string, strategy: string): string {
  return `${strategy}:${url}`;
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Full PageSpeed analysis for a URL
 */
export async function analyzeUrl(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<PageSpeedResult> {
  const cacheKey = getCacheKey(url, strategy);
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  const params = new URLSearchParams({
    url,
    strategy,
    category: 'performance',
  });
  if (apiKey) {
    params.set('key', apiKey);
  }

  const response = await fetch(`${PAGESPEED_API}?${params.toString()}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`שגיאת PageSpeed API (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const lighthouse = data.lighthouseResult;

  if (!lighthouse) {
    throw new Error('לא התקבל ניתוח Lighthouse');
  }

  const audits = lighthouse.audits || {};
  const categories = lighthouse.categories || {};

  // Extract performance score
  const performanceScore = Math.round((categories.performance?.score || 0) * 100);

  // Extract Core Web Vitals
  const lcp = extractMetric(audits['largest-contentful-paint'], 2500, 4000);
  const inp = extractMetric(audits['interaction-to-next-paint'] || audits['max-potential-fid'], 200, 500);
  const cls = extractCLS(audits['cumulative-layout-shift']);
  const fcp = extractMetric(audits['first-contentful-paint'], 1800, 3000);
  const ttfb = extractMetric(audits['server-response-time'], 800, 1800);

  // Extract opportunities
  const opportunities: PageSpeedOpportunity[] = [];
  const opportunityAudits = Object.values(audits).filter(
    (a: any) => a.details?.type === 'opportunity' && a.details?.overallSavingsMs > 0
  );
  for (const audit of opportunityAudits as any[]) {
    opportunities.push({
      title: audit.title || '',
      description: audit.description || '',
      savings: `${Math.round(audit.details.overallSavingsMs)}ms`,
    });
  }

  // Extract diagnostics
  const diagnostics: PageSpeedDiagnostic[] = [];
  const diagnosticAudits = Object.values(audits).filter(
    (a: any) => a.details?.type === 'table' && a.score !== null && a.score < 0.9
  );
  for (const audit of (diagnosticAudits as any[]).slice(0, 10)) {
    diagnostics.push({
      title: audit.title || '',
      description: audit.description || '',
    });
  }

  // Screenshot
  const screenshot = audits['final-screenshot']?.details?.data || undefined;

  const result: PageSpeedResult = {
    url,
    strategy,
    performanceScore,
    lcp,
    inp,
    cls,
    fcp,
    ttfb,
    opportunities: opportunities.sort((a, b) => parseInt(b.savings) - parseInt(a.savings)),
    diagnostics,
    screenshot,
    analyzedAt: new Date().toISOString(),
  };

  // Cache
  cache.set(cacheKey, { result, expires: Date.now() + CACHE_TTL });

  return result;
}

/**
 * Get Core Web Vitals only (lightweight)
 */
export async function getCoreWebVitals(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<{ lcp: VitalMetric; inp: VitalMetric; cls: VitalMetric }> {
  const result = await analyzeUrl(url, strategy);
  return { lcp: result.lcp, inp: result.inp, cls: result.cls };
}

/**
 * Get performance score (0-100)
 */
export async function getPerformanceScore(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<number> {
  const result = await analyzeUrl(url, strategy);
  return result.performanceScore;
}

/**
 * Get actionable improvement opportunities
 */
export async function getOpportunities(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<PageSpeedOpportunity[]> {
  const result = await analyzeUrl(url, strategy);
  return result.opportunities;
}

/**
 * Get detailed diagnostics
 */
export async function getDiagnostics(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<PageSpeedDiagnostic[]> {
  const result = await analyzeUrl(url, strategy);
  return result.diagnostics;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractMetric(
  audit: any,
  goodThreshold: number,
  poorThreshold: number
): VitalMetric {
  if (!audit) {
    return { value: 0, score: 'poor' };
  }
  const value = audit.numericValue || 0;
  let score: VitalScore;
  if (value <= goodThreshold) {
    score = 'good';
  } else if (value <= poorThreshold) {
    score = 'needs-improvement';
  } else {
    score = 'poor';
  }
  return { value: Math.round(value), score };
}

function extractCLS(audit: any): VitalMetric {
  if (!audit) {
    return { value: 0, score: 'poor' };
  }
  const value = audit.numericValue || 0;
  let score: VitalScore;
  if (value <= 0.1) {
    score = 'good';
  } else if (value <= 0.25) {
    score = 'needs-improvement';
  } else {
    score = 'poor';
  }
  return { value: Math.round(value * 1000) / 1000, score };
}
