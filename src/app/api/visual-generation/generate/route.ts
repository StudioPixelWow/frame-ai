/**
 * POST /api/visual-generation/generate
 *
 * Multi-stage visual generation pipeline — ChatGPT-level creative quality.
 *
 * Pipeline stages:
 * 1. Build Generation Context (brief, gantt item, client data)
 * 2. Gather Brand Intelligence (colors, fonts, assets, feedback, DNA)
 * 3. Run Creative Director (LLM → full creative strategy + optimized prompt)
 * 4. Generate Image (gpt-image-2)
 * 5. Visual Quality Gate (LLM vision → validate against strategy)
 * 6. Auto-retry if quality gate fails (up to 1 retry with corrective prompt)
 * 7. Upload to Storage + persist version record
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

export const maxDuration = 120; // Allow up to 2 minutes for the full pipeline

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ganttItemId,
      clientId,
      instruction,
      width = 1024,
      height = 1024,
      quality = 'auto' as const,
      referenceVersionId,
    } = body;

    if (!ganttItemId || !clientId) {
      return NextResponse.json(
        { error: 'ganttItemId and clientId are required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 1: Build Generation Context (brief understanding)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[visual-gen] Stage 1: Building generation context...');
    const context = await buildGenerationContext(ganttItemId, clientId);

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 2: Gather Brand Intelligence
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[visual-gen] Stage 2: Gathering brand intelligence...');
    const brandIntel = await gatherBrandIntelligence(clientId);

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

    // Load conversation history from previous versions in this session
    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (session) {
      try {
        const prevVersions = await aiGenerationVersions.queryAsync(
          (v: AIGenerationVersion) => v.sessionId === session!.id
        );
        // Sort by versionNumber and build conversation history
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
    const directorResult = await runCreativeDirector(
      context,
      brandIntel,
      instruction || 'Create a professional marketing visual based on the brief.',
      conversationHistory.length > 0 ? conversationHistory : undefined,
    );

    // Determine the image prompt — use Creative Director output or fallback
    let imagePrompt: string;
    let creativeStrategy = directorResult.strategy;

    if (directorResult.success && creativeStrategy?.optimizedImagePrompt) {
      imagePrompt = creativeStrategy.optimizedImagePrompt;
      console.log('[visual-gen] Creative Director produced optimized prompt');
    } else {
      // Fallback: build a basic prompt from context (same as before)
      console.warn('[visual-gen] Creative Director failed, using fallback prompt:', directorResult.error);
      imagePrompt = `Professional marketing visual for "${context.ganttItem.title}". ${context.promptContext}. ${instruction || ''}`;
    }

    // Build a brief summary for the quality gate
    const briefSummary = `Title: ${context.ganttItem.title}. Client: ${context.clientName}. Industry: ${context.businessField}. Platform: ${context.platform}. Format: ${context.format}. Visual concept: ${context.ganttItem.visualConcept || 'not specified'}. Graphic text: ${context.ganttItem.graphicText || 'none'}.`;

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 5: Generate or Edit the image
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[visual-gen] Stage 4: Generating image...');
    let resultBase64 = '';
    let resultRevisedPrompt: string | undefined;
    let referenceImageUrls: string[] = [];

    if (referenceVersionId) {
      // Load reference version and use its image for editing
      const refVersion = await aiGenerationVersions.getByIdAsync(referenceVersionId) as AIGenerationVersion | null;
      if (!refVersion || !refVersion.imageUrl) {
        return NextResponse.json(
          { error: 'Reference version not found or has no image' },
          { status: 404 }
        );
      }
      referenceImageUrls = [refVersion.imageUrl];
      const imgResponse = await fetch(refVersion.imageUrl);
      if (!imgResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch reference image' },
          { status: 500 }
        );
      }
      const imgArrayBuffer = await imgResponse.arrayBuffer();
      const imgBuffer = Buffer.from(imgArrayBuffer);

      const editResult = await editImage({
        prompt: imagePrompt,
        referenceImages: [imgBuffer],
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
    } else {
      const genResult = await generateImage({
        prompt: imagePrompt,
        width,
        height,
        quality,
      });
      if (!genResult.success || !genResult.images.length) {
        return NextResponse.json(
          { error: genResult.error || 'Failed to generate image' },
          { status: 500 }
        );
      }
      resultBase64 = genResult.images[0].base64;
      resultRevisedPrompt = genResult.images[0].revisedPrompt;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 6: Visual Quality Gate
    // ═══════════════════════════════════════════════════════════════════════
    let qualityAssessment: any = null;
    if (creativeStrategy) {
      console.log('[visual-gen] Stage 5: Running Visual Quality Gate...');
      const qgResult = await runQualityGate(resultBase64, creativeStrategy, briefSummary);
      if (qgResult.success && qgResult.assessment) {
        qualityAssessment = qgResult.assessment;

        // Auto-retry if quality gate says to retry and we have a corrective prompt
        if (!qgResult.assessment.passed && qgResult.assessment.shouldRetry && qgResult.assessment.correctivePrompt) {
          console.log('[visual-gen] Stage 5b: Quality gate failed — auto-retrying with corrections...');
          const correctedPrompt = `${imagePrompt}\n\nCRITICAL CORRECTIONS (from quality review):\n${qgResult.assessment.correctivePrompt}`;

          if (referenceVersionId && referenceImageUrls.length) {
            // Re-edit with corrected prompt
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
                // Run quality gate again on retried image
                const qg2 = await runQualityGate(resultBase64, creativeStrategy, briefSummary);
                if (qg2.success && qg2.assessment) {
                  qualityAssessment = qg2.assessment;
                }
              }
            }
          } else {
            // Re-generate with corrected prompt
            const retryResult = await generateImage({
              prompt: correctedPrompt,
              width,
              height,
              quality,
            });
            if (retryResult.success && retryResult.images.length) {
              resultBase64 = retryResult.images[0].base64;
              resultRevisedPrompt = retryResult.images[0].revisedPrompt;
              // Run quality gate again on retried image
              const qg2 = await runQualityGate(resultBase64, creativeStrategy, briefSummary);
              if (qg2.success && qg2.assessment) {
                qualityAssessment = qg2.assessment;
              }
            }
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // ═══════════════════════════════════════════════════════════════════════
    // STAGE 7: Upload to Supabase Storage + persist records
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[visual-gen] Stage 6: Uploading and persisting...');

    // Create session if it doesn't exist
    if (!session) {
      session = await aiGenerationSessions.createAsync({
        clientId,
        ganttItemId,
        status: 'active',
        contextSnapshot: {
          briefSummary,
          brandRulesSummary: brandIntel.brandRulesSummary,
          creativeStrategy: creativeStrategy ? {
            centralMessage: creativeStrategy.centralMessage,
            creativeIdea: creativeStrategy.creativeIdea,
            style: creativeStrategy.style,
            mood: creativeStrategy.mood,
          } : null,
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

    // Upload image
    const sb = getSupabase();
    const buffer = Buffer.from(resultBase64, 'base64');
    const storagePath = `visual-generation/${clientId}/${sessionId}/${versionNumber}.png`;

    const { error: uploadError } = await sb.storage
      .from('project-files')
      .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error('[visual-generation] Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload generated image' },
        { status: 500 }
      );
    }

    const { data: urlData } = sb.storage.from('project-files').getPublicUrl(storagePath);
    const imageUrl = urlData?.publicUrl || null;

    // Create version record with enriched metadata
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
      // Enriched metadata from the pipeline
      creativeStrategy: creativeStrategy ? {
        centralMessage: creativeStrategy.centralMessage,
        creativeIdea: creativeStrategy.creativeIdea,
        composition: creativeStrategy.composition,
        style: creativeStrategy.style,
        mood: creativeStrategy.mood,
        visualType: creativeStrategy.visualType,
        luxuryLevel: creativeStrategy.luxuryLevel,
        directorNotes: creativeStrategy.directorNotes,
      } : null,
      qualityAssessment: qualityAssessment ? {
        passed: qualityAssessment.passed,
        score: qualityAssessment.score,
        issues: qualityAssessment.issues,
        suggestions: qualityAssessment.suggestions,
        assessment: qualityAssessment.assessment,
      } : null,
      createdAt: new Date().toISOString(),
    } as Omit<AIGenerationVersion, 'id'> as any);

    // Update session
    await aiGenerationSessions.updateAsync(sessionId, {
      activeVersionId: version.id,
      versionCount: versionNumber,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[visual-gen] Complete — version ${versionNumber}, quality: ${qualityAssessment?.score ?? 'N/A'}, duration: ${durationMs}ms`);

    return NextResponse.json({
      ...version,
      // Include pipeline metadata in response for the UI
      _pipeline: {
        creativeStrategy: creativeStrategy ? {
          centralMessage: creativeStrategy.centralMessage,
          creativeIdea: creativeStrategy.creativeIdea,
          style: creativeStrategy.style,
          mood: creativeStrategy.mood,
          directorNotes: creativeStrategy.directorNotes,
        } : null,
        qualityAssessment: qualityAssessment ? {
          passed: qualityAssessment.passed,
          score: qualityAssessment.score,
          issues: qualityAssessment.issues,
          suggestions: qualityAssessment.suggestions,
          assessment: qualityAssessment.assessment,
        } : null,
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
