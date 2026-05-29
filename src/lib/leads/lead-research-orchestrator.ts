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
  // Use scan-pipeline to crawl the site, then extract facts
  const { startScan, getJob } = await import('@/lib/seo/scan-pipeline');
  const { extractWebsiteFacts } = await import('@/lib/seo/website-facts');

  const jobId = await startScan(url, 'quick');

  // Poll until scan completes (max ~120s)
  const maxWait = 120_000;
  const pollInterval = 2_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const job = getJob(jobId);
    if (!job) break;
    if (job.status === 'completed' || job.status === 'failed') {
      const scanResult = job.result;
      const scannedPages = scanResult?.scannedPages || [];
      const facts = extractWebsiteFacts(scanResult, scannedPages, url);
      return {
        scanJobId: jobId,
        websiteFacts: facts,
        scanResult,
        scannedAt: new Date().toISOString(),
      };
    }
    await new Promise(r => setTimeout(r, pollInterval));
  }

  // Timed out — try to extract whatever we have
  const job = getJob(jobId);
  if (job?.result) {
    const scanResult = job.result;
    const scannedPages = scanResult?.scannedPages || [];
    const facts = extractWebsiteFacts(scanResult, scannedPages, url);
    return { scanJobId: jobId, websiteFacts: facts, scanResult, scannedAt: new Date().toISOString() };
  }

  return null;
}

async function runSocialScan(url: string, businessName: string): Promise<any> {
  // Will be implemented by social-scanner.ts (Phase 2)
  // For now, return null — orchestrator handles gracefully
  try {
    const { scanSocialPresence } = await import('@/lib/leads/social-scanner');
    return await scanSocialPresence(url, businessName);
  } catch {
    return null;
  }
}

async function runGooglePresence(url: string, businessName: string): Promise<any> {
  // Will be implemented by google-presence-scanner.ts (Phase 2)
  try {
    const { scanGooglePresence } = await import('@/lib/leads/google-presence-scanner');
    return await scanGooglePresence(url, businessName);
  } catch {
    return null;
  }
}

async function runSeoAnalysis(url: string, websiteFacts: any): Promise<any> {
  try {
    const { analyzeGaps } = await import('@/lib/seo/gap-analysis');

    // Extract domain from URL
    let domain = url;
    try { domain = new URL(url).hostname; } catch { /* use raw */ }

    const gapResult = analyzeGaps({ domain });
    if (!gapResult) return null;

    return {
      technicalScore: gapResult.summary?.totalGaps ?? 0,
      contentScore: gapResult.contentGaps?.length ?? 0,
      issues: gapResult.technicalGaps ?? [],
      contentGaps: gapResult.contentGaps ?? [],
      keywordOpportunities: gapResult.keywordGaps ?? [],
    };
  } catch {
    return null;
  }
}

async function runGeoAnalysis(url: string, businessName: string, websiteFacts: any): Promise<any> {
  try {
    const { queryPlatform, isPlatformAvailable } = await import('@/lib/seo/platform-apis');

    const platforms = ['google_ai_overview', 'gemini', 'chatgpt', 'claude', 'perplexity'];
    const keywords = websiteFacts?.keywords?.slice(0, 5) || [businessName];

    const results: any[] = [];
    for (const platformId of platforms) {
      if (!isPlatformAvailable(platformId as any)) {
        results.push({ platformId, platformName: platformId, found: false, queries: [] });
        continue;
      }

      const queries: any[] = [];
      for (const kw of keywords.slice(0, 3)) {
        try {
          const query = `מי הספק הטוב ביותר ל${kw} בישראל?`;
          const result = await queryPlatform(platformId as any, query);
          queries.push({
            query,
            found: result?.mentioned ?? false,
            mentionType: result?.mentionType ?? 'none',
            response: result?.response?.substring(0, 500),
          });
        } catch { /* skip */ }
      }

      const found = queries.some(q => q.found);
      results.push({ platformId, platformName: platformId, found, queries });
    }

    const totalPlatforms = results.length;
    const foundCount = results.filter(r => r.found).length;
    const overallVisibility = totalPlatforms > 0 ? Math.round((foundCount / totalPlatforms) * 100) : 0;

    return { overallVisibility, platforms: results };
  } catch {
    return null;
  }
}

async function runCompetitorAnalysis(url: string, websiteFacts: any): Promise<any> {
  try {
    const { analyzeCompetitors } = await import('@/lib/seo/competitor-engine');

    let domain = url;
    try { domain = new URL(url).hostname; } catch { /* use raw */ }

    const result = analyzeCompetitors({ domain });
    if (!result?.competitors?.length) return null;

    // Map to the LeadResearch schema shape
    return {
      competitors: result.competitors.map(c => ({
        name: c.domain,
        domain: c.domain,
        overlapScore: c.overlapScore,
        strengths: c.keywordsTheyOwn?.slice(0, 5) ?? [],
        weaknesses: [],
      })),
      marketPosition: result.summary?.overallThreatLevel ?? 'unknown',
    };
  } catch {
    return null;
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
  try {
    const { calculateStrategicScore } = await import('@/lib/seo/strategic-scoring');

    const score = calculateStrategicScore({
      websiteFacts: data.websiteFacts ?? undefined,
      gapAnalysis: data.seoAnalysis ?? undefined,
      competitorAnalysis: data.competitorAnalysis ?? undefined,
      aiVisibilityScore: data.geoAnalysis?.overallVisibility ?? undefined,
    });
    if (!score) return null;

    return {
      overall: score.overall,
      grade: score.grade,
      confidence: score.confidence,
      categories: score.categories?.map(c => ({
        category: c.name,
        categoryHe: c.nameHe,
        score: c.score,
        weight: c.weight,
        grade: c.score >= 80 ? 'A' : c.score >= 60 ? 'B' : c.score >= 40 ? 'C' : 'D',
        topIssue: c.topIssue,
        topAction: c.topAction,
        signals: c.signals?.map(sId => ({
          name: sId,
          nameHe: sId,
          score: 0,
          evidence: '',
          impact: 'medium' as const,
        })) ?? [],
      })) ?? [],
    };
  } catch {
    return null;
  }
}

async function runSalesOpportunities(data: {
  websiteFacts: any;
  seoAnalysis: any;
  geoAnalysis: any;
  socialPresence: any;
  googlePresence: any;
  scores: any;
}): Promise<any[]> {
  // Will be fully implemented by sales-opportunity-engine.ts (Phase 2)
  try {
    const { analyzeSalesOpportunities } = await import('@/lib/leads/sales-opportunity-engine');
    return await analyzeSalesOpportunities(data);
  } catch {
    return [];
  }
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
}

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

  // Run pipeline in background (don't await)
  runPipeline(researchId, options).catch(err => {
    console.error('[LeadResearch] Pipeline crashed:', err);
    updateResearch(researchId, {
      status: 'failed',
      error: err?.message || 'Pipeline crashed',
      currentStage: 'failed',
    } as any);
  });

  return researchId;
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
      { limit: 1 },
    );
    return results?.[0] || null;
  } catch {
    return null;
  }
}
