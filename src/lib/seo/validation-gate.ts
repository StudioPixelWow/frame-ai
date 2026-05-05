// @ts-nocheck
/**
 * PIXEL SEO/GEO — Validation Gate
 * Blocks flow if data is insufficient. NO EVIDENCE = NO CLAIM.
 *
 * Checks before allowing:
 * - AI Questions generation
 * - Insights generation
 * - Report generation
 * - 60-day plan generation
 */

import type { WebsiteFacts } from './website-facts';
import type { CrawlResult } from './crawler';

export interface ValidationResult {
  isValid: boolean;
  canProceed: boolean;
  mode: 'full' | 'partial' | 'blocked';
  checks: ValidationCheck[];
  missingData: string[];        // Hebrew messages
  message: string;              // Hebrew overall status
  messageEn: string;            // English for logging
}

export interface ValidationCheck {
  field: string;
  label: string;               // Hebrew
  required: boolean;
  passed: boolean;
  value?: any;
  reason?: string;             // Hebrew why it failed
}

export interface ValidationInput {
  websiteFacts?: WebsiteFacts | null;
  crawlResult?: CrawlResult | null;
  scanDurationMs?: number;
  pagesScanned?: number;
  evidenceCount?: number;
}

/** Minimum thresholds */
const THRESHOLDS = {
  MIN_SCAN_DURATION_MS: 5000,
  MIN_PAGES_SCANNED: 3,
  MIN_EVIDENCE_COUNT: 5,
  MIN_CONFIDENCE: 30,
};

/**
 * Validate whether the system has enough data to proceed.
 * Call this BEFORE generating AI questions, insights, reports, or plans.
 */
export function validateScanData(input: ValidationInput): ValidationResult {
  const checks: ValidationCheck[] = [];
  const missingData: string[] = [];

  // Check 1: Business type identified
  const bizType = input.websiteFacts?.business_type;
  const hasBizType = !!(bizType && typeof bizType === 'object' && 'value' in bizType && bizType.value && bizType.confidence >= THRESHOLDS.MIN_CONFIDENCE);
  checks.push({
    field: 'business_type',
    label: 'סוג עסק מזוהה',
    required: true,
    passed: hasBizType,
    value: hasBizType ? bizType?.value : null,
    reason: !hasBizType ? 'לא זוהה סוג עסק מהסריקה' : undefined,
  });
  if (!hasBizType) missingData.push('לא זוהה סוג העסק — נדרש מידע נוסף מהסריקה');

  // Check 2: Products/services identified
  const products = input.websiteFacts?.products_services;
  const hasProducts = !!(products && typeof products === 'object' && 'value' in products && Array.isArray(products.value) && products.value.length > 0);
  checks.push({
    field: 'products_services',
    label: 'שירותים/מוצרים מזוהים',
    required: true,
    passed: hasProducts,
    value: hasProducts ? products?.value?.length : 0,
    reason: !hasProducts ? 'לא זוהו שירותים או מוצרים' : undefined,
  });
  if (!hasProducts) missingData.push('לא זוהו שירותים או מוצרים מהאתר');

  // Check 3: Minimum pages scanned
  const pagesScanned = input.pagesScanned || input.crawlResult?.pagesScanned || 0;
  const hasEnoughPages = pagesScanned >= THRESHOLDS.MIN_PAGES_SCANNED;
  checks.push({
    field: 'pages_scanned',
    label: 'מספר דפים שנסרקו',
    required: true,
    passed: hasEnoughPages,
    value: pagesScanned,
    reason: !hasEnoughPages ? `נסרקו ${pagesScanned} דפים — נדרשים לפחות ${THRESHOLDS.MIN_PAGES_SCANNED}` : undefined,
  });
  if (!hasEnoughPages) missingData.push(`נסרקו רק ${pagesScanned} דפים (מינימום ${THRESHOLDS.MIN_PAGES_SCANNED})`);

  // Check 4: Scan duration (anti-fake)
  const duration = input.scanDurationMs || input.crawlResult?.durationMs || 0;
  const hasValidDuration = duration >= THRESHOLDS.MIN_SCAN_DURATION_MS;
  checks.push({
    field: 'scan_duration',
    label: 'משך סריקה תקין',
    required: true,
    passed: hasValidDuration,
    value: duration,
    reason: !hasValidDuration ? `סריקה ארכה ${Math.round(duration/1000)}s — מינימום ${THRESHOLDS.MIN_SCAN_DURATION_MS/1000}s` : undefined,
  });
  if (!hasValidDuration) missingData.push('משך הסריקה קצר מדי — ייתכן שהסריקה לא הושלמה');

  // Check 5: Evidence count (optional but informative)
  const evidence = input.evidenceCount || 0;
  const hasEvidence = evidence >= THRESHOLDS.MIN_EVIDENCE_COUNT;
  checks.push({
    field: 'evidence_count',
    label: 'ראיות שנאספו',
    required: false,
    passed: hasEvidence,
    value: evidence,
    reason: !hasEvidence ? `נאספו ${evidence} ראיות — מומלץ לפחות ${THRESHOLDS.MIN_EVIDENCE_COUNT}` : undefined,
  });

  // Determine mode
  const requiredChecks = checks.filter(c => c.required);
  const passedRequired = requiredChecks.filter(c => c.passed).length;
  const allRequiredPassed = passedRequired === requiredChecks.length;
  const someRequiredPassed = passedRequired > 0;

  let mode: 'full' | 'partial' | 'blocked';
  let canProceed: boolean;
  let message: string;
  let messageEn: string;

  if (allRequiredPassed) {
    mode = 'full';
    canProceed = true;
    message = 'כל הנתונים הנדרשים זמינים — ניתן להמשיך';
    messageEn = 'All required data available — can proceed';
  } else if (someRequiredPassed && passedRequired >= 2) {
    mode = 'partial';
    canProceed = true;
    message = 'חלק מהנתונים חסרים — התוצאות עלולות להיות חלקיות';
    messageEn = 'Partial data — results may be incomplete';
  } else {
    mode = 'blocked';
    canProceed = false;
    message = 'אין מספיק נתונים מאומתים להמשך התהליך';
    messageEn = 'Insufficient verified data to proceed';
  }

  return {
    isValid: allRequiredPassed,
    canProceed,
    mode,
    checks,
    missingData,
    message,
    messageEn,
  };
}

/**
 * Quick check — returns true/false without detailed report.
 * Use when you just need a gate check.
 */
export function canProceedWithData(input: ValidationInput): boolean {
  return validateScanData(input).canProceed;
}

/**
 * Get the blocking message in Hebrew for UI display.
 */
export function getBlockingMessage(input: ValidationInput): string | null {
  const result = validateScanData(input);
  if (result.canProceed) return null;
  return result.message;
}
