/**
 * GET /api/pixel-seo-geo/platform-status
 * Returns which AI platforms have API keys configured (server-side check).
 */
import { NextResponse } from 'next/server';
import { getApiStatus } from '@/lib/seo/platform-apis';

export async function GET() {
  const status = getApiStatus();
  console.log('[PIXEL SEO/GEO] Platform API status:', status);
  return NextResponse.json(status);
}
