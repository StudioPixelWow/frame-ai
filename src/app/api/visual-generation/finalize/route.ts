/**
 * POST /api/visual-generation/finalize
 *
 * After the user chooses one of the 3 generated options, this endpoint:
 * 1. Downloads the selected image
 * 2. Uses sharp to create 3 size variants (Facebook, Instagram, Story)
 * 3. Uploads all 4 images (original + 3 variants) to Supabase Storage
 * 4. Saves all URLs to the Gantt item's imageUrls
 * 5. Marks the Gantt item status as 'approved' (מאושרת וממתנה לפרסום)
 * 6. Returns all variant info
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { aiGenerationVersions, aiGenerationSessions, clientGanttItems } from '@/lib/db/collections';
import type { AIGenerationVersion, ClientGanttItem } from '@/lib/db/schema';
import sharp from 'sharp';

export const maxDuration = 120;

// ── Size variant definitions ─────────────────────────────────────────
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

// ── Main handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { versionId, ganttItemId, clientId } = body;

    if (!versionId || !ganttItemId || !clientId) {
      return NextResponse.json(
        { error: 'versionId, ganttItemId, and clientId are required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // ── Step 1: Load selected version ────────────────────────────────
    console.log('[visual-gen/finalize] Loading selected version:', versionId);
    const version = await aiGenerationVersions.getByIdAsync(versionId) as AIGenerationVersion | null;
    if (!version || !version.imageUrl) {
      return NextResponse.json(
        { error: 'Version not found or has no image' },
        { status: 404 }
      );
    }

    // Mark as selected
    await aiGenerationVersions.updateAsync(versionId, { status: 'selected' });
    if (version.sessionId) {
      await aiGenerationSessions.updateAsync(version.sessionId, {
        activeVersionId: versionId,
        updatedAt: new Date().toISOString(),
      });
    }

    // ── Step 2: Download original image ──────────────────────────────
    console.log('[visual-gen/finalize] Downloading original image...');
    const imgResp = await fetch(version.imageUrl);
    if (!imgResp.ok) {
      return NextResponse.json(
        { error: 'Failed to download selected image' },
        { status: 500 }
      );
    }
    const originalBuffer = Buffer.from(await imgResp.arrayBuffer());
    const originalMeta = await sharp(originalBuffer).metadata();
    const origWidth = originalMeta.width || 1080;
    const origHeight = originalMeta.height || 1350;

    console.log(`[visual-gen/finalize] Original image: ${origWidth}×${origHeight}`);

    // ── Step 3: Generate size variants with sharp ────────────────────
    const sb = getSupabase();
    const sessionId = version.sessionId;
    const variantResults: Array<{
      key: string;
      label: string;
      labelHe: string;
      width: number;
      height: number;
      platform: string;
      imageUrl: string;
    }> = [];

    // Include the original as the first result
    variantResults.push({
      key: 'original',
      label: 'Original',
      labelHe: 'מקור',
      width: origWidth,
      height: origHeight,
      platform: 'original',
      imageUrl: version.imageUrl,
    });

    for (const variant of SIZE_VARIANTS) {
      console.log(`[visual-gen/finalize] Generating ${variant.key}: ${variant.width}×${variant.height}...`);
      try {
        // Use sharp contain mode with background — ensures ALL content (text, logo)
        // is visible. Adds padding bars if aspect ratios differ rather than cropping.
        // This preserves the visual integrity of every variant.
        const resizedBuffer = await sharp(originalBuffer)
          .resize(variant.width, variant.height, {
            fit: 'contain',
            position: 'centre',
            background: { r: 0, g: 0, b: 0, alpha: 1 }, // black bars if needed
          })
          .png({ quality: 90 })
          .toBuffer();

        // Upload to Supabase Storage
        const storagePath = `visual-generation/${clientId}/${sessionId}/final_${variant.key}.png`;
        const { error: uploadError } = await sb.storage
          .from('project-files')
          .upload(storagePath, resizedBuffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) {
          console.error(`[visual-gen/finalize] Upload error for ${variant.key}:`, uploadError);
          continue;
        }

        const { data: urlData } = sb.storage.from('project-files').getPublicUrl(storagePath);
        const imageUrl = urlData?.publicUrl || '';

        if (imageUrl) {
          variantResults.push({
            key: variant.key,
            label: variant.label,
            labelHe: variant.labelHe,
            width: variant.width,
            height: variant.height,
            platform: variant.platform,
            imageUrl,
          });
          console.log(`[visual-gen/finalize] ${variant.key} uploaded: ${imageUrl}`);
        }
      } catch (err: any) {
        console.error(`[visual-gen/finalize] Error generating ${variant.key}:`, err.message);
      }
    }

    // ── Step 4: Save all URLs to Gantt item ──────────────────────────
    console.log('[visual-gen/finalize] Saving to Gantt item...');
    const allImageUrls = variantResults.map((v) => v.imageUrl);

    const ganttItem = await clientGanttItems.getByIdAsync(ganttItemId) as ClientGanttItem | null;
    if (ganttItem) {
      await clientGanttItems.updateAsync(ganttItemId, {
        imageUrls: allImageUrls,
        status: 'approved',
      });
      console.log(`[visual-gen/finalize] Gantt item updated — ${allImageUrls.length} images, status=approved`);
    } else {
      console.warn('[visual-gen/finalize] Gantt item not found:', ganttItemId);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[visual-gen/finalize] Complete — ${variantResults.length} variants in ${durationMs}ms`);

    return NextResponse.json({
      success: true,
      variants: variantResults,
      ganttItemId,
      ganttStatus: 'approved',
      durationMs,
    });
  } catch (error: any) {
    console.error('[visual-gen/finalize] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to finalize visual' },
      { status: 500 }
    );
  }
}
