/**
 * GET /api/data/gmail-settings/[id] - Get a single gmail settings record
 * PUT /api/data/gmail-settings/[id] - Update gmail settings
 * DELETE /api/data/gmail-settings/[id] - Delete gmail settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { gmailSettings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  const { id } = await params;
  try {
    const settings = gmailSettings.getById(id);
    if (!settings) {
      return NextResponse.json(
        { error: 'Gmail settings not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch gmail settings' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  const { id } = await params;
  try {
    const body = await req.json();
    const updated = gmailSettings.update(id, body);
    if (!updated) {
      return NextResponse.json(
        { error: 'Gmail settings not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update gmail settings' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  const { id } = await params;
  try {
    const deleted = gmailSettings.delete(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Gmail settings not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete gmail settings' },
      { status: 500 }
    );
  }
}
