/**
 * POST /api/visual-generation/generate
 * Generate a visual for a Gantt item using OpenAI image generation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { aiGenerationSessions, aiGenerationVersions } from '@/lib/db/collections';
import type { AIGenerationSession, AIGenerationVersion } from '@/lib/db/schema';
import { buildGenerationContext } from '@/lib/services/visual-generation/generationContextBuilder';
import { generateImage, editImage } from '@/lib/services/visual-generation/openaiImageProvider';

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

    // 1. Build generation context from gantt item + client data
    const context = await buildGenerationContext(ganttItemId, clientId);

    // 2. Find or create a session for this gantt item
    let session: AIGenerationSession | null = null;
    const existingSessions = await aiGenerationSessions.queryAsync(
      (s: AIGenerationSession) => s.ganttItemId === ganttItemId && s.status === 'active'
    );
    if (existingSessions.length > 0) {
      session = existingSessions[0] as AIGenerationSession;
    }

    // 3. Build the full prompt
    const fullPrompt = `You are a professional graphic designer creating marketing visuals for an Israeli marketing agency.

CONTEXT:
${context.promptContext}

USER REQUEST:
${instruction || 'Create a professional marketing visual based on the context above.'}

IMPORTANT RULES:
- If Hebrew text is specified in graphicText, render it accurately in the image
- The visual should look like a real professional ad, not AI-generated
- Use the brand colors specified
- Match the platform format exactly`;

    // Create session if it doesn't exist
    if (!session) {
      session = await aiGenerationSessions.createAsync({
        clientId,
        ganttItemId,
        status: 'active',
        contextSnapshot: context.contextSnapshot,
        systemPrompt: fullPrompt,
        sizePreset: { label: `${width}x${height}`, width, height },
        activeVersionId: null,
        versionCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Omit<AIGenerationSession, 'id'> as any);
    }

    const sessionId = session.id;
    const versionNumber = session.versionCount + 1;

    // 4. Generate or edit the image
    const startTime = Date.now();
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
      // Fetch the reference image and convert to Buffer
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
        prompt: fullPrompt,
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
        prompt: fullPrompt,
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

    const durationMs = Date.now() - startTime;

    // 5. Upload to Supabase Storage
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

    // 6. Create version record
    const version = await aiGenerationVersions.createAsync({
      sessionId,
      clientId,
      ganttItemId,
      versionNumber,
      status: 'completed',
      userInstruction: instruction || '',
      fullPrompt,
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
      createdAt: new Date().toISOString(),
    } as Omit<AIGenerationVersion, 'id'> as any);

    // 7. Update session
    await aiGenerationSessions.updateAsync(sessionId, {
      activeVersionId: version.id,
      versionCount: versionNumber,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json(version);
  } catch (error: any) {
    console.error('[visual-generation] Generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate visual' },
      { status: 500 }
    );
  }
}
