/** PIXEL Creative Director — Validation Service. Validates creative output against the proven framework rules. Server-side only. */

import {
  ABSOLUTE_BLACKLIST,
  PIXEL_AVOID_LIST,
  INDUSTRY_VISUAL_ANCHORS,
  TYPOGRAPHY_RULES,
  SCROLL_STOP_RULES,
} from './pixelCreativeDirectorPrompt';

/* ── Interfaces ───────────────────────────────────────────────────────── */

export interface ValidationResult {
  isValid: boolean;
  blacklistViolations: string[];
  rtlIssues: string[];
  contrastIssues: string[];
  hierarchyIssues: string[];
  industryRelevanceIssues: string[];
  brandConsistencyIssues: string[];
  copyPreservationIssues: string[];
  scrollStopIssues: string[];
  overallScore: number;
  details: Record<string, any>;
}

export interface ValidationParams {
  prompt: string;
  strategy: string;
  industry: string;
  originalCopy: {
    headline: string;
    subHeadline?: string;
    bullets?: string[];
    cta: string;
  };
  outputCopy?: {
    headline: string;
    subHeadline?: string;
    bullets?: string[];
    cta: string;
  };
  brandColors?: string[];
  layoutType?: string;
}

/* ── Helper: Blacklist Violations ─────────────────────────────────────── */

/**
 * Checks the prompt against both the absolute blacklist and the PIXEL avoid list.
 * Returns an array of every violated item (substring match, case-insensitive).
 *
 * בדיקת רשימה שחורה — כל פריט שנמצא בפרומפט מוחזר כהפרה
 */
export function checkBlacklistViolations(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const violations: string[] = [];

  for (const item of ABSOLUTE_BLACKLIST) {
    if (lower.includes(item.toLowerCase())) {
      violations.push(`[BLACKLIST] ${item}`);
    }
  }

  for (const item of PIXEL_AVOID_LIST) {
    if (lower.includes(item.toLowerCase())) {
      violations.push(`[AVOID] ${item}`);
    }
  }

  return violations;
}

/* ── Helper: Copy Preservation ────────────────────────────────────────── */

/**
 * Compares the original copy with the output copy and flags any elements
 * that were lost or altered during generation.
 *
 * שימור קופי — בודק שכל חלקי הטקסט המקוריים נשמרו באאוטפוט
 */
export function checkCopyPreservation(
  original: ValidationParams['originalCopy'],
  output?: ValidationParams['outputCopy'],
): string[] {
  // אם אין אאוטפוט — אין מה לבדוק
  if (!output) return [];

  const issues: string[] = [];

  // בדיקת כותרת ראשית
  if (
    output.headline !== original.headline &&
    !output.headline.includes(original.headline)
  ) {
    issues.push('הכותרת הראשית שונתה או נחתכה — חובה לשמור על הטקסט המקורי');
  }

  // בדיקת כותרת משנה
  if (original.subHeadline) {
    if (
      !output.subHeadline ||
      (output.subHeadline !== original.subHeadline &&
        !output.subHeadline.includes(original.subHeadline))
    ) {
      issues.push('כותרת המשנה חסרה או שונתה — אסור להשמיט חלקים מהקופי');
    }
  }

  // בדיקת בולטים / נקודות
  if (original.bullets && original.bullets.length > 0) {
    if (!output.bullets || output.bullets.length === 0) {
      issues.push('כל הבולטים הוסרו — חובה לשמור על כל נקודות הטקסט');
    } else {
      for (const bullet of original.bullets) {
        const found = output.bullets.some(
          (ob) => ob === bullet || ob.includes(bullet),
        );
        if (!found) {
          issues.push(`בולט חסר: "${bullet}" — אסור להשמיט שום בולט מהקופי המקורי`);
        }
      }
    }
  }

  // בדיקת קריאה לפעולה
  if (
    output.cta !== original.cta &&
    !output.cta.includes(original.cta)
  ) {
    issues.push('הקריאה לפעולה (CTA) שונתה — חובה לשמור על הנוסח המדויק');
  }

  return issues;
}

/* ── Helper: Score Calculation ────────────────────────────────────────── */

/**
 * Calculates the overall validation score (0–100) from the issue arrays.
 *
 * חישוב ציון — מתחילים מ-100 ומפחיתים לפי חומרת הבעיות
 */
export function calculateValidationScore(
  result: Omit<ValidationResult, 'overallScore' | 'isValid' | 'details'>,
): number {
  let score = 100;

  // הפרות רשימה שחורה — חמורות ביותר
  const blacklistCount = result.blacklistViolations.filter((v) =>
    v.startsWith('[BLACKLIST]'),
  ).length;
  const avoidCount = result.blacklistViolations.filter((v) =>
    v.startsWith('[AVOID]'),
  ).length;

  score -= blacklistCount * 10;
  score -= avoidCount * 5;

  // שימור קופי — קריטי
  score -= result.copyPreservationIssues.length * 8;

  // RTL
  score -= result.rtlIssues.length * 5;

  // ניגודיות
  score -= result.contrastIssues.length * 3;

  // היררכיה
  score -= result.hierarchyIssues.length * 3;

  // רלוונטיות תעשייתית
  score -= result.industryRelevanceIssues.length * 5;

  // עצירת גלילה
  score -= result.scrollStopIssues.length * 5;

  // עקביות מותג
  score -= result.brandConsistencyIssues.length * 3;

  return Math.max(0, Math.min(100, score));
}

/* ── Main Validation Function ─────────────────────────────────────────── */

/**
 * Performs comprehensive validation of creative output against the
 * PIXEL Creative Director framework rules.
 *
 * Checks blacklist adherence, RTL correctness, copy preservation,
 * industry relevance, contrast, hierarchy, scroll-stop criteria,
 * and brand consistency.
 *
 * ולידציה מקיפה — בודק את כל כללי המסגרת של המנהל הקריאטיבי
 */
export function validateCreativeOutput(
  params: ValidationParams,
): ValidationResult {
  const { prompt, strategy, industry, originalCopy, outputCopy, brandColors } =
    params;
  const promptLower = prompt.toLowerCase();

  /* ── 1. Blacklist Check ──────────────────────────────────────────────── */
  const blacklistViolations = checkBlacklistViolations(prompt);

  /* ── 2. RTL Check ────────────────────────────────────────────────────── */
  // בדיקת תמיכה בעברית ו-RTL
  const rtlIssues: string[] = [];
  const hasHebrew = /[֐-׿]/.test(prompt);
  const mentionsRtl =
    promptLower.includes('rtl') || promptLower.includes('right-to-left');
  const mentionsHebrewFont =
    promptLower.includes('heebo') || promptLower.includes('hebrew');

  if (hasHebrew && !mentionsRtl) {
    rtlIssues.push(
      'Prompt contains Hebrew characters but does not mention RTL or right-to-left layout',
    );
  }

  if (hasHebrew && !mentionsHebrewFont) {
    rtlIssues.push(
      'Prompt contains Hebrew but does not specify a Hebrew-compatible font (e.g. Heebo)',
    );
  }

  // אסטרטגיות עתירות טקסט דורשות התייחסות מפורשת ל-RTL
  const textHeavyStrategies = ['brutalist-typography', 'data-drama'];
  if (
    textHeavyStrategies.includes(strategy) &&
    hasHebrew &&
    !mentionsRtl
  ) {
    rtlIssues.push(
      `Strategy "${strategy}" is text-heavy — RTL layout direction is critical and must be specified explicitly`,
    );
  }

  /* ── 3. Copy Preservation Check ──────────────────────────────────────── */
  const copyPreservationIssues = checkCopyPreservation(
    originalCopy,
    outputCopy,
  );

  /* ── 4. Industry Relevance Check ─────────────────────────────────────── */
  // בדיקת עוגנים ויזואליים לפי תעשייה
  const industryRelevanceIssues: string[] = [];
  const anchors = INDUSTRY_VISUAL_ANCHORS[industry];

  if (anchors) {
    // לכל תעשייה מוגדרת — בודקים שלפחות עוגן אחד מופיע בפרומפט
    const hasAnyAnchor = anchors.some((anchor) => {
      // בודקים מילות מפתח מתוך העוגן
      const keywords = anchor
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      return keywords.some((kw) => promptLower.includes(kw));
    });

    if (!hasAnyAnchor) {
      industryRelevanceIssues.push(
        'No industry-specific visual anchors detected',
      );
    }
  } else {
    // תעשייה לא מוכרת — מציינים בלי לסמן כבעיה
    // Unknown industry — noted but not flagged
  }

  /* ── 5. Contrast Check ───────────────────────────────────────────────── */
  // בדיקת ניגודיות וקריאות טקסט
  const contrastIssues: string[] = [];
  const contrastTerms = ['contrast', 'readability', 'legible', 'readable'];
  const mentionsContrast = contrastTerms.some((t) => promptLower.includes(t));
  const mentionsGradientOverlay =
    promptLower.includes('gradient overlay') ||
    (promptLower.includes('gradient') && promptLower.includes('overlay'));

  if (!mentionsContrast) {
    contrastIssues.push(
      'No contrast or readability terms found in prompt — text legibility may be at risk',
    );
  }

  if (!mentionsGradientOverlay) {
    contrastIssues.push(
      'No gradient overlay mentioned for text readability over background imagery',
    );
  }

  // קופי ארוך עם בולטים דורש יחס ניגודיות 7:1
  const hasLongCopy =
    originalCopy.bullets && originalCopy.bullets.length > 0;
  if (hasLongCopy && !prompt.includes('7:1')) {
    contrastIssues.push(
      'Long copy with bullets detected but no 7:1 contrast ratio specified',
    );
  }

  /* ── 6. Hierarchy Check ──────────────────────────────────────────────── */
  // בדיקת היררכיית טיפוגרפיה
  const hierarchyIssues: string[] = [];
  const hierarchyTerms = [
    'headline',
    'title',
    'body',
    'text',
    'cta',
    'button',
    'heading',
    'subheading',
    'subtitle',
  ];
  const foundHierarchyTerms = hierarchyTerms.filter((t) =>
    promptLower.includes(t),
  );

  if (foundHierarchyTerms.length === 0) {
    hierarchyIssues.push(
      'No typography hierarchy terms found — prompt should define clear text levels',
    );
  }

  // בודקים אם יש יותר מ-3 רמות טקסט — לפי כללי TYPOGRAPHY_RULES
  const levelIndicators = [
    'headline',
    'subheadline',
    'subtitle',
    'body',
    'caption',
    'cta',
    'footnote',
    'label',
  ];
  const foundLevels = levelIndicators.filter((l) => promptLower.includes(l));
  if (foundLevels.length > TYPOGRAPHY_RULES.hierarchy.levels) {
    hierarchyIssues.push(
      `Too many text levels detected (${foundLevels.length}) — framework allows maximum ${TYPOGRAPHY_RULES.hierarchy.levels} levels: ${TYPOGRAPHY_RULES.hierarchy.order.join(' → ')}`,
    );
  }

  /* ── 7. Scroll-Stop Check ────────────────────────────────────────────── */
  // בדיקת קריטריונים לעצירת גלילה
  const scrollStopIssues: string[] = [];

  if (!promptLower.includes('dominant')) {
    scrollStopIssues.push(
      'No "dominant" visual element reference — scroll-stop requires a commanding focal point',
    );
  }

  if (
    !promptLower.includes('hook') &&
    !promptLower.includes('attention') &&
    !promptLower.includes('impossible to miss')
  ) {
    scrollStopIssues.push(
      'No hook headline or attention-grabbing reference — the headline must be impossible to miss',
    );
  }

  if (!promptLower.includes('negative space')) {
    scrollStopIssues.push(
      `Missing negative space reference — ${SCROLL_STOP_RULES.negativeSpace}`,
    );
  }

  // צבע הדגשה צריך להיות מוגבל — "only" או "single" לצד accent
  const mentionsAccent = promptLower.includes('accent');
  const accentConstrained =
    mentionsAccent &&
    (promptLower.includes('only') || promptLower.includes('single'));
  if (!accentConstrained) {
    scrollStopIssues.push(
      `Accent color not used with strategic constraint — ${SCROLL_STOP_RULES.accentColorRule}`,
    );
  }

  /* ── 8. Brand Consistency Check ──────────────────────────────────────── */
  // בדיקת עקביות מותגית
  const brandConsistencyIssues: string[] = [];

  if (brandColors && brandColors.length > 0) {
    const colorsInPrompt = brandColors.filter((color) =>
      promptLower.includes(color.toLowerCase()),
    );

    if (colorsInPrompt.length === 0) {
      brandConsistencyIssues.push(
        'None of the brand colors appear in the prompt — at least one brand color should be referenced',
      );
    }
  }

  // בדיקה שאין יותר מצבע הדגשה אחד
  const accentMentions = promptLower.match(/accent\s+color/g);
  if (accentMentions && accentMentions.length > 1) {
    brandConsistencyIssues.push(
      'Multiple accent color references detected — the framework mandates a single accent color only',
    );
  }

  /* ── Scoring ─────────────────────────────────────────────────────────── */
  const partialResult = {
    blacklistViolations,
    rtlIssues,
    contrastIssues,
    hierarchyIssues,
    industryRelevanceIssues,
    brandConsistencyIssues,
    copyPreservationIssues,
    scrollStopIssues,
  };

  const overallScore = calculateValidationScore(partialResult);

  const totalIssues =
    blacklistViolations.length +
    rtlIssues.length +
    contrastIssues.length +
    hierarchyIssues.length +
    industryRelevanceIssues.length +
    brandConsistencyIssues.length +
    copyPreservationIssues.length +
    scrollStopIssues.length;

  // בעיות קריטיות = רשימה שחורה (BLACKLIST בלבד) + שימור קופי
  const criticalIssues =
    blacklistViolations.filter((v) => v.startsWith('[BLACKLIST]')).length +
    copyPreservationIssues.length;

  const warningIssues = totalIssues - criticalIssues;

  // isValid requires no hard-blacklist violations (AVOID items are warnings, not blockers)
  const hardBlacklistCount = blacklistViolations.filter((v) =>
    v.startsWith('[BLACKLIST]'),
  ).length;
  const isValid = overallScore >= 60 && hardBlacklistCount === 0;

  return {
    isValid,
    blacklistViolations,
    rtlIssues,
    contrastIssues,
    hierarchyIssues,
    industryRelevanceIssues,
    brandConsistencyIssues,
    copyPreservationIssues,
    scrollStopIssues,
    overallScore,
    details: {
      totalIssues,
      criticalIssues,
      warningIssues,
      checkedAt: new Date().toISOString(),
      validatedStrategy: strategy,
      validatedIndustry: industry,
    },
  };
}
