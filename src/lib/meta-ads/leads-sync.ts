/**
 * Lead Ads → CRM sync (best-effort).
 *
 * Pulls leads from Meta lead forms and inserts them into the leads collection,
 * attributing each lead to a client via its campaign (campaign assignment or a
 * synced campaign's owner). Dedupes by the Meta lead id (stored in notes).
 *
 * Requires the token to have: pages access (pages_show_list/pages_read_engagement)
 * and leads_retrieval. Degrades gracefully if permissions are missing.
 */

import { leads as leadsCol, campaigns as campaignsCol } from '@/lib/db/collections';
import { getSupabase } from '@/lib/db/store';

const API = 'https://graph.facebook.com/v19.0';

export interface LeadAdsSyncResult {
  checked: boolean;
  imported: number;
  note?: string;
  errors: string[];
}

export async function syncLeadAds(token: string): Promise<LeadAdsSyncResult> {
  const errors: string[] = [];
  if (!token) return { checked: false, imported: 0, note: 'אין אסימון גישה', errors };

  // 1) Pages the token can access (lead forms are page-level)
  let pages: any[] = [];
  try {
    const r = await fetch(`${API}/me/accounts?fields=id,name,access_token&limit=200&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(20000) });
    const d = await r.json();
    if (!r.ok) return { checked: false, imported: 0, note: d?.error?.message || 'אין גישה לעמודים (נדרשת הרשאת pages + leads_retrieval)', errors };
    pages = d.data || [];
  } catch (e: any) {
    return { checked: false, imported: 0, note: e?.message, errors };
  }
  if (pages.length === 0) return { checked: true, imported: 0, note: 'לא נמצאו עמודים נגישים לטוקן', errors };

  // 2) campaign_id → client map (assignments first, then synced campaign owner)
  const campaignToClient = new Map<string, { clientId: string; clientName: string }>();
  try {
    const sb = getSupabase();
    const { data: assigns } = await sb.from('app_meta_campaign_assignments').select('meta_campaign_id, client_id, client_name');
    for (const a of (assigns || []) as any[]) if (a.meta_campaign_id && a.client_id) campaignToClient.set(a.meta_campaign_id, { clientId: a.client_id, clientName: a.client_name || '' });
  } catch { /* table may not exist */ }
  try {
    const allCampaigns = await campaignsCol.getAllAsync();
    for (const cm of allCampaigns as any[]) {
      if (cm.metaCampaignId && cm.clientId && !campaignToClient.has(cm.metaCampaignId)) {
        campaignToClient.set(cm.metaCampaignId, { clientId: cm.clientId, clientName: cm.clientName || '' });
      }
    }
  } catch { /* ignore */ }

  // 3) Dedupe set — Meta lead ids already imported (stored in notes)
  const seen = new Set<string>();
  try {
    const existing = await leadsCol.getAllAsync();
    for (const l of existing as any[]) {
      const m = /metaLeadId:(\d+)/.exec(l.notes || '');
      if (m) seen.add(m[1]);
    }
  } catch { /* ignore */ }

  // 4) Walk pages → forms → leads
  let imported = 0;
  for (const p of pages) {
    const pToken = p.access_token || token;
    let forms: any[] = [];
    try {
      const fr = await fetch(`${API}/${p.id}/leadgen_forms?fields=id,name&limit=100&access_token=${encodeURIComponent(pToken)}`, { signal: AbortSignal.timeout(15000) });
      const fd = await fr.json();
      if (fr.ok) forms = fd.data || [];
    } catch { /* skip page */ }

    for (const f of forms) {
      try {
        const lr = await fetch(`${API}/${f.id}/leads?fields=id,created_time,field_data,campaign_id,ad_id,adset_id&limit=200&access_token=${encodeURIComponent(pToken)}`, { signal: AbortSignal.timeout(15000) });
        const ld = await lr.json();
        if (!lr.ok) { errors.push(`form ${f.id}: ${ld?.error?.message || lr.status}`); continue; }

        for (const lead of (ld.data || [])) {
          if (seen.has(lead.id)) continue;
          const fields: Record<string, string> = {};
          for (const fdItem of (lead.field_data || [])) fields[(fdItem.name || '').toLowerCase()] = (fdItem.values || [])[0] || '';

          const attr = lead.campaign_id ? campaignToClient.get(lead.campaign_id) : undefined;
          const fullName = fields['full_name'] || fields['name'] || `${fields['first_name'] || ''} ${fields['last_name'] || ''}`.trim() || 'ליד מ-Meta';

          try {
            await leadsCol.createAsync({
              fullName, name: fullName,
              email: fields['email'] || '',
              phone: fields['phone_number'] || fields['phone'] || '',
              source: 'Meta Lead Ads',
              status: 'new' as any,
              interestType: 'other' as any,
              company: '',
              notes: `metaLeadId:${lead.id} | טופס: ${f.name || ''}${attr ? ` | לקוח: ${attr.clientName}` : ''}`,
              campaignId: lead.campaign_id || null,
              campaignName: '',
              adAccountId: '',
              adSetId: lead.adset_id || null,
              adId: lead.ad_id || null,
              convertedClientId: attr?.clientId || null,
              createdAt: lead.created_time || new Date().toISOString(),
            } as any);
            seen.add(lead.id);
            imported++;
          } catch (e: any) {
            errors.push(`lead ${lead.id}: ${e?.message}`);
          }
        }
      } catch (e: any) {
        errors.push(`form ${f.id}: ${e?.message}`);
      }
    }
  }

  return { checked: true, imported, errors };
}
