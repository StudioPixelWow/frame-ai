/**
 * GET /api/data/podcast-strategies/debug?session_id=...
 *
 * Diagnostic endpoint — returns detailed info about podcast strategy lookup.
 * No auth required (debug only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensurePodcastTables, getAllStrategies } from '@/lib/db/podcast-db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');

  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    querySessionId: sessionId,
  };

  try {
    await ensurePodcastTables();
    const all = await getAllStrategies();

    result.totalStrategies = all.length;
    result.allSessionIds = all.map((s: any) => ({
      id: s.id,
      sessionId: s.sessionId ?? null,
      status: s.status ?? null,
      createdAt: s.createdAt ?? null,
    }));

    if (sessionId) {
      const match = all.find((s: any) => s.sessionId === sessionId);
      result.foundStrategy = !!match;

      if (match) {
        result.strategy = {
          id: (match as any).id,
          sessionId: (match as any).sessionId,
          clientName: (match as any).clientName,
          episodeType: (match as any).episodeType,
          status: (match as any).status,
          goalsCount: Array.isArray((match as any).goals) ? (match as any).goals.length : 0,
          questionsCount: Array.isArray((match as any).questions) ? (match as any).questions.length : 0,
          selectedQuestionsCount: Array.isArray((match as any).selectedQuestions) ? (match as any).selectedQuestions.length : 0,
          clipIdeasCount: Array.isArray((match as any).clipIdeas) ? (match as any).clipIdeas.length : 0,
          hasStrategySummary: !!(match as any).strategySummary,
          createdAt: (match as any).createdAt,
          updatedAt: (match as any).updatedAt,
        };
      } else {
        result.strategy = null;
        result.hint = 'No strategy found for this session_id. Check if the session_id matches what the wizard saves.';
      }
    } else {
      result.hint = 'Add ?session_id=YOUR_SESSION_ID to check a specific session';
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
