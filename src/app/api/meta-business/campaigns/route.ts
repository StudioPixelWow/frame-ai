/**
 * GET /api/meta-business/campaigns?clientId=...
 *   Returns the client's synced campaigns with aggregated performance metrics
 *   (from the local synced tables — populated by sync-service).
 *
 * Response: { campaigns: CampaignSummary[], totals: {...} }
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaigns as campaignsCol, adSets as adSetsCol, ads as adsCol } from '@/lib/db/collections';
import { getSupabase } from '@/lib/db/store';
import { getSystemMetaToken, resolveMetaToken } from '@/lib/meta-ads/token';

export const dynamic = 'force-dynamic';

const META_API = 'https://graph.facebook.com/v19.0';
const ALLOWED_PRESETS = ['today', 'yesterday', 'last_7d', 'last_30d', 'this_month', 'last_month', 'maximum'];

type LiveMetric = { spend: number; impressions: number; clicks: number; leads: number; messages: number };

function num(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }

function leadsFromActions(actions: any[] = []): number {
  const a = actions.find((x) => x.action_type === 'lead' || x.action_type === 'onsite_conversion.lead_grouped');
  return a ? num(a.value) : 0;
}
function messagesFromActions(actions: any[] = []): number {
  let t = 0;
  for (const x of actions) {
    if (typeof x.action_type === 'string' && x.action_type.includes('messaging_conversation_started')) t += num(x.value);
  }
  return t;
}

/**
 * Fetch CAMPAIGN-level insights for a date range directly from Meta (fast — one
 * call per account, no DB writes). Returns a map metaCampaignId → live metrics so
 * the dashboard can show numbers that match the SELECTED range instead of the
 * stale snapshot stored by the last full sync.
 */
async function fetchLiveCampaignMetrics(
  token: string,
  accountIds: string[],
  dateParam: string,
): Promise<Map<string, LiveMetric>> {
  const out = new Map<string, LiveMetric>();
  await Promise.all(
    accountIds.map(async (actId) => {
      try {
        const url = `${META_API}/${actId}/insights?level=campaign&${dateParam}` +
          `&fields=campaign_id,spend,impressions,clicks,actions&limit=500&access_token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data?.data)) return;
        for (const row of data.data) {
          const id = row.campaign_id;
          if (!id) continue;
          out.set(id, {
            spend: num(row.spend),
            impressions: num(row.impressions),
            clicks: num(row.clicks),
            leads: leadsFromActions(row.actions),
            messages: messagesFromActions(row.actions),
          });
        }
      } catch { /* one bad account shouldn't break the rest */ }
    }),
  );
  return out;
}

// Resolve the client's Meta connection status so the UI can distinguish
// "not connected" / "token expired" from simply "no campaigns yet".
// A usable token = the client's own token OR the central system token.
async function getConnectionStatus(clientId: string): Promise<string> {
  try {
    const sb = getSupabase();
    const { data } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
    const c = data as any;
    if (!c) return 'unknown';
    const status = c.meta_connection_status || c.metaConnectionStatus;
    const hasAccount = c.meta_ad_account_id || c.metaAdAccountId;
    const hasToken = (c.meta_access_token || c.metaAccessToken) || (await getSystemMetaToken());
    if (status === 'token_expired') return 'token_expired';
    if (!hasAccount) return 'not_connected';
    if (!hasToken) return 'token_expired';
    if (status === 'connected') return 'connected';
    return status || 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId');
    if (!clientId) {
      return NextResponse.json({ error: 'חסר מזהה לקוח (clientId)' }, { status: 400 });
    }
    const presetParam = req.nextUrl.searchParams.get('datePreset') || '';
    const datePreset = ALLOWED_PRESETS.includes(presetParam) ? presetParam : '';
    // Custom range → Meta time_range overlay (overrides date_preset when valid).
    const fromParam = req.nextUrl.searchParams.get('from');
    const toParam = req.nextUrl.searchParams.get('to');
    const isYmd = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const useTimeRange = isYmd(fromParam) && isYmd(toParam);
    const dateParam = useTimeRange
      ? `time_range[since]=${fromParam}&time_range[until]=${toParam}`
      : (datePreset ? `date_preset=${datePreset}` : '');

    const [allCampaigns, allAdSets, allAds] = await Promise.all([
      campaignsCol.getAllAsync(),
      adSetsCol.getAllAsync(),
      adsCol.getAllAsync(),
    ]);

    // 1) Campaigns from a dedicated account assigned to this client.
    //    Exclude archived/completed (campaigns deleted/archived in Meta) so stale
    //    history doesn't inflate the count or show as active.
    const byAccount = (allCampaigns as any[]).filter(
      (c) => c.clientId === clientId && c.metaCampaignId && c.status !== 'completed' && c.status !== 'archived',
    );

    // 2) Campaigns explicitly assigned to this client (shared-account / campaign-level).
    let assignedRecords: any[] = [];
    try {
      const sb = getSupabase();
      const { data: assigns } = await sb
        .from('app_meta_campaign_assignments')
        .select('meta_campaign_id, campaign_name')
        .eq('client_id', clientId);
      const assignedIds = new Set((assigns || []).map((a: any) => a.meta_campaign_id));
      const nameById: Record<string, string> = {};
      for (const a of (assigns || []) as any[]) nameById[a.meta_campaign_id] = a.campaign_name;

      if (assignedIds.size > 0) {
        const alreadyById = new Set(byAccount.map((c) => c.metaCampaignId));
        for (const id of assignedIds) {
          if (alreadyById.has(id)) continue;
          // Find synced metrics for this campaign (synced by whoever owns the account)
          const synced = (allCampaigns as any[]).find((c) => c.metaCampaignId === id);
          if (synced) {
            assignedRecords.push(synced);
          } else {
            // No synced data yet — stub so it still shows (run a sync for metrics)
            assignedRecords.push({ id: `assign_${id}`, metaCampaignId: id, campaignName: nameById[id] || '', status: 'unknown', budget: 0, notSynced: true });
          }
        }
      }
    } catch { /* assignments table may not exist yet */ }

    const clientCampaigns = [...byAccount, ...assignedRecords];

    // Surface connection status when there's nothing to show.
    const connectionStatus = clientCampaigns.length === 0
      ? await getConnectionStatus(clientId)
      : 'connected';

    const summaries = clientCampaigns.map((c: any) => {
      const cAds = (allAds as any[]).filter((a) => a.campaignId === c.id);
      const cAdSets = (allAdSets as any[]).filter((as) => as.campaignId === c.id);
      const spend = cAds.reduce((s, a) => s + (a.spend || 0), 0);
      const leads = cAds.reduce((s, a) => s + (a.leads || 0), 0);
      const messages = cAds.reduce((s, a) => s + (a.conversions || 0), 0);
      const impressions = cAds.reduce((s, a) => s + (a.impressions || 0), 0);
      const clicks = cAds.reduce((s, a) => s + (a.clicks || 0), 0);
      const cpl = leads > 0 ? spend / leads : 0;
      const costPerMessage = messages > 0 ? spend / messages : 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      // Messages vs leads is decided by the campaign OBJECTIVE, never by whether a
      // stray messaging action was recorded — otherwise a LEAD campaign that logged
      // one message would wrongly display as a messages campaign.
      const obj = String(c.objective || '').toUpperCase();
      const isLeadObjective = obj.includes('LEAD');
      const isMessages = !isLeadObjective && (obj.includes('MESSAGE') || obj.includes('ENGAGEMENT'));
      // Budget can live at campaign level OR ad-set level (ABO). Fall back to
      // summing ad-set budgets so the column isn't empty for ABO campaigns.
      const adSetBudget = cAdSets.reduce((s, as: any) => s + (as.dailyBudget || as.budget || 0), 0);
      const budget = c.budget || adSetBudget || 0;

      return {
        id: c.id,
        metaCampaignId: c.metaCampaignId,
        name: c.campaignName || c.name || '',
        status: c.status || 'unknown',
        objective: c.objective || '',
        budget,
        spend,
        leads,
        cpl,
        ctr,
        impressions,
        clicks,
        messages,
        costPerMessage,
        isMessages,
        adSetsCount: cAdSets.length,
        adsCount: cAds.length,
        lastSyncedAt: c.lastSyncedAt || null,
      };
    });

    // ── LIVE OVERLAY ──────────────────────────────────────────────────────
    // If a date range was requested, replace the stored snapshot numbers with
    // campaign insights for THAT range pulled live from Meta. This makes the
    // dashboard match the selected range instead of the last full-sync snapshot.
    let liveApplied = false;
    if ((datePreset || useTimeRange) && summaries.length > 0) {
      try {
        const sb = getSupabase();
        const { data: cl } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
        const cRow = cl as any;
        const token = await resolveMetaToken(cRow?.meta_access_token || cRow?.metaAccessToken);
        if (token) {
          const { getClientAdAccounts } = await import('@/lib/meta-ads/client-accounts');
          const accts = new Set<string>(await getClientAdAccounts(clientId));
          for (const c of clientCampaigns) if ((c as any).adAccountId) accts.add((c as any).adAccountId);
          try {
            const { data: asg } = await sb.from('app_meta_campaign_assignments').select('ad_account_id').eq('client_id', clientId);
            for (const a of (asg || []) as any[]) if (a.ad_account_id) accts.add(a.ad_account_id);
          } catch { /* optional */ }

          if (accts.size > 0) {
            const live = await fetchLiveCampaignMetrics(token, [...accts], dateParam);
            if (live.size > 0) {
              liveApplied = true;
              for (const s of summaries) {
                const m = s.metaCampaignId ? live.get(s.metaCampaignId) : undefined;
                const v = m || { spend: 0, impressions: 0, clicks: 0, leads: 0, messages: 0 };
                s.spend = v.spend; s.impressions = v.impressions; s.clicks = v.clicks;
                s.leads = v.leads; s.messages = v.messages;
                s.cpl = v.leads > 0 ? v.spend / v.leads : 0;
                s.costPerMessage = v.messages > 0 ? v.spend / v.messages : 0;
                s.ctr = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0;
              }
            }
          }
        }
      } catch { /* fall back to stored snapshot */ }
    }

    // Sort by spend desc (most important first)
    summaries.sort((a, b) => b.spend - a.spend);

    const totals = summaries.reduce(
      (t, c) => ({
        spend: t.spend + c.spend,
        leads: t.leads + c.leads,
        impressions: t.impressions + c.impressions,
        clicks: t.clicks + c.clicks,
      }),
      { spend: 0, leads: 0, impressions: 0, clicks: 0 },
    );

    return NextResponse.json({
      campaigns: summaries,
      connectionStatus,
      datePreset: datePreset || null,
      liveApplied,
      totals: {
        ...totals,
        cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        count: summaries.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    console.error('[meta-business/campaigns] GET error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
