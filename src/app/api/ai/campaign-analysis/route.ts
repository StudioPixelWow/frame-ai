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

    const hasCreative = !!(campaign.linkedClientFileId || (campaign.externalMediaUrl && campaign.externalMediaUrl.length > 5));
    const hasCopy = !!(campaign.caption && campaign.caption.trim().length > 5);
    const hasHeadline = !!(campaign.notes && campaign.notes.includes("כותרת:"));
    const hasTargeting = !!(campaign.objective && (campaign.objective.includes("מיקום:") || campaign.objective.includes("עניינים:")));

    // Build campaign context for the AI
    const campaignContext = [
      `שם הקמפיין: ${campaign.campaignName || "ללא שם"}`,
      `לקוח: ${clientName || "לא צוין"}${businessField ? ` (${businessField})` : ""}`,
      `פלטפורמה: ${platformName}`,
      `סוג: ${goalName}`,
      `סטטוס: ${statusName}`,
      `תקציב: ${campaign.budget ? `₪${campaign.budget.toLocaleString()}` : "לא הוגדר"}`,
      `תאריכים: ${campaign.startDate || "לא הוגדר"} — ${campaign.endDate || "לא הוגדר"}`,
      `קריאייטיב: ${hasCreative ? "קיים" : "חסר"}`,
      `טקסט ראשי: ${hasCopy ? "קיים" : "חסר"}${hasCopy ? ` ("${campaign.caption!.substring(0, 80)}...")` : ""}`,
      `כותרת: ${hasHeadline ? "קיימת" : "חסרה"}`,
      `טרגוט: ${hasTargeting ? "מוגדר" : "לא מוגדר"}`,
      `מטרת הקמפיין: ${campaign.objective || "לא הוגדרה"}`,
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
      analysis = generateFallbackAnalysis(body);
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
function generateFallbackAnalysis(body: AnalysisRequest): AnalysisResult {
  const { campaign, healthScore, healthBreakdown, alerts, leadCount, wonLeadCount } = body;
  const issues: string[] = [];
  const opportunities: string[] = [];
  const actions: string[] = [];

  const hasCreative = !!(campaign.linkedClientFileId || (campaign.externalMediaUrl && campaign.externalMediaUrl.length > 5));
  const hasCopy = !!(campaign.caption && campaign.caption.trim().length > 5);
  const hasBudget = !!(campaign.budget && campaign.budget > 0);
  const hasTargeting = !!(campaign.objective && (campaign.objective.includes("מיקום:") || campaign.objective.includes("עניינים:")));
  const hasHeadline = !!(campaign.notes && campaign.notes.includes("כותרת:"));

  // Issues
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
