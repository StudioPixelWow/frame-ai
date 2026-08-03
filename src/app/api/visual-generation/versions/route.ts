/**
 * GET /api/visual-generation/versions?sessionId=...
 * Load all versions for a session, ordered by versionNumber.
 *
 * PATCH /api/visual-generation/versions
 * Update a version status (select/reject).
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiGenerationSessions, aiGenerationVersions, clientGanttItems } from '@/lib/db/collections';
import type { AIGenerationVersion, ClientGanttItem } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId query parameter is required' },
        { status: 400 }
      );
    }

    const versions = await aiGenerationVersions.queryAsync(
      (v: AIGenerationVersion) => v.sessionId === sessionId
    ) as AIGenerationVersion[];

    // Sort by versionNumber ascending
    versions.sort((a, b) => a.versionNumber - b.versionNumber);

    return NextResponse.json(versions);
  } catch (error: any) {
    console.error('[visual-generation/versions] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch versions' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { versionId, status } = body;

    if (!versionId || !status) {
      return NextResponse.json(
        { error: 'versionId and status are required' },
        { status: 400 }
      );
    }

    if (!['selected', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "selected" or "rejected"' },
        { status: 400 }
      );
    }

    // Load the version
    const version = await aiGenerationVersions.getByIdAsync(versionId) as AIGenerationVersion | null;
    if (!version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    // Update the version status
    const updatedVersion = await aiGenerationVersions.updateAsync(versionId, { status });

    // When selecting a version, update session + gantt item
    if (status === 'selected') {
      // Update session's active version
      await aiGenerationSessions.updateAsync(version.sessionId, {
        activeVersionId: versionId,
        updatedAt: new Date().toISOString(),
      });

      // Update the gantt item's imageUrls to include this version's image
      if (version.imageUrl && version.ganttItemId) {
        const ganttItem = await clientGanttItems.getByIdAsync(version.ganttItemId) as ClientGanttItem | null;
        if (ganttItem) {
          const currentUrls = ganttItem.imageUrls || [];
          if (!currentUrls.includes(version.imageUrl)) {
            await clientGanttItems.updateAsync(version.ganttItemId, {
              imageUrls: [...currentUrls, version.imageUrl],
            });
          }
        }
      }
    }

    return NextResponse.json(updatedVersion);
  } catch (error: any) {
    console.error('[visual-generation/versions] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update version' },
      { status: 500 }
    );
  }
}
