import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { queryPlatform, isPlatformAvailable, type PlatformId } from '@/lib/seo/platform-apis';
import { updatePlanSafe, logActivity } from '@/lib/seo/api-helpers';
import { getSupabase } from '@/lib/db/store';
import { getSearchAnalytics } from '@/lib/seo/gsc-real-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Max plans to scan per cron run — prevents timeout on large plan counts */
const MAX_PLANS_PER_RUN = 5;
/** Max keywords per plan — prevents one plan from consuming all time */
const MAX_KEYWORDS_PER_PLAN = 8;

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
    // Use filtered query to avoid statement timeout on 95+ plans
    // Retry once on transient connection errors (e.g. Supabase 522)
    let allPlans: any[];
    try {
      allPlans = await seoPlans.queryFilteredAsync([
        { column: 'data->>status', op: 'in', value: ['active', 'plan_generated', 'visibility_done'] },
      ]);
    } catch (dbError: any) {
      const isTransient = dbError?.status === 522 || dbError?.code === 'ECONNRESET' || dbError?.code === 'ETIMEDOUT' || /522|connection|timeout/i.test(dbError?.message || '');
      if (isTransient) {
        console.warn('[SEO-DAILY-SCAN] DB query failed with transient error, retrying in 5s...', dbError?.message || dbError);
        await new Promise(r => setTimeout(r, 5000));
        try {
          allPlans = await seoPlans.queryFilteredAsync([
            { column: 'data->>status', op: 'in', value: ['active', 'plan_generated', 'visibility_done'] },
          ]);
          console.log('[SEO-DAILY-SCAN] Retry succeeded — loaded', allPlans.length, 'plans');
        } catch (retryError: any) {
          console.error('[SEO-DAILY-SCAN] Retry also failed:', retryError?.message || retryError);
          return NextResponse.json({ error: 'DB connection failed after retry', details: retryError?.message }, { status: 503 });
        }
      } else {
        throw dbError;
      }
    }
    const activePlans = allPlans.filter((p: any) => {
      // Accept plans with clientKeywords OR targetKeywords (some plans store keywords differently)
      const hasKeywords = (Array.isArray(p.clientKeywords) && p.clientKeywords.length > 0)
        || (Array.isArray(p.targetKeywords) && p.targetKeywords.length > 0);
      return hasKeywords;
    });

    if (activePlans.length === 0) {
      console.log('[SEO-DAILY-SCAN] אין תוכניות פעילות לסריקה');
      return NextResponse.json({ success: true, message: 'אין תוכניות פעילות', plansProcessed: 0 });
    }

    console.log(`[SEO-DAILY-SCAN] נמצאו ${activePlans.length} תוכניות פעילות`);

    // Limit plans per run to prevent timeout — rotate through plans
    // Use day-of-year to rotate which plans get scanned
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    let plansToScan = activePlans;
    if (activePlans.length > MAX_PLANS_PER_RUN) {
      const startIdx = (dayOfYear * MAX_PLANS_PER_RUN) % activePlans.length;
      plansToScan = [];
      for (let i = 0; i < MAX_PLANS_PER_RUN; i++) {
        plansToScan.push(activePlans[(startIdx + i) % activePlans.length]);
      }
      console.log(`[SEO-DAILY-SCAN] ⚠️ Limiting to ${MAX_PLANS_PER_RUN}/${activePlans.length} plans (rotation day ${dayOfYear}, start=${startIdx})`);
    }

    const summaryResults: any[] = [];

    for (const plan of plansToScan) {
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

export async function processDailySnapshot(plan: any) {
  const planId = plan.id;
  let targetDomain = (plan as any).websiteUrl || (plan as any).url || (plan as any).domain || '';
  // Normalize — add protocol if missing so URL parsing works downstream
  if (targetDomain && !targetDomain.startsWith('http://') && !targetDomain.startsWith('https://')) {
    targetDomain = `https://${targetDomain}`;
  }
  targetDomain = targetDomain.replace(/\/+$/, '');
  const businessName = (plan as any).businessName || (plan as any).clientName || targetDomain;
  // Use clientKeywords (manual), fall back to targetKeywords (from scan)
  let rawKeywords = (plan as any).clientKeywords;
  if (!Array.isArray(rawKeywords) || rawKeywords.length === 0) {
    rawKeywords = (plan as any).targetKeywords || [];
  }
  const clientKeywords: any[] = [...rawKeywords];

  // Limit keywords per plan to prevent timeout
  const totalKeywords = clientKeywords.length;
  if (clientKeywords.length > MAX_KEYWORDS_PER_PLAN) {
    clientKeywords.length = MAX_KEYWORDS_PER_PLAN;
    console.log(`[SEO-DAILY-SCAN] ⚠️ Plan ${planId}: limiting to ${MAX_KEYWORDS_PER_PLAN}/${totalKeywords} keywords`);
  }

  const todayDate = new Date().toISOString().split('T')[0];
  console.log(`[SEO-DAILY-SCAN] מעבד תוכנית ${planId} — ${businessName} (${clientKeywords.length}/${totalKeywords} מילות מפתח)`);

  // === REAL Google rankings from Search Console (free, accurate) ===
  // If the client connected GSC, use real average positions per query instead of
  // unreliable SERP scraping. Build a keyword→position map once for the plan.
  let gscRankMap: Map<string, number> | null = null;
  let gscConnected = false;
  try {
    const clientId = (plan as any).clientId || (plan as any).client_id;
    if (clientId) {
      const sb = getSupabase();
      const { data: cl } = await sb
        .from('clients')
        .select('gsc_refresh_token, gsc_site_url, gsc_connection_status')
        .eq('id', clientId)
        .maybeSingle();
      const c = cl as any;
      if (c?.gsc_refresh_token && c?.gsc_site_url && c.gsc_connection_status !== 'token_expired') {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 28); // 28-day window = stable average position
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        const res = await getSearchAnalytics(c.gsc_refresh_token, c.gsc_site_url, fmt(start), fmt(end), ['query']);
        gscRankMap = new Map();
        for (const row of (res.rows || [])) {
          if (row.query) gscRankMap.set(row.query.trim().toLowerCase(), Math.round(row.position));
        }
        gscConnected = true;
        console.log(`[SEO-DAILY-SCAN] ✅ GSC real data: ${gscRankMap.size} queries for ${businessName}`);
      }
    }
  } catch (e) {
    console.warn('[SEO-DAILY-SCAN] GSC fetch failed:', e instanceof Error ? e.message : e);
  }

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

    // --- Google SEO rank --- (prefer REAL GSC data; fall back to SERP lookup)
    let googleRank: number | null = null;
    const gscPos = gscConnected ? gscRankMap?.get(keyword.trim().toLowerCase()) : undefined;
    if (gscPos != null) {
      // Real average position from Search Console.
      googleRank = gscPos;
      aiVisibility.byPlatform['google_seo'].found += 1;
      aiVisibility.byPlatform['google_seo'].total += 1;
    } else if (gscConnected) {
      // GSC connected but no impressions for this keyword yet → not ranking in range.
      aiVisibility.byPlatform['google_seo'].total += 1;
    } else if (isPlatformAvailable('google_seo')) {
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

  // GEO score = AI-platform citation rate (ChatGPT/Gemini/Perplexity/Claude/AI Overview),
  // EXCLUDING plain Google SEO — this is the "are we in the AI answers" number.
  const aiOnly = AI_PLATFORMS.reduce((acc, p) => {
    const b = aiVisibility.byPlatform[p];
    if (b) { acc.found += b.found; acc.total += b.total; }
    return acc;
  }, { found: 0, total: 0 });
  const geoScore = aiOnly.total > 0 ? Math.round((aiOnly.found / aiOnly.total) * 100) : 0;

  // Save updates — PERSIST top-level scores so the dashboard reflects real data.
  await updatePlanSafe(planId, {
    dailySnapshots, clientKeywords,
    visibilityScore, overallScore, technicalScore, geoScore,
    geoScannedAt: new Date().toISOString(),
  } as any);

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
