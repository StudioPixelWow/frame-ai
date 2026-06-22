import { NextRequest, NextResponse } from 'next/server';
import { generateDesignSets } from '@/lib/services/zono-creative/designGenerationEngine';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { entityType, entityId, entityName, conceptId, designType } = await req.json();

    if (!entityId) {
      return NextResponse.json({ error: 'entityId required' }, { status: 400 });
    }

    const result = await generateDesignSets({
      entityType: entityType || 'client',
      entityId,
      entityName: entityName || entityId,
      conceptId: conceptId || null,
      designType: designType || 'feed_post',
    });

    return NextResponse.json({
      success: result.success,
      designSet: result.designSet,
      variants: result.variants,
      variantCount: result.variantCount,
      error: result.error,
    });
  } catch (err: any) {
    console.error('[creative-studio/designs/generate] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Design generation failed' },
      { status: 500 },
    );
  }
}
