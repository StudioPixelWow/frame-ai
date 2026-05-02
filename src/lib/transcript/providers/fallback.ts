/**
 * FrameAI — Rule-based fallback transcript analyzer.
 *
 * Produces a best-effort TranscriptAnalysis using only local heuristics:
 * word frequency, sentence patterns, and keyword matching.
 * No network calls, no API keys required.
 */

import type {
  TranscriptSegment,
  TranscriptAnalysis,
  TranscriptTone,
  ImportantMoment,
} from "../types";

// ── Stop-words list (English) ─────────────────────────────────────────────────
const STOPWORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any",
  "are","aren't","as","at","be","because","been","before","being","below",
  "between","both","but","by","can't","cannot","could","couldn't","did",
  "didn't","do","does","doesn't","doing","don't","down","during","each","few",
  "for","from","further","get","got","had","hadn't","has","hasn't","have",
  "haven't","having","he","he'd","he'll","he's","her","here","here's","hers",
  "herself","him","himself","his","how","how's","i","i'd","i'll","i'm","i've",
  "if","in","into","is","isn't","it","it's","its","itself","just","know","let",
  "let's","like","ll","me","more","most","mustn't","my","myself","no","nor",
  "not","of","off","on","once","only","or","other","ought","our","ours",
  "ourselves","out","over","own","re","same","shan't","she","she'd","she'll",
  "she's","should","shouldn't","so","some","such","than","that","that's","the",
  "their","theirs","them","themselves","then","there","there's","these","they",
  "they'd","they'll","they're","they've","this","those","through","to","too",
  "under","until","up","us","ve","very","was","wasn't","we","we'd","we'll",
  "we're","we've","were","weren't","what","what's","when","when's","where",
  "where's","which","while","who","who's","whom","why","why's","will","with",
  "won't","would","wouldn't","you","you'd","you'll","you're","you've","your",
  "yours","yourself","yourselves","also","well","really","even","much","many",
  "now","back","still","say","think","going","want","make","way",
]);

// ── Tone heuristics ───────────────────────────────────────────────────────────
const TONE_SIGNALS: Record<string, string[]> = {
  energetic:     ["amazing", "incredible", "fantastic", "absolutely", "love", "excited",
                  "huge", "awesome", "wow", "game-changer", "game changer", "revolutionary"],
  persuasive:    ["must", "need to", "should", "critical", "important", "essential",
                  "key", "remember", "make sure", "don't miss", "you have to"],
  educational:   ["because", "therefore", "this means", "in other words", "for example",
                  "such as", "the reason", "explains", "understand", "learn", "how to"],
  inspirational: ["believe", "dream", "achieve", "possible", "future", "together",
                  "change", "impact", "mission", "vision", "inspire", "potential"],
  professional:  ["ensure", "provide", "implement", "leverage", "optimize", "strategy",
                  "solution", "objective", "framework", "process", "team", "deliver"],
  casual:        ["like", "you know", "kind of", "basically", "pretty much", "stuff",
                  "thing", "guy", "totally", "literally", "honestly"],
};

const TONE_DESCRIPTORS: Record<string, string[]> = {
  energetic:     ["high-energy", "enthusiastic", "dynamic"],
  persuasive:    ["persuasive", "action-oriented", "direct"],
  educational:   ["informative", "explanatory", "structured"],
  inspirational: ["motivating", "visionary", "uplifting"],
  professional:  ["polished", "authoritative", "business-focused"],
  casual:        ["conversational", "approachable", "relaxed"],
  neutral:       ["measured", "balanced", "objective"],
};

// ── Moment-type keyword signals ───────────────────────────────────────────────
const HOOK_SIGNALS = [
  "have you ever", "what if", "imagine", "did you know", "the problem",
  "everyone", "most people", "today i", "in this video", "welcome",
];
const CTA_SIGNALS = [
  "try", "sign up", "subscribe", "visit", "click", "download", "get started",
  "start today", "learn more", "follow", "reach out", "contact", "join",
  "book", "buy", "purchase", "check out",
];
const PROOF_SIGNALS = [
  "%", "percent", "million", "billion", "study", "research", "data",
  "according to", "survey", "report", "statistic", "evidence", "found that",
];
const TRANSITION_SIGNALS = [
  "but", "however", "on the other hand", "now let's", "moving on",
  "next", "finally", "in conclusion", "to summarize", "so",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
    .filter((w) => w.length >= 2);
}

function wordFrequency(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const word of tokenize(text)) {
    if (!STOPWORDS.has(word) && word.length >= 3) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return freq;
}

function topN<T>(entries: [T, number][], n: number): T[] {
  return entries.sort(([, a], [, b]) => b - a).slice(0, n).map(([k]) => k);
}

function sentenceSplit(text: string): string[] {
  return text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

function containsAny(text: string, signals: string[]): boolean {
  const lower = text.toLowerCase();
  return signals.some((s) => lower.includes(s));
}

// ── Summary ───────────────────────────────────────────────────────────────────

function buildSummary(segments: TranscriptSegment[]): string {
  const allText = segments.map((s) => s.text).join(" ");
  const sentences = sentenceSplit(allText);
  if (sentences.length <= 2) return allText.trim();

  // Score each sentence by keyword density (high-freq, non-stopword words)
  const freq = wordFrequency(allText);
  const scored = sentences.map((s) => {
    const words = tokenize(s).filter((w) => !STOPWORDS.has(w));
    const score = words.reduce((acc, w) => acc + (freq.get(w) ?? 0), 0) / Math.max(words.length, 1);
    return { s, score };
  });

  // Always include first sentence (likely intro/hook), then top scoring remainder
  const [first, ...rest] = scored;
  const top = rest.sort((a, b) => b.score - a.score).slice(0, 2);
  const chosen = [first, ...top].sort(
    (a, b) => sentences.indexOf(a.s) - sentences.indexOf(b.s)
  );

  return chosen.map((c) => c.s).join(" ").trim();
}

// ── Key topics ────────────────────────────────────────────────────────────────

function extractKeyTopics(segments: TranscriptSegment[]): string[] {
  const allText = segments.map((s) => s.text).join(" ");

  // Extract bigrams as candidate topics
  const words = tokenize(allText).filter((w) => !STOPWORDS.has(w));
  const bigramFreq = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`;
    bigramFreq.set(bg, (bigramFreq.get(bg) ?? 0) + 1);
  }

  // Top bigrams that appear ≥2 times
  const topBigrams = [...bigramFreq.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([bg]) => bg);

  // Fill with unigrams if needed
  const unigramFreq = wordFrequency(allText);
  const topUnigrams = topN([...unigramFreq.entries()], 6).filter(
    (w) => !topBigrams.some((bg) => bg.includes(w))
  );

  return [...topBigrams, ...topUnigrams].slice(0, 6);
}

// ── Keywords ──────────────────────────────────────────────────────────────────

function extractKeywords(segments: TranscriptSegment[]): string[] {
  const allText = segments.map((s) => s.text).join(" ");
  const freq = wordFrequency(allText);
  // Boost words that appear in multiple segments
  const perSegment = segments.map((s) => new Set(tokenize(s.text)));
  for (const [word, count] of freq) {
    const crossSegment = perSegment.filter((set) => set.has(word)).length;
    if (crossSegment > 1) freq.set(word, count * (1 + crossSegment * 0.2));
  }
  return topN([...freq.entries()], 12);
}

// ── Tone ──────────────────────────────────────────────────────────────────────

function detectTone(segments: TranscriptSegment[]): TranscriptTone {
  const allText = segments.map((s) => s.text).join(" ").toLowerCase();
  const scores: Record<string, number> = {};

  for (const [tone, signals] of Object.entries(TONE_SIGNALS)) {
    scores[tone] = signals.reduce((acc, sig) => {
      // Count occurrences (phrase aware)
      const matches = allText.split(sig).length - 1;
      return acc + matches;
    }, 0);
  }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [[primaryTone, topScore], [, secondScore]] = sorted;
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const confidence = Math.min(0.95, topScore / total + (topScore > secondScore * 1.5 ? 0.1 : 0));

  const primary = (topScore === 0 ? "neutral" : primaryTone) as TranscriptTone["primary"];
  const descriptors = TONE_DESCRIPTORS[primary] ?? TONE_DESCRIPTORS.neutral;

  return { primary, confidence: parseFloat(confidence.toFixed(2)), descriptors };
}

// ── Important moments ─────────────────────────────────────────────────────────

function extractImportantMoments(segments: TranscriptSegment[]): ImportantMoment[] {
  if (segments.length === 0) return [];

  const totalDuration = segments[segments.length - 1].endMs - segments[0].startMs;
  const hookWindow    = segments[0].startMs + totalDuration * 0.18;
  const ctaWindow     = segments[segments.length - 1].endMs - totalDuration * 0.15;

  const moments: ImportantMoment[] = [];

  for (const seg of segments) {
    const lower = seg.text.toLowerCase();
    const inHookZone = seg.startMs <= hookWindow;
    const inCtaZone  = seg.endMs   >= ctaWindow;

    // Hook
    if (inHookZone && (moments.findIndex((m) => m.type === "hook") === -1) &&
        containsAny(lower, HOOK_SIGNALS)) {
      moments.push({
        startMs: seg.startMs, endMs: seg.endMs, text: seg.text,
        reason: "Opening hook — sets the frame for the whole video",
        type: "hook", score: 0.95,
      });
      continue;
    }

    // First segment always treated as hook candidate even without signal words
    if (inHookZone && segments.indexOf(seg) === 0 && moments.findIndex((m) => m.type === "hook") === -1) {
      moments.push({
        startMs: seg.startMs, endMs: seg.endMs, text: seg.text,
        reason: "Opening segment — primary hook window",
        type: "hook", score: 0.88,
      });
      continue;
    }

    // CTA
    if (inCtaZone && containsAny(lower, CTA_SIGNALS)) {
      moments.push({
        startMs: seg.startMs, endMs: seg.endMs, text: seg.text,
        reason: "Call-to-action — drives viewer response",
        type: "cta", score: 0.92,
      });
      continue;
    }

    // Proof point (data / statistics)
    if (containsAny(lower, PROOF_SIGNALS)) {
      moments.push({
        startMs: seg.startMs, endMs: seg.endMs, text: seg.text,
        reason: "Contains quantitative evidence or data reference",
        type: "proof-point", score: 0.78,
      });
      continue;
    }

    // Transition
    if (containsAny(lower, TRANSITION_SIGNALS) && seg.text.length > 30) {
      moments.push({
        startMs: seg.startMs, endMs: seg.endMs, text: seg.text,
        reason: "Structural transition — scene or topic change",
        type: "transition", score: 0.65,
      });
      continue;
    }

    // Key claim (superlatives, strong assertions)
    const hasSuperlative = /\b(best|most|only|first|never|always|every|all)\b/.test(lower);
    const hasStrong      = /\b(guarantee|promise|proven|definitive|the truth)\b/.test(lower);
    if (hasSuperlative || hasStrong) {
      moments.push({
        startMs: seg.startMs, endMs: seg.endMs, text: seg.text,
        reason: "Strong claim or assertion — key editorial beat",
        type: "key-claim", score: 0.80,
      });
    }
  }

  // If nothing found, return first + last segment
  if (moments.length === 0 && segments.length >= 1) {
    const first = segments[0];
    moments.push({ startMs: first.startMs, endMs: first.endMs, text: first.text,
      reason: "Opening segment", type: "hook", score: 0.70 });
    if (segments.length > 1) {
      const last = segments[segments.length - 1];
      moments.push({ startMs: last.startMs, endMs: last.endMs, text: last.text,
        reason: "Closing segment", type: "cta", score: 0.70 });
    }
  }

  // Deduplicate by startMs and sort by score desc
  const seen = new Set<number>();
  return moments
    .filter((m) => { if (seen.has(m.startMs)) return false; seen.add(m.startMs); return true; })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function analyzeWithFallback(segments: TranscriptSegment[]): TranscriptAnalysis {
  if (segments.length === 0) {
    return {
      summary: "No transcript content available.",
      keyTopics: [], keywords: [],
      tone: { primary: "neutral", confidence: 0, descriptors: [] },
      importantMoments: [],
      metadata: {
        analyzedAt: new Date().toISOString(), provider: "fallback",
        wordCount: 0, speakerCount: 0, durationMs: 0, schemaVersion: "1.0",
      },
    };
  }

  const allText   = segments.map((s) => s.text).join(" ");
  const wordCount = allText.trim().split(/\s+/).length;
  const speakers  = new Set(segments.map((s) => s.speaker)).size;
  const durationMs = segments[segments.length - 1].endMs - segments[0].startMs;

  return {
    summary:          buildSummary(segments),
    keyTopics:        extractKeyTopics(segments),
    keywords:         extractKeywords(segments),
    tone:             detectTone(segments),
    importantMoments: extractImportantMoments(segments),
    metadata: {
      analyzedAt:    new Date().toISOString(),
      provider:      "fallback",
      wordCount,
      speakerCount:  speakers,
      durationMs,
      schemaVersion: "1.0",
    },
  };
}
