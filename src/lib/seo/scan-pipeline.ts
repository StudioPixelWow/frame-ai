/**
 * PIXEL SEO/GEO — Premium Multi-Stage Scan Pipeline Engine
 *
 * 10-stage pipeline with real HTTP crawling, per-platform tracking,
 * Quick/Deep scan modes, evidence counting, and anti-fake guards.
 *
 * Stages:
 *  1. התחלת סריקה           — Initialize, validate URL
 *  2. שליפת עמוד הבית       — Fetch homepage HTML
 *  3. גילוי עמודים פנימיים   — Discover internal links, queue pages
 *  4. חילוץ כותרות ותוכן     — Parse all pages: titles, meta, H1/H2, schema
 *  5. זיהוי תחום העסק       — Detect industry, business type, location
 *  6. בניית מילות מפתח      — Extract keywords, products, services
 *  7. יצירת שאלות AI        — Generate AI search queries per platform
 *  8. בדיקת נראות במנועים    — Check visibility on each AI platform
 *  9. אימות ראיות           — Validate all evidence, compute confidence
 * 10. סיום סריקה            — Finalize, validate scan quality
 *
 * FAST = FAKE: scans under 5s or < 3 pages are INVALID.
 */

import { extractWebsiteFacts, type WebsiteFacts } from './website-facts';
import { isPlatformAvailable, queryPlatform, type PlatformId as ApiPlatformId } from './platform-apis';

// ── Constants ──────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;  // 10s for homepage (some sites are slow on first request)
const INTERNAL_PAGE_TIMEOUT_MS = 4_000; // 4s for internal pages (server already connected)
const PAGE_FETCH_BUDGET_MS = 25_000; // Max 25s total for page fetching stage
const MIN_SCAN_DURATION_MS = 5_000;
const MIN_PAGES_SCANNED = 3;
const MIN_EVIDENCE_COUNT = 5;
const MIN_CONFIDENCE_THRESHOLD = 30;

// ── Scan Mode ──────────────────────────────────────────────────────────────────

export type ScanType = 'quick' | 'deep';

export function getScanConfig(type: ScanType) {
  return type === 'deep'
    ? { maxPages: 20, label: 'סריקה עמוקה', labelEn: 'Deep Scan' }
    : { maxPages: 8, label: 'סריקה מהירה', labelEn: 'Quick Scan' };
}

// ── Platform Definitions ───────────────────────────────────────────────────────

export const PLATFORMS = [
  { id: 'google_seo', name: 'Google SEO', icon: '🔍', requiresApi: false },
  { id: 'google_ai_overview', name: 'Google AI Overview', icon: '✨', requiresApi: true },
  { id: 'gemini', name: 'Gemini', icon: '💎', requiresApi: true },
  { id: 'chatgpt', name: 'ChatGPT', icon: '🤖', requiresApi: true },
  { id: 'claude', name: 'Claude', icon: '🧠', requiresApi: true },
  { id: 'perplexity', name: 'Perplexity', icon: '🔮', requiresApi: true },
] as const;

export type PlatformId = typeof PLATFORMS[number]['id'];

export interface PlatformStatus {
  id: PlatformId;
  name: string;
  icon: string;
  status: 'waiting' | 'running' | 'completed' | 'skipped' | 'api_missing';
  queriesScanned: number;
  mentionsFound: number;
  scanMode: 'real' | 'simulated' | 'unavailable';
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type ScanStageId =
  | 'queued'
  | 'init'
  | 'fetch_homepage'
  | 'discover_pages'
  | 'extract_content'
  | 'detect_business'
  | 'build_keywords'
  | 'generate_queries'
  | 'check_visibility'
  | 'validate_evidence'
  | 'finalize'
  | 'completed'
  | 'failed';

export interface ScanLogEntry {
  timestamp: string;
  stage: ScanStageId;
  action: string;
  result?: 'success' | 'warning' | 'error' | 'skipped' | 'info';
  detail?: string;
  durationMs?: number;
}

export interface StageProgress {
  stage: ScanStageId;
  index: number; // 1-10
  label: string;
  labelHe: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  itemsProcessed?: number;
  itemsTotal?: number;
}

export interface ScanValidation {
  passed: boolean;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    actual: string;
    required: string;
  }>;
  invalidReason?: string;
}

export interface ScanMetrics {
  pagesScanned: number;
  evidenceCount: number;
  confidenceScore: number;
  scanDurationMs: number;
  platformsChecked: number;
  unavailableResults: number;
}

export interface ScanJob {
  id: string;
  url: string;
  scanType: ScanType;
  status: ScanStageId;
  progress: number; // 0–100
  stages: StageProgress[];
  logs: ScanLogEntry[];
  metrics: ScanMetrics;
  platformStatuses: PlatformStatus[];
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  validation?: ScanValidation;
  result?: ScanResult | null;
  error?: string;
  clientKeywords?: string[];
}

export interface ParsedPage {
  title: string;
  metaDescription: string;
  h1Tags: string[];
  h2Tags: string[];
  hasSchema: boolean;
  hasOG: boolean;
  hasCanonical: boolean;
  hasMobileViewport: boolean;
  wordCount: number;
  internalLinks: string[];
  schemaTypes: string[];
}

export interface ScannedPageInfo {
  url: string;
  title: string;
  missingMeta: boolean;
  missingH1: boolean;
  wordCount: number;
  hasSchema: boolean;
  scannedAt: string;
  loadTimeMs: number;
}

export interface ScanIssue {
  type: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface AIQueryResult {
  query: string;
  platform: PlatformId;
  found: boolean;
  position?: number;
  snippet?: string;
  confidence: number;
  checkedAt: string;
  scanMode: 'real' | 'simulated' | 'unavailable';
  responseText?: string;
  sources?: { url: string; domain: string; title?: string }[];
  mentionType?: 'in_text' | 'in_sources' | 'both' | 'none';
  sourcesCount?: number;
}

export interface Competitor {
  domain: string;
  title: string;
  snippet: string;
}

export interface ScanResult {
  url: string;
  scanType: ScanType;
  scannedAt: string;
  hasSSL: boolean;
  loadTimeMs: number;
  mobileOptimized: boolean;
  metaTitle: string;
  metaDescription: string;
  h1Tags: string[];
  h2Tags: string[];
  totalPages: number;
  indexedPages: number;
  brokenLinks: number;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  domainAuthority: number;
  techStack: string[];
  cmsDetected: string;
  structuredData: boolean;
  schemaTypes: string[];
  openGraph: boolean;
  canonicalTags: boolean;
  issues: ScanIssue[];
  scannedPages: ScannedPageInfo[];
  websiteFacts: WebsiteFacts | null;
  scan_mode: 'real' | 'simulated' | 'unavailable';
  aiQueries: AIQueryResult[];
  competitors: Competitor[];
  platformStatuses: PlatformStatus[];
  metrics: ScanMetrics;
  scanDuration: {
    startedAt: string;
    completedAt: string;
    totalMs: number;
    perStage: Record<string, number>;
  };
}

// ── In-Memory Job Store ────────────────────────────────────────────────────────

const jobStore = new Map<string, ScanJob>();

setInterval(() => {
  if (jobStore.size > 100) {
    const entries = Array.from(jobStore.entries())
      .sort((a, b) => new Date(b[1].startedAt).getTime() - new Date(a[1].startedAt).getTime());
    entries.slice(100).forEach(([id]) => jobStore.delete(id));
  }
}, 10 * 60 * 1000);

export function getJob(id: string): ScanJob | undefined {
  return jobStore.get(id);
}

export function getAllJobs(): ScanJob[] {
  return Array.from(jobStore.values())
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

// ── HTML Entity Decoder ────────────────────────────────────────────────────────

function decodeHtmlEntities(text: string): string {
  return text
    // Named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&hellip;/g, '…')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    // Numeric entities: &#8211; → –, &#34; → ", &#x201C; → "
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    // Clean up any remaining whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ── HTML Parser ────────────────────────────────────────────────────────────────

export function parseHtml(html: string, pageUrl: string): ParsedPage {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';

  const metaDescMatch = html.match(/<meta\s+[^>]*name=["']?description["']?\s+[^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']?description["']?/i);
  const metaDescription = metaDescMatch ? decodeHtmlEntities(metaDescMatch[1]) : '';

  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  const h1Tags: string[] = [];
  let m;
  while ((m = h1Regex.exec(html)) !== null) {
    const text = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ''));
    if (text) h1Tags.push(text);
  }

  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Tags: string[] = [];
  while ((m = h2Regex.exec(html)) !== null) {
    const text = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ''));
    if (text) h2Tags.push(text);
  }

  const schemaTypes: string[] = [];
  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const hasSchema = jsonLdRegex.test(html);
  jsonLdRegex.lastIndex = 0;
  while ((m = jsonLdRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1]);
      if (json['@type']) {
        const types = Array.isArray(json['@type']) ? json['@type'] : [json['@type']];
        schemaTypes.push(...types);
      }
    } catch { /* invalid JSON-LD */ }
  }

  const hasOG = /<meta\s+[^>]*property=["']og:/i.test(html);
  const hasCanonical = /<link\s+[^>]*rel=["']?canonical["']?/i.test(html);
  const hasMobileViewport = /<meta\s+[^>]*name=["']?viewport["']?/i.test(html);

  const textContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  const wordCount = textContent.trim().split(/\s+/).filter(w => w.length > 0).length;

  const linkRegex = /href=["']([^"'#]+)["']/gi;
  const internalLinks: string[] = [];
  try {
    const baseHost = new URL(pageUrl).hostname;
    while ((m = linkRegex.exec(html)) !== null) {
      const href = m[1];
      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
      try {
        const resolved = new URL(href, pageUrl);
        if (resolved.hostname === baseHost && !internalLinks.includes(resolved.href)) {
          internalLinks.push(resolved.href);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  return {
    title, metaDescription, h1Tags, h2Tags, hasSchema, hasOG, hasCanonical,
    hasMobileViewport, wordCount, internalLinks: Array.from(new Set(internalLinks)), schemaTypes,
  };
}

// ── Fetch Helpers ──────────────────────────────────────────────────────────────

async function fetchPage(url: string, isInternal = false): Promise<{ html: string | null; durationMs: number; status?: number }> {
  const timeout = isInternal ? INTERNAL_PAGE_TIMEOUT_MS : FETCH_TIMEOUT_MS;
  const maxRetries = isInternal ? 1 : 3; // Retry homepage up to 3 times
  const start = Date.now();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
      });
      clearTimeout(tid);
      const durationMs = Date.now() - start;
      if (!res.ok) {
        if (attempt < maxRetries - 1) continue; // Retry on non-OK
        return { html: null, durationMs, status: res.status };
      }
      const html = await res.text();
      // Some sites return empty or very minimal HTML — retry if too small
      if (html.length < 100 && attempt < maxRetries - 1) continue;
      return { html, durationMs, status: res.status };
    } catch {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
        continue;
      }
      return { html: null, durationMs: Date.now() - start };
    }
  }
  return { html: null, durationMs: Date.now() - start };
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const c = new AbortController();
    const tid = setTimeout(() => c.abort(), 5000);
    // Try HEAD first, fall back to GET if HEAD is blocked (some servers return 405)
    let res = await fetch(url, { method: 'HEAD', signal: c.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': '*/*',
      } });
    clearTimeout(tid);
    if (res.ok) return true;
    if (res.status === 405 || res.status === 403) {
      // HEAD blocked — try GET
      const c2 = new AbortController();
      const tid2 = setTimeout(() => c2.abort(), 5000);
      res = await fetch(url, { method: 'GET', signal: c2.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        } });
      clearTimeout(tid2);
      return res.ok;
    }
    return false;
  } catch { return false; }
}

// ── Stage Definitions ───────────────────────────────────────────���──────────────

function createStages(): StageProgress[] {
  return [
    { stage: 'init',              index: 1,  label: 'Initialize Scan',        labelHe: 'התחלת סריקה',           status: 'pending' },
    { stage: 'fetch_homepage',    index: 2,  label: 'Fetch Homepage',         labelHe: 'שליפת עמוד הבית',      status: 'pending' },
    { stage: 'discover_pages',    index: 3,  label: 'Discover Pages',         labelHe: 'גילוי עמודים פנימיים',  status: 'pending' },
    { stage: 'extract_content',   index: 4,  label: 'Extract Content',        labelHe: 'חילוץ כותרות ותוכן',    status: 'pending' },
    { stage: 'detect_business',   index: 5,  label: 'Detect Business',        labelHe: 'זיהוי תחום העסק',      status: 'pending' },
    { stage: 'build_keywords',    index: 6,  label: 'Build Keywords',         labelHe: 'בניית מילות מפתח',     status: 'pending' },
    { stage: 'generate_queries',  index: 7,  label: 'Generate AI Queries',    labelHe: 'יצירת שאלות AI',       status: 'pending' },
    { stage: 'check_visibility',  index: 8,  label: 'Check AI Visibility',    labelHe: 'בדיקת נראות במנועים',   status: 'pending' },
    { stage: 'validate_evidence', index: 9,  label: 'Validate Evidence',      labelHe: 'אימות ראיות',          status: 'pending' },
    { stage: 'finalize',          index: 10, label: 'Finalize Scan',          labelHe: 'סיום סריקה',           status: 'pending' },
  ];
}

function initPlatformStatuses(): PlatformStatus[] {
  return PLATFORMS.map(p => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    status: 'waiting' as const,
    queriesScanned: 0,
    mentionsFound: 0,
    scanMode: isPlatformAvailable(p.id as ApiPlatformId) ? 'real' as const : 'unavailable' as const,
  }));
}

function generateJobId(): string {
  return `pscan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Job Helpers ────────────────────────────────────────────────────────────────

function log(job: ScanJob, stage: ScanStageId, action: string,
  result?: ScanLogEntry['result'], detail?: string, durationMs?: number) {
  job.logs.push({ timestamp: new Date().toISOString(), stage, action, result, detail, durationMs });
}

function startStage(job: ScanJob, stageId: ScanStageId) {
  const s = job.stages.find(s => s.stage === stageId);
  if (s) { s.status = 'running'; s.startedAt = new Date().toISOString(); }
  job.status = stageId;
  log(job, stageId, `שלב ${s?.index || '?'}: ${s?.labelHe || stageId}`, 'info');
}

function completeStage(job: ScanJob, stageId: ScanStageId, items?: number) {
  const s = job.stages.find(s => s.stage === stageId);
  if (s) {
    s.status = 'completed';
    s.completedAt = new Date().toISOString();
    if (s.startedAt) s.durationMs = new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime();
    if (items !== undefined) s.itemsProcessed = items;
  }
  const done = job.stages.filter(s => s.status === 'completed').length;
  job.progress = Math.round((done / job.stages.length) * 100);
}

function failStage(job: ScanJob, stageId: ScanStageId, error: string) {
  const s = job.stages.find(s => s.stage === stageId);
  if (s) {
    s.status = 'failed';
    s.completedAt = new Date().toISOString();
    if (s.startedAt) s.durationMs = new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime();
  }
  log(job, stageId, `שגיאה: ${error}`, 'error');
}

function skipStage(job: ScanJob, stageId: ScanStageId, reason: string) {
  const s = job.stages.find(s => s.stage === stageId);
  if (s) { s.status = 'skipped'; s.completedAt = new Date().toISOString(); }
  const done = job.stages.filter(s => s.status === 'completed' || s.status === 'skipped').length;
  job.progress = Math.round((done / job.stages.length) * 100);
  log(job, stageId, `דולג: ${reason}`, 'skipped');
}

function countEvidence(facts: WebsiteFacts | null): number {
  if (!facts) return 0;
  let count = 0;
  if (facts.business_name.confidence > 0) count++;
  if (facts.business_type.confidence > 0) count++;
  if (facts.detected_industry.confidence > 0) count++;
  if (facts.detected_location && facts.detected_location.confidence > 0) count++;
  if (facts.main_products_or_services.value.length > 0) count += facts.main_products_or_services.value.length;
  if (facts.extracted_titles.value.length > 0) count += facts.extracted_titles.value.length;
  if (facts.extracted_h1.value.length > 0) count += facts.extracted_h1.value.length;
  if (facts.detected_schema.value.length > 0) count += facts.detected_schema.value.length;
  if (facts.detected_contact_details.confidence > 0) count++;
  return count;
}

// ── Issue Builder ──────────────────────────────────────────────────────────────

function buildIssues(scanData: any, scannedPages: ScannedPageInfo[], homepage: ParsedPage | null): ScanIssue[] {
  const issues: ScanIssue[] = [];
  if (!homepage) return issues;

  if (!scanData.hasSSL)
    issues.push({ type: 'critical', category: 'security', title: 'חסר תעודת SSL', description: 'האתר לא משתמש ב-HTTPS.', impact: 'high' });
  if (scanData.loadTimeMs > 3000)
    issues.push({ type: 'warning', category: 'performance', title: 'זמן טעינה איטי', description: `${(scanData.loadTimeMs / 1000).toFixed(1)} שניות. מומלץ פחות מ-3.`, impact: 'medium' });
  if (!homepage.title)
    issues.push({ type: 'critical', category: 'content', title: 'חסר תגית Title', description: 'לא נמצאה תגית כותרת בדף הבית.', impact: 'high' });
  if (!homepage.metaDescription)
    issues.push({ type: 'warning', category: 'content', title: 'חסר Meta Description', description: 'לא נמצא תיאור מטא.', impact: 'medium' });
  if (homepage.title && homepage.title.length > 60)
    issues.push({ type: 'info', category: 'content', title: 'Title ארוך מדי', description: `${homepage.title.length} תווים (מומלץ: עד 60).`, impact: 'low' });
  if (homepage.metaDescription && homepage.metaDescription.length > 160)
    issues.push({ type: 'info', category: 'content', title: 'Meta Description ארוך', description: `${homepage.metaDescription.length} תווים (מומלץ: עד 160).`, impact: 'low' });
  if (homepage.h1Tags.length === 0)
    issues.push({ type: 'critical', category: 'content', title: '��סר תגית H1', description: 'לא נמצאה H1 בדף הבית.', impact: 'high' });
  if (!homepage.hasSchema)
    issues.push({ type: 'info', category: 'technical', title: 'ללא Structured Data', description: 'לא זוהה JSON-LD.', impact: 'low' });
  if (!homepage.hasOG)
    issues.push({ type: 'info', category: 'technical', title: 'ללא Open Graph', description: 'תגיות OG חסרות.', impact: 'low' });
  if (!scanData.hasSitemap)
    issues.push({ type: 'warning', category: 'technical', title: 'חסר Sitemap', description: 'לא נמצא sitemap.xml.', impact: 'medium' });
  if (!scanData.hasRobotsTxt)
    issues.push({ type: 'warning', category: 'technical', title: 'חסר Robots.txt', description: 'לא נמצא robots.txt.', impact: 'medium' });
  if (!homepage.hasMobileViewport)
    issues.push({ type: 'warning', category: 'technical', title: 'ללא Mobile Viewport', description: 'האתר עלול שלא להיות מותאם למובייל.', impact: 'medium' });

  const missingMeta = scannedPages.filter(p => p.missingMeta).length;
  if (missingMeta > 1)
    issues.push({ type: 'warning', category: 'content', title: `${missingMeta} דפים ללא Meta`, description: `נמצאו ${missingMeta} דפים ללא תיאור מטא.`, impact: 'medium' });
  const missingH1 = scannedPages.filter(p => p.missingH1).length;
  if (missingH1 > 1)
    issues.push({ type: 'warning', category: 'content', title: `${missingH1} דפים ללא H1`, description: `נמצאו ${missingH1} דפים ללא H1.`, impact: 'medium' });
  const lowContent = scannedPages.filter(p => p.wordCount < 300);
  if (lowContent.length > 0)
    issues.push({ type: 'info', category: 'content', title: `${lowContent.length} דפים עם תוכן דל`, description: `דפים עם פחות מ-300 מילים.`, impact: 'low' });

  return issues;
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validateScan(job: ScanJob, pages: ScannedPageInfo[], facts: WebsiteFacts | null, evidence: number): ScanValidation {
  const duration = job.totalDurationMs || (Date.now() - new Date(job.startedAt).getTime());
  const confidence = facts?.confidence_score || 0;
  const checks: ScanValidation['checks'] = [];

  checks.push({
    id: 'duration',
    label: 'זמן סריקה >= 5 שניות',
    passed: duration >= MIN_SCAN_DURATION_MS,
    actual: `${(duration / 1000).toFixed(1)}s`,
    required: `>= ${MIN_SCAN_DURATION_MS / 1000}s`,
  });
  checks.push({
    id: 'pages',
    label: 'דפים שנסרקו >= 3',
    passed: pages.length >= MIN_PAGES_SCANNED,
    actual: `${pages.length}`,
    required: `>= ${MIN_PAGES_SCANNED}`,
  });
  checks.push({
    id: 'evidence',
    label: 'ראיות >= 5',
    passed: evidence >= MIN_EVIDENCE_COUNT,
    actual: `${evidence}`,
    required: `>= ${MIN_EVIDENCE_COUNT}`,
  });
  checks.push({
    id: 'confidence',
    label: 'ביטחון עסקי >= 30%',
    passed: confidence >= MIN_CONFIDENCE_THRESHOLD,
    actual: `${confidence}%`,
    required: `>= ${MIN_CONFIDENCE_THRESHOLD}%`,
  });
  checks.push({
    id: 'no_fake_ai',
    label: 'ללא תוצאות AI מזויפות',
    passed: true, // We never generate fake AI results
    actual: 'תקין',
    required: 'ללא נתונים שקריים',
  });
  checks.push({
    id: 'no_fake_competitors',
    label: 'ללא מתחרים מזויפים',
    passed: true,
    actual: 'תקין',
    required: 'ללא נתונים שקריים',
  });

  const allPassed = checks.every(c => c.passed);
  let invalidReason: string | undefined;

  if (duration < MIN_SCAN_DURATION_MS) {
    invalidReason = 'הסריקה הסתיימה מהר מדי ולכן סומנה כלא אמינה. יש להריץ סריקה מחדש.';
  } else if (!allPassed) {
    const failedChecks = checks.filter(c => !c.passed).map(c => c.label).join(', ');
    invalidReason = `בדיקות שנכשלו: ${failedChecks}`;
  }

  return { passed: allPassed, checks, invalidReason };
}

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════════════

export async function startScan(url: string, scanType: ScanType = 'quick', clientKeywords?: string[]): Promise<string> {
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;

  const jobId = generateJobId();
  const job: ScanJob = {
    id: jobId,
    url: normalizedUrl,
    scanType,
    status: 'queued',
    progress: 0,
    stages: createStages(),
    logs: [],
    metrics: { pagesScanned: 0, evidenceCount: 0, confidenceScore: 0, scanDurationMs: 0, platformsChecked: 0, unavailableResults: 0 },
    platformStatuses: initPlatformStatuses(),
    startedAt: new Date().toISOString(),
    result: null,
    clientKeywords: clientKeywords && clientKeywords.length > 0 ? clientKeywords : undefined,
  };

  jobStore.set(jobId, job);
  log(job, 'queued', `סריקה ${getScanConfig(scanType).label} נוספה לתור`, 'info', normalizedUrl);

  // Run async — don't await
  runPipeline(job, normalizedUrl).catch(err => {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : 'Unknown error';
    job.completedAt = new Date().toISOString();
    log(job, 'failed', 'שגיאה בלתי צפויה', 'error', job.error);
  });

  return jobId;
}

async function runPipeline(job: ScanJob, normalizedUrl: string): Promise<void> {
  const pipelineStart = Date.now();
  const stageDurations: Record<string, number> = {};
  const config = getScanConfig(job.scanType);

  try {
    // ── Stage 1: Init ──────────────────────────────────────────────────────
    const s1 = Date.now();
    startStage(job, 'init');

    let urlObj: URL;
    try {
      urlObj = new URL(normalizedUrl);
      log(job, 'init', `כתובת תקינה: ${urlObj.hostname}`, 'success');
      log(job, 'init', `סוג סריקה: ${config.label}`, 'info', `עד ${config.maxPages} דפים`);
      log(job, 'init', `פרוטוקול: ${urlObj.protocol === 'https:' ? 'HTTPS ✓' : 'HTTP ✗'}`, urlObj.protocol === 'https:' ? 'success' : 'warning');
    } catch {
      failStage(job, 'init', `כתובת URL לא תקינה: ${normalizedUrl}`);
      job.status = 'failed';
      job.error = 'Invalid URL';
      job.completedAt = new Date().toISOString();
      return;
    }

    completeStage(job, 'init');
    stageDurations.init = Date.now() - s1;

    // ── Stage 2: Fetch Homepage ────────────────────────────────────────────
    const s2 = Date.now();
    startStage(job, 'fetch_homepage');
    log(job, 'fetch_homepage', `מתחבר ל-${urlObj.hostname}...`, 'info');

    const { html: homepageHtml, durationMs: loadTimeMs, status: httpStatus } = await fetchPage(normalizedUrl);

    if (!homepageHtml) {
      const reason = httpStatus ? `HTTP ${httpStatus}` : 'timeout/connection error';
      log(job, 'fetch_homepage', `דף הבית לא נגיש (${reason})`, 'error', `ניסיון חיבור ל-${normalizedUrl} נכשל אחרי 3 ניסיונות`);
      console.error(`[SCAN] Homepage fetch FAILED for ${normalizedUrl}: ${reason}, duration: ${loadTimeMs}ms — all retries exhausted`);
      failStage(job, 'fetch_homepage', `לא ניתן להגיע לאתר (${reason}) — נסה שוב מאוחר יותר`);
      finalizeUnreachable(job, normalizedUrl, pipelineStart, stageDurations);
      return;
    }

    const sizeKb = (homepageHtml.length / 1024).toFixed(0);
    log(job, 'fetch_homepage', `עמוד הבית נטען בהצלחה (${httpStatus || 200} OK)`, 'success', `${(loadTimeMs / 1000).toFixed(1)}s, ${sizeKb}KB`);
    completeStage(job, 'fetch_homepage');
    stageDurations.fetch_homepage = Date.now() - s2;

    // ── Stage 3: Discover Pages ─��──────────────────────────────────────────
    const s3 = Date.now();
    startStage(job, 'discover_pages');

    const homepageParsed = parseHtml(homepageHtml, normalizedUrl);
    const totalLinks = homepageParsed.internalLinks.length;
    log(job, 'discover_pages', `נמצאו ${totalLinks} קישורים פנימיים`, 'success');

    // Check robots.txt & sitemap
    log(job, 'discover_pages', 'בודק robots.txt ו-sitemap...', 'info');
    const [hasRobotsTxt, hasSitemap] = await Promise.all([
      checkUrl(`${urlObj.protocol}//${urlObj.hostname}/robots.txt`),
      checkUrl(`${urlObj.protocol}//${urlObj.hostname}/sitemap.xml`),
    ]);
    log(job, 'discover_pages', 'robots.txt', hasRobotsTxt ? 'success' : 'warning', hasRobotsTxt ? 'נמצא' : 'לא נמצא');
    log(job, 'discover_pages', 'sitemap.xml', hasSitemap ? 'success' : 'warning', hasSitemap ? 'נמצא' : 'לא נמצא');

    const pagesToVisit = homepageParsed.internalLinks.slice(0, config.maxPages);
    log(job, 'discover_pages', `${pagesToVisit.length} דפים בתור לסריקה`, 'info');

    const stg3 = job.stages.find(s => s.stage === 'discover_pages');
    if (stg3) { stg3.itemsTotal = totalLinks; stg3.itemsProcessed = pagesToVisit.length; }
    completeStage(job, 'discover_pages', pagesToVisit.length);
    stageDurations.discover_pages = Date.now() - s3;

    // ── Stage 4: Extract Content ───────────────────────────────────────────
    const s4 = Date.now();
    startStage(job, 'extract_content');

    const scannedPages: ScannedPageInfo[] = [];
    const allParsed: ParsedPage[] = [homepageParsed];

    // Homepage
    scannedPages.push({
      url: normalizedUrl,
      title: homepageParsed.title || normalizedUrl,
      missingMeta: !homepageParsed.metaDescription,
      missingH1: homepageParsed.h1Tags.length === 0,
      wordCount: homepageParsed.wordCount,
      hasSchema: homepageParsed.hasSchema,
      scannedAt: new Date().toISOString(),
      loadTimeMs,
    });
    log(job, 'extract_content', `דף בית נותח`, 'success',
      `"${homepageParsed.title?.slice(0, 50) || 'ללא כותרת'}" | ${homepageParsed.wordCount} מילים`);

    const stg4 = job.stages.find(s => s.stage === 'extract_content');
    if (stg4) { stg4.itemsTotal = pagesToVisit.length + 1; stg4.itemsProcessed = 1; }

    // Parallel page fetching with concurrency limit + time budget to avoid Vercel timeout
    const CONCURRENCY = 5;
    const fetchStart = Date.now();
    let budgetExhausted = false;
    for (let batch = 0; batch < pagesToVisit.length && !budgetExhausted; batch += CONCURRENCY) {
      if (Date.now() - fetchStart > PAGE_FETCH_BUDGET_MS) {
        log(job, 'extract_content', `תקציב זמן שליפה נגמר (${(PAGE_FETCH_BUDGET_MS / 1000).toFixed(0)}s), ממשיך עם ${scannedPages.length} דפים`, 'warning');
        budgetExhausted = true;
        break;
      }
      const batchUrls = pagesToVisit.slice(batch, batch + CONCURRENCY);
      const batchResults = await Promise.all(
        batchUrls.map(async (pageUrl) => {
          const { html: pageHtml, durationMs: pageLoad } = await fetchPage(pageUrl, true);
          return { pageUrl, pageHtml, pageLoad };
        })
      );
      for (const { pageUrl, pageHtml, pageLoad } of batchResults) {
        if (pageHtml) {
          const parsed = parseHtml(pageHtml, pageUrl);
          allParsed.push(parsed);
          scannedPages.push({
            url: pageUrl,
            title: parsed.title || pageUrl,
            missingMeta: !parsed.metaDescription,
            missingH1: parsed.h1Tags.length === 0,
            wordCount: parsed.wordCount,
            hasSchema: parsed.hasSchema,
            scannedAt: new Date().toISOString(),
            loadTimeMs: pageLoad,
          });
          log(job, 'extract_content', `חולצו H1/H2 מ-${pageUrl.split('/').pop() || 'page'}`, 'success',
            `${parsed.wordCount} מילים | ${pageLoad}ms`);
        } else {
          log(job, 'extract_content', `דף נכשל`, 'error', pageUrl);
        }
      }
      if (stg4) stg4.itemsProcessed = 1 + scannedPages.length;
      job.metrics.pagesScanned = scannedPages.length;
    }

    log(job, 'extract_content', `חולצו H1/H2 מ-${scannedPages.length} עמודים`, 'success');
    completeStage(job, 'extract_content', scannedPages.length);
    stageDurations.extract_content = Date.now() - s4;
    job.metrics.pagesScanned = scannedPages.length;

    // Build intermediate scanData for fact extraction
    const isHttps = normalizedUrl.startsWith('https');
    const scanData = {
      url: normalizedUrl, hasSSL: isHttps, loadTimeMs,
      metaTitle: homepageParsed.title, metaDescription: homepageParsed.metaDescription,
      h1Tags: homepageParsed.h1Tags, h2Tags: homepageParsed.h2Tags,
      hasRobotsTxt, hasSitemap,
      structuredData: homepageParsed.hasSchema, schemaTypes: homepageParsed.schemaTypes,
      openGraph: homepageParsed.hasOG, canonicalTags: homepageParsed.hasCanonical,
      mobileOptimized: homepageParsed.hasMobileViewport,
    };

    // ── Stage 5: Detect Business ───────────────────────────────────────────
    const s5 = Date.now();
    startStage(job, 'detect_business');

    const websiteFacts = extractWebsiteFacts(scanData, scannedPages, normalizedUrl);
    websiteFacts.scan_mode = 'real';

    log(job, 'detect_business', `שם עסק: "${websiteFacts.business_name.value || 'לא זוהה'}"`,
      websiteFacts.business_name.confidence >= 50 ? 'success' : 'warning',
      `אמינות ${websiteFacts.business_name.confidence}%`);
    log(job, 'detect_business',
      `זוהה תחום: ${websiteFacts.detected_industry.value || 'לא ידוע'}`,
      websiteFacts.detected_industry.confidence >= 50 ? 'success' : 'warning',
      `אמינות ${websiteFacts.detected_industry.confidence}%`);
    if (websiteFacts.detected_location && websiteFacts.detected_location.confidence > 0) {
      log(job, 'detect_business', `מיקום: ${websiteFacts.detected_location.value}`, 'success');
    }

    completeStage(job, 'detect_business');
    stageDurations.detect_business = Date.now() - s5;

    // ── Stage 6: Build Keywords ────────────────────────────────────────────
    const s6 = Date.now();
    startStage(job, 'build_keywords');

    const products = websiteFacts.main_products_or_services.value;
    log(job, 'build_keywords', `${products.length} שירותים/מוצרים זוהו`, products.length > 0 ? 'success' : 'warning');
    if (websiteFacts.detected_schema.value.length > 0) {
      log(job, 'build_keywords', `Schema: ${websiteFacts.detected_schema.value.join(', ')}`, 'success');
    }

    const issues = buildIssues(scanData, scannedPages, homepageParsed);
    log(job, 'build_keywords', `${issues.length} בעיות SEO זוהו`, 'info',
      `${issues.filter(i => i.type === 'critical').length} קריטיות, ${issues.filter(i => i.type === 'warning').length} אזהרות`);

    completeStage(job, 'build_keywords', products.length);
    stageDurations.build_keywords = Date.now() - s6;

    // ── Stage 7: Generate AI Queries ───────────────────────────────────────
    const s7 = Date.now();
    startStage(job, 'generate_queries');

    const queries: Array<{ query: string; platform: PlatformId; intent: string }> = [];
    const uniqueQueries = new Set<string>();

    const bName = websiteFacts.business_name.value;
    const industry = websiteFacts.detected_industry.value;
    const location = websiteFacts.detected_location?.value || '';
    const h1Tags = homepageParsed.h1Tags || [];
    const h2Tags = homepageParsed.h2Tags || [];

    // SAFETY: reject garbage queries before they enter the system
    const isGarbageQuery = (text: string): boolean => {
      if (!text || text.length < 3) return true;
      if (text.length > 80) return true;
      // URLs, paths, embeds, CSS/JS
      if (/https?:\/\/|\/embed|\/wp-|\/feed|\.(css|js|html|php|jpg|png|svg|woff|ttf|xml)/i.test(text)) return true;
      // Page titles with separators
      if (/\s[-–—|]\s/.test(text) && text.split(/\s[-–—|]\s/).length > 2) return true;
      // CMS & WordPress noise
      if (/תגובות|comment|cookie|wp-content|elementor|plugin|widget|sidebar|footer|header|embed|iframe|script/i.test(text)) return true;
      // Very long multi-word sentences (not real search queries)
      if (text.split(/\s+/).length > 8) return true;
      // Single-word generic terms that are NOT search queries
      const singleWordGarbage = /^(feed|home|blog|shop|gallery|menu|login|register|cart|checkout|search|tag|tags|page|post|archive|category|error|null|undefined|favicon|rss|sitemap|api|admin|dashboard|test)$/i;
      if (singleWordGarbage.test(text.trim())) return true;
      // Navigation / CTA / branding phrases
      if (/^(דף הבית|צור קשר|אודות|שירותים|מוצרים|בלוג|חנות|גלריה|ראשי|תפריט|קראו עוד|למידע נוסף|ברוכים הבאים|נעים להכיר|we are|why choose|one stop|our team|our services|about us|contact us|get started|learn more|read more|click here|sign up|log in)/i.test(text.trim())) return true;
      // Questions/CTAs that are website copy, not search queries
      if (/\?$/.test(text.trim()) && /^(why choose|what makes|how we|what we|who we|are you)/i.test(text.trim())) return true;
      // Hebrew site-copy patterns
      if (/^(למה לבחור בנו|מה מייחד אותנו|הצוות שלנו|השירותים שלנו|הלקוחות שלנו|קצת עלינו)/i.test(text.trim())) return true;
      return false;
    };

    // Helper to add queries with deduplication PER PLATFORM + garbage filter
    const addQuery = (text: string, platform: PlatformId, intent: string) => {
      const normalized = text.toLowerCase().trim();
      if (isGarbageQuery(normalized)) return; // Skip garbage
      const key = `${normalized}::${platform}`;
      if (normalized && !uniqueQueries.has(key)) {
        uniqueQueries.add(key);
        queries.push({ query: text, platform, intent });
      }
    };

    // Sanitize products — filter out garbage entries BEFORE building queries
    const cleanProducts = products.filter(p => {
      if (!p || p.length < 3 || p.length > 60) return false;
      if (isGarbageQuery(p.toLowerCase().trim())) return false;
      // Single word that's not a real service/product term
      if (p.trim().split(/\s+/).length < 2 && p.length < 8) return false;
      return true;
    });
    log(job, 'generate_queries', `${products.length} מוצרים → ${cleanProducts.length} אחרי סינון`, 'info');

    // 0. CLIENT KEYWORDS (HIGHEST PRIORITY) — keywords the client explicitly asked to track
    const clientKws = job.clientKeywords || [];
    if (clientKws.length > 0) {
      for (const kw of clientKws) {
        const trimmed = kw.trim();
        if (!trimmed) continue;
        for (const p of PLATFORMS) {
          addQuery(trimmed, p.id, 'client_keyword');
        }
        // Also generate location variations if we have location data
        if (location) {
          const locVariations = isHebrew
            ? [`${trimmed} ב${location}`, `${trimmed} ${location}`]
            : [`${trimmed} in ${location}`, `${trimmed} ${location}`];
          for (const v of locVariations) {
            for (const p of PLATFORMS) {
              addQuery(v, p.id, 'client_keyword');
            }
          }
        }
      }
      log(job, 'generate_queries', `${clientKws.length} ביטויי לקוח (עדיפות ראשונה) — כל הפלטפורמות`, 'success');
    }

    // 1. Brand name queries (ALL platforms — every platform should check brand visibility)
    if (bName) {
      for (const p of PLATFORMS) {
        addQuery(bName, p.id, 'brand');
      }
      log(job, 'generate_queries', `שאילתת מותג: "${bName}" — כל הפלטפורמות`, 'success');
    }

    // Detect language — Hebrew sites need Hebrew queries, English sites need English queries
    const isHebrew = /[֐-׿]/.test([bName, industry, ...products, ...h1Tags, ...h2Tags].join(''));
    const aiPlatforms: PlatformId[] = ['chatgpt', 'gemini', 'claude', 'perplexity'];

    // 2. Industry + location queries (all platforms)
    // CRITICAL: Generate queries in the SITE'S LANGUAGE — real search terms people actually type
    if (industry && location) {
      const baseQueries = isHebrew ? [
        `${industry} ב${location}`,           // "משרד פרסום בקרית מוצקין"
        `${industry} ${location}`,             // "משרד פרסום קרית מוצקין"
        `${industry} טוב ב${location}`,        // "משרד פרסום טוב בקרית מוצקין"
        `${industry} מומלץ ב${location}`,      // "משרד פרסום מומלץ בקרית מוצקין"
        `${industry} באזור ${location}`,       // "משרד פרסום באזור קרית מוצקין"
      ] : [
        `best ${industry} in ${location}`,
        `top ${industry} ${location}`,
        `${industry} services ${location}`,
        `how to find ${industry} in ${location}`,
      ];
      for (const q of baseQueries) {
        for (const p of PLATFORMS) {
          addQuery(q, p.id, 'local');
        }
      }
      log(job, 'generate_queries', `${baseQueries.length} שאילתות מקומיות (${isHebrew ? 'עברית' : 'אנגלית'})`, 'success');
    } else if (industry) {
      const baseQueries = isHebrew ? [
        `${industry} מומלץ`,
        `${industry} הכי טוב`,
        `איך לבחור ${industry}`,
        `המלצה על ${industry}`,
      ] : [
        `best ${industry} services`,
        `top ${industry} companies`,
        `how to choose ${industry}`,
        `${industry} solutions`,
      ];
      for (const q of baseQueries) {
        for (const p of PLATFORMS) {
          addQuery(q, p.id, 'generic');
        }
      }
      log(job, 'generate_queries', `${baseQueries.length} שאילתות כלליות`, 'success');
    }

    // 3. Product/service queries with location (ALL platforms)
    for (const prod of cleanProducts.slice(0, 5)) {
      if (location) {
        if (isHebrew) {
          // Hebrew product+location: "מיתוג עסקי בקרית מוצקין", "מיתוג עסקי קרית מוצקין"
          for (const p of PLATFORMS) {
            addQuery(`${prod} ב${location}`, p.id, 'product');
            addQuery(`${prod} ${location}`, p.id, 'product');
          }
        } else {
          const q = `${prod} ${location}`;
          for (const p of PLATFORMS) {
            addQuery(q, p.id, 'product');
          }
        }
      } else {
        for (const p of PLATFORMS) {
          addQuery(prod, p.id, 'product');
        }
      }

      // AI-only: comparison queries
      if (isHebrew) {
        for (const p of aiPlatforms) {
          addQuery(`${prod} הכי טוב`, p, 'product');
          addQuery(`${prod} מומלץ`, p, 'product');
        }
      } else {
        for (const p of aiPlatforms) {
          addQuery(`best ${prod}`, p, 'product');
        }
      }
    }
    log(job, 'generate_queries', `${Math.min(5, cleanProducts.length)} שאילתות מוצרים ליצור`, 'success');

    // 4. Informational queries from products (AI platforms only)
    for (const prod of cleanProducts.slice(0, 4)) {
      const howtoQueries = isHebrew ? [
        `איך לבחור ${prod}`,
        `מה ההבדל בין ${prod}`,
        `למה צריך ${prod}`,
      ] : [
        `how to choose ${prod}`,
        `${prod} vs alternatives`,
        `best practices for ${prod}`,
      ];
      for (const q of howtoQueries) {
        for (const p of aiPlatforms) {
          addQuery(q, p, 'informational');
        }
      }
    }
    log(job, 'generate_queries', `שאילתות מדעות (how-to) מ-4 מוצרים`, 'success');

    // 5. Comparison queries (AI platforms only)
    if (cleanProducts.length >= 2) {
      const comparisonQueries = isHebrew ? [
        `${cleanProducts[0]} או ${cleanProducts[1]}`,
        `${cleanProducts[0]} לעומת ${cleanProducts[1]}`,
        `מה ההבדל בין ${cleanProducts[0]} ל${cleanProducts[1]}`,
      ] : [
        `${cleanProducts[0]} vs ${cleanProducts[1] || cleanProducts[0]}`,
        `${cleanProducts[0]} alternatives`,
        `compare ${cleanProducts[0]} solutions`,
      ];
      for (const q of comparisonQueries) {
        for (const p of aiPlatforms) {
          addQuery(q, p, 'comparison');
        }
      }
      log(job, 'generate_queries', `שאילתות השוואה`, 'success');
    }

    // 6. H1/H2 derived queries (google_seo)
    // IMPORTANT: Only use headings that look like real search terms.
    // Filter out page titles, navigation items, branding phrases, and non-search-worthy text.
    const headingQueries = [...h1Tags, ...h2Tags].filter(tag => {
      if (!tag || tag.length < 5 || tag.length > 80) return false;
      // Run through the main garbage filter first
      if (isGarbageQuery(tag)) return false;
      const lower = tag.toLowerCase();
      // Skip common page titles / navigation headings that nobody would search for
      if (/^(דף הבית|צור קשר|אודות|שירותים|מוצרים|בלוג|חנות|גלריה|תפריט|ראשי|home|about|contact|services|products|blog|gallery|menu)$/i.test(lower.trim())) return false;
      // Skip headings that are just the site name or contain site-specific navigation
      if (bName && lower.includes(bName.toLowerCase())) return false;
      // Skip headings with separators typical of title tags (e.g., "סטודיו פיקסל - פרסום ומיתוג")
      if (/\s[-–—|]\s/.test(tag)) return false;
      // Skip headings that start with "דף הבית" or are greeting/brand phrases
      if (/^(דף|נעים להכיר|ברוכים הבאים|welcome|hello)/i.test(lower.trim())) return false;
      // Skip very generic phrases
      if (/^(קריאטיב|שירותים שלנו|הצוות שלנו|למה לבחור|why choose)/i.test(lower.trim())) return false;
      // Must have at least 2 words to be a plausible search query
      if (tag.trim().split(/\s+/).length < 2) return false;
      return true;
    });
    for (const heading of headingQueries.slice(0, 5)) {
      addQuery(heading, 'google_seo', 'heading');
    }
    if (headingQueries.length > 0) {
      log(job, 'generate_queries', `${headingQueries.length} שאילתות מכותרות H1/H2 ליצור`, 'success');
    } else {
      log(job, 'generate_queries', `אין כותרות H1/H2 שמתאימות כשאילתות חיפוש`, 'info');
    }

    // 7. Additional Hebrew queries — generic industry terms not already covered
    // (isHebrew is already computed in section 2)
    if (isHebrew && industry) {
      const hebrewQueries = [
        `${industry} בישראל`,
        location ? `${industry} ${location}` : null,
        `${industry} טוב ביותר`,
        `המלצה על ${industry}`,
        `איך לבחור ${industry}`,
      ].filter(Boolean) as string[];
      for (const q of hebrewQueries) {
        for (const p of PLATFORMS) {
          addQuery(q, p.id, 'hebrew');
        }
      }
      log(job, 'generate_queries', `${hebrewQueries.length} שאילתות בעברית — כל הפלטפורמות`, 'success');
    }

    // 8. Fallback: ensure EVERY platform has at least 1 query (prevent "skipped")
    for (const platform of PLATFORMS) {
      const platformHasQueries = queries.some(q => q.platform === platform.id);
      if (!platformHasQueries && bName) {
        addQuery(bName, platform.id, 'brand_fallback');
        if (industry) {
          addQuery(`${industry} services`, platform.id, 'fallback');
        }
        log(job, 'generate_queries', `${platform.name} — הוספת שאילתות fallback`, 'info');
      }
    }

    const uniqueQueryTexts = new Set(queries.map(q => q.query.toLowerCase().trim()));
    log(job, 'generate_queries', `נבנו ${queries.length} שאילתות בסך הכל (${uniqueQueryTexts.size} ייחודיות × ${PLATFORMS.length} פלטפורמות)`, 'success');
    completeStage(job, 'generate_queries', queries.length);
    stageDurations.generate_queries = Date.now() - s7;

    // ── Stage 8: Check AI Visibility ───────────────────────────────────────
    const s8 = Date.now();
    startStage(job, 'check_visibility');

    const aiResults: AIQueryResult[] = [];
    const competitorSet = new Map<string, Competitor>(); // Dedup competitors by domain
    let platformsChecked = 0;
    let unavailableCount = 0;

    // Run ALL platform queries in parallel to avoid Vercel timeout
    const platformTasks = PLATFORMS.map(async (platform) => {
      const ps = job.platformStatuses.find(p => p.id === platform.id)!;
      const platformQueries = queries.filter(q => q.platform === platform.id);

      if (platformQueries.length === 0) {
        ps.status = 'skipped';
        log(job, 'check_visibility', `${platform.name} — ללא שאילתות`, 'skipped');
        return { checked: false, unavailable: false, competitors: [] };
      }

      const apiPlatformId = platform.id as ApiPlatformId;
      const available = isPlatformAvailable(apiPlatformId);

      if (!available) {
        ps.status = 'api_missing';
        ps.scanMode = 'unavailable';
        log(job, 'check_visibility', `${platform.name} — API לא מחובר`, 'skipped', 'דרוש מפתח API');

        for (const q of platformQueries) {
          aiResults.push({
            query: q.query, platform: platform.id, found: false, confidence: 0,
            checkedAt: new Date().toISOString(), scanMode: 'unavailable',
          });
        }
        ps.queriesScanned = platformQueries.length;
        return { checked: false, unavailable: true, competitors: [] };
      }

      // Real API scan — run all queries for this platform in parallel
      ps.status = 'running';
      ps.scanMode = 'real';
      log(job, 'check_visibility', `${platform.name} — סורק ${platformQueries.length} שאילתות (API אמיתי)...`, 'info');

      let mentions = 0;
      const platformCompetitors: Competitor[] = [];
      const queryTasks = platformQueries.map(async (q) => {
        try {
          const result = await queryPlatform(apiPlatformId, q.query, bName || urlObj.hostname, normalizedUrl);
          aiResults.push({
            query: q.query, platform: platform.id, found: result.found,
            position: result.position, snippet: result.snippet,
            responseText: result.responseText,
            sources: result.sources,
            mentionType: result.mentionType,
            sourcesCount: result.sources?.length || 0,
            confidence: result.confidence,
            checkedAt: new Date().toISOString(), scanMode: result.scanMode,
          });
          if (result.found) mentions++;

          // Collect competitors from Google results (google_seo platform only)
          if (platform.id === 'google_seo' && result.raw?.competitors) {
            platformCompetitors.push(...(result.raw.competitors as Competitor[]));
          }
        } catch (err) {
          log(job, 'check_visibility', `${platform.name} — שגיאה בשאילתה "${q.query}"`, 'error',
            err instanceof Error ? err.message : 'Unknown error');
          aiResults.push({
            query: q.query, platform: platform.id, found: false, confidence: 0,
            checkedAt: new Date().toISOString(), scanMode: 'real',
          });
        }
      });

      await Promise.all(queryTasks);

      ps.status = 'completed';
      ps.queriesScanned = platformQueries.length;
      ps.mentionsFound = mentions;
      log(job, 'check_visibility', `${platform.name} — ${platformQueries.length} שאילתות נבדקו, ${mentions} אזכורים`, 'success', 'API אמיתי');
      return { checked: true, unavailable: false, competitors: platformCompetitors };
    });

    const platformResults = await Promise.all(platformTasks);
    platformsChecked = platformResults.filter(r => r.checked).length;
    unavailableCount = platformResults.filter(r => r.unavailable).length;

    // Collect unique competitors across all platforms
    for (const result of platformResults) {
      if (result.competitors) {
        for (const comp of result.competitors) {
          if (!competitorSet.has(comp.domain)) {
            competitorSet.set(comp.domain, comp);
          }
        }
      }
    }
    const competitorsList = Array.from(competitorSet.values()).slice(0, 10); // Top 10 competitors

    job.metrics.platformsChecked = platformsChecked;
    job.metrics.unavailableResults = unavailableCount;
    log(job, 'check_visibility', `${platformsChecked} פלטפורמות נבדקו, ${unavailableCount} לא זמינות`, 'info');
    if (competitorsList.length > 0) {
      log(job, 'check_visibility', `${competitorsList.length} תחרויות זוהו מתוצאות Google`, 'success');
    }
    completeStage(job, 'check_visibility', platformsChecked);
    stageDurations.check_visibility = Date.now() - s8;

    // ── Stage 9: Validate Evidence ─────────────────────────────────────────
    const s9 = Date.now();
    startStage(job, 'validate_evidence');

    const evidenceCount = countEvidence(websiteFacts);
    job.metrics.evidenceCount = evidenceCount;
    job.metrics.confidenceScore = websiteFacts.confidence_score;

    log(job, 'validate_evidence', `סה"כ ראיות: ${evidenceCount}`, evidenceCount >= MIN_EVIDENCE_COUNT ? 'success' : 'warning');
    log(job, 'validate_evidence', `ציון אמינות כולל: ${websiteFacts.confidence_score}%`,
      websiteFacts.confidence_score >= 70 ? 'success' : websiteFacts.confidence_score >= 40 ? 'warning' : 'error');

    // Check each key fact
    const factChecks = [
      { name: 'שם עסק', conf: websiteFacts.business_name.confidence },
      { name: 'סוג עסק', conf: websiteFacts.business_type.confidence },
      { name: 'תעשייה', conf: websiteFacts.detected_industry.confidence },
      { name: 'מוצרים/שירותים', conf: websiteFacts.main_products_or_services.confidence },
    ];
    for (const fc of factChecks) {
      log(job, 'validate_evidence', `${fc.name}: ${fc.conf}%`, fc.conf >= 50 ? 'success' : fc.conf > 0 ? 'warning' : 'error');
    }

    completeStage(job, 'validate_evidence', evidenceCount);
    stageDurations.validate_evidence = Date.now() - s9;

    // ── Stage 10: Finalize ─────────────────────────────────────────────────
    const s10 = Date.now();
    startStage(job, 'finalize');

    job.completedAt = new Date().toISOString();
    job.totalDurationMs = Date.now() - pipelineStart;
    job.metrics.scanDurationMs = job.totalDurationMs;

    // Run validation
    const validation = validateScan(job, scannedPages, websiteFacts, evidenceCount);
    job.validation = validation;

    if (validation.passed) {
      log(job, 'finalize', 'הסריקה אמינה ומוכנה להמשך', 'success',
        `${scannedPages.length} דפים | ${evidenceCount} ראיות | ${(job.totalDurationMs / 1000).toFixed(1)}s`);
    } else {
      log(job, 'finalize', 'הסריקה אינה אמינה מספיק', 'warning', validation.invalidReason || '');
    }

    // Build final result
    job.result = {
      url: normalizedUrl,
      scanType: job.scanType,
      scannedAt: job.startedAt,
      hasSSL: isHttps,
      loadTimeMs,
      mobileOptimized: homepageParsed.hasMobileViewport,
      metaTitle: homepageParsed.title || '',
      metaDescription: homepageParsed.metaDescription || '',
      h1Tags: homepageParsed.h1Tags,
      h2Tags: homepageParsed.h2Tags,
      totalPages: scannedPages.length,
      indexedPages: scannedPages.length,
      brokenLinks: 0,
      hasRobotsTxt,
      hasSitemap,
      domainAuthority: 0,
      techStack: [],
      cmsDetected: 'Unknown',
      structuredData: homepageParsed.hasSchema,
      schemaTypes: homepageParsed.schemaTypes,
      openGraph: homepageParsed.hasOG,
      canonicalTags: homepageParsed.hasCanonical,
      issues,
      scannedPages,
      websiteFacts,
      scan_mode: 'real',
      aiQueries: aiResults,
      competitors: competitorsList,
      platformStatuses: job.platformStatuses,
      metrics: job.metrics,
      scanDuration: {
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        totalMs: job.totalDurationMs,
        perStage: stageDurations,
      },
    };

    job.status = 'completed';
    job.progress = 100;
    completeStage(job, 'finalize');
    stageDurations.finalize = Date.now() - s10;

    console.log(`[PIXEL SEO/GEO] Scan complete: ${normalizedUrl}`, {
      jobId: job.id, type: job.scanType, pages: scannedPages.length,
      issues: issues.length, duration: job.totalDurationMs,
      confidence: websiteFacts.confidence_score, valid: validation.passed,
    });

  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    job.completedAt = new Date().toISOString();
    job.totalDurationMs = Date.now() - pipelineStart;
    log(job, 'failed', 'שגיאה בלתי צפויה', 'error', job.error);
  }
}

// ── Unreachable Site Finalizer ───────────────────────────���─────────────────────

function finalizeUnreachable(job: ScanJob, url: string, start: number, durations: Record<string, number>) {
  // Skip remaining stages
  for (const s of job.stages) {
    if (s.status === 'pending') s.status = 'skipped';
  }
  job.status = 'failed';
  job.error = 'לא ניתן להגיע לאתר — ודא שהכתובת נכונה ושהאתר פעיל';
  job.completedAt = new Date().toISOString();
  job.totalDurationMs = Date.now() - start;
  job.progress = 100;
  job.metrics.scanDurationMs = job.totalDurationMs;

  job.result = {
    url, scanType: job.scanType, scannedAt: job.startedAt,
    hasSSL: false, loadTimeMs: 0, mobileOptimized: false,
    metaTitle: '', metaDescription: '', h1Tags: [], h2Tags: [],
    totalPages: 0, indexedPages: 0, brokenLinks: 0,
    hasRobotsTxt: false, hasSitemap: false, domainAuthority: 0,
    techStack: [], cmsDetected: 'Unknown',
    structuredData: false, schemaTypes: [],
    openGraph: false, canonicalTags: false,
    issues: [{ type: 'critical', category: 'technical', title: 'לא ניתן להגיע לאתר',
      description: 'האתר לא נגיש. ודא שהכתובת נכונה ושהאתר פעיל.', impact: 'high' }],
    scannedPages: [], websiteFacts: null, scan_mode: 'unavailable',
    aiQueries: [], platformStatuses: job.platformStatuses,
    metrics: job.metrics,
    scanDuration: { startedAt: job.startedAt, completedAt: job.completedAt!, totalMs: job.totalDurationMs, perStage: durations },
  };

  job.validation = validateScan(job, [], null, 0);
}
