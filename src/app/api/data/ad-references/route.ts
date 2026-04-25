import { NextRequest, NextResponse } from 'next/server';
import { adReferences } from '@/lib/db/collections';

export async function GET(req: NextRequest) {
  try {
    const items = await adReferences.getAll();
    const { searchParams } = new URL(req.url);
    const industry = searchParams.get('industry');
    const contentType = searchParams.get('contentType');
    const platform = searchParams.get('platform');

    let result = (items as any[]).map((r: any) => ({ id: r.id, ...(r.data || r) }));

    if (industry) {
      result = result.filter((r: any) =>
        r.industry?.toLowerCase().includes(industry.toLowerCase())
      );
    }
    if (contentType) {
      result = result.filter((r: any) => r.contentType === contentType);
    }
    if (platform) {
      result = result.filter(
        (r: any) => r.platform === platform || r.platform === 'all'
      );
    }

    // Only return active references
    result = result.filter((r: any) => r.isActive !== false);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[ad-references] GET error:', err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const created = await adReferences.create({
      ...body,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    } as any);
    return NextResponse.json({ id: created.id, ...(created as any).data });
  } catch (err) {
    console.error('[ad-references] POST error:', err);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const updated = await adReferences.update(id, {
      ...rest,
      updatedAt: new Date().toISOString(),
    } as any);
    return NextResponse.json({ id, ...(updated as any).data });
  } catch (err) {
    console.error('[ad-references] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await adReferences.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[ad-references] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
