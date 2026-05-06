import { NextRequest, NextResponse } from 'next/server';
import { testConnection } from '@/lib/seo/wordpress-client';
import type { WPConnection } from '@/lib/seo/wordpress-client';

/**
 * POST /api/seo-geo-plans/test-wp-connection
 * Test WordPress connection without saving — used from client integrations tab
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { siteUrl, username, applicationPassword } = body;

    if (!siteUrl || !username || !applicationPassword) {
      return NextResponse.json({ success: false, error: 'חסרים שדות חובה' }, { status: 400 });
    }

    const connection: WPConnection = { siteUrl, username, applicationPassword };
    const result = await testConnection(connection);

    if (result.success) {
      return NextResponse.json({
        success: true,
        siteName: result.siteName || 'WordPress Site',
        yoastInstalled: result.yoastInstalled || false,
        pagesCount: result.pagesCount || 0,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'החיבור נכשל',
      });
    }
  } catch (error) {
    console.error('[WP-Test] Error:', error);
    return NextResponse.json({ success: false, error: 'שגיאה בבדיקת החיבור' }, { status: 500 });
  }
}
