import { NextRequest, NextResponse } from 'next/server';
import { brandAssets } from '@/lib/db/collections';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, fileUrl, fileName, fileMimeType, fileSize, assetType, title, description, tags, isApprovedReference, isRejectedReference, isCompetitorReference, notes } = body;

    if (!clientId || !fileUrl || !assetType) {
      return NextResponse.json({ error: 'Missing required fields: clientId, fileUrl, assetType' }, { status: 400 });
    }

    const asset = await brandAssets.createAsync({
      clientId,
      uploadedBy: null,
      assetType: assetType || 'other',
      assetCategory: null,
      title: title || fileName || '',
      description: description || '',
      fileUrl,
      filePath: '',
      fileName: fileName || '',
      fileMimeType: fileMimeType || '',
      fileSize: fileSize || 0,
      thumbnailUrl: fileUrl, // Use same URL as thumbnail for images
      sourceType: 'manual_upload',
      status: 'active',
      isApprovedReference: isApprovedReference || false,
      isRejectedReference: isRejectedReference || false,
      isCompetitorReference: isCompetitorReference || false,
      tags: tags || [],
      aiSummary: '',
      aiExtractedColors: [],
      aiDetectedStyle: {},
      aiDetectedText: {},
      aiVisualFeatures: {},
    });

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (err: any) {
    console.error('[creative-studio/upload] Error:', err);
    return NextResponse.json({ error: err?.message || 'Upload failed' }, { status: 500 });
  }
}
