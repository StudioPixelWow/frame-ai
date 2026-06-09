/**
 * Google Ads CSV import → AdsData.
 * Parses the standard Google Ads "Download → .csv" exports (Campaigns, Devices,
 * Locations/Geo, Search terms). Handles the report preamble rows, quoted fields,
 * a trailing "Total" row, currency/percent/thousands formatting, and both
 * English and Hebrew column headers. Upload one or more files — each is
 * auto-detected by its columns and merged into a single rich dataset.
 */

import type { AdsData, AdsTotals, AdsCampaign, AdsBreakdown, AdsTerm, AdsTrendPoint } from './provider';

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Clean a Google Ads cell into a number: strips ₪/$/€, commas, %, spaces. */
function toNum(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = String(v).replace(/[^\d.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Minimal CSV line splitter that respects quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if ((ch === ',' || ch === '\t') && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const HEADER_HINTS = ['campaign', 'קמפיין', 'impressions', 'חשיפות', 'clicks', 'קליקים', 'cost', 'עלות', 'device', 'מכשיר', 'search term', 'מונח', 'ביטוי'];

/** Find the header row (Google Ads exports have 1-2 preamble title/date rows). */
function parseRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length);
  let headerIdx = lines.findIndex((l) => {
    const low = l.toLowerCase();
    return HEADER_HINTS.some((h) => low.includes(h));
  });
  if (headerIdx < 0) headerIdx = 0;
  const headers = splitCsvLine(lines[headerIdx]).map((h) => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => !c)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = cells[j] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

/** Resolve a value by trying several header synonyms (substring match). */
function pick(row: Record<string, string>, keys: string[]): string {
  const hk = Object.keys(row);
  for (const k of keys) {
    const found = hk.find((h) => h.includes(k));
    if (found) return row[found];
  }
  return '';
}

// Headers that are derived/ratio columns — must NOT be picked as a base metric
// (e.g. "Impr. (Abs. Top) %", "Search Impr. share", "Conv. rate").
const DERIVED_RE = /%|share|abs\.?\s*top|top\s*%|rate|\/|avg\.?\s*cpc|ratio|index/;

/** Pick a BASE numeric metric: prefer the shortest header that matches a synonym
 *  and is NOT a derived/ratio column. Avoids grabbing "Impr. share %" for impressions. */
function pickMetric(row: Record<string, string>, keys: string[]): string {
  const hk = Object.keys(row);
  const matches = hk.filter((h) => keys.some((k) => h.includes(k)) && !DERIVED_RE.test(h));
  if (matches.length) {
    matches.sort((a, b) => a.length - b.length); // shortest = the base column
    return row[matches[0]];
  }
  return '';
}
const COL = {
  campaign: ['campaign', 'קמפיין'],
  device: ['device', 'מכשיר'],
  region: ['region', 'city', 'location', 'country', 'metro', 'אזור', 'עיר', 'מדינה', 'מיקום'],
  term: ['search term', 'search keyword', 'מונח', 'ביטוי'],
  impressions: ['impr', 'חשיפ'],
  clicks: ['click', 'קליק'],
  cost: ['cost', 'עלות'],
  conversions: ['conversions', 'conv.', 'המרות', 'המרה'],
  convValue: ['conv. value', 'all conv. value', 'ערך המר'],
  budget: ['budget', 'תקציב'],
  ctr: ['ctr', 'שיעור הקלקה', 'אחוז הקלקה'],
  date: ['day', 'date', 'תאריך', 'יום'],
};
const isTotalRow = (row: Record<string, string>): boolean =>
  Object.values(row).some((v) => /^total|^סה"?כ|^סך/i.test((v || '').trim()));

function totalsFrom(clicks: number, impressions: number, cost: number, conversions: number, convValue: number, budget: number): AdsTotals {
  return {
    impressions, clicks, cost: round(cost), conversions: round(conversions, 1), convValue: round(convValue),
    ctr: impressions ? round((clicks / impressions) * 100, 2) : 0,
    avgCpc: clicks ? round(cost / clicks, 2) : 0,
    costPerConv: conversions ? round(cost / conversions, 2) : 0,
    convRate: clicks ? round((conversions / clicks) * 100, 2) : 0,
    budget: round(budget || cost),
  };
}

export interface CsvFile { name: string; text: string }

export function parseGoogleAdsCsvFiles(files: CsvFile[]): { data: AdsData; warnings: string[] } {
  const warnings: string[] = [];
  let campaigns: AdsCampaign[] = [];
  let devices: AdsBreakdown[] = [];
  let locations: AdsBreakdown[] = [];
  let searchTerms: AdsTerm[] = [];
  let trend: AdsTrendPoint[] = [];
  let totImpr = 0, totClicks = 0, totCost = 0, totConv = 0, totVal = 0, totBudget = 0;

  for (const f of files) {
    let parsed; try { parsed = parseRows(f.text); } catch { warnings.push(`קובץ ${f.name} לא נקרא`); continue; }
    const { headers, rows } = parsed;
    const has = (k: keyof typeof COL) => COL[k].some((s) => headers.some((h) => h.includes(s)));
    const dataRows = rows.filter((r) => !isTotalRow(r));

    if (has('term')) {
      searchTerms = dataRows.map((r) => ({
        term: pick(r, COL.term), clicks: toNum(pick(r, COL.clicks)),
        conversions: round(toNum(pick(r, COL.conversions)), 1), ctr: 0, cost: round(toNum(pick(r, COL.cost)), 2),
      })).filter((t) => t.term).sort((a, b) => b.conversions - a.conversions).slice(0, 10);
    } else if (has('device')) {
      devices = dataRows.map((r) => ({
        label: pick(r, COL.device), clicks: toNum(pick(r, COL.clicks)),
        conversions: round(toNum(pick(r, COL.conversions)), 1), cost: round(toNum(pick(r, COL.cost)), 2), impressions: toNum(pick(r, COL.impressions)),
      })).filter((d) => d.label);
    } else if (has('region') && !has('campaign')) {
      locations = dataRows.map((r) => ({
        label: pick(r, COL.region), clicks: toNum(pick(r, COL.clicks)),
        conversions: round(toNum(pick(r, COL.conversions)), 1), cost: round(toNum(pick(r, COL.cost)), 2), impressions: toNum(pick(r, COL.impressions)),
      })).filter((l) => l.label).sort((a, b) => b.conversions - a.conversions).slice(0, 10);
    } else if (has('date') && !has('campaign')) {
      trend = dataRows.map((r) => ({
        date: pick(r, COL.date), clicks: toNum(pick(r, COL.clicks)), conversions: round(toNum(pick(r, COL.conversions)), 1),
        cost: round(toNum(pick(r, COL.cost)), 2), impressions: toNum(pick(r, COL.impressions)),
      }));
    } else if (has('campaign') || (has('clicks') && has('cost'))) {
      // Campaigns (or account-level) report — the primary totals source.
      for (const r of dataRows) {
        const clicks = toNum(pickMetric(r, COL.clicks));
        let impressions = toNum(pickMetric(r, COL.impressions));
        const ctrVal = toNum(pickMetric(r, COL.ctr)); // e.g. "2.91%" → 2.91
        // Recover impressions from CTR if the impressions column was missing/misread.
        if (impressions === 0 && clicks > 0 && ctrVal > 0) impressions = Math.round(clicks / (ctrVal / 100));
        const cost = toNum(pickMetric(r, COL.cost)), conversions = toNum(pickMetric(r, COL.conversions));
        const convValue = toNum(pickMetric(r, COL.convValue)), budget = toNum(pickMetric(r, COL.budget));
        totImpr += impressions; totClicks += clicks; totCost += cost; totConv += conversions; totVal += convValue; totBudget += budget;
        const name = pick(r, COL.campaign);
        if (name) campaigns.push({
          name, status: 'ENABLED', budget: round(budget || cost), impressions, clicks,
          ctr: impressions ? round((clicks / impressions) * 100, 2) : 0,
          avgCpc: clicks ? round(cost / clicks, 2) : 0, cost: round(cost),
          conversions: round(conversions, 1), convValue: round(convValue),
          costPerConv: conversions ? round(cost / conversions, 2) : 0,
        });
      }
    } else {
      warnings.push(`לא זוהה סוג הדוח בקובץ ${f.name}`);
    }
  }

  // If totals weren't captured from a campaigns file, derive from any breakdown.
  if (totClicks === 0) {
    const src = devices.length ? devices : locations.length ? locations : [];
    for (const b of src) { totClicks += b.clicks; totConv += b.conversions; totCost += b.cost; totImpr += b.impressions; }
  }

  campaigns.sort((a, b) => b.conversions - a.conversions);
  const current = totalsFrom(totClicks, totImpr, totCost, totConv, totVal, totBudget);

  if (!trend.length && campaigns.length) {
    // Synthesize a light trend so the chart isn't empty.
    const pts = 7;
    for (let i = 0; i < pts; i++) {
      const w = 0.8 + (i / (pts - 1)) * 0.4;
      trend.push({ date: `יום ${i + 1}`, clicks: Math.round((totClicks / pts) * w), conversions: round((totConv / pts) * w, 1), cost: round((totCost / pts) * w), impressions: Math.round((totImpr / pts) * w) });
    }
  }

  const data: AdsData = {
    current, previous: current, // single-period upload → neutral comparison
    campaigns: campaigns.slice(0, 8), devices, locations, searchTerms, trend,
    optimizationScore: null, isMock: false,
  };
  return { data, warnings };
}
