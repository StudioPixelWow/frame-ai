/**
 * POST /api/effects/analyze
 *
 * AI-powered timeline analysis for automatic transitions & effects.
 * Scans the full edit state (transcript, highlights, B-roll, pacing)
 * and returns effect/transition suggestions with timing and reasoning.
 *
 * Body: {
 *   segments: { id, startSec, endSec, text, highlightWord?, emphasisWords? }[]
 *   brollPlacements: { id, startSec, endSec, keyword }[]
 *   brollEnabled: boolean
 *   transitionStyle: string
 *   language: string
 *   intensity: "subtle" | "balanced" | "dynamic"
 *   videoDurationSec?: number
 * }
 *
 * Returns: {
 *   effects: AiEffectSuggestion[]
 *   transitionStyle: string
 *   debug: { ... }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiKeys } from "@/lib/db/api-keys";

/* ── Types ── */

interface SegmentInput {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  highlightWord?: string;
  highlightStyle?: string;
  emphasisWords?: string[];
}

interface BrollInput {
  id: string;
  startSec: number;
  endSec: number;
  keyword: string;
}

type Intensity = "subtle" | "balanced" | "dynamic";

interface AiEffectSuggestion {
  type: "zoom" | "punchZoom" | "shake" | "fade" | "blur" | "flash" | "slowZoom" | "kenBurns";
  segmentId: string;
  startSec: number;
  endSec: number;
  intensity: number; // 0–100
  reason: string;
  reasonHe: string;
  category: "emphasis" | "transition" | "pacing" | "hook" | "calm";
}

/* ── Local analysis: detect moments from the timeline ── */

interface DetectedMoment {
  segmentId: string;
  startSec: number;
  endSec: number;
  text: string;
  type: "hook" | "emphasis" | "topic_shift" | "broll_entry" | "broll_exit" | "calm" | "strong_phrase" | "pacing_change";
  score: number; // 0–1 importance
  context: string;
}

function detectMoments(
  segments: SegmentInput[],
  brollPlacements: BrollInput[],
  brollEnabled: boolean,
): DetectedMoment[] {
  const moments: DetectedMoment[] = [];
  if (!segments.length) return moments;

  // 1. Hook detection — first 1-3 segments are high-energy hook
  const hookEnd = Math.min(3, segments.length);
  for (let i = 0; i < hookEnd; i++) {
    const s = segments[i];
    moments.push({
      segmentId: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
      type: "hook", score: 1 - i * 0.2,
      context: `Opening hook segment ${i + 1}`,
    });
  }

  // 2. Emphasis word detection — segments with AI emphasis or highlight words
  for (const s of segments) {
    if (s.emphasisWords && s.emphasisWords.length > 0) {
      moments.push({
        segmentId: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
        type: "emphasis", score: Math.min(0.5 + s.emphasisWords.length * 0.15, 0.9),
        context: `AI emphasis: ${s.emphasisWords.join(", ")}`,
      });
    } else if (s.highlightWord) {
      moments.push({
        segmentId: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
        type: "emphasis", score: 0.5,
        context: `Highlight word: ${s.highlightWord}`,
      });
    }
  }

  // 3. B-roll entry/exit detection
  if (brollEnabled && brollPlacements.length > 0) {
    for (const bp of brollPlacements) {
      // Find the segment that contains the broll start
      const entrySeg = segments.find(s => bp.startSec >= s.startSec && bp.startSec <= s.endSec);
      const exitSeg = segments.find(s => bp.endSec >= s.startSec && bp.endSec <= s.endSec);
      if (entrySeg) {
        moments.push({
          segmentId: entrySeg.id, startSec: bp.startSec, endSec: Math.min(bp.startSec + 0.5, bp.endSec),
          text: entrySeg.text, type: "broll_entry", score: 0.65,
          context: `B-roll entry: ${bp.keyword}`,
        });
      }
      if (exitSeg) {
        moments.push({
          segmentId: exitSeg.id, startSec: Math.max(bp.endSec - 0.5, bp.startSec), endSec: bp.endSec,
          text: exitSeg.text, type: "broll_exit", score: 0.55,
          context: `B-roll exit: ${bp.keyword}`,
        });
      }
    }
  }

  // 4. Pacing/gap detection — long gaps between segments = topic shift
  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].startSec - segments[i - 1].endSec;
    if (gap > 1.0) {
      moments.push({
        segmentId: segments[i].id, startSec: segments[i].startSec, endSec: segments[i].endSec,
        text: segments[i].text, type: "topic_shift", score: Math.min(0.4 + gap * 0.1, 0.8),
        context: `Gap of ${gap.toFixed(1)}s before this segment — possible topic shift`,
      });
    }
  }

  // 5. Strong phrase detection — short punchy segments (< 3 words, short duration)
  for (const s of segments) {
    const wordCount = s.text.trim().split(/\s+/).length;
    const duration = s.endSec - s.startSec;
    if (wordCount <= 3 && duration < 2.5) {
      moments.push({
        segmentId: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
        type: "strong_phrase", score: 0.7,
        context: `Short punchy phrase: "${s.text}" (${wordCount} words, ${duration.toFixed(1)}s)`,
      });
    }
  }

  // 6. Calm sections — longer segments with no emphasis, no broll
  for (const s of segments) {
    const duration = s.endSec - s.startSec;
    const hasBroll = brollEnabled && brollPlacements.some(bp => bp.startSec < s.endSec && bp.endSec > s.startSec);
    const hasEmphasis = (s.emphasisWords && s.emphasisWords.length > 0) || !!s.highlightWord;
    if (duration > 4 && !hasBroll && !hasEmphasis) {
      moments.push({
        segmentId: s.id, startSec: s.startSec, endSec: s.endSec, text: s.text,
        type: "calm", score: 0.3,
        context: `Calm section: ${duration.toFixed(1)}s, no emphasis or broll`,
      });
    }
  }

  // Deduplicate by segmentId + type, keeping highest score
  const deduped = new Map<string, DetectedMoment>();
  for (const m of moments) {
    const key = `${m.segmentId}:${m.type}`;
    const existing = deduped.get(key);
    if (!existing || m.score > existing.score) {
      deduped.set(key, m);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.startSec - b.startSec);
}

/* ── Map moments to effect type (rule-based pre-mapping, AI refines) ── */

function momentToEffectHint(m: DetectedMoment): string {
  switch (m.type) {
    case "hook": return "punchZoom or shake — high energy opening";
    case "emphasis": return "punchZoom or zoom — draw attention to important word";
    case "strong_phrase": return "punchZoom or flash — punchy impact";
    case "topic_shift": return "fade or blur — smooth topic transition";
    case "broll_entry": return "fade or blur — smooth B-roll entry";
    case "broll_exit": return "fade — smooth return from B-roll";
    case "calm": return "slowZoom or kenBurns — gentle movement, keep visual interest";
    case "pacing_change": return "zoom or fade — adjust energy";
    default: return "zoom — general emphasis";
  }
}

/* ── Intensity presets ── */

function getIntensityConfig(level: Intensity): { maxEffects: number; baseIntensity: number; hookBoost: number; calmReduction: number } {
  switch (level) {
    case "subtle": return { maxEffects: 5, baseIntensity: 30, hookBoost: 10, calmReduction: 15 };
    case "balanced": return { maxEffects: 8, baseIntensity: 50, hookBoost: 15, calmReduction: 10 };
    case "dynamic": return { maxEffects: 12, baseIntensity: 65, hookBoost: 20, calmReduction: 5 };
  }
}

/* ── Build AI prompt ── */

function buildPrompt(
  moments: DetectedMoment[],
  intensityLevel: Intensity,
  transitionStyle: string,
  language: string,
): { system: string; user: string } {
  const config = getIntensityConfig(intensityLevel);

  const momentList = moments.map((m, i) =>
    `[${i}] time=${m.startSec.toFixed(1)}-${m.endSec.toFixed(1)}s | type=${m.type} | score=${m.score.toFixed(2)} | text="${m.text.substring(0, 60)}" | hint: ${momentToEffectHint(m)}`
  ).join("\n");

  const system = `אתה מנהל פוסט-פרודקשן AI עבור סרטונים קצרים (TikTok, Reels, YouTube Shorts).
המשימה: לבחור אפקטים ויזואליים חכמים למקומות ספציפיים בסרטון.

כללי ברזל:
- סגנון מקצועי, מודרני, social-first — לא ילדותי, לא מוגזם
- מעדיף פחות אפקטים ואיכותיים על הרבה ומוגזמים
- מקסימום ${config.maxEffects} אפקטים לכל הסרטון
- עוצמת בסיס: ${config.baseIntensity}/100
- Hook (פתיח) מקבל עוצמה גבוהה יותר (+${config.hookBoost})
- קטעים רגועים מקבלים עוצמה נמוכה יותר (-${config.calmReduction})
- אין לשים אפקט על כל קטע — רק במקומות שמצדיקים
- סגנון מעבר נבחר: "${transitionStyle}"

אפקטים זמינים:
- zoom: זום הדרגתי פנימה — תחושת פוקוס
- punchZoom: זום מהיר — אימפקט על רגע מרכזי
- shake: רעד קל — אנרגיה ותנועה
- fade: דהייה רכה — אווירה קולנועית
- blur: טשטוש עדין — מיקוד תשומת לב
- flash: הבזק — הדגשת מעבר
- slowZoom: זום + תנועה רכה — דוקומנטרי
- kenBurns: פאן + זום קלאסי — מקצועי

פורמט תשובה — JSON בלבד:
{
  "effects": [
    {
      "momentIndex": 0,
      "type": "punchZoom",
      "intensity": 65,
      "reason": "Strong opening hook — needs visual impact",
      "reasonHe": "פתיח חזק — דורש אימפקט ויזואלי"
    }
  ],
  "suggestedTransition": "fade",
  "reasoning": "Brief overall explanation in Hebrew"
}`;

  const user = `רמת עוצמה: ${intensityLevel}
שפה: ${language}
סגנון מעבר נוכחי: ${transitionStyle}

רגעים שזוהו בסרטון (${moments.length} סה"כ):
${momentList}

נתח את הרגעים ובחר אפקטים מתאימים. זכור: פחות = יותר. בחר רק את הרגעים הכי חשובים.`;

  return { system, user };
}

/* ── POST handler ── */

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  try {
    const body = await req.json();
    const {
      segments = [],
      brollPlacements = [],
      brollEnabled = false,
      transitionStyle = "fade",
      language = "he",
      intensity = "balanced",
      videoDurationSec,
    } = body as {
      segments: SegmentInput[];
      brollPlacements: BrollInput[];
      brollEnabled: boolean;
      transitionStyle: string;
      language: string;
      intensity: Intensity;
      videoDurationSec?: number;
    };

    if (!segments.length) {
      return NextResponse.json({ error: "No segments provided", effects: [] }, { status: 400 });
    }

    // Step 1: Detect moments from the timeline
    const moments = detectMoments(segments, brollPlacements, brollEnabled);
    console.log(`[effects/analyze] Detected ${moments.length} moments from ${segments.length} segments`);

    for (const m of moments) {
      console.log(`  [moment] ${m.type} @${m.startSec.toFixed(1)}-${m.endSec.toFixed(1)}s score=${m.score.toFixed(2)} "${m.text.substring(0, 40)}..." — ${m.context}`);
    }

    // Step 2: Get OpenAI key
    const keys = getApiKeys();
    if (!keys.openai) {
      // Fallback: rule-based mapping without AI
      console.log("[effects/analyze] No OpenAI key — using rule-based fallback");
      const config = getIntensityConfig(intensity);
      const fallbackEffects = ruleFallback(moments, config);
      return NextResponse.json({
        effects: fallbackEffects,
        transitionStyle,
        fallback: true,
        debug: {
          reason: "no_api_key",
          momentsDetected: moments.length,
          effectsGenerated: fallbackEffects.length,
          latencyMs: Date.now() - t0,
        },
      });
    }

    // Step 3: Build AI prompt
    const { system, user } = buildPrompt(moments, intensity, transitionStyle, language);

    console.log(`[effects/analyze] Sending to AI: ${moments.length} moments, intensity=${intensity}`);

    // Step 4: Call OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys.openai}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.log(`[effects/analyze] OpenAI error ${response.status}: ${errText.slice(0, 200)}`);
      const config = getIntensityConfig(intensity);
      const fallbackEffects = ruleFallback(moments, config);
      return NextResponse.json({
        effects: fallbackEffects,
        transitionStyle,
        fallback: true,
        debug: { error: `OpenAI ${response.status}`, latencyMs: Date.now() - t0 },
      });
    }

    // Step 5: Parse AI response
    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      console.log("[effects/analyze] Empty AI response");
      const config = getIntensityConfig(intensity);
      return NextResponse.json({
        effects: ruleFallback(moments, config),
        transitionStyle,
        fallback: true,
        debug: { error: "empty_response", latencyMs: Date.now() - t0 },
      });
    }

    let parsed: {
      effects: { momentIndex: number; type: string; intensity: number; reason: string; reasonHe: string }[];
      suggestedTransition?: string;
      reasoning?: string;
    };

    try {
      parsed = JSON.parse(content);
    } catch {
      console.log(`[effects/analyze] Parse error: ${content.slice(0, 200)}`);
      const config = getIntensityConfig(intensity);
      return NextResponse.json({
        effects: ruleFallback(moments, config),
        transitionStyle,
        fallback: true,
        debug: { error: "parse_error", latencyMs: Date.now() - t0 },
      });
    }

    // Step 6: Map AI results to AiEffectSuggestion[]
    const validTypes = new Set(["zoom", "punchZoom", "shake", "fade", "blur", "flash", "slowZoom", "kenBurns"]);
    const effects: AiEffectSuggestion[] = [];

    for (const aiEffect of (parsed.effects || [])) {
      const moment = moments[aiEffect.momentIndex];
      if (!moment) continue;
      if (!validTypes.has(aiEffect.type)) continue;

      const clampedIntensity = Math.max(10, Math.min(100, aiEffect.intensity));

      effects.push({
        type: aiEffect.type as AiEffectSuggestion["type"],
        segmentId: moment.segmentId,
        startSec: moment.startSec,
        endSec: moment.endSec,
        intensity: clampedIntensity,
        reason: aiEffect.reason || "",
        reasonHe: aiEffect.reasonHe || "",
        category: moment.type === "hook" ? "hook"
          : moment.type === "emphasis" || moment.type === "strong_phrase" ? "emphasis"
          : moment.type === "broll_entry" || moment.type === "broll_exit" || moment.type === "topic_shift" ? "transition"
          : moment.type === "calm" ? "calm"
          : "pacing",
      });

      console.log(`[effects/analyze] AI chose: ${aiEffect.type} @${moment.startSec.toFixed(1)}-${moment.endSec.toFixed(1)}s intensity=${clampedIntensity} — ${aiEffect.reasonHe || aiEffect.reason}`);
    }

    const suggestedTransition = parsed.suggestedTransition || transitionStyle;
    const latencyMs = Date.now() - t0;

    console.log(`[effects/analyze] DONE: ${effects.length} effects, transition="${suggestedTransition}" (${latencyMs}ms)`);
    if (parsed.reasoning) console.log(`[effects/analyze] AI reasoning: ${parsed.reasoning}`);

    return NextResponse.json({
      effects,
      transitionStyle: suggestedTransition,
      reasoning: parsed.reasoning,
      fallback: false,
      debug: {
        momentsDetected: moments.length,
        momentsBreakdown: Object.fromEntries(
          Array.from(new Set(moments.map(m => m.type))).map(t => [t, moments.filter(m => m.type === t).length])
        ),
        effectsGenerated: effects.length,
        intensity,
        latencyMs,
        videoDurationSec: videoDurationSec || (segments.length > 0 ? segments[segments.length - 1].endSec : 0),
        timestamp: new Date().toISOString(),
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[effects/analyze] ERROR: ${msg}`);
    return NextResponse.json({ effects: [], error: msg, debug: { latencyMs: Date.now() - t0 } }, { status: 500 });
  }
}

/* ── Rule-based fallback (no AI key) ── */

function ruleFallback(
  moments: DetectedMoment[],
  config: { maxEffects: number; baseIntensity: number; hookBoost: number; calmReduction: number },
): AiEffectSuggestion[] {
  // Sort by score desc, take top N
  const top = [...moments]
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxEffects);

  return top.map(m => {
    let type: AiEffectSuggestion["type"];
    let intensityAdj = 0;

    switch (m.type) {
      case "hook":
        type = "punchZoom";
        intensityAdj = config.hookBoost;
        break;
      case "emphasis":
      case "strong_phrase":
        type = "punchZoom";
        break;
      case "topic_shift":
        type = "fade";
        break;
      case "broll_entry":
        type = "blur";
        break;
      case "broll_exit":
        type = "fade";
        break;
      case "calm":
        type = "slowZoom";
        intensityAdj = -config.calmReduction;
        break;
      default:
        type = "zoom";
    }

    return {
      type,
      segmentId: m.segmentId,
      startSec: m.startSec,
      endSec: m.endSec,
      intensity: Math.max(15, Math.min(100, config.baseIntensity + intensityAdj)),
      reason: m.context,
      reasonHe: m.context,
      category: m.type === "hook" ? "hook" as const
        : m.type === "emphasis" || m.type === "strong_phrase" ? "emphasis" as const
        : m.type === "broll_entry" || m.type === "broll_exit" || m.type === "topic_shift" ? "transition" as const
        : m.type === "calm" ? "calm" as const
        : "pacing" as const,
    };
  });
}
