import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { queryPlatform, isPlatformAvailable, type PlatformId } from '@/lib/seo/platform-apis';
import { updatePlanSafe, logActivity } from '@/lib/seo/api-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const AI_PLATFORMS: PlatformId[] = ['chatgpt', 'gemini', 'perplexity', 'claude', 'google_ai_overview'];

interface KeywordRank {
  keyword: string;
  googleRank: number | null;
  previousRank: number | null;
  change: number;
}

interface DailySnapshot {
  date: string;
  timestamp: string;
  keywordRanks: KeywordRank[];
  aiVisibility: {
    totalQueries: number;
    totalFound: number;
    byPlatform: Record<string, { found: number; total: number }>;
  };
  technicalScore: number;
  overallScore: number;
}

/**
 * Cron Job יומי — סריקת התקדמות SEO
 * סורק את כל מילות המפתח בכל הפלטפורמות ושומר snapshot יומי
 */
export async function GET(req: NextRequest) {
  // Only enforce auth if CRON_SECRET is configured
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[SEO-DAILY-SCAN] סריקה יומית התחילה', new Date().toISOString());

  try {
    const allPlans = await seoPlans.getAllAsync();
    const activePlans = allPlans.filter((p: any) => {
      const hasActiveStatus = p.status === 'active' || p.status === 'plan_generated' || p.status === 'visibility_done';
      const hasKeywords = Array.isArray(p.clientKeywords) && p.clientKeywords.length > 0;
      return hasActiveStatus && hasKeywords;
    });

    if (activePlans.length === 0) {
      console.log('[SEO-DAILY-SCAN] אין תוכניות פעילות לסריקה');
      return NextResponse.json({ success: true, message: 'אין תוכניות פעילות', plansProcessed: 0 });
    }

    console.log(`[SEO-DAILY-SCAN] נמצאו ${activePlans.length} תוכניות פעילות`);

    const summaryResults: any[] = [];

    for (const plan of activePlans) {
      try {
        const result = await processDailySnapshot(plan);
        summaryResults.push(result);
      } catch (error) {
        console.error(`[SEO-DAILY-SCAN] שגיאה בתוכנית ${plan.id}:`, error);
        summaryResults.push({
          planId: plan.id,
          clientName: (plan as any).clientName || (plan as any).businessName || 'Unknown',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = summaryResults.filter((r: any) => r.success).length;
    console.log(`[SEO-DAILY-SCAN] סריקה הושלמה: ${successCount}/${summaryResults.length} תוכניות בהצלחה`);

    return NextResponse.json({
      success: true,
      executedAt: new Date().toISOString(),
      plansProcessed: summaryResults.length,
      successfulPlans: successCount,
      results: summaryResults,
    });
  } catch (error) {
    console.error('[SEO-DAILY-SCAN] שגיאה כללית:', error);
    return NextResponse.json({ error: 'Daily progress scan failed' }, { status: 500 });
  }
}

function calculateTechnicalScore(plan: any): number {
  const scan = (plan as any).websiteScan;
  if (!scan) return 0;

  let score = 0;
  const facts = scan.websiteFacts || scan;

  // SSL +15
  const ssl = facts.has_ssl?.value ?? facts.has_ssl;
  if (ssl === true || ssl === 'true' || ssl === 'yes') score += 15;

  // Sitemap +15
  const sitemap = facts.has_sitemap?.value ?? facts.has_sitemap;
  if (sitemap === true || sitemap === 'true' || sitemap === 'yes') score += 15;

  // Robots.txt +10
  const robots = facts.has_robots_txt?.value ?? facts.has_robots_txt;
  if (robots === true || robots === 'true' || robots === 'yes') score += 10;

  // Meta title +15
  const metaTitle = facts.meta_title?.value ?? facts.meta_title;
  if (metaTitle && String(metaTitle).length > 0) score += 15;

  // Meta description +15
  const metaDesc = facts.meta_description?.value ?? facts.meta_description;
  if (metaDesc && String(metaDesc).length > 0) score += 15;

  // H1 +10
  const h1 = facts.h1_tag?.value ?? facts.h1_tag ?? facts.has_h1?.value ?? facts.has_h1;
  if (h1 && h1 !== false && h1 !== 'false' && h1 !== 'no') score += 10;

  // Schema markup +10
  const schema = facts.has_schema?.value ?? facts.has_schema ?? facts.schema_markup?.value ?? facts.schema_markup;
  if (schema === true || schema === 'true' || schema === 'yes' || (schema && schema !== false && schema !== 'false' && schema !== 'no')) score += 10;

  // Open Graph +10
  const og = facts.has_og_tags?.value ?? facts.has_og_tags ?? facts.og_tags?.value ?? facts.og_tags;
  if (og === true || og === 'true' || og === 'yes' || (og && og !== false && og !== 'false' && og !== 'no')) score += 10;

  return score;
}

async function processDailySnapshot(plan: any) {
  const planId = plan.id;
  let targetDomain = (plan as any).websiteUrl || (plan as any).url || (plan as any).domain || '';
  // Normalize — add protocol if missing so URL parsing works downstream
  if (targetDomain && !targetDomain.startsWith('http://') && !targetDomain.startsWith('https://')) {
    targetDomain = `https://${targetDomain}`;
  }
  targetDomain = targetDomain.replace(/\/+$/, '');
  const businessName = (plan as any).businessName || (plan as any).clientName || targetDomain;
  const clientKeywords: any[] = [...((plan as any).clientKeywords || [])];

  const todayDate = new Date().toISOString().split('T')[0];
  console.log(`[SEO-DAILY-SCAN] מעבד תוכנית ${planId} — ${businessName} (${clientKeywords.length} מילות מפתח)`);

  const keywordRanks: KeywordRank[] = [];
  const aiVisibility: DailySnapshot['aiVisibility'] = {
    totalQueries: 0,
    totalFound: 0,
    byPlatform: {},
  };

  // Initialize byPlatform counters
  for (const platform of AI_PLATFORMS) {
    aiVisibility.byPlatform[platform] = { found: 0, total: 0 };
  }
  aiVisibility.byPlatform['google_seo'] = { found: 0, total: 0 };

  // Process keywords sequentially with delays to avoid rate limits
  for (let i = 0; i < clientKeywords.length; i++) {
    const kw = clientKeywords[i];
    const keyword = typeof kw === 'string' ? kw : kw.keyword || kw.term || '';
    if (!keyword) continue;

    console.log(`[SEO-DAILY-SCAN] בודק מילת מפתח ${i + 1}/${clientKeywords.length}: "${keyword}"`);

    // --- Google SEO rank ---
    let googleRank: number | null = null;
    if (isPlatformAvailable('google_seo')) {
      try {
        const googleResult = await queryPlatform('google_seo', keyword, businessName, targetDomain);
        if (googleResult.found && googleResult.position) {
          googleRank = googleResult.position;
          aiVisibility.byPlatform['google_seo'].found += 1;
        }
        aiVisibility.byPlatform['google_seo'].total += 1;
      } catch (err) {
        console.error(`[SEO-DAILY-SCAN] שגיאה בבדיקת Google עבור "${keyword}":`, err);
      }
    }

    // Previous rank from clientKeywords data
    const previousRank = (typeof kw === 'object' && kw.googleRank != null) ? kw.googleRank : null;
    const change = (googleRank != null && previousRank != null) ? previousRank - googleRank : 0;

    keywordRanks.push({ keyword, googleRank, previousRank, change });

    // Update clientKeywords entry with latest rank
    if (typeof kw === 'object') {
      kw.previousRank = previousRank;
      kw.googleRank = googleRank;
      kw.lastChecked = new Date().toISOString();
    } else {
      clientKeywords[i] = {
        keyword,
        googleRank,
        previousRank: null,
        lastChecked: new Date().toISOString(),
      };
    }

    // --- AI Platforms (parallel within each keyword) ---
    const aiPromises = AI_PLATFORMS.map(async (platform) => {
      if (!isPlatformAvailable(platform)) return { platform, found: false, checked: false };
      try {
        const result = await queryPlatform(platform, keyword, businessName, targetDomain);
        return { platform, found: result.found, checked: true };
      } catch {
        return { platform, found: false, checked: true };
      }
    });

    const aiResults = await Promise.allSettled(aiPromises);

    for (const settled of aiResults) {
      if (settled.status === 'fulfilled') {
        const { platform, found, checked } = settled.value;
        if (checked) {
          aiVisibility.totalQueries += 1;
          aiVisibility.byPlatform[platform].total += 1;
          if (found) {
            aiVisibility.totalFound += 1;
            aiVisibility.byPlatform[platform].found += 1;
          }
        }
      }
    }

    // Delay between keywords to avoid throttling
    if (i < clientKeywords.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Calculate scores
  const technicalScore = calculateTechnicalScore(plan);
  const visibilityScore = aiVisibility.totalQueries > 0
    ? Math.round((aiVisibility.totalFound / aiVisibility.totalQueries) * 100)
    : 0;
  const overallScore = Math.round((technicalScore + visibilityScore) / 2);

  const snapshot: DailySnapshot = {
    date: todayDate,
    timestamp: new Date().toISOString(),
    keywordRanks,
    aiVisibility,
    technicalScore,
    overallScore,
  };

  // Append snapshot to dailySnapshots array
  const dailySnapshots = [...((plan as any).dailySnapshots || []), snapshot];

  // Save updates
  await updatePlanSafe(planId, { dailySnapshots, clientKeywords });

  logActivity(planId, 'daily_progress_scan', {
    date: todayDate,
    keywordsChecked: keywordRanks.length,
    googleRanksFound: keywordRanks.filter(k => k.googleRank != null).length,
    aiVisibilityTotal: aiVisibility.totalFound,
    aiVisibilityQueries: aiVisibility.totalQueries,
    technicalScore,
    overallScore,
  });

  console.log(`[SEO-DAILY-SCAN] תוכנית ${planId} הושלמה — ציון כולל: ${overallScore}, דירוגים: ${keywordRanks.filter(k => k.googleRank != null).length}/${keywordRanks.length}`);

  return {
    planId,
    clientName: businessName,
    success: true,
    keywordsChecked: keywordRanks.length,
    googleRanksFound: keywordRanks.filter(k => k.googleRank != null).length,
    aiVisibility: {
      totalQueries: aiVisibility.totalQueries,
      totalFound: aiVisibility.totalFound,
    },
    technicalScore,
    overallScore,
  };
}
