import { NextRequest, NextResponse } from 'next/server';
import { designSets } from '@/lib/db/collections';

export async function GET() {
  try {
    const items = await designSets.getAllAsync();
    return NextResponse.json(items);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const created = await designSets.createAsync(body);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
