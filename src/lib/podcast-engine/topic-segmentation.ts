/**
 * FrameAI — Topic Segmentation for Podcast Clip Engine
 *
 * Local algorithm that detects topic boundaries in a transcript using
 * sliding-window vocabulary-shift analysis. No AI calls — fully deterministic.
 * All user-facing labels are generated in Hebrew.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A single word-level transcript entry from Whisper or equivalent STT. */
export interface TranscriptSegment {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

/** A detected topic boundary with auto-generated Hebrew label. */
export interface TopicSegment {
  id: string;
  startTime: number;
  endTime: number;
  /** Auto-generated Hebrew label describing the topic. */
  label: string;
  /** Top keywords extracted from this segment. */
  keywords: string[];
  wordCount: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Number of words in each sliding window half. */
const WINDOW_SIZE = 40;

/** Minimum cosine-distance shift to declare a topic boundary. */
const BOUNDARY_THRESHOLD = 0.45;

/** Minimum number of words in a valid topic segment. */
const MIN_SEGMENT_WORDS = 15;

/** Maximum number of keywords to extract per segment. */
const MAX_KEYWORDS = 8;

/** Hebrew stopwords to ignore during vocabulary analysis. */
const STOPWORDS = new Set([
  "של", "את", "על", "עם", "זה", "הוא", "היא", "אני", "לא", "כי",
  "גם", "אם", "או", "מה", "יש", "הם", "הן", "אבל", "כל", "רק",
  "עוד", "כמו", "אחרי", "לפני", "בין", "אל", "מן", "כן", "שם",
  "פה", "כאן", "שלי", "שלו", "שלה", "שלנו", "שלהם", "היה", "היתה",
  "the", "a", "an", "is", "it", "to", "and", "or", "in", "of",
  "for", "that", "this", "was", "are", "be", "but", "not", "you",
  "we", "they", "he", "she", "i", "so", "like", "just", "know",
  "think", "yeah", "um", "uh", "right", "okay", "well",
]);

/** Hebrew label templates keyed by dominant word characteristics. */
const LABEL_TEMPLATES = [
  "דיון בנושא",    // Discussion about
  "הסבר על",       // Explanation of
  "סיפור אישי",    // Personal story
  "ניתוח של",      // Analysis of
  "שיחה על",       // Conversation about
  "תובנות בנושא",  // Insights on
  "סקירה של",      // Overview of
  "העמקה בנושא",   // Deep dive into
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a word: lowercase, strip punctuation. */
function normalise(word: string): string {
  return word.toLowerCase().replace(/[^a-zA-Zא-ת0-9]/g, "");
}

/** Build a term-frequency map for a list of words. */
function buildTfMap(words: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const raw of words) {
    const w = normalise(raw);
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    tf.set(w, (tf.get(w) ?? 0) + 1);
  }
  return tf;
}

/** Cosine distance (1 - cosine similarity) between two TF maps. */
function cosineDistance(a: Map<string, number>, b: Map<string, number>): number {
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const key of allKeys) {
    const va = a.get(key) ?? 0;
    const vb = b.get(key) ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 1;
  return 1 - dot / denom;
}

/** Extract top-N keywords from a set of words by frequency. */
function extractKeywords(words: string[], n: number): string[] {
  const tf = buildTfMap(words);
  return [...tf.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

/** Generate a Hebrew label from keywords. */
function generateHebrewLabel(keywords: string[], index: number): string {
  const template = LABEL_TEMPLATES[index % LABEL_TEMPLATES.length];
  const topKeyword = keywords[0] ?? "כללי";
  return `${template} ${topKeyword}`;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Segment a word-level transcript into topic chunks based on vocabulary shifts.
 *
 * Algorithm:
 * 1. Slide a window across the word list with two halves (left / right).
 * 2. Compute cosine distance between TF vectors of the two halves.
 * 3. Where distance exceeds BOUNDARY_THRESHOLD, mark a topic boundary.
 * 4. Merge segments that are too short into their neighbours.
 * 5. Auto-generate a Hebrew label and keyword list per segment.
 *
 * @param segments  Array of word-level TranscriptSegment entries, in timeline order.
 * @returns         Array of TopicSegment entries covering the full transcript.
 */
export function segmentTranscript(segments: TranscriptSegment[]): TopicSegment[] {
  if (segments.length === 0) return [];

  // If the transcript is too short to segment, return a single topic
  if (segments.length < WINDOW_SIZE * 2) {
    const keywords = extractKeywords(
      segments.map((s) => s.word),
      MAX_KEYWORDS
    );
    return [
      {
        id: "topic_001",
        startTime: segments[0].start,
        endTime: segments[segments.length - 1].end,
        label: generateHebrewLabel(keywords, 0),
        keywords,
        wordCount: segments.length,
      },
    ];
  }

  // ── Step 1: Detect boundary indices ──────────────────────────────────────

  const words = segments.map((s) => s.word);
  const boundaryIndices: number[] = [];

  for (let i = WINDOW_SIZE; i <= words.length - WINDOW_SIZE; i++) {
    const leftWords = words.slice(i - WINDOW_SIZE, i);
    const rightWords = words.slice(i, i + WINDOW_SIZE);
    const leftTf = buildTfMap(leftWords);
    const rightTf = buildTfMap(rightWords);
    const dist = cosineDistance(leftTf, rightTf);

    if (dist >= BOUNDARY_THRESHOLD) {
      // Avoid placing boundaries too close together
      const lastBoundary = boundaryIndices[boundaryIndices.length - 1];
      if (lastBoundary === undefined || i - lastBoundary >= MIN_SEGMENT_WORDS) {
        boundaryIndices.push(i);
      }
    }
  }

  // ── Step 2: Build raw segments from boundaries ───────────────────────────

  const cuts = [0, ...boundaryIndices, segments.length];
  const rawTopics: { startIdx: number; endIdx: number }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    rawTopics.push({ startIdx: cuts[i], endIdx: cuts[i + 1] - 1 });
  }

  // ── Step 3: Merge segments that are too short ────────────────────────────

  const mergedTopics: { startIdx: number; endIdx: number }[] = [];
  for (const topic of rawTopics) {
    const wordCount = topic.endIdx - topic.startIdx + 1;
    if (wordCount < MIN_SEGMENT_WORDS && mergedTopics.length > 0) {
      // Merge into previous segment
      mergedTopics[mergedTopics.length - 1].endIdx = topic.endIdx;
    } else {
      mergedTopics.push({ ...topic });
    }
  }

  // ── Step 4: Build final TopicSegment array ───────────────────────────────

  return mergedTopics.map((topic, idx) => {
    const slice = segments.slice(topic.startIdx, topic.endIdx + 1);
    const topicWords = slice.map((s) => s.word);
    const keywords = extractKeywords(topicWords, MAX_KEYWORDS);
    const padded = String(idx + 1).padStart(3, "0");

    return {
      id: `topic_${padded}`,
      startTime: slice[0].start,
      endTime: slice[slice.length - 1].end,
      label: generateHebrewLabel(keywords, idx),
      keywords,
      wordCount: slice.length,
    };
  });
}
