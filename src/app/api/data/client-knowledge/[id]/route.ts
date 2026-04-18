/**
 * GET /api/data/client-knowledge/[id] - Get a specific client knowledge record
 * PUT /api/data/client-knowledge/[id] - Update a client knowledge record
 * DELETE /api/data/client-knowledge/[id] - Delete a client knowledge record
 *
 * Now uses async SupabaseCrud instead of sync JsonStore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientKnowledge } from '@/lib/db';
import type { ClientKnowledge } from '@/lib/db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const record = await clientKnowledge.getByIdAsync(id);

    if (!record) {
      return NextResponse.json(
        { error: 'Client knowledge record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('Error fetching client knowledge:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch client knowledge', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const existing = await clientKnowledge.getByIdAsync(id);

    if (!existing) {
      return NextResponse.json(
        { error: 'Client knowledge record not found' },
        { status: 404 }
      );
    }

    const updated = await clientKnowledge.updateAsync(id, {
      ...body,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Client knowledge record updated successfully',
    });
  } catch (error) {
    console.error('Error updating client knowledge:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update client knowledge', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const existing = await clientKnowledge.getByIdAsync(id);

    if (!existing) {
      return NextResponse.json(
        { error: 'Client knowledge record not found' },
        { status: 404 }
      );
    }

    await clientKnowledge.deleteAsync(id);

    return NextResponse.json({
      success: true,
      message: 'Client knowledge record deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting client knowledge:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete client knowledge', details: errorMessage },
      { status: 500 }
    );
  }
}
