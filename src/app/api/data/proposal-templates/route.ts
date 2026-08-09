/**
 * GET /api/data/proposal-templates - Get all proposal templates
 * POST /api/data/proposal-templates - Create a new proposal template
 */

import { NextRequest, NextResponse } from 'next/server';
import { proposalTemplates } from '@/lib/db/collections';

export async function GET() {
  try {
    const items = await proposalTemplates.getAllAsync();
    return NextResponse.json(items);
  } catch (err) {
    console.error('[proposal-templates] GET error:', err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const created = await proposalTemplates.createAsync({
      ...body,
      createdAt: now,
      updatedAt: now,
    } as any);

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[proposal-templates] POST error:', err);
    return NextResponse.json({ error: 'Failed to create proposal template' }, { status: 400 });
  }
}
