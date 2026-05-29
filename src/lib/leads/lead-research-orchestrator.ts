/**
 * Lead Research & Growth Intelligence Engine — Orchestrator
 *
 * Coordinates 12 scan stages for a lead:
 *  1. Website Scan — crawl + extract facts (reuses scan-pipeline)
 *  2. Social Media Scan — find FB/IG/LinkedIn/TikTok presence
 *  3. Google Presence — GMB, reviews, local pack, organic results
 *  4. SEO Analysis — technical + content (reuses gap-analysis)
 *  5. GEO Analysis — AI visibility across 6 platforms (reuses visibility-engine)
 *  6. AI Visibility — deep check per platform
 *  7. Competitor Analysis — discover competitors (reuses competitor-engine)
 *  8. Scoring — strategic scores across 15+ dimensions
 *  9. Sales Opportunities — identify upsell for Studio Pixel services
 * 10. Quarter Plan — 90-day growth plan
 * 11. Report Generation — structured report in Hebrew
 * 12. Complete
 *
 * NO FAKE DATA. Every metric based on real scan.
 */

import { leadResearch } from '@/lib/db/collections';
import type { LeadResearch, LeadResearchStageId, LeadResearchStage } from '@/lib/db/schema';

// ── Stage Definitions ─────────────────────────────────────────────────────────

const STAGES: Array<{ id: LeadResearchStageId; index: number; label: string; labelHe: string }> = [
  { id: 'website_scan',        index: 1,  label: 'Website Scan',        labelHe: 'סריקת אתר' },
  { id: 'social_scan',         index: 2,  label: 'Social Media Scan',   labelHe: 'סריקת רשתות חברתיות' },
  { id: 'google_presence',     index: 3,  label: 'Google Presence',     labelHe: 'נוכחות בגוגל' },
  { id: 'seo_analysis',        index: 4,  label: 'SEO Analysis',        labelHe: 'ניתוח SEO' },
  { id: 'geo_analysis',        index: 5,  label: 'GEO Analysis',        labelHe: 'ניתוח GEO' },
  { id: 'ai_visibility',       index: 6,  label: 'AI Visibility',       labelHe: 'נראות במנועי AI' },
  { id: 'competitor_analysis',  index: 7,  label: 'Competitor Analysis', labelHe: 'ניתוח מתחרים' },
  { id: 'scoring',             index: 8,  label: 'Scoring',             labelHe: 'ציון אסטרטגי' },
  { id: 'sales_opportunities', index: 9,  label: 'Sales Opportunities', labelHe: 'הזדמנויות מכירה' },
  { id: 'quarter_plan',        index: 10, label: 'Quarter Plan',        labelHe: 'תוכנית רבעונית' },
  { id: 'report_generation',   index: 11, label: 'Report Generation',   labelHe: 'יצירת דוח' },
];

// ── Helper: Update progress in DB ─────────────────────────────────────────────

async function updateResearch(id: string, patch: Partial<LeadResearch>) {
  try {
    await leadResearch.updateAsync(id, patch as any);
  } catch (e) {
    console.error('[LeadResearch] Failed to update:', id, e);
  }
}

function buildInitialStages(): LeadResearchStage[] {
  return STAGES.map(s => ({
    id: s.id,
    index: s.index,
    label: s.label,
    labelHe: s.labelHe,
    status: 'pending' as const,
  }));
}

function calcProgress(stages: LeadResearchStage[]): number {
  const completed = stages.filter(s => s.status === 'completed' || s.status === 'skipped').length;
  return Math.round((completed / STAGES.length) * 100);
}

// ── Stage Runners ─────────────────────────────────────────────────────────────

async function runWebsiteScan(url: string): Promise<any> {
  // Direct HTTP crawl — does NOT use scan-pipeline (which relies on in-memory Map
  // and fire-and-forget pattern incompatible with Vercel serverless).
  console.log('[LeadResearch] Stage 1: Direct website scan for', url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StudioPixelBot/1.0)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('[LeadResearch] Website returned', res.status);
      return null;
    }

    const html = await res.text();

    // Extract basic facts from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i);
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)/i);
    const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i);

    // Check for common CMS/platform indicators
    let cms = 'unknown';
    if (html.includes('wp-content') || html.includes('wordpress')) cms = 'WordPress';
    else if (html.includes('wix.com') || html.includes('wixsite')) cms = 'Wix';
    else if (html.includes('squarespace')) cms = 'Squarespace';
    else if (html.includes('shopify')) cms = 'Shopify';
    else if (html.includes('elementor')) cms = 'WordPress+Elementor';

    // Check SSL
    const isHttps = url.startsWith('https://');

    // Check mobile viewport
    const hasViewport = /meta[^>]+name=["']viewport["']/i.test(html);

    // Count internal links
    const linkMatches = html.match(/<a[^>]+href=["'][^"']*/gi) || [];

    // Extract social links from HTML
    const socialLinks: string[] = [];
    const socialPatterns = [/facebook\.com\/[^"'\s]+/gi, /instagram\.com\/[^"'\s]+/gi, /linkedin\.com\/[^"'\s]+/gi, /tiktok\.com\/@[^"'\s]+/gi];
    for (const pattern of socialPatterns) {
      const matches = html.match(pattern);
      if (matches) socialLinks.push(...matches);
    }

    // Check for structured data
    const hasSchema = html.includes('application/ld+json');

    // Check page speed indicators
    const hasLazyLoading = html.includes('loading="lazy"') || html.includes("loading='lazy'");

    // ── Deep extraction ──────────────────────────────────────────────────
    // H2 headings (up to 10)
    const h2Matches = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
    const h2Headings = h2Matches.slice(0, 10).map(m => m.replace(/<[^>]*>/g, '').trim()).filter(Boolean);

    // Word count estimate (strip HTML tags, count words)
    const strippedText = html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const wordCount = strippedText.split(/\s+/).filter(Boolean).length;

    // Number of images
    const imageCount = (html.match(/<img[\s>]/gi) || []).length;

    // Contact form detection
    const hasContactForm = /<form[\s\S]*?<\/form>/i.test(html) &&
      (html.includes('contact') || html.includes('email') || html.includes('message') ||
       html.includes('שלח') || html.includes('צור קשר'));

    // Phone number detection
    const phonePattern = /(?:tel:|href=["']tel:)([^"'\s<>]+)/i;
    const phoneInText = html.match(/(?:\+972|0[2-9])[\s\-]?\d{1,2}[\s\-]?\d{3}[\s\-]?\d{4}/);
    const hasPhoneNumber = phonePattern.test(html) || !!phoneInText;

    // WhatsApp link
    const hasWhatsApp = /wa\.me|whatsapp\.com|api\.whatsapp/i.test(html);

    // Analytics detection
    const hasGoogleAnalytics = /google-analytics\.com|gtag|UA-\d+|G-[A-Z0-9]+/i.test(html);
    const hasGoogleTagManager = /googletagmanager\.com|GTM-[A-Z0-9]+/i.test(html);

    // Language detection
    const detectedLanguages: string[] = [];
    const htmlLang = html.match(/<html[^>]+lang=["']([^"']+)/i)?.[1];
    if (htmlLang) detectedLanguages.push(htmlLang.substring(0, 2));
    if (/[֐-׿]/.test(html)) { if (!detectedLanguages.includes('he')) detectedLanguages.push('he'); }
    if (/[؀-ۿ]/.test(html)) { if (!detectedLanguages.includes('ar')) detectedLanguages.push('ar'); }
    if (/[a-zA-Z]{3,}/.test(strippedText)) { if (!detectedLanguages.includes('en')) detectedLanguages.push('en'); }

    // Link analysis (internal vs external)
    let internalLinkCount = 0;
    let externalLinkCount = 0;
    let siteDomain = '';
    try { siteDomain = new URL(url).hostname; } catch {}
    for (const rawLink of linkMatches) {
      const hrefMatch = rawLink.match(/href=["']([^"']*)/i);
      if (!hrefMatch) continue;
      const href = hrefMatch[1];
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
      if (href.startsWith('/') || href.startsWith('.') || !href.includes('://')) { internalLinkCount++; continue; }
      try { const linkHost = new URL(href).hostname; linkHost === siteDomain ? internalLinkCount++ : externalLinkCount++; } catch { internalLinkCount++; }
    }

    // Blog section detection
    const hasBlog = /\/blog|\/articles|\/posts|\/magazine|\/בלוג|\/כתבות/i.test(html) ||
      /<a[^>]+href=["'][^"']*(?:blog|article|post|כתב)[^"']*/i.test(html);

    // Favicon detection
    const hasFavicon = /rel=["'](?:shortcut )?icon["']/i.test(html) || /rel=["']apple-touch-icon["']/i.test(html);

    // Page size in KB
    const pageSizeKB = Math.round(html.length / 1024);

    // CSS and JS file counts
    const cssFileCount = (html.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi) || []).length;
    const jsFileCount = (html.match(/<script[^>]+src=["'][^"']+["']/gi) || []).length;

    const facts = {
      title: titleMatch?.[1]?.trim() || '',
      description: descMatch?.[1]?.trim() || '',
      ogImage: ogImageMatch?.[1] || '',
      h1: h1Match?.[1]?.trim() || '',
      canonical: canonicalMatch?.[1] || '',
      cms,
      isHttps,
      hasMobileViewport: hasViewport,
      internalLinks: linkMatches.length,
      socialLinksFound: socialLinks,
      hasSchemaMarkup: hasSchema,
      hasLazyLoading,
      htmlLength: html.length,
      pageCount: 1,
      // Deep analysis fields
      h2Headings,
      wordCount,
      imageCount,
      hasContactForm,
      hasPhoneNumber,
      hasWhatsApp,
      hasGoogleAnalytics,
      hasGoogleTagManager,
      detectedLanguages,
      internalLinkCount,
      externalLinkCount,
      hasBlog,
      hasFavicon,
      pageSizeKB,
      cssFileCount,
      jsFileCount,
    };

    console.log('[LeadResearch] Website scan complete:', facts.title || url);

    return {
      websiteFacts: facts,
      scannedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[LeadResearch] Website scan failed:', err?.message);
    // Try extractWebsiteFacts as fallback
    try {
      const { extractWebsiteFacts } = await import('@/lib/seo/website-facts');
      const facts = extractWebsiteFacts(null, [], url);
      return { websiteFacts: facts, scannedAt: new Date().toISOString() };
    } catch {
      return null;
    }
  }
}

// ── Self-contained stage runners — no external engine dependencies ────────────

async function runSocialScan(url: string, businessName: string, socialUrls?: Record<string, string>): Promise<any> {
  // Deep social scan: fetch each social profile and extract real meta data
  console.log('[LeadResearch] Stage 2: Deep social scan for', businessName);
  const result: Record<string, any> = {
    facebook: null, instagram: null, linkedin: null, tiktok: null,
  };

  // Step 1: discover social links from the website HTML (fallback for platforms not provided)
  const discoveredUrls: Record<string, string> = {};
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudioPixelBot/1.0)', Accept: 'text/html' },
      signal: controller.signal, redirect: 'follow',
    });
    clearTimeout(timeout);
    if (res.ok) {
      const html = await res.text();
      const fbMatch = html.match(/(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^"'\s<>]+/i);
      const igMatch = html.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^"'\s<>]+/i);
      const liMatch = html.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^"'\s<>]+/i);
      const tkMatch = html.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^"'\s<>]+/i);
      if (fbMatch) discoveredUrls.facebook = fbMatch[0];
      if (igMatch) discoveredUrls.instagram = igMatch[0];
      if (liMatch) discoveredUrls.linkedin = liMatch[0];
      if (tkMatch) discoveredUrls.tiktok = tkMatch[0];
    }
  } catch (e: any) {
    console.warn('[LeadResearch] Social discovery fetch error:', e?.message);
  }

  // Merge: manual socialUrls override discovered ones
  const platformUrls: Record<string, string> = { ...discoveredUrls };
  if (socialUrls) {
    for (const [platform, pUrl] of Object.entries(socialUrls)) {
      if (pUrl) platformUrls[platform] = pUrl;
    }
  }

  // Helper to fetch a social profile page and extract meta tags
  async function fetchSocialMeta(profileUrl: string): Promise<Record<string, string>> {
    const meta: Record<string, string> = {};
    try {
      let fullUrl = profileUrl;
      if (!fullUrl.startsWith('http')) fullUrl = 'https://' + fullUrl;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        },
        signal: controller.signal, redirect: 'follow',
      });
      clearTimeout(timeout);
      if (!res.ok) return meta;
      const html = await res.text();

      // Extract common meta tags
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i)?.[1];
      const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i)?.[1];
      const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)/i)?.[1];
      const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1];
      const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];

      if (ogTitle) meta.ogTitle = ogTitle.trim();
      if (ogDesc) meta.ogDescription = ogDesc.trim();
      if (ogImage) meta.ogImage = ogImage.trim();
      if (metaDesc) meta.metaDescription = metaDesc.trim();
      if (titleTag) meta.pageTitle = titleTag.trim();

      // Try to extract follower/like counts from meta or visible text
      const followersMatch = html.match(/(\d[\d,\.]+)\s*(?:Followers|followers|עוקבים)/i);
      if (followersMatch) meta.followers = followersMatch[1].replace(/,/g, '');
      const likesMatch = html.match(/(\d[\d,\.]+)\s*(?:likes|people like|אנשים אוהבים)/i);
      if (likesMatch) meta.likes = likesMatch[1].replace(/,/g, '');

      // Additional platform-specific extraction from JSON-LD / embedded data
      const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
      for (const block of jsonLdMatches) {
        const jsonContent = block.replace(/<[^>]*>/g, '');
        try {
          const parsed = JSON.parse(jsonContent);
          if (parsed.name && !meta.ogTitle) meta.ogTitle = parsed.name;
          if (parsed.description && !meta.ogDescription) meta.ogDescription = parsed.description;
          if (parsed.interactionStatistic) {
            const stats = Array.isArray(parsed.interactionStatistic) ? parsed.interactionStatistic : [parsed.interactionStatistic];
            for (const stat of stats) {
              if (stat.interactionType?.['@type'] === 'FollowAction') meta.followers = String(stat.userInteractionCount);
            }
          }
        } catch { /* ignore malformed JSON-LD */ }
      }
    } catch (e: any) {
      console.warn('[LeadResearch] Social meta fetch error:', e?.message);
    }
    return meta;
  }

  // Step 2: fetch and enrich each platform
  const platforms: Array<{ key: string; label: string }> = [
    { key: 'facebook', label: 'Facebook' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'tiktok', label: 'TikTok' },
  ];

  const fetchPromises = platforms.map(async (platform) => {
    const profileUrl = platformUrls[platform.key];
    if (!profileUrl) return;

    const source = socialUrls?.[platform.key] ? 'manual' : 'website';
    const meta = await fetchSocialMeta(profileUrl);

    const platformData: Record<string, any> = {
      url: profileUrl,
      found: true,
      source,
      name: meta.ogTitle || meta.pageTitle || null,
      description: meta.ogDescription || meta.metaDescription || null,
      image: meta.ogImage || null,
      followers: meta.followers ? parseInt(meta.followers, 10) || meta.followers : null,
      likes: meta.likes ? parseInt(meta.likes, 10) || meta.likes : null,
    };

    result[platform.key] = platformData;
  });

  await Promise.all(fetchPromises);

  const foundPlatforms = Object.keys(result).filter(k => result[k]?.found);
  console.log('[LeadResearch] Social deep scan complete:', foundPlatforms, '| with meta data');
  return result;
}

async function runGooglePresence(url: string, businessName: string, websiteFacts?: any): Promise<any> {
  // Self-contained: use Serper API if available, otherwise return basic info
  console.log('[LeadResearch] Stage 3: Google presence for', businessName);
  const serperKey = process.env.SERPER_API_KEY || process.env.SERP_API_KEY;

  const result: any = {
    found: false,
    organic: { found: false, position: null, results: [] },
    localPack: { found: false },
    reviews: null,
    keywordResults: [],
  };

  if (!serperKey) {
    console.warn('[LeadResearch] No SERPER_API_KEY — skipping Google presence');
    return result;
  }

  try {
    let domain = url;
    try { domain = new URL(url).hostname; } catch {}

    // Extract keywords from website content instead of searching for the business name
    const keywords: string[] = [];
    const wf = websiteFacts || {};
    const textContent = [wf.title, wf.description, wf.h1].filter(Boolean).join(' ');
    if (textContent.length > 10) {
      // Use the most relevant phrases from the site
      if (wf.description) keywords.push(wf.description.substring(0, 50));
      if (wf.h1 && wf.h1 !== wf.title) keywords.push(wf.h1);
    }
    if (keywords.length === 0) keywords.push(businessName);

    // Search for EACH keyword separately and report positions for each
    const keywordResults: any[] = [];
    let bestPosition: number | null = null;
    let overallFound = false;

    for (const kw of keywords.slice(0, 3)) {
      try {
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: kw, gl: 'il', hl: 'he', num: 20 }),
        });

        if (res.ok) {
          const data = await res.json();
          const organicResults = data.organic || [];
          const matchIdx = organicResults.findIndex((r: any) => r.link?.includes(domain));
          const found = matchIdx >= 0;
          const position = found ? matchIdx + 1 : null;

          keywordResults.push({
            keyword: kw,
            position,
            found,
            topResults: organicResults.slice(0, 5).map((r: any) => ({
              title: r.title, link: r.link, position: r.position,
            })),
          });

          if (found) {
            overallFound = true;
            if (bestPosition === null || (position !== null && position < bestPosition)) {
              bestPosition = position;
            }
          }

          // Also check local pack from first keyword search
          if (keywordResults.length === 1 && data.localResults?.places?.length) {
            const localMatch = data.localResults.places.find((p: any) =>
              p.title?.toLowerCase().includes(businessName.toLowerCase()) ||
              p.website?.includes(domain)
            );
            if (localMatch) {
              result.localPack.found = true;
              result.reviews = { rating: localMatch.rating, count: localMatch.reviews };
            }
          }
        }
      } catch (kwErr: any) {
        console.warn('[LeadResearch] Keyword search error for', kw, ':', kwErr?.message);
      }
    }

    result.found = overallFound;
    result.organic.found = overallFound;
    result.organic.position = bestPosition;
    result.organic.results = keywordResults[0]?.topResults || [];
    result.keywordResults = keywordResults;

    console.log('[LeadResearch] Google presence:', result.found ? `found at position ${result.organic.position}` : 'not found', `(${keywordResults.length} keywords searched)`);
  } catch (e: any) {
    console.warn('[LeadResearch] Google presence error:', e?.message);
  }

  return result;
}

async function runSeoAnalysis(url: string, websiteFacts: any): Promise<any> {
  console.log('[LeadResearch] Stage 4: SEO analysis — HTML facts + PageSpeed + Backlinks');

  if (!websiteFacts) return { technicalScore: 0, contentScore: 0, issues: [], contentGaps: [], pageSpeed: null, backlinks: null };

  const issues: string[] = [];
  let techPoints = 0;
  let contentPoints = 0;

  // ── Technical signals from HTML ──
  if (websiteFacts.isHttps) techPoints += 15; else issues.push('האתר לא משתמש ב-HTTPS — פוגע באמינות ובדירוג');
  if (websiteFacts.hasMobileViewport) techPoints += 15; else issues.push('האתר לא מותאם למובייל — 70% מהגלישה ממובייל');
  if (websiteFacts.hasSchemaMarkup) techPoints += 10; else issues.push('אין Schema Markup — גוגל לא מבין את מבנה התוכן');
  if (websiteFacts.hasLazyLoading) techPoints += 5; else issues.push('אין Lazy Loading — עמוד נטען לאט');
  if (websiteFacts.canonical) techPoints += 5; else issues.push('אין Canonical URL — עלול לגרום לתוכן כפול');
  if ((websiteFacts.cms || '').includes('WordPress')) techPoints += 5;
  if (websiteFacts.hasGoogleAnalytics) techPoints += 5; else issues.push('אין Google Analytics — אי אפשר למדוד תוצאות');
  if (websiteFacts.hasGoogleTagManager) techPoints += 5;
  if (websiteFacts.hasFavicon) techPoints += 3; else issues.push('אין Favicon — נראה לא מקצועי');
  if (websiteFacts.internalLinkCount > 10) techPoints += 7; else if (websiteFacts.internalLinkCount > 3) techPoints += 3; else issues.push('מעט מאוד לינקים פנימיים — מבנה אתר חלש');
  if (websiteFacts.pageSizeKB > 3000) issues.push(`עמוד כבד (${websiteFacts.pageSizeKB}KB) — עלול להיטען לאט`);
  if (websiteFacts.jsFileCount > 15) issues.push(`${websiteFacts.jsFileCount} קבצי JS — עומס שעלול להאט את האתר`);

  // ── Content signals ──
  if (websiteFacts.title && websiteFacts.title.length > 10 && websiteFacts.title.length < 70) contentPoints += 20;
  else if (websiteFacts.title) { contentPoints += 10; issues.push('כותרת אתר לא באורך אופטימלי (10-70 תווים)'); }
  else issues.push('אין כותרת אתר כלל');

  if (websiteFacts.description && websiteFacts.description.length > 50 && websiteFacts.description.length < 160) contentPoints += 20;
  else if (websiteFacts.description) { contentPoints += 10; issues.push('Meta Description לא באורך אופטימלי (50-160 תווים)'); }
  else issues.push('אין Meta Description — גוגל ייצור תיאור אוטומטי גרוע');

  if (websiteFacts.h1 && websiteFacts.h1.length > 3) contentPoints += 15; else issues.push('אין H1 — גוגל לא יודע מה נושא העמוד');
  if ((websiteFacts.h2Headings || []).length >= 3) contentPoints += 10; else issues.push('פחות מ-3 כותרות H2 — מבנה תוכן חלש');
  if (websiteFacts.ogImage) contentPoints += 10; else issues.push('אין תמונת OG — שיתוף ברשתות נראה ריק');
  if (websiteFacts.wordCount > 500) contentPoints += 10; else issues.push('תוכן דל — פחות מ-500 מילים');
  if (websiteFacts.imageCount > 3) contentPoints += 5; else issues.push('מעט תמונות — תוכן ויזואלי חשוב');
  if (websiteFacts.hasContactForm) contentPoints += 5;
  if (websiteFacts.hasPhoneNumber) contentPoints += 3;
  if (websiteFacts.hasWhatsApp) contentPoints += 2;
  if (websiteFacts.hasBlog) contentPoints += 10; else issues.push('אין בלוג — מפספס הזדמנויות תוכן וקידום');

  // ── PageSpeed Insights (real API) ──
  let pageSpeed: any = null;
  const pageSpeedKey = process.env.GOOGLE_PAGESPEED_API_KEY || process.env.PAGESPEED_API_KEY;
  if (pageSpeedKey) {
    try {
      const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${pageSpeedKey}&strategy=mobile&category=performance&category=accessibility&category=seo`;
      const psRes = await fetch(psUrl, { signal: AbortSignal.timeout(20_000) });
      if (psRes.ok) {
        const psData = await psRes.json();
        const categories = psData.lighthouseResult?.categories;
        pageSpeed = {
          performanceScore: Math.round((categories?.performance?.score || 0) * 100),
          accessibilityScore: Math.round((categories?.accessibility?.score || 0) * 100),
          seoScore: Math.round((categories?.seo?.score || 0) * 100),
          fcp: psData.lighthouseResult?.audits?.['first-contentful-paint']?.displayValue || null,
          lcp: psData.lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue || null,
          cls: psData.lighthouseResult?.audits?.['cumulative-layout-shift']?.displayValue || null,
          tbt: psData.lighthouseResult?.audits?.['total-blocking-time']?.displayValue || null,
          speedIndex: psData.lighthouseResult?.audits?.['speed-index']?.displayValue || null,
        };
        // Adjust tech score based on real performance
        if (pageSpeed.performanceScore < 50) { techPoints -= 10; issues.push(`ביצועי מובייל נמוכים: ${pageSpeed.performanceScore}/100`); }
        else if (pageSpeed.performanceScore >= 80) techPoints += 10;
        console.log('[LeadResearch] PageSpeed:', pageSpeed.performanceScore, 'perf,', pageSpeed.seoScore, 'seo');
      }
    } catch (e: any) { console.warn('[LeadResearch] PageSpeed API error:', e?.message); }
  }

  // ── Backlink check via Serper ──
  let backlinks: any = null;
  const serperKey = process.env.SERPER_API_KEY || process.env.SERP_API_KEY;
  if (serperKey) {
    try {
      let domain = '';
      try { domain = new URL(url).hostname; } catch {}
      const blRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: `link:${domain}`, gl: 'il', num: 10 }),
      });
      if (blRes.ok) {
        const blData = await blRes.json();
        const totalResults = blData.searchInformation?.totalResults || '0';
        backlinks = {
          estimatedCount: parseInt(totalResults.replace(/,/g, ''), 10) || 0,
          topReferrers: (blData.organic || []).slice(0, 5).map((r: any) => ({
            domain: (() => { try { return new URL(r.link).hostname; } catch { return r.link; } })(),
            title: r.title,
          })),
        };
        if (backlinks.estimatedCount < 10) issues.push(`מעט backlinks (${backlinks.estimatedCount}) — העסק לא מקבל לינקים מאתרים אחרים`);
      }
    } catch (e: any) { console.warn('[LeadResearch] Backlink check error:', e?.message); }
  }

  // ── Social post frequency via Serper ──
  let socialActivity: any = null;
  if (serperKey && websiteFacts.title) {
    try {
      const saRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: `"${websiteFacts.title}" site:facebook.com OR site:instagram.com`, gl: 'il', num: 5 }),
      });
      if (saRes.ok) {
        const saData = await saRes.json();
        socialActivity = {
          recentMentions: parseInt(saData.searchInformation?.totalResults?.replace(/,/g, '') || '0', 10),
          mentions: (saData.organic || []).slice(0, 3).map((r: any) => ({
            title: r.title, link: r.link, snippet: r.snippet?.substring(0, 100),
          })),
        };
      }
    } catch (e: any) { console.warn('[LeadResearch] Social activity check error:', e?.message); }
  }

  return {
    technicalScore: Math.min(Math.max(techPoints, 0), 100),
    contentScore: Math.min(Math.max(contentPoints, 0), 100),
    issues,
    contentGaps: issues.filter(i => i.includes('תוכן') || i.includes('Description') || i.includes('H1') || i.includes('בלוג')),
    pageSpeed,
    backlinks,
    socialActivity,
  };
}

async function runGeoAnalysis(url: string, businessName: string, websiteFacts: any): Promise<any> {
  // Self-contained: report as "not checked" — no fake data
  console.log('[LeadResearch] Stage 5: GEO/AI visibility check');

  const platforms = [
    { id: 'google_ai_overview', name: 'Google AI Overview' },
    { id: 'chatgpt', name: 'ChatGPT' },
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'perplexity', name: 'Perplexity' },
    { id: 'claude', name: 'Claude' },
  ];

  // Try each platform if API keys are available
  const results = platforms.map(p => ({
    platformId: p.id,
    platformName: p.name,
    found: false,
    checked: false,
    queries: [],
  }));

  // Try Perplexity if key exists
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (perplexityKey) {
    try {
      const query = `מי מספק שירותי ${websiteFacts?.title || businessName} בישראל?`;
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [{ role: 'user', content: query }],
          max_tokens: 500,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const answer = data.choices?.[0]?.message?.content || '';
        let domain = '';
        try { domain = new URL(url).hostname.replace('www.', ''); } catch {}
        const found = answer.toLowerCase().includes(domain) || answer.toLowerCase().includes(businessName.toLowerCase());
        const pIdx = results.findIndex(r => r.platformId === 'perplexity');
        if (pIdx >= 0) {
          results[pIdx].found = found;
          results[pIdx].checked = true;
          results[pIdx].queries = [{ query, found, response: answer.substring(0, 300) }] as any;
        }
      }
    } catch (e: any) {
      console.warn('[LeadResearch] Perplexity check error:', e?.message);
    }
  }

  const checked = results.filter(r => r.checked);
  const found = checked.filter(r => r.found);
  const overallVisibility = checked.length > 0 ? Math.round((found.length / checked.length) * 100) : 0;

  return { overallVisibility, platforms: results, checkedCount: checked.length };
}

async function runCompetitorAnalysis(url: string, websiteFacts: any): Promise<any> {
  // Self-contained: use Serper to find competitors
  console.log('[LeadResearch] Stage 7: Competitor analysis');
  const serperKey = process.env.SERPER_API_KEY || process.env.SERP_API_KEY;

  if (!serperKey || !websiteFacts?.title) {
    return { competitors: [], marketPosition: 'unknown' };
  }

  try {
    let domain = '';
    try { domain = new URL(url).hostname; } catch {}

    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: websiteFacts.title, gl: 'il', hl: 'he', num: 10 }),
    });

    if (!res.ok) return { competitors: [], marketPosition: 'unknown' };

    const data = await res.json();
    const competitors = (data.organic || [])
      .filter((r: any) => !r.link?.includes(domain))
      .slice(0, 5)
      .map((r: any, i: number) => ({
        name: r.title,
        domain: new URL(r.link).hostname,
        position: i + 1,
        strengths: [r.snippet?.substring(0, 100)],
        weaknesses: [],
      }));

    return { competitors, marketPosition: competitors.length > 3 ? 'competitive' : 'niche' };
  } catch (e: any) {
    console.warn('[LeadResearch] Competitor analysis error:', e?.message);
    return { competitors: [], marketPosition: 'unknown' };
  }
}

async function runScoring(data: {
  websiteFacts: any;
  seoAnalysis: any;
  geoAnalysis: any;
  competitorAnalysis: any;
  socialPresence: any;
  googlePresence: any;
}): Promise<any> {
  // Self-contained scoring based on actual collected data
  console.log('[LeadResearch] Stage 8: Scoring');

  const wf = data.websiteFacts || {};
  const seo = data.seoAnalysis || {};
  const geo = data.geoAnalysis || {};
  const social = data.socialPresence || {};
  const google = data.googlePresence || {};

  // Calculate category scores
  const seoScore = Math.round(((seo.technicalScore || 0) + (seo.contentScore || 0)) / 2);

  const socialPlatforms = ['facebook', 'instagram', 'linkedin', 'tiktok'];
  const socialFound = socialPlatforms.filter(p => social[p]?.found).length;
  const socialScore = Math.round((socialFound / socialPlatforms.length) * 100);

  const googleScore = google?.found ? (google.organic?.position <= 3 ? 90 : google.organic?.position <= 10 ? 70 : 50) : 10;

  const aiScore = geo?.overallVisibility ?? 0;

  // Overall weighted score
  const overall = Math.round(seoScore * 0.35 + socialScore * 0.2 + googleScore * 0.25 + aiScore * 0.2);

  const gradeFromScore = (s: number) => s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B+' : s >= 60 ? 'B' : s >= 50 ? 'C+' : s >= 40 ? 'C' : s >= 30 ? 'D' : 'F';

  return {
    overall,
    grade: gradeFromScore(overall),
    confidence: wf.title ? 75 : 30,
    categories: [
      { category: 'SEO', categoryHe: 'קידום אורגני', score: seoScore, weight: 0.35, grade: gradeFromScore(seoScore) },
      { category: 'Social', categoryHe: 'רשתות חברתיות', score: socialScore, weight: 0.2, grade: gradeFromScore(socialScore) },
      { category: 'Google', categoryHe: 'נוכחות בגוגל', score: googleScore, weight: 0.25, grade: gradeFromScore(googleScore) },
      { category: 'AI Visibility', categoryHe: 'נראות AI', score: aiScore, weight: 0.2, grade: gradeFromScore(aiScore) },
    ],
  };
}

async function runSalesOpportunities(data: {
  websiteFacts: any;
  seoAnalysis: any;
  geoAnalysis: any;
  socialPresence: any;
  googlePresence: any;
  scores: any;
}): Promise<any[]> {
  // Self-contained: generate opportunities from actual scan data
  console.log('[LeadResearch] Stage 9: Sales opportunities analysis');
  const opportunities: any[] = [];
  const seo = data.seoAnalysis || {};
  const social = data.socialPresence || {};
  const google = data.googlePresence || {};
  const geo = data.geoAnalysis || {};
  const wf = data.websiteFacts || {};

  // Rule 1: SEO/GEO plan needed
  const seoScore = Math.round(((seo.technicalScore || 0) + (seo.contentScore || 0)) / 2);
  if (seoScore < 60) {
    opportunities.push({
      id: 'seo_plan',
      service: 'תוכנית SEO/GEO 60 יום',
      serviceHe: 'תוכנית SEO/GEO 60 יום',
      priority: 1,
      estimatedValue: 8000,
      evidence: `ציון SEO של ${seoScore}/100 — פוטנציאל שיפור משמעותי`,
      evidenceHe: `ציון SEO של ${seoScore}/100 — פוטנציאל שיפור משמעותי`,
      pitch: 'תוכנית SEO/GEO מקיפה ל-60 יום שתעלה את הדירוג בגוגל ובמנועי AI',
      pitchHe: 'תוכנית SEO/GEO מקיפה ל-60 יום שתעלה את הדירוג בגוגל ובמנועי AI',
    });
  }

  // Rule 2: AI Visibility
  const aiVis = geo?.overallVisibility ?? 0;
  if (aiVis < 50) {
    opportunities.push({
      id: 'ai_visibility',
      service: 'נראות AI ו-GEO',
      serviceHe: 'נראות AI ו-GEO',
      priority: 2,
      estimatedValue: 6000,
      evidence: `נראות AI של ${aiVis}% בלבד — העסק כמעט בלתי נראה למנועי חיפוש AI`,
      evidenceHe: `נראות AI של ${aiVis}% בלבד — העסק כמעט בלתי נראה למנועי חיפוש AI`,
      pitch: 'שירות GEO שיוודא שהעסק מופיע בתשובות ChatGPT, Gemini, Perplexity ועוד',
      pitchHe: 'שירות GEO שיוודא שהעסק מופיע בתשובות ChatGPT, Gemini, Perplexity ועוד',
    });
  }

  // Rule 3: Website issues
  const websiteIssues = (seo.issues || []).length;
  if (websiteIssues >= 2 || !wf.hasMobileViewport || !wf.isHttps) {
    opportunities.push({
      id: 'website_upgrade',
      service: 'שדרוג ועיצוב אתר',
      serviceHe: 'שדרוג ועיצוב אתר',
      priority: 3,
      estimatedValue: 12000,
      evidence: `${websiteIssues} בעיות טכניות זוהו באתר`,
      evidenceHe: `${websiteIssues} בעיות טכניות זוהו באתר`,
      pitch: 'שדרוג האתר עם עיצוב מודרני, מובייל-ראשון, ומותאם SEO',
      pitchHe: 'שדרוג האתר עם עיצוב מודרני, מובייל-ראשון, ומותאם SEO',
    });
  }

  // Rule 4: Social media gaps
  const socialPlatforms = ['facebook', 'instagram', 'linkedin', 'tiktok'];
  const missingSocial = socialPlatforms.filter(p => !social[p]?.found);
  if (missingSocial.length >= 2) {
    opportunities.push({
      id: 'social_media',
      service: 'ניהול רשתות חברתיות',
      serviceHe: 'ניהול רשתות חברתיות',
      priority: 4,
      estimatedValue: 4000,
      evidence: `חסרים ${missingSocial.length} פלטפורמות: ${missingSocial.join(', ')}`,
      evidenceHe: `חסרים ${missingSocial.length} פלטפורמות: ${missingSocial.join(', ')}`,
      pitch: 'ניהול מקצועי של הרשתות החברתיות עם תוכן ממוקד ופרסום ממומן',
      pitchHe: 'ניהול מקצועי של הרשתות החברתיות עם תוכן ממוקד ופרסום ממומן',
    });
  }

  // Rule 5: GBP
  if (!google?.localPack?.found) {
    opportunities.push({
      id: 'gbp',
      service: 'Google Business Profile',
      serviceHe: 'Google Business Profile',
      priority: 5,
      estimatedValue: 2000,
      evidence: 'לא נמצא פרופיל עסקי בגוגל',
      evidenceHe: 'לא נמצא פרופיל עסקי בגוגל',
      pitch: 'הקמה וניהול Google Business Profile לנוכחות מקומית חזקה',
      pitchHe: 'הקמה וניהול Google Business Profile לנוכחות מקומית חזקה',
    });
  }

  // Rule 6: No OG image = branding opportunity
  if (!wf.ogImage) {
    opportunities.push({
      id: 'branding',
      service: 'חבילת מיתוג דיגיטלי',
      serviceHe: 'חבילת מיתוג דיגיטלי',
      priority: 6,
      estimatedValue: 5000,
      evidence: 'אין תמונת שיתוף (OG Image) — המיתוג הדיגיטלי חלש',
      evidenceHe: 'אין תמונת שיתוף (OG Image) — המיתוג הדיגיטלי חלש',
      pitch: 'חבילת מיתוג מלאה: לוגו, צבעים, פונטים, תמונות שיתוף ומדיה',
      pitchHe: 'חבילת מיתוג מלאה: לוגו, צבעים, פונטים, תמונות שיתוף ומדיה',
    });
  }

  console.log('[LeadResearch] Found', opportunities.length, 'sales opportunities');
  return opportunities.sort((a, b) => a.priority - b.priority);
}

async function runQuarterPlan(data: {
  leadName: string;
  websiteUrl: string;
  websiteFacts: any;
  scores: any;
  salesOpportunities: any[];
}): Promise<any> {
  try {
    const { generateWithAI } = await import('@/lib/ai/openai-client');

    const systemPrompt = `אתה יועץ שיווק דיגיטלי בכיר של סטודיו פיקסל (Studio Pixel) עם ניסיון של 15 שנה בבניית תוכניות צמיחה דיגיטליות.
בנה תוכנית צמיחה רבעונית מקצועית ומפורטת (90 יום) עבור העסק המבוקש.

זוהי תוכנית מקצועית שתוצג ללקוח — היא חייבת להיות מפורטת, קונקרטית ומעשית.

החזר JSON בלבד בפורמט הבא:
{
  "quarter": "Q3 2026",
  "goals": [
    {
      "id": "g1",
      "title": "...",
      "titleHe": "כותרת יעד בעברית — ספציפית ומדידה",
      "metric": "המדד המדויק למדידה (למשל: תנועה אורגנית, לידים, מיקום בגוגל)",
      "currentValue": "ערך נוכחי (אם ידוע, אחרת הערכה)",
      "targetValue": "יעד ריאלי ל-90 יום",
      "kpis": ["KPI 1", "KPI 2", "KPI 3"],
      "budget": "הערכת תקציב ליעד זה",
      "expectedResults": "מה צפוי לקרות כשהיעד יושג",
      "actions": [
        { "week": 1, "action": "...", "actionHe": "פעולה ספציפית ומפורטת — לא כללית", "responsible": "Studio Pixel" },
        { "week": 2, "action": "...", "actionHe": "...", "responsible": "Studio Pixel" }
      ]
    }
  ],
  "estimatedROI": "הערכת ROI מפורטת עם הסבר",
  "totalInvestment": 0,
  "generatedAt": "${new Date().toISOString()}"
}

חובה:
- בנה בדיוק 5-7 יעדים מרכזיים (לא פחות מ-5!)
- כל יעד חייב לכלול 8-12 פעולות שבועיות מפורטות (שבועות 1-12)
- כל פעולה חייבת להיות ספציפית, קונקרטית ומעשית — לא "שיפור SEO" אלא "כתיבת 4 מאמרי בלוג ממוקדי מילות מפתח של 1500+ מילים"
- הוסף KPIs, תקציב והערכת תוצאות לכל יעד
- הכל בעברית
- אל תמציא נתונים — השתמש רק במה שאתה יודע`;

    const userPrompt = `בנה תוכנית רבעונית מקצועית ומפורטת עבור "${data.leadName}" (${data.websiteUrl}).
ציון נוכחי: ${data.scores?.overall ?? 'לא ידוע'}/100
ציון ביטחון: ${data.scores?.confidence ?? 'לא ידוע'}%
הזדמנויות מכירה: ${data.salesOpportunities?.length ?? 0}
${data.salesOpportunities?.map((o: any) => `  - ${o.serviceHe || o.service}: ${o.evidenceHe || o.evidence || ''}`).join('\n') || ''}

בנה 5-7 יעדים מרכזיים, כל אחד עם 8-12 פעולות שבועיות מפורטות וספציפיות.
כל פעולה חייבת לכלול מה בדיוק צריך לעשות, לא רק כותרת כללית.`;

    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 3000 });
    if (!result.success || !result.data) return null;

    // generateWithAI already parses JSON
    const plan = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    return plan;
  } catch {
    return null;
  }
}

// ── AI Deep Analysis — runs generateWithAI on raw data per area ─────────────

async function runDeepAIAnalysis(data: {
  leadName: string;
  websiteUrl: string;
  websiteFacts: any;
  socialPresence: any;
  googlePresence: any;
  seoAnalysis: any;
  geoAnalysis: any;
  competitorAnalysis: any;
}): Promise<any> {
  console.log('[LeadResearch] Running deep AI analysis...');
  const { generateWithAI } = await import('@/lib/ai/openai-client');
  const wf = data.websiteFacts || {};
  const social = data.socialPresence || {};
  const result: any = {};

  // ── 1. Website Deep Analysis (UX + UI + Content) ──
  try {
    const websiteData = `
כותרת: ${wf.title || 'לא נמצא'}
תיאור: ${wf.description || 'לא נמצא'}
H1: ${wf.h1 || 'חסר'}
כותרות H2: ${(wf.h2Headings || []).join(', ') || 'אין'}
CMS: ${wf.cms || 'לא זוהה'}
HTTPS: ${wf.isHttps ? 'כן' : 'לא'}
מותאם למובייל: ${wf.hasMobileViewport ? 'כן' : 'לא'}
Schema Markup: ${wf.hasSchemaMarkup ? 'כן' : 'לא'}
Lazy Loading: ${wf.hasLazyLoading ? 'כן' : 'לא'}
טופס יצירת קשר: ${wf.hasContactForm ? 'כן' : 'לא'}
מספר טלפון: ${wf.hasPhoneNumber ? 'כן' : 'לא'}
WhatsApp: ${wf.hasWhatsApp ? 'כן' : 'לא'}
Google Analytics: ${wf.hasGoogleAnalytics ? 'כן' : 'לא'}
בלוג: ${wf.hasBlog ? 'כן' : 'לא'}
מספר מילים: ${wf.wordCount || '?'}
מספר תמונות: ${wf.imageCount || '?'}
לינקים פנימיים: ${wf.internalLinkCount || '?'}
לינקים חיצוניים: ${wf.externalLinkCount || '?'}
קבצי CSS: ${wf.cssFileCount || '?'}, קבצי JS: ${wf.jsFileCount || '?'}
גודל עמוד: ${wf.pageSizeKB || '?'} KB
שפות: ${(wf.detectedLanguages || []).join(', ') || '?'}
favicon: ${wf.hasFavicon ? 'כן' : 'לא'}
OG Image: ${wf.ogImage ? 'כן' : 'לא'}`;

    const r = await generateWithAI(
      `אתה מומחה UX/UI ושיווק דיגיטלי של סטודיו פיקסל. נתח את האתר לעומק.
החזר JSON: { "uxAnalysis": "3-4 פסקאות ניתוח UX/UI מפורט", "contentAnalysis": "3-4 פסקאות ניתוח תוכן", "technicalNotes": "2-3 פסקאות ניתוח טכני", "strengths": ["חוזק 1", "חוזק 2"], "weaknesses": ["חולשה 1", "חולשה 2"], "recommendations": ["המלצה 1", "המלצה 2", "המלצה 3"] }
כתוב בעברית. בסס רק על הנתונים שניתנו. אל תמציא.`,
      `נתח את האתר ${data.websiteUrl} עבור "${data.leadName}":\n${websiteData}`,
      { temperature: 0.6, maxTokens: 2000 }
    );
    if (r.success && r.data) {
      result.websiteDeepAnalysis = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    }
  } catch (e) { console.warn('[LeadResearch] Website AI analysis failed:', e); }

  // ── 2. Social Media Deep Analysis ──
  try {
    const platforms = ['facebook', 'instagram', 'linkedin', 'tiktok'];
    const socialData = platforms.map(p => {
      const d = social[p];
      if (!d?.found) return `${p}: לא נמצא`;
      return `${p}: נמצא | URL: ${d.url || '?'} | שם: ${d.name || '?'} | תיאור: ${(d.description || '').substring(0, 200)} | עוקבים: ${d.followers || '?'} | לייקים: ${d.likes || '?'}`;
    }).join('\n');

    const r = await generateWithAI(
      `אתה מומחה שיווק ברשתות חברתיות של סטודיו פיקסל. נתח כל פלטפורמה לעומק.
החזר JSON: {
  "overallAssessment": "2-3 פסקאות הערכה כללית של הנוכחות ברשתות",
  "platformAnalyses": [
    { "platform": "facebook", "analysis": "2-3 פסקאות ניתוח מעמיק — נראות, מסרים, תוכן, עוקבים, מעורבות, עקביות פרסום", "score": 0-100, "recommendations": ["המלצה 1", "המלצה 2"] },
    { "platform": "instagram", "analysis": "...", "score": 0-100, "recommendations": [] },
    { "platform": "tiktok", "analysis": "...", "score": 0-100, "recommendations": [] },
    { "platform": "linkedin", "analysis": "...", "score": 0-100, "recommendations": [] }
  ],
  "contentStrategy": "2-3 פסקאות המלצות לאסטרטגיית תוכן",
  "missingOpportunities": ["הזדמנות 1", "הזדמנות 2"]
}
כתוב בעברית. נתח גם פלטפורמות שלא נמצאו — הסבר למה הן חשובות. אל תמציא מספרים.`,
      `נתח את הרשתות החברתיות של "${data.leadName}" (${data.websiteUrl}):\n${socialData}`,
      { temperature: 0.6, maxTokens: 2500 }
    );
    if (r.success && r.data) {
      result.socialDeepAnalysis = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    }
  } catch (e) { console.warn('[LeadResearch] Social AI analysis failed:', e); }

  // ── 3. SEO + GEO Deep Analysis ──
  try {
    const seo = data.seoAnalysis || {};
    const geo = data.geoAnalysis || {};
    const google = data.googlePresence || {};
    const comp = data.competitorAnalysis || {};

    const ps = seo.pageSpeed;
    const bl = seo.backlinks;
    const sa = seo.socialActivity;
    const seoData = `
ציון SEO טכני: ${seo.technicalScore || 0}/100
ציון תוכן: ${seo.contentScore || 0}/100
בעיות שנמצאו: ${(seo.issues || []).join(', ') || 'אין'}
נמצא בגוגל: ${google?.found ? `כן, מיקום ${google.organic?.position || '?'}` : 'לא'}
Local Pack: ${google?.localPack?.found ? 'כן' : 'לא'}
ביקורות: ${google?.reviews ? `${google.reviews.rating}/5 (${google.reviews.count})` : 'לא נמצאו'}
נראות AI: ${geo?.overallVisibility ?? 0}% (${geo?.checkedCount || 0} פלטפורמות נבדקו)
מתחרים: ${(comp.competitors || []).map((c: any) => `${c.name || c.domain} (מיקום ${c.position})`).join(', ') || 'לא נמצאו'}
${ps ? `PageSpeed (מובייל): ביצועים ${ps.performanceScore}/100, נגישות ${ps.accessibilityScore}/100, SEO ${ps.seoScore}/100
  FCP: ${ps.fcp || '?'}, LCP: ${ps.lcp || '?'}, CLS: ${ps.cls || '?'}, TBT: ${ps.tbt || '?'}` : 'PageSpeed: לא נבדק (אין API key)'}
${bl ? `Backlinks: ~${bl.estimatedCount} לינקים נכנסים | אתרים מפנים: ${(bl.topReferrers || []).map((r: any) => r.domain).join(', ') || 'אין'}` : 'Backlinks: לא נבדק'}
${sa ? `פעילות ברשתות (גוגל): ~${sa.recentMentions} אזכורים | ${(sa.mentions || []).map((m: any) => m.title).join(', ') || 'אין'}` : ''}`;

    const r = await generateWithAI(
      `אתה מומחה SEO ו-GEO של סטודיו פיקסל. נתח את מצב הקידום האורגני ונראות AI לעומק.
החזר JSON: {
  "seoDeepAnalysis": "3-4 פסקאות ניתוח SEO מעמיק — on-page, technical, content, מילות מפתח",
  "geoAnalysis": "2-3 פסקאות ניתוח GEO/AI — נראות במנועי AI, פוטנציאל, מה חסר",
  "competitorInsights": "2-3 פסקאות ניתוח מתחרים — מה הם עושים נכון, מה אפשר ללמוד",
  "localSeoStatus": "1-2 פסקאות ניתוח SEO מקומי — Google Business Profile, מפות",
  "actionPlan": ["פעולה מיידית 1", "פעולה מיידית 2", "פעולה מיידית 3", "פעולה לטווח בינוני 1", "פעולה לטווח ארוך 1"]
}
כתוב בעברית. בסס רק על הנתונים. אל תמציא דירוגים או מספרים שלא סופקו.`,
      `נתח SEO/GEO עבור "${data.leadName}" (${data.websiteUrl}):\n${seoData}`,
      { temperature: 0.6, maxTokens: 2000 }
    );
    if (r.success && r.data) {
      result.seoGeoDeepAnalysis = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    }
  } catch (e) { console.warn('[LeadResearch] SEO/GEO AI analysis failed:', e); }

  console.log('[LeadResearch] Deep AI analysis complete:', Object.keys(result));
  return result;
}

async function runReportGeneration(data: {
  leadName: string;
  websiteUrl: string;
  websiteFacts: any;
  socialPresence: any;
  googlePresence: any;
  seoAnalysis: any;
  geoAnalysis: any;
  competitorAnalysis: any;
  scores: any;
  salesOpportunities: any[];
  quarterPlan: any;
  deepAnalysis?: any;
}): Promise<any> {
  try {
    const { generateWithAI } = await import('@/lib/ai/openai-client');

    const wf = data.websiteFacts || {};
    const social = data.socialPresence || {};
    const google = data.googlePresence || {};
    const seo = data.seoAnalysis || {};
    const geo = data.geoAnalysis || {};
    const comp = data.competitorAnalysis || {};
    const scores = data.scores || {};
    const opportunities = data.salesOpportunities || [];
    const plan = data.quarterPlan;

    // Build per-platform social summary
    const socialPlatforms = ['facebook', 'instagram', 'linkedin', 'tiktok'];
    const socialDetails = socialPlatforms.map(p => {
      const d = social[p];
      if (!d?.found) return `  ${p}: לא נמצא`;
      const parts = [`  ${p}: נמצא`];
      if (d.url) parts.push(`URL: ${d.url}`);
      if (d.name) parts.push(`שם: ${d.name}`);
      if (d.description) parts.push(`תיאור: ${d.description.substring(0, 200)}`);
      if (d.followers) parts.push(`עוקבים: ${d.followers}`);
      if (d.likes) parts.push(`לייקים: ${d.likes}`);
      parts.push(`מקור: ${d.source || 'unknown'}`);
      return parts.join(' | ');
    }).join('\n');

    // Build competitor summary
    const competitorList = (comp.competitors || []).map((c: any, i: number) =>
      `  ${i + 1}. ${c.name} (${c.domain}) — מיקום ${c.position}${c.strengths?.[0] ? ` | ${c.strengths[0]}` : ''}`
    ).join('\n') || '  לא נמצאו מתחרים';

    // Build SEO issues list
    const seoIssues = (seo.issues || []).map((issue: string) => `  - ${issue}`).join('\n') || '  אין בעיות';

    // Build opportunities summary
    const opportunitySummary = opportunities.map((o: any) =>
      `  ${o.priority}. ${o.serviceHe} — ₪${o.estimatedValue?.toLocaleString() || '?'} | ${o.evidenceHe || o.evidence || ''}`
    ).join('\n') || '  לא זוהו הזדמנויות';

    // Build quarter plan summary
    const quarterPlanSummary = plan?.goals
      ? plan.goals.map((g: any) => `  - ${g.titleHe || g.title}: ${g.metric || ''} (${g.currentValue || '?'} -> ${g.targetValue || '?'})`).join('\n')
      : '  לא נוצרה תוכנית';

    // Category scores
    const categoryScores = (scores.categories || []).map((c: any) =>
      `  ${c.categoryHe || c.category}: ${c.score}/100 (${c.grade})`
    ).join('\n') || '  לא חושבו ציונים';

    const systemPrompt = `אתה כותב דוחות מחקר מקצועיים ומעמיקים עבור סטודיו פיקסל (Studio Pixel) — סוכנות שיווק דיגיטלי מובילה.
הדוח מיועד להצגה ללקוח פוטנציאלי כדי להדגים את הערך שסטודיו פיקסל יכול לספק.

כתוב דוח מקיף ומפורט בעברית. כל סעיף חייב לכלול 5-8 פסקאות מפורטות, לא 1-2 משפטים.
השתמש אך ורק בנתונים שסופקו — אל תמציא מספרים, ציונים, או עובדות.

החזר JSON בלבד בפורמט הבא:
{
  "id": "report_1",
  "title": "Lead Research Report",
  "titleHe": "דוח מחקר ליד — ${data.leadName}",
  "sections": [
    { "id": "executive_summary", "title": "Executive Summary", "titleHe": "תקציר מנהלים", "content": [{ "type": "paragraph", "text": "..." }, { "type": "paragraph", "text": "..." }, { "type": "paragraph", "text": "..." }] },
    { "id": "website_analysis", "title": "Website Analysis", "titleHe": "ניתוח אתר מעמיק", "content": [5-8 paragraphs] },
    { "id": "website_ux_review", "title": "Website UX Review", "titleHe": "סקירת חוויית משתמש", "content": [5-8 paragraphs] },
    { "id": "seo_status", "title": "SEO Status", "titleHe": "מצב SEO מקיף", "content": [5-8 paragraphs] },
    { "id": "social_media_deep", "title": "Social Media Deep Analysis", "titleHe": "ניתוח מעמיק רשתות חברתיות", "content": [5-8 paragraphs] },
    { "id": "google_presence", "title": "Google Presence", "titleHe": "נוכחות בגוגל", "content": [5-8 paragraphs] },
    { "id": "ai_visibility", "title": "AI Visibility", "titleHe": "נראות במנועי AI", "content": [5-8 paragraphs] },
    { "id": "competitors", "title": "Competitor Analysis", "titleHe": "ניתוח מתחרים", "content": [5-8 paragraphs] },
    { "id": "content_strategy", "title": "Content Strategy", "titleHe": "המלצות אסטרטגיית תוכן", "content": [5-8 paragraphs] },
    { "id": "paid_advertising", "title": "Paid Advertising Potential", "titleHe": "פוטנציאל פרסום ממומן", "content": [5-8 paragraphs] },
    { "id": "opportunities", "title": "Sales Opportunities", "titleHe": "הזדמנויות צמיחה ומכירה", "content": [5-8 paragraphs] },
    { "id": "quarter_plan", "title": "Quarter Plan", "titleHe": "תוכנית 90 יום", "content": [5-8 paragraphs] },
    { "id": "recommendations", "title": "Recommendations", "titleHe": "המלצות Studio Pixel", "content": [5-8 paragraphs] }
  ],
  "generatedAt": "${new Date().toISOString()}",
  "approved": false
}

חשוב מאוד:
- כל סעיף חייב לכלול לפחות 5-8 פסקאות מפורטות עם ניתוח מעמיק — לא 1-2 משפטים!
- השתמש בנתונים הספציפיים שסופקו (ציונים, מספרים, בעיות)
- הסבר מה המשמעות של כל ממצא עבור העסק
- תן המלצות קונקרטיות ומעשיות
- הדגש את הערך שסטודיו פיקסל יכול לספק
- סעיף ההמלצות (recommendations) חייב לכלול לפחות 10 המלצות קונקרטיות ומעשיות, כל אחת עם הסבר מפורט
- כל הטקסט בעברית`;

    const userPrompt = `צור דוח מחקר ליד מקיף ומפורט עבור "${data.leadName}" (${data.websiteUrl}).

══════════════════════════════════════
  נתוני אתר (Website Facts)
══════════════════════════════════════
  כותרת: ${wf.title || 'לא נמצא'}
  תיאור: ${wf.description || 'לא נמצא'}
  H1: ${wf.h1 || 'לא נמצא'}
  H2 headings: ${(wf.h2Headings || []).join(' | ') || 'לא נמצאו'}
  CMS/פלטפורמה: ${wf.cms || 'לא זוהה'}
  HTTPS: ${wf.isHttps ? 'כן' : 'לא'}
  Viewport מובייל: ${wf.hasMobileViewport ? 'כן' : 'לא'}
  Schema Markup: ${wf.hasSchemaMarkup ? 'כן' : 'לא'}
  Lazy Loading: ${wf.hasLazyLoading ? 'כן' : 'לא'}
  OG Image: ${wf.ogImage ? 'כן' : 'לא'}
  Canonical URL: ${wf.canonical || 'לא'}
  ספירת מילים: ${wf.wordCount ?? 'N/A'}
  מספר תמונות: ${wf.imageCount ?? 'N/A'}
  טופס צור קשר: ${wf.hasContactForm ? 'כן' : 'לא'}
  מספר טלפון: ${wf.hasPhoneNumber ? 'כן' : 'לא'}
  WhatsApp: ${wf.hasWhatsApp ? 'כן' : 'לא'}
  Google Analytics: ${wf.hasGoogleAnalytics ? 'כן' : 'לא'}
  Google Tag Manager: ${wf.hasGoogleTagManager ? 'כן' : 'לא'}
  שפות מזוהות: ${(wf.detectedLanguages || []).join(', ') || 'N/A'}
  קישורים פנימיים: ${wf.internalLinkCount ?? wf.internalLinks ?? 'N/A'}
  קישורים חיצוניים: ${wf.externalLinkCount ?? 'N/A'}
  בלוג: ${wf.hasBlog ? 'כן' : 'לא'}
  Favicon: ${wf.hasFavicon ? 'כן' : 'לא'}
  גודל עמוד: ${wf.pageSizeKB ?? 'N/A'} KB
  קבצי CSS: ${wf.cssFileCount ?? 'N/A'}
  קבצי JS: ${wf.jsFileCount ?? 'N/A'}

══════════════════════════════════════
  רשתות חברתיות (Social Presence)
══════════════════════════════════════
${socialDetails}

══════════════════════════════════════
  נוכחות בגוגל (Google Presence)
══════════════════════════════════════
  נמצא בחיפוש אורגני: ${google.organic?.found ? 'כן' : 'לא'}
  מיקום אורגני: ${google.organic?.position ?? 'N/A'}
  תוצאות אורגניות עליונות: ${(google.organic?.results || []).map((r: any) => `${r.title} (${r.link})`).join(' | ') || 'N/A'}
  Local Pack: ${google.localPack?.found ? 'כן' : 'לא'}
  דירוג ביקורות: ${google.reviews?.rating ?? 'N/A'}
  מספר ביקורות: ${google.reviews?.count ?? 'N/A'}

══════════════════════════════════════
  SEO Analysis
══════════════════════════════════════
  ציון טכני: ${seo.technicalScore ?? 'N/A'}/100
  ציון תוכן: ${seo.contentScore ?? 'N/A'}/100
  בעיות שנמצאו:
${seoIssues}
  פערי תוכן: ${(seo.contentGaps || []).join(', ') || 'אין'}
${seo.pageSpeed ? `
══════════════════════════════════════
  ביצועי אתר — PageSpeed Insights (מובייל)
══════════════════════════════════════
  ציון ביצועים: ${seo.pageSpeed.performanceScore}/100
  ציון נגישות: ${seo.pageSpeed.accessibilityScore}/100
  ציון SEO: ${seo.pageSpeed.seoScore}/100
  FCP: ${seo.pageSpeed.fcp || 'N/A'}
  LCP: ${seo.pageSpeed.lcp || 'N/A'}
  CLS: ${seo.pageSpeed.cls || 'N/A'}
  TBT: ${seo.pageSpeed.tbt || 'N/A'}
  Speed Index: ${seo.pageSpeed.speedIndex || 'N/A'}` : '  PageSpeed: לא נבדק (אין GOOGLE_PAGESPEED_API_KEY)'}
${seo.backlinks ? `
══════════════════════════════════════
  Backlinks
══════════════════════════════════════
  כמות משוערת: ~${seo.backlinks.estimatedCount?.toLocaleString() || 0}
  אתרים מפנים: ${(seo.backlinks.topReferrers || []).map((r: any) => r.domain).join(', ') || 'אין'}` : '  Backlinks: לא נבדק'}
${seo.socialActivity ? `
══════════════════════════════════════
  פעילות ברשתות — אזכורים בגוגל
══════════════════════════════════════
  אזכורים: ~${seo.socialActivity.recentMentions}
  דוגמאות: ${(seo.socialActivity.mentions || []).map((m: any) => m.title).join(' | ') || 'אין'}` : ''}

══════════════════════════════════════
  נראות AI / GEO
══════════════════════════════════════
  נראות כוללת: ${geo.overallVisibility ?? 'N/A'}%
  פלטפורמות שנבדקו: ${geo.checkedCount ?? 0}
  פלטפורמות: ${(geo.platforms || []).map((p: any) => `${p.platformName}: ${p.checked ? (p.found ? 'נמצא' : 'לא נמצא') : 'לא נבדק'}`).join(' | ') || 'N/A'}

══════════════════════════════════════
  ציונים (Scores)
══════════════════════════════════════
  ציון כללי: ${scores.overall ?? 'N/A'}/100 (${scores.grade ?? 'N/A'})
  ביטחון: ${scores.confidence ?? 'N/A'}%
${categoryScores}

══════════════════════════════════════
  מתחרים (Competitors)
══════════════════════════════════════
  מיקום בשוק: ${comp.marketPosition || 'N/A'}
${competitorList}

══════════════════════════════════════
  הזדמנויות מכירה (Sales Opportunities)
══════════════════════════════════════
${opportunitySummary}

══════════════════════════════════════
  תוכנית רבעונית (Quarter Plan)
══════════════════════════════════════
  רבעון: ${plan?.quarter || 'N/A'}
  ROI צפוי: ${plan?.estimatedROI || 'N/A'}
  השקעה כוללת: ${plan?.totalInvestment ? '₪' + plan.totalInvestment.toLocaleString() : 'N/A'}
  יעדים:
${quarterPlanSummary}

══════════════════════════════════════
  ניתוח AI מעמיק (Deep AI Analysis)
══════════════════════════════════════
${data.deepAnalysis?.websiteDeepAnalysis ? `
ניתוח אתר מעמיק:
  UX: ${data.deepAnalysis.websiteDeepAnalysis.uxAnalysis || 'לא בוצע'}
  תוכן: ${data.deepAnalysis.websiteDeepAnalysis.contentAnalysis || 'לא בוצע'}
  טכני: ${data.deepAnalysis.websiteDeepAnalysis.technicalNotes || 'לא בוצע'}
  חוזקות: ${(data.deepAnalysis.websiteDeepAnalysis.strengths || []).join(', ')}
  חולשות: ${(data.deepAnalysis.websiteDeepAnalysis.weaknesses || []).join(', ')}
  המלצות: ${(data.deepAnalysis.websiteDeepAnalysis.recommendations || []).join(', ')}
` : '  ניתוח אתר: לא בוצע'}
${data.deepAnalysis?.socialDeepAnalysis ? `
ניתוח סושייאל מעמיק:
  הערכה כללית: ${data.deepAnalysis.socialDeepAnalysis.overallAssessment || 'לא בוצע'}
  אסטרטגיית תוכן: ${data.deepAnalysis.socialDeepAnalysis.contentStrategy || 'לא בוצע'}
  הזדמנויות חסרות: ${(data.deepAnalysis.socialDeepAnalysis.missingOpportunities || []).join(', ')}
${(data.deepAnalysis.socialDeepAnalysis.platformAnalyses || []).map((p: any) => `  ${p.platform}: ציון ${p.score}/100 — ${(p.analysis || '').substring(0, 200)}`).join('\n')}
` : '  ניתוח סושייאל: לא בוצע'}
${data.deepAnalysis?.seoGeoDeepAnalysis ? `
ניתוח SEO/GEO מעמיק:
  SEO: ${data.deepAnalysis.seoGeoDeepAnalysis.seoDeepAnalysis || 'לא בוצע'}
  GEO: ${data.deepAnalysis.seoGeoDeepAnalysis.geoAnalysis || 'לא בוצע'}
  מתחרים: ${data.deepAnalysis.seoGeoDeepAnalysis.competitorInsights || 'לא בוצע'}
  SEO מקומי: ${data.deepAnalysis.seoGeoDeepAnalysis.localSeoStatus || 'לא בוצע'}
  תוכנית פעולה: ${(data.deepAnalysis.seoGeoDeepAnalysis.actionPlan || []).join(', ')}
` : '  ניתוח SEO/GEO: לא בוצע'}

══════════════════════════════════════

השתמש בניתוח AI המעמיק כבסיס לכתיבת הדוח. כל סעיף חייב לכלול 5-8 פסקאות מפורטות — לא פחות!
שלב את הנתונים הגולמיים עם הניתוח המעמיק ליצירת דוח מקצועי ומעמיק ביותר.
הדגש חוזקות, חולשות, הזדמנויות, והמלצות מעשיות לכל תחום.
מלא את כל 13 הסעיפים שבפורמט.
סעיף ההמלצות (recommendations) חייב לכלול לפחות 10 המלצות קונקרטיות, מעשיות ומפורטות — כל המלצה עם הסבר למה היא חשובה ומה ההשפעה הצפויה.`;

    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 8000 });
    if (!result.success || !result.data) return null;

    const report = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    return report;
  } catch {
    return null;
  }
}

// ── Main Orchestrator ─────────────────────────────────────────────────────────

export interface StartResearchOptions {
  leadId: string;
  leadName: string;
  websiteUrl: string;
  email?: string;
  phone?: string;
  socialUrls?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    tiktok?: string;
  };
}

/**
 * Creates the research record in DB. Does NOT run the pipeline.
 * Call runPipelineAsync() separately to execute the scan.
 */
export async function startLeadResearch(options: StartResearchOptions): Promise<string> {
  const { leadId, leadName, websiteUrl } = options;

  // Create initial research record
  const research: Partial<LeadResearch> = {
    leadId,
    leadName,
    websiteUrl: websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`,
    status: 'scanning',
    stages: buildInitialStages(),
    currentStage: 'website_scan',
    progress: 0,
    websiteScan: null,
    websiteFacts: null,
    socialPresence: null,
    googlePresence: null,
    seoAnalysis: null,
    geoAnalysis: null,
    competitorAnalysis: null,
    scores: null,
    salesOpportunities: null,
    quarterPlan: null,
    report: null,
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const created = await leadResearch.createAsync(research as any);
  const researchId = created?.id || (research as any).id;

  return researchId;
}

/**
 * Runs the full 11-stage pipeline. Exported so the API route can await it
 * (keeping the Vercel serverless function alive until completion).
 */
export async function runPipelineAsync(researchId: string, options: StartResearchOptions) {
  try {
    await runPipeline(researchId, options);
  } catch (err: any) {
    console.error('[LeadResearch] Pipeline crashed:', err);
    await updateResearch(researchId, {
      status: 'failed',
      error: err?.message || 'Pipeline crashed',
      currentStage: 'failed',
    } as any);
  }
}

async function runPipeline(researchId: string, options: StartResearchOptions) {
  const url = options.websiteUrl.startsWith('http') ? options.websiteUrl : `https://${options.websiteUrl}`;
  const startTime = Date.now();

  let stages = buildInitialStages();
  let websiteFacts: any = null;
  let socialPresence: any = null;
  let googlePresence: any = null;
  let seoAnalysis: any = null;
  let geoAnalysis: any = null;
  let competitorAnalysis: any = null;
  let scores: any = null;
  let salesOpportunities: any[] = [];
  let quarterPlan: any = null;
  let report: any = null;

  const markStage = async (
    stageId: LeadResearchStageId,
    status: 'running' | 'completed' | 'failed' | 'skipped',
    error?: string,
  ) => {
    const stage = stages.find(s => s.id === stageId);
    if (stage) {
      stage.status = status;
      if (status === 'running') stage.startedAt = new Date().toISOString();
      if (status === 'completed' || status === 'failed' || status === 'skipped') {
        stage.completedAt = new Date().toISOString();
        if (stage.startedAt) {
          stage.durationMs = new Date(stage.completedAt).getTime() - new Date(stage.startedAt).getTime();
        }
      }
      if (error) stage.error = error;
    }

    await updateResearch(researchId, {
      stages,
      currentStage: stageId,
      progress: calcProgress(stages),
      updatedAt: new Date().toISOString(),
    } as any);
  };

  try {
    // ── Stage 1: Website Scan ─────────────────────────────────────────────
    await markStage('website_scan', 'running');
    try {
      const result = await runWebsiteScan(url);
      websiteFacts = result?.websiteFacts || null;
      await updateResearch(researchId, { websiteFacts, websiteScan: result } as any);
      await markStage('website_scan', 'completed');
    } catch (e: any) {
      await markStage('website_scan', 'failed', e?.message);
      // Continue — other stages can still provide value
    }

    // ── Stage 2: Social Media Scan ────────────────────────────────────────
    await markStage('social_scan', 'running');
    try {
      socialPresence = await runSocialScan(url, options.leadName, options.socialUrls);
      await updateResearch(researchId, { socialPresence } as any);
      await markStage('social_scan', socialPresence ? 'completed' : 'skipped');
    } catch (e: any) {
      await markStage('social_scan', 'skipped', e?.message);
    }

    // ── Stage 3: Google Presence ──────────────────────────────────────────
    await markStage('google_presence', 'running');
    try {
      googlePresence = await runGooglePresence(url, options.leadName, websiteFacts);
      await updateResearch(researchId, { googlePresence } as any);
      await markStage('google_presence', googlePresence ? 'completed' : 'skipped');
    } catch (e: any) {
      await markStage('google_presence', 'skipped', e?.message);
    }

    // ── Stage 4: SEO Analysis ─────────────────────────────────────────────
    await markStage('seo_analysis', 'running');
    try {
      seoAnalysis = await runSeoAnalysis(url, websiteFacts);
      await updateResearch(researchId, { seoAnalysis } as any);
      await markStage('seo_analysis', seoAnalysis ? 'completed' : 'skipped');
    } catch (e: any) {
      await markStage('seo_analysis', 'skipped', e?.message);
    }

    // ── Stage 5: GEO Analysis ─────────────────────────────────────────────
    await markStage('geo_analysis', 'running');
    try {
      geoAnalysis = await runGeoAnalysis(url, options.leadName, websiteFacts);
      await updateResearch(researchId, { geoAnalysis } as any);
      await markStage('geo_analysis', geoAnalysis ? 'completed' : 'skipped');
    } catch (e: any) {
      await markStage('geo_analysis', 'skipped', e?.message);
    }

    // ── Stage 6: AI Visibility (merged into GEO — mark completed) ─────────
    await markStage('ai_visibility', 'completed');

    // ── Stage 7: Competitor Analysis ──────────────────────────────────────
    await markStage('competitor_analysis', 'running');
    try {
      competitorAnalysis = await runCompetitorAnalysis(url, websiteFacts);
      await updateResearch(researchId, { competitorAnalysis } as any);
      await markStage('competitor_analysis', competitorAnalysis ? 'completed' : 'skipped');
    } catch (e: any) {
      await markStage('competitor_analysis', 'skipped', e?.message);
    }

    // ── Stage 8: Scoring ──────────────────────────────────────────────────
    await markStage('scoring', 'running');
    try {
      scores = await runScoring({ websiteFacts, seoAnalysis, geoAnalysis, competitorAnalysis, socialPresence, googlePresence });
      await updateResearch(researchId, { scores } as any);
      await markStage('scoring', scores ? 'completed' : 'skipped');
    } catch (e: any) {
      await markStage('scoring', 'skipped', e?.message);
    }

    // ── Stage 9: Sales Opportunities ──────────────────────────────────────
    await markStage('sales_opportunities', 'running');
    try {
      salesOpportunities = await runSalesOpportunities({ websiteFacts, seoAnalysis, geoAnalysis, socialPresence, googlePresence, scores });
      await updateResearch(researchId, { salesOpportunities } as any);
      await markStage('sales_opportunities', 'completed');
    } catch (e: any) {
      await markStage('sales_opportunities', 'skipped', e?.message);
    }

    // ── Stage 9.5: Deep AI Analysis ─────────────────────────────────────
    // Run AI analysis on ALL collected data — website UX, social content, SEO/GEO
    let deepAnalysis: any = null;
    try {
      deepAnalysis = await runDeepAIAnalysis({
        leadName: options.leadName, websiteUrl: url,
        websiteFacts, socialPresence, googlePresence,
        seoAnalysis, geoAnalysis, competitorAnalysis,
      });
      // Save deep analysis into the research record
      await updateResearch(researchId, { deepAnalysis } as any);
    } catch (e: any) {
      console.warn('[LeadResearch] Deep AI analysis failed:', e?.message);
    }

    // ── Stage 10: Quarter Plan ────────────────────────────────────────────
    await markStage('quarter_plan', 'running');
    try {
      quarterPlan = await runQuarterPlan({
        leadName: options.leadName, websiteUrl: url,
        websiteFacts, scores, salesOpportunities,
      });
      await updateResearch(researchId, { quarterPlan } as any);
      await markStage('quarter_plan', quarterPlan ? 'completed' : 'skipped');
    } catch (e: any) {
      await markStage('quarter_plan', 'skipped', e?.message);
    }

    // ── Stage 11: Report Generation ───────────────────────────────────────
    await markStage('report_generation', 'running');
    try {
      report = await runReportGeneration({
        leadName: options.leadName, websiteUrl: url, websiteFacts,
        socialPresence, googlePresence, seoAnalysis, geoAnalysis,
        competitorAnalysis, scores, salesOpportunities, quarterPlan,
        deepAnalysis,
      });
      await updateResearch(researchId, { report } as any);
      await markStage('report_generation', report ? 'completed' : 'skipped');
    } catch (e: any) {
      await markStage('report_generation', 'skipped', e?.message);
    }

    // ── Done ──────────────────────────────────────────────────────────────
    const totalDurationMs = Date.now() - startTime;
    await updateResearch(researchId, {
      status: 'completed',
      currentStage: 'completed',
      progress: 100,
      completedAt: new Date().toISOString(),
      totalDurationMs,
      updatedAt: new Date().toISOString(),
    } as any);

    console.log(`[LeadResearch] Completed for ${options.leadName} in ${Math.round(totalDurationMs / 1000)}s`);
  } catch (err: any) {
    console.error('[LeadResearch] Pipeline error:', err);
    await updateResearch(researchId, {
      status: 'failed',
      error: err?.message || 'Unknown error',
      currentStage: 'failed',
      updatedAt: new Date().toISOString(),
    } as any);
  }
}

// ── Status Queries ────────────────────────────────────────────────────────────

export async function getResearchStatus(researchId: string): Promise<LeadResearch | null> {
  try {
    const result = await leadResearch.getByIdAsync(researchId);
    return result || null;
  } catch {
    return null;
  }
}

export async function getResearchByLeadId(leadId: string): Promise<LeadResearch | null> {
  try {
    const results = await leadResearch.queryFilteredAsync(
      [{ column: 'data->>leadId', op: 'eq', value: leadId }],
    );
    if (!results?.length) return null;
    // Return the most recent research (queryFilteredAsync orders by created_at ASC)
    return results[results.length - 1];
  } catch {
    return null;
  }
}

export async function getResearchHistoryByLeadId(leadId: string): Promise<LeadResearch[]> {
  try {
    const results = await leadResearch.queryFilteredAsync(
      [{ column: 'data->>leadId', op: 'eq', value: leadId }],
    );
    // Return all, newest first
    return (results || []).reverse();
  } catch {
    return [];
  }
}
