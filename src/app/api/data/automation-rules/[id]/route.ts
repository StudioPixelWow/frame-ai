/**
 * GET /api/data/automation-rules/[id] - Get a single automation rule
 * PUT /api/data/automation-rules/[id] - Update an automation rule
 * DELETE /api/data/automation-rules/[id] - Delete an automation rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { automationRules } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const rule = automationRules.getById(params.id);
    if (!rule) {
      return NextResponse.json(
        { error: 'Automation rule not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(rule);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch automation rule' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const body = await req.json();
    const updated = automationRules.update(params.id, body);
    if (!updated) {
      return NextResponse.json(
        { error: 'Automation rule not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update automation rule' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const deleted = automationRules.delete(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Automation rule not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete automation rule' },
      { status: 500 }
    );
  }
}
