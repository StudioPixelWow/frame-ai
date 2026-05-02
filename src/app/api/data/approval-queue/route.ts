/**
 * GET /api/data/approval-queue - Get all approval queue items
 * POST /api/data/approval-queue - Create a new approval queue item
 */

import { NextRequest, NextResponse } from 'next/server';
import { approvalQueue } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(approvalQueue.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch approval queue' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const created = approvalQueue.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create approval queue item' },
      { status: 400 }
    );
  }
}
