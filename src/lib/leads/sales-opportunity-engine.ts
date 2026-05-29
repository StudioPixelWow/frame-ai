/**
 * Lead Research — Sales Opportunity Engine
 * Analyzes research findings to identify upsell/cross-sell opportunities
 * for Studio Pixel services.
 *
 * Services: SEO/GEO, Website, Branding, Marketing, Social Media, Podcast, Hosting
 * NO FAKE DATA — every opportunity must be backed by scan evidence.
 */

import type { LeadSalesOpportunity } from '@/lib/db/schema';

interface ResearchData {
  websiteFacts: any;
  seoAnalysis: any;
  geoAnalysis: any;
  socialPresence: any;
  googlePresence: any;
  scores: any;
}

function generateId(): string {
  return `opp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function analyzeSalesOpportunities(data: ResearchData): Promise<LeadSalesOpportunity[]> {
  const opportunities: LeadSalesOpportunity[] = [];

  // Rule 1: SEO/GEO Plan — if SEO score is below 60
  if (data.seoAnalysis) {
    const techScore = data.seoAnalysis.technicalScore ?? 0;
    const contentScore = data.seoAnalysis.contentScore ?? 0;
    const avgSeoScore = (techScore + contentScore) / 2;

    if (avgSeoScore < 60) {
      opportunities.push({
        id: generateId(),
        service: 'SEO/GEO 60-Day Plan',
        serviceHe: 'תוכנית SEO/GEO 60 יום',
        priority: avgSeoScore < 30 ? 'critical' : avgSeoScore < 45 ? 'high' : 'medium',
        reason: `SEO score is ${Math.round(avgSeoScore)}/100 — significant room for improvement`,
        reasonHe: `ציון SEO של ${Math.round(avgSeoScore)}/100 — פוטנציאל שיפור משמעותי`,
        estimatedValue: avgSeoScore < 30 ? 8000 : 5000,
        evidence: [
          `ציון טכני: ${techScore}`,
          `ציון תוכן: ${contentScore}`,
          ...(data.seoAnalysis.issues?.slice(0, 3).map((i: any) => i.title || i.description) || []),
        ],
        pitch: `האתר שלכם מדורג ${Math.round(avgSeoScore)}/100 ב-SEO. עם תוכנית 60 יום מותאמת אישית, אנחנו יכולים לשפר את הנראות שלכם בגוגל ובמנועי AI משמעותית.`,
      });
    }
  }

  // Rule 2: AI Visibility — if GEO visibility is below 40%
  if (data.geoAnalysis) {
    const vis = data.geoAnalysis.overallVisibility ?? 0;
    if (vis < 40) {
      opportunities.push({
        id: generateId(),
        service: 'GEO/AI Visibility',
        serviceHe: 'נראות AI ו-GEO',
        priority: vis === 0 ? 'critical' : vis < 20 ? 'high' : 'medium',
        reason: `AI visibility is only ${vis}% — business is nearly invisible to AI search engines`,
        reasonHe: `נראות AI של ${vis}% בלבד — העסק כמעט בלתי נראה למנועי חיפוש AI`,
        estimatedValue: 6000,
        evidence: [
          `נראות כללית: ${vis}%`,
          ...(data.geoAnalysis.platforms?.filter((p: any) => !p.found).map((p: any) => `לא נמצא ב-${p.platformName}`) || []),
        ],
        pitch: `${vis === 0 ? 'העסק שלכם לא מופיע באף מנוע AI' : `העסק שלכם מופיע רק ב-${vis}% ממנועי ה-AI`}. בעידן שבו יותר ויותר לקוחות מחפשים דרך ChatGPT, Gemini ו-Perplexity, זה הפער הכי קריטי לסגור.`,
      });
    }
  }

  // Rule 3: Website — if website facts show poor quality
  if (data.websiteFacts) {
    const facts = data.websiteFacts;
    const issues: string[] = [];

    if (!facts.hasMobileViewport) issues.push('לא מותאם למובייל');
    if (!facts.hasSSL && !(facts.url || '').startsWith('https')) issues.push('אין SSL/HTTPS');
    if (facts.loadTimeMs && facts.loadTimeMs > 3000) issues.push(`זמן טעינה איטי: ${Math.round(facts.loadTimeMs / 1000)}s`);
    if (facts.wordCount && facts.wordCount < 300) issues.push('תוכן דל — פחות מ-300 מילים');

    if (issues.length >= 2) {
      opportunities.push({
        id: generateId(),
        service: 'Website Redesign',
        serviceHe: 'בניית אתר חדש / שדרוג',
        priority: issues.length >= 3 ? 'high' : 'medium',
        reason: `Website has ${issues.length} significant issues`,
        reasonHe: `נמצאו ${issues.length} בעיות משמעותיות באתר`,
        estimatedValue: 12000,
        evidence: issues,
        pitch: `האתר שלכם זקוק לשדרוג — ${issues.join(', ')}. אתר מודרני, מהיר ומותאם למובייל יכול להגדיל משמעותית את ההמרות.`,
      });
    }
  }

  // Rule 4: Social Media — if no social presence found
  if (data.socialPresence) {
    const sp = data.socialPresence;
    const missingPlatforms: string[] = [];
    if (!sp.facebook?.found) missingPlatforms.push('Facebook');
    if (!sp.instagram?.found) missingPlatforms.push('Instagram');
    if (!sp.linkedin?.found) missingPlatforms.push('LinkedIn');

    if (missingPlatforms.length >= 2) {
      opportunities.push({
        id: generateId(),
        service: 'Social Media Marketing',
        serviceHe: 'שיווק ברשתות חברתיות',
        priority: missingPlatforms.length === 3 ? 'high' : 'medium',
        reason: `Missing presence on ${missingPlatforms.join(', ')}`,
        reasonHe: `חסרה נוכחות ב-${missingPlatforms.join(', ')}`,
        estimatedValue: 4000,
        evidence: missingPlatforms.map(p => `לא נמצא פרופיל ב-${p}`),
        pitch: `העסק שלכם חסר נוכחות ב-${missingPlatforms.join(' ו-')}. ניהול רשתות חברתיות מקצועי יכול להביא לקוחות חדשים ולחזק את המותג.`,
      });
    }
  }

  // Rule 5: Google Business — if no GBP found
  if (data.googlePresence && !data.googlePresence.gbpFound) {
    opportunities.push({
      id: generateId(),
      service: 'Google Business Profile',
      serviceHe: 'Google Business Profile',
      priority: 'high',
      reason: 'No Google Business Profile found',
      reasonHe: 'לא נמצא פרופיל עסקי בגוגל',
      estimatedValue: 2000,
      evidence: ['אין פרופיל עסקי בגוגל', 'לא מופיע ב-Local Pack'],
      pitch: `לעסק שלכם אין פרופיל עסקי בגוגל. זה אומר שלקוחות שמחפשים את השירותים שלכם לא ימצאו אתכם במפות ובתוצאות המקומיות.`,
    });
  }

  // Rule 6: Low review count
  if (data.googlePresence?.gbpFound && (data.googlePresence.gbpReviewCount || 0) < 10) {
    opportunities.push({
      id: generateId(),
      service: 'Reputation Management',
      serviceHe: 'ניהול מוניטין',
      priority: 'medium',
      reason: `Only ${data.googlePresence.gbpReviewCount || 0} Google reviews`,
      reasonHe: `רק ${data.googlePresence.gbpReviewCount || 0} ביקורות בגוגל`,
      estimatedValue: 2500,
      evidence: [
        `${data.googlePresence.gbpReviewCount || 0} ביקורות`,
        data.googlePresence.gbpRating ? `דירוג: ${data.googlePresence.gbpRating}/5` : 'אין דירוג',
      ],
      pitch: `עם ${data.googlePresence.gbpReviewCount || 0} ביקורות בלבד, יש הזדמנות גדולה לחזק את המוניטין הדיגיטלי שלכם. ביקורות חיוביות משפיעות ישירות על ההחלטה של לקוחות חדשים.`,
    });
  }

  // Rule 7: Branding — if no consistent brand presence
  if (data.websiteFacts && !data.websiteFacts.hasOG) {
    opportunities.push({
      id: generateId(),
      service: 'Branding Package',
      serviceHe: 'חבילת מיתוג',
      priority: 'low',
      reason: 'Missing Open Graph tags — no consistent brand presence in shares',
      reasonHe: 'חסרים תגי Open Graph — אין מיתוג עקבי בשיתופים',
      estimatedValue: 6000,
      evidence: ['חסרים תגי OG', 'אין שליטה על איך האתר מופיע בשיתופים'],
      pitch: `כשמשתפים קישור לאתר שלכם, אין שליטה על התמונה והתיאור שמוצגים. חבילת מיתוג מקצועית כוללת OG tags, לוגו מותאם ושפה ויזואלית אחידה.`,
    });
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  opportunities.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return opportunities;
}
