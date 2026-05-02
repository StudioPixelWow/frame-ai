/**
 * POST /api/data/ugc/validate
 *
 * Post-composition validation endpoint.
 * Verifies that a generated video's scene structure meets all strict requirements:
 *   - Exactly 5 scenes in correct order (hook → problem → solution → product_highlight → cta)
 *   - Full timing coverage (0 to totalDurationSec)
 *   - Product shown in correct scenes (if product image was provided)
 *   - CTA is a proper end card (no avatar, logo lockup)
 *   - Hook is dynamic (not static)
 *   - Avatar position variety (3+ unique positions)
 *   - Transition variety (3+ unique transitions)
 *   - No dead air (no static + no overlay scenes)
 *
 * Input: { scenes, totalDurationSec, hasLogo, hasProductImage }
 * Output: { passed, checks: [{name, passed, detail}], failureConditions }
 */

import { NextRequest, NextResponse } from 'next/server';

interface SceneBeat {
  id: string;
  type: string;
  startSec: number;
  endSec: number;
  text: string;
  overlay?: string;
  showLogo: boolean;
  showProduct: boolean;
  bgIntensity: number;
  avatarScale: number;
  avatarPosition: string;
  transition: string;
  motionPreset: string;
}

const MANDATORY_ORDER = ['hook', 'problem', 'solution', 'product_highlight', 'cta'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      scenes,
      totalDurationSec = 30,
      hasLogo = false,
      hasProductImage = false,
    } = body;

    if (!scenes || !Array.isArray(scenes)) {
      return NextResponse.json({ error: 'scenes array is required' }, { status: 400 });
    }

    const checks: { name: string; passed: boolean; detail: string }[] = [];
    const failureConditions: string[] = [];

    // 1. Scene count
    const countOk = scenes.length === 5;
    checks.push({ name: 'scene_count', passed: countOk, detail: `${scenes.length}/5 scenes` });
    if (!countOk) failureConditions.push('Wrong number of scenes (must be exactly 5)');

    // 2. Scene order
    const actualOrder = scenes.map((s: SceneBeat) => s.type);
    const orderOk = MANDATORY_ORDER.every((t, i) => actualOrder[i] === t);
    checks.push({ name: 'scene_order', passed: orderOk, detail: actualOrder.join(' → ') });
    if (!orderOk) failureConditions.push('Scene order incorrect (must be hook→problem→solution→product_highlight→cta)');

    // 3. Timing coverage
    const startsOk = scenes.length > 0 && Math.abs(scenes[0].startSec) < 0.2;
    const endsOk = scenes.length > 0 && Math.abs(scenes[scenes.length - 1].endSec - totalDurationSec) < 0.5;
    const timingOk = startsOk && endsOk;
    checks.push({ name: 'timing_coverage', passed: timingOk, detail: `0–${scenes[scenes.length - 1]?.endSec}s (target: 0–${totalDurationSec}s)` });
    if (!timingOk) failureConditions.push('Timing does not cover full duration');

    // 4. No timing gaps
    let gapFound = false;
    for (let i = 1; i < scenes.length; i++) {
      if (Math.abs(scenes[i].startSec - scenes[i - 1].endSec) > 0.2) {
        gapFound = true;
        break;
      }
    }
    checks.push({ name: 'no_gaps', passed: !gapFound, detail: gapFound ? 'Gap found between scenes' : 'Seamless' });
    if (gapFound) failureConditions.push('Gap between scenes (dead air)');

    // 5. Product visibility
    if (hasProductImage) {
      const solScene = scenes.find((s: SceneBeat) => s.type === 'solution');
      const prodScene = scenes.find((s: SceneBeat) => s.type === 'product_highlight');
      const productOk = !!(solScene?.showProduct && prodScene?.showProduct);
      checks.push({ name: 'product_shown', passed: productOk, detail: productOk ? 'Product in solution + highlight' : 'MISSING' });
      if (!productOk) failureConditions.push('Product not shown in required scenes');
    }

    // 6. CTA end card
    const ctaScene = scenes.find((s: SceneBeat) => s.type === 'cta');
    const ctaOk = !!ctaScene && ctaScene.avatarScale === 0;
    checks.push({ name: 'cta_endcard', passed: ctaOk, detail: `CTA avatar: ${ctaScene?.avatarScale ?? 'N/A'}` });
    if (!ctaOk) failureConditions.push('CTA is not a proper end card (avatar should be hidden)');

    // 7. Logo in CTA
    if (hasLogo) {
      const logoOk = !!ctaScene?.showLogo;
      checks.push({ name: 'logo_cta', passed: logoOk, detail: logoOk ? 'Logo in CTA' : 'MISSING' });
      if (!logoOk) failureConditions.push('Logo missing from CTA end card');
    }

    // 8. Hook is dynamic
    const hookScene = scenes.find((s: SceneBeat) => s.type === 'hook');
    const hookOk = !!hookScene && hookScene.motionPreset !== 'static';
    checks.push({ name: 'hook_dynamic', passed: hookOk, detail: `Hook motion: ${hookScene?.motionPreset ?? 'N/A'}` });
    if (!hookOk) failureConditions.push('Hook is static — must have dynamic motion');

    // 9. Position variety
    const positions = scenes.filter((s: SceneBeat) => s.avatarScale > 0).map((s: SceneBeat) => s.avatarPosition);
    const uniquePos = new Set(positions).size;
    const posOk = uniquePos >= 3;
    checks.push({ name: 'position_variety', passed: posOk, detail: `${uniquePos} unique positions (need 3+)` });
    if (!posOk) failureConditions.push('Not enough avatar position variety (static talking head)');

    // 10. Transition variety
    const trans = new Set(scenes.map((s: SceneBeat) => s.transition)).size;
    const transOk = trans >= 3;
    checks.push({ name: 'transition_variety', passed: transOk, detail: `${trans} unique transitions (need 3+)` });
    if (!transOk) failureConditions.push('Not enough transition variety');

    // 11. No dead air
    const deadScenes = scenes.filter((s: SceneBeat) => s.motionPreset === 'static' && !s.overlay && s.type !== 'cta');
    const deadOk = deadScenes.length === 0;
    checks.push({ name: 'no_dead_air', passed: deadOk, detail: deadOk ? 'Clean' : `${deadScenes.length} dead scene(s)` });
    if (!deadOk) failureConditions.push('Dead air detected (static scene without overlay)');

    // 12. No single-scene video
    const singleScene = scenes.length <= 1;
    checks.push({ name: 'not_single_scene', passed: !singleScene, detail: singleScene ? 'SINGLE SCENE' : 'Multi-scene' });
    if (singleScene) failureConditions.push('Single static scene only');

    // 13. Each scene has visual motion
    const allDynamic = scenes.every((s: SceneBeat) =>
      s.type === 'cta' || s.motionPreset !== 'static' || !!s.overlay
    );
    checks.push({ name: 'all_dynamic', passed: allDynamic, detail: allDynamic ? 'All scenes have motion' : 'Some scenes lack motion' });
    if (!allDynamic) failureConditions.push('Avatar speaking entire time without visual changes');

    const passed = checks.every(c => c.passed);

    return NextResponse.json({
      passed,
      checks,
      failureConditions,
      summary: passed
        ? 'Video meets all cinematic structure requirements'
        : `FAILED: ${failureConditions.join('; ')}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Validation failed: ${msg}` }, { status: 500 });
  }
}
