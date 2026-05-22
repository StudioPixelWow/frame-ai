/**
 * PATCH /api/podcast/episode-candidates/:candidateId — edit a clip candidate
 * DELETE /api/podcast/episode-candidates/:candidateId — reject a single candidate
 *
 * Used when the user adjusts time range, title, or description on a suggested clip.
 * Sets candidateStatus to 'edited_by_user'. Does NOT approve.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  editClipCandidate,
  rejectClipCandidates,
} from '@/lib/podcast-engine/clip-approval-engine';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ candidateId: string }> };

export async function PATCH(req: NextRequest, context: Params) {
  const { candidateId } = await context.params;

  try {
    const body = await req.json();
    const { startTime, endTime, title, description } = body as {
      startTime?: number;
      endTime?: number;
      title?: string;
      description?: string;
    };

    const updated = await editClipCandidate(candidateId, {
      startTime,
      endTime,
      title,
      description,
    });

    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בעריכת המועמד';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: Params) {
  const { candidateId } = await context.params;

  try {
    await rejectClipCandidates('', [candidateId]);
    return NextResponse.json({ success: true, message: 'המועמד נדחה' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה בדחיית המועמד';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
