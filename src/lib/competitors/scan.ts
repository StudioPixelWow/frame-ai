/** Shared competitor-scan logic — used by the per-client route and the cron. */

import { getSupabase } from '@/lib/db/store';
import { ensureCompetitorTables, cmpId } from '@/lib/competitors/db';
import { fetchCompetitorAds } from '@/lib/competitors/ad-source';

export async function scanCompetitorsForClient(clientId: string) {
  await ensureCompetitorTables();
  const sb = getSupabase();
  const { data: competitors } = await sb.from('client_competitors').select('*').eq('client_id', clientId);
  const comps = (competitors || []) as any[];
  const now = new Date().toISOString();
  const summary: any[] = [];

  for (const c of comps) {
    const result = await fetchCompetitorAds({ name: c.name, pageId: c.page_id, country: c.country });
    let added = 0, updated = 0;
    const seen = new Set<string>();
    for (const ad of result.ads) {
      seen.add(ad.adId);
      const { data: existing } = await sb.from('competitor_ads').select('id').eq('competitor_id', c.id).eq('ad_id', ad.adId).maybeSingle();
      if (existing) {
        await sb.from('competitor_ads').update({ active: true, last_seen: now, snapshot_url: ad.snapshotUrl, body: ad.body, title: ad.title }).eq('id', (existing as any).id);
        updated++;
      } else {
        await sb.from('competitor_ads').insert({
          id: cmpId('cad'), client_id: clientId, competitor_id: c.id, ad_id: ad.adId,
          page_name: ad.pageName, body: ad.body, title: ad.title, snapshot_url: ad.snapshotUrl,
          platforms: ad.platforms, start_time: ad.startTime, active: true, first_seen: now, last_seen: now, raw: ad.raw,
        });
        added++;
      }
    }
    if (result.status === 'ok' && seen.size > 0) {
      const { data: stored } = await sb.from('competitor_ads').select('id, ad_id, active').eq('competitor_id', c.id);
      for (const s of (stored || []) as any[]) {
        if (s.active && !seen.has(s.ad_id)) await sb.from('competitor_ads').update({ active: false, last_seen: now }).eq('id', s.id);
      }
    }
    summary.push({ competitor: c.name, status: result.status, message: result.message, added, updated, total: result.ads.length });
  }
  return summary;
}

/** Scan every client that has competitors (used by the daily cron). */
export async function scanAllCompetitors(timeBudgetMs = 240_000) {
  await ensureCompetitorTables();
  const sb = getSupabase();
  const start = Date.now();
  const { data } = await sb.from('client_competitors').select('client_id');
  const clientIds = [...new Set(((data || []) as any[]).map((r) => r.client_id))];
  let scanned = 0, totalAdded = 0;
  for (const clientId of clientIds) {
    if (Date.now() - start > timeBudgetMs) break;
    const summary = await scanCompetitorsForClient(clientId);
    scanned++;
    totalAdded += summary.reduce((s, x) => s + (x.added || 0), 0);
  }
  return { clientsScanned: scanned, totalClients: clientIds.length, newAds: totalAdded };
}
