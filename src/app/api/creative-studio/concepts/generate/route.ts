import { NextRequest, NextResponse } from 'next/server';
import { generateCreativeConcepts } from '@/lib/services/zono-creative/realEstateCreativeConceptEngine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { entityType, entityId, entityName } = await req.json();

    if (!entityId) {
      return NextResponse.json({ error: 'entityId required' }, { status: 400 });
    }

    const resolvedEntityType = entityType || 'client';
    const resolvedEntityName = entityName || entityId;

    const result = await generateCreativeConcepts(
      resolvedEntityType,
      entityId,
      resolvedEntityName,
    );

    return NextResponse.json({
      success: result.success,
      concepts: result.concepts,
      conceptCount: result.conceptCount,
      provider: result.provider,
      error: result.error,
    });
  } catch (err: any) {
    console.error('[creative-studio/concepts/generate] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Concept generation failed' },
      { status: 500 },
    );
  }
}
