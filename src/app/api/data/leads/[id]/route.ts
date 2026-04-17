/**
 * GET /api/data/leads/[id] - Get a single lead
 * PUT /api/data/leads/[id] - Update a lead
 * DELETE /api/data/leads/[id] - Delete a lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { leads } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { requireRole } from '@/lib/auth/api-guard';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Only admin and employee can view leads
  const getErr = requireRole(req, 'admin', 'employee');
  if (getErr) return getErr;

  ensureSeeded();
  try {
    const { id } = await context.params;
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
  context: { params: Promise<{ id: string }> }
) {
  // Only admin and employee can update leads
  const putErr = requireRole(req, 'admin', 'employee');
  if (putErr) return putErr;

  ensureSeeded();
  try {
    const { id } = await context.params;
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
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Only admin can delete leads
  const delErr = requireRole(req, 'admin');
  if (delErr) return delErr;

  ensureSeeded();
  try {
    const { id } = await context.params;
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
