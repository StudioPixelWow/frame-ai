/**
 * Lead scoring — ranks incoming leads 0-100 by likelihood to convert, so the team
 * works the hottest leads first. Deterministic and explainable (every point is
 * traceable to a reason). Pure function; no side effects.
 */

import type { Lead } from '@/lib/db/schema';

export type LeadTier = 'hot' | 'warm' | 'cold' | 'dead';
export interface LeadScore { score: number; tier: LeadTier; reasons: string[]; nextAction: string }

const INTEREST_VALUE: Record<string, number> = {
  marketing: 16, website: 14, branding: 12, podcast: 10, hosting: 6, other: 4,
};
// Status reflects how far down the funnel — strong conversion signal.
const STATUS_POINTS: Record<string, number> = {
  meeting_set: 34, negotiation: 32, interested: 26, proposal_sent: 24, contacted: 14,
  assigned: 8, new: 6, no_answer: 2, won: 40, lost: 0, not_relevant: 0, duplicate: 0,
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const daysSince = (iso?: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity);

export function scoreLead(lead: Partial<Lead>): LeadScore {
  const reasons: string[] = [];
  const status = String(lead.status || 'new');

  // Dead-end statuses short-circuit.
  if (status === 'lost' || status === 'not_relevant' || status === 'duplicate') {
    return { score: 0, tier: 'dead', reasons: [`סטטוס: ${status}`], nextAction: 'אין צורך בפעולה' };
  }
  if (status === 'won') {
    return { score: 100, tier: 'hot', reasons: ['ליד שנסגר בהצלחה'], nextAction: 'העבר לאונבורדינג לקוח' };
  }

  let score = 0;

  // 1) Funnel stage.
  const sp = STATUS_POINTS[status] ?? 6;
  score += sp;
  if (sp >= 24) reasons.push(`שלב מתקדם במשפך (${status})`);

  // 2) Interest type value.
  const iv = INTEREST_VALUE[String(lead.interestType || 'other')] ?? 4;
  score += iv;
  if (iv >= 12) reasons.push(`תחום עניין בעל ערך גבוה (${lead.interestType})`);

  // 3) Deal size.
  const amount = Number(lead.proposalAmount || lead.value || 0);
  if (amount > 0) {
    const amtPts = Math.min(18, amount / 1000); // ₪18k+ → full 18 pts
    score += amtPts;
    if (amount >= 5000) reasons.push(`עסקה משמעותית (₪${amount.toLocaleString('he-IL')})`);
  }

  // 4) Engagement signals.
  if (lead.proposalSent) { score += 8; reasons.push('נשלחה הצעת מחיר'); }
  if (lead.followupDone) { score += 4; reasons.push('בוצע מעקב'); }
  if (lead.assigneeId) score += 3;

  // 5) Recency / freshness.
  const age = daysSince(lead.followUpAt || (lead as any).createdAt);
  if (age <= 2) { score += 10; reasons.push('ליד טרי (עד יומיים)'); }
  else if (age <= 7) { score += 5; reasons.push('ליד מהשבוע האחרון'); }
  else if (age > 30) { score -= 8; reasons.push('ליד ישן (מעל חודש ללא פעילות)'); }

  // 6) Upcoming follow-up scheduled.
  if (lead.followUpAt && new Date(lead.followUpAt).getTime() > Date.now()) { score += 6; reasons.push('נקבע מעקב עתידי'); }

  score = clamp(score);
  const tier: LeadTier = score >= 70 ? 'hot' : score >= 45 ? 'warm' : score >= 20 ? 'cold' : 'dead';

  const nextAction =
    status === 'new' || status === 'assigned' ? 'צור קשר ראשוני בהקדם'
      : status === 'contacted' || status === 'no_answer' ? 'נסה שוב ליצור קשר / שלח הודעה'
        : status === 'interested' ? 'שלח הצעת מחיר'
          : status === 'proposal_sent' ? 'בצע מעקב על ההצעה'
            : status === 'negotiation' ? 'סגור את העסקה — הצע תנאים'
              : status === 'meeting_set' ? 'התכונן לפגישה וסגור' : 'המשך טיפול';

  return { score, tier, reasons: reasons.slice(0, 6), nextAction };
}

export function scoreAndRankLeads(leads: Partial<Lead>[]): (Partial<Lead> & { _score: LeadScore })[] {
  return leads.map((l) => ({ ...l, _score: scoreLead(l) })).sort((a, b) => b._score.score - a._score.score);
}

export const TIER_META: Record<LeadTier, { label: string; color: string }> = {
  hot: { label: 'חם 🔥', color: '#EF4444' },
  warm: { label: 'פושר', color: '#F59E0B' },
  cold: { label: 'קר', color: '#3B82F6' },
  dead: { label: 'לא רלוונטי', color: '#9A9AB0' },
};
