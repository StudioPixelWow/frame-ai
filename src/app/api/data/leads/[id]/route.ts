/**
 * GET /api/data/leads/[id] - Get a single lead
 * PUT /api/data/leads/[id] - Update a lead
 * DELETE /api/data/leads/[id] - Delete a lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { leads } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await params;
    const lead = leads.getById(id);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json(lead);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch lead' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = leads.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await params;
    const deleted = leads.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
