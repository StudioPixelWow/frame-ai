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
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const message = whatsappMessages.getById(params.id);
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
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const body = await req.json();
    const updated = whatsappMessages.update(params.id, body);
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
  { params }: { params: { id: string } }
) {
  ensureSeeded();
  try {
    const deleted = whatsappMessages.delete(params.id);
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
