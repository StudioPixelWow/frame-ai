/**
 * Optimizer alerts — notify the agency when the daily optimizer takes action,
 * CPL worsens, or a campaign overspends its pace. Sends via WhatsApp.
 *
 * Recipient: app_settings key 'alert_whatsapp_to' (or env ALERT_WHATSAPP_TO).
 * If not configured, alerts are silently skipped (no-op).
 */

import { getSupabase } from '@/lib/db/store';
import { sendMessage } from '@/lib/whatsapp/whatsapp-service';

async function getAlertPhone(): Promise<string | null> {
  try {
    const sb = getSupabase();
    const { data } = await sb.from('app_settings').select('value').eq('key', 'alert_whatsapp_to').maybeSingle();
    const v: any = data?.value;
    const fromDb = v ? (typeof v === 'string' ? v : v.phone || v.value) : null;
    return fromDb || process.env.ALERT_WHATSAPP_TO || null;
  } catch {
    return process.env.ALERT_WHATSAPP_TO || null;
  }
}

export interface OptimizerAlert {
  clientName: string;
  pausedCount: number;
  newAdsCreated: number;
  cplTrend: 'improving' | 'stable' | 'worsening';
  cplDeltaPct: number;
  overspend: { campaignName: string; spend: number; monthlyBudget: number }[];
}

export async function sendOptimizerAlert(a: OptimizerAlert): Promise<boolean> {
  const reasons: string[] = [];
  if (a.pausedCount > 0) reasons.push(`⏸️ הושהו ${a.pausedCount} פריטים שלא הניבו`);
  if (a.newAdsCreated > 0) reasons.push(`✨ נוצרו ${a.newAdsCreated} מודעות חדשות`);
  if (a.cplTrend === 'worsening') reasons.push(`📈 עלות לליד עלתה ב-${Math.round(a.cplDeltaPct)}%`);
  if (a.overspend.length > 0) reasons.push(`💸 ${a.overspend.length} קמפיינים חורגים מקצב התקציב`);

  // Only alert when there's something worth knowing.
  if (reasons.length === 0) return false;

  const phone = await getAlertPhone();
  if (!phone) return false;

  const lines = [`🔔 Meta Ads — ${a.clientName}`, ...reasons];
  for (const o of a.overspend.slice(0, 3)) {
    lines.push(`  ↳ ${o.campaignName}: ₪${Math.round(o.spend)} (תקציב חודשי ~₪${Math.round(o.monthlyBudget)})`);
  }
  try {
    const r = await sendMessage(phone, lines.join('\n'));
    return r.success;
  } catch {
    return false;
  }
}
