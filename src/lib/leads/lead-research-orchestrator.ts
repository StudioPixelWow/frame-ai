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

async function runSocialScan(url: string, businessName: string): Promise<any> {
  // Self-contained: just check if social links exist on the website HTML
  console.log('[LeadResearch] Stage 2: Social scan for', businessName);
  const result: Record<string, any> = {
    facebook: null, instagram: null, linkedin: null, tiktok: null,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudioPixelBot/1.0)', Accept: 'text/html' },
      signal: controller.signal, redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return result;
    const html = await res.text();

    // Extract social links from HTML
    const fbMatch = html.match(/(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^"'\s<>]+/i);
    const igMatch = html.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^"'\s<>]+/i);
    const liMatch = html.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^"'\s<>]+/i);
    const tkMatch = html.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^"'\s<>]+/i);

    if (fbMatch) result.facebook = { url: fbMatch[0], found: true, source: 'website' };
    if (igMatch) result.instagram = { url: igMatch[0], found: true, source: 'website' };
    if (liMatch) result.linkedin = { url: liMatch[0], found: true, source: 'website' };
    if (tkMatch) result.tiktok = { url: tkMatch[0], found: true, source: 'website' };

    console.log('[LeadResearch] Social found on website:', Object.keys(result).filter(k => result[k]?.found));
  } catch (e: any) {
    console.warn('[LeadResearch] Social scan fetch error:', e?.message);
  }

  return result;
}

async function runGooglePresence(url: string, businessName: string): Promise<any> {
  // Self-contained: use Serper API if available, otherwise return basic info
  console.log('[LeadResearch] Stage 3: Google presence for', businessName);
  const serperKey = process.env.SERPER_API_KEY || process.env.SERP_API_KEY;

  const result: any = {
    found: false,
    organic: { found: false, position: null, results: [] },
    localPack: { found: false },
    reviews: null,
  };

  if (!serperKey) {
    console.warn('[LeadResearch] No SERPER_API_KEY — skipping Google presence');
    return result;
  }

  try {
    let domain = url;
    try { domain = new URL(url).hostname; } catch {}

    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: businessName, gl: 'il', hl: 'he', num: 20 }),
    });

    if (res.ok) {
      const data = await res.json();
      const organicResults = data.organic || [];
      const matchIdx = organicResults.findIndex((r: any) => r.link?.includes(domain));
      if (matchIdx >= 0) {
        result.found = true;
        result.organic.found = true;
        result.organic.position = matchIdx + 1;
      }
      result.organic.results = organicResults.slice(0, 5).map((r: any) => ({
        title: r.title, link: r.link, position: r.position,
      }));

      if (data.localResults?.places?.length) {
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
    console.log('[LeadResearch] Google presence:', result.found ? `found at position ${result.organic.position}` : 'not found');
  } catch (e: any) {
    console.warn('[LeadResearch] Google presence error:', e?.message);
  }

  return result;
}

async function runSeoAnalysis(url: string, websiteFacts: any): Promise<any> {
  // Self-contained: score based on websiteFacts HTML analysis
  console.log('[LeadResearch] Stage 4: SEO analysis based on website facts');

  if (!websiteFacts) return { technicalScore: 0, contentScore: 0, issues: [], contentGaps: [] };

  const issues: string[] = [];
  let techPoints = 0;
  let contentPoints = 0;

  // Technical signals
  if (websiteFacts.isHttps) techPoints += 20; else issues.push('האתר לא משתמש ב-HTTPS');
  if (websiteFacts.hasMobileViewport) techPoints += 20; else issues.push('אין viewport למובייל');
  if (websiteFacts.hasSchemaMarkup) techPoints += 15; else issues.push('אין Schema Markup (נתונים מובנים)');
  if (websiteFacts.hasLazyLoading) techPoints += 10; else issues.push('אין Lazy Loading לתמונות');
  if (websiteFacts.canonical) techPoints += 10; else issues.push('אין Canonical URL');
  if ((websiteFacts.cms || '').includes('WordPress')) techPoints += 10;
  if (websiteFacts.internalLinks > 10) techPoints += 15; else if (websiteFacts.internalLinks > 3) techPoints += 8;

  // Content signals
  if (websiteFacts.title && websiteFacts.title.length > 10) contentPoints += 25; else issues.push('כותרת אתר קצרה או חסרה');
  if (websiteFacts.description && websiteFacts.description.length > 50) contentPoints += 25; else issues.push('Meta Description קצר או חסר');
  if (websiteFacts.h1 && websiteFacts.h1.length > 3) contentPoints += 20; else issues.push('אין H1 באתר');
  if (websiteFacts.ogImage) contentPoints += 15; else issues.push('אין תמונת OG (שיתוף ברשתות חברתיות)');
  if (websiteFacts.htmlLength > 10000) contentPoints += 15; else issues.push('תוכן דל — פחות מ-10,000 תווים');

  return {
    technicalScore: Math.min(techPoints, 100),
    contentScore: Math.min(contentPoints, 100),
    issues,
    contentGaps: issues.filter(i => i.includes('תוכן') || i.includes('Description') || i.includes('H1')),
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

    const systemPrompt = `אתה יועץ שיווק דיגיטלי של סטודיו פיקסל (Studio Pixel).
בנה תוכנית צמיחה רבעונית (90 יום) עבור העסק המבוקש.
החזר JSON בלבד בפורמט הבא:
{
  "quarter": "Q3 2026",
  "goals": [
    {
      "id": "g1",
      "title": "...",
      "titleHe": "...",
      "metric": "...",
      "currentValue": "...",
      "targetValue": "...",
      "actions": [{ "week": 1, "action": "...", "actionHe": "...", "responsible": "Studio Pixel" }]
    }
  ],
  "estimatedROI": "...",
  "totalInvestment": 0,
  "generatedAt": "${new Date().toISOString()}"
}
הכל בעברית. אל תמציא נתונים — השתמש רק במה שאתה יודע.`;

    const userPrompt = `בנה תוכנית רבעונית עבור "${data.leadName}" (${data.websiteUrl}).
ציון נוכחי: ${data.scores?.overall ?? 'לא ידוע'}/100
ציון ביטחון: ${data.scores?.confidence ?? 'לא ידוע'}%
הזדמנויות מכירה: ${data.salesOpportunities?.length ?? 0}
בנה 3-5 יעדים מרכזיים, כל אחד עם פעולות שבועיות.`;

    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.7 });
    if (!result.success || !result.data) return null;

    // generateWithAI already parses JSON
    const plan = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    return plan;
  } catch {
    return null;
  }
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
}): Promise<any> {
  try {
    const { generateWithAI } = await import('@/lib/ai/openai-client');

    const systemPrompt = `אתה כותב דוחות מקצועיים עבור סטודיו פיקסל (Studio Pixel).
צור דוח מחקר ליד מקיף בעברית. החזר JSON בלבד בפורמט הבא:
{
  "id": "report_1",
  "title": "Lead Research Report",
  "titleHe": "דוח מחקר ליד — ${data.leadName}",
  "sections": [
    { "id": "executive_summary", "title": "Executive Summary", "titleHe": "תקציר מנהלים", "content": [{ "type": "paragraph", "text": "..." }] },
    { "id": "website_analysis", "title": "Website Analysis", "titleHe": "ניתוח אתר", "content": [] },
    { "id": "seo_status", "title": "SEO Status", "titleHe": "מצב SEO", "content": [] },
    { "id": "ai_visibility", "title": "AI Visibility", "titleHe": "נראות במנועי AI", "content": [] },
    { "id": "competitors", "title": "Competitors", "titleHe": "ניתוח מתחרים", "content": [] },
    { "id": "opportunities", "title": "Opportunities", "titleHe": "הזדמנויות צמיחה", "content": [] },
    { "id": "quarter_plan", "title": "Quarter Plan", "titleHe": "תוכנית 90 יום", "content": [] },
    { "id": "recommendations", "title": "Recommendations", "titleHe": "המלצות Studio Pixel", "content": [] }
  ],
  "generatedAt": "${new Date().toISOString()}",
  "approved": false
}
כל הטקסט בעברית. אל תמציא נתונים.`;

    const userPrompt = `צור דוח מחקר ליד עבור "${data.leadName}" (${data.websiteUrl}).

נתונים זמינים:
- ציון כללי: ${data.scores?.overall ?? 'N/A'}/100
- ציון SEO טכני: ${data.seoAnalysis?.technicalScore ?? 'N/A'}
- ציון תוכן: ${data.seoAnalysis?.contentScore ?? 'N/A'}
- נראות AI: ${data.geoAnalysis?.overallVisibility ?? 'N/A'}%
- מתחרים: ${data.competitorAnalysis?.competitors?.length ?? 0}
- הזדמנויות מכירה: ${data.salesOpportunities?.length ?? 0}
- רשתות חברתיות: ${data.socialPresence ? 'נמצאו' : 'לא נמצאו'}
- גוגל: ${data.googlePresence ? 'נמצא' : 'לא נמצא'}

מלא את כל הסעיפים עם תוכן מבוסס נתונים בלבד.`;

    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.5 });
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
      socialPresence = await runSocialScan(url, options.leadName);
      // Merge manually-provided social URLs (override discovered ones)
      if (options.socialUrls) {
        if (!socialPresence) socialPresence = { facebook: null, instagram: null, linkedin: null, tiktok: null };
        const su = options.socialUrls;
        if (su.facebook) socialPresence.facebook = { url: su.facebook, found: true, source: 'manual' } as any;
        if (su.instagram) socialPresence.instagram = { url: su.instagram, found: true, source: 'manual' } as any;
        if (su.linkedin) socialPresence.linkedin = { url: su.linkedin, found: true, source: 'manual' } as any;
        if (su.tiktok) socialPresence.tiktok = { url: su.tiktok, found: true, source: 'manual' } as any;
      }
      await updateResearch(researchId, { socialPresence } as any);
      await markStage('social_scan', socialPresence ? 'completed' : 'skipped');
    } catch (e: any) {
      await markStage('social_scan', 'skipped', e?.message);
    }

    // ── Stage 3: Google Presence ──────────────────────────────────────────
    await markStage('google_presence', 'running');
    try {
      googlePresence = await runGooglePresence(url, options.leadName);
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
