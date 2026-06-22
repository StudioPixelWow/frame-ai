/**
 * Brand Analysis Service — Creative Studio
 *
 * The Brand DNA analysis engine for Studio Pixel.
 * Triggered when the user clicks "נתח סגנון מותג" in the Creative Studio UI.
 *
 * Current mode: metadata-only analysis (tags, descriptions, approved/rejected flags,
 * asset types, feedback history). The placeholders marked TODO below are where
 * Gemini Vision / OpenAI Vision would plug in for real image analysis.
 *
 * Returns a BrandStyleProfile that captures the client's visual identity,
 * preferred aesthetics, and auto-detected do/don't rules.
 */

import { generateWithAI } from '@/lib/ai/openai-client';
import {
  brandAssets,
  brandStyleProfiles,
  brandAnalysisJobs,
  creativeFeedback,
} from '@/lib/db/collections';
import type {
  BrandAsset,
  BrandStyleProfile,
  BrandAnalysisJob,
  CreativeFeedback,
} from '@/lib/db/schema';

/* ── Result types ────────────────────────────────────────────────────────── */

/** Full result of analyzeAsset() — visual characteristics extracted per asset. */
export interface AssetAnalysisResult {
  assetId: string;
  /** Dominant colors detected (as objects or hex strings from Vision AI). */
  extractedColors: any[];
  /** Visual style description from Vision AI or metadata fallback. */
  visualStyleDescription: string;
  /** Tags detected/confirmed for this asset. */
  detectedTags: string[];
  /**
   * TODO: When Vision AI is integrated, this will contain the actual
   * AI-generated image summary (Gemini Vision / GPT-4o Vision).
   */
  aiSummary: string | null;
  analysisSource: 'metadata' | 'vision_ai';
}

/** Result of findApprovalPatterns() — what the client consistently approves or rejects. */
export interface ApprovalPatternResult {
  clientId: string;
  /** Tags and styles that appear consistently in approved assets. */
  approvedPatterns: string[];
  /** Tags and styles that appear consistently in rejected assets. */
  rejectedPatterns: string[];
  /** Asset types that dominate the approved set. */
  dominantApprovedTypes: string[];
  /** Raw approval/rejection counts for logging. */
  counts: {
    totalAssets: number;
    approved: number;
    rejected: number;
    neutral: number;
  };
}

/* ── Helper: tag frequency counter ─────────────────────────────────────── */

function countFrequency(items: string[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

function topN(freq: Record<string, number>, n = 10): string[] {
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([key]) => key);
}

/* ── analyzeAsset ────────────────────────────────────────────────────────── */

/**
 * Analyzes a single brand asset for visual characteristics.
 *
 * Current implementation: metadata-only (tags, description, title).
 *
 * TODO: Integrate Vision AI here:
 *   1. Download the asset from fileUrl (use fetch(asset.fileUrl))
 *   2. Send to Gemini Vision (gemini-1.5-pro-vision) or GPT-4o with vision
 *   3. Ask for: dominant colors (hex), visual style description, composition,
 *      typography presence, emotion/mood, quality score
 *   4. Store result in aiSummary + aiExtractedColors + aiDetectedStyle fields
 *   5. Set analysisSource = 'vision_ai'
 */
export async function analyzeAsset(assetId: string): Promise<AssetAnalysisResult> {
  const asset = await brandAssets.getByIdAsync(assetId);
  if (!asset) {
    throw new Error(`נכס מותג לא נמצא: ${assetId}`);
  }

  // TODO: Real image download + Vision AI call goes here.
  // For now, we derive characteristics from metadata only.
  const detectedTags = asset.tags ?? [];
  const visualStyleDescription = [
    asset.description,
    asset.title,
  ]
    .filter(Boolean)
    .join(' — ') || 'אין תיאור זמין';

  // TODO: Extract colors via Vision AI.
  // Placeholder: return existing colors or empty array until Vision is wired up.
  const extractedColors: any[] = asset.aiExtractedColors ?? [];

  // Update the asset record with analysis results
  await brandAssets.updateAsync(assetId, {
    aiSummary: '',  // TODO: populate from Vision AI
    aiExtractedColors: extractedColors,
    aiDetectedStyle: {},  // TODO: populate from Vision AI style detection
    aiVisualFeatures: {}, // TODO: populate from Vision AI feature extraction
    updatedAt: new Date().toISOString(),
  } as Partial<BrandAsset>);

  return {
    assetId,
    extractedColors,
    visualStyleDescription,
    detectedTags,
    aiSummary: null, // TODO: Vision AI output
    analysisSource: 'metadata',
  };
}

/* ── findApprovalPatterns ────────────────────────────────────────────────── */

/**
 * Compares approved vs rejected reference assets to surface patterns.
 *
 * Returns the tags, types, and styles that correlate with approval vs rejection.
 * This drives the approvedPatterns and rejectedPatterns fields of BrandStyleProfile.
 */
export async function findApprovalPatterns(
  clientId: string,
): Promise<ApprovalPatternResult> {
  const allAssets = await brandAssets.queryAsync(
    (a: BrandAsset) => a.clientId === clientId,
  );

  const approved = allAssets.filter((a) => a.isApprovedReference);
  const rejected = allAssets.filter((a) => a.isRejectedReference);
  const neutral = allAssets.filter(
    (a) => !a.isApprovedReference && !a.isRejectedReference,
  );

  const approvedTags = approved.flatMap((a) => a.tags ?? []);
  const rejectedTags = rejected.flatMap((a) => a.tags ?? []);
  const approvedTypes = approved.map((a) => a.assetType).filter(Boolean);

  const approvedFreq = countFrequency(approvedTags);
  const rejectedFreq = countFrequency(rejectedTags);
  const typeFreq = countFrequency(approvedTypes);

  // Remove tags that appear equally in approved and rejected — not diagnostic
  const pureApproved = Object.entries(approvedFreq)
    .filter(([tag, count]) => count > (rejectedFreq[tag] ?? 0))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([tag]) => tag);

  const pureRejected = Object.entries(rejectedFreq)
    .filter(([tag, count]) => count > (approvedFreq[tag] ?? 0))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([tag]) => tag);

  return {
    clientId,
    approvedPatterns: pureApproved,
    rejectedPatterns: pureRejected,
    dominantApprovedTypes: topN(typeFreq, 5),
    counts: {
      totalAssets: allAssets.length,
      approved: approved.length,
      rejected: rejected.length,
      neutral: neutral.length,
    },
  };
}

/* ── analyzeBrandDNA ─────────────────────────────────────────────────────── */

/**
 * Main Brand DNA analysis function.
 * Called when the user clicks "נתח סגנון מותג" in the Creative Studio.
 *
 * Steps:
 * 1. Record a BrandAnalysisJob (status: 'processing')
 * 2. Fetch all brand assets for the client
 * 3. Separate approved / rejected / neutral references
 * 4. Count asset types and tag frequencies
 * 5. Fetch creative feedback history
 * 6. Send metadata summary to GPT-4.1 with a Hebrew analysis prompt
 * 7. Parse the AI response into a BrandStyleProfile
 * 8. Upsert the profile in brandStyleProfiles
 * 9. Mark the analysis job as completed
 * 10. Return the profile
 */
export async function analyzeBrandDNA(clientId: string): Promise<BrandStyleProfile> {
  const now = new Date().toISOString();

  // ── Step 1: Record analysis job (running state) ───────────────────────
  let job: BrandAnalysisJob;
  try {
    job = await brandAnalysisJobs.createAsync({
      clientId,
      status: 'processing',
      jobType: 'brand_dna_analysis',
      inputAssetIds: [],
      resultProfileId: null,
      errorMessage: '',
      startedAt: now,
      finishedAt: null,
      createdAt: now,
    } as Omit<BrandAnalysisJob, 'id'>);
  } catch (err) {
    console.error('[brand-analysis-service] Failed to create analysis job:', err);
    // Non-fatal — continue even if job tracking fails
    job = { id: `temp-${Date.now()}` } as BrandAnalysisJob;
  }

  try {
    // ── Step 2: Fetch all brand assets ─────────────────────────────────
    const allAssets = await brandAssets.queryAsync(
      (a: BrandAsset) => a.clientId === clientId,
    );

    const approvedRefs = allAssets.filter((a) => a.isApprovedReference);
    const rejectedRefs = allAssets.filter((a) => a.isRejectedReference);
    const competitorRefs = allAssets.filter((a) => a.isCompetitorReference);

    // ── Step 3: Frequencies ─────────────────────────────────────────────
    const allTags = allAssets.flatMap((a) => a.tags ?? []);
    const tagFrequency = countFrequency(allTags);
    const topTags = topN(tagFrequency, 20);

    const assetTypeFreq = countFrequency(
      allAssets.map((a) => a.assetType).filter(Boolean),
    );

    // ── Step 4: Fetch creative feedback ────────────────────────────────
    let feedbackHistory: CreativeFeedback[] = [];
    try {
      feedbackHistory = await creativeFeedback.queryAsync(
        (f: CreativeFeedback) => f.clientId === clientId,
      );
    } catch {
      // creativeFeedback table may not be accessible — safe to skip
      console.warn('[brand-analysis-service] creativeFeedback not available, skipping.');
    }

    const likedFeedback = feedbackHistory
      .filter((f) => f.feedbackType === 'liked' || f.feedbackType === 'approved')
      .map((f) => f.feedbackNote ?? '')
      .filter(Boolean)
      .slice(0, 10);

    const dislikedFeedback = feedbackHistory
      .filter((f) => f.feedbackType === 'disliked' || f.feedbackType === 'rejected')
      .map((f) => f.feedbackNote ?? '')
      .filter(Boolean)
      .slice(0, 10);

    // ── Step 5: Build AI prompt ─────────────────────────────────────────

    /**
     * TODO (Vision AI): Before sending to GPT-4.1, run analyzeAsset() on each
     * approved/rejected asset to get real image descriptions and extracted colors.
     * Then include the aiSummary[] results in the prompt below for richer analysis.
     *
     * Implementation sketch:
     *   const visionResults = await Promise.all(
     *     approvedRefs.map(a => analyzeAsset(a.id))
     *   );
     *   const imageDescriptions = visionResults
     *     .map(r => r.aiSummary)
     *     .filter(Boolean);
     *   // Add imageDescriptions to the user prompt
     */

    const systemPrompt = `
אתה מומחה Brand DNA ויזואלי של סטודיו פיקסל — סוכנות קריאייטיב ישראלית פרימיום.
תפקידך לנתח נתוני מטא של נכסי מותג ולבנות פרופיל סגנוני מדויק עבור הלקוח.

הפלט שלך חייב להיות JSON תקין בלבד, ללא טקסט נוסף, בפורמט הבא:
{
  "primaryColors": [{"hex": "#RRGGBB", "name": "שם הצבע", "role": "primary"}],
  "secondaryColors": [{"hex": "#RRGGBB", "name": "שם"}],
  "forbiddenColors": [{"hex": "#RRGGBB", "reason": "מדוע אסור"}],
  "brandSummary": "תיאור קצר של המותג בעברית (משפט אחד)",
  "visualPersonality": "תיאור אישיות ויזואלית בעברית (2-3 מילים)",
  "copywritingTone": "טון הכתיבה הרצוי בעברית",
  "preferredTypography": {"style": "תיאור", "weight": "דק/עבה/בינוני", "family": "סוג גופן"},
  "preferredLayouts": ["לייאאוט מועדף 1", "לייאאוט מועדף 2"],
  "rejectedLayouts": ["לייאאוט שנדחה 1"],
  "preferredVisualStyles": ["סגנון ויזואלי 1", "סגנון ויזואלי 2"],
  "rejectedVisualStyles": ["סגנון שנדחה 1"],
  "preferredImageStyles": ["סגנון תמונה מועדף"],
  "rejectedImageStyles": ["סגנון תמונה שנדחה"],
  "preferredIconStyles": ["סגנון אייקון מועדף"],
  "rejectedIconStyles": [],
  "brandRules": ["כלל מותגי 1", "כלל 2"],
  "avoidRules": ["הימנע מ-1", "הימנע מ-2"],
  "approvedPatterns": ["דפוס שהלקוח תמיד מאשר 1"],
  "rejectedPatterns": ["דפוס שהלקוח תמיד דוחה 1"],
  "scores": {
    "luxury": 0,
    "minimalism": 0,
    "modern": 0,
    "salesAggressiveness": 0,
    "visualDensity": 0,
    "aiGenerated": 0
  }
}

הנחיות לציונים (0-100):
- luxury: כמה יוקרתי ופרימיום הסגנון (100 = יוקרה מוחלטת)
- minimalism: כמה מינימליסטי ונקי (100 = מינימליזם מוחלט)
- modern: כמה מודרני ועכשווי (100 = חדשנות מוחלטת)
- salesAggressiveness: כמה ממוקד מכירות לעומת תדמית (100 = direct-response מוחלט)
- visualDensity: כמה עמוס ויזואלית (100 = עמוס מאוד, 0 = ריק לגמרי)
- aiGenerated: האם עיצובים קיימים נראים כ-AI גנרי (0 = אחסר, 100 = AI מאוד)
`.trim();

    const approvedDescriptions = approvedRefs
      .map((a) => `- ${a.title}: ${a.description} [תגיות: ${(a.tags ?? []).join(', ')}]`)
      .join('\n') || 'אין דוגמאות מאושרות עדיין';

    const rejectedDescriptions = rejectedRefs
      .map((a) => `- ${a.title}: ${a.description} [תגיות: ${(a.tags ?? []).join(', ')}]`)
      .join('\n') || 'אין דוגמאות שנדחו עדיין';

    const userPrompt = `
נתח את פרופיל המותג של הלקוח לפי הנתונים הבאים:

=== סטטיסטיקות נכסים ===
סה"כ נכסים: ${allAssets.length}
מאושרים: ${approvedRefs.length}
נדחו: ${rejectedRefs.length}
מתחרים (לעיון): ${competitorRefs.length}

סוגי נכסים: ${JSON.stringify(assetTypeFreq)}
תגיות נפוצות: ${topTags.join(', ')}

=== דוגמאות שהלקוח אישר ===
${approvedDescriptions}

=== דוגמאות שהלקוח דחה ===
${rejectedDescriptions}

${likedFeedback.length > 0 ? `=== משוב חיובי מהיסטוריה ===\n${likedFeedback.join('\n')}` : ''}

${dislikedFeedback.length > 0 ? `=== משוב שלילי מהיסטוריה ===\n${dislikedFeedback.join('\n')}` : ''}

על בסיס הנתונים, בנה פרופיל Brand DNA מלא.
אם אין מספיק נתונים לתחום מסוים, ציין זאת בערך הרלוונטי ("מידע לא מספיק לקביעה").
`.trim();

    // ── Step 6: Call AI ─────────────────────────────────────────────────
    const aiResult = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.3, // Lower temperature for consistent, structured analysis
      maxTokens: 2500,
    });

    if (!aiResult.success || !aiResult.data) {
      throw new Error(
        `ניתוח AI נכשל: ${aiResult.error ?? 'תשובה ריקה מה-AI'}`,
      );
    }

    const aiData = aiResult.data as Record<string, unknown>;
    const scores = (aiData.scores as Record<string, number>) ?? {};

    // ── Step 7: Find or upsert BrandStyleProfile ────────────────────────
    const profileNow = new Date().toISOString();

    let existingProfile: BrandStyleProfile | null = null;
    try {
      const allProfiles = await brandStyleProfiles.queryAsync(
        (p: BrandStyleProfile) => p.clientId === clientId,
      );
      existingProfile = allProfiles[0] ?? null;
    } catch {
      // Table may not exist yet
    }

    // Map AI output to the actual BrandStyleProfile schema fields
    const profileData: Omit<BrandStyleProfile, 'id'> = {
      clientId,
      profileStatus: 'active',
      brandSummary: (aiData.brandSummary as string) ?? '',
      visualPersonality: (aiData.visualPersonality as string) ?? '',
      copywritingTone: (aiData.copywritingTone as string) ?? '',
      primaryColors: (aiData.primaryColors as any[]) ?? [],
      secondaryColors: (aiData.secondaryColors as any[]) ?? [],
      accentColors: [],
      forbiddenColors: (aiData.forbiddenColors as any[]) ?? [],
      preferredTypography: (aiData.preferredTypography as Record<string, any>) ?? {},
      forbiddenTypography: {},
      preferredLayouts: (aiData.preferredLayouts as any[]) ?? [],
      rejectedLayouts: (aiData.rejectedLayouts as any[]) ?? [],
      preferredVisualStyles: (aiData.preferredVisualStyles as any[]) ?? [],
      rejectedVisualStyles: (aiData.rejectedVisualStyles as any[]) ?? [],
      preferredImageStyles: (aiData.preferredImageStyles as any[]) ?? [],
      rejectedImageStyles: (aiData.rejectedImageStyles as any[]) ?? [],
      preferredIconStyles: (aiData.preferredIconStyles as any[]) ?? [],
      rejectedIconStyles: (aiData.rejectedIconStyles as any[]) ?? [],
      brandRules: (aiData.brandRules as any[]) ?? [],
      avoidRules: (aiData.avoidRules as any[]) ?? [],
      luxuryScore: scores.luxury ?? 50,
      minimalismScore: scores.minimalism ?? 50,
      modernScore: scores.modern ?? 50,
      salesAggressivenessScore: scores.salesAggressiveness ?? 50,
      visualDensityScore: scores.visualDensity ?? 50,
      aiGeneratedScore: scores.aiGenerated ?? 0,
      approvedPatterns: (aiData.approvedPatterns as any[]) ?? [],
      rejectedPatterns: (aiData.rejectedPatterns as any[]) ?? [],
      clientNotes: '',
      talNotes: '',
      aiConfidenceScore: allAssets.length > 5 ? 80 : allAssets.length > 2 ? 60 : 40,
      lastAnalyzedAt: profileNow,
      createdAt: existingProfile?.createdAt ?? profileNow,
      updatedAt: profileNow,
    };

    let profile: BrandStyleProfile;
    if (existingProfile) {
      const updated = await brandStyleProfiles.updateAsync(
        existingProfile.id,
        profileData as Partial<BrandStyleProfile>,
      );
      if (!updated) {
        throw new Error('עדכון פרופיל מותג נכשל');
      }
      profile = updated;
    } else {
      profile = await brandStyleProfiles.createAsync(profileData);
    }

    // ── Step 8: Mark analysis job as complete ───────────────────────────
    try {
      await brandAnalysisJobs.updateAsync(job.id, {
        status: 'completed',
        resultProfileId: profile.id,
        finishedAt: new Date().toISOString(),
      } as Partial<BrandAnalysisJob>);
    } catch {
      // Non-fatal
    }

    console.log(
      `[brand-analysis-service] Brand DNA analysis complete. ` +
        `clientId=${clientId} profileId=${profile.id} assets=${allAssets.length}`,
    );

    // ── Step 9: Return the profile ──────────────────────────────────────
    return profile;
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : String(error);

    console.error(
      `[brand-analysis-service] Analysis failed for clientId=${clientId}:`,
      errMsg,
    );

    // Mark job as failed
    try {
      await brandAnalysisJobs.updateAsync(job.id, {
        status: 'failed',
        errorMessage: errMsg,
        finishedAt: new Date().toISOString(),
      } as Partial<BrandAnalysisJob>);
    } catch {
      // Non-fatal
    }

    throw error;
  }
}
