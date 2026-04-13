import { NextRequest, NextResponse } from 'next/server';
import { aiSettings } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(aiSettings.getAll());
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    return NextResponse.json(aiSettings.create(body), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create' }, { status: 400 });
  }
}
