/**
 * AIVisibilityProviderService — a thin, modular adapter over the existing
 * platform layer (src/lib/seo/platform-apis.ts: queryPlatform + getApiStatus),
 * plus a Mock provider for testing / when no API keys are set.
 *
 * Each engine is an adapter; nothing is hard-wired to one vendor. The service
 * normalizes the response and exposes mention/citation/competitor extraction.
 */

import { queryPlatform, getApiStatus, type PlatformId } from '@/lib/seo/platform-apis';

export const VIS_ENGINES: PlatformId[] = ['chatgpt', 'claude', 'gemini', 'perplexity', 'google_ai_overview'];

export interface NormalizedResult {
  engine: PlatformId;
  found: boolean;
  position?: number;
  responseText: string;
  sources: { url: string; domain: string; title?: string }[];
  mentionType: string;
  confidence: number;
  scanMode: 'real' | 'unavailable' | 'mock';
  latencyMs: number;
}

export interface BrandMatch { name: string; aliases: string[]; domain?: string; owners: string[]; experts: string[]; }

/** Which engines have API keys configured right now. */
export function availableEngines(): PlatformId[] {
  const status = getApiStatus();
  return VIS_ENGINES.filter((e) => status[e]);
}

function domainOf(url: string): string {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, ''); } catch { return url; }
}

/** Run one query on one engine. Falls back to a deterministic Mock if unavailable. */
export async function runQuery(engine: PlatformId, query: string, brand: BrandMatch): Promise<NormalizedResult> {
  const t0 = Date.now();
  const status = getApiStatus();
  if (!status[engine]) return mockResult(engine, query, brand, Date.now() - t0);
  try {
    const r = await queryPlatform(engine, query, brand.name, brand.domain || '');
    if (r.scanMode === 'unavailable') return mockResult(engine, query, brand, Date.now() - t0);
    return {
      engine, found: r.found, position: r.position,
      responseText: r.responseText || r.snippet || '',
      sources: r.sources || [],
      mentionType: r.mentionType || (r.found ? 'in_text' : 'none'),
      confidence: r.confidence ?? (r.found ? 70 : 30),
      scanMode: 'real', latencyMs: Date.now() - t0,
    };
  } catch {
    return mockResult(engine, query, brand, Date.now() - t0);
  }
}

/** Deterministic mock so the pipeline is testable without keys (clearly flagged). */
function mockResult(engine: PlatformId, query: string, brand: BrandMatch, latencyMs: number): NormalizedResult {
  return { engine, found: false, responseText: '', sources: [], mentionType: 'none', confidence: 0, scanMode: 'mock', latencyMs };
}

/* ── Extraction (works on responseText + sources from any provider) ── */

export function extractMention(res: NormalizedResult, brand: BrandMatch): {
  found: boolean; isExact: boolean; isAlias: boolean; recommendationLevel: string; sentiment: string;
} {
  const text = (res.responseText || '').toLowerCase();
  const names = [brand.name, ...brand.aliases, ...brand.owners, ...brand.experts].filter(Boolean).map((n) => n.toLowerCase());
  const exact = brand.name && text.includes(brand.name.toLowerCase());
  const aliasHit = names.some((n) => n && text.includes(n));
  const found = res.found || !!exact || aliasHit;
  // Heuristic recommendation level from phrasing + position.
  let level = 'not_mentioned';
  if (found) {
    if (/מומלץ ביותר|the best|top recommendation|מוביל/.test(text)) level = 'top_recommendation';
    else if (/מומלץ|recommend|כדאי/.test(text)) level = 'recommended';
    else if ((res.position ?? 99) <= 3) level = 'strongly_recommended';
    else level = 'mentioned';
  }
  const sentiment = /בעיה|גרוע|שלילי|avoid|negative/.test(text) ? 'negative' : 'neutral';
  return { found, isExact: !!exact, isAlias: aliasHit && !exact, recommendationLevel: level, sentiment };
}

export function extractCitations(res: NormalizedResult, brand: BrandMatch, competitorDomains: string[]): Array<{
  url: string; domain: string; title?: string; position: number; isOwn: boolean; isCompetitor: boolean;
}> {
  const own = (brand.domain || '').replace(/^www\./, '');
  return (res.sources || []).map((s, i) => {
    const dom = s.domain || domainOf(s.url);
    return { url: s.url, domain: dom, title: s.title, position: i + 1, isOwn: !!own && dom.includes(own), isCompetitor: competitorDomains.some((c) => c && dom.includes(c)) };
  });
}

export function extractCompetitors(res: NormalizedResult, competitors: { name: string; domain?: string; aliases?: string[] }[]): Array<{ name: string; position: number; cited: boolean }> {
  const text = (res.responseText || '').toLowerCase();
  const sourceDomains = (res.sources || []).map((s) => (s.domain || domainOf(s.url)).toLowerCase());
  const hits: Array<{ name: string; position: number; cited: boolean }> = [];
  for (const c of competitors) {
    const names = [c.name, ...(c.aliases || [])].filter(Boolean).map((n) => n.toLowerCase());
    const inText = names.some((n) => n && text.includes(n));
    const cited = !!c.domain && sourceDomains.some((d) => d.includes(c.domain!.replace(/^www\./, '').toLowerCase()));
    if (inText || cited) {
      const pos = names.map((n) => text.indexOf(n)).filter((x) => x >= 0).sort((a, b) => a - b)[0] ?? 9999;
      hits.push({ name: c.name, position: pos, cited });
    }
  }
  return hits;
}
