/**
 * GET /api/data/auto-campaign/findings — List auto-monitor findings
 *
 * Query: ?clientId=X&campaignId=Y&type=Z&runId=R&limit=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoCampaignFindings } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId');
    const campaignId = url.searchParams.get('campaignId');
    const type = url.searchParams.get('type');
    const runId = url.searchParams.get('runId');
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 50;

    let findings = await autoCampaignFindings.getAllAsync();

    if (clientId) findings = findings.filter(f => f.clientId === clientId);
    if (campaignId) findings = findings.filter(f => f.campaignId === campaignId);
    if (type) findings = findings.filter(f => f.type === type);
    if (runId) findings = findings.filter(f => f.runId === runId);

    // Sort by severity (critical first), then confidence desc
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    findings.sort((a, b) => {
      const sevDiff = (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3);
      if (sevDiff !== 0) return sevDiff;
      return b.confidence - a.confidence;
    });

    // Group summary
    const summary = {
      total: findings.length,
      bySeverity: {
        critical: findings.filter(f => f.severity === 'critical').length,
        high: findings.filter(f => f.severity === 'high').length,
        medium: findings.filter(f => f.severity === 'medium').length,
        low: findings.filter(f => f.severity === 'low').length,
      },
      byType: {} as Record<string, number>,
      actionsCreated: findings.filter(f => f.actionCreated).length,
    };
    for (const f of findings) {
      summary.byType[f.type] = (summary.byType[f.type] || 0) + 1;
    }

    return NextResponse.json({
      findings: findings.slice(0, limit),
      summary,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
