/**
 * GET /api/data/whatsapp-messages/[id] - Get a single WhatsApp message
 * PUT /api/data/whatsapp-messages/[id] - Update a WhatsApp message
 * DELETE /api/data/whatsapp-messages/[id] - Delete a WhatsApp message
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsappMessages } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const message = await whatsappMessages.getByIdAsync(id);
    if (!message) {
      return NextResponse.json(
        { error: 'WhatsApp message not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(message);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch WhatsApp message' },
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
    const updated = await whatsappMessages.updateAsync(id, body);
    if (!updated) {
      return NextResponse.json(
        { error: 'WhatsApp message not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update WhatsApp message' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const deleted = await whatsappMessages.deleteAsync(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'WhatsApp message not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete WhatsApp message' },
      { status: 500 }
    );
  }
}
