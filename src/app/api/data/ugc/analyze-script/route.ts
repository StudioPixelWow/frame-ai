/**
 * POST /api/data/ugc/analyze-script
 *
 * Script-to-Scene AI Intelligence
 * Analyzes a Hebrew UGC script and generates scene beats for the
 * Remotion branded video composition.
 *
 * Input: { script, brandName, totalDurationSec, format, visualStyle? }
 * Output: { scenes: SceneBeat[], suggestedStyle, musicMood }
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateWithAI } from '@/lib/ai/openai-client';

interface SceneBeatOutput {
  id: string;
  type: 'hook' | 'brand_reveal' | 'value_prop' | 'product_focus' | 'benefits' | 'social_proof' | 'cta';
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
  motionPreset: 'static' | 'slow-zoom' | 'drift' | 'pulse' | 'parallax';
}

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

    const systemPrompt = `You are a premium video director AI that analyzes spoken scripts and creates precise scene-by-scene breakdowns for branded marketing videos.

You receive a Hebrew script for a UGC-style marketing video and must output a structured JSON array of scene beats.

RULES:
1. The total duration is ${totalDurationSec} seconds. Scene timings must cover 0 to ${totalDurationSec} exactly.
2. Every scene must have a start and end time with no gaps or overlaps.
3. Scene types and their purposes:
   - "hook" (1-5 sec): Opening grab — bold, attention-catching. Avatar large, maybe a text hook.
   - "brand_reveal" (2-4 sec): Show the brand — logo prominent, avatar smaller.
   - "value_prop" (3-8 sec): Core value proposition — avatar speaking, text overlay with key point.
   - "product_focus" (3-6 sec): Show the product — avatar small or hidden, product image large.
   - "benefits" (3-8 sec): Feature/benefit list — avatar speaking with benefit overlay.
   - "social_proof" (2-5 sec): Testimonial/trust — avatar speaking, clean layout.
   - "cta" (3-5 sec): Final call-to-action — no avatar, brand + CTA text + logo.

4. A video MUST have: at least one "hook" at the start and one "cta" at the end.
5. The "cta" scene should always be last with avatarScale: 0 (no avatar, just brand card).
6. Vary avatarPosition across scenes for visual interest (don't keep center for everything).
7. The "overlay" field is a SHORT Hebrew text (max 6 words) shown on screen — key headline per scene.
8. Assign transitions: first scene = "fade", last = "fade", vary others between "cut", "slide", "zoom", "blur".
9. motionPreset: hook = "pulse" or "slow-zoom", cta = "static", others vary.
10. avatarScale: 0 means avatar hidden, 0.5 = small with room for graphics, 0.85 = full screen.
11. ${hasLogo ? 'Logo is available — set showLogo: true on hook, brand_reveal, and cta scenes.' : 'No logo uploaded — keep showLogo: false everywhere.'}
12. ${hasProductImage ? 'Product image is available — set showProduct: true on product_focus and optionally value_prop scenes.' : 'No product image — keep showProduct: false everywhere.'}

FORMAT: ${format}
VIDEO STYLE: ${visualStyle || 'cinematic-dark'}

Output ONLY valid JSON: { "scenes": [...], "suggestedStyle": "style-id", "musicMood": "mood description" }

The "suggestedStyle" should be one of: cinematic-dark, clean-minimal, bold-energy, luxury-gold, neon-glow, organic-warm, corporate-pro, social-pop.
The "musicMood" should be a short English description like "upbeat corporate" or "dramatic cinematic" or "chill lifestyle".`;

    const userPrompt = `Analyze this Hebrew marketing script and create scene beats:

BRAND: ${brandName || 'Unknown'}
SCRIPT:
${script}

Total duration: ${totalDurationSec} seconds.
Generate the optimal scene breakdown as JSON.`;

    const result = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.4,
    });

    if (!result.success) {
      console.error('[analyze-script] AI generation failed:', result.error);
      const fallback = buildDefaultScenes(totalDurationSec, hasLogo, hasProductImage);
      return NextResponse.json(fallback);
    }

    // Parse the AI response
    let parsed: { scenes: SceneBeatOutput[]; suggestedStyle?: string; musicMood?: string };
    try {
      // generateWithAI returns { success: true, data: parsed_json_or_string }
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
      parsed = buildDefaultScenes(totalDurationSec, hasLogo, hasProductImage);
    }

    // Validate and fix scene timings
    if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      parsed = buildDefaultScenes(totalDurationSec, hasLogo, hasProductImage);
    }

    // Ensure scenes cover the full duration
    const lastScene = parsed.scenes[parsed.scenes.length - 1];
    if (lastScene && Math.abs(lastScene.endSec - totalDurationSec) > 1) {
      lastScene.endSec = totalDurationSec;
    }

    // Ensure IDs
    parsed.scenes = parsed.scenes.map((s, i) => ({
      ...s,
      id: s.id || `scene_${i}`,
    }));

    return NextResponse.json({
      scenes: parsed.scenes,
      suggestedStyle: parsed.suggestedStyle || 'cinematic-dark',
      musicMood: parsed.musicMood || 'upbeat corporate',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[analyze-script] Error:', msg);
    return NextResponse.json({ error: `Failed to analyze script: ${msg}` }, { status: 500 });
  }
}

function buildDefaultScenes(
  totalDurationSec: number,
  hasLogo: boolean,
  hasProductImage: boolean
): { scenes: SceneBeatOutput[]; suggestedStyle: string; musicMood: string } {
  const ctaDur = Math.min(4, totalDurationSec * 0.12);
  const hookDur = Math.min(3, totalDurationSec * 0.1);
  const remaining = totalDurationSec - hookDur - ctaDur;
  const midSections = hasProductImage ? 3 : 2;
  const midDur = remaining / midSections;

  const scenes: SceneBeatOutput[] = [
    {
      id: 'scene_0',
      type: 'hook',
      startSec: 0,
      endSec: hookDur,
      text: '',
      overlay: '',
      showLogo: hasLogo,
      showProduct: false,
      bgIntensity: 0.3,
      avatarScale: 0.85,
      avatarPosition: 'center',
      transition: 'fade',
      motionPreset: 'pulse',
    },
    {
      id: 'scene_1',
      type: 'value_prop',
      startSec: hookDur,
      endSec: hookDur + midDur,
      text: '',
      overlay: '',
      showLogo: false,
      showProduct: false,
      bgIntensity: 0.4,
      avatarScale: 0.7,
      avatarPosition: 'right',
      transition: 'slide',
      motionPreset: 'slow-zoom',
    },
  ];

  let cursor = hookDur + midDur;

  if (hasProductImage) {
    scenes.push({
      id: 'scene_2',
      type: 'product_focus',
      startSec: cursor,
      endSec: cursor + midDur,
      text: '',
      overlay: '',
      showLogo: false,
      showProduct: true,
      bgIntensity: 0.6,
      avatarScale: 0.4,
      avatarPosition: 'bottom-right',
      transition: 'zoom',
      motionPreset: 'drift',
    });
    cursor += midDur;
  }

  scenes.push({
    id: `scene_${scenes.length}`,
    type: 'benefits',
    startSec: cursor,
    endSec: totalDurationSec - ctaDur,
    text: '',
    overlay: '',
    showLogo: false,
    showProduct: false,
    bgIntensity: 0.35,
    avatarScale: 0.75,
    avatarPosition: 'left',
    transition: 'slide',
    motionPreset: 'slow-zoom',
  });

  scenes.push({
    id: `scene_${scenes.length}`,
    type: 'cta',
    startSec: totalDurationSec - ctaDur,
    endSec: totalDurationSec,
    text: '',
    overlay: '',
    showLogo: hasLogo,
    showProduct: false,
    bgIntensity: 0.8,
    avatarScale: 0,
    avatarPosition: 'center',
    transition: 'fade',
    motionPreset: 'static',
  });

  return {
    scenes,
    suggestedStyle: 'cinematic-dark',
    musicMood: 'upbeat corporate',
  };
}
