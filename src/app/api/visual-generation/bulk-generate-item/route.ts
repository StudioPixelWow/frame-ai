/**
 * POST /api/visual-generation/bulk-generate-item
 *
 * Processes a SINGLE Gantt item through the full visual generation pipeline.
 * Accepts { clientId, ganttItemId } and returns the generated image URLs.
 *
 * Pipeline steps:
 *  1. Auto-brief: GPT-4.1 generates 3 creative concepts
 *  2. Generate: Creative Director + image generation for each concept (3 options)
 *  3. Pick best: selects the first successful version (index 0)
 *  4. Finalize: sharp resize to FB/IG/Story variants, upload, update Gantt item
 *
 * GET /api/visual-generation/bulk-generate-item?clientId=...
 *
 * Returns list of Gantt items needing graphics + brand asset URLs for previews.
 */

import { NextRequest } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import {
  aiGenerationSessions,
  aiGenerationVersions,
  clientGanttItems,
} from '@/lib/db/collections';
import type {
  AIGenerationSession,
  AIGenerationVersion,
  ClientGanttItem,
} from '@/lib/db/schema';
import { buildGenerationContext } from '@/lib/services/visual-generation/generationContextBuilder';
import {
  gatherBrandIntelligence,
  type BrandIntelligence,
} from '@/lib/services/visual-generation/brandIntelligenceService';
import { runCreativeDirector } from '@/lib/services/visual-generation/creativeDirectorService';
import {
  generateImage,
  editImage,
} from '@/lib/services/visual-generation/openaiImageProvider';
import sharp from 'sharp';

export const maxDuration = 300;

// ── Retry config for transient OpenAI errors ────────────────────────────
const MAX_RETRIES = 2;

// ── OpenAI API key ──────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY environment variable');
  return key;
}

// ── Auto-brief system prompt (identical to bulk-generate/route.ts) ─────────

const AUTO_BRIEF_SYSTEM_PROMPT = `You are a senior Creative Director at Pixel, a premium Israeli marketing agency.

Your job: Given a marketing brief, client data, and brand intelligence, write THREE DIFFERENT creative concepts in Hebrew. Each concept is a distinct creative direction for an AI image generation system. The system will generate 3 visual options simultaneously — one from each concept.

The 3 concepts must be GENUINELY DIFFERENT from each other — different composition, different mood, different visual approach:
- Concept 1: A bold, dramatic approach (e.g., close-up, high contrast, emotional impact)
- Concept 2: A clean, professional approach (e.g., wide shot, organized layout, minimal)
- Concept 3: A creative/artistic approach (e.g., unusual angle, metaphorical, stylized)

ABSOLUTE COLOR RULE — THIS IS THE #1 PRIORITY RULE:
- You will receive a section called "ALLOWED COLORS" with exact hex codes.
- You may ONLY reference colors from that list. Copy the exact hex codes.
- Do NOT invent ANY color. Do NOT approximate. Do NOT add colors like black, white, gray, blue, red, or any color not in the list.
- If you write a hex code that is NOT in the ALLOWED COLORS list, the entire output is REJECTED.
- If no colors are provided, describe the mood/atmosphere without mentioning any specific colors or hex codes.

RULES:
1. Write in Hebrew. The instruction is for an Israeli marketing team.
2. Be specific about visual elements: what appears in the image, composition, mood, styling.
3. Every color reference must be an EXACT hex code from the ALLOWED COLORS list. No exceptions.
4. If people appear, describe their appearance, clothing, and positioning.
5. Describe the typography style — text should NEVER be on frames or banners, always elegant floating text.
6. Include the emotional tone and atmosphere.
7. Each concept should be 3-5 sentences with specific, unique creative direction.
8. The 3 concepts must look COMPLETELY DIFFERENT from each other — not variations of the same idea.

OUTPUT FORMAT — write exactly in this structure:
---CONCEPT1---
[Hebrew creative instruction for concept 1]
---CONCEPT2---
[Hebrew creative instruction for concept 2]
---CONCEPT3---
[Hebrew creative instruction for concept 3]

No explanations, no prefixes, no quotes outside the concepts.`;

// ── Size variant definitions (identical to bulk-generate/route.ts) ───────────

interface SizeVariant {
  key: string;
  label: string;
  labelHe: string;
  width: number;
  height: number;
  platform: string;
}

const SIZE_VARIANTS: SizeVariant[] = [
  { key: 'facebook', label: 'Facebook Post', labelHe: 'פייסבוק', width: 1200, height: 630, platform: 'facebook' },
  { key: 'instagram', label: 'Instagram Feed', labelHe: 'אינסטגרם', width: 1080, height: 1080, platform: 'instagram' },
  { key: 'story', label: 'Story', labelHe: 'סטורי', width: 1080, height: 1920, platform: 'story' },
];

// ── Logo compositing helper (identical to bulk-generate/route.ts) ────────────

async function compositeLogoOnBase64(
  base64: string,
  logoUrl: string,
  fallbackWidth: number,
  fallbackHeight: number,
): Promise<string> {
  try {
    const logoResp = await fetch(logoUrl);
    if (!logoResp.ok) return base64;
    const logoBuffer = Buffer.from(await logoResp.arrayBuffer());
    const imgBuffer = Buffer.from(base64, 'base64');
    const imgMeta = await sharp(imgBuffer).metadata();
    const imgWidth = imgMeta.width || fallbackWidth;
    const imgHeight = imgMeta.height || fallbackHeight;
    const targetLogoWidth = Math.round(imgWidth * 0.35);
    const resizedLogo = await sharp(logoBuffer)
      .resize({ width: targetLogoWidth, withoutEnlargement: false })
      .png()
      .toBuffer();
    const logoMeta = await sharp(resizedLogo).metadata();
    const logoH = logoMeta.height || Math.round(targetLogoWidth * 0.5);
    const leftOffset = Math.round((imgWidth - targetLogoWidth) / 2);
    const topOffset = imgHeight - logoH - Math.round(imgHeight * 0.03);
    const composited = await sharp(imgBuffer)
      .composite([{ input: resizedLogo, left: leftOffset, top: topOffset }])
      .png()
      .toBuffer();
    return composited.toString('base64');
  } catch (err) {
    console.error('[bulk-gen-item] Logo compositing error:', err);
    return base64;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal pipeline steps (copied from bulk-generate/route.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Step 1 — Auto-brief: calls GPT-4.1 to produce 3 creative concepts in Hebrew.
 */
async function runAutoBrief(
  ganttItemId: string,
  clientId: string,
  brandIntel: BrandIntelligence,
): Promise<string[]> {
  const context = await buildGenerationContext(ganttItemId, clientId);

  // Build user message
  const parts: string[] = [];

  parts.push('=== BRIEF ===');
  parts.push(`Title: ${context.ganttItem.title}`);
  if (context.ganttItem.ideaSummary) parts.push(`Concept: ${context.ganttItem.ideaSummary}`);
  if (context.ganttItem.visualConcept) parts.push(`Visual direction: ${context.ganttItem.visualConcept}`);
  if (context.ganttItem.graphicText) parts.push(`Text on graphic: "${context.ganttItem.graphicText}"`);
  if (context.ganttItem.caption) parts.push(`Caption: ${context.ganttItem.caption}`);
  if (context.ganttItem.contentType) parts.push(`Content type: ${context.ganttItem.contentType}`);
  if (context.monthTheme) parts.push(`Monthly theme: ${context.monthTheme}`);
  if (context.campaignTag) parts.push(`Campaign: ${context.campaignTag}`);
  if (context.ganttItem.holidayTag) parts.push(`Holiday: ${context.ganttItem.holidayTag}`);
  if (context.platform) parts.push(`Platform: ${context.platform}`);
  if (context.format) parts.push(`Format: ${context.format}`);

  parts.push('\n=== CLIENT ===');
  parts.push(`Name: ${context.clientName}`);
  parts.push(`Industry: ${context.businessField}`);

  parts.push('\n=== BRAND INTELLIGENCE ===');
  parts.push(brandIntel.brandRulesSummary);

  // Build ALLOWED COLORS block
  const allAllowedColors = [
    ...brandIntel.primaryColors,
    ...brandIntel.secondaryColors,
    ...brandIntel.accentColors,
  ].filter(Boolean);

  if (allAllowedColors.length > 0) {
    parts.push('\n=== ALLOWED COLORS (USE ONLY THESE — NO OTHER COLORS PERMITTED) ===');
    parts.push(allAllowedColors.join(', '));
    parts.push('ANY hex code not in this list = REJECTED OUTPUT.');
    if (brandIntel.primaryColors.length) {
      parts.push(`Primary (must dominate): ${brandIntel.primaryColors.join(', ')}`);
    }
    if (brandIntel.secondaryColors.length) {
      parts.push(`Secondary: ${brandIntel.secondaryColors.join(', ')}`);
    }
    if (brandIntel.accentColors.length) {
      parts.push(`Accent: ${brandIntel.accentColors.join(', ')}`);
    }
  } else {
    parts.push('\n=== NO BRAND COLORS DEFINED ===');
    parts.push('Do NOT mention any specific colors or hex codes. Describe mood and atmosphere only.');
  }

  if (brandIntel.forbiddenColors.length) {
    parts.push(`\nFORBIDDEN colors (NEVER use): ${brandIntel.forbiddenColors.join(', ')}`);
  }

  const apiKey = getApiKey();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: AUTO_BRIEF_SYSTEM_PROMPT },
        { role: 'user', content: parts.join('\n') },
      ],
      temperature: 0.8,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Auto-brief API error (${response.status}): ${errBody}`);
  }

  const result = await response.json();
  const rawContent = result.choices?.[0]?.message?.content?.trim();
  if (!rawContent) throw new Error('No instruction generated from auto-brief');

  // Parse 3 concepts
  const conceptMatches = rawContent.split(/---CONCEPT\d+---/).filter((s: string) => s.trim());
  const concepts: string[] = [];

  if (conceptMatches.length >= 3) {
    concepts.push(conceptMatches[0].trim());
    concepts.push(conceptMatches[1].trim());
    concepts.push(conceptMatches[2].trim());
  } else {
    // Fallback: use the whole text as concept 1
    concepts.push(rawContent);
  }

  return concepts;
}

/**
 * Step 2 — Generate 3 image options using the initial-mode pipeline.
 * Returns the created session and version records.
 */
async function runGenerate(
  ganttItemId: string,
  clientId: string,
  concepts: string[],
  brandIntel: BrandIntelligence,
  brandAssetBuffers: Buffer[],
  brandAssetUrls: string[],
): Promise<{ session: AIGenerationSession; versions: any[] }> {
  const width = 1024;
  const height = 1024;
  const quality = 'high' as const;

  const context = await buildGenerationContext(ganttItemId, clientId);

  // Build brand directive
  const brandDirectiveParts: string[] = [];
  brandDirectiveParts.push('BRAND KIT ENFORCEMENT:');
  if (brandIntel.primaryColors.length) {
    brandDirectiveParts.push(`- Primary brand colors that MUST dominate: ${brandIntel.primaryColors.join(', ')}`);
  }
  if (brandIntel.secondaryColors.length) {
    brandDirectiveParts.push(`- Secondary colors: ${brandIntel.secondaryColors.join(', ')}`);
  }
  if (brandIntel.accentColors.length) {
    brandDirectiveParts.push(`- Accent colors: ${brandIntel.accentColors.join(', ')}`);
  }
  if (brandIntel.forbiddenColors.length) {
    brandDirectiveParts.push(`- FORBIDDEN colors (never use): ${brandIntel.forbiddenColors.join(', ')}`);
  }
  if (brandIntel.preferredTypography && Object.keys(brandIntel.preferredTypography).length) {
    brandDirectiveParts.push(`- Typography: ${JSON.stringify(brandIntel.preferredTypography)}`);
  }
  if (brandIntel.visualPersonality) {
    brandDirectiveParts.push(`- Visual personality: ${brandIntel.visualPersonality}`);
  }
  if (brandIntel.preferredVisualStyles.length) {
    brandDirectiveParts.push(`- Visual styles: ${brandIntel.preferredVisualStyles.join(', ')}`);
  }
  brandDirectiveParts.push('- People in the image must wear clothing/uniforms in brand colors');
  brandDirectiveParts.push('- Text must NEVER appear on frames or banners — only elegant floating typography');
  brandDirectiveParts.push('- Brand colors should cover at least 60% of the visual surface');

  // Run Creative Director per concept
  const hasDistinctConcepts = concepts.length >= 3;
  let prompts: string[];

  if (hasDistinctConcepts) {
    console.log('[bulk-gen-item] Using 3 DISTINCT concepts from auto-brief');
    const conceptPrompts = await Promise.all(
      concepts.slice(0, 3).map(async (concept: string, idx: number) => {
        try {
          const conceptDirector = await runCreativeDirector(
            context,
            brandIntel,
            concept,
          );
          if (conceptDirector.success && conceptDirector.strategy?.optimizedImagePrompt) {
            console.log(`[bulk-gen-item] Creative Director concept ${idx + 1} — optimized prompt ready`);
            return conceptDirector.strategy.optimizedImagePrompt;
          }
        } catch (err: any) {
          console.warn(`[bulk-gen-item] Creative Director concept ${idx + 1} failed:`, err.message);
        }
        // Fallback: use the concept text directly
        return `Professional marketing visual. ${concept}. ${context.promptContext}`;
      }),
    );
    prompts = conceptPrompts;
  } else {
    // Single concept — use variation suffixes
    const VARIATION_SUFFIXES = [
      '',
      '\n\nCOMPOSITION VARIATION: Use a completely different camera angle and framing — if the original concept implies a wide/establishing shot, try a close-up intimate view instead (or vice versa). Shift the subject positioning significantly. Keep all brand colors, message, and elements the same, but reimagine the visual composition from scratch.',
      '\n\nSTYLE VARIATION: Shift the overall visual mood and atmosphere dramatically — change the lighting (e.g., warm golden hour vs cool blue hour vs dramatic high-contrast), the background environment, and the color temperature. Try a more graphic/stylized interpretation rather than photorealistic (or vice versa). Keep brand colors dominant and the marketing message identical, but create a distinctly different feel.',
    ];
    const baseInstruction = `${brandDirectiveParts.join('\n')}\n\n${concepts[0]}`;
    const directorResult = await runCreativeDirector(context, brandIntel, baseInstruction);
    const basePrompt = directorResult.success && directorResult.strategy?.optimizedImagePrompt
      ? directorResult.strategy.optimizedImagePrompt
      : `Professional marketing visual for "${context.ganttItem.title}". ${context.promptContext}. ${concepts[0]}`;
    prompts = VARIATION_SUFFIXES.map((suffix) => basePrompt + suffix);
  }

  // Generate 3 images in parallel (MAX_RETRIES is module-level)
  const genResults = await Promise.all(
    prompts.map(async (prompt, idx) => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        console.log(`[bulk-gen-item] Generating option ${idx + 1}/3${attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}...`);
        try {
          if (brandAssetBuffers.length > 0) {
            const r = await editImage({
              prompt,
              referenceImages: brandAssetBuffers,
              width,
              height,
              quality,
            });
            if (!r.success || !r.images.length) {
              const errMsg = r.error || `Option ${idx + 1} failed`;
              if (attempt < MAX_RETRIES && /50[23]|bad gateway|service unavailable|rate limit|429/i.test(errMsg)) {
                console.warn(`[bulk-gen-item] Option ${idx + 1} transient error, retrying in 3s: ${errMsg}`);
                await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
                continue;
              }
              throw new Error(errMsg);
            }
            return { base64: r.images[0].base64, revisedPrompt: r.images[0].revisedPrompt, error: null };
          }
          const r = await generateImage({ prompt, width, height, quality });
          if (!r.success || !r.images.length) {
            const errMsg = r.error || `Option ${idx + 1} failed`;
            if (attempt < MAX_RETRIES && /50[23]|bad gateway|service unavailable|rate limit|429/i.test(errMsg)) {
              console.warn(`[bulk-gen-item] Option ${idx + 1} transient error, retrying in 3s: ${errMsg}`);
              await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
              continue;
            }
            throw new Error(errMsg);
          }
          return { base64: r.images[0].base64, revisedPrompt: r.images[0].revisedPrompt, error: null };
        } catch (err: any) {
          if (attempt < MAX_RETRIES && /50[23]|bad gateway|service unavailable|rate limit|429/i.test(err.message || '')) {
            console.warn(`[bulk-gen-item] Option ${idx + 1} transient error, retrying in 3s: ${err.message}`);
            await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
            continue;
          }
          console.error(`[bulk-gen-item] Option ${idx + 1} error (final):`, err.message);
          return { base64: '', revisedPrompt: undefined as string | undefined, error: err.message as string };
        }
      }
      return { base64: '', revisedPrompt: undefined as string | undefined, error: `Option ${idx + 1} failed after ${MAX_RETRIES} retries` as string };
    }),
  );

  // Filter out failures
  const successResults = genResults.filter((r) => r.base64 && !r.error);
  if (successResults.length === 0) {
    throw new Error('All 3 image options failed to generate');
  }

  // Composite logo on all successes
  if (brandIntel.logoUrl) {
    for (const r of successResults) {
      try {
        r.base64 = await compositeLogoOnBase64(r.base64, brandIntel.logoUrl, width, height);
      } catch {
        /* continue without logo */
      }
    }
  }

  // Create session
  const session = await aiGenerationSessions.createAsync({
    clientId,
    ganttItemId,
    status: 'active',
    contextSnapshot: {
      briefSummary: `Title: ${context.ganttItem.title}. Client: ${context.clientName}. Industry: ${context.businessField}.`,
      brandRulesSummary: brandIntel.brandRulesSummary,
      creativeStrategy: null,
    },
    systemPrompt: prompts[0] || '',
    sizePreset: { label: `${width}x${height}`, width, height },
    activeVersionId: null,
    versionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Omit<AIGenerationSession, 'id'> as any) as AIGenerationSession;

  // Upload images and create version records
  const sb = getSupabase();
  const versions: any[] = [];
  const startTime = Date.now();
  const durationMs = Date.now() - startTime;

  for (let i = 0; i < successResults.length; i++) {
    const versionNumber = i + 1;
    const buffer = Buffer.from(successResults[i].base64, 'base64');
    const storagePath = `visual-generation/${clientId}/${session.id}/${versionNumber}.png`;

    const { error: uploadError } = await sb.storage
      .from('project-files')
      .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error(`[bulk-gen-item] Upload error for option ${i + 1}:`, uploadError);
      continue;
    }

    const { data: urlData } = sb.storage.from('project-files').getPublicUrl(storagePath);
    const imageUrl = urlData?.publicUrl || null;

    const version = await aiGenerationVersions.createAsync({
      sessionId: session.id,
      clientId,
      ganttItemId,
      versionNumber,
      status: 'pending',
      userInstruction: concepts[i] || concepts[0] || '',
      fullPrompt: prompts[i] || '',
      model: 'gpt-image-2',
      quality,
      width,
      height,
      imageUrl,
      thumbnailBase64: null,
      revisedPrompt: successResults[i].revisedPrompt || null,
      referenceImageUrls: brandAssetUrls,
      cost: null,
      errorMessage: null,
      durationMs,
      generationMode: 'initial',
      creativeStrategy: null,
      qualityAssessment: null,
      createdAt: new Date().toISOString(),
    } as Omit<AIGenerationVersion, 'id'> as any);

    versions.push(version);
  }

  // Update session version count
  await aiGenerationSessions.updateAsync(session.id, {
    versionCount: versions.length,
    updatedAt: new Date().toISOString(),
  });

  return { session, versions };
}

/**
 * Step 4 — Finalize: resize the chosen image into FB/IG/Story variants,
 * upload everything, and update the Gantt item.
 * Returns the image URLs and variant details.
 */
async function runFinalize(
  versionId: string,
  ganttItemId: string,
  clientId: string,
): Promise<{ imageUrls: string[]; variants: { key: string; url: string }[] }> {
  const version = (await aiGenerationVersions.getByIdAsync(versionId)) as AIGenerationVersion | null;
  if (!version || !version.imageUrl) {
    throw new Error('Version not found or has no image');
  }

  // Mark as selected
  await aiGenerationVersions.updateAsync(versionId, { status: 'selected' });
  if (version.sessionId) {
    await aiGenerationSessions.updateAsync(version.sessionId, {
      activeVersionId: versionId,
      updatedAt: new Date().toISOString(),
    });
  }

  // Download original image
  const imgResp = await fetch(version.imageUrl);
  if (!imgResp.ok) {
    throw new Error('Failed to download selected image');
  }
  const originalBuffer = Buffer.from(await imgResp.arrayBuffer());

  const sb = getSupabase();
  const sessionId = version.sessionId;

  // Start with the original image URL
  const allImageUrls: string[] = [version.imageUrl];
  const variants: { key: string; url: string }[] = [
    { key: 'original', url: version.imageUrl },
  ];

  // Generate size variants
  for (const variant of SIZE_VARIANTS) {
    console.log(`[bulk-gen-item/finalize] Generating ${variant.key}: ${variant.width}x${variant.height}...`);
    try {
      const resizedBuffer = await sharp(originalBuffer)
        .resize(variant.width, variant.height, {
          fit: 'cover',
          position: 'centre',
        })
        .png({ quality: 90 })
        .toBuffer();

      const storagePath = `visual-generation/${clientId}/${sessionId}/final_${variant.key}.png`;
      const { error: uploadError } = await sb.storage
        .from('project-files')
        .upload(storagePath, resizedBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.error(`[bulk-gen-item/finalize] Upload error for ${variant.key}:`, uploadError);
        continue;
      }

      const { data: urlData } = sb.storage.from('project-files').getPublicUrl(storagePath);
      const imageUrl = urlData?.publicUrl || '';
      if (imageUrl) {
        allImageUrls.push(imageUrl);
        variants.push({ key: variant.key, url: imageUrl });
        console.log(`[bulk-gen-item/finalize] ${variant.key} uploaded successfully`);
      }
    } catch (err: any) {
      console.error(`[bulk-gen-item/finalize] Error generating ${variant.key}:`, err.message);
    }
  }

  // Save all URLs to Gantt item and mark as approved
  const ganttItem = (await clientGanttItems.getByIdAsync(ganttItemId)) as ClientGanttItem | null;
  if (ganttItem) {
    await clientGanttItems.updateAsync(ganttItemId, {
      imageUrls: allImageUrls,
      status: 'approved',
    });
    console.log(`[bulk-gen-item/finalize] Gantt item updated — ${allImageUrls.length} images, status=approved`);
  } else {
    console.warn('[bulk-gen-item/finalize] Gantt item not found:', ganttItemId);
  }

  return { imageUrls: allImageUrls, variants };
}

// ═══════════════════════════════════════════════════════════════════════════
// POST handler — process a single Gantt item
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, ganttItemId, action, versionId, notes } = body;

    // ── action: 'refine' ────────────────────────────────────────────────
    if (action === 'refine') {
      if (!versionId || !clientId || !notes) {
        return new Response(
          JSON.stringify({ success: false, error: 'versionId, clientId and notes are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      console.log(`[bulk-gen-item] refine: versionId=${versionId}, notes="${notes.substring(0, 80)}"`);

      const origVersion = (await aiGenerationVersions.getByIdAsync(versionId)) as AIGenerationVersion | null;
      if (!origVersion || !origVersion.imageUrl) {
        return new Response(
          JSON.stringify({ success: false, error: 'Original version not found or has no image' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Download the original image as a buffer for editImage reference
      const origResp = await fetch(origVersion.imageUrl);
      if (!origResp.ok) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to download original image' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const origBuffer = Buffer.from(await origResp.arrayBuffer());

      // Also fetch brand assets (logo) for compositing later
      const brandIntel = await gatherBrandIntelligence(clientId);

      // Build the refinement prompt from original prompt + user notes
      const origPrompt = origVersion.fullPrompt || origVersion.userInstruction || '';
      const refinePrompt = `${origPrompt}\n\nIMPORTANT CORRECTIONS FROM CLIENT:\n${notes}\n\nApply the corrections while keeping the overall composition and brand identity intact.`;

      // Generate refined image using editImage with original as reference — with retry for transient errors
      let refResult: any = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        console.log(`[bulk-gen-item] refine editImage${attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}...`);
        refResult = await editImage({
          prompt: refinePrompt,
          referenceImages: [origBuffer],
          width: origVersion.width || 1024,
          height: origVersion.height || 1024,
          quality: 'high',
        });
        if (refResult.success && refResult.images?.length) break;
        const errMsg = refResult.error || 'Refinement generation failed';
        if (attempt < MAX_RETRIES && /50[23]|bad gateway|service unavailable|rate limit|429/i.test(errMsg)) {
          console.warn(`[bulk-gen-item] refine transient error, retrying in 3s: ${errMsg}`);
          await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
          continue;
        }
        break;
      }

      if (!refResult?.success || !refResult?.images?.length) {
        return new Response(
          JSON.stringify({ success: false, error: refResult?.error || 'Refinement generation failed' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }

      let refinedBase64 = refResult.images[0].base64;

      // Composite logo
      if (brandIntel.logoUrl) {
        try {
          refinedBase64 = await compositeLogoOnBase64(
            refinedBase64,
            brandIntel.logoUrl,
            origVersion.width || 1024,
            origVersion.height || 1024,
          );
        } catch { /* continue without logo */ }
      }

      // Upload refined image
      const sb = getSupabase();
      const sessionId = origVersion.sessionId;
      const newVersionNumber = (origVersion.versionNumber || 1) * 10 + 1; // e.g., 11, 21, 31
      const buffer = Buffer.from(refinedBase64, 'base64');
      const storagePath = `visual-generation/${clientId}/${sessionId}/refined_${versionId}_${Date.now()}.png`;

      const { error: uploadError } = await sb.storage
        .from('project-files')
        .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

      if (uploadError) {
        console.error('[bulk-gen-item] Refined upload error:', uploadError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to upload refined image' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const { data: urlData } = sb.storage.from('project-files').getPublicUrl(storagePath);
      const newImageUrl = urlData?.publicUrl || '';

      // Create new version record
      const newVersion = await aiGenerationVersions.createAsync({
        sessionId,
        clientId,
        ganttItemId: origVersion.ganttItemId,
        versionNumber: newVersionNumber,
        status: 'pending',
        userInstruction: notes,
        fullPrompt: refinePrompt,
        model: 'gpt-image-2',
        quality: 'high',
        width: origVersion.width || 1024,
        height: origVersion.height || 1024,
        imageUrl: newImageUrl,
        thumbnailBase64: null,
        revisedPrompt: refResult.images[0].revisedPrompt || null,
        referenceImageUrls: [origVersion.imageUrl],
        cost: null,
        errorMessage: null,
        durationMs: 0,
        generationMode: 'refine',
        creativeStrategy: null,
        qualityAssessment: null,
        createdAt: new Date().toISOString(),
      } as any);

      console.log(`[bulk-gen-item] refine complete — new version ${(newVersion as any).id}`);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'refine',
          version: {
            id: (newVersion as any).id,
            imageUrl: newImageUrl,
            versionNumber: newVersionNumber,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── action: 'save-with-variants' ─────────────────────────────────────
    if (action === 'save-with-variants') {
      if (!versionId || !ganttItemId || !clientId) {
        return new Response(
          JSON.stringify({ success: false, error: 'versionId, ganttItemId and clientId are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      console.log(`[bulk-gen-item] save-with-variants: versionId=${versionId}, ganttItemId=${ganttItemId}`);
      const { imageUrls, variants } = await runFinalize(versionId, ganttItemId, clientId);
      return new Response(
        JSON.stringify({ success: true, action: 'save-with-variants', imageUrls, variants }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── action: 'save-single' ────────────────────────────────────────────
    if (action === 'save-single') {
      if (!versionId || !ganttItemId || !clientId) {
        return new Response(
          JSON.stringify({ success: false, error: 'versionId, ganttItemId and clientId are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      console.log(`[bulk-gen-item] save-single: versionId=${versionId}, ganttItemId=${ganttItemId}`);

      const version = (await aiGenerationVersions.getByIdAsync(versionId)) as AIGenerationVersion | null;
      if (!version || !version.imageUrl) {
        return new Response(
          JSON.stringify({ success: false, error: 'Version not found or has no image' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Mark version as selected
      await aiGenerationVersions.updateAsync(versionId, { status: 'selected' });
      if (version.sessionId) {
        await aiGenerationSessions.updateAsync(version.sessionId, {
          activeVersionId: versionId,
          updatedAt: new Date().toISOString(),
        });
      }

      // Update Gantt item with single image URL
      const ganttItem = (await clientGanttItems.getByIdAsync(ganttItemId)) as ClientGanttItem | null;
      if (ganttItem) {
        await clientGanttItems.updateAsync(ganttItemId, {
          imageUrls: [version.imageUrl],
          status: 'approved',
        });
        console.log(`[bulk-gen-item] save-single: Gantt item updated — 1 image, status=approved`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'save-single',
          imageUrls: [version.imageUrl],
          variants: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Common validation for 'generate' and legacy (no action) ──────────
    if (!clientId || !ganttItemId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clientId and ganttItemId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[bulk-gen-item] Starting pipeline for ganttItemId=${ganttItemId}, clientId=${clientId}, action=${action || 'legacy'}`);

    // ── Gather brand intelligence ────────────────────────────────────────
    const brandIntel = await gatherBrandIntelligence(clientId);

    // ── Fetch brand asset buffers (logo + references + products) ─────────
    const brandAssetBuffers: Buffer[] = [];
    const brandAssetUrls: string[] = [];

    if (brandIntel.logoUrl) {
      try {
        const logoResp = await fetch(brandIntel.logoUrl);
        if (logoResp.ok) {
          brandAssetBuffers.push(Buffer.from(await logoResp.arrayBuffer()));
          brandAssetUrls.push(brandIntel.logoUrl);
          console.log('[bulk-gen-item] Logo fetched as reference image');
        }
      } catch (e) {
        console.warn('[bulk-gen-item] Failed to fetch logo:', e);
      }
    }

    for (const refUrl of brandIntel.approvedReferenceUrls.slice(0, 10)) {
      try {
        const refResp = await fetch(refUrl);
        if (refResp.ok) {
          brandAssetBuffers.push(Buffer.from(await refResp.arrayBuffer()));
          brandAssetUrls.push(refUrl);
        }
      } catch (e) {
        console.warn('[bulk-gen-item] Failed to fetch reference:', refUrl, e);
      }
    }

    for (const prodUrl of brandIntel.productImageUrls.slice(0, 4)) {
      try {
        const prodResp = await fetch(prodUrl);
        if (prodResp.ok) {
          brandAssetBuffers.push(Buffer.from(await prodResp.arrayBuffer()));
          brandAssetUrls.push(prodUrl);
        }
      } catch (e) {
        console.warn('[bulk-gen-item] Failed to fetch product:', prodUrl, e);
      }
    }

    console.log(`[bulk-gen-item] Total brand asset buffers: ${brandAssetBuffers.length}`);

    // ── Step 1: Auto-brief ──────────────────────────────────────────────
    console.log('[bulk-gen-item] Step 1: Auto-brief...');
    const concepts = await runAutoBrief(ganttItemId, clientId, brandIntel);
    console.log(`[bulk-gen-item] Auto-brief produced ${concepts.length} concepts`);

    // ── Step 2: Generate 3 options ──────────────────────────────────────
    console.log('[bulk-gen-item] Step 2: Generating 3 images...');
    const { versions } = await runGenerate(
      ganttItemId,
      clientId,
      concepts,
      brandIntel,
      brandAssetBuffers,
      brandAssetUrls,
    );

    if (versions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No versions were generated successfully' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── action: 'generate' — return versions, stop here ─────────────────
    if (action === 'generate') {
      console.log(`[bulk-gen-item] generate action complete — ${versions.length} versions`);
      return new Response(
        JSON.stringify({
          success: true,
          action: 'generate',
          versions: versions.map((v: any) => ({
            id: v.id,
            imageUrl: v.imageUrl,
            versionNumber: v.versionNumber,
          })),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Legacy flow (no action) — Steps 3 + 4 ──────────────────────────
    console.log('[bulk-gen-item] Step 3: Picking best version...');
    const chosenVersion = versions[0];
    console.log(`[bulk-gen-item] Picked version ${chosenVersion.id} (first successful)`);

    console.log('[bulk-gen-item] Step 4: Finalizing...');
    const { imageUrls, variants } = await runFinalize(chosenVersion.id, ganttItemId, clientId);

    // Get the chosen image base64 for immediate preview
    let chosenImageBase64: string | undefined;
    if (chosenVersion.imageUrl) {
      try {
        const previewResp = await fetch(chosenVersion.imageUrl);
        if (previewResp.ok) {
          const previewBuffer = Buffer.from(await previewResp.arrayBuffer());
          chosenImageBase64 = previewBuffer.toString('base64');
        }
      } catch {
        /* preview base64 is optional */
      }
    }

    console.log(`[bulk-gen-item] COMPLETE — ${imageUrls.length} image URLs generated`);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrls,
        chosenImageBase64,
        variants,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[bulk-gen-item] Pipeline error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET handler — returns list of items needing graphics + brand asset URLs
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'clientId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Query all Gantt items for this client that don't have imageUrls
    const allItems = await clientGanttItems.queryAsync(
      (i: ClientGanttItem) => i.clientId === clientId,
    );
    const itemsWithoutGraphics = allItems.filter(
      (i: any) => !i.imageUrls || i.imageUrls.length === 0,
    );

    // Gather brand intelligence (we need logoUrl for previews)
    const brandIntel = await gatherBrandIntelligence(clientId);

    const items = itemsWithoutGraphics.map((item: any) => ({
      id: item.id,
      title: item.title,
      contentType: item.contentType || null,
      date: item.scheduledDate || item.date || null,
    }));

    return new Response(
      JSON.stringify({
        items,
        totalItems: items.length,
        logoUrl: brandIntel.logoUrl || '',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[bulk-gen-item/GET] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
