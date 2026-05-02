/**
 * Agency Intelligence — Types
 *
 * Calibration + Playbooks + Templates
 * Internal only — no client visibility.
 */

// ── Calibration ──

export interface AgencyCalibration {
  id: string;
  idealCplPerIndustry: Record<string, number>;       // e.g. { "real_estate": 120, "restaurants": 40 }
  acceptableCtrRange: { min: number; max: number };   // e.g. { min: 1.5, max: 5.0 }
  highPerformanceThreshold: number;                   // CTR above this = high performer
  lowPerformanceThreshold: number;                    // CTR below this = underperformer
  preferredCreativeStyles: string[];                  // e.g. ["carousel", "video_testimonial"]
  preferredHooks: string[];                           // agency-wide preferred hooks
  toneOfVoice: string;                                // e.g. "direct, emotional, professional"
  campaignStrategyPreferences: Record<string, string>; // e.g. { "default_objective": "leads" }
  riskToleranceLevel: 'conservative' | 'moderate' | 'aggressive';
  scalingRules: ScalingRule[];
  updatedAt: string;
}

export interface ScalingRule {
  condition: string;     // e.g. "cpl_below_ideal"
  action: string;        // e.g. "scale_budget_20"
  description: string;   // Hebrew description
}

// ── Playbooks ──

export interface AgencyPlaybook {
  id: string;
  industry: string;
  name: string;
  description: string;
  painPoints: string[];
  hooks: PlaybookHook[];
  angles: string[];
  ctas: PlaybookCTA[];
  audienceStrategy: string;
  campaignStructure: string;
  contentIdeas: string[];
  whatToAvoid: string[];
  updatedAt: string;
  createdAt: string;
}

export interface PlaybookHook {
  text: string;
  type: 'fear' | 'curiosity' | 'social_proof' | 'urgency' | 'benefit' | 'emotion';
  notes?: string;
}

export interface PlaybookCTA {
  text: string;
  type: 'soft' | 'direct' | 'urgency' | 'value';
}

// ── Templates ──

export interface CampaignTemplate {
  id: string;
  industry: string;
  name: string;
  objective: string;
  structure: string;          // e.g. "1 campaign, 3 ad sets, 2 ads each"
  adSetPresets: AdSetPreset[];
  budgetLogic: string;
  notes: string;
  updatedAt: string;
}

export interface AdSetPreset {
  name: string;
  targeting: string;
  placement: string;
}

export interface AdTemplate {
  id: string;
  industry: string;
  name: string;
  hookText: string;
  bodyText: string;
  ctaText: string;
  structure: 'image' | 'video' | 'carousel';
  notes: string;
  updatedAt: string;
}

export interface ContentTemplate {
  id: string;
  industry: string;
  name: string;
  videoIdea: string;
  hookAngle: string;
  format: string;
  notes: string;
  updatedAt: string;
}

// ── Playbook Injection Result ──

export interface PlaybookInjection {
  industry: string;
  playbook: AgencyPlaybook | null;
  suggestedHooks: string[];
  suggestedCTAs: string[];
  suggestedAngles: string[];
  suggestedStructure: string;
  contentIdeas: string[];
  calibration: {
    idealCPL: number | null;
    ctrRange: { min: number; max: number };
    riskLevel: string;
    scalingRules: ScalingRule[];
  };
  templates: {
    campaigns: CampaignTemplate[];
    ads: AdTemplate[];
    content: ContentTemplate[];
  };
}

// ── Learning Suggestion ──

export interface LearningSuggestion {
  id: string;
  industry: string;
  type: 'hook' | 'cta' | 'angle' | 'content_idea' | 'what_to_avoid';
  text: string;
  reason: string;
  confidence: number;
  source: string;       // e.g. "campaign_123 — CTR 4.5%"
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}
