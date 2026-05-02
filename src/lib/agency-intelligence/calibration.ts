/**
 * Calibration System
 *
 * Agency-wide performance thresholds and preferences.
 * Used by Strategic Brain, Growth Engine, and Autopilot
 * to make decisions that match our studio's standards.
 *
 * Usage:
 * - IF CPL < ideal → suggest scale
 * - IF CPL > acceptable → suggest fix
 * - IF CTR > high threshold → winner
 * - IF CTR < low threshold → replace
 */

import { createClient } from '@supabase/supabase-js';
import type { AgencyCalibration, ScalingRule } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Default Calibration ──

export const DEFAULT_CALIBRATION: AgencyCalibration = {
  id: 'default',
  idealCplPerIndustry: {
    real_estate: 120,
    restaurants: 40,
    lawyers: 200,
    aesthetics: 80,
    ecommerce: 60,
    education: 90,
    fitness: 50,
    saas: 150,
    general: 100,
  },
  acceptableCtrRange: { min: 1.5, max: 5.0 },
  highPerformanceThreshold: 3.0,
  lowPerformanceThreshold: 1.0,
  preferredCreativeStyles: ['carousel', 'video_testimonial', 'before_after', 'ugc', 'story_format'],
  preferredHooks: [
    'שאלה ישירה לקהל',
    'סטטיסטיקה מפתיעה',
    'סיפור לקוח אמיתי',
    'בעיה → פתרון',
    'לפני ואחרי',
  ],
  toneOfVoice: 'ישיר, אמוציונלי, מקצועי — מדבר בגובה העיניים',
  campaignStrategyPreferences: {
    default_objective: 'leads',
    default_optimization: 'conversions',
    preferred_placement: 'automatic',
    min_ads_per_adset: '2',
    max_ads_per_adset: '4',
    test_budget_pct: '20',
  },
  riskToleranceLevel: 'moderate',
  scalingRules: [
    { condition: 'cpl_below_ideal', action: 'scale_budget_20', description: 'CPL מתחת לאידיאל — הגדלת תקציב ב-20%' },
    { condition: 'cpl_above_2x_ideal', action: 'pause_and_review', description: 'CPL כפול מהאידיאל — עצור ובדוק' },
    { condition: 'ctr_above_high', action: 'duplicate_ad', description: 'CTR גבוה — שכפול מודעה למפרסמים נוספים' },
    { condition: 'ctr_below_low', action: 'replace_creative', description: 'CTR נמוך — החלפת קריאייטיב' },
    { condition: 'no_leads_3_days', action: 'alert_and_review', description: 'ללא לידים 3 ימים — התראה ובדיקה' },
    { condition: 'lead_quality_low', action: 'refine_targeting', description: 'איכות לידים נמוכה — חידוד טרגטינג' },
  ],
  updatedAt: new Date().toISOString(),
};

// ── Get Calibration ──

export async function getCalibration(): Promise<AgencyCalibration> {
  try {
    const { data } = await supabase.from('agency_calibration').select('*').eq('id', 'default').single();
    if (!data) return DEFAULT_CALIBRATION;
    return mapCalibrationRow(data);
  } catch {
    return DEFAULT_CALIBRATION;
  }
}

// ── Save Calibration ──

export async function saveCalibration(calibration: Partial<AgencyCalibration>): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      id: 'default',
      updated_at: now,
    };
    if (calibration.idealCplPerIndustry) row.ideal_cpl_per_industry = calibration.idealCplPerIndustry;
    if (calibration.acceptableCtrRange) row.acceptable_ctr_range = calibration.acceptableCtrRange;
    if (calibration.highPerformanceThreshold !== undefined) row.high_performance_threshold = calibration.highPerformanceThreshold;
    if (calibration.lowPerformanceThreshold !== undefined) row.low_performance_threshold = calibration.lowPerformanceThreshold;
    if (calibration.preferredCreativeStyles) row.preferred_creative_styles = calibration.preferredCreativeStyles;
    if (calibration.preferredHooks) row.preferred_hooks = calibration.preferredHooks;
    if (calibration.toneOfVoice) row.tone_of_voice = calibration.toneOfVoice;
    if (calibration.campaignStrategyPreferences) row.campaign_strategy_preferences = calibration.campaignStrategyPreferences;
    if (calibration.riskToleranceLevel) row.risk_tolerance_level = calibration.riskToleranceLevel;
    if (calibration.scalingRules) row.scaling_rules = calibration.scalingRules;

    await supabase.from('agency_calibration').upsert(row);
    return true;
  } catch {
    return false;
  }
}

// ── Evaluate Performance ──

export interface PerformanceEvaluation {
  verdict: 'excellent' | 'good' | 'average' | 'poor' | 'critical';
  label: string;
  suggestions: string[];
  scalingActions: ScalingRule[];
}

export function evaluatePerformance(
  industry: string,
  cpl: number,
  ctr: number,
  calibration: AgencyCalibration
): PerformanceEvaluation {
  const idealCPL = calibration.idealCplPerIndustry[industry] || calibration.idealCplPerIndustry.general || 100;
  const suggestions: string[] = [];
  const scalingActions: ScalingRule[] = [];

  // CPL evaluation
  const cplRatio = cpl / idealCPL;

  if (cplRatio <= 0.7) {
    suggestions.push(`CPL מצוין (₪${Math.round(cpl)}) — מתחת ל-70% מהאידיאל`);
    scalingActions.push(...calibration.scalingRules.filter(r => r.condition === 'cpl_below_ideal'));
  } else if (cplRatio > 2.0) {
    suggestions.push(`CPL קריטי (₪${Math.round(cpl)}) — כפול מהאידיאל (₪${idealCPL})`);
    scalingActions.push(...calibration.scalingRules.filter(r => r.condition === 'cpl_above_2x_ideal'));
  } else if (cplRatio > 1.3) {
    suggestions.push(`CPL גבוה (₪${Math.round(cpl)}) — מעל האידיאל (₪${idealCPL})`);
  }

  // CTR evaluation
  if (ctr >= calibration.highPerformanceThreshold) {
    suggestions.push(`CTR מצוין (${ctr.toFixed(1)}%) — מעל סף ביצועים גבוהים`);
    scalingActions.push(...calibration.scalingRules.filter(r => r.condition === 'ctr_above_high'));
  } else if (ctr <= calibration.lowPerformanceThreshold) {
    suggestions.push(`CTR נמוך (${ctr.toFixed(1)}%) — מתחת לסף מינימלי`);
    scalingActions.push(...calibration.scalingRules.filter(r => r.condition === 'ctr_below_low'));
  }

  // Overall verdict
  let verdict: PerformanceEvaluation['verdict'];
  let label: string;

  if (cplRatio <= 0.7 && ctr >= calibration.highPerformanceThreshold) {
    verdict = 'excellent'; label = 'ביצועים מצוינים';
  } else if (cplRatio <= 1.0 && ctr >= calibration.acceptableCtrRange.min) {
    verdict = 'good'; label = 'ביצועים טובים';
  } else if (cplRatio <= 1.5 && ctr >= calibration.lowPerformanceThreshold) {
    verdict = 'average'; label = 'ביצועים סבירים';
  } else if (cplRatio > 2.0 || ctr < calibration.lowPerformanceThreshold) {
    verdict = 'critical'; label = 'ביצועים קריטיים';
  } else {
    verdict = 'poor'; label = 'ביצועים חלשים';
  }

  return { verdict, label, suggestions, scalingActions };
}

// ── Row Mapper ──

function mapCalibrationRow(row: any): AgencyCalibration {
  const parseJSON = (v: any, fallback: any) => {
    if (!v) return fallback;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return fallback; }
  };

  return {
    id: row.id || 'default',
    idealCplPerIndustry: parseJSON(row.ideal_cpl_per_industry, DEFAULT_CALIBRATION.idealCplPerIndustry),
    acceptableCtrRange: parseJSON(row.acceptable_ctr_range, DEFAULT_CALIBRATION.acceptableCtrRange),
    highPerformanceThreshold: row.high_performance_threshold ?? DEFAULT_CALIBRATION.highPerformanceThreshold,
    lowPerformanceThreshold: row.low_performance_threshold ?? DEFAULT_CALIBRATION.lowPerformanceThreshold,
    preferredCreativeStyles: parseJSON(row.preferred_creative_styles, DEFAULT_CALIBRATION.preferredCreativeStyles),
    preferredHooks: parseJSON(row.preferred_hooks, DEFAULT_CALIBRATION.preferredHooks),
    toneOfVoice: row.tone_of_voice || DEFAULT_CALIBRATION.toneOfVoice,
    campaignStrategyPreferences: parseJSON(row.campaign_strategy_preferences, DEFAULT_CALIBRATION.campaignStrategyPreferences),
    riskToleranceLevel: row.risk_tolerance_level || DEFAULT_CALIBRATION.riskToleranceLevel,
    scalingRules: parseJSON(row.scaling_rules, DEFAULT_CALIBRATION.scalingRules),
    updatedAt: row.updated_at || '',
  };
}
