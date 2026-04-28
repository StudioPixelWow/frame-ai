/**
 * GET /api/references/meta-test — diagnostic endpoint for Meta Ads Library
 *
 * Returns detailed info about:
 *   - Token presence and length
 *   - A sample search attempt
 *   - Result count and first result preview
 *   - Any error details
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkConnection, searchAds } from '@/lib/meta-ads/service';

export async function GET(req: NextRequest) {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // 1. Token check
  const token = process.env.META_ACCESS_TOKEN || null;
  result.hasToken = !!token;
  result.tokenLength = token ? token.length : 0;
  result.tokenPrefix = token ? token.slice(0, 10) + '...' : null;

  if (!token) {
    result.metaStatus = 'no_token';
    result.message = 'META_ACCESS_TOKEN is not set in environment variables';
    return NextResponse.json(result);
  }

  // 2. Connection check
  try {
    const connStatus = await checkConnection();
    result.connectionStatus = connStatus;
  } catch (err) {
    result.connectionStatus = { error: err instanceof Error ? err.message : 'Unknown' };
  }

  // 3. Sample search
  const sampleQuery = 'marketing';
  result.sampleQuery = sampleQuery;

  try {
    const ads = await searchAds(sampleQuery, 3);
    result.metaStatus = 'ok';
    result.resultCount = ads.length;

    if (ads.length > 0) {
      result.firstResultPreview = {
        id: ads[0].id,
        pageName: ads[0].page_name,
        hasBody: !!ads[0].ad_creative_body,
        bodyPreview: ads[0].ad_creative_body?.slice(0, 100) || null,
        hasSnapshotUrl: !!ads[0].ad_snapshot_url,
        snapshotUrl: ads[0].ad_snapshot_url || null,
        platforms: ads[0].publisher_platforms || [],
      };
    } else {
      result.firstResultPreview = null;
      result.message = 'Token is valid but search returned no results for sample query';
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.metaStatus = 'error';
    result.resultCount = 0;
    result.error = msg;

    // Parse common Meta API errors
    if (msg.includes('OAuthException')) {
      result.message = 'Token is expired or invalid — generate a new one';
    } else if (msg.includes('permissions')) {
      result.message = 'Token lacks required permissions for ads_archive';
    } else if (msg.includes('rate limit') || msg.includes('Too many')) {
      result.message = 'Rate limited by Meta — wait and retry';
    } else {
      result.message = `Meta API error: ${msg}`;
    }
  }

  return NextResponse.json(result);
}
