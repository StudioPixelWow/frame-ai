/**
 * Hebrew NLP Utilities for SEO
 * Morphology helpers: stop words, prefix stripping, keyword extraction, text normalization
 */

// ===== Hebrew Stop Words =====

export const HEBREW_STOP_WORDS = new Set([
  // Prepositions & conjunctions
  'של', 'את', 'על', 'עם', 'אל', 'מן', 'בין', 'לפני', 'אחרי', 'כמו', 'בלי', 'עד',
  'כי', 'אם', 'או', 'גם', 'רק', 'כל', 'אבל', 'אך', 'למרות', 'בגלל', 'כדי', 'לכן',
  // Pronouns
  'אני', 'אתה', 'את', 'הוא', 'היא', 'אנחנו', 'אתם', 'אתן', 'הם', 'הן',
  'זה', 'זו', 'זאת', 'אלה', 'אלו',
  // Demonstratives & articles
  'הזה', 'הזו', 'הזאת', 'האלה', 'האלו',
  // Common verbs (auxiliary)
  'הוא', 'היא', 'היה', 'היתה', 'היו', 'יהיה', 'תהיה', 'יהיו',
  'יש', 'אין', 'היה', 'להיות', 'לא',
  // Quantifiers
  'הרבה', 'מעט', 'קצת', 'כמה', 'מספר', 'כלל',
  // Question words
  'מה', 'מי', 'איפה', 'מתי', 'למה', 'איך', 'כיצד', 'האם',
  // Misc
  'ככה', 'כך', 'כבר', 'עוד', 'פה', 'שם', 'כאן', 'עכשיו', 'אז',
  'לו', 'לה', 'לי', 'לנו', 'להם', 'שלו', 'שלה', 'שלי', 'שלנו', 'שלהם',
  'בו', 'בה', 'בי', 'בנו', 'בהם',
  'ממנו', 'ממנה', 'ממני', 'מהם',
  'אותו', 'אותה', 'אותי', 'אותנו', 'אותם',
  'עליו', 'עליה', 'עליי', 'עלינו', 'עליהם',
  'ב', 'ל', 'כ', 'מ', 'ה', 'ו', 'ש',
  'יותר', 'פחות', 'ביותר', 'מאוד', 'ממש', 'לגמרי', 'בערך',
  'אחד', 'אחת', 'שני', 'שתי', 'שלוש', 'ארבע', 'חמש',
  'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי',
]);

// ===== Hebrew Prefix Stripping =====

/** Common Hebrew prefixes (ב, ל, כ, מ, ה, ו, ש) and their combinations */
const HEBREW_PREFIXES = [
  'וש', 'וה', 'ול', 'וב', 'וכ', 'ומ',
  'שה', 'של', 'שב', 'שכ', 'שמ',
  'מה', 'מב', 'מל',
  'לה', 'לב',
  'בה',
  'ה', 'ב', 'ל', 'כ', 'מ', 'ו', 'ש',
];

/**
 * Strip common Hebrew prefixes from a word.
 * Returns the stripped form only if the remaining word is >= 2 chars.
 */
export function stripHebrewPrefixes(word: string): string {
  if (word.length < 3) return word;

  for (const prefix of HEBREW_PREFIXES) {
    if (word.startsWith(prefix) && word.length - prefix.length >= 2) {
      return word.slice(prefix.length);
    }
  }
  return word;
}

// ===== Hebrew Suffix Stripping =====

const HEBREW_SUFFIXES = [
  'ים', 'ות', 'ית', 'ני', 'תי', 'נו', 'כם', 'כן', 'הם', 'הן',
];

/**
 * Strip common Hebrew suffixes (plural, possessive).
 * Returns stripped form only if remaining word is >= 2 chars.
 */
export function stripHebrewSuffixes(word: string): string {
  if (word.length < 4) return word;

  for (const suffix of HEBREW_SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 2) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

// ===== Text Normalization =====

/**
 * Remove nikud (diacritical marks) from Hebrew text.
 * Unicode range: 0x0591–0x05C7
 */
export function removeNikud(text: string): string {
  return text.replace(/[֑-ׇ]/g, '');
}

/**
 * Normalize Hebrew text: remove nikud, collapse whitespace, lowercase Latin chars
 */
export function normalizeHebrew(text: string): string {
  let result = removeNikud(text);
  result = result.replace(/[״""]/g, '"').replace(/[׳'']/g, "'");
  result = result.replace(/\s+/g, ' ').trim();
  result = result.toLowerCase(); // Only affects Latin chars
  return result;
}

/**
 * Check if a character is Hebrew
 */
export function isHebrewChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x0590 && code <= 0x05FF;
}

/**
 * Check if text is primarily Hebrew
 */
export function isHebrewText(text: string): boolean {
  const chars = text.replace(/\s/g, '');
  if (chars.length === 0) return false;
  let hebrewCount = 0;
  for (const char of chars) {
    if (isHebrewChar(char)) hebrewCount++;
  }
  return hebrewCount / chars.length > 0.5;
}

// ===== Keyword Extraction =====

/**
 * Tokenize Hebrew text into words, removing punctuation
 */
export function tokenize(text: string): string[] {
  const normalized = normalizeHebrew(text);
  return normalized
    .replace(/[^֐-׿\w\s]/g, ' ') // Keep Hebrew + Latin + digits
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

/**
 * Extract keywords from Hebrew text.
 * Removes stop words, strips prefixes/suffixes, counts frequency.
 */
export function extractHebrewKeywords(
  text: string,
  options: { maxKeywords?: number; minFrequency?: number; stripAffixes?: boolean } = {}
): { keyword: string; frequency: number; original: string }[] {
  const { maxKeywords = 20, minFrequency = 1, stripAffixes = true } = options;

  const tokens = tokenize(text);
  const frequencyMap = new Map<string, { count: number; original: string }>();

  for (const token of tokens) {
    if (HEBREW_STOP_WORDS.has(token)) continue;
    if (token.length < 2) continue;

    const stemmed = stripAffixes
      ? stripHebrewSuffixes(stripHebrewPrefixes(token))
      : token;

    const existing = frequencyMap.get(stemmed);
    if (existing) {
      existing.count++;
    } else {
      frequencyMap.set(stemmed, { count: 1, original: token });
    }
  }

  return Array.from(frequencyMap.entries())
    .filter(([, v]) => v.count >= minFrequency)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxKeywords)
    .map(([keyword, v]) => ({ keyword, frequency: v.count, original: v.original }));
}

// ===== SEO-Specific Helpers =====

/**
 * Calculate keyword density in Hebrew text
 */
export function hebrewKeywordDensity(text: string, keyword: string): number {
  const normalizedText = normalizeHebrew(text);
  const normalizedKeyword = normalizeHebrew(keyword);
  const words = tokenize(normalizedText);
  if (words.length === 0) return 0;

  const keywordTokens = tokenize(normalizedKeyword);
  if (keywordTokens.length === 0) return 0;

  if (keywordTokens.length === 1) {
    const matches = words.filter(w => w === keywordTokens[0] || stripHebrewPrefixes(w) === keywordTokens[0]);
    return matches.length / words.length;
  }

  // Multi-word: count phrase occurrences
  let count = 0;
  const phraseLen = keywordTokens.length;
  for (let i = 0; i <= words.length - phraseLen; i++) {
    let match = true;
    for (let j = 0; j < phraseLen; j++) {
      const w = stripHebrewPrefixes(words[i + j]);
      if (w !== keywordTokens[j]) { match = false; break; }
    }
    if (match) count++;
  }
  return count / words.length;
}

/**
 * Generate keyword variations for Hebrew SEO
 * Accounts for prefix/suffix combinations common in Hebrew search
 */
export function generateHebrewVariations(keyword: string): string[] {
  const base = normalizeHebrew(keyword);
  const variations = new Set<string>([base]);

  // Add common prefixed forms
  const prefixes = ['ב', 'ל', 'ה', 'מ', 'ו'];
  for (const p of prefixes) {
    variations.add(p + base);
  }

  // Add plural forms
  if (!base.endsWith('ים') && !base.endsWith('ות')) {
    variations.add(base + 'ים');
    variations.add(base + 'ות');
  }

  // Strip to get potential root
  const stripped = stripHebrewSuffixes(stripHebrewPrefixes(base));
  if (stripped !== base) {
    variations.add(stripped);
  }

  return Array.from(variations);
}

/**
 * Hebrew-aware title tag analysis for SEO
 */
export function analyzeHebrewTitle(title: string, targetKeyword: string): {
  length: number;
  hasKeyword: boolean;
  keywordPosition: 'start' | 'middle' | 'end' | 'missing';
  isRtl: boolean;
  suggestions: string[];
} {
  const normalized = normalizeHebrew(title);
  const keywordNorm = normalizeHebrew(targetKeyword);
  const hasKeyword = normalized.includes(keywordNorm);
  const suggestions: string[] = [];

  let keywordPosition: 'start' | 'middle' | 'end' | 'missing' = 'missing';
  if (hasKeyword) {
    const idx = normalized.indexOf(keywordNorm);
    if (idx === 0) keywordPosition = 'start';
    else if (idx + keywordNorm.length >= normalized.length - 3) keywordPosition = 'end';
    else keywordPosition = 'middle';
  }

  if (title.length > 60) {
    suggestions.push('הכותרת ארוכה מ-60 תווים — עלולה להיחתך בתוצאות החיפוש');
  }
  if (title.length < 30) {
    suggestions.push('הכותרת קצרה מ-30 תווים — מומלץ להאריך לניצול מקסימלי');
  }
  if (!hasKeyword) {
    suggestions.push('מילת המפתח לא מופיעה בכותרת — מומלץ להוסיף');
  }
  if (keywordPosition !== 'start' && hasKeyword) {
    suggestions.push('מומלץ להעביר את מילת המפתח לתחילת הכותרת');
  }

  return {
    length: title.length,
    hasKeyword,
    keywordPosition,
    isRtl: isHebrewText(title),
    suggestions,
  };
}
