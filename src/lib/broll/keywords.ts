/**
 * FrameAI — B-roll keyword extraction.
 *
 * Three pure functions, one per keyword category.
 * All functions are deterministic — same text always yields the same keywords.
 *
 * Approach:
 *  1. Strip stop words and low-signal words from the segment text
 *  2. Match remaining tokens against weighted signal dictionaries
 *  3. Return the top-N terms sorted by weight descending
 *
 * No NLP library required. Uses curated dictionaries calibrated for
 * stock footage and commercial video contexts.
 */

// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","be","been","being","have","has","had","do",
  "does","did","will","would","could","should","may","might","shall",
  "that","this","these","those","it","its","i","we","you","they","he",
  "she","as","by","from","into","through","over","under","about","between",
  "not","no","so","just","then","than","when","where","which","who","how",
  "what","there","their","them","all","also","even","still","really","very",
  "one","two","three","more","most","some","any","each","every","both",
  "here","like","get","got","let","can","now","our","your","my","his","her",
  "if","out","up","down","off","back","way","much","many","well","good",
  "make","made","need","use","used","come","came","go","went","say","said",
  "know","think","look","see","want","give","take","time","year","day",
]);

// ─── Visual noun dictionary ───────────────────────────────────────────────────
// Maps content words → canonical stock-search visual term + weight.
// Weight reflects how "camera-able" the concept is (0.1 = weak, 1.0 = strong).

const VISUAL_SIGNALS: Record<string, { term: string; weight: number }> = {
  // People & roles
  "team":          { term: "team",                     weight: 0.9 },
  "teams":         { term: "team",                     weight: 0.9 },
  "people":        { term: "people",                   weight: 0.8 },
  "person":        { term: "person",                   weight: 0.8 },
  "professional":  { term: "business professional",    weight: 1.0 },
  "professionals": { term: "business professional",    weight: 1.0 },
  "leader":        { term: "leader",                   weight: 0.9 },
  "leaders":       { term: "leader",                   weight: 0.9 },
  "manager":       { term: "manager",                  weight: 0.8 },
  "employee":      { term: "employee working",         weight: 0.8 },
  "employees":     { term: "employee working",         weight: 0.8 },
  "client":        { term: "client meeting",           weight: 0.9 },
  "clients":       { term: "client meeting",           weight: 0.9 },
  "customer":      { term: "customer",                 weight: 0.8 },
  "customers":     { term: "customer",                 weight: 0.8 },
  "founder":       { term: "entrepreneur startup",     weight: 0.9 },
  "entrepreneur":  { term: "entrepreneur",             weight: 0.9 },
  "speaker":       { term: "speaker presenting",       weight: 0.9 },
  "audience":      { term: "audience listening",       weight: 0.9 },
  "developer":     { term: "developer coding",         weight: 1.0 },
  "designer":      { term: "designer working",         weight: 1.0 },

  // Tech & digital
  "laptop":        { term: "laptop",                   weight: 1.0 },
  "computer":      { term: "computer screen",          weight: 1.0 },
  "screen":        { term: "computer screen",          weight: 0.9 },
  "phone":         { term: "smartphone",               weight: 0.9 },
  "smartphone":    { term: "smartphone",               weight: 1.0 },
  "tablet":        { term: "tablet device",            weight: 0.9 },
  "code":          { term: "code editor screen",       weight: 1.0 },
  "coding":        { term: "coding programming",       weight: 1.0 },
  "software":      { term: "software interface",       weight: 0.8 },
  "app":           { term: "mobile app",               weight: 0.8 },
  "data":          { term: "data dashboard",           weight: 0.9 },
  "dashboard":     { term: "analytics dashboard",      weight: 1.0 },
  "analytics":     { term: "analytics chart",          weight: 0.9 },
  "ai":            { term: "artificial intelligence",  weight: 0.9 },
  "algorithm":     { term: "data visualization",       weight: 0.8 },
  "automation":    { term: "automation workflow",      weight: 0.9 },
  "platform":      { term: "software platform",        weight: 0.7 },
  "tool":          { term: "professional tool",        weight: 0.6 },

  // Business & workspace
  "office":        { term: "modern office",            weight: 1.0 },
  "meeting":       { term: "business meeting",         weight: 1.0 },
  "conference":    { term: "conference room meeting",  weight: 1.0 },
  "boardroom":     { term: "boardroom",                weight: 1.0 },
  "desk":          { term: "desk workspace",           weight: 0.9 },
  "workspace":     { term: "creative workspace",       weight: 0.9 },
  "startup":       { term: "startup office",           weight: 1.0 },
  "presentation":  { term: "business presentation",   weight: 1.0 },
  "whiteboard":    { term: "whiteboard brainstorm",    weight: 1.0 },
  "chart":         { term: "business chart",           weight: 0.9 },
  "graph":         { term: "graph growth",             weight: 0.9 },
  "revenue":       { term: "revenue growth chart",     weight: 0.9 },
  "profit":        { term: "financial growth",         weight: 0.8 },
  "growth":        { term: "growth chart upward",      weight: 0.9 },
  "strategy":      { term: "strategy planning",        weight: 0.9 },
  "plan":          { term: "planning whiteboard",      weight: 0.8 },
  "contract":      { term: "contract signing",         weight: 1.0 },
  "deal":          { term: "handshake deal",           weight: 1.0 },
  "handshake":     { term: "handshake",                weight: 1.0 },
  "partnership":   { term: "business partnership",     weight: 0.9 },
  "brand":         { term: "brand identity",           weight: 0.7 },
  "marketing":     { term: "marketing team",           weight: 0.8 },
  "campaign":      { term: "marketing campaign",       weight: 0.8 },
  "budget":        { term: "financial planning",       weight: 0.7 },
  "investment":    { term: "investment finance",       weight: 0.8 },

  // Content & media
  "video":         { term: "video production",         weight: 0.9 },
  "camera":        { term: "camera filming",           weight: 1.0 },
  "film":          { term: "film production",          weight: 0.9 },
  "editing":       { term: "video editing",            weight: 1.0 },
  "content":       { term: "content creation",         weight: 0.8 },
  "podcast":       { term: "podcast recording",        weight: 1.0 },
  "studio":        { term: "recording studio",         weight: 1.0 },
  "microphone":    { term: "microphone recording",     weight: 1.0 },

  // People states & situations
  "leadership":    { term: "leader speaking team",     weight: 0.9 },
  "collaboration": { term: "team collaboration",       weight: 1.0 },
  "innovation":    { term: "innovation brainstorm",    weight: 0.8 },
  "success":       { term: "success celebration",      weight: 0.9 },
  "failure":       { term: "person frustrated",        weight: 0.8 },
  "challenge":     { term: "challenge obstacle",       weight: 0.7 },
  "transformation": { term: "before after transformation", weight: 0.8 },
  "community":     { term: "diverse community group",  weight: 0.9 },

  // Environments
  "city":          { term: "city skyline",             weight: 0.9 },
  "urban":         { term: "urban city street",        weight: 0.9 },
  "remote":        { term: "remote work home office",  weight: 1.0 },
  "home":          { term: "home office",              weight: 0.9 },
  "café":          { term: "café working",             weight: 0.8 },
  "cafe":          { term: "café working",             weight: 0.8 },
  "outdoor":       { term: "outdoor natural",          weight: 0.7 },
  "nature":        { term: "nature landscape",         weight: 0.8 },

  // Products & physical objects
  "product":       { term: "product showcase",         weight: 0.9 },
  "prototype":     { term: "product prototype",        weight: 1.0 },
  "packaging":     { term: "product packaging",        weight: 1.0 },
  "document":      { term: "document paperwork",       weight: 0.7 },
  "report":        { term: "report document",          weight: 0.7 },
  "money":         { term: "money finance",            weight: 0.8 },
  "coffee":        { term: "coffee cup desk",          weight: 0.7 },
};

// ─── Action (verb) dictionary ─────────────────────────────────────────────────
// Maps verbs and verb phrases → stock-searchable activity descriptions.

const ACTION_SIGNALS: Record<string, { term: string; weight: number }> = {
  // Communication
  "talking":       { term: "talking conversation",     weight: 0.9 },
  "speaking":      { term: "speaking presenting",      weight: 1.0 },
  "presenting":    { term: "presenting audience",      weight: 1.0 },
  "explaining":    { term: "explaining whiteboard",    weight: 0.9 },
  "discussing":    { term: "team discussion",          weight: 0.9 },
  "interviewing":  { term: "interview",                weight: 1.0 },
  "listening":     { term: "active listening",         weight: 0.8 },
  "pitching":      { term: "pitch presentation",       weight: 1.0 },
  "negotiating":   { term: "negotiation meeting",      weight: 0.9 },
  "collaborating": { term: "team collaborating",       weight: 1.0 },
  "brainstorming": { term: "brainstorm whiteboard",    weight: 1.0 },
  "teaching":      { term: "teaching workshop",        weight: 1.0 },
  "coaching":      { term: "coaching mentoring",       weight: 1.0 },
  "mentoring":     { term: "mentoring guidance",       weight: 0.9 },

  // Digital / technical
  "typing":        { term: "typing laptop",            weight: 1.0 },
  "coding":        { term: "coding computer",          weight: 1.0 },
  "programming":   { term: "programming code",         weight: 1.0 },
  "building":      { term: "building creating",        weight: 0.8 },
  "designing":     { term: "designing screen",         weight: 1.0 },
  "editing":       { term: "editing timeline",         weight: 1.0 },
  "recording":     { term: "recording studio",         weight: 1.0 },
  "streaming":     { term: "live stream",              weight: 0.9 },
  "testing":       { term: "software testing",         weight: 0.8 },
  "launching":     { term: "product launch",           weight: 0.9 },
  "deploying":     { term: "deployment server",        weight: 0.7 },
  "automating":    { term: "automation workflow",      weight: 0.8 },

  // Business actions
  "signing":       { term: "signing contract",         weight: 1.0 },
  "meeting":       { term: "business meeting",         weight: 1.0 },
  "planning":      { term: "strategic planning",       weight: 0.9 },
  "analysing":     { term: "data analysis",            weight: 0.9 },
  "analyzing":     { term: "data analysis",            weight: 0.9 },
  "reviewing":     { term: "reviewing document",       weight: 0.8 },
  "investing":     { term: "investment planning",      weight: 0.8 },
  "growing":       { term: "business growth",          weight: 0.8 },
  "scaling":       { term: "scaling business",         weight: 0.8 },
  "selling":       { term: "sales conversation",       weight: 0.9 },
  "marketing":     { term: "marketing planning",       weight: 0.8 },
  "hiring":        { term: "hiring interview",         weight: 0.9 },
  "onboarding":    { term: "onboarding training",      weight: 0.9 },
  "shipping":      { term: "shipping logistics",       weight: 0.9 },
  "delivering":    { term: "delivery service",         weight: 0.8 },

  // Physical / lifestyle
  "walking":       { term: "walking city",             weight: 0.7 },
  "running":       { term: "running motion",           weight: 0.8 },
  "working":       { term: "working professional",     weight: 0.9 },
  "commuting":     { term: "commuting transportation", weight: 0.8 },
  "travelling":    { term: "travel business",          weight: 0.8 },
  "traveling":     { term: "travel business",          weight: 0.8 },
  "celebrating":   { term: "team celebration success", weight: 1.0 },
  "struggling":    { term: "person frustrated stress", weight: 0.9 },
  "thinking":      { term: "thinking contemplating",   weight: 0.8 },
  "reading":       { term: "reading document",         weight: 0.7 },
  "writing":       { term: "writing notes",            weight: 0.8 },
  "creating":      { term: "creative process",         weight: 0.8 },
};

// ─── Mood / atmosphere dictionary ────────────────────────────────────────────
// Maps emotional and descriptive words → cinematographic mood terms.

const MOOD_SIGNALS: Record<string, { term: string; weight: number }> = {
  // Positive energy
  "excited":       { term: "energetic dynamic",        weight: 0.9 },
  "thrilled":      { term: "energetic joyful",         weight: 0.9 },
  "passionate":    { term: "passionate intense",       weight: 0.9 },
  "confident":     { term: "confident composed",       weight: 1.0 },
  "energetic":     { term: "energetic fast-paced",     weight: 1.0 },
  "motivated":     { term: "motivated purposeful",     weight: 0.9 },
  "inspired":      { term: "inspired uplifting",       weight: 0.9 },
  "proud":         { term: "pride achievement",        weight: 0.9 },
  "happy":         { term: "happy positive",           weight: 0.8 },
  "joy":           { term: "joyful bright",            weight: 0.8 },
  "grateful":      { term: "warm grateful",            weight: 0.7 },

  // Professional / premium
  "professional":  { term: "professional polished",    weight: 1.0 },
  "premium":       { term: "premium luxury",           weight: 1.0 },
  "exclusive":     { term: "exclusive premium",        weight: 1.0 },
  "sophisticated": { term: "sophisticated elegant",    weight: 1.0 },
  "clean":         { term: "clean minimal",            weight: 0.9 },
  "minimal":       { term: "minimal clean",            weight: 0.9 },
  "polished":      { term: "polished professional",    weight: 1.0 },
  "credible":      { term: "authoritative credible",   weight: 0.8 },
  "trustworthy":   { term: "trustworthy warm",         weight: 0.8 },
  "authoritative": { term: "authoritative confident",  weight: 0.9 },

  // Tension / challenge
  "struggle":      { term: "stress frustrated",        weight: 0.9 },
  "struggling":    { term: "stress challenge",         weight: 0.9 },
  "difficult":     { term: "challenging tense",        weight: 0.7 },
  "fear":          { term: "anxious uncertain",        weight: 0.8 },
  "worried":       { term: "worried concerned",        weight: 0.8 },
  "frustrated":    { term: "frustrated tense",         weight: 0.9 },
  "overwhelmed":   { term: "overwhelmed stressed",     weight: 0.9 },
  "crisis":        { term: "crisis urgent",            weight: 0.9 },
  "urgent":        { term: "urgent fast-paced",        weight: 0.8 },

  // Cinematic atmosphere
  "innovative":    { term: "innovative futuristic",    weight: 0.9 },
  "modern":        { term: "modern contemporary",      weight: 0.9 },
  "dynamic":       { term: "dynamic motion",           weight: 1.0 },
  "bold":          { term: "bold dramatic",            weight: 0.9 },
  "authentic":     { term: "authentic candid",         weight: 0.9 },
  "intimate":      { term: "intimate close-up",        weight: 0.8 },
  "cinematic":     { term: "cinematic dramatic",       weight: 1.0 },
  "inspiring":     { term: "inspiring uplifting",      weight: 0.9 },
  "warm":          { term: "warm golden",              weight: 0.8 },
  "cool":          { term: "cool blue toned",          weight: 0.7 },
  "dark":          { term: "dark moody",               weight: 0.8 },
  "bright":        { term: "bright cheerful",          weight: 0.8 },
  "natural":       { term: "natural authentic",        weight: 0.8 },
};

// ─── Tone → default mood keywords ────────────────────────────────────────────
// When no mood signals fire from the text, fall back to tone-based defaults.

export const TONE_MOOD_DEFAULTS: Record<string, string[]> = {
  energetic:     ["energetic fast-paced", "dynamic motion"],
  persuasive:    ["confident composed",   "professional polished"],
  educational:   ["clean minimal",        "natural authentic"],
  inspirational: ["inspiring uplifting",  "warm golden"],
  professional:  ["professional polished","authoritative confident"],
  casual:        ["authentic candid",     "warm natural"],
};

// ─── Extraction functions ─────────────────────────────────────────────────────

/** Normalise text to lowercase tokens, strip punctuation. */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/** Also try two-word bigrams (for compound terms like "team meeting"). */
function bigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

type Entry = { term: string; weight: number };

function matchSignals(
  tokens: string[],
  dictionary: Record<string, Entry>
): Array<{ term: string; weight: number }> {
  const seen  = new Map<string, number>(); // term → best weight
  const grams = [...tokens, ...bigrams(tokens)];

  for (const gram of grams) {
    const entry = dictionary[gram];
    if (entry) {
      const prev = seen.get(entry.term) ?? 0;
      if (entry.weight > prev) seen.set(entry.term, entry.weight);
    }
  }

  return Array.from(seen.entries())
    .map(([term, weight]) => ({ term, weight }))
    .sort((a, b) => b.weight - a.weight);
}

/** Return top-N visual keywords from a segment text. */
export function extractVisualKeywords(text: string, max = 6): string[] {
  const tokens  = tokenise(text);
  const matches = matchSignals(tokens, VISUAL_SIGNALS);
  return matches.slice(0, max).map(m => m.term);
}

/** Return top-N action keywords from a segment text. */
export function extractActionKeywords(text: string, max = 4): string[] {
  const tokens  = tokenise(text);
  const matches = matchSignals(tokens, ACTION_SIGNALS);
  return matches.slice(0, max).map(m => m.term);
}

/** Return top-N mood keywords from a segment text. */
export function extractMoodKeywords(
  text: string,
  tone?: string,
  max = 3
): string[] {
  const tokens  = tokenise(text);
  const matches = matchSignals(tokens, MOOD_SIGNALS);

  const fromText = matches.map(m => m.term);

  if (fromText.length >= max) {
    return fromText.slice(0, max);
  }

  // Fill gaps from tone defaults, deduplicating by exact term
  const seen     = new Set(fromText);
  const defaults = tone ? (TONE_MOOD_DEFAULTS[tone] ?? []) : [];
  const all      = [...fromText];
  for (const d of defaults) {
    if (!seen.has(d)) { seen.add(d); all.push(d); }
    if (all.length >= max) break;
  }
  return all.slice(0, max);
}

/**
 * Return all matched signal entries for visual and action categories,
 * with their weights — used by the search-term composer.
 */
export function extractWeightedSignals(text: string): {
  visual: Array<{ term: string; weight: number }>;
  action: Array<{ term: string; weight: number }>;
  mood:   Array<{ term: string; weight: number }>;
} {
  const tokens = tokenise(text);
  return {
    visual: matchSignals(tokens, VISUAL_SIGNALS),
    action: matchSignals(tokens, ACTION_SIGNALS),
    mood:   matchSignals(tokens, MOOD_SIGNALS),
  };
}
