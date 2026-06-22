import { NextRequest, NextResponse } from 'next/server';
import { getSignedUploadUrl } from '@/lib/storage/upload';

export async function POST(req: NextRequest) {
  try {
    const { clientId, fileName, contentType, fileSize, assetType } = await req.json();
    if (!clientId || !fileName || !contentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const storagePath = `brand-assets/${clientId}/${assetType || 'other'}/${Date.now()}-${fileName}`;
    const result = await getSignedUploadUrl({ fileName: storagePath, contentType, fileSize: fileSize || 0 });

    return NextResponse.json({ success: true, ...result, storagePath });
  } catch (err: any) {
    console.error('[creative-studio/upload-url] Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to get upload URL' }, { status: 500 });
  }
}
