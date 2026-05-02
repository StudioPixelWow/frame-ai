/**
 * POST /api/ai-emphasis
 *
 * Analyzes subtitle segments and returns important words for smart emphasis.
 * Uses OpenAI to identify keywords, emotional words, action words, and punch words.
 *
 * Body: { segments: { id: string, text: string }[], language: string }
 * Returns: { results: { segmentId: string, emphasisWords: string[] }[], debug: {...} }
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiKeys } from "@/lib/db/api-keys";

interface SegmentInput {
  id: string;
  text: string;
}

interface EmphasisResult {
  segmentId: string;
  emphasisWords: string[];
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const { segments, language } = (await req.json()) as {
      segments: SegmentInput[];
      language: string;
    };

    if (!segments || !segments.length) {
      return NextResponse.json({ error: "No segments provided", results: [] }, { status: 400 });
    }

    // Get OpenAI key (merged from both sources)
    const keys = getApiKeys();
    if (!keys.openai) {
      // Fallback: return empty emphasis (sequential mode will be used)
      console.log("[ai-emphasis] No OpenAI key — returning empty emphasis");
      return NextResponse.json({
        results: segments.map(s => ({ segmentId: s.id, emphasisWords: [] })),
        fallback: true,
        debug: { reason: "no_api_key", latencyMs: Date.now() - t0 },
      });
    }

    // Build the prompt — all text in one batch for efficiency
    const segmentTexts = segments.map((s, i) => `[${i}] ${s.text}`).join("\n");

    const systemPrompt = `אתה מנתח שפה ותוכן עבור כתוביות בסרטונים קצרים (TikTok / Reels).
המשימה שלך: לזהות מילים חשובות שצריכות הדגשה ויזואלית בכתוביות.

כללים:
- בחר רק מילים באמת חשובות — לא כל מילה
- סוגי מילים להדגשה:
  • מילות מפתח (keywords) — המילים המרכזיות של המשפט
  • מילות רגש (emotional) — מילים שמעוררות תחושה
  • מילות פעולה (action) — פעלים חזקים
  • מילות אימפקט (punch) — מילים שיוצרות אפקט דרמטי
- בחר 1-3 מילים לכל משפט (לא יותר)
- אל תבחר מילות חיבור, מילות יחס, או מילים שירותיות
- שמור על המילים בדיוק כפי שהן מופיעות בטקסט המקורי
- עבוד בשפת הטקסט (${language === "he" ? "עברית" : language})

פורמט תשובה — JSON בלבד:
{
  "results": [
    { "index": 0, "words": ["מילה1", "מילה2"] },
    { "index": 1, "words": ["מילה3"] }
  ]
}`;

    const userPrompt = `נתח את הכתוביות הבאות ובחר מילים חשובות להדגשה:\n\n${segmentTexts}`;

    console.log(`[ai-emphasis] Analyzing ${segments.length} segments (${segments.reduce((a, s) => a + s.text.split(/\s+/).length, 0)} total words)`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys.openai}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.log(`[ai-emphasis] OpenAI error ${response.status}: ${errText.slice(0, 200)}`);
      return NextResponse.json({
        results: segments.map(s => ({ segmentId: s.id, emphasisWords: [] })),
        fallback: true,
        debug: { error: `OpenAI ${response.status}`, latencyMs: Date.now() - t0 },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      console.log("[ai-emphasis] Empty AI response");
      return NextResponse.json({
        results: segments.map(s => ({ segmentId: s.id, emphasisWords: [] })),
        fallback: true,
        debug: { error: "empty_response", latencyMs: Date.now() - t0 },
      });
    }

    // Parse AI response
    let parsed: { results: { index: number; words: string[] }[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.log(`[ai-emphasis] Failed to parse AI response: ${content.slice(0, 200)}`);
      return NextResponse.json({
        results: segments.map(s => ({ segmentId: s.id, emphasisWords: [] })),
        fallback: true,
        debug: { error: "parse_error", rawContent: content.slice(0, 300), latencyMs: Date.now() - t0 },
      });
    }

    // Map AI results back to segment IDs
    const results: EmphasisResult[] = segments.map((seg, i) => {
      const aiEntry = parsed.results?.find(r => r.index === i);
      const emphasisWords = aiEntry?.words || [];

      // Validate: only keep words that actually exist in the segment text
      const validWords = emphasisWords.filter(w => seg.text.includes(w));

      const totalWords = seg.text.trim().split(/\s+/).length;
      console.log(`[ai-emphasis] seg[${i}]: "${seg.text}" → emphasis: [${validWords.join(", ")}] (${validWords.length}/${totalWords} words)`);

      return {
        segmentId: seg.id,
        emphasisWords: validWords,
      };
    });

    const totalHighlighted = results.reduce((a, r) => a + r.emphasisWords.length, 0);
    const totalWords = segments.reduce((a, s) => a + s.text.trim().split(/\s+/).length, 0);
    const latencyMs = Date.now() - t0;

    console.log(`[ai-emphasis] DONE: ${totalHighlighted}/${totalWords} words highlighted across ${segments.length} segments (${latencyMs}ms)`);

    return NextResponse.json({
      results,
      fallback: false,
      debug: {
        totalSegments: segments.length,
        totalWords,
        totalHighlighted,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[ai-emphasis] ERROR: ${msg}`);
    return NextResponse.json({
      results: [],
      fallback: true,
      debug: { error: msg, latencyMs: Date.now() - t0 },
    }, { status: 500 });
  }
}
