import { NextRequest, NextResponse } from 'next/server';
import { adReferences } from '@/lib/db/collections';

export async function GET(req: NextRequest) {
  try {
    const items = await adReferences.getAllAsync();
    const { searchParams } = new URL(req.url);
    const industry = searchParams.get('industry');
    const contentType = searchParams.get('contentType');
    const platform = searchParams.get('platform');
    const keyword = searchParams.get('keyword');

    let result = items as any[];

    // Only return active references with valid source
    result = result.filter((r: any) => {
      if (r.isActive === false) return false;
      // Block references without a valid image or source
      if (!r.imageUrl && !r.sourceUrl) {
        console.warn(`[ad-references] Skipping ref ${r.id} — no imageUrl or sourceUrl`);
        return false;
      }
      return true;
    });

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
    if (keyword) {
      const kw = keyword.toLowerCase();
      result = result.filter((r: any) =>
        r.description?.toLowerCase().includes(kw) ||
        r.advertiserName?.toLowerCase().includes(kw) ||
        r.tags?.some((t: string) => t.toLowerCase().includes(kw)) ||
        r.industry?.toLowerCase().includes(kw)
      );
    }

    console.log(`[ad-references] GET → ${result.length} results (industry=${industry || '*'}, contentType=${contentType || '*'}, platform=${platform || '*'}, keyword=${keyword || '*'})`);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[ad-references] GET error:', err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields for a real reference
    if (!body.imageUrl && !body.sourceUrl) {
      return NextResponse.json(
        { error: 'A real reference must have imageUrl or sourceUrl' },
        { status: 400 }
      );
    }
    if (!body.source) {
      return NextResponse.json(
        { error: 'source field is required (e.g. meta_ads_library, manual)' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const created = await adReferences.createAsync({
      ...body,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    } as any);

    console.log(`[ad-references] POST created id=${created.id} source=${body.source} advertiser=${body.advertiserName || 'unknown'}`);

    return NextResponse.json(created, { status: 201 });
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

    const updated = await adReferences.updateAsync(id, {
      ...rest,
      updatedAt: new Date().toISOString(),
    } as any);

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    console.log(`[ad-references] PUT id=${id} → updated`);
    return NextResponse.json(updated);
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

    await adReferences.deleteAsync(id);
    console.log(`[ad-references] DELETE id=${id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[ad-references] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
