/**
 * Playbook Injection
 *
 * Combines playbook + calibration + templates for a given industry.
 * Used by Campaign Builder, Gantt, Podcast Engine, AI Strategy
 * to get contextual suggestions.
 *
 * Usage:
 * const injection = await getPlaybookInjection('real_estate');
 * // injection.suggestedHooks → ['כמה עולה לחכות...', ...]
 * // injection.calibration.idealCPL → 120
 * // injection.templates.campaigns → [CampaignTemplate, ...]
 */

import { getPlaybook } from './playbooks';
import { getCalibration } from './calibration';
import { getCampaignTemplates, getAdTemplates, getContentTemplates } from './templates';
import type { PlaybookInjection } from './types';

// ── Main Injection ──

export async function getPlaybookInjection(industry: string): Promise<PlaybookInjection> {
  const [playbook, calibration, campaignTemplates, adTemplates, contentTemplates] = await Promise.all([
    getPlaybook(industry),
    getCalibration(),
    getCampaignTemplates(industry),
    getAdTemplates(industry),
    getContentTemplates(industry),
  ]);

  return {
    industry,
    playbook,
    suggestedHooks: playbook?.hooks.map(h => h.text) || [],
    suggestedCTAs: playbook?.ctas.map(c => c.text) || [],
    suggestedAngles: playbook?.angles || [],
    suggestedStructure: playbook?.campaignStructure || '',
    contentIdeas: playbook?.contentIdeas || [],
    calibration: {
      idealCPL: calibration.idealCplPerIndustry[industry] || calibration.idealCplPerIndustry.general || null,
      ctrRange: calibration.acceptableCtrRange,
      riskLevel: calibration.riskToleranceLevel,
      scalingRules: calibration.scalingRules,
    },
    templates: {
      campaigns: campaignTemplates,
      ads: adTemplates,
      content: contentTemplates,
    },
  };
}

// ── Targeted Injections (lightweight, for specific consumers) ──

/** Campaign Builder — hooks, CTAs, structure, campaign templates */
export async function injectForCampaignBuilder(industry: string) {
  const injection = await getPlaybookInjection(industry);
  return {
    hooks: injection.suggestedHooks,
    ctas: injection.suggestedCTAs,
    angles: injection.suggestedAngles,
    structure: injection.suggestedStructure,
    campaignTemplates: injection.templates.campaigns,
    adTemplates: injection.templates.ads,
    idealCPL: injection.calibration.idealCPL,
    toneOfVoice: injection.playbook ? undefined : undefined, // from calibration if needed
  };
}

/** Gantt / Content Planner — content ideas, formats, templates */
export async function injectForGantt(industry: string) {
  const injection = await getPlaybookInjection(industry);
  return {
    contentIdeas: injection.contentIdeas,
    contentTemplates: injection.templates.content,
    angles: injection.suggestedAngles,
    whatToAvoid: injection.playbook?.whatToAvoid || [],
  };
}

/** Podcast Engine — questions based on pain points, hooks, angles */
export async function injectForPodcast(industry: string) {
  const injection = await getPlaybookInjection(industry);
  const questions: string[] = [];

  // Generate interview-style questions from pain points
  if (injection.playbook?.painPoints) {
    for (const pain of injection.playbook.painPoints) {
      questions.push(`מה הכי מטריד את הלקוחות שלך בנושא ${pain}?`);
    }
  }

  // Generate questions from angles
  if (injection.suggestedAngles.length > 0) {
    for (const angle of injection.suggestedAngles.slice(0, 3)) {
      questions.push(`איך אתה מציג את הנושא של ${angle} ללקוחות?`);
    }
  }

  // Add audience-based question
  if (injection.playbook?.audienceStrategy) {
    questions.push(`מי הקהל העיקרי שלך ואיך אתה מגיע אליו?`);
  }

  return {
    suggestedQuestions: questions,
    painPoints: injection.playbook?.painPoints || [],
    angles: injection.suggestedAngles,
    audienceStrategy: injection.playbook?.audienceStrategy || '',
  };
}

/** AI Strategy — calibration thresholds, scaling rules, performance context */
export async function injectForStrategy(industry: string) {
  const injection = await getPlaybookInjection(industry);
  return {
    idealCPL: injection.calibration.idealCPL,
    ctrRange: injection.calibration.ctrRange,
    riskLevel: injection.calibration.riskLevel,
    scalingRules: injection.calibration.scalingRules,
    audienceStrategy: injection.playbook?.audienceStrategy || '',
    campaignStructure: injection.suggestedStructure,
    whatToAvoid: injection.playbook?.whatToAvoid || [],
  };
}
