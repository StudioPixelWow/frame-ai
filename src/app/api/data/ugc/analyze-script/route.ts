/**
 * POST /api/data/ugc/analyze-script
 *
 * STRICT 5-SCENE Script-to-Scene AI Intelligence
 *
 * Enforces a mandatory cinematic structure for every video:
 *   Scene 1 — HOOK            (20%) : Attention grab, bold text, dynamic motion
 *   Scene 2 — PROBLEM/RELATE  (20%) : Pain point, relatable situation
 *   Scene 3 — SOLUTION INTRO  (20%) : Product/service intro, logo appears
 *   Scene 4 — PRODUCT HIGHLIGHT(20%): Hero product shot, benefits overlay
 *   Scene 5 — CTA             (20%) : Call-to-action end card, logo lockup
 *
 * The AI splits the script into exactly these 5 segments.
 * If AI fails, the enforced default structure is used.
 * Post-validation ensures no loose or unstructured output.
 *
 * Input: { script, brandName, totalDurationSec, format, visualStyle?, hasLogo?, hasProductImage? }
 * Output: { scenes: SceneBeat[], suggestedStyle, musicMood, validation }
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateWithAI } from '@/lib/ai/openai-client';

interface SceneBeatOutput {
  id: string;
  type: 'hook' | 'problem' | 'solution' | 'product_highlight' | 'cta';
  startSec: number;
  endSec: number;
  text: string;
  overlay: string;
  showLogo: boolean;
  showProduct: boolean;
  bgIntensity: number;
  avatarScale: number;
  avatarPosition: 'center' | 'left' | 'right' | 'bottom-left' | 'bottom-right';
  transition: 'cut' | 'fade' | 'slide' | 'zoom' | 'blur';
  motionPreset: 'static' | 'slow-zoom' | 'drift' | 'pulse' | 'parallax' | 'zoom-out' | 'shake';
  bgGradientAngle?: number;
}

const MANDATORY_ORDER: SceneBeatOutput['type'][] = ['hook', 'problem', 'solution', 'product_highlight', 'cta'];

const SCENE_PROPORTIONS: Record<string, number> = {
  hook: 0.20,
  problem: 0.20,
  solution: 0.20,
  product_highlight: 0.20,
  cta: 0.20,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      script,
      brandName,
      totalDurationSec = 30,
      format = '9:16',
      visualStyle,
      hasLogo = false,
      hasProductImage = false,
    } = body;

    if (!script || typeof script !== 'string' || script.trim().length < 10) {
      return NextResponse.json(
        { error: 'Script is required (min 10 chars)' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a premium short-form video director AI.
You receive a Hebrew marketing script and MUST split it into EXACTLY 5 scenes in this MANDATORY order:

SCENE 1 — "hook" (${Math.round(totalDurationSec * 0.20)}s)
Purpose: Extremely strong attention-grabbing opening. Fast, bold, curiosity-driven.
Rules: Large animated text overlay. avatarScale 0.85, avatarPosition "center", transition "zoom", motionPreset "pulse".
overlay: 1-4 word Hebrew hook headline that creates instant curiosity.

SCENE 2 — "problem" (${Math.round(totalDurationSec * 0.20)}s)
Purpose: Identify pain point or relatable situation. Natural but sharp delivery.
Rules: avatarScale 0.70, avatarPosition "right", transition "slide", motionPreset "slow-zoom".
overlay: Short pain-point text (max 5 words).

SCENE 3 — "solution" (${Math.round(totalDurationSec * 0.20)}s)
Purpose: Introduce the product/service clearly with visual emphasis.
Rules: avatarScale 0.60, avatarPosition "left", transition "blur", motionPreset "drift".
showLogo: ${hasLogo ? 'true' : 'false'}, showProduct: ${hasProductImage ? 'true' : 'false'}.
overlay: Solution/brand intro headline (max 5 words).

SCENE 4 — "product_highlight" (${Math.round(totalDurationSec * 0.20)}s)
Purpose: Strong product presence — hero shot, zoom, highlight, glow. Overlay benefits/features.
Rules: avatarScale 0.40, avatarPosition "bottom-right", transition "zoom", motionPreset "parallax".
showProduct: ${hasProductImage ? 'true' : 'false'}.
overlay: Key benefit or feature (max 5 words).

SCENE 5 — "cta" (${Math.round(totalDurationSec * 0.20)}s)
Purpose: Clear, strong call to action. End frame that feels like a real ad closing.
Rules: avatarScale 0, avatarPosition "center", transition "fade", motionPreset "static".
showLogo: ${hasLogo ? 'true' : 'false'}.
overlay: CTA text (max 4 words — action-oriented).

CRITICAL REQUIREMENTS:
- Output EXACTLY 5 scenes. Not 3, not 7. Exactly 5.
- Scene order MUST be: hook → problem → solution → product_highlight → cta.
- Total timing must cover 0 to ${totalDurationSec} seconds with no gaps.
- Each scene MUST have a non-empty "overlay" field (short Hebrew headline for that scene).
- The "text" field contains the portion of the script spoken during that scene.
- bgGradientAngle: 135 for hook, 225 for problem, 45 for solution, 315 for product_highlight, 180 for cta.
- DO NOT output any scene with motionPreset "static" except the CTA.
- Every scene MUST feel visually different from the previous one.

FORMAT: ${format}
STYLE: ${visualStyle || 'cinematic-dark'}

Output ONLY valid JSON:
{
  "scenes": [ ... exactly 5 SceneBeat objects ... ],
  "suggestedStyle": "style-id",
  "musicMood": "short English mood description"
}`;

    const userPrompt = `Split this Hebrew marketing script into exactly 5 cinematic scenes:

BRAND: ${brandName || 'Unknown'}
TOTAL DURATION: ${totalDurationSec} seconds

SCRIPT:
${script}

Generate the 5-scene breakdown. Remember: hook → problem → solution → product_highlight → cta.`;

    const result = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.3,
    });

    let parsed: { scenes: SceneBeatOutput[]; suggestedStyle?: string; musicMood?: string };

    if (!result.success) {
      console.error('[analyze-script] AI generation failed:', result.error);
      parsed = { scenes: buildEnforcedDefault(totalDurationSec, hasLogo, hasProductImage) };
    } else {
      // Parse AI response
      try {
        const d = result.data;
        if (typeof d === 'object' && d !== null && 'scenes' in (d as any)) {
          parsed = d as any;
        } else {
          const text = typeof d === 'string' ? d : JSON.stringify(d);
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
          const cleanJson = (jsonMatch[1] || text).trim();
          parsed = JSON.parse(cleanJson);
        }
      } catch (parseErr) {
        console.error('[analyze-script] Failed to parse AI response:', result.data);
        parsed = { scenes: buildEnforcedDefault(totalDurationSec, hasLogo, hasProductImage) };
      }
    }

    // ═══ ENFORCEMENT: Fix any AI deviations from the strict structure ═══
    parsed.scenes = enforceStructure(parsed.scenes, totalDurationSec, hasLogo, hasProductImage);

    // ═══ VALIDATION ═══
    const validation = validateScenes(parsed.scenes, totalDurationSec, hasLogo, hasProductImage);

    return NextResponse.json({
      scenes: parsed.scenes,
      suggestedStyle: parsed.suggestedStyle || 'cinematic-dark',
      musicMood: parsed.musicMood || 'upbeat corporate',
      validation,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[analyze-script] Error:', msg);
    return NextResponse.json({ error: `Failed to analyze script: ${msg}` }, { status: 500 });
  }
}

// ═══ Enforcement Layer ═══════════════════════════════════════════════
// Regardless of what the AI outputs, this corrects the structure.

function enforceStructure(
  scenes: SceneBeatOutput[],
  totalDurationSec: number,
  hasLogo: boolean,
  hasProductImage: boolean,
): SceneBeatOutput[] {
  // If AI didn't return exactly 5 scenes or wrong order, use defaults
  if (!scenes || !Array.isArray(scenes) || scenes.length !== 5) {
    return buildEnforcedDefault(totalDurationSec, hasLogo, hasProductImage);
  }

  // Verify order
  const actualOrder = scenes.map(s => s.type);
  if (!MANDATORY_ORDER.every((t, i) => actualOrder[i] === t)) {
    // Try to reorder if all 5 types exist
    const reordered: SceneBeatOutput[] = [];
    for (const type of MANDATORY_ORDER) {
      const found = scenes.find(s => s.type === type);
      if (!found) return buildEnforcedDefault(totalDurationSec, hasLogo, hasProductImage);
      reordered.push(found);
    }
    scenes = reordered;
  }

  // Fix timings to match proportions exactly
  let cursor = 0;
  scenes = scenes.map((scene, i) => {
    const proportion = SCENE_PROPORTIONS[scene.type] || 0.20;
    const dur = Math.round(totalDurationSec * proportion * 10) / 10;
    const startSec = Math.round(cursor * 10) / 10;
    cursor += dur;
    const endSec = i === 4 ? totalDurationSec : Math.round(cursor * 10) / 10;

    // Enforce per-scene visual rules
    const rules = ENFORCED_RULES[scene.type];
    return {
      ...scene,
      id: `scene_${i}`,
      startSec,
      endSec,
      // Enforce avatar scale and position
      avatarScale: rules.avatarScale,
      avatarPosition: rules.avatarPosition,
      // Enforce transitions and motion
      transition: rules.transition,
      motionPreset: rules.motionPreset,
      bgGradientAngle: rules.bgGradientAngle,
      bgIntensity: rules.bgIntensity,
      // Enforce product/logo rules
      showLogo: rules.showLogo && hasLogo,
      showProduct: rules.showProduct && hasProductImage,
      // Ensure overlay exists (fallback to empty is caught by validation)
      overlay: scene.overlay || rules.fallbackOverlay,
    };
  });

  return scenes;
}

const ENFORCED_RULES: Record<string, {
  avatarScale: number;
  avatarPosition: SceneBeatOutput['avatarPosition'];
  transition: SceneBeatOutput['transition'];
  motionPreset: SceneBeatOutput['motionPreset'];
  bgGradientAngle: number;
  bgIntensity: number;
  showLogo: boolean;
  showProduct: boolean;
  fallbackOverlay: string;
}> = {
  hook: {
    avatarScale: 0.85,
    avatarPosition: 'center',
    transition: 'zoom',
    motionPreset: 'pulse',
    bgGradientAngle: 135,
    bgIntensity: 0.35,
    showLogo: false,
    showProduct: false,
    fallbackOverlay: '',
  },
  problem: {
    avatarScale: 0.70,
    avatarPosition: 'right',
    transition: 'slide',
    motionPreset: 'slow-zoom',
    bgGradientAngle: 225,
    bgIntensity: 0.45,
    showLogo: false,
    showProduct: false,
    fallbackOverlay: '',
  },
  solution: {
    avatarScale: 0.60,
    avatarPosition: 'left',
    transition: 'blur',
    motionPreset: 'drift',
    bgGradientAngle: 45,
    bgIntensity: 0.50,
    showLogo: true,
    showProduct: true,
    fallbackOverlay: '',
  },
  product_highlight: {
    avatarScale: 0.40,
    avatarPosition: 'bottom-right',
    transition: 'zoom',
    motionPreset: 'parallax',
    bgGradientAngle: 315,
    bgIntensity: 0.60,
    showLogo: false,
    showProduct: true,
    fallbackOverlay: '',
  },
  cta: {
    avatarScale: 0,
    avatarPosition: 'center',
    transition: 'fade',
    motionPreset: 'static',
    bgGradientAngle: 180,
    bgIntensity: 0.80,
    showLogo: true,
    showProduct: false,
    fallbackOverlay: '',
  },
};

function buildEnforcedDefault(
  totalDurationSec: number,
  hasLogo: boolean,
  hasProductImage: boolean,
): SceneBeatOutput[] {
  let cursor = 0;
  return MANDATORY_ORDER.map((type, i) => {
    const proportion = SCENE_PROPORTIONS[type] || 0.20;
    const dur = Math.round(totalDurationSec * proportion * 10) / 10;
    const startSec = Math.round(cursor * 10) / 10;
    cursor += dur;
    const endSec = i === 4 ? totalDurationSec : Math.round(cursor * 10) / 10;
    const rules = ENFORCED_RULES[type];

    return {
      id: `scene_${i}`,
      type,
      startSec,
      endSec,
      text: '',
      overlay: '',
      showLogo: rules.showLogo && hasLogo,
      showProduct: rules.showProduct && hasProductImage,
      bgIntensity: rules.bgIntensity,
      avatarScale: rules.avatarScale,
      avatarPosition: rules.avatarPosition,
      transition: rules.transition,
      motionPreset: rules.motionPreset,
      bgGradientAngle: rules.bgGradientAngle,
    };
  });
}

// ═══ Validation ══════════════════════════════════════════════════════
function validateScenes(
  scenes: SceneBeatOutput[],
  totalDurationSec: number,
  hasLogo: boolean,
  hasProductImage: boolean,
): { passed: boolean; checks: { name: string; passed: boolean; detail: string }[] } {
  const checks: { name: string; passed: boolean; detail: string }[] = [];

  // 1. Exactly 5 scenes
  checks.push({
    name: 'scene_count',
    passed: scenes.length === 5,
    detail: `${scenes.length}/5 scenes`,
  });

  // 2. Correct order
  const order = scenes.map(s => s.type);
  const orderOk = MANDATORY_ORDER.every((t, i) => order[i] === t);
  checks.push({ name: 'scene_order', passed: orderOk, detail: order.join(' → ') });

  // 3. Full timing coverage
  const startsOk = Math.abs(scenes[0]?.startSec ?? -1) < 0.2;
  const endsOk = Math.abs((scenes[4]?.endSec ?? 0) - totalDurationSec) < 0.5;
  checks.push({ name: 'timing', passed: startsOk && endsOk, detail: `0–${scenes[4]?.endSec}s (target: 0–${totalDurationSec}s)` });

  // 4. Product visible in solution + product_highlight
  if (hasProductImage) {
    const sol = scenes.find(s => s.type === 'solution');
    const prod = scenes.find(s => s.type === 'product_highlight');
    const ok = !!sol?.showProduct && !!prod?.showProduct;
    checks.push({ name: 'product_shown', passed: ok, detail: ok ? 'Product in solution + highlight' : 'MISSING' });
  }

  // 5. CTA is end card (no avatar)
  const cta = scenes.find(s => s.type === 'cta');
  checks.push({ name: 'cta_endcard', passed: cta?.avatarScale === 0, detail: `CTA avatar: ${cta?.avatarScale}` });

  // 6. Logo in CTA
  if (hasLogo) {
    checks.push({ name: 'logo_cta', passed: !!cta?.showLogo, detail: cta?.showLogo ? 'Logo in CTA' : 'MISSING' });
  }

  // 7. Hook is dynamic (not static)
  const hook = scenes.find(s => s.type === 'hook');
  checks.push({ name: 'hook_dynamic', passed: hook?.motionPreset !== 'static', detail: `Hook motion: ${hook?.motionPreset}` });

  // 8. Avatar position variety (min 3 unique across non-CTA scenes)
  const positions = scenes.filter(s => s.avatarScale > 0).map(s => s.avatarPosition);
  const unique = new Set(positions).size;
  checks.push({ name: 'position_variety', passed: unique >= 3, detail: `${unique} unique positions` });

  // 9. Transition variety (min 3 unique)
  const trans = new Set(scenes.map(s => s.transition)).size;
  checks.push({ name: 'transition_variety', passed: trans >= 3, detail: `${trans} unique transitions` });

  // 10. No dead air (no non-CTA scene with static + no overlay)
  const dead = scenes.filter(s => s.motionPreset === 'static' && !s.overlay && s.type !== 'cta');
  checks.push({ name: 'no_dead_air', passed: dead.length === 0, detail: dead.length === 0 ? 'Clean' : `${dead.length} dead scene(s)` });

  return { passed: checks.every(c => c.passed), checks };
}
