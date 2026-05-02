import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { computeConversionMetrics } = await import('@/lib/ai/decisions');

    const [leadsRes, campaignsRes] = await Promise.all([
      fetch(new URL('/api/data/leads', process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000')),
      fetch(new URL('/api/data/campaigns', process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000')),
    ]);

    const leadsData = leadsRes.ok ? await leadsRes.json() : { data: [] };
    const campaignsData = campaignsRes.ok ? await campaignsRes.json() : { data: [] };

    const leads = leadsData.data ?? leadsData ?? [];
    const campaigns = campaignsData.data ?? campaignsData ?? [];

    const metrics = computeConversionMetrics(leads, campaigns);

    return NextResponse.json({ data: metrics });
  } catch (error) {
    console.error('[conversion-metrics] Error:', error);
    return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500 });
  }
}
