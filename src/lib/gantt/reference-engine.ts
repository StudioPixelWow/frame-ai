/**
 * Reference Engine — fetches REAL ad references from Meta Ads Library.
 *
 * NO mock data. NO curated fallbacks. NO fake references.
 *
 * Flow:
 *   1. DB check: try app_ad_references table first (previously synced data)
 *   2. Live Meta Ads Library search via fetchMetaAdsReferences()
 *   3. If no token → returns empty + status 'no_token' with CTA: "חבר Meta Ads Library"
 *   4. If API fails → returns empty + status 'error' with: "לא ניתן לטעון נתונים מספריית המודעות"
 */

/* ── Types ── */

export interface ReferenceItem {
  id: string;
  imageUrl: string;
  description: string;
  source: string;
  sourceUrl: string;
  advertiserName: string;
  style: ReferenceStyle;
  contentType: string;
  platform: string;
  industry: string;
  tags: string[];
  engagementScore: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReferenceStyle =
  | 'minimal'
  | 'bold_text'
  | 'lifestyle'
  | 'product_focus'
  | 'testimonial'
  | 'ugc'
  | 'cinematic'
  | 'infographic';

export interface ReferenceQuery {
  ideaTitle: string;
  ideaSummary?: string;
  contentType: string;
  format: string;
  platform: string;
  clientIndustry?: string;
  clientName?: string;
}

/** Result returned by fetchReferences — includes status for UI messaging */
export interface ReferenceFetchResult {
  /** 'ok' = real data, 'no_token' = needs setup, 'error' = API failed, 'empty' = no results */
  status: 'ok' | 'no_token' | 'error' | 'empty';
  /** Hebrew message for the UI */
  message: string;
  /** References (empty when status !== 'ok') */
  references: ReferenceItem[];
}

/* ── Style labels ── */

const STYLE_LABELS: Record<ReferenceStyle, string> = {
  minimal: 'מינימליסטי',
  bold_text: 'טקסט בולט',
  lifestyle: 'לייפסטייל',
  product_focus: 'מוצר',
  testimonial: 'עדות לקוח',
  ugc: 'UGC',
  cinematic: 'קולנועי',
  infographic: 'אינפוגרפיקה',
};

/**
 * Get style label for display
 */
export function getStyleLabel(style: ReferenceStyle): string {
  return STYLE_LABELS[style] || style;
}

/**
 * Validate a reference has real source data.
 */
export function isValidReference(ref: ReferenceItem): boolean {
  return !!(ref.imageUrl || ref.sourceUrl) && !!ref.source;
}

/**
 * Check if a reference is NOT from a real source.
 * Always returns false now — there are no demo references in the system.
 */
export function isDemoReference(_ref: ReferenceItem): boolean {
  return false;
}

/* ── Synchronous generator (backward compatibility) ── */

/**
 * Synchronous version — returns empty array.
 * Use fetchReferences() for real data.
 */
export function generateReferences(_query: ReferenceQuery): ReferenceItem[] {
  // No mock data. Must use async fetchReferences() for real results.
  return [];
}

/* ── Async fetcher — REAL DATA ONLY ── */

/**
 * Fetch real ad references.
 *
 * Priority:
 *   1. DB data from app_ad_references (previously synced from Meta)
 *   2. Live Meta Ads Library search
 *
 * Returns max 6 results.
 * Never returns fake/mock/curated data.
 */
export async function fetchReferences(
  query: ReferenceQuery
): Promise<ReferenceItem[]> {
  const result = await fetchReferencesWithStatus(query);
  return result.references;
}

/**
 * Fetch references with full status info for UI messaging.
 * This is the primary function the Gantt UI should use.
 */
export async function fetchReferencesWithStatus(
  query: ReferenceQuery
): Promise<ReferenceFetchResult> {
  const logPrefix = '[fetchReferences]';

  // ── Step 1: Try DB (previously synced data) ──
  try {
    const params = new URLSearchParams();
    if (query.clientIndustry) params.append('industry', query.clientIndustry);
    if (query.contentType) params.append('contentType', query.contentType);
    if (query.platform) params.append('platform', query.platform);

    const url = `/api/data/ad-references?${params.toString()}`;
    console.log(`${logPrefix} Checking DB: ${url}`);

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const rawItems = Array.isArray(data) ? data : [];

      const validRefs = rawItems
        .map((ref: any): ReferenceItem => ({
          id: ref.id,
          imageUrl: ref.imageUrl || '',
          description: ref.description || '',
          source: ref.source || 'unknown',
          sourceUrl: ref.sourceUrl || '',
          advertiserName: ref.advertiserName || '',
          style: (ref.style as ReferenceStyle) || 'minimal',
          contentType: ref.contentType || '',
          platform: ref.platform || '',
          industry: ref.industry || '',
          tags: ref.tags || [],
          engagementScore: ref.engagementScore || 0,
          isActive: ref.isActive !== false,
          createdAt: ref.createdAt || '',
          updatedAt: ref.updatedAt || '',
        }))
        .filter(isValidReference)
        .slice(0, 6);

      if (validRefs.length > 0) {
        console.log(`${logPrefix} Found ${validRefs.length} references in DB`);
        return {
          status: 'ok',
          message: `${validRefs.length} רפרנסים נמצאו`,
          references: validRefs,
        };
      }
    }
  } catch (err) {
    console.warn(`${logPrefix} DB check failed:`, err);
  }

  // ── Step 2: Live Meta Ads Library search ──
  try {
    // Build search query from the content idea
    const searchTerms = query.ideaTitle || query.clientName || query.clientIndustry || '';
    if (!searchTerms) {
      return {
        status: 'empty',
        message: 'אין מונח חיפוש — הזן שם רעיון או תעשייה',
        references: [],
      };
    }

    // Call Meta Ads API route (server-side)
    const metaUrl = `/api/data/meta-ads?q=${encodeURIComponent(searchTerms)}&limit=6`;
    console.log(`${logPrefix} Live Meta search: ${metaUrl}`);

    const metaRes = await fetch(metaUrl);
    const metaData = await metaRes.json();

    if (metaData.needsToken) {
      return {
        status: 'no_token',
        message: 'חבר Meta Ads Library',
        references: [],
      };
    }

    if (metaData.error) {
      console.error(`${logPrefix} Meta API error: ${metaData.error}`);
      return {
        status: 'error',
        message: 'לא ניתן לטעון נתונים מספריית המודעות',
        references: [],
      };
    }

    const results: ReferenceItem[] = (metaData.results || [])
      .slice(0, 6)
      .map((ref: any): ReferenceItem => ({
        id: ref.metaAdId || ref.id || `meta-${Math.random().toString(36).slice(2)}`,
        imageUrl: ref.metaSnapshotUrl || ref.sourceUrl || ref.imageUrl || '',
        description: ref.description || '',
        source: 'meta_ads_library',
        sourceUrl: ref.metaSnapshotUrl || ref.sourceUrl || '',
        advertiserName: ref.advertiserName || '',
        style: 'minimal' as ReferenceStyle,
        contentType: ref.contentType || 'social_post',
        platform: ref.platform || 'facebook',
        industry: ref.industry || '',
        tags: ref.tags || ['meta_ads_library'],
        engagementScore: ref.engagementScore || 50,
        isActive: ref.isActive !== false,
        createdAt: ref.createdAt || new Date().toISOString(),
        updatedAt: ref.updatedAt || new Date().toISOString(),
      }))
      .filter(isValidReference);

    if (results.length > 0) {
      console.log(`${logPrefix} Got ${results.length} live results from Meta`);
      return {
        status: 'ok',
        message: `${results.length} מודעות מ-Meta Ads Library`,
        references: results,
      };
    }

    return {
      status: 'empty',
      message: 'לא נמצאו מודעות עבור חיפוש זה',
      references: [],
    };
  } catch (err) {
    console.error(`${logPrefix} Meta search error:`, err);
    return {
      status: 'error',
      message: 'לא ניתן לטעון נתונים מספריית המודעות',
      references: [],
    };
  }
}
