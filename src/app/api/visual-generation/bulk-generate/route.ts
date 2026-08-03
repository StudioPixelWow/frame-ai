/**
 * POST /api/visual-generation/bulk-generate
 *
 * Orchestrates the full visual generation pipeline for ALL Gantt items of a client
 * that don't have graphics yet. Called from the "צור עיצובים גרפיים" button.
 *
 * For each item:
 *  1. Auto-brief: GPT-4.1 generates 3 creative concepts
 *  2. Generate: Creative Director + image generation for each concept (3 options)
 *  3. Pick best: selects the first successful version
 *  4. Finalize: sharp resize to FB/IG/Story variants, upload, update Gantt item
 *
 * Streams newline-delimited JSON progress events to the frontend.
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

// ── OpenAI API key ──────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY environment variable');
  return key;
}

// ── Auto-brief system prompt (identical to auto-brief/route.ts) ─────────

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

// ── Size variant definitions (identical to finalize/route.ts) ───────────

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

// ── Logo compositing helper (identical to generate/route.ts) ────────────

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
    console.error('[bulk-gen] Logo compositing error:', err);
    return base64;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal pipeline steps
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Step 1 — Auto-brief: calls GPT-4.1 to produce 3 creative concepts in Hebrew.
 * Replicates the logic from auto-brief/route.ts without the HTTP layer.
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
    console.log('[bulk-gen] Using 3 DISTINCT concepts from auto-brief');
    const conceptPrompts = await Promise.all(
      concepts.slice(0, 3).map(async (concept: string, idx: number) => {
        try {
          const conceptDirector = await runCreativeDirector(
            context,
            brandIntel,
            concept,
          );
          if (conceptDirector.success && conceptDirector.strategy?.optimizedImagePrompt) {
            console.log(`[bulk-gen] Creative Director concept ${idx + 1} — optimized prompt ready`);
            return conceptDirector.strategy.optimizedImagePrompt;
          }
        } catch (err: any) {
          console.warn(`[bulk-gen] Creative Director concept ${idx + 1} failed:`, err.message);
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

  // Generate 3 images in parallel
  const genResults = await Promise.all(
    prompts.map(async (prompt, idx) => {
      console.log(`[bulk-gen] Generating option ${idx + 1}/3...`);
      try {
        if (brandAssetBuffers.length > 0) {
          const r = await editImage({
            prompt,
            referenceImages: brandAssetBuffers,
            width,
            height,
            quality,
          });
          if (!r.success || !r.images.length) throw new Error(r.error || `Option ${idx + 1} failed`);
          return { base64: r.images[0].base64, revisedPrompt: r.images[0].revisedPrompt, error: null };
        }
        const r = await generateImage({ prompt, width, height, quality });
        if (!r.success || !r.images.length) throw new Error(r.error || `Option ${idx + 1} failed`);
        return { base64: r.images[0].base64, revisedPrompt: r.images[0].revisedPrompt, error: null };
      } catch (err: any) {
        console.error(`[bulk-gen] Option ${idx + 1} error:`, err.message);
        return { base64: '', revisedPrompt: undefined as string | undefined, error: err.message as string };
      }
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
      console.error(`[bulk-gen] Upload error for option ${i + 1}:`, uploadError);
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
 */
async function runFinalize(
  versionId: string,
  ganttItemId: string,
  clientId: string,
): Promise<void> {
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
  const originalMeta = await sharp(originalBuffer).metadata();
  const origWidth = originalMeta.width || 1080;
  const origHeight = originalMeta.height || 1350;

  const sb = getSupabase();
  const sessionId = version.sessionId;

  // Start with the original image URL
  const allImageUrls: string[] = [version.imageUrl];

  // Generate size variants
  for (const variant of SIZE_VARIANTS) {
    console.log(`[bulk-gen/finalize] Generating ${variant.key}: ${variant.width}x${variant.height}...`);
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
        console.error(`[bulk-gen/finalize] Upload error for ${variant.key}:`, uploadError);
        continue;
      }

      const { data: urlData } = sb.storage.from('project-files').getPublicUrl(storagePath);
      const imageUrl = urlData?.publicUrl || '';
      if (imageUrl) {
        allImageUrls.push(imageUrl);
        console.log(`[bulk-gen/finalize] ${variant.key} uploaded successfully`);
      }
    } catch (err: any) {
      console.error(`[bulk-gen/finalize] Error generating ${variant.key}:`, err.message);
    }
  }

  // Save all URLs to Gantt item and mark as approved
  const ganttItem = (await clientGanttItems.getByIdAsync(ganttItemId)) as ClientGanttItem | null;
  if (ganttItem) {
    await clientGanttItems.updateAsync(ganttItemId, {
      imageUrls: allImageUrls,
      status: 'approved',
    });
    console.log(`[bulk-gen/finalize] Gantt item updated — ${allImageUrls.length} images, status=approved`);
  } else {
    console.warn('[bulk-gen/finalize] Gantt item not found:', ganttItemId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const { clientId } = await req.json();

  if (!clientId) {
    return new Response(
      JSON.stringify({ error: 'clientId is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Fetch all Gantt items without graphics
  const allItems = await clientGanttItems.queryAsync(
    (i: ClientGanttItem) => i.clientId === clientId,
  );
  const itemsToProcess = allItems.filter(
    (i: any) => !i.imageUrls || i.imageUrls.length === 0,
  );

  // Gather brand intelligence ONCE (shared across all items)
  const brandIntel = await gatherBrandIntelligence(clientId);

  // Fetch brand asset buffers ONCE
  const brandAssetBuffers: Buffer[] = [];
  const brandAssetUrls: string[] = [];

  if (brandIntel.logoUrl) {
    try {
      const logoResp = await fetch(brandIntel.logoUrl);
      if (logoResp.ok) {
        brandAssetBuffers.push(Buffer.from(await logoResp.arrayBuffer()));
        brandAssetUrls.push(brandIntel.logoUrl);
        console.log('[bulk-gen] Logo fetched as reference image');
      }
    } catch (e) {
      console.warn('[bulk-gen] Failed to fetch logo:', e);
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
      console.warn('[bulk-gen] Failed to fetch reference:', refUrl, e);
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
      console.warn('[bulk-gen] Failed to fetch product:', prodUrl, e);
    }
  }

  console.log(`[bulk-gen] Total brand asset buffers: ${brandAssetBuffers.length}`);

  // Build the streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));

      send({ type: 'start', totalItems: itemsToProcess.length });

      let totalSuccess = 0;
      let totalFailed = 0;

      for (let idx = 0; idx < itemsToProcess.length; idx++) {
        const item = itemsToProcess[idx] as ClientGanttItem;
        send({
          type: 'item_start',
          index: idx,
          itemId: item.id,
          itemTitle: item.title,
        });

        try {
          // ── Step 1: Auto-brief ──────────────────────────────────────
          send({ type: 'item_stage', index: idx, stage: 'auto-brief' });
          console.log(`[bulk-gen] Item ${idx + 1}/${itemsToProcess.length}: auto-brief for "${item.title}"`);

          const concepts = await runAutoBrief(item.id, clientId, brandIntel);
          console.log(`[bulk-gen] Auto-brief produced ${concepts.length} concepts`);

          // ── Step 2: Generate 3 options ──────────────────────────────
          send({ type: 'item_stage', index: idx, stage: 'generate' });
          console.log(`[bulk-gen] Item ${idx + 1}/${itemsToProcess.length}: generating images...`);

          const { versions } = await runGenerate(
            item.id,
            clientId,
            concepts,
            brandIntel,
            brandAssetBuffers,
            brandAssetUrls,
          );

          if (versions.length === 0) {
            throw new Error('No versions were generated successfully');
          }

          // ── Step 3: Pick best (first successful) ───────────────────
          send({ type: 'item_stage', index: idx, stage: 'pick-best' });
          const chosenVersion = versions[0];
          console.log(`[bulk-gen] Picked version ${chosenVersion.id} (first successful)`);

          // ── Step 4: Finalize — resize + save ───────────────────────
          send({ type: 'item_stage', index: idx, stage: 'finalize' });
          console.log(`[bulk-gen] Item ${idx + 1}/${itemsToProcess.length}: finalizing...`);

          await runFinalize(chosenVersion.id, item.id, clientId);

          send({
            type: 'item_complete',
            index: idx,
            itemId: item.id,
            success: true,
          });
          totalSuccess++;
          console.log(`[bulk-gen] Item ${idx + 1}/${itemsToProcess.length}: COMPLETE`);
        } catch (err: any) {
          console.error(`[bulk-gen] Item ${idx + 1}/${itemsToProcess.length} FAILED:`, err.message);
          send({
            type: 'item_error',
            index: idx,
            itemId: item.id,
            error: err.message || 'Unknown error',
          });
          totalFailed++;
        }
      }

      send({
        type: 'complete',
        totalProcessed: itemsToProcess.length,
        totalSuccess,
        totalFailed,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
