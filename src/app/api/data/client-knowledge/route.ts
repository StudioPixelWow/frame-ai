/**
 * GET /api/data/client-knowledge - Get all client knowledge records
 * POST /api/data/client-knowledge - Create a new client knowledge record
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientKnowledge } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import type { ClientKnowledge } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    ensureSeeded();
    // useData<T> expects a direct JSON array from GET endpoints
    return NextResponse.json(clientKnowledge.getAll());
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
    ensureSeeded();
    const body = await req.json();

    // Validate required fields
    if (!body.clientId) {
      return NextResponse.json(
        { error: 'Missing clientId', field: 'clientId' },
        { status: 400 }
      );
    }

    // Check if knowledge record already exists for this client
    const existing = clientKnowledge.getAll().find(k => k.clientId === body.clientId);
    if (existing) {
      return NextResponse.json(
        { error: 'Knowledge record already exists for this client', field: 'clientId' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Build record with all required ClientKnowledge fields
    const knowledgeData: Omit<ClientKnowledge, 'id'> = {
      clientId: body.clientId,
      // AI-generated intelligence
      businessSummary: body.businessSummary || '',
      toneOfVoice: body.toneOfVoice || '',
      audienceProfile: body.audienceProfile || '',
      keySellingPoints: body.keySellingPoints || [],
      brandPersonality: body.brandPersonality || '',
      competitiveAdvantage: body.competitiveAdvantage || '',
      // Learning data
      winningContentPatterns: body.winningContentPatterns || [],
      failedPatterns: body.failedPatterns || [],
      topPerformingTopics: body.topPerformingTopics || [],
      // Sources
      websiteUrl: body.websiteUrl || '',
      facebookUrl: body.facebookUrl || '',
      instagramUrl: body.instagramUrl || '',
      sourcesAnalyzed: body.sourcesAnalyzed || [],
      // Weakness analysis
      weaknesses: body.weaknesses || [],
      // Ideal customer profile
      idealCustomer: body.idealCustomer || null,
      // Metadata
      lastAnalyzedAt: body.lastAnalyzedAt || now,
      createdAt: now,
      updatedAt: now,
      // Legacy fields
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

    const created = clientKnowledge.create(knowledgeData);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/data/client-knowledge error:', error);
    return NextResponse.json(
      { error: 'Failed to create client knowledge' },
      { status: 500 }
    );
  }
}
