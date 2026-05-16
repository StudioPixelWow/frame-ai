import { NextRequest, NextResponse } from 'next/server';
import {
  getConnection,
  connectGBP,
  getBusinessInfo,
  getReviews,
  getReviewStats,
  getInsights,
  createPost,
  replyToReview,
  updateBusinessInfo,
  getLocalRankings,
} from '@/lib/seo/gbp-service';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ============================================================================
// GET — קבלת מידע GBP (ביקורות, תובנות, דירוגים)
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const action = searchParams.get('action'); // reviews | stats | insights | info | rankings
    const locationId = searchParams.get('locationId');

    if (!clientId) {
      return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
    }

    const connection = getConnection(clientId);
    if (!connection) {
      return NextResponse.json({ error: 'לא נמצא חיבור GBP ללקוח זה' }, { status: 404 });
    }

    const loc = locationId || connection.locationId;

    switch (action) {
      case 'reviews': {
        const pageSize = parseInt(searchParams.get('pageSize') || '50');
        const reviews = await getReviews(loc, clientId, pageSize);
        return NextResponse.json({ reviews, locationId: loc });
      }

      case 'stats': {
        const stats = await getReviewStats(loc, clientId);
        return NextResponse.json({ stats, locationId: loc });
      }

      case 'insights': {
        const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 86400000).toISOString();
        const endDate = searchParams.get('endDate') || new Date().toISOString();
        const insights = await getInsights(loc, clientId, startDate, endDate);
        return NextResponse.json({ insights });
      }

      case 'info': {
        const info = await getBusinessInfo(loc, clientId);
        return NextResponse.json({ info });
      }

      case 'rankings': {
        const keywords = searchParams.get('keywords')?.split(',') || [];
        const location = searchParams.get('location') || 'ישראל';
        const businessName = searchParams.get('businessName') || '';
        if (!keywords.length || !businessName) {
          return NextResponse.json({ error: 'חסרים keywords ו-businessName' }, { status: 400 });
        }
        const rankings = await getLocalRankings(businessName, location, keywords);
        return NextResponse.json({ rankings });
      }

      default:
        return NextResponse.json({ error: 'action לא תקין. אפשרויות: reviews, stats, insights, info, rankings' }, { status: 400 });
    }
  } catch (error) {
    console.error('[GBP API] GET error:', error);
    return NextResponse.json({ error: `שגיאה: ${(error as Error).message}` }, { status: 500 });
  }
}

// ============================================================================
// POST — יצירת פוסט / תגובה לביקורת / חיבור
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
    }

    switch (action) {
      case 'connect': {
        const { locationId, refreshToken } = body;
        if (!locationId || !refreshToken) {
          return NextResponse.json({ error: 'חסרים locationId ו-refreshToken' }, { status: 400 });
        }
        const connection = connectGBP(clientId, locationId, refreshToken);
        return NextResponse.json({ connection, message: 'חיבור GBP בוצע בהצלחה' }, { status: 201 });
      }

      case 'createPost': {
        const { locationId, post } = body;
        const connection = getConnection(clientId);
        if (!connection) {
          return NextResponse.json({ error: 'לא נמצא חיבור GBP' }, { status: 404 });
        }
        const loc = locationId || connection.locationId;
        const result = await createPost(loc, post, clientId);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, postId: result.postId, message: 'הפוסט נוצר בהצלחה' }, { status: 201 });
      }

      case 'replyToReview': {
        const { locationId, reviewId, replyText } = body;
        const connection = getConnection(clientId);
        if (!connection) {
          return NextResponse.json({ error: 'לא נמצא חיבור GBP' }, { status: 404 });
        }
        if (!reviewId || !replyText) {
          return NextResponse.json({ error: 'חסרים reviewId ו-replyText' }, { status: 400 });
        }
        const loc = locationId || connection.locationId;
        const result = await replyToReview(loc, reviewId, replyText, clientId);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, message: 'התגובה נשלחה בהצלחה' });
      }

      default:
        return NextResponse.json({ error: 'action לא תקין. אפשרויות: connect, createPost, replyToReview' }, { status: 400 });
    }
  } catch (error) {
    console.error('[GBP API] POST error:', error);
    return NextResponse.json({ error: `שגיאה: ${(error as Error).message}` }, { status: 500 });
  }
}

// ============================================================================
// PUT — עדכון מידע עסקי
// ============================================================================

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, locationId, updates } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
    }

    const connection = getConnection(clientId);
    if (!connection) {
      return NextResponse.json({ error: 'לא נמצא חיבור GBP ללקוח זה' }, { status: 404 });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'חסרים שדות לעדכון' }, { status: 400 });
    }

    const loc = locationId || connection.locationId;
    const result = await updateBusinessInfo(loc, clientId, updates);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'המידע העסקי עודכן בהצלחה' });
  } catch (error) {
    console.error('[GBP API] PUT error:', error);
    return NextResponse.json({ error: `שגיאה: ${(error as Error).message}` }, { status: 500 });
  }
}
