/**
 * GET /api/data/client-knowledge - Get all client knowledge records
 * POST /api/data/client-knowledge - Create a new client knowledge record
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientKnowledge } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import type { ClientKnowledge } from '@/lib/db';

export async function GET(req: NextRequest) {
  ensureSeeded();

  try {
    const all = clientKnowledge.getAll();
    return NextResponse.json({
      success: true,
      data: all,
      count: all.length,
    });
  } catch (error) {
    console.error('Error fetching client knowledge:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to fetch client knowledge',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();

  try {
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

    // Create new knowledge record
    const newKnowledge: ClientKnowledge = {
      id: 'ckn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      clientId: body.clientId,
      websiteSummary: body.websiteSummary || '',
      facebookInsights: body.facebookInsights || '',
      instagramInsights: body.instagramInsights || '',
      businessContext: body.businessContext || '',
      toneAndStyle: body.toneAndStyle || '',
      audienceProfile: body.audienceProfile || '',
      previousContentThemes: body.previousContentThemes || [],
      approvedCaptionStyles: body.approvedCaptionStyles || [],
      topPerformingFormats: body.topPerformingFormats || [],
      pastCampaigns: body.pastCampaigns || [],
      seasonalPatterns: body.seasonalPatterns || '',
      lastUpdatedSources: body.lastUpdatedSources || [],
      lastEnrichedAt: body.lastEnrichedAt || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    clientKnowledge.create(newKnowledge);

    return NextResponse.json({
      success: true,
      data: newKnowledge,
      message: 'Client knowledge record created successfully',
    });
  } catch (error) {
    console.error('Error creating client knowledge:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to create client knowledge',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
