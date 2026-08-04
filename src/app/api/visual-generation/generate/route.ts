/**
 * POST /api/visual-generation/generate
 *
 * Multi-stage visual generation pipeline — ChatGPT-level creative quality.
 *
 * Supports 3 modes:
 * - 'initial': Generate 3 different options in parallel for the user to choose from
 * - 'refine':  Iterate on a selected version based on user feedback (chat-like)
 * - 'single':  Legacy single-generation flow (backward compatibility)
 *
 * Pipeline stages:
 * 1. Build Generation Context (brief, gantt item, client data)
 * 2. Gather Brand Intelligence (colors, fonts, assets, feedback, DNA)
 * 2b. Fetch brand asset files as Buffers
 * 3. Find/create session + load conversation history
 * 4. Run Creative Director (LLM → full creative strategy + optimized prompt)
 * 5. Generate Image(s) — 3 in parallel for initial, 1 for refine/single
 * 6. Visual Quality Gate (single/refine only)
 * 6b. Logo compositing with sharp
 * 7. Upload to Storage + persist version records
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { aiGenerationSessions, aiGenerationVersions } from '@/lib/db/collections';
import type { AIGenerationSession, AIGenerationVersion } from '@/lib/db/schema';
import { buildGenerationContext } from '@/lib/services/visual-generation/generationContextBuilder';
import { gatherBrandIntelligence } from '@/lib/services/visual-generation/brandIntelligenceService';
import { runCreativeDirector } from '@/lib/services/visual-generation/creativeDirectorService';
import { runQualityGate } from '@/lib/services/visual-generation/visualQualityGate';
import { generateImage, editImage } from '@/lib/services/visual-generation/openaiImageProvider';
import sharp from 'sharp';

export const maxDuration = 300;

// ── Variation suffixes for the 3 initial options ──────────────────────────

const VARIATION_SUFFIXES = [
  '', // Option 1: Original Creative Director prompt as-is
  '\n\nCOMPOSITION VARIATION: Use a completely different camera angle and framing — if the original concept implies a wide/establishing shot, try a close-up intimate view instead (or vice versa). Shift the subject positioning significantly. Keep all brand colors, message, and elements the same, but reimagine the visual composition from scratch.',
  '\n\nSTYLE VARIATION: Shift the overall visual mood and atmosphere dramatically — change the lighting (e.g., warm golden hour vs cool blue hour vs dramatic high-contrast), the background environment, and the color temperature. Try a more graphic/stylized interpretation rather than photorealistic (or vice versa). Keep brand colors dominant and the marketing message identical, but create a distinctly different feel.',
];

// ── Reusable logo compositing helper ──────────────────────────────────────

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
    console.error('[visual-gen] Logo compositing error:', err);
    return base64;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ganttItemId,
      clientId,
      instruction,
      concepts: userConcepts,
      width = 1024,
      height = 1024,
      quality = 'high' as const,
      referenceVersionId: rawRefVersionId,
      mode = 'single',
      selectedVersionId,
    } = body;

    // In refine mode, selectedVersionId acts as the reference version
    const referenceVersionId = rawRefVersionId || (mode === 'refine' ? selectedVersionId : undefined);

    if (!ganttItemId || !clientId) {
      return NextResponse.json(
        { error: 'ganttItemId and clientId are required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 1: Build Generation Context
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[visual-gen] Stage 1: Building generation context...');
    const context = await buildGenerationContext(ganttItemId, clientId);

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 2: Gather Brand Intelligence
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[visual-gen] Stage 2: Gathering brand intelligence...');
    const brandIntel = await gatherBrandIntelligence(clientId);

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 2b: Fetch brand assets as Buffers
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[visual-gen] Stage 2b: Fetching brand asset files...');
    const brandAssetBuffers: Buffer[] = [];
    const brandAssetUrls: string[] = [];

    if (brandIntel.logoUrl) {
      try {
        const logoResp = await fetch(brandIntel.logoUrl);
        if (logoResp.ok) {
          brandAssetBuffers.push(Buffer.from(await logoResp.arrayBuffer()));
          brandAssetUrls.push(brandIntel.logoUrl);
          console.log('[visual-gen] Logo fetched as reference image');
        }
      } catch (e) {
        console.warn('[visual-gen] Failed to fetch logo:', e);
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
        console.warn('[visual-gen] Failed to fetch reference:', refUrl, e);
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
        console.warn('[visual-gen] Failed to fetch product:', prodUrl, e);
      }
    }

    console.log(`[visual-gen] Total brand asset buffers: ${brandAssetBuffers.length}`);

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 3: Find or create session + load conversation history
    // ═══════════════════════════════════════════════════════════════════════
    let session: AIGenerationSession | null = null;
    const existingSessions = await aiGenerationSessions.queryAsync(
      (s: AIGenerationSession) => s.ganttItemId === ganttItemId && s.status === 'active'
    );
    if (existingSessions.length > 0) {
      session = existingSessions[0] as AIGenerationSession;
    }

    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (session) {
      try {
        const prevVersions = await aiGenerationVersions.queryAsync(
          (v: AIGenerationVersion) => v.sessionId === session!.id
        );
        const sorted = (prevVersions as AIGenerationVersion[])
          .sort((a, b) => (a.versionNumber || 0) - (b.versionNumber || 0));
        for (const v of sorted) {
          if (v.userInstruction) {
            conversationHistory.push({ role: 'user', content: v.userInstruction });
          }
          if (v.revisedPrompt) {
            conversationHistory.push({ role: 'assistant', content: `Generated image with prompt: ${v.revisedPrompt}` });
          } else if (v.fullPrompt) {
            conversationHistory.push({ role: 'assistant', content: `Generated image v${v.versionNumber}` });
          }
        }
      } catch { /* conversation history is optional */ }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 4: Run Creative Director (LLM → creative strategy)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[visual-gen] Stage 3: Running Creative Director...');

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

    const BRAND_KIT_DIRECTIVE = brandDirectiveParts.join('\n');

    // For refine mode, frame the instruction as a targeted refinement request
    let userInstruction: string;
    if (mode === 'refine' && instruction) {
      userInstruction = `${BRAND_KIT_DIRECTIVE}\n\nTHIS IS A REFINEMENT REQUEST. The user selected a previous version and wants these specific changes:\n\n${instruction}\n\nMake TARGETED changes based on this feedback. Do NOT redesign the entire visual — preserve the overall composition, subject, and brand identity. Only change what the user specifically requested.`;
    } else if (instruction) {
      userInstruction = `${BRAND_KIT_DIRECTIVE}\n\n${instruction}`;
    } else {
      userInstruction = `${BRAND_KIT_DIRECTIVE}\n\nCreate a professional marketing visual based on the brief.`;
    }

    const directorResult = await runCreativeDirector(
      context,
      brandIntel,
      userInstruction,
      conversationHistory.length > 0 ? conversationHistory : undefined,
    );

    let imagePrompt: string;
    let creativeStrategy = directorResult.strategy;

    if (directorResult.success && creativeStrategy?.optimizedImagePrompt) {
      imagePrompt = creativeStrategy.optimizedImagePrompt;
      console.log('[visual-gen] Creative Director produced optimized prompt');
    } else {
      console.warn('[visual-gen] Creative Director failed, using fallback prompt:', directorResult.error);
      imagePrompt = `Professional marketing visual for "${context.ganttItem.title}". ${context.promptContext}. ${userInstruction}`;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODE: INITIAL — generate 3 options in parallel
    // ═══════════════════════════════════════════════════════════════════════
    if (mode === 'initial') {
      console.log('[visual-gen] MODE: INITIAL — generating 3 options in parallel...');

      // If auto-brief provided 3 distinct concepts, run Creative Director separately for each.
      // Otherwise fall back to VARIATION_SUFFIXES on the single prompt.
      const hasDistinctConcepts = Array.isArray(userConcepts) && userConcepts.length >= 3;

      let prompts: string[];
      if (hasDistinctConcepts) {
        console.log('[visual-gen] Using 3 DISTINCT concepts from auto-brief');
        // Each concept already has its own creative direction — run Creative Director
        // on each one to get an optimized image prompt per concept.
        const conceptPrompts = await Promise.all(
          userConcepts.slice(0, 3).map(async (concept: string, idx: number) => {
            try {
              const conceptDirector = await runCreativeDirector(
                context,
                brandIntel,
                concept,
                conversationHistory,
              );
              if (conceptDirector.success && conceptDirector.strategy?.optimizedImagePrompt) {
                console.log(`[visual-gen] Creative Director concept ${idx + 1} — optimized prompt ready`);
                return conceptDirector.strategy.optimizedImagePrompt;
              }
            } catch (err: any) {
              console.warn(`[visual-gen] Creative Director concept ${idx + 1} failed:`, err.message);
            }
            // Fallback: use the concept text directly as the prompt
            return `Professional marketing visual. ${concept}. ${context.promptContext}`;
          })
        );
        prompts = conceptPrompts;
      } else {
        prompts = VARIATION_SUFFIXES.map(suffix => imagePrompt + suffix);
      }

      // Generate 3 images in parallel — with retry for transient errors (502, 503, 429)
      const MAX_RETRIES = 2;
      const genResults = await Promise.all(
        prompts.map(async (prompt, idx) => {
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            console.log(`[visual-gen] Generating option ${idx + 1}/3${attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}...`);
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
                    console.warn(`[visual-gen] Option ${idx + 1} transient error, retrying in 3s: ${errMsg}`);
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
                  console.warn(`[visual-gen] Option ${idx + 1} transient error, retrying in 3s: ${errMsg}`);
                  await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
                  continue;
                }
                throw new Error(errMsg);
              }
              return { base64: r.images[0].base64, revisedPrompt: r.images[0].revisedPrompt, error: null };
            } catch (err: any) {
              if (attempt < MAX_RETRIES && /50[23]|bad gateway|service unavailable|rate limit|429/i.test(err.message || '')) {
                console.warn(`[visual-gen] Option ${idx + 1} transient error, retrying in 3s: ${err.message}`);
                await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
                continue;
              }
              console.error(`[visual-gen] Option ${idx + 1} error (final):`, err.message);
              return { base64: '', revisedPrompt: undefined as string | undefined, error: err.message as string };
            }
          }
          // Should not reach here, but safety fallback
          return { base64: '', revisedPrompt: undefined as string | undefined, error: `Option ${idx + 1} failed after ${MAX_RETRIES} retries` as string };
        })
      );

      // Filter out failures
      const successResults = genResults.filter(r => r.base64 && !r.error);
      if (successResults.length === 0) {
        return NextResponse.json(
          { error: 'All options failed to generate. Please try again.' },
          { status: 500 }
        );
      }

      // Logo composite on all successes
      if (brandIntel.logoUrl) {
        for (const r of successResults) {
          try {
            r.base64 = await compositeLogoOnBase64(r.base64, brandIntel.logoUrl, width, height);
          } catch { /* continue without logo */ }
        }
      }

      // Create session if needed
      if (!session) {
        session = await aiGenerationSessions.createAsync({
          clientId,
          ganttItemId,
          status: 'active',
          contextSnapshot: {
            briefSummary: `Title: ${context.ganttItem.title}. Client: ${context.clientName}. Industry: ${context.businessField}.`,
            brandRulesSummary: brandIntel.brandRulesSummary,
            creativeStrategy: creativeStrategy
              ? {
                  centralMessage: creativeStrategy.centralMessage,
                  creativeIdea: creativeStrategy.creativeIdea,
                  style: creativeStrategy.style,
                  mood: creativeStrategy.mood,
                }
              : null,
          },
          systemPrompt: imagePrompt,
          sizePreset: { label: `${width}x${height}`, width, height },
          activeVersionId: null,
          versionCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Omit<AIGenerationSession, 'id'> as any);
      }

      const durationMs = Date.now() - startTime;
      const sb = getSupabase();
      const versions: any[] = [];

      for (let i = 0; i < successResults.length; i++) {
        const versionNumber = (session.versionCount || 0) + i + 1;
        const buffer = Buffer.from(successResults[i].base64, 'base64');
        const storagePath = `visual-generation/${clientId}/${session.id}/${versionNumber}.png`;

        const { error: uploadError } = await sb.storage
          .from('project-files')
          .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

        if (uploadError) {
          console.error(`[visual-gen] Upload error for option ${i + 1}:`, uploadError);
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
          userInstruction: instruction || '',
          fullPrompt: prompts[i] || imagePrompt,
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
          creativeStrategy: creativeStrategy
            ? {
                centralMessage: creativeStrategy.centralMessage,
                creativeIdea: creativeStrategy.creativeIdea,
                composition: creativeStrategy.composition,
                style: creativeStrategy.style,
                mood: creativeStrategy.mood,
                visualType: creativeStrategy.visualType,
                luxuryLevel: creativeStrategy.luxuryLevel,
                directorNotes: creativeStrategy.directorNotes,
              }
            : null,
          qualityAssessment: null,
          createdAt: new Date().toISOString(),
        } as Omit<AIGenerationVersion, 'id'> as any);

        versions.push(version);
      }

      // Update session version count
      await aiGenerationSessions.updateAsync(session.id, {
        versionCount: (session.versionCount || 0) + versions.length,
        updatedAt: new Date().toISOString(),
      });

      console.log(
        `[visual-gen] INITIAL complete — ${versions.length} options generated, ${durationMs}ms`
      );

      return NextResponse.json({
        mode: 'initial',
        versions,
        sessionId: session.id,
        _pipeline: {
          creativeStrategy: creativeStrategy
            ? {
                centralMessage: creativeStrategy.centralMessage,
                creativeIdea: creativeStrategy.creativeIdea,
                style: creativeStrategy.style,
                mood: creativeStrategy.mood,
                directorNotes: creativeStrategy.directorNotes,
              }
            : null,
          durationMs,
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EXISTING FLOW — single generation or refine
    // ═══════════════════════════════════════════════════════════════════════

    const briefSummary = `Title: ${context.ganttItem.title}. Client: ${context.clientName}. Industry: ${context.businessField}. Platform: ${context.platform}. Format: ${context.format}. Visual concept: ${context.ganttItem.visualConcept || 'not specified'}. Graphic text: ${context.ganttItem.graphicText || 'none'}.`;

    // ── STAGE 5: Generate or Edit the image ──
    console.log('[visual-gen] Stage 4: Generating image...');
    let resultBase64 = '';
    let resultRevisedPrompt: string | undefined;
    let referenceImageUrls: string[] = [];

    if (referenceVersionId) {
      const refVersion = (await aiGenerationVersions.getByIdAsync(referenceVersionId)) as AIGenerationVersion | null;
      if (!refVersion || !refVersion.imageUrl) {
        return NextResponse.json(
          { error: 'Reference version not found or has no image' },
          { status: 404 }
        );
      }
      referenceImageUrls = [refVersion.imageUrl, ...brandAssetUrls];
      const imgResponse = await fetch(refVersion.imageUrl);
      if (!imgResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch reference image' }, { status: 500 });
      }
      const imgArrayBuffer = await imgResponse.arrayBuffer();
      const imgBuffer = Buffer.from(imgArrayBuffer);

      const allReferenceBuffers = [imgBuffer, ...brandAssetBuffers].slice(0, 16);
      console.log(
        `[visual-gen] Editing with ${allReferenceBuffers.length} reference images (1 prev version + ${brandAssetBuffers.length} brand assets)`
      );

      const editResult = await editImage({
        prompt: imagePrompt,
        referenceImages: allReferenceBuffers,
        width,
        height,
        quality,
      });
      if (!editResult.success || !editResult.images.length) {
        return NextResponse.json(
          { error: editResult.error || 'Failed to edit image' },
          { status: 500 }
        );
      }
      resultBase64 = editResult.images[0].base64;
      resultRevisedPrompt = editResult.images[0].revisedPrompt;
    } else if (brandAssetBuffers.length > 0) {
      console.log(
        `[visual-gen] Using editImage() with ${brandAssetBuffers.length} brand asset references`
      );
      referenceImageUrls = brandAssetUrls;
      const editResult = await editImage({
        prompt: imagePrompt,
        referenceImages: brandAssetBuffers,
        width,
        height,
        quality,
      });
      if (!editResult.success || !editResult.images.length) {
        return NextResponse.json(
          { error: editResult.error || 'Failed to generate image with brand assets' },
          { status: 500 }
        );
      }
      resultBase64 = editResult.images[0].base64;
      resultRevisedPrompt = editResult.images[0].revisedPrompt;
    } else {
      console.log('[visual-gen] No brand assets available, using text-only generateImage()');
      const genResult = await generateImage({ prompt: imagePrompt, width, height, quality });
      if (!genResult.success || !genResult.images.length) {
        return NextResponse.json(
          { error: genResult.error || 'Failed to generate image' },
          { status: 500 }
        );
      }
      resultBase64 = genResult.images[0].base64;
      resultRevisedPrompt = genResult.images[0].revisedPrompt;
    }

    // ── STAGE 6: Visual Quality Gate — skip for refine mode (fast feedback loop) ──
    let qualityAssessment: any = null;
    if (mode !== 'refine' && creativeStrategy) {
      console.log('[visual-gen] Stage 5: Running Visual Quality Gate...');
      const qgResult = await runQualityGate(resultBase64, creativeStrategy, briefSummary);
      if (qgResult.success && qgResult.assessment) {
        qualityAssessment = qgResult.assessment;

        if (
          !qgResult.assessment.passed &&
          qgResult.assessment.shouldRetry &&
          qgResult.assessment.correctivePrompt
        ) {
          console.log('[visual-gen] Stage 5b: Quality gate failed — auto-retrying...');
          const correctedPrompt = `${imagePrompt}\n\nCRITICAL CORRECTIONS (from quality review):\n${qgResult.assessment.correctivePrompt}`;

          if (referenceVersionId && referenceImageUrls.length) {
            const imgResponse2 = await fetch(referenceImageUrls[0]);
            if (imgResponse2.ok) {
              const imgBuf2 = Buffer.from(await imgResponse2.arrayBuffer());
              const retryResult = await editImage({
                prompt: correctedPrompt,
                referenceImages: [imgBuf2],
                width,
                height,
                quality,
              });
              if (retryResult.success && retryResult.images.length) {
                resultBase64 = retryResult.images[0].base64;
                resultRevisedPrompt = retryResult.images[0].revisedPrompt;
                qualityAssessment = { ...qualityAssessment, retried: true };
              }
            }
          } else if (brandAssetBuffers.length > 0) {
            const retryResult = await editImage({
              prompt: correctedPrompt,
              referenceImages: brandAssetBuffers,
              width,
              height,
              quality,
            });
            if (retryResult.success && retryResult.images.length) {
              resultBase64 = retryResult.images[0].base64;
              resultRevisedPrompt = retryResult.images[0].revisedPrompt;
              qualityAssessment = { ...qualityAssessment, retried: true };
            }
          } else {
            const retryResult = await generateImage({
              prompt: correctedPrompt,
              width,
              height,
              quality,
            });
            if (retryResult.success && retryResult.images.length) {
              resultBase64 = retryResult.images[0].base64;
              resultRevisedPrompt = retryResult.images[0].revisedPrompt;
              qualityAssessment = { ...qualityAssessment, retried: true };
            }
          }
        }
      }
    } else if (mode === 'refine') {
      console.log('[visual-gen] Skipping quality gate for refine mode (fast feedback)');
    }

    // ── STAGE 6b: Composite real logo ──
    if (brandIntel.logoUrl) {
      try {
        console.log('[visual-gen] Stage 6b: Compositing real logo...');
        resultBase64 = await compositeLogoOnBase64(resultBase64, brandIntel.logoUrl, width, height);
      } catch (compErr) {
        console.error('[visual-gen] Stage 6b: Logo compositing error:', compErr);
      }
    }

    const durationMs = Date.now() - startTime;

    // ── STAGE 7: Upload to Supabase Storage + persist records ──
    console.log('[visual-gen] Stage 6: Uploading and persisting...');

    if (!session) {
      session = await aiGenerationSessions.createAsync({
        clientId,
        ganttItemId,
        status: 'active',
        contextSnapshot: {
          briefSummary,
          brandRulesSummary: brandIntel.brandRulesSummary,
          creativeStrategy: creativeStrategy
            ? {
                centralMessage: creativeStrategy.centralMessage,
                creativeIdea: creativeStrategy.creativeIdea,
                style: creativeStrategy.style,
                mood: creativeStrategy.mood,
              }
            : null,
        },
        systemPrompt: imagePrompt,
        sizePreset: { label: `${width}x${height}`, width, height },
        activeVersionId: null,
        versionCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Omit<AIGenerationSession, 'id'> as any);
    }

    const sessionId = session.id;
    const versionNumber = session.versionCount + 1;

    const sb = getSupabase();
    const buffer = Buffer.from(resultBase64, 'base64');
    const storagePath = `visual-generation/${clientId}/${sessionId}/${versionNumber}.png`;

    const { error: uploadError } = await sb.storage
      .from('project-files')
      .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error('[visual-generation] Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload generated image' }, { status: 500 });
    }

    const { data: urlData } = sb.storage.from('project-files').getPublicUrl(storagePath);
    const imageUrl = urlData?.publicUrl || null;

    const version = await aiGenerationVersions.createAsync({
      sessionId,
      clientId,
      ganttItemId,
      versionNumber,
      status: 'completed',
      userInstruction: instruction || '',
      fullPrompt: imagePrompt,
      model: 'gpt-image-2',
      quality,
      width,
      height,
      imageUrl,
      thumbnailBase64: null,
      revisedPrompt: resultRevisedPrompt || null,
      referenceImageUrls,
      cost: null,
      errorMessage: null,
      durationMs,
      generationMode: mode === 'refine' ? 'refine' : 'single',
      creativeStrategy: creativeStrategy
        ? {
            centralMessage: creativeStrategy.centralMessage,
            creativeIdea: creativeStrategy.creativeIdea,
            composition: creativeStrategy.composition,
            style: creativeStrategy.style,
            mood: creativeStrategy.mood,
            visualType: creativeStrategy.visualType,
            luxuryLevel: creativeStrategy.luxuryLevel,
            directorNotes: creativeStrategy.directorNotes,
          }
        : null,
      qualityAssessment: qualityAssessment
        ? {
            passed: qualityAssessment.passed,
            score: qualityAssessment.score,
            issues: qualityAssessment.issues,
            suggestions: qualityAssessment.suggestions,
            assessment: qualityAssessment.assessment,
          }
        : null,
      createdAt: new Date().toISOString(),
    } as Omit<AIGenerationVersion, 'id'> as any);

    await aiGenerationSessions.updateAsync(sessionId, {
      activeVersionId: version.id,
      versionCount: versionNumber,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `[visual-gen] Complete — v${versionNumber}, quality: ${qualityAssessment?.score ?? 'N/A'}, duration: ${durationMs}ms`
    );

    return NextResponse.json({
      ...version,
      _pipeline: {
        creativeStrategy: creativeStrategy
          ? {
              centralMessage: creativeStrategy.centralMessage,
              creativeIdea: creativeStrategy.creativeIdea,
              style: creativeStrategy.style,
              mood: creativeStrategy.mood,
              directorNotes: creativeStrategy.directorNotes,
            }
          : null,
        qualityAssessment: qualityAssessment
          ? {
              passed: qualityAssessment.passed,
              score: qualityAssessment.score,
              issues: qualityAssessment.issues,
              suggestions: qualityAssessment.suggestions,
              assessment: qualityAssessment.assessment,
            }
          : null,
        durationMs,
      },
    });
  } catch (error: any) {
    console.error('[visual-generation] Generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate visual' },
      { status: 500 }
    );
  }
}
