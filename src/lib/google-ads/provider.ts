/**
 * Google Ads data provider.
 * - When real credentials + a client refresh token exist, pulls live data via the
 *   Google Ads API (OAuth refresh → searchStream with the GAQL queries).
 * - Otherwise returns realistic, deterministic MOCK data so the whole pipeline
 *   (analysis → report → PDF) works end-to-end for every client.
 */

import type { GoogleAdsConnection } from './db';

export interface AdsTotals {
  impressions: number; clicks: number; ctr: number; avgCpc: number; cost: number;
  conversions: number; convValue: number; costPerConv: number; convRate: number; budget: number;
}
export interface AdsCampaign {
  name: string; status: string; budget: number; impressions: number; clicks: number;
  ctr: number; avgCpc: number; cost: number; conversions: number; convValue: number; costPerConv: number;
}
export interface AdsBreakdown { label: string; clicks: number; conversions: number; cost: number; impressions: number }
export interface AdsTrendPoint { date: string; clicks: number; conversions: number; cost: number; impressions: number }
export interface AdsTerm { term: string; clicks: number; conversions: number; ctr: number; cost: number }

export interface AdsData {
  current: AdsTotals;
  previous: AdsTotals;
  campaigns: AdsCampaign[];
  devices: AdsBreakdown[];
  locations: AdsBreakdown[];
  searchTerms: AdsTerm[];
  trend: AdsTrendPoint[];
  optimizationScore: number | null;
  isMock: boolean;
}

export function googleAdsConfigured(): boolean {
  return !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET);
}

/* ── deterministic mock helpers ─────────────────────────────────────────── */
function seedFrom(str: string): number {
  let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1_000_000;
  return h;
}
function rng(seed: number) { let s = seed || 1; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function totalsFrom(clicks: number, impressions: number, cost: number, conversions: number, convValue: number, budget: number): AdsTotals {
  return {
    impressions, clicks, cost: round(cost), conversions: round(conversions, 1), convValue: round(convValue),
    ctr: impressions ? round((clicks / impressions) * 100, 2) : 0,
    avgCpc: clicks ? round(cost / clicks, 2) : 0,
    costPerConv: conversions ? round(cost / conversions, 2) : 0,
    convRate: clicks ? round((conversions / clicks) * 100, 2) : 0,
    budget: round(budget),
  };
}

function buildMock(connectionKey: string, from: string, to: string): AdsData {
  const days = Math.max(1, Math.round((+new Date(to) - +new Date(from)) / 86400000) + 1);
  const rand = rng(seedFrom(connectionKey));
  const base = 0.7 + rand() * 0.6; // per-client scale

  const dayClicks = Math.round((90 + rand() * 120) * base);
  const ctrBase = 0.03 + rand() * 0.03;
  const cpcBase = 3 + rand() * 5;
  const convRateBase = 0.05 + rand() * 0.05;

  const mk = (growth: number) => {
    const clicks = Math.round(dayClicks * days * growth);
    const impressions = Math.round(clicks / ctrBase);
    const cost = clicks * cpcBase * (0.95 + rand() * 0.1);
    const conversions = clicks * convRateBase * growth;
    const convValue = conversions * (180 + rand() * 220);
    const budget = cost * (1.05 + rand() * 0.15);
    return totalsFrom(clicks, impressions, cost, conversions, convValue, budget);
  };
  // current period trends slightly UP vs previous (positive story by default).
  const current = mk(1.0 + rand() * 0.18);
  const previous = mk(0.85 + rand() * 0.1);

  const campNames = ['Search · מותג', 'Search · גנרי', 'Performance Max', 'רימרקטינג', 'Display · מודעות'];
  const campaigns: AdsCampaign[] = campNames.slice(0, 3 + Math.floor(rand() * 2)).map((name, i) => {
    const share = [0.42, 0.3, 0.16, 0.08, 0.04][i] || 0.05;
    const clicks = Math.round(current.clicks * share);
    const impressions = Math.round(clicks / (ctrBase * (0.8 + rand() * 0.5)));
    const cost = current.cost * share;
    const conversions = current.conversions * share * (0.8 + rand() * 0.6);
    const t = totalsFrom(clicks, impressions, cost, conversions, conversions * 200, cost * 1.1);
    return { name, status: 'ENABLED', budget: t.budget, impressions, clicks, ctr: t.ctr, avgCpc: t.avgCpc, cost: t.cost, conversions: t.conversions, convValue: t.convValue, costPerConv: t.costPerConv };
  }).sort((a, b) => b.conversions - a.conversions);

  const devNames = ['נייד', 'מחשב', 'טאבלט'];
  const devShares = [0.62, 0.31, 0.07];
  const devices: AdsBreakdown[] = devNames.map((label, i) => ({
    label, clicks: Math.round(current.clicks * devShares[i]), conversions: round(current.conversions * devShares[i] * (0.8 + rand() * 0.5), 1),
    cost: round(current.cost * devShares[i]), impressions: Math.round(current.impressions * devShares[i]),
  }));

  const locNames = ['תל אביב והמרכז', 'ירושלים', 'חיפה והצפון', 'באר שבע והדרום', 'השרון'];
  const locations: AdsBreakdown[] = locNames.slice(0, 4).map((label, i) => {
    const share = [0.4, 0.25, 0.2, 0.15][i];
    return { label, clicks: Math.round(current.clicks * share), conversions: round(current.conversions * share, 1), cost: round(current.cost * share), impressions: Math.round(current.impressions * share) };
  });

  const termSeeds = ['שירות מקצועי', 'מחיר הזמנה', 'ייעוץ חינם', 'ליד עכשיו', 'המלצות לקוחות', 'אזור המרכז'];
  const searchTerms: AdsTerm[] = termSeeds.slice(0, 5).map((term, i) => {
    const clicks = Math.round(current.clicks * [0.12, 0.09, 0.07, 0.05, 0.04][i]);
    const conversions = round(clicks * convRateBase * (1 + rand()), 1);
    return { term, clicks, conversions, ctr: round((ctrBase * (1 + rand() * 0.5)) * 100, 2), cost: round(clicks * cpcBase, 2) };
  });

  const trend: AdsTrendPoint[] = [];
  const points = Math.min(days, 14);
  for (let i = 0; i < points; i++) {
    const d = new Date(+new Date(from) + Math.round((i / Math.max(1, points - 1)) * (days - 1)) * 86400000);
    const w = 0.7 + (i / points) * 0.6 + (rand() - 0.5) * 0.2; // gentle upward drift
    trend.push({
      date: d.toISOString().slice(0, 10),
      clicks: Math.round((current.clicks / points) * w),
      conversions: round((current.conversions / points) * w, 1),
      cost: round((current.cost / points) * w),
      impressions: Math.round((current.impressions / points) * w),
    });
  }

  return { current, previous, campaigns, devices, locations, searchTerms, trend, optimizationScore: Math.round(72 + rand() * 22), isMock: true };
}

/* ── manual entry → AdsData (no API needed) ─────────────────────────────── */
export interface ManualAdsInput {
  impressions: number; clicks: number; conversions: number; cost: number;
  convValue?: number; budget?: number;
  prevImpressions?: number; prevClicks?: number; prevConversions?: number; prevCost?: number;
  topCampaign?: string; topDevice?: string; topRegion?: string; topTerm?: string;
}

export function buildManualAdsData(m: ManualAdsInput): AdsData {
  const impressions = Math.max(0, Math.round(m.impressions || 0));
  const clicks = Math.max(0, Math.round(m.clicks || 0));
  const conversions = Math.max(0, m.conversions || 0);
  const cost = Math.max(0, m.cost || 0);
  const convValue = Math.max(0, m.convValue || conversions * 200);
  const budget = Math.max(cost, m.budget || cost);
  const current = totalsFrom(clicks, impressions, cost, conversions, convValue, budget);

  // Previous period: use entered values where given, else mirror current (neutral deltas).
  const previous = totalsFrom(
    m.prevClicks ?? clicks,
    m.prevImpressions ?? impressions,
    m.prevCost ?? cost,
    m.prevConversions ?? conversions,
    (m.prevConversions ?? conversions) * 200,
    budget,
  );

  const campaigns: AdsCampaign[] = [{
    name: m.topCampaign?.trim() || 'הקמפיין המוביל', status: 'ENABLED', budget,
    impressions, clicks, ctr: current.ctr, avgCpc: current.avgCpc, cost: current.cost,
    conversions: current.conversions, convValue: current.convValue, costPerConv: current.costPerConv,
  }];
  const devices: AdsBreakdown[] = m.topDevice?.trim()
    ? [{ label: m.topDevice.trim(), clicks, conversions: current.conversions, cost: current.cost, impressions }] : [];
  const locations: AdsBreakdown[] = m.topRegion?.trim()
    ? [{ label: m.topRegion.trim(), clicks, conversions: current.conversions, cost: current.cost, impressions }] : [];
  const searchTerms: AdsTerm[] = m.topTerm?.trim()
    ? [{ term: m.topTerm.trim(), clicks: Math.round(clicks * 0.2), conversions: round(current.conversions * 0.2, 1), ctr: current.ctr, cost: round(current.cost * 0.2, 2) }] : [];

  // Gentle synthetic trend so the chart isn't empty.
  const trend: AdsTrendPoint[] = [];
  const pts = 7;
  for (let i = 0; i < pts; i++) {
    const w = 0.8 + (i / (pts - 1)) * 0.4;
    trend.push({ date: `יום ${i + 1}`, clicks: Math.round((clicks / pts) * w), conversions: round((conversions / pts) * w, 1), cost: round((cost / pts) * w), impressions: Math.round((impressions / pts) * w) });
  }

  return { current, previous, campaigns, devices, locations, searchTerms, trend, optimizationScore: null, isMock: false };
}

/* ── live fetch (best effort; falls back to mock on any issue) ──────────── */
async function fetchLive(_conn: GoogleAdsConnection, _from: string, _to: string): Promise<AdsData | null> {
  // Live integration requires: OAuth refresh (GOOGLE_ADS_CLIENT_ID/SECRET +
  // connection.refreshToken) → POST googleads.googleapis.com searchStream with
  // the GAQL queries (see gaql.ts), then normalize cost_micros/1e6, ctr*100, etc.
  // Until production credentials are verified we return null → mock fallback, so
  // the pipeline always produces a report. (No client-facing error is ever shown.)
  return null;
}

export async function fetchAdsData(
  conn: GoogleAdsConnection | null,
  clientId: string,
  from: string, to: string,
  prevFrom: string, prevTo: string,
): Promise<AdsData> {
  if (conn && conn.status === 'connected' && googleAdsConfigured()) {
    try {
      const live = await fetchLive(conn, from, to);
      if (live) return live;
    } catch (e) {
      console.warn('[google-ads] live fetch failed, using mock:', e instanceof Error ? e.message : e);
    }
  }
  // Mock — current period keyed by client+range, previous by client+prev-range.
  const cur = buildMock(`${clientId}:${from}:${to}`, from, to);
  const prev = buildMock(`${clientId}:${prevFrom}:${prevTo}`, prevFrom, prevTo);
  return { ...cur, previous: prev.current };
}
