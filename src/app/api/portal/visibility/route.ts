/**
 * GET /api/portal/visibility?clientId=…
 *
 * Client-facing AI Visibility scorecard for the portal. Returns the latest
 * monthly aggregation, a short trend, and a client-friendly subset of alerts
 * (wins + things we're working on). Read-only; no internal/staff detail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

const FRIENDLY: Record<string, { label: string; tone: 'good' | 'watch' }> = {
  brand_entered: { label: 'נכנסת לתשובת AI חדשה', tone: 'good' },
  brand_overtook_competitor: { label: 'עקפת מתחרה בתשובת AI', tone: 'good' },
  citation_gained: { label: 'האתר שלך צוטט כמקור', tone: 'good' },
  brand_left: { label: 'ירידה בהופעה — אנחנו מטפלים', tone: 'watch' },
  citation_lost: { label: 'ציטוט שירד — בעבודה', tone: 'watch' },
  competitor_overtook_brand: { label: 'מתחרה התקדם — בעבודה', tone: 'watch' },
};

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ available: false });
  try {
    const sb = getSupabase();
    const [aggRes, alertRes] = await Promise.all([
      sb.from('geo_visibility_monthly_aggregations').select('*').eq('client_id', clientId).order('month', { ascending: true }).limit(12),
      sb.from('geo_visibility_alerts').select('*').eq('client_id', clientId).neq('status', 'dismissed').order('detected_at', { ascending: false }).limit(40),
    ]);
    const agg = aggRes.data || [];
    if (!agg.length) return NextResponse.json({ available: false });
    const latest = agg[agg.length - 1];
    const prev = agg.length > 1 ? agg[agg.length - 2] : null;
    const alerts = (alertRes.data || [])
      .filter((a: any) => FRIENDLY[a.alert_type])
      .slice(0, 8)
      .map((a: any) => ({ type: a.alert_type, label: FRIENDLY[a.alert_type].label, tone: FRIENDLY[a.alert_type].tone, detail: a.description, at: a.detected_at }));

    return NextResponse.json({
      available: true,
      score: latest.visibility_score || 0,
      scoreDelta: prev ? (latest.visibility_score || 0) - (prev.visibility_score || 0) : 0,
      mentions: latest.total_mentions || 0,
      citations: latest.total_citations || 0,
      shareOfVoice: Math.round((latest.share_of_ai_voice || 0) * 100),
      estimatedReach: latest.estimated_ai_reach || 0,
      month: latest.month,
      trend: agg.slice(-6).map((m: any) => ({ month: m.month, score: m.visibility_score || 0, mentions: m.total_mentions || 0 })),
      alerts,
    });
  } catch {
    return NextResponse.json({ available: false });
  }
}
