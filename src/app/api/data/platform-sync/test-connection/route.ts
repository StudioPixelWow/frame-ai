/**
 * POST /api/data/platform-sync/test-connection
 *
 * Tests a platform connection without saving.
 * Body: { platform: 'meta' | 'tiktok' | 'google', accountId, accessToken }
 * Returns: { valid, accountName?, error? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/api-guard';
import { testPlatformConnection } from '@/lib/platforms/registry';
import type { AdPlatform } from '@/lib/platforms/types';
import { AD_PLATFORMS } from '@/lib/platforms/types';

export async function POST(req: NextRequest) {
  const roleErr = requireRole(req, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const { platform, accountId, accessToken } = body;

    if (!platform || !AD_PLATFORMS.includes(platform as AdPlatform)) {
      return NextResponse.json({ valid: false, error: 'פלטפורמה לא חוקית' });
    }

    if (!accountId || !accessToken) {
      return NextResponse.json({ valid: false, error: 'חסר מזהה חשבון או אסימון גישה' });
    }

    const result = await testPlatformConnection(platform as AdPlatform, accountId, accessToken);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ valid: false, error: `שגיאה: ${msg}` });
  }
}
