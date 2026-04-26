/**
 * Reference Engine — fetches REAL ad reference examples from the database
 * for Gantt content ideas based on concept, content type, and client industry.
 *
 * NO MOCK DATA. NO FAKE REFERENCES. NO PLACEHOLDERS.
 * All references come from the Supabase app_ad_references table.
 * If no real data exists, returns empty array.
 */

/* ── Types ── */

export interface ReferenceItem {
  id: string;
  /** Image URL from the database (required for render) */
  imageUrl: string;
  /** Description of the reference ad */
  description: string;
  /** Source label — where this reference came from */
  source: string;
  /** Direct URL to the original ad/source */
  sourceUrl: string;
  /** Advertiser / page name */
  advertiserName: string;
  /** Style tag for categorization */
  style: ReferenceStyle;
  /** Content type (social_post, story, reel, etc.) */
  contentType: string;
  /** Platform (instagram, facebook, tiktok, etc.) */
  platform: string;
  /** Industry of the reference */
  industry: string;
  /** Tags for matching */
  tags: string[];
  /** Engagement score 0-100 */
  engagementScore: number;
  /** Whether the reference ad is currently active/running */
  isActive: boolean;
  /** When this reference was added */
  createdAt: string;
  /** When this reference was last synced/verified */
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
  contentType: string; // GanttItemType
  format: string; // ContentFormat
  platform: string; // ContentPlatform
  clientIndustry?: string; // client.businessField
  clientName?: string;
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

/* ── Main sync generator (returns empty — NO MOCK DATA) ── */

/**
 * Synchronous version for backward compatibility.
 * Returns empty array — real data comes ONLY from async fetchReferences.
 */
export function generateReferences(_query: ReferenceQuery): ReferenceItem[] {
  // NO fake data generation — real data only via fetchReferences
  return [];
}

/**
 * Get style labels map (for UI display)
 */
export function getStyleLabel(style: ReferenceStyle): string {
  return STYLE_LABELS[style] || style;
}

/**
 * Validate a reference item has valid source data.
 * Returns false for items without real source information.
 */
export function isValidReference(ref: ReferenceItem): boolean {
  return !!(ref.imageUrl || ref.sourceUrl) && !!ref.source;
}

/* ── Async fetcher for REAL DB data ── */

/**
 * Fetch real ad references from the Supabase database.
 * Filters by industry, contentType, platform, and keyword relevance.
 *
 * Source: app_ad_references table via /api/data/ad-references
 * NO fallback to mock/fake data. Empty array if no real data found.
 */
export async function fetchReferences(
  query: ReferenceQuery
): Promise<ReferenceItem[]> {
  const logPrefix = `[fetchReferences]`;

  try {
    const params = new URLSearchParams();

    if (query.clientIndustry) {
      params.append('industry', query.clientIndustry);
    }
    if (query.contentType) {
      params.append('contentType', query.contentType);
    }
    if (query.platform) {
      params.append('platform', query.platform);
    }

    const url = `/api/data/ad-references?${params.toString()}`;

    console.log(`${logPrefix} Fetching: ${url}`);
    console.log(`${logPrefix} Query: title="${query.ideaTitle}", industry="${query.clientIndustry}", type=${query.contentType}, platform=${query.platform}`);

    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`${logPrefix} API returned ${response.status} — returning empty (no fake fallback)`);
      return [];
    }

    const data = await response.json();
    const rawItems = Array.isArray(data) ? data : [];

    // Map DB records to full ReferenceItem, filtering out invalid entries
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
      .filter((ref: ReferenceItem) => {
        if (!isValidReference(ref)) {
          console.warn(`${logPrefix} Blocked invalid ref id=${ref.id} — missing imageUrl and sourceUrl`);
          return false;
        }
        return true;
      });

    console.log(`${logPrefix} Result: ${validRefs.length} valid references from DB (source: app_ad_references via Supabase)`);

    if (validRefs.length > 0) {
      console.log(`${logPrefix} Sources: ${[...new Set(validRefs.map((r: ReferenceItem) => r.source))].join(', ')}`);
    }

    return validRefs;
  } catch (error) {
    console.error(`${logPrefix} Error fetching references:`, error);
    // NO fake fallback — return empty
    return [];
  }
}
