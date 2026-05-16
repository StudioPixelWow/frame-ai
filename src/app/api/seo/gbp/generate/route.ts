import { NextRequest, NextResponse } from 'next/server';
import {
  generateReviewResponse,
  generateGBPPost,
  getConnection,
} from '@/lib/seo/gbp-service';
import type { GBPReview } from '@/lib/seo/gbp-service';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ============================================================================
// POST — יצירת תוכן AI (תגובה לביקורת / פוסט GBP)
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
    }

    switch (action) {
      case 'generateReviewResponse': {
        const { review, businessName, tone } = body;
        if (!review || !businessName) {
          return NextResponse.json({ error: 'חסרים review ו-businessName' }, { status: 400 });
        }

        const result = await generateReviewResponse(
          review as GBPReview,
          businessName,
          tone || 'professional'
        );

        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
          response: result.response,
          message: 'תגובה נוצרה בהצלחה',
        });
      }

      case 'generatePost': {
        const { type, topic, businessName } = body;
        if (!type || !topic) {
          return NextResponse.json({ error: 'חסרים type ו-topic' }, { status: 400 });
        }

        const validTypes = ['OFFER', 'EVENT', 'UPDATE'];
        if (!validTypes.includes(type)) {
          return NextResponse.json({ error: `type לא תקין. אפשרויות: ${validTypes.join(', ')}` }, { status: 400 });
        }

        const connection = getConnection(clientId);
        const name = businessName || (connection ? 'העסק' : 'העסק');

        const result = await generateGBPPost(clientId, type, topic, name);

        if (result.error || !result.post) {
          return NextResponse.json({ error: result.error || 'שגיאה ביצירת פוסט' }, { status: 500 });
        }

        return NextResponse.json({
          post: result.post,
          message: 'פוסט נוצר בהצלחה — ניתן לפרסם או לערוך',
        });
      }

      default:
        return NextResponse.json({
          error: 'action לא תקין. אפשרויות: generateReviewResponse, generatePost',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[GBP Generate API] error:', error);
    return NextResponse.json({ error: `שגיאה: ${(error as Error).message}` }, { status: 500 });
  }
}
