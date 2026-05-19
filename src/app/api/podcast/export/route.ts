/**
 * POST /api/podcast/export - Export rendered clips as a ZIP archive
 *
 * Accepts { episodeId, clipIds } and bundles rendered video files,
 * social package JSON, and thumbnail images into a downloadable ZIP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { episodeId, clipIds } = body;

    if (!episodeId) {
      return NextResponse.json(
        { error: 'episodeId is required' },
        { status: 400 }
      );
    }

    if (!clipIds || !Array.isArray(clipIds) || clipIds.length === 0) {
      return NextResponse.json(
        { error: 'clipIds array is required and must not be empty' },
        { status: 400 }
      );
    }

    // ── Fetch episode title ──────────────────────────────────────────────
    const { data: episode, error: episodeError } = await supabase
      .from('podcast_episodes')
      .select('id, title')
      .eq('id', episodeId)
      .single();

    if (episodeError || !episode) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      );
    }

    // ── Fetch rendered clips ─────────────────────────────────────────────
    const { data: renderedClips, error: clipsError } = await supabase
      .from('podcast_rendered_clips')
      .select('*, clip_candidate:clip_candidate_id(id, title)')
      .eq('episode_id', episodeId)
      .in('id', clipIds)
      .eq('status', 'completed');

    if (clipsError) {
      return NextResponse.json(
        { error: clipsError.message },
        { status: 500 }
      );
    }

    if (!renderedClips || renderedClips.length === 0) {
      return NextResponse.json(
        { error: 'No completed rendered clips found for the given IDs' },
        { status: 404 }
      );
    }

    // ── Build ZIP archive ────────────────────────────────────────────────
    const zip = new JSZip();

    for (const clip of renderedClips) {
      const clipTitle = sanitizeFilename(
        clip.clip_candidate?.title || `clip_${clip.id.slice(0, 8)}`
      );

      // Add rendered video file
      if (clip.output_file_path) {
        try {
          const videoBuffer = await fetchFileBuffer(clip.output_file_path);
          if (videoBuffer) {
            const ext = getExtension(clip.output_file_path, 'mp4');
            zip.file(`${clipTitle}.${ext}`, videoBuffer);
          }
        } catch (e) {
          console.warn(`[Export] Failed to fetch video for clip ${clip.id}:`, e);
        }
      }

      // Add social package JSON
      if (clip.social_package) {
        zip.file(
          `${clipTitle}_social.json`,
          JSON.stringify(clip.social_package, null, 2)
        );
      }

      // Add thumbnail images
      if (clip.thumbnail_paths && Array.isArray(clip.thumbnail_paths)) {
        for (let i = 0; i < clip.thumbnail_paths.length; i++) {
          const thumbPath = clip.thumbnail_paths[i];
          try {
            const thumbBuffer = await fetchFileBuffer(thumbPath);
            if (thumbBuffer) {
              const ext = getExtension(thumbPath, 'jpg');
              const suffix = clip.thumbnail_paths.length > 1 ? `_${i + 1}` : '';
              zip.file(`${clipTitle}_thumb${suffix}.${ext}`, thumbBuffer);
            }
          } catch (e) {
            console.warn(`[Export] Failed to fetch thumbnail ${thumbPath}:`, e);
          }
        }
      }
    }

    // ── Generate ZIP buffer and return ───────────────────────────────────
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipFilename = sanitizeFilename(episode.title) + '_clips.zip';

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(zipFilename)}"`,
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error) {
    console.error('[Export] Failed to create export ZIP:', error);
    return NextResponse.json(
      { error: 'Failed to create export archive' },
      { status: 500 }
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch a file from Supabase Storage or an absolute URL and return as Buffer.
 */
async function fetchFileBuffer(filePath: string): Promise<Buffer | null> {
  // If it's a full URL, fetch directly
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    const res = await fetch(filePath);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  // Otherwise assume it's a Supabase Storage path (bucket/path)
  const parts = filePath.split('/');
  const bucket = parts[0];
  const path = parts.slice(1).join('/');

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);

  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Extract file extension from a path, with a fallback default.
 */
function getExtension(filePath: string, fallback: string): string {
  const match = filePath.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return match ? match[1].toLowerCase() : fallback;
}

/**
 * Sanitize a string for use as a filename.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);
}
