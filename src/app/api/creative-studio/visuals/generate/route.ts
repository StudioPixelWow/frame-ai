import { NextRequest, NextResponse } from 'next/server';
import { generateVisualAssets } from '@/lib/services/zono-creative/visualGenerationEngine';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const {
      clientId,
      entityType,
      entityId,
      entityName,
      assetType,
      conceptId,
      designSetId,
      variationOf,
      variationDirection,
    } = await req.json();

    if (!clientId) {
      return NextResponse.json({ error: 'clientId required' }, { status: 400 });
    }

    const result = await generateVisualAssets({
      clientId,
      entityType: entityType || 'client',
      entityId: entityId || clientId,
      entityName: entityName || clientId,
      assetType: assetType || 'hero_image',
      conceptId: conceptId || null,
      designSetId: designSetId || null,
      variationOf: variationOf || null,
      variationDirection: variationDirection || null,
    });

    return NextResponse.json({
      success: result.success,
      assets: result.assets,
      jobId: result.jobId,
      error: result.error,
    });
  } catch (err: any) {
    console.error('[creative-studio/visuals/generate] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Visual generation failed' },
      { status: 500 },
    );
  }
}
