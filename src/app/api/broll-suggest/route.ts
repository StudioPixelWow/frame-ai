/**
 * POST /api/broll-suggest
 *
 * Analyzes transcript segments and generates B-roll keyword suggestions.
 *
 * Body:
 *   { segments: { id: string, text: string, startSec: number, endSec: number }[] }
 *
 * Response:
 *   { suggestions: { segmentId: string, keywords: string[], relevance: number }[] }
 */

import { NextRequest, NextResponse } from "next/server";

/* ── Common B-roll keyword categories ── */
const KEYWORD_CATEGORIES: Record<string, string[]> = {
  business:    ["office", "meeting", "laptop", "handshake", "presentation", "team", "desk"],
  technology:  ["code", "screen", "data", "server", "network", "digital", "software"],
  nature:      ["landscape", "sky", "ocean", "forest", "sunset", "mountain", "flowers"],
  people:      ["crowd", "family", "friends", "portrait", "smiling", "walking", "talking"],
  food:        ["cooking", "restaurant", "kitchen", "meal", "ingredients", "chef"],
  fitness:     ["gym", "running", "yoga", "exercise", "training", "sports"],
  travel:      ["airport", "city", "hotel", "road", "suitcase", "map"],
  education:   ["classroom", "books", "learning", "writing", "school", "lecture"],
};

/* ── Hebrew keyword mappings ── */
const HEBREW_KEYWORDS: Record<string, string[]> = {
  "עבודה": ["business", "office"], "משרד": ["office", "desk"], "פגישה": ["meeting"],
  "צוות": ["team"], "לקוח": ["business", "handshake"], "שיווק": ["presentation", "digital"],
  "טכנולוגיה": ["technology", "digital"], "אפליקציה": ["screen", "software"],
  "עיצוב": ["design", "creative"], "וידאו": ["camera", "filming"],
  "חינוך": ["education", "classroom"], "לימוד": ["learning", "books"],
  "בריאות": ["fitness", "nature"], "ספורט": ["sports", "gym"],
  "אוכל": ["food", "cooking"], "מסעדה": ["restaurant"],
  "טבע": ["nature", "landscape"], "ים": ["ocean"], "הר": ["mountain"],
  "משפחה": ["family"], "חברים": ["friends"],
  "נסיעה": ["travel", "city"], "טיסה": ["airport"],
};

function extractKeywords(text: string): string[] {
  if (!text.trim()) return [];
  const keywords: string[] = [];

  // Check Hebrew keyword mappings
  const words = text.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^\u0590-\u05FFa-zA-Z]/g, "");
    if (HEBREW_KEYWORDS[clean]) {
      keywords.push(...HEBREW_KEYWORDS[clean]);
    }
  }

  // Check English words against categories
  for (const word of words) {
    const lower = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!lower) continue;
    for (const [, categoryWords] of Object.entries(KEYWORD_CATEGORIES)) {
      if (categoryWords.includes(lower)) {
        keywords.push(lower);
      }
    }
  }

  // If we have content but no specific matches, generate generic contextual keywords
  if (keywords.length === 0 && text.length > 5) {
    // Use significant words (>3 chars) as basic keywords
    const significant = words
      .map((w) => w.replace(/[^\u0590-\u05FFa-zA-Z]/g, ""))
      .filter((w) => w.length > 3);
    if (significant.length > 0) {
      keywords.push(significant[0]);
      // Add a generic contextual suggestion
      keywords.push("abstract", "motion");
    }
  }

  return [...new Set(keywords)].slice(0, 5);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { segments } = body as {
      segments: { id: string; text: string; startSec: number; endSec: number }[];
    };

    if (!segments || !Array.isArray(segments)) {
      return NextResponse.json({ error: "segments array is required" }, { status: 400 });
    }

    const suggestions = segments
      .map((seg) => {
        const keywords = extractKeywords(seg.text);
        return {
          segmentId: seg.id,
          keywords,
          relevance: keywords.length > 2 ? 0.9 : keywords.length > 0 ? 0.6 : 0.2,
        };
      })
      .filter((s) => s.keywords.length > 0);

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
