/**
 * PixelManageAI — Creative Instructions Interpreter
 * Parses natural language creative prompts into render configuration.
 */

import type { ParsedCreativeConfig, CreativeInstructions } from "./types";

const PACING_KEYWORDS: Record<string, string[]> = {
  slow: ["איטי", "רגוע", "שקט", "slow", "calm", "relaxed", "gentle"],
  moderate: ["מאוזן", "רגיל", "moderate", "balanced", "normal"],
  fast: ["מהיר", "אנרגטי", "דינמי", "fast", "energetic", "dynamic", "quick"],
  aggressive: ["אגרסיבי", "חזק", "פצצה", "aggressive", "powerful", "intense"],
};

const TONE_KEYWORDS: Record<string, string[]> = {
  professional: ["מקצועי", "רשמי", "עסקי", "professional", "formal", "corporate", "business"],
  casual: ["קליל", "חברי", "casual", "friendly", "laid-back"],
  energetic: ["אנרגטי", "חי", "שמח", "energetic", "upbeat", "cheerful"],
  emotional: ["רגשי", "מרגש", "עמוק", "emotional", "touching", "deep", "heartfelt"],
  humorous: ["מצחיק", "הומוריסטי", "קומי", "funny", "humorous", "comedic"],
};

const BROLL_KEYWORDS: Record<string, string[]> = {
  none: ["ללא", "בלי", "none", "no broll", "talking head"],
  sparse: ["מעט", "קצת", "sparse", "minimal", "few"],
  moderate: ["בינוני", "moderate", "some"],
  frequent: ["הרבה", "מלא", "frequent", "lots", "plenty"],
};

function detectKeywords(text: string, map: Record<string, string[]>): string | null {
  const lower = text.toLowerCase();
  for (const [key, words] of Object.entries(map)) {
    if (words.some(w => lower.includes(w))) return key;
  }
  return null;
}

function extractKeyMessages(text: string): string[] {
  const sentences = text.split(/[.\!?。]\s*/).filter(s => s.trim().length > 10);
  // Look for keywords indicating a message
  return sentences
    .filter(s => /מסר|חשוב|מרכזי|message|key|main|focus|emphasize/i.test(s))
    .slice(0, 5)
    .map(s => s.trim());
}

export function parseCreativeInstructions(rawPrompt: string): CreativeInstructions {
  const parsedConfig: ParsedCreativeConfig = {
    pacing: detectKeywords(rawPrompt, PACING_KEYWORDS) as ParsedCreativeConfig["pacing"],
    tone: detectKeywords(rawPrompt, TONE_KEYWORDS) as ParsedCreativeConfig["tone"],
    cutIntensity: null,
    brollFrequency: detectKeywords(rawPrompt, BROLL_KEYWORDS) as ParsedCreativeConfig["brollFrequency"],
    subtitleEmphasis: null,
    overallMood: null,
    targetAudience: null,
    keyMessages: extractKeyMessages(rawPrompt),
  };

  // Infer cut intensity from pacing
  if (parsedConfig.pacing === "aggressive") parsedConfig.cutIntensity = 85;
  else if (parsedConfig.pacing === "fast") parsedConfig.cutIntensity = 65;
  else if (parsedConfig.pacing === "moderate") parsedConfig.cutIntensity = 40;
  else if (parsedConfig.pacing === "slow") parsedConfig.cutIntensity = 20;

  // Infer subtitle emphasis from tone
  if (parsedConfig.tone === "energetic" || parsedConfig.tone === "humorous") parsedConfig.subtitleEmphasis = "heavy";
  else if (parsedConfig.tone === "professional") parsedConfig.subtitleEmphasis = "minimal";
  else parsedConfig.subtitleEmphasis = "standard";

  // Extract target audience
  const audienceMatch = rawPrompt.match(/(?:קהל|audience|target)[:\s]+([^,.]+)/i);
  if (audienceMatch) parsedConfig.targetAudience = audienceMatch[1].trim();

  // Overall mood
  const moodMatch = rawPrompt.match(/(?:מצב רוח|אווירה|mood|vibe|feel)[:\s]+([^,.]+)/i);
  if (moodMatch) parsedConfig.overallMood = moodMatch[1].trim();

  return { rawPrompt, parsedConfig };
}
