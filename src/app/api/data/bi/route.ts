/**
 * GET /api/data/bi
 * POST /api/data/bi
 *
 * Business Intelligence API — returns full BI dashboard data.
 *
 * Query params (GET) or body (POST):
 *   section?: 'health' | 'profitability' | 'content' | 'cross-client' | 'warnings' | 'insights' | 'all'
 *   clientId?: string  — filter to specific client
 *
 * Default: returns all sections.
 */

import { NextRequest, NextResponse } from 'next/server';
import { clients, campaigns, ads, leads } from '@/lib/db';
import { computeAllClientHealth, computeClientHealth } from '@/lib/bi/client-health';
import { computeAllProfitability, computeClientProfitability } from '@/lib/bi/profitability';
import { analyzeContentIntelligence } from '@/lib/bi/content-intelligence';
import { analyzeCrossClient } from '@/lib/bi/cross-client';
import { detectEarlyWarnings } from '@/lib/bi/early-warnings';
import { generateAIInsights } from '@/lib/bi/ai-insights';
import { comparePlatforms, compareClientPlatforms } from '@/lib/bi/platform-comparison';

type BISection = 'health' | 'profitability' | 'content' | 'cross-client' | 'warnings' | 'insights' | 'platforms' | 'all';

async function fetchAllData() {
  const [allClients, allCampaigns, allAds, allLeads] = await Promise.all([
    clients.getAllAsync(),
    campaigns.getAllAsync(),
    ads.getAllAsync(),
    leads.getAllAsync(),
  ]);
  return {
    clients: allClients || [],
    campaigns: allCampaigns || [],
    ads: allAds || [],
    leads: allLeads || [],
  };
}

async function buildBI(section: BISection, clientId?: string) {
  const data = await fetchAllData();
  const result: Record<string, unknown> = {};

  const sections = section === 'all'
    ? ['health', 'profitability', 'content', 'cross-client', 'warnings', 'insights', 'platforms']
    : [section];

  // Health
  if (sections.includes('health')) {
    if (clientId) {
      const client = data.clients.find((c: any) => c.id === clientId);
      result.health = client
        ? computeClientHealth(client as any, data.campaigns as any, data.ads as any, data.leads as any)
        : { hasEnoughData: false, status: 'no_data', statusLabel: 'לקוח לא נמצא' };
    } else {
      result.health = computeAllClientHealth(data.clients as any, data.campaigns as any, data.ads as any, data.leads as any);
    }
  }

  // Profitability
  if (sections.includes('profitability')) {
    if (clientId) {
      const client = data.clients.find((c: any) => c.id === clientId);
      result.profitability = client
        ? computeClientProfitability(client as any, data.campaigns as any, data.ads as any, data.leads as any)
        : { hasEnoughData: false, level: 'no_data', levelLabel: 'לקוח לא נמצא' };
    } else {
      result.profitability = computeAllProfitability(data.clients as any, data.campaigns as any, data.ads as any, data.leads as any);
    }
  }

  // Content intelligence
  if (sections.includes('content')) {
    result.content = analyzeContentIntelligence(data.ads as any, clientId);
  }

  // Cross-client
  if (sections.includes('cross-client')) {
    result.crossClient = analyzeCrossClient(data.clients as any, data.campaigns as any, data.ads as any, data.leads as any);
  }

  // Early warnings
  if (sections.includes('warnings')) {
    const warningResult = detectEarlyWarnings(data.clients as any, data.campaigns as any, data.ads as any, data.leads as any);
    if (clientId) {
      warningResult.warnings = warningResult.warnings.filter(w => w.clientId === clientId);
      warningResult.criticalCount = warningResult.warnings.filter(w => w.severity === 'critical').length;
      warningResult.highCount = warningResult.warnings.filter(w => w.severity === 'high').length;
      warningResult.mediumCount = warningResult.warnings.filter(w => w.severity === 'medium').length;
    }
    result.warnings = warningResult;
  }

  // Platform comparison
  if (sections.includes('platforms')) {
    if (clientId) {
      const client = data.clients.find((c: any) => c.id === clientId);
      result.platforms = client
        ? compareClientPlatforms(clientId, (client as any).name || '', data.campaigns as any, data.ads as any)
        : { platforms: [], bestPlatform: null, bestPlatformReason: '', hasSufficientData: false };
    } else {
      result.platforms = comparePlatforms(data.campaigns as any, data.ads as any);
    }
  }

  // AI insights
  if (sections.includes('insights')) {
    const health = computeAllClientHealth(data.clients as any, data.campaigns as any, data.ads as any, data.leads as any);
    const profit = computeAllProfitability(data.clients as any, data.campaigns as any, data.ads as any, data.leads as any);
    const content = analyzeContentIntelligence(data.ads as any, clientId);
    const warningsData = detectEarlyWarnings(data.clients as any, data.campaigns as any, data.ads as any, data.leads as any);
    result.insights = generateAIInsights(health, profit, content, warningsData.warnings);
  }

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = (searchParams.get('section') || 'all') as BISection;
    const clientId = searchParams.get('clientId') || undefined;

    const result = await buildBI(section, clientId);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const section = (body.section || 'all') as BISection;
    const clientId = body.clientId || undefined;

    const result = await buildBI(section, clientId);
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
