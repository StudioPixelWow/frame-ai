/**
 * POST /api/data/project-file-upload
 *
 * Accepts a file (FormData) + projectId, uploads to Supabase Storage
 * bucket "project-files", returns the public URL.
 *
 * Validations:
 *   - max 10 MB
 *   - allowed types: pdf, png, jpg, jpeg, gif, webp
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadToStorage, makeStoragePath } from '@/lib/storage/upload';

const BUCKET = 'project-files';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `הקובץ גדול מדי. מקסימום ${MAX_SIZE / (1024 * 1024)} MB` },
        { status: 400 }
      );
    }

    // Validate type
    const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || '' : '';
    if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: 'סוג קובץ לא נתמך. מותר: PDF, תמונות (PNG, JPG, GIF, WEBP)' },
        { status: 400 }
      );
    }

    // Build a safe storage path: projectId/timestamp-filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._\u0590-\u05FF-]/g, '_');
    const storagePath = `${projectId}/${Date.now()}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadToStorage({
      bucket: BUCKET,
      storagePath,
      buffer,
      contentType: file.type || 'application/octet-stream',
      maxSize: MAX_SIZE,
      upsert: false,
    });

    console.log(`[project-file-upload] ✅ uploaded project=${projectId} name="${file.name}" size=${buffer.length} url=${result.publicUrl}`);

    return NextResponse.json({
      url: result.publicUrl,
      fileName: file.name,
      fileSize: buffer.length,
      contentType: file.type,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[project-file-upload] fatal:', msg);
    return NextResponse.json({ error: `שגיאה בהעלאה: ${msg}` }, { status: 500 });
  }
}
