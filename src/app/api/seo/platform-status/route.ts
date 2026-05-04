import { NextResponse } from 'next/server';
import { isPlatformAvailable, type PlatformId } from '@/lib/seo/platform-apis';

export const runtime = 'nodejs';

/**
 * GET /api/seo/platform-status
 *
 * Returns availability status of each AI/SEO platform based on env var configuration.
 * Used by the dashboard to show which platforms are connected vs not.
 */
export async function GET() {
  const platforms: PlatformId[] = [
    'google_seo',
    'google_ai_overview',
    'gemini',
    'chatgpt',
    'claude',
    'perplexity',
  ];

  const status: Record<string, { available: boolean; name: string }> = {};

  for (const pid of platforms) {
    status[pid] = {
      available: isPlatformAvailable(pid),
      name: pid,
    };
  }

  const connectedCount = Object.values(status).filter((s) => s.available).length;

  return NextResponse.json({
    platforms: status,
    connectedCount,
    totalCount: platforms.length,
  });
}
