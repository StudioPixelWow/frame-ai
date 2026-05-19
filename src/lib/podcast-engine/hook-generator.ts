/**
 * FrameAI — AI Hook Generator for Podcast Clip Engine
 *
 * Generates content packaging for clips: opening hooks, title variations,
 * captions, CTAs, and hashtags using Claude.
 * Primary language: Hebrew.
 */

import Anthropic from "@anthropic-ai/sdk";

// ── Types ────────────────────────────────────────────────────────────────────

/** Complete content package for a single clip. */
export interface HookPackage {
  /** Opening hook text (2-5 seconds of screen text). */
  hookText: string;
  /** Three title variations: [descriptive, curiosity, bold]. */
  titles: [string, string, string];
  /** Full caption with engagement prompt. */
  caption: string;
  /** Platform-specific call-to-action. */
  cta: string;
  /** Relevant hashtags (without # prefix). */
  hashtags: string[];
  /** ISO timestamp of generation. */
  generatedAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2000;

/** Platform-specific CTA instructions in Hebrew. */
const PLATFORM_CTA_HINTS: Record<string, string> = {
  youtube:   "הנעה לפעולה מותאמת ליוטיוב — עודד צפייה בפרק המלא, לייק ומנוי",
  instagram: "הנעה לפעולה מותאמת לאינסטגרם — עודד שמירה, שיתוף בסטורי ועוקב",
  tiktok:    "הנעה לפעולה מותאמת לטיקטוק — קצר, ישיר, עודד תגובה ושיתוף",
  twitter:   "הנעה לפעולה מותאמת לטוויטר — עודד ריטוויט, ציטוט ותגובה",
  linkedin:  "הנעה לפעולה מותאמת ללינקדאין — מקצועי, עודד תגובה ושיתוף מחשבות",
  general:   "הנעה לפעולה כללית — עודד מעורבות, שיתוף וצפייה בתוכן נוסף",
};

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildHookPrompt(
  clipTranscript: string,
  clipTitle: string,
  topicTags: string[],
  platform: string
): string {
  const ctaHint = PLATFORM_CTA_HINTS[platform] ?? PLATFORM_CTA_HINTS.general;
  const tagsStr = topicTags.join(", ");

  return `אתה קופירייטר מומחה לתוכן ויראלי ברשתות החברתיות. המשימה שלך: ליצור חבילת תוכן שיווקית לקליפ מפודקאסט.

כותרת הקליפ: ${clipTitle}
תגי נושא: ${tagsStr}
פלטפורמה: ${platform}

תמלול הקליפ:
---
${clipTranscript}
---

החזר אובייקט JSON תקין בלבד — ללא markdown, ללא הערות, רק JSON.

מבנה JSON נדרש:
{
  "hookText": "טקסט פתיחה קצר וחד (2-5 שניות קריאה) שמושך תשומת לב מיידית",
  "titles": [
    "כותרת תיאורית — מסבירה מה בקליפ",
    "כותרת סקרנות — יוצרת רצון לצפות",
    "כותרת נועזת — מעזה, מפתיעה, פרובוקטיבית"
  ],
  "caption": "קאפשן מלא עם שאלה שמעודדת תגובות ומעורבות. 2-4 משפטים.",
  "cta": "הנעה לפעולה קצרה ומדויקת",
  "hashtags": ["תג1", "תג2", "תג3", "תג4", "תג5"]
}

כללים:
- הכל בעברית
- hookText: משפט אחד חד וקצר, מעורר סקרנות או הזדהות
- titles: בדיוק 3 וריאציות — תיאורית, סקרנות, נועזת
- caption: 2-4 משפטים, כולל שאלה פתוחה לקהל
- ${ctaHint}
- hashtags: 4-8 תגים רלוונטיים בעברית (ללא #)
- אל תמציא עובדות — התבסס רק על תמלול הקליפ`;
}

function buildThumbnailPrompt(clipTitle: string, hookText: string): string {
  return `אתה מעצב תמונות ממוזערות (thumbnails) לסרטונים.

כותרת הקליפ: ${clipTitle}
הוק: ${hookText}

החזר אובייקט JSON תקין בלבד:
{
  "thumbnailText": "טקסט של עד 5 מילים בעברית לתמונה ממוזערת"
}

כללים:
- מקסימום 5 מילים בעברית
- קצר, חד, קורא לצפייה
- אל תכלול סימני פיסוק מיותרים`;
}

// ── Response validation ──────────────────────────────────────────────────────

function validateHookPackage(raw: unknown): Omit<HookPackage, "generatedAt"> {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("תגובת AI לא תקינה — לא התקבל אובייקט");
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.hookText !== "string" || obj.hookText.length === 0) {
    throw new Error("חסר hookText בתגובת AI");
  }

  if (!Array.isArray(obj.titles) || obj.titles.length < 3) {
    throw new Error("חסרות כותרות — נדרשות בדיוק 3 וריאציות");
  }

  if (typeof obj.caption !== "string" || obj.caption.length === 0) {
    throw new Error("חסר caption בתגובת AI");
  }

  if (typeof obj.cta !== "string" || obj.cta.length === 0) {
    throw new Error("חסר cta בתגובת AI");
  }

  const hashtags = Array.isArray(obj.hashtags) ? obj.hashtags.map(String) : [];

  return {
    hookText: obj.hookText,
    titles: [
      String(obj.titles[0]),
      String(obj.titles[1]),
      String(obj.titles[2]),
    ],
    caption: obj.caption,
    cta: obj.cta,
    hashtags,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function callClaude(prompt: string): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("חסר ANTHROPIC_API_KEY — לא ניתן לייצר תוכן");
  }

  const client = new Anthropic({ apiKey });

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

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("תגובת AI לא תקינה — לא התקבל בלוק טקסט");
  }

  const jsonText = block.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error(
      `תגובת AI לא תקינה — לא ניתן לפרסר JSON: ${jsonText.slice(0, 200)}`
    );
  }
}

// ── Main exports ─────────────────────────────────────────────────────────────

/**
 * Generate a complete content package for a podcast clip.
 *
 * Produces: opening hook, 3 title variations (descriptive / curiosity / bold),
 * full caption with engagement prompt, platform-specific CTA, and hashtags.
 *
 * @param clipTranscript  Full transcript text of the clip.
 * @param clipTitle       Working title for the clip.
 * @param topicTags       Topic tags for context.
 * @param platform        Target platform (youtube/instagram/tiktok/twitter/linkedin).
 *                        Defaults to "general".
 * @returns               Complete HookPackage with all content elements.
 */
export async function generateHookPackage(
  clipTranscript: string,
  clipTitle: string,
  topicTags: string[],
  platform: string = "general"
): Promise<HookPackage> {
  if (!clipTranscript.trim()) {
    throw new Error("שגיאה: תמלול הקליפ ריק");
  }

  const prompt = buildHookPrompt(clipTranscript, clipTitle, topicTags, platform);
  const raw = await callClaude(prompt);
  const validated = validateHookPackage(raw);

  return {
    ...validated,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate short thumbnail text for a clip (max 5 words).
 *
 * @param clipTitle  Working title for the clip.
 * @param hookText   Hook text for additional context.
 * @returns          Short Hebrew text suitable for video thumbnail overlay.
 */
export async function generateThumbnailText(
  clipTitle: string,
  hookText: string
): Promise<string> {
  const prompt = buildThumbnailPrompt(clipTitle, hookText);
  const raw = await callClaude(prompt);

  if (typeof raw !== "object" || raw === null) {
    throw new Error("תגובת AI לא תקינה — לא התקבל אובייקט");
  }

  const obj = raw as Record<string, unknown>;
  const text = typeof obj.thumbnailText === "string" ? obj.thumbnailText : "";

  if (!text) {
    throw new Error("חסר thumbnailText בתגובת AI");
  }

  // Enforce 5-word limit
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(0, 5).join(" ");
}
