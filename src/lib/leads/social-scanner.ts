/**
 * Lead Research — Social Media Scanner
 * Finds social media presence for a lead's business.
 * Extracts links from website HTML + SERP fallback.
 * NO FAKE DATA — only reports what was actually found.
 */

// Use cheerio for HTML parsing (already in project)
import * as cheerio from 'cheerio';

export interface SocialPresence {
  facebook: { found: boolean; url?: string; followers?: number; lastPost?: string; engagement?: string } | null;
  instagram: { found: boolean; url?: string; followers?: number; lastPost?: string; engagement?: string } | null;
  linkedin: { found: boolean; url?: string; followers?: number; lastPost?: string } | null;
  tiktok: { found: boolean; url?: string; followers?: number } | null;
}

const SOCIAL_PATTERNS = {
  facebook: /(?:facebook\.com|fb\.com)\/([^\/\?\s"']+)/i,
  instagram: /instagram\.com\/([^\/\?\s"']+)/i,
  linkedin: /linkedin\.com\/(?:company|in)\/([^\/\?\s"']+)/i,
  tiktok: /tiktok\.com\/@?([^\/\?\s"']+)/i,
};

async function fetchHtml(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PixelBot/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

function extractSocialLinks(html: string): Record<string, string> {
  const found: Record<string, string> = {};
  const $ = cheerio.load(html);

  // Check all links
  $('a[href]').each((_: number, el: any) => {
    const href = $(el).attr('href') || '';
    for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
      if (!found[platform] && pattern.test(href)) {
        found[platform] = href;
      }
    }
  });

  // Also check for social links in page text/meta
  const fullHtml = $.html();
  for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
    if (!found[platform]) {
      const match = fullHtml.match(pattern);
      if (match) {
        found[platform] = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
      }
    }
  }

  return found;
}

export async function scanSocialPresence(websiteUrl: string, businessName: string): Promise<SocialPresence> {
  const result: SocialPresence = {
    facebook: null,
    instagram: null,
    linkedin: null,
    tiktok: null,
  };

  // Step 1: Crawl the website for social links
  const html = await fetchHtml(websiteUrl);
  const links = extractSocialLinks(html);

  // Step 2: For each found platform, build the result
  for (const platform of ['facebook', 'instagram', 'linkedin', 'tiktok'] as const) {
    if (links[platform]) {
      (result as any)[platform] = {
        found: true,
        url: links[platform],
        // We don't scrape follower counts — that requires authenticated APIs
        // NO FAKE DATA: only report what we can verify
      };
    } else {
      (result as any)[platform] = { found: false };
    }
  }

  // Step 3: SERP fallback — search for business social profiles
  if (!links.facebook && !links.instagram && !links.linkedin) {
    try {
      const serpApiKey = process.env.SERP_API_KEY || process.env.SERPER_API_KEY;
      if (serpApiKey) {
        const searchQuery = `${businessName} site:facebook.com OR site:instagram.com OR site:linkedin.com`;
        const serpRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': serpApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: searchQuery, num: 10 }),
        });
        if (serpRes.ok) {
          const data = await serpRes.json();
          const organic = data.organic || [];
          for (const item of organic) {
            const url = item.link || '';
            for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
              if (!(result as any)[platform]?.found && pattern.test(url)) {
                (result as any)[platform] = { found: true, url };
              }
            }
          }
        }
      }
    } catch {
      // SERP search failed — continue with what we have
    }
  }

  return result;
}
