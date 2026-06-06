/**
 * Competitor ad source — pluggable.
 *
 * Reality: Meta's official Ad Library API (ads_archive) only returns
 * political/issue ads globally + ALL ads in the EU/UK. For Israel commercial
 * competitors it returns ~nothing. So this layer is built provider-agnostic:
 *
 *   - 'meta'        → official Graph ads_archive (works for EU/political).
 *   - 'thirdparty'  → a paid Ad Library data provider (set provider env + key);
 *                     this is what lights up IL commercial monitoring. Stubbed
 *                     with a clear "configure provider" result until a key exists.
 *
 * A deep-link to the public Ad Library website is ALWAYS returned — it shows all
 * commercial ads for any country, free, for manual viewing.
 */

const GRAPH = 'https://graph.facebook.com/v19.0';
const FIELDS = 'id,ad_creative_bodies,ad_creative_link_titles,ad_snapshot_url,page_name,publisher_platforms,ad_delivery_start_time';

export interface CompetitorAd {
  adId: string;
  pageName: string;
  body: string;
  title: string;
  snapshotUrl: string;
  platforms: string[];
  startTime: string | null;
  raw?: any;
}

export interface CompetitorAdsResult {
  status: 'ok' | 'empty' | 'no_token' | 'provider_needed' | 'error';
  message: string;
  ads: CompetitorAd[];
  deepLink: string;
}

/** Public Ad Library website link, pre-filtered — works for ALL countries, free. */
export function adLibraryDeepLink(opts: { name?: string; pageId?: string; country?: string }): string {
  const country = opts.country || 'IL';
  const base = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&media_type=all';
  if (opts.pageId) return `${base}&country=${country}&view_all_page_id=${encodeURIComponent(opts.pageId)}`;
  return `${base}&country=${country}&q=${encodeURIComponent(opts.name || '')}&search_type=keyword_unordered`;
}

function metaToken(): string | null {
  return process.env.META_ACCESS_TOKEN || process.env.META_ADS_LIBRARY_TOKEN || null;
}

export async function fetchCompetitorAds(
  competitor: { name: string; pageId?: string | null; country?: string | null },
  limit = 30,
): Promise<CompetitorAdsResult> {
  const country = competitor.country || 'IL';
  const deepLink = adLibraryDeepLink({ name: competitor.name, pageId: competitor.pageId || undefined, country });

  // Third-party provider takes priority when configured (the only path that
  // returns IL commercial ads). Implement the actual call when a key is added.
  const providerKey = process.env.AD_LIBRARY_PROVIDER_KEY;
  const provider = process.env.AD_LIBRARY_PROVIDER; // e.g. 'apify' | 'scrapecreators'
  if (providerKey && provider) {
    // Placeholder for the chosen provider's API. Returns a clear status until wired.
    return { status: 'provider_needed', message: `ספק "${provider}" מוגדר — חיבור ה-API שלו טרם הוטמע.`, ads: [], deepLink };
  }

  const token = metaToken();
  if (!token) {
    return { status: 'no_token', message: 'אין טוקן Meta לספריית המודעות. בינתיים השתמש בקישור הישיר לספרייה.', ads: [], deepLink };
  }

  try {
    const url = new URL(`${GRAPH}/ads_archive`);
    url.searchParams.set('access_token', token);
    url.searchParams.set('ad_reached_countries', `['${country}']`);
    url.searchParams.set('ad_active_status', 'ACTIVE');
    url.searchParams.set('ad_type', 'ALL');
    url.searchParams.set('limit', String(Math.min(limit, 50)));
    url.searchParams.set('fields', FIELDS);
    if (competitor.pageId) url.searchParams.set('search_page_ids', `['${competitor.pageId}']`);
    else url.searchParams.set('search_terms', competitor.name);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as any)?.error?.message || `HTTP ${res.status}`;
      // The classic "commercial ads not available via API outside EU" case.
      return { status: 'error', message: `ה-API של Meta החזיר: ${msg}. למודעות מסחריות בישראל יש להשתמש בקישור הישיר או בספק חיצוני.`, ads: [], deepLink };
    }
    const json = await res.json();
    const rows: any[] = json?.data || [];
    const ads: CompetitorAd[] = rows.map((a) => ({
      adId: String(a.id || ''),
      pageName: a.page_name || competitor.name,
      body: a.ad_creative_bodies?.[0] || '',
      title: a.ad_creative_link_titles?.[0] || '',
      snapshotUrl: a.ad_snapshot_url || '',
      platforms: a.publisher_platforms || [],
      startTime: a.ad_delivery_start_time || null,
      raw: a,
    }));
    if (ads.length === 0) {
      return { status: 'empty', message: 'לא נמצאו מודעות דרך ה-API (צפוי למודעות מסחריות בישראל). פתח בקישור הישיר לספרייה.', ads: [], deepLink };
    }
    return { status: 'ok', message: `נמצאו ${ads.length} מודעות`, ads, deepLink };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return { status: 'error', message: `שגיאה במשיכת מודעות: ${msg}`, ads: [], deepLink };
  }
}
