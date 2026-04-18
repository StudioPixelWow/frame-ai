/**
 * GET /api/data/whatsapp-messages - Get all WhatsApp messages
 * POST /api/data/whatsapp-messages - Create a new WhatsApp message
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsappMessages } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(await whatsappMessages.getAllAsync());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch WhatsApp messages' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = await whatsappMessages.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create WhatsApp message' },
      { status: 400 }
    );
  }
}
