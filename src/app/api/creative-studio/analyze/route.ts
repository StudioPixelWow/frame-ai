import { NextRequest, NextResponse } from 'next/server';
import { analyzeBrandDNA } from '@/lib/creative/brand-analysis-service';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { clientId } = await req.json();
    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    const profile = await analyzeBrandDNA(clientId);
    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    console.error('[creative-studio/analyze] Error:', err);
    return NextResponse.json({ error: err?.message || 'Analysis failed' }, { status: 500 });
  }
}
