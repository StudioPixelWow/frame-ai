/**
 * FrameAI — AI Clip Analyzer for Podcast Clip Engine
 *
 * Uses Claude (Anthropic API) to perform deep analysis of transcript segments,
 * identifying the best clip candidates with viral characteristics,
 * audience value estimates, and suggested titles/tags.
 *
 * All user-facing strings (prompts, error messages) are in Hebrew.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { TopicSegment } from "./topic-segmentation";

// ── Types ────────────────────────────────────────────────────────────────────

/** A single AI-suggested clip with reasoning and estimates. */
export interface AIClipSuggestion {
  /** Suggested clip title (Hebrew). */
  title: string;
  /** Start time in seconds. */
  startTime: number;
  /** End time in seconds. */
  endTime: number;
  /** AI reasoning for why this clip was selected (Hebrew). */
  reasoning: string;
  /** Topic tags for categorisation. */
  topicTags: string[];
  /** 0-1 estimate of hook strength. */
  hookStrengthEstimate: number;
  /** 0-1 estimate of viral potential. */
  viralEstimate: number;
  /** 0-1 estimate of audience engagement. */
  engagementEstimate: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4000;

// ── Prompt builder ───────────────────────────────────────────────────────────

function buildAnalysisPrompt(
  transcript: string,
  topicSegments: TopicSegment[],
  businessContext?: string
): string {
  const segmentSummary = topicSegments
    .map(
      (seg) =>
        `[${seg.id}] ${formatTime(seg.startTime)}–${formatTime(seg.endTime)} | ` +
        `מילות מפתח: ${seg.keywords.join(", ")} | ${seg.label} (${seg.wordCount} מילים)`
    )
    .join("\n");

  const contextBlock = businessContext
    ? `\nהקשר עסקי:\n${businessContext}\n`
    : "";

  return `אתה עורך תוכן מומחה המתמחה בחיתוך קליפים ויראליים מפודקאסטים.

נתון לך תמלול של פרק פודקאסט וחלוקה לנושאים. המשימה שלך: לזהות את הקליפים הטובים ביותר.
${contextBlock}
חלוקת נושאים:
${segmentSummary}

תמלול מלא:
---
${transcript}
---

החזר אובייקט JSON תקין בלבד — ללא markdown, ללא הערות, רק JSON.

מבנה JSON נדרש:
{
  "clips": [
    {
      "title": "כותרת קצרה ומשכנעת בעברית",
      "startTime": <מספר בשניות>,
      "endTime": <מספר בשניות>,
      "reasoning": "הסבר קצר בעברית למה הקליפ הזה שווה — מה הופך אותו לתוכן מעניין",
      "topicTags": ["תג1", "תג2"],
      "hookStrengthEstimate": 0.0–1.0,
      "viralEstimate": 0.0–1.0,
      "engagementEstimate": 0.0–1.0
    }
  ]
}

כללים:
- החזר 3–8 קליפים, מדורגים לפי פוטנציאל ויראלי
- כל קליפ חייב להיות בין 30 שניות ל-3 דקות
- העדף קטעים עם פתיחה חזקה (hook) שמושכת תשומת לב מיידית
- חפש רגעים עם עוצמה רגשית, תובנות מפתיעות, או סיפורים אישיים
- הקליפ חייב לעמוד בפני עצמו — להיות מובן ללא הקשר של הפרק המלא
- title, reasoning ו-topicTags חייבים להיות בעברית
- hookStrengthEstimate, viralEstimate, engagementEstimate הם מספרים בין 0 ל-1`;
}

/** Format seconds as MM:SS. */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Response validation ──────────────────────────────────────────────────────

function validateClips(raw: unknown): AIClipSuggestion[] {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("תגובת AI לא תקינה — לא התקבל אובייקט");
  }

  const obj = raw as Record<string, unknown>;
  const clips = obj.clips;

  if (!Array.isArray(clips)) {
    throw new Error("תגובת AI לא תקינה — חסר שדה clips");
  }

  return clips.map((item: unknown, idx: number) => {
    const c = item as Record<string, unknown>;

    if (typeof c.title !== "string" || c.title.length === 0) {
      throw new Error(`קליפ ${idx + 1}: חסרה כותרת`);
    }
    if (typeof c.startTime !== "number" || typeof c.endTime !== "number") {
      throw new Error(`קליפ ${idx + 1}: חסרים זמני התחלה/סיום`);
    }
    if (c.endTime <= c.startTime) {
      throw new Error(`קליפ ${idx + 1}: זמן סיום חייב להיות אחרי זמן התחלה`);
    }

    return {
      title: c.title,
      startTime: c.startTime,
      endTime: c.endTime,
      reasoning: typeof c.reasoning === "string" ? c.reasoning : "",
      topicTags: Array.isArray(c.topicTags) ? c.topicTags.map(String) : [],
      hookStrengthEstimate: clamp01(Number(c.hookStrengthEstimate ?? 0.5)),
      viralEstimate: clamp01(Number(c.viralEstimate ?? 0.5)),
      engagementEstimate: clamp01(Number(c.engagementEstimate ?? 0.5)),
    };
  });
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Analyse a podcast transcript using Claude to identify the best clip candidates.
 *
 * @param transcript       Full episode transcript as plain text.
 * @param topicSegments    Topic segments from the segmentation pass.
 * @param businessContext  Optional business context for relevance scoring
 *                         (e.g. "ערוץ על יזמות טכנולוגית, קהל יעד: מפתחים").
 * @returns                Array of AIClipSuggestion sorted by viral potential.
 */
export async function analyzeTranscriptForClips(
  transcript: string,
  topicSegments: TopicSegment[],
  businessContext?: string
): Promise<AIClipSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("חסר ANTHROPIC_API_KEY — לא ניתן לבצע ניתוח AI");
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildAnalysisPrompt(transcript, topicSegments, businessContext);

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`שגיאה בקריאה ל-API של Anthropic: ${msg}`);
  }

  // Extract text content
  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("תגובת AI לא תקינה — לא התקבל בלוק טקסט");
  }

  // Strip accidental markdown fences
  const jsonText = block.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(
      `תגובת AI לא תקינה — לא ניתן לפרסר JSON: ${jsonText.slice(0, 200)}`
    );
  }

  const clips = validateClips(parsed);

  // Sort by viral estimate descending
  return clips.sort((a, b) => b.viralEstimate - a.viralEstimate);
}
