/**
 * POST /api/seo/backlinks/pitch — Generate personalized pitch for a backlink target
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateGuestPostPitches, generatePRContent } from '@/lib/seo/backlink-engine';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, targetDomain, topic, type } = body;

    if (!clientId || !targetDomain) {
      return NextResponse.json(
        { error: 'נדרשים clientId ו-targetDomain' },
        { status: 400 }
      );
    }

    if (type === 'pr') {
      // Generate PR content
      const prContent = await generatePRContent(clientId, topic || targetDomain);
      return NextResponse.json({
        success: true,
        type: 'pr',
        content: prContent,
      });
    }

    // Default: generate guest post pitch
    const pitch = await generateGuestPostPitches(
      clientId,
      targetDomain,
      topic || 'תוכן מקצועי ורלוונטי'
    );

    return NextResponse.json({
      success: true,
      type: 'guest_post',
      pitch,
    });
  } catch (error) {
    console.error('[Backlinks Pitch API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה ביצירת הפיץ׳' },
      { status: 500 }
    );
  }
}
