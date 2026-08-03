/**
 * GET /api/visual-generation/sessions?ganttItemId=...
 * Load all generation sessions for a gantt item, including their versions.
 *
 * POST /api/visual-generation/sessions
 * Create a new generation session manually.
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiGenerationSessions, aiGenerationVersions } from '@/lib/db/collections';
import type { AIGenerationSession, AIGenerationVersion } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  try {
    const ganttItemId = req.nextUrl.searchParams.get('ganttItemId');
    if (!ganttItemId) {
      return NextResponse.json(
        { error: 'ganttItemId query parameter is required' },
        { status: 400 }
      );
    }

    // Load all sessions for this gantt item
    const sessions = await aiGenerationSessions.queryAsync(
      (s: AIGenerationSession) => s.ganttItemId === ganttItemId
    ) as AIGenerationSession[];

    // Load all versions and group by session
    const allVersions = await aiGenerationVersions.queryAsync(
      (v: AIGenerationVersion) => v.ganttItemId === ganttItemId
    ) as AIGenerationVersion[];

    const versionsBySession = new Map<string, AIGenerationVersion[]>();
    for (const v of allVersions) {
      const list = versionsBySession.get(v.sessionId) || [];
      list.push(v);
      versionsBySession.set(v.sessionId, list);
    }

    // Attach versions to each session
    const sessionsWithVersions = sessions.map((session) => ({
      ...session,
      versions: (versionsBySession.get(session.id) || []).sort(
        (a, b) => a.versionNumber - b.versionNumber
      ),
    }));

    return NextResponse.json(sessionsWithVersions);
  } catch (error: any) {
    console.error('[visual-generation/sessions] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, ganttItemId, contextSnapshot, sizePreset } = body;

    if (!clientId || !ganttItemId) {
      return NextResponse.json(
        { error: 'clientId and ganttItemId are required' },
        { status: 400 }
      );
    }

    const session = await aiGenerationSessions.createAsync({
      clientId,
      ganttItemId,
      status: 'active',
      contextSnapshot: contextSnapshot || {},
      systemPrompt: '',
      sizePreset: sizePreset || { label: '1024x1024', width: 1024, height: 1024 },
      activeVersionId: null,
      versionCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Omit<AIGenerationSession, 'id'> as any);

    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    console.error('[visual-generation/sessions] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}
