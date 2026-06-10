/**
 * PIXEL Score — one unified 0-100 metric that fuses the three pillars we measure:
 *   • Organic  — Google rankings (tracked keywords: top-10 coverage + avg position)
 *   • GEO      — AI visibility score (latest monthly aggregation)
 *   • Authority— E-E-A-T / topical / schema authority (computeAuthorityScore)
 *
 * Pillars with no data are dropped and their weight is redistributed, so the
 * headline number is always honest about what's actually measured. This is the
 * "one story for the client" metric — not three separate screens.
 * Pure read; no side effects.
 */

import { seoPlans } from '@/lib/db';
import { getSupabase } from '@/lib/db/store';
import { computeAuthorityScore } from '@/lib/seo/geo-authority/authority-score';
import { listKeywords, latestAuthority } from '@/lib/seo/rank-backlinks/db';

export type PillarKey = 'organic' | 'geo' | 'authority';
export interface ScorePillar { key: PillarKey; label: string; score: number; weight: number; note: string; measured: boolean }
export interface PixelScore {
  overall: number;
  pillars: ScorePillar[];
  story: string;
  band: 'strong' | 'building' | 'weak';
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const BASE_WEIGHTS: Record<PillarKey, number> = { organic: 0.35, geo: 0.35, authority: 0.30 };
const LABELS: Record<PillarKey, string> = { organic: 'דירוג אורגני (Google)', geo: 'נראות ב-AI (GEO)', authority: 'סמכות (E-E-A-T)' };

export async function computePixelScore(planId: string): Promise<PixelScore> {
  const sb = getSupabase();
  const plan: any = await seoPlans.getByIdAsync(planId);

  // ── Organic pillar ──
  let organic: number | null = null; let organicNote = 'אין מעקב דירוגים פעיל.';
  try {
    const kws = await listKeywords(planId);
    const ranked = kws.filter((k: any) => typeof k.current_rank === 'number' && k.current_rank > 0);
    if (ranked.length) {
      const top10 = ranked.filter((k: any) => k.current_rank <= 10).length;
      const top3 = ranked.filter((k: any) => k.current_rank <= 3).length;
      const avgPos = ranked.reduce((a: number, k: any) => a + k.current_rank, 0) / ranked.length;
      const coverage = (top10 / ranked.length) * 60;          // up to 60 pts for top-10 coverage
      const posScore = Math.max(0, 40 - (avgPos - 1) * 2.2);  // closer to #1 = more pts
      organic = clamp(coverage + posScore);
      organicNote = `${top10}/${ranked.length} ביטויים ב-Top 10 · ${top3} ב-Top 3 · מיקום ממוצע ${avgPos.toFixed(1)}`;
    }
  } catch { /* organic stays null */ }

  // ── GEO pillar ──
  let geo: number | null = null; let geoNote = 'עדיין לא בוצעה בדיקת נראות AI.';
  try {
    const { data: agg } = await sb.from('geo_visibility_monthly_aggregations').select('visibility_score,total_mentions,share_of_ai_voice,month').eq('plan_id', planId).order('month', { ascending: false }).limit(1).maybeSingle();
    if (agg && typeof agg.visibility_score === 'number') {
      geo = clamp(agg.visibility_score);
      geoNote = `${agg.total_mentions || 0} אזכורים · נתח קול ${Math.round((agg.share_of_ai_voice || 0) * 100)}%`;
    }
  } catch { /* geo stays null */ }

  // ── Authority pillar ──
  let authority: number | null = null; let authorityNote = 'אין נתוני סמכות.';
  try {
    const a = computeAuthorityScore(plan);
    authority = clamp(a.overall);
    let drNote = '';
    try { const m = await latestAuthority(planId); if (m?.dr) drNote = ` · DR ${m.dr}`; } catch { /* */ }
    authorityNote = `ציון סמכות כולל ${authority}${drNote}`;
  } catch { /* authority stays null */ }

  const raw: Record<PillarKey, number | null> = { organic, geo, authority };
  const notes: Record<PillarKey, string> = { organic: organicNote, geo: geoNote, authority: authorityNote };

  // Redistribute weight across measured pillars.
  const measuredKeys = (Object.keys(raw) as PillarKey[]).filter((k) => raw[k] !== null);
  const weightSum = measuredKeys.reduce((s, k) => s + BASE_WEIGHTS[k], 0) || 1;
  const pillars: ScorePillar[] = (Object.keys(raw) as PillarKey[]).map((k) => ({
    key: k, label: LABELS[k], score: raw[k] ?? 0, note: notes[k],
    measured: raw[k] !== null,
    weight: raw[k] !== null ? +(BASE_WEIGHTS[k] / weightSum).toFixed(2) : 0,
  }));

  const overall = measuredKeys.length
    ? clamp(measuredKeys.reduce((s, k) => s + (raw[k] as number) * (BASE_WEIGHTS[k] / weightSum), 0))
    : 0;

  const band: PixelScore['band'] = overall >= 75 ? 'strong' : overall >= 50 ? 'building' : 'weak';
  const strongest = [...pillars].filter((p) => p.measured).sort((a, b) => b.score - a.score)[0];
  const weakest = [...pillars].filter((p) => p.measured).sort((a, b) => a.score - b.score)[0];
  const story = measuredKeys.length === 0
    ? 'אין עדיין מספיק נתונים לחישוב ציון מאוחד — הרץ סריקת דירוגים ובדיקת נראות AI.'
    : `הציון המאוחד ${overall}/100 (${band === 'strong' ? 'חזק' : band === 'building' ? 'בבנייה' : 'דורש חיזוק'}). החוזקה: ${strongest?.label} (${strongest?.score}). המנוף הגדול ביותר לשיפור: ${weakest?.label} (${weakest?.score}).`;

  return { overall, pillars, story, band };
}
