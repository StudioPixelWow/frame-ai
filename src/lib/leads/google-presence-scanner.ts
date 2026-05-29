/**
 * Lead Research — Google Presence Scanner
 * Checks Google Business Profile, reviews, local pack, and organic presence.
 * Reuses existing gbp-service.ts and serp-api.ts where possible.
 * NO FAKE DATA.
 */

export interface GooglePresenceResult {
  gbpFound: boolean;
  gbpName?: string;
  gbpRating?: number;
  gbpReviewCount?: number;
  gbpCategories?: string[];
  localPackPosition?: number;
  organicResults: Array<{ query: string; position: number; url: string }>;
  mapsListed: boolean;
}

export async function scanGooglePresence(websiteUrl: string, businessName: string): Promise<GooglePresenceResult> {
  const result: GooglePresenceResult = {
    gbpFound: false,
    organicResults: [],
    mapsListed: false,
  };

  const domain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname.replace('www.', '');

  // Step 1: Check GBP via existing service
  try {
    const { getLocalRankings } = await import('@/lib/seo/gbp-service');
    const gbpResult = await getLocalRankings(businessName, domain);
    if (gbpResult) {
      result.gbpFound = !!(gbpResult as any).found;
      result.gbpName = (gbpResult as any).name || businessName;
      result.gbpRating = (gbpResult as any).rating || undefined;
      result.gbpReviewCount = (gbpResult as any).reviewCount || undefined;
      result.gbpCategories = (gbpResult as any).categories || [];
      result.mapsListed = !!(gbpResult as any).mapsListed;
    }
  } catch {
    // GBP check failed — continue
  }

  // Step 2: Check organic results via SERP
  try {
    const serpApiKey = process.env.SERP_API_KEY || process.env.SERPER_API_KEY;
    if (serpApiKey) {
      // Search for business name
      const serpRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serpApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: businessName, gl: 'il', hl: 'he', num: 20 }),
      });

      if (serpRes.ok) {
        const data = await serpRes.json();

        // Check organic results for the domain
        const organic = data.organic || [];
        for (let i = 0; i < organic.length; i++) {
          const link = organic[i].link || '';
          if (link.includes(domain)) {
            result.organicResults.push({
              query: businessName,
              position: i + 1,
              url: link,
            });
          }
        }

        // Check local pack
        const localPack = data.places || data.localResults || [];
        for (let i = 0; i < localPack.length; i++) {
          const place = localPack[i];
          const placeLink = place.link || place.website || '';
          if (placeLink.includes(domain) || (place.title || '').toLowerCase().includes(businessName.toLowerCase().split(' ')[0])) {
            result.localPackPosition = i + 1;
            if (!result.gbpFound) {
              result.gbpFound = true;
              result.gbpName = place.title;
              result.gbpRating = place.rating;
              result.gbpReviewCount = place.reviews;
            }
            break;
          }
        }
      }
    }
  } catch {
    // SERP failed — continue
  }

  return result;
}
