/**
 * POST /api/ai/campaign-analysis
 *
 * Deep AI analysis of a single campaign.
 * Uses campaign data + health + alerts + leads context.
 *
 * Request body:
 *   {
 *     campaignId: string,
 *     campaign: { ...campaign fields },
 *     healthScore: number,
 *     healthBreakdown: { structure, creative, targeting, activity },
 *     alerts: Array<{ type, severity, message }>,
 *     leadCount: number,
 *     highQualityLeadCount: number,
 *     wonLeadCount: number,
 *     clientName: string,
 *     businessField?: string,
 *   }
 *
 * Response:
 *   {
 *     analysis: {
 *       summary: string,
 *       issues: string[],
 *       opportunities: string[],
 *       actions: string[],
 *     },
 *     fallback?: boolean,
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { generateWithAI, getClientKnowledgeContext } from "@/lib/ai/openai-client";
import { campaigns as campaignsCol, adSets as adSetsCol, ads as adsCol } from "@/lib/db/collections";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = "nodejs";

const PLATFORM_NAMES: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  multi_platform: "מולטי-פלטפורמה",
};

const GOAL_NAMES: Record<string, string> = {
  lead_gen: "לידים",
  paid_social: "תנועה לאתר",
  awareness: "מודעות למותג",
  remarketing: "מכירות/רימרקטינג",
  organic_social: "תוכן אורגני",
  podcast_promo: "קידום פודקאסט",
  custom: "קמפיין מותאם",
};

const STATUS_NAMES: Record<string, string> = {
  draft: "טיוטה",
  in_progress: "בתהליך",
  waiting_approval: "ממתין לאישור",
  approved: "מאושר",
  scheduled: "מתוזמן",
  active: "פעיל",
  completed: "הושלם",
};

interface AnalysisRequest {
  campaignId: string;
  campaign: {
    campaignName?: string;
    campaignType?: string;
    platform?: string;
    status?: string;
    objective?: string;
    caption?: string;
    notes?: string;
    budget?: number;
    startDate?: string;
    endDate?: string;
    linkedClientFileId?: string;
    externalMediaUrl?: string;
    mediaType?: string;
    adFormat?: string;
  };
  healthScore: number;
  healthBreakdown: { structure: number; creative: number; targeting: number; activity: number };
  alerts: Array<{ type: string; severity: string; message: string }>;
  leadCount: number;
  highQualityLeadCount: number;
  wonLeadCount: number;
  clientName: string;
  clientId?: string;
  businessField?: string;
}

interface AnalysisResult {
  summary: string;
  issues: string[];
  opportunities: string[];
  actions: string[];
}

export async function POST(req: NextRequest) {
  const tag = "[/api/ai/campaign-analysis]";
  const t0 = Date.now();

  try {
    const body: AnalysisRequest = await req.json();
    const { campaign, healthScore, healthBreakdown, alerts, leadCount, highQualityLeadCount, wonLeadCount, clientName, clientId, businessField } = body;

    if (!campaign) {
      return NextResponse.json({ error: "Missing campaign data" }, { status: 400 });
    }

    // Build client knowledge context
    let knowledgeCtx = "";
    if (clientId) {
      try {
        knowledgeCtx = await getClientKnowledgeContext(clientId);
      } catch {
        console.warn(`${tag} Could not load client knowledge for ${clientId}`);
      }
    }

    const platformName = PLATFORM_NAMES[campaign.platform || ""] || campaign.platform || "לא צוין";
    const goalName = GOAL_NAMES[campaign.campaignType || ""] || campaign.campaignType || "לא צוין";
    const statusName = STATUS_NAMES[campaign.status || ""] || campaign.status || "לא צוין";

    // ── Pull the campaign's SYNCED ad sets + ads from the DB ──────────────
    // Meta-synced campaigns store creative on the ADS and targeting on the AD SETS,
    // not on the campaign record. Checking the campaign fields alone produced false
    // "missing creative/copy/targeting" findings for real, live campaigns.
    let liveAds: any[] = [];
    let liveAdSets: any[] = [];
    let isSynced = false;
    try {
      const all = await campaignsCol.getAllAsync();
      const localCampaign = (all as any[]).find(
        (c) => c.id === body.campaignId || c.metaCampaignId === body.campaignId,
      );
      if (localCampaign) {
        isSynced = !!localCampaign.metaCampaignId;
        const [allAdSets, allAds] = await Promise.all([adSetsCol.getAllAsync(), adsCol.getAllAsync()]);
        liveAdSets = (allAdSets as any[]).filter((s) => s.campaignId === localCampaign.id);
        liveAds = (allAds as any[]).filter((a) => a.campaignId === localCampaign.id);
      }
    } catch { /* DB optional — fall back to campaign fields below */ }

    // Derive REAL flags: from synced ads/adsets if available, else manual fields.
    const adsHaveMedia = liveAds.some((a) => a.mediaUrl || a.thumbnailUrl);
    const adsHaveCopy = liveAds.some((a) => (a.primaryText || '').trim().length > 3);
    const adsHaveHeadline = liveAds.some((a) => (a.headline || '').trim().length > 1);
    const adSetsHaveTargeting = liveAdSets.some((s) => s.targeting && Object.keys(s.targeting).length > 0);

    const hasCreative = adsHaveMedia || !!(campaign.linkedClientFileId || (campaign.externalMediaUrl && campaign.externalMediaUrl.length > 5));
    const hasCopy = adsHaveCopy || !!(campaign.caption && campaign.caption.trim().length > 5);
    const hasHeadline = adsHaveHeadline || !!(campaign.notes && campaign.notes.includes("כותרת:"));
    const hasTargeting = adSetsHaveTargeting || !!(campaign.objective && (campaign.objective.includes("מיקום:") || campaign.objective.includes("עניינים:")));

    // Real performance totals from the synced ads (for the AI context).
    const perf = liveAds.reduce((t, a) => ({
      spend: t.spend + (a.spend || 0), leads: t.leads + (a.leads || 0),
      impressions: t.impressions + (a.impressions || 0), clicks: t.clicks + (a.clicks || 0),
    }), { spend: 0, leads: 0, impressions: 0, clicks: 0 });

    // Build campaign context for the AI
    const campaignContext = [
      `שם הקמפיין: ${campaign.campaignName || "ללא שם"}`,
      `לקוח: ${clientName || "לא צוין"}${businessField ? ` (${businessField})` : ""}`,
      `פלטפורמה: ${platformName}`,
      `סוג: ${goalName}`,
      `סטטוס: ${statusName}`,
      `תקציב: ${campaign.budget ? `₪${campaign.budget.toLocaleString()}` : "לא הוגדר"}`,
      `תאריכים: ${campaign.startDate || "לא הוגדר"} — ${campaign.endDate || "לא הוגדר"}`,
      `מקור: ${isSynced ? `קמפיין מסונכרן מ-Meta (${liveAdSets.length} קבוצות מודעות, ${liveAds.length} מודעות פעילות)` : "קמפיין שנוצר במערכת"}`,
      `קריאייטיב: ${hasCreative ? "קיים" : "חסר"}`,
      `טקסט ראשי: ${hasCopy ? "קיים" : "חסר"}`,
      `כותרת: ${hasHeadline ? "קיימת" : "חסרה"}`,
      `טרגוט: ${hasTargeting ? "מוגדר" : "לא מוגדר"}`,
      `מטרת הקמפיין: ${campaign.objective || "לא הוגדרה"}`,
      ...(isSynced ? [
        "",
        "ביצועים בפועל (מ-Meta):",
        `  הוצאה: ₪${Math.round(perf.spend)} | לידים: ${perf.leads} | חשיפות: ${perf.impressions.toLocaleString()} | קליקים: ${perf.clicks}`,
        `  CPL: ${perf.leads > 0 ? `₪${Math.round(perf.spend / perf.leads)}` : "—"} | CTR: ${perf.impressions > 0 ? `${((perf.clicks / perf.impressions) * 100).toFixed(2)}%` : "—"}`,
        "חשוב: זהו קמפיין חי ופעיל ב-Meta — אל תטען שחסרים קריאייטיב/טקסט/טרגוט אלא אם צוין במפורש 'חסר' למעלה. התמקד באופטימיזציה התקפית (קהלים, קריאייטיב, תקציב) להגדלת לידים.",
      ] : []),
      "",
      `ציון בריאות: ${healthScore}/100`,
      `פירוט: מבנה ${healthBreakdown.structure}/25 | קריאייטיב ${healthBreakdown.creative}/25 | טרגוט ${healthBreakdown.targeting}/20 | פעילות ${healthBreakdown.activity}/30`,
      "",
      `התראות (${alerts.length}):`,
      ...alerts.map((a) => `  [${a.severity}] ${a.message}`),
      "",
      `לידים: ${leadCount} סה"כ | ${highQualityLeadCount} באיכות גבוהה | ${wonLeadCount} שנסגרו`,
    ].join("\n");

    const systemPrompt = `אתה אנליסט קמפיינים דיגיטליים מומחה. אתה מנתח קמפיינים ברשתות חברתיות ומספק תובנות מעשיות.

כללים:
- כתוב בעברית מקצועית, ישירה ובטוחה
- התמקד בתובנות מעשיות — לא כלליות
- כל בעיה חייבת לבוא עם השלכה (מה יקרה אם לא יטפלו)
- כל הזדמנות חייבת להיות ספציפית לקמפיין הזה
- כל המלצה חייבת להיות צעד ברור ומיידי
- השתמש בנתוני הבריאות, ההתראות והלידים כבסיס

${knowledgeCtx ? `מידע על הלקוח:\n${knowledgeCtx}` : ""}`;

    const userPrompt = `נתח את הקמפיין הבא ותן תובנות מפורטות:

${campaignContext}

החזר JSON בפורמט הבא בלבד:
{
  "summary": "סיכום של 1-2 משפטים על מצב הקמפיין",
  "issues": ["בעיה 1 עם השלכה", "בעיה 2 עם השלכה"],
  "opportunities": ["הזדמנות 1", "הזדמנות 2"],
  "actions": ["פעולה מומלצת 1", "פעולה מומלצת 2", "פעולה מומלצת 3"]
}

הנחיות:
- summary: משפט אחד עד שניים שמתאר את מצב הקמפיין
- issues: 2-5 בעיות שזוהו. לכל בעי�� — ציין את ההשלכה
- opportunities: 2-4 הזדמנויות לשיפור
- actions: 3-5 צעדים ברורים שניתן לבצע עכשיו`;

    console.log(`${tag} Analyzing campaign: ${campaign.campaignName} (health: ${healthScore})`);

    const aiResult = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.6,
      maxTokens: 2000,
    });

    if (!aiResult.success) {
      if (aiResult.errorType === "missing_api_key") {
        console.warn(`${tag} No API key — using fallback analysis`);
        const fallback = generateFallbackAnalysis(body);
        return NextResponse.json({ analysis: fallback, fallback: true });
      }
      console.error(`${tag} AI error: ${aiResult.error}`);
      return NextResponse.json({ error: aiResult.error || "AI generation failed" }, { status: 502 });
    }

    // Parse results
    let analysis: AnalysisResult | null = null;
    const data = aiResult.data as Record<string, unknown> | string;

    if (typeof data === "object" && data !== null) {
      const d = data as Record<string, unknown>;
      if (typeof d.summary === "string" && Array.isArray(d.issues)) {
        analysis = {
          summary: d.summary as string,
          issues: (d.issues as string[]) || [],
          opportunities: (d.opportunities as string[]) || [],
          actions: (d.actions as string[]) || [],
        };
      }
    } else if (typeof data === "string") {
      try {
        const match = data.match(/\{[\s\S]*"summary"[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          analysis = {
            summary: parsed.summary || "",
            issues: parsed.issues || [],
            opportunities: parsed.opportunities || [],
            actions: parsed.actions || [],
          };
        }
      } catch {
        // Could not parse
      }
    }

    if (!analysis) {
      analysis = generateFallbackAnalysis(body, { hasCreative, hasCopy, hasTargeting, hasHeadline, isSynced });
    }

    const latencyMs = Date.now() - t0;
    console.log(`${tag} ✅ Analysis complete (${latencyMs}ms)`);

    return NextResponse.json({ analysis });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} ❌ FAILED: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Deterministic fallback analysis when no AI API key is configured.
 */
function generateFallbackAnalysis(
  body: AnalysisRequest,
  flags?: { hasCreative: boolean; hasCopy: boolean; hasTargeting: boolean; hasHeadline: boolean; isSynced: boolean },
): AnalysisResult {
  const { campaign, healthScore, healthBreakdown, alerts, leadCount, wonLeadCount } = body;
  const issues: string[] = [];
  const opportunities: string[] = [];
  const actions: string[] = [];

  // Prefer the real (synced) flags computed in POST; fall back to manual fields.
  const hasCreative = flags?.hasCreative ?? !!(campaign.linkedClientFileId || (campaign.externalMediaUrl && campaign.externalMediaUrl.length > 5));
  const hasCopy = flags?.hasCopy ?? !!(campaign.caption && campaign.caption.trim().length > 5);
  const hasBudget = !!(campaign.budget && campaign.budget > 0);
  const hasTargeting = flags?.hasTargeting ?? !!(campaign.objective && (campaign.objective.includes("מיקום:") || campaign.objective.includes("עניינים:")));
  const hasHeadline = flags?.hasHeadline ?? !!(campaign.notes && campaign.notes.includes("כותרת:"));
  const isSynced = flags?.isSynced ?? false;

  // Synced + live campaign with creative — pivot to OFFENSIVE growth, not "missing X".
  if (isSynced && hasCreative) {
    if (leadCount > 0) {
      opportunities.push("הקמפיין פעיל ומביא לידים — הרחבת הקהל המנצח תגדיל נפח באותו CPL");
      opportunities.push("בדיקת A/B על הקריאייטיב המנצח יכולה להוריד CPL נוסף");
      actions.push("הרחב את הקהל של ה-Ad Set המנצח (Lookalike / קהל רחב)");
      actions.push("הוסף וריאציית קריאייטיב חדשה לבדיקה מול המנצח");
      actions.push("הסט תקציב מקבוצות יקרות לקבוצה המנצחת");
    } else {
      opportunities.push("הקמפיין חי אך עדיין ללא לידים — בדיקת קהל/קריאייטיב/דף נחיתה");
      actions.push("בדוק שהטופס/דף הנחיתה עובד וש-CTA ברור");
      actions.push("רענן את הקריאייטיב או הרחב את הקהל");
    }
    return {
      summary: leadCount > 0
        ? `הקמפיין "${campaign.campaignName || ''}" פעיל ומביא ${leadCount} לידים. מומלץ להרחיב את ההצלחה.`
        : `הקמפיין "${campaign.campaignName || ''}" פעיל אך טרם הניב לידים — כדאי לייעל קהל/קריאייטיב.`,
      issues: [], opportunities: opportunities.slice(0, 4), actions: actions.slice(0, 5),
    };
  }

  // Issues (manual / incomplete campaigns only)
  if (!hasCreative) {
    issues.push("הקמפיין חסר קריאייטיב — ללא מדיה לא ניתן לייצר ביצועים בפלטפורמה");
  }
  if (!hasCopy) {
    issues.push("אין טקסט ראשי — המודעה ��א תוכל לרוץ ללא קופי שמעביר מסר");
  }
  if (!hasTargeting) {
    issues.push("אין קהל מוגדר — הקמפיין לא ממוקד ויבזבז תקציב על קהל לא רלוונטי");
  }
  if (!hasBudget && campaign.status !== "draft") {
    issues.push("לא הוגדר תקצי�� — הקמפיין לא מוכן להפעלה");
  }
  if (!hasHeadline && hasCopy) {
    issues.push("חסרה כ��תרת — כותרת חדה משפרת CTR ב-20-30%");
  }
  if (healthBreakdown.activity < 10 && campaign.status === "draft") {
    issues.push("הקמפיין בסטטוס טיוטה ללא עדכונים — סיכוי שנשכח");
  }

  // High severity alerts as issues
  for (const a of alerts.filter((a) => a.severity === "high" && !issues.some((i) => i.includes(a.type)))) {
    issues.push(a.message);
  }

  // Opportunities
  if (hasCreative && hasCopy && !hasTargeting) {
    opportunities.push("הקמפיין מוכן ברמת התוכן — הגדרת טרגוט תהפוך אותו למוכן לפרסום");
  }
  if (leadCount > 0 && wonLeadCount === 0) {
    opportunities.push(`${leadCount} לידים נכנסו אך אף אחד לא נסגר — יש מקום לשפר את משפך ההמרה`);
  }
  if (leadCount === 0 && (campaign.status === "active" || campaign.status === "scheduled")) {
    opportunities.push("הקמפיין פעיל אך ללא לידים — בדיקת דף נחיתה, טופס ו-CTA יכולה לשפר");
  }
  if (healthScore >= 60 && healthScore < 80) {
    opportunities.push("הקמפיין קרוב לציון מצוין — השלמת פרטים קטנים תעלה את הציון מעל 80");
  }
  if (hasCopy && !hasHeadline) {
    opportunities.push("הוספת כו��רת חדה לטקסט הקיים תשפר משמעותית את שיעור הקליקים");
  }
  if (campaign.campaignType === "lead_gen" && leadCount > 3) {
    opportunities.push("יש מספיק לידים לניתוח — בדיקת איכות הלידים תאפשר אופטימיזציה");
  }

  // Fill if empty
  if (opportunities.length === 0) {
    if (healthScore >= 70) {
      opportunities.push("הקמפיין במצב טוב — ניתן לשפר עם A/B testing על הטקסט");
    } else {
      opportunities.push("השלמת הפרטים החסרים תעלה את ציון הבריאות משמעותית");
    }
  }

  // Actions
  if (!hasCreative) actions.push("העלה קריאייטיב (תמונה או וידאו) לקמפיין");
  if (!hasCopy) actions.push("כתוב טקסט ראשי עם CTA ברור");
  if (!hasTargeting) actions.push("הגדר קהל יעד — מיקום ותחומי עניין");
  if (!hasBudget && campaign.status !== "draft") actions.push("הגדר תקציב לקמפיין");
  if (!hasHeadline && hasCopy) actions.push("הוסף כותרת חדה ומושכת");
  if (campaign.status === "draft" && healthScore >= 50) actions.push("העבר את הקמפיין מטיוטה לסטטוס פעיל");
  if (leadCount > 0 && wonLeadCount === 0) actions.push("בדוק את איכות הלידים ואת תהליך המעקב");

  // Fill if empty
  if (actions.length === 0) {
    actions.push("המשך לעקוב אחרי ביצועי הקמפיין");
    actions.push("בדוק A/B testing על הטקסט או הקריאייטיב");
  }

  // Summary
  let summary: string;
  if (healthScore >= 80) {
    summary = `הקמפיין "${campaign.campaignName || "ללא שם"}" במצב תקין עם ציון בריאות ${healthScore}. ${leadCount > 0 ? `${leadCount} לידים נכנסו.` : ""}`;
  } else if (healthScore >= 50) {
    const mainIssue = issues[0] || "חסרים פרטים";
    summary = `הקמפיין דורש תשומת לב (ציון ${healthScore}). ${mainIssue.split("—")[0].trim()}.`;
  } else {
    summary = `הקמפיין במצב חלש (ציון ${healthScore}) ולא מוכן לפרסום. יש להשלים ${issues.length} פריטים חסרים.`;
  }

  return {
    summary,
    issues: issues.slice(0, 5),
    opportunities: opportunities.slice(0, 4),
    actions: actions.slice(0, 5),
  };
}
