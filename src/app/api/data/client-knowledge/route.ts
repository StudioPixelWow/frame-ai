/**
 * GET /api/data/client-knowledge - Get all client knowledge records
 * POST /api/data/client-knowledge - Create a new client knowledge record
 *
 * Now uses async SupabaseCrud instead of sync JsonStore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientKnowledge } from '@/lib/db';
import type { ClientKnowledge } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    let all: ClientKnowledge[];
    try {
      all = await clientKnowledge.getAllAsync();
    } catch (dbError) {
      const msg = dbError instanceof Error ? dbError.message : '';
      if (msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json([]);
      }
      throw dbError;
    }
    return NextResponse.json(all);
  } catch (error) {
    console.error('[API] GET /api/data/client-knowledge error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client knowledge' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.clientId) {
      return NextResponse.json(
        { error: 'Missing clientId', field: 'clientId' },
        { status: 400 }
      );
    }

    // Check if record already exists
    let existing: ClientKnowledge | undefined;
    try {
      const all = await clientKnowledge.getAllAsync();
      existing = all.find(k => k.clientId === body.clientId);
    } catch {
      // Table may not exist — proceed with create
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Knowledge record already exists for this client', field: 'clientId' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const knowledgeData: Omit<ClientKnowledge, 'id'> = {
      clientId: body.clientId,
      businessSummary: body.businessSummary || '',
      toneOfVoice: body.toneOfVoice || '',
      audienceProfile: body.audienceProfile || '',
      keySellingPoints: body.keySellingPoints || [],
      brandPersonality: body.brandPersonality || '',
      competitiveAdvantage: body.competitiveAdvantage || '',
      winningContentPatterns: body.winningContentPatterns || [],
      failedPatterns: body.failedPatterns || [],
      topPerformingTopics: body.topPerformingTopics || [],
      websiteUrl: body.websiteUrl || '',
      facebookUrl: body.facebookUrl || '',
      instagramUrl: body.instagramUrl || '',
      sourcesAnalyzed: body.sourcesAnalyzed || [],
      weaknesses: body.weaknesses || [],
      idealCustomer: body.idealCustomer || null,
      lastAnalyzedAt: body.lastAnalyzedAt || now,
      createdAt: now,
      updatedAt: now,
      websiteSummary: body.websiteSummary || '',
      facebookInsights: body.facebookInsights || '',
      instagramInsights: body.instagramInsights || '',
      businessContext: body.businessContext || '',
      toneAndStyle: body.toneAndStyle || '',
      previousContentThemes: body.previousContentThemes || [],
      approvedCaptionStyles: body.approvedCaptionStyles || [],
      topPerformingFormats: body.topPerformingFormats || [],
      pastCampaigns: body.pastCampaigns || [],
      seasonalPatterns: body.seasonalPatterns || '',
      lastUpdatedSources: body.lastUpdatedSources || [],
      lastEnrichedAt: body.lastEnrichedAt || null,
    };

    const created = await clientKnowledge.createAsync(knowledgeData as ClientKnowledge);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/data/client-knowledge error:', error);
    return NextResponse.json(
      { error: 'Failed to create client knowledge' },
      { status: 500 }
    );
  }
}
