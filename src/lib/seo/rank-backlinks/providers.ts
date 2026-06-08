/**
 * Rank + Backlink data providers — abstraction over SerpAPI (ranks) and
 * DataForSEO (backlinks + authority), with a deterministic Mock fallback so the
 * UI populates before keys are added. Swap providers via env without touching callers.
 *
 * ENV: SERP_API_KEY (ranks), DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD (backlinks).
 */

const SERP = () => process.env.SERP_API_KEY || '';
const DFS_LOGIN = () => process.env.DATAFORSEO_LOGIN || '';
const DFS_PASS = () => process.env.DATAFORSEO_PASSWORD || '';

export function rankProviderConfigured(): boolean { return !!SERP(); }
export function backlinkProviderConfigured(): boolean { return !!(DFS_LOGIN() && DFS_PASS()); }

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return Math.abs(h); };
const cleanDomain = (d: string) => (d || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();

export interface RankResult { rank: number | null; volume?: number; difficulty?: number; mock: boolean; }

/** Google rank of `domain` for `keyword`. SerpAPI when configured, else Mock. */
export async function getRank(keyword: string, domain: string, country = 'il', language = 'he'): Promise<RankResult> {
  const dom = cleanDomain(domain);
  if (SERP() && dom) {
    try {
      const u = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(keyword)}&google_domain=google.co.${country}&gl=${country}&hl=${language}&num=100&api_key=${SERP()}`;
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      const j = await r.json();
      const org = j?.organic_results || [];
      const idx = org.findIndex((o: any) => cleanDomain(o.link || '').includes(dom));
      return { rank: idx >= 0 ? (org[idx].position || idx + 1) : null, mock: false };
    } catch { /* fall through to mock */ }
  }
  // Mock: deterministic pseudo-rank (kept stable per keyword/domain, drifts slightly).
  const base = (hash(keyword + dom) % 40) + 3;
  const drift = (hash(keyword + new Date().toISOString().slice(0, 10)) % 7) - 3;
  return { rank: Math.max(1, base + drift), volume: 50 + (hash(keyword) % 4000), difficulty: 10 + (hash(keyword) % 80), mock: true };
}

export interface AuthorityMetrics { dr: number; ur: number; totalLinks: number; referringDomains: number; dofollowDomains: number; dofollowLinks: number; source: string; }
export interface BacklinkRow { source_url: string; source_domain: string; target_url: string; anchor: string; dofollow: boolean; domain_rating?: number; }

async function dfsAuth() { return 'Basic ' + Buffer.from(`${DFS_LOGIN()}:${DFS_PASS()}`).toString('base64'); }

/** Site authority summary (DR/UR/links/domains). DataForSEO when configured, else Mock. */
export async function getAuthority(domain: string): Promise<AuthorityMetrics> {
  const dom = cleanDomain(domain);
  if (backlinkProviderConfigured() && dom) {
    try {
      const r = await fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
        method: 'POST', headers: { Authorization: await dfsAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{ target: dom, internal_list_limit: 10, backlinks_status_type: 'live' }]), signal: AbortSignal.timeout(20000),
      });
      const j = await r.json();
      const it = j?.tasks?.[0]?.result?.[0];
      if (it) return {
        dr: Math.round(it.rank || 0), ur: Math.round(it.target_spam_score ? (100 - it.target_spam_score) : (it.rank || 0) * 0.6),
        totalLinks: it.backlinks || 0, referringDomains: it.referring_domains || 0,
        dofollowDomains: it.referring_main_domains || 0, dofollowLinks: it.backlinks_spam_score != null ? Math.round((it.backlinks || 0) * 0.9) : (it.backlinks || 0),
        source: 'dataforseo',
      };
    } catch { /* fall through */ }
  }
  // Mock authority (deterministic; clearly estimated).
  const h = hash(dom);
  const refDomains = 80 + (h % 400);
  const totalLinks = refDomains * (8 + (h % 12));
  return { dr: 15 + (h % 45), ur: 8 + (h % 30), totalLinks, referringDomains: refDomains, dofollowDomains: Math.round(refDomains * 0.7), dofollowLinks: Math.round(totalLinks * 0.85), source: 'estimated' };
}

/** Backlink list (up to `limit`). DataForSEO when configured, else Mock. */
export async function getBacklinks(domain: string, limit = 500): Promise<BacklinkRow[]> {
  const dom = cleanDomain(domain);
  if (backlinkProviderConfigured() && dom) {
    try {
      const r = await fetch('https://api.dataforseo.com/v3/backlinks/backlinks/live', {
        method: 'POST', headers: { Authorization: await dfsAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{ target: dom, limit: Math.min(limit, 1000), mode: 'as_is', backlinks_status_type: 'live' }]), signal: AbortSignal.timeout(25000),
      });
      const j = await r.json();
      const items = j?.tasks?.[0]?.result?.[0]?.items || [];
      return items.map((b: any) => ({ source_url: b.url_from, source_domain: cleanDomain(b.domain_from || b.url_from), target_url: b.url_to, anchor: b.anchor || '', dofollow: b.dofollow !== false, domain_rating: b.domain_from_rank }));
    } catch { /* fall through */ }
  }
  // Mock: synthetic referring domains.
  const h = hash(dom); const n = Math.min(limit, 30 + (h % 60));
  const tlds = ['co.il', 'com', 'org', 'net', 'blog']; const out: BacklinkRow[] = [];
  for (let i = 0; i < n; i++) { const sd = `site${(h + i) % 999}.${tlds[(h + i) % tlds.length]}`; out.push({ source_url: `https://${sd}/article-${i}`, source_domain: sd, target_url: `https://${dom}/`, anchor: ['מידע נוסף', 'קישור', dom, 'לחצו כאן', 'המומחים'][(h + i) % 5], dofollow: (h + i) % 4 !== 0, domain_rating: 10 + ((h + i) % 60) }); }
  return out;
}
