/**
 * Reference Engine — fetches real ad reference examples from the database
 * for Gantt content ideas based on concept, content type, and client industry.
 */

/* ── Types ── */

export interface ReferenceItem {
  id: string;
  /** Image URL from the database */
  imageUrl: string;
  /** Description of the reference ad */
  description: string;
  /** Source label */
  source: string;
  /** Style tag for categorization */
  style: ReferenceStyle;
  /** Engagement score 0-100 */
  engagementScore: number;
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

/* ── Main sync generator (returns empty) ── */

/**
 * Synchronous version for backward compatibility.
 * Returns empty array — real data comes from async fetchReferences.
 */
export function generateReferences(query: ReferenceQuery): ReferenceItem[] {
  // No fake data generation — real data only via fetchReferences
  return [];
}

/**
 * Get style labels map (for UI display)
 */
export function getStyleLabel(style: ReferenceStyle): string {
  return STYLE_LABELS[style] || style;
}

/* ── Async fetcher for real DB data ── */

/**
 * Fetch real ad references from the database based on query parameters.
 * Filters by industry, contentType, and platform.
 */
export async function fetchReferences(
  query: ReferenceQuery
): Promise<ReferenceItem[]> {
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
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[fetchReferences] API returned ${response.status}`);
      return [];
    }

    const data = await response.json();

    // Map database records to ReferenceItem format
    return (Array.isArray(data) ? data : []).map((ref: any) => ({
      id: ref.id,
      imageUrl: ref.imageUrl,
      description: ref.description,
      source: ref.source,
      style: ref.style as ReferenceStyle,
      engagementScore: ref.engagementScore || 0,
    }));
  } catch (error) {
    console.error('[fetchReferences] error:', error);
    return [];
  }
}
