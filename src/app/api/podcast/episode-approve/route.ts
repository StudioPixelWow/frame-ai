/**
 * POST /api/podcast/episode-approve — approve selected clip candidates
 *
 * This is the ONLY route that creates real ApprovedClip records.
 * Before this is called, candidates are just suggestions — nothing is saved
 * as a real clip and no processing starts.
 *
 * Body: {
 *   episodeId: string,
 *   sourceEpisodeVideoId: string,
 *   projectId?: string,
 *   approvals: Array<{
 *     candidateId: string,
 *     startTime?: number,   // user-adjusted
 *     endTime?: number,     // user-adjusted
 *     title?: string,       // user-edited
 *   }>
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  approveClipCandidates,
  type ClipApprovalInput,
} from '@/lib/podcast-engine/clip-approval-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { episodeId, sourceEpisodeVideoId, projectId, approvals } = body as {
      episodeId?: string;
      sourceEpisodeVideoId?: string;
      projectId?: string;
      approvals?: ClipApprovalInput[];
    };

    if (!episodeId) {
      return NextResponse.json({ error: 'חסר episodeId' }, { status: 400 });
    }

    if (!sourceEpisodeVideoId) {
      return NextResponse.json({ error: 'חסר sourceEpisodeVideoId' }, { status: 400 });
    }

    if (!approvals || !Array.isArray(approvals) || approvals.length === 0) {
      return NextResponse.json(
        { error: 'חסרים קליפים לאישור — נדרש מערך approvals עם לפחות קליפ אחד' },
        { status: 400 }
      );
    }

    // Validate each approval has candidateId
    for (const a of approvals) {
      if (!a.candidateId) {
        return NextResponse.json(
          { error: 'כל קליפ חייב לכלול candidateId' },
          { status: 400 }
        );
      }
    }

    const result = await approveClipCandidates(
      episodeId,
      approvals,
      sourceEpisodeVideoId,
      projectId
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'שגיאה באישור קליפים' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${result.totalApproved} קליפים אושרו בהצלחה`,
      approvedClipIds: result.approvedClipIds,
      totalApproved: result.totalApproved,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה באישור קליפים';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
