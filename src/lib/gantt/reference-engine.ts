/**
 * Reference Engine — fetches ad reference examples for Gantt content ideas.
 *
 * Priority:
 *   1. Real DB data (app_ad_references) — populated by Meta Ads Library sync
 *   2. Live Meta Ads Library search (when token is configured)
 *   3. Curated fallback dataset (clearly labeled as "דוגמאות השראה זמניות")
 *
 * When Meta Ads Library is not connected, the UI shows a CTA:
 *   "חבר Meta Ads Library" to encourage setup.
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

/* ── Curated fallback dataset (used when Meta Ads API is not connected) ── */

/**
 * CURATED FALLBACK — clearly labeled as temporary inspiration examples.
 * These are NOT real competitor ads. They are generic stock-photo examples
 * shown ONLY when Meta Ads Library is not connected.
 * The UI must label these as "דוגמאות השראה זמניות" (temporary inspiration).
 */
const CURATED_REFERENCES: ReferenceItem[] = [
  {
    id: 'curated-1', imageUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&h=400&fit=crop',
    description: '⚠️ דוגמת השראה בלבד — פוסט מותג מינימליסטי עם טיפוגרפיה נקייה',
    source: 'demo_inspiration', sourceUrl: '', advertiserName: '💡 דוגמת השראה (לא מודעה אמיתית)',
    style: 'minimal', contentType: 'social_post', platform: 'instagram', industry: 'general',
    tags: ['minimal', 'clean', 'typography', 'brand'], engagementScore: 0, isActive: false,
    createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'curated-2', imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=400&fit=crop',
    description: '⚠️ דוגמת השראה בלבד — סטורי אינטראקטיבי עם CTA ברור',
    source: 'demo_inspiration', sourceUrl: '', advertiserName: '💡 דוגמת השראה (לא מודעה אמיתית)',
    style: 'product_focus', contentType: 'story', platform: 'instagram', industry: 'ecommerce',
    tags: ['product', 'cta', 'story', 'ecommerce'], engagementScore: 0, isActive: false,
    createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'curated-3', imageUrl: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=400&fit=crop',
    description: '⚠️ דוגמת השראה בלבד — סרטון UGC אותנטי עם מסר אישי',
    source: 'demo_inspiration', sourceUrl: '', advertiserName: '💡 דוגמת השראה (לא מודעה אמיתית)',
    style: 'ugc', contentType: 'reel', platform: 'instagram', industry: 'general',
    tags: ['ugc', 'testimonial', 'authentic', 'video'], engagementScore: 0, isActive: false,
    createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'curated-4', imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop',
    description: '⚠️ דוגמת השראה בלבד — אינפוגרפיקה עם נתונים ותוצאות',
    source: 'demo_inspiration', sourceUrl: '', advertiserName: '💡 דוגמת השראה (לא מודעה אמיתית)',
    style: 'infographic', contentType: 'social_post', platform: 'facebook', industry: 'general',
    tags: ['infographic', 'data', 'education', 'authority'], engagementScore: 0, isActive: false,
    createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'curated-5', imageUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=400&fit=crop',
    description: '⚠️ דוגמת השראה בלבד — לייפסטייל, תמונת אווירה למותג',
    source: 'demo_inspiration', sourceUrl: '', advertiserName: '💡 דוגמת השראה (לא מודעה אמיתית)',
    style: 'lifestyle', contentType: 'social_post', platform: 'instagram', industry: 'lifestyle',
    tags: ['lifestyle', 'mood', 'brand', 'emotional'], engagementScore: 0, isActive: false,
    createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'curated-6', imageUrl: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=400&fit=crop',
    description: '⚠️ דוגמת השראה בלבד — טקסט בולט עם מסר ויראלי',
    source: 'demo_inspiration', sourceUrl: '', advertiserName: '💡 דוגמת השראה (לא מודעה אמיתית)',
    style: 'bold_text', contentType: 'social_post', platform: 'facebook', industry: 'general',
    tags: ['bold', 'text', 'viral', 'shareable'], engagementScore: 0, isActive: false,
    createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z',
  },
];

/**
 * Get curated fallback references, filtered by relevance to query.
 * Returns up to 6 references. Always returns at least some results.
 */
function getCuratedFallback(query: ReferenceQuery): ReferenceItem[] {
  let results = [...CURATED_REFERENCES];

  // Try to match by contentType first
  if (query.contentType) {
    const typed = results.filter(r => r.contentType === query.contentType);
    if (typed.length >= 2) results = typed;
  }

  // Try to match by platform
  if (query.platform) {
    const platformed = results.filter(r => r.platform === query.platform || r.platform === 'all');
    if (platformed.length >= 2) results = platformed;
  }

  return results.slice(0, 6);
}

/* ── Main sync generator ── */

/**
 * Synchronous version — returns curated references for backward compatibility.
 */
export function generateReferences(query: ReferenceQuery): ReferenceItem[] {
  return getCuratedFallback(query);
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

/**
 * Check if a reference is from the demo/curated fallback (not real ad data).
 * The UI should label these clearly as "דוגמאות השראה זמניות".
 */
export function isDemoReference(ref: ReferenceItem): boolean {
  return ref.source === 'demo_inspiration' || ref.id.startsWith('curated-');
}

/* ── Async fetcher for REAL DB data ── */

/**
 * Fetch ad references from the Supabase database.
 * Filters by industry, contentType, platform, and keyword relevance.
 *
 * Source: app_ad_references table via /api/data/ad-references
 * Fallback: curated reference library when no DB data exists.
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
      console.warn(`${logPrefix} API returned ${response.status} — using curated fallback`);
      return getCuratedFallback(query);
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
      return validRefs;
    }

    // No real data in DB — use curated fallback
    console.log(`${logPrefix} No real references found — returning curated fallback (Meta Ads API not connected)`);
    return getCuratedFallback(query);
  } catch (error) {
    console.error(`${logPrefix} Error fetching references:`, error);
    // Fallback to curated on error
    return getCuratedFallback(query);
  }
}
