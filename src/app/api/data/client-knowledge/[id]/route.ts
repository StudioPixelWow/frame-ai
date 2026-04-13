/**
 * GET /api/data/client-knowledge/[id] - Get a specific client knowledge record
 * PUT /api/data/client-knowledge/[id] - Update a client knowledge record
 * DELETE /api/data/client-knowledge/[id] - Delete a client knowledge record
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientKnowledge } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import type { ClientKnowledge } from '@/lib/db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();

  try {
    const { id } = await context.params;
    const record = clientKnowledge.getById(id);

    if (!record) {
      return NextResponse.json(
        { error: 'Client knowledge record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: record,
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

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();

  try {
    const { id } = await context.params;
    const body = await req.json();
    const existing = clientKnowledge.getById(id);

    if (!existing) {
      return NextResponse.json(
        { error: 'Client knowledge record not found' },
        { status: 404 }
      );
    }

    // Update the record with new values (merge with existing)
    const updated: ClientKnowledge = {
      ...existing,
      websiteSummary: body.websiteSummary !== undefined ? body.websiteSummary : existing.websiteSummary,
      facebookInsights: body.facebookInsights !== undefined ? body.facebookInsights : existing.facebookInsights,
      instagramInsights: body.instagramInsights !== undefined ? body.instagramInsights : existing.instagramInsights,
      businessContext: body.businessContext !== undefined ? body.businessContext : existing.businessContext,
      toneAndStyle: body.toneAndStyle !== undefined ? body.toneAndStyle : existing.toneAndStyle,
      audienceProfile: body.audienceProfile !== undefined ? body.audienceProfile : existing.audienceProfile,
      previousContentThemes: body.previousContentThemes !== undefined ? body.previousContentThemes : existing.previousContentThemes,
      approvedCaptionStyles: body.approvedCaptionStyles !== undefined ? body.approvedCaptionStyles : existing.approvedCaptionStyles,
      topPerformingFormats: body.topPerformingFormats !== undefined ? body.topPerformingFormats : existing.topPerformingFormats,
      pastCampaigns: body.pastCampaigns !== undefined ? body.pastCampaigns : existing.pastCampaigns,
      seasonalPatterns: body.seasonalPatterns !== undefined ? body.seasonalPatterns : existing.seasonalPatterns,
      lastUpdatedSources: body.lastUpdatedSources !== undefined ? body.lastUpdatedSources : existing.lastUpdatedSources,
      lastEnrichedAt: body.lastEnrichedAt !== undefined ? body.lastEnrichedAt : existing.lastEnrichedAt,
      updatedAt: new Date().toISOString(),
    };

    clientKnowledge.update(id, updated);

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Client knowledge record updated successfully',
    });
  } catch (error) {
    console.error('Error updating client knowledge:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to update client knowledge',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();

  try {
    const { id } = await context.params;
    const existing = clientKnowledge.getById(id);

    if (!existing) {
      return NextResponse.json(
        { error: 'Client knowledge record not found' },
        { status: 404 }
      );
    }

    clientKnowledge.delete(id);

    return NextResponse.json({
      success: true,
      message: 'Client knowledge record deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting client knowledge:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to delete client knowledge',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
