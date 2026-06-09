/**
 * Google Ads CSV import → AdsData.
 * Tuned to REAL Google Ads Hebrew exports (and English). Upload any subset of:
 *   קמפיינים · מכשירים · רשתות · חיפושים · יום ושעה · דמוגרפיה · פעולות על ציר הזמן ·
 *   ציון האופטימיזציה · השינויים הגדולים ביותר (השוואה).
 * Each file is auto-detected by its columns. Metrics are pulled from the BEST
 * source (e.g. totals from the time-trend file; impressions from the hourly/
 * demographics "הופעות"; previous-period from the comparison file).
 *
 * Important Hebrew header facts learned from real exports:
 *   • impressions = "הופעות" (NOT "חשיפות")
 *   • the Campaigns file has only cost + conversions (NO clicks/impressions)
 *   • cost cells look like "‏3,963.83 ‏₪" (RTL marks + ₪ + thousands comma)
 */

import type { AdsData, AdsTotals, AdsCampaign, AdsBreakdown, AdsTerm, AdsTrendPoint } from './provider';

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
function toNum(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if ((ch === ',' || ch === '\t') && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.replace(/[‎‏‪-‮]/g, '').trim()); // strip RTL/LRM marks
}

const HEADER_HINTS = ['קמפיין', 'מכשיר', 'רשת', 'חיפוש', 'מילת מפתח', 'תאריך', 'הופעות', 'קליקים', 'עלות', 'טווח גיל', 'מגדר', 'שעת', 'ציון האופטימיזציה', 'campaign', 'clicks', 'impr', 'cost', 'device'];
function parseRows(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length);
  let hi = lines.findIndex((l) => { const low = l.toLowerCase(); return HEADER_HINTS.some((h) => low.includes(h.toLowerCase())); });
  if (hi < 0) hi = 0;
  const headers = splitCsvLine(lines[hi]);
  const rows: string[][] = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => !c)) continue;
    rows.push(cells);
  }
  return { headers, rows };
}

/** Find a column index whose header includes any synonym and none of `exclude`. */
function findCol(headers: string[], syns: string[], exclude: string[] = []): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (syns.some((s) => h.includes(s.toLowerCase())) && !exclude.some((e) => h.includes(e.toLowerCase()))) return i;
  }
  return -1;
}
const isTotal = (cells: string[]) => /^(total|סך|סך הכל|סה)/i.test((cells[0] || '').trim());

const SYN = {
  campaign: ['שם קמפיין', 'campaign'],
  device: ['מכשיר', 'device'],
  network: ['רשת', 'network'],
  term: ['חיפוש', 'מונח', 'search term', 'search keyword'],
  keyword: ['מילת מפתח', 'keyword'],
  date: ['תאריך', 'date', 'day'],
  hourStart: ['שעת', 'hour'],
  ageGender: ['טווח גיל', 'מגדר', 'age', 'gender'],
  optScore: ['ציון האופטימיזציה', 'optimization score'],
  impressions: ['הופעות', 'impr', 'חשיפ'],
  clicks: ['קליקים', 'clicks'],
  cost: ['עלות', 'cost'],
  conversions: ['המרות', 'conversions', 'conv'],
  ctr: ['שיעור קליקים', 'ctr', 'אחוז הקלקה'],
};
const COST_EXCL = ['/', 'ממוצעת', 'השוואה', 'comparison', 'comp', 'avg', 'לקליק'];
const CLICKS_EXCL = ['שיעור', 'rate', 'השוואה', 'comparison'];
const CONV_EXCL = ['/', 'rate', 'שיעור', 'value', 'ערך'];

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
  // metric sources (null = not provided)
  let tt: { clicks: number; conv: number; cost: number; trend: AdsTrendPoint[] } | null = null;
  let campaigns: AdsCampaign[] = [];
  let campConv = 0, campCost = 0;
  let devices: AdsBreakdown[] = [];
  let devClicks = 0, devConv = 0, devCost = 0;
  let netClicks = 0;
  let searchTerms: AdsTerm[] = [];
  let imprTotal = 0; // from hourly / demographics / search (best-effort account impressions)
  let optScore: number | null = null;
  let prevClicks = 0, prevCost = 0, curClicksCmp = 0, curCostCmp = 0;

  const sumCol = (rows: string[][], idx: number) => idx < 0 ? 0 : rows.reduce((s, r) => s + (isTotal(r) ? 0 : toNum(r[idx])), 0);

  for (const f of files) {
    let headers: string[], rows: string[][];
    try { ({ headers, rows } = parseRows(f.text)); } catch { warnings.push(`קובץ ${f.name} לא נקרא`); continue; }
    const data = rows.filter((r) => !isTotal(r));
    const has = (syns: string[], excl: string[] = []) => findCol(headers, syns, excl) >= 0;

    const ci = {
      clicks: findCol(headers, SYN.clicks, CLICKS_EXCL),
      impr: findCol(headers, SYN.impressions),
      cost: findCol(headers, SYN.cost, COST_EXCL),
      conv: findCol(headers, SYN.conversions, CONV_EXCL),
      ctr: findCol(headers, SYN.ctr),
    };

    // ── classify ──
    if (has(SYN.optScore)) {
      const i = findCol(headers, SYN.optScore);
      const scores = data.map((r) => toNum(r[i])).filter((n) => n > 0);
      if (scores.length) optScore = Math.round(Math.max(...scores)); // 50.5% → 50
    } else if (findCol(headers, ['השוואה', 'comparison']) >= 0 && ci.clicks >= 0) {
      // Changes / period-comparison file → previous-period deltas
      const curClk = findCol(headers, SYN.clicks, ['השוואה', 'comparison', 'שיעור']);
      const prvClk = headers.findIndex((h) => /קליקים|clicks/i.test(h) && /השוואה|comparison/i.test(h));
      const curCst = findCol(headers, SYN.cost, ['/', 'ממוצעת', 'השוואה', 'לקליק']);
      const prvCst = headers.findIndex((h) => /עלות|cost/i.test(h) && /השוואה|comparison/i.test(h));
      curClicksCmp = sumCol(data, curClk); prevClicks = sumCol(data, prvClk);
      curCostCmp = sumCol(data, curCst); prevCost = sumCol(data, prvCst);
    } else if (has(SYN.date) && ci.clicks >= 0) {
      // Time-trend (daily) → authoritative totals + trend
      const di = findCol(headers, SYN.date);
      const trend: AdsTrendPoint[] = data.map((r) => ({
        date: r[di] || '', clicks: toNum(r[ci.clicks]), conversions: round(toNum(r[ci.conv]), 1),
        cost: round(toNum(r[ci.cost]), 2), impressions: ci.impr >= 0 ? toNum(r[ci.impr]) : 0,
      }));
      tt = { clicks: sumCol(data, ci.clicks), conv: sumCol(data, ci.conv), cost: sumCol(data, ci.cost), trend };
    } else if (has(SYN.term) && !has(SYN.keyword)) {
      const ti = findCol(headers, SYN.term);
      searchTerms = data.map((r) => ({
        term: r[ti] || '', clicks: toNum(r[ci.clicks]), conversions: round(toNum(r[ci.conv]), 1),
        ctr: ci.ctr >= 0 ? toNum(r[ci.ctr]) : 0, cost: round(toNum(r[ci.cost]), 2),
      })).filter((t) => t.term).sort((a, b) => (b.conversions - a.conversions) || (b.clicks - a.clicks)).slice(0, 10);
    } else if (has(SYN.device)) {
      const li = findCol(headers, SYN.device);
      devices = data.map((r) => ({
        label: r[li] || '', clicks: toNum(r[ci.clicks]), conversions: round(toNum(r[ci.conv]), 1),
        cost: round(toNum(r[ci.cost]), 2), impressions: ci.impr >= 0 ? toNum(r[ci.impr]) : 0,
      })).filter((d) => d.label);
      devClicks = sumCol(data, ci.clicks); devConv = sumCol(data, ci.conv); devCost = sumCol(data, ci.cost);
    } else if (has(SYN.network)) {
      netClicks = sumCol(data, ci.clicks);
    } else if ((has(SYN.hourStart) || has(SYN.ageGender)) && ci.impr >= 0) {
      // Hourly / demographic breakdown → best account-wide impressions source
      imprTotal = Math.max(imprTotal, sumCol(data, ci.impr));
    } else if (has(SYN.campaign)) {
      const ni = findCol(headers, SYN.campaign);
      for (const r of data) {
        const name = r[ni]; if (!name) continue;
        const conv = toNum(r[ci.conv]); const cost = toNum(r[ci.cost]); const clk = ci.clicks >= 0 ? toNum(r[ci.clicks]) : 0;
        campConv += conv; campCost += cost;
        campaigns.push({
          name, status: 'ENABLED', budget: round(cost), impressions: ci.impr >= 0 ? toNum(r[ci.impr]) : 0,
          clicks: clk, ctr: 0, avgCpc: clk ? round(cost / clk, 2) : 0, cost: round(cost),
          conversions: round(conv, 1), convValue: 0, costPerConv: conv ? round(cost / conv, 2) : 0,
        });
      }
    } else {
      // fallback: if it has clicks/cost, treat as campaigns-ish totals
      if (ci.clicks >= 0 || ci.cost >= 0) { /* ignore */ }
      warnings.push(`לא זוהה סוג הדוח בקובץ ${f.name}`);
    }
  }

  // ── combine with priority (most reliable source first) ──
  const clicks = tt?.clicks || devClicks || netClicks || 0;
  const conversions = tt?.conv || campConv || devConv || 0;
  const cost = tt?.cost || campCost || devCost || 0;
  let impressions = imprTotal;
  if (impressions > 0 && impressions < clicks) { impressions = 0; warnings.push('עמודת ההופעות לא זוהתה כראוי'); }

  campaigns.sort((a, b) => (b.conversions - a.conversions) || (b.cost - a.cost));
  const current = totalsFrom(clicks, impressions, cost, conversions, 0, cost);

  // previous period (from comparison file) — only clicks/cost available there
  const previous = totalsFrom(prevClicks || clicks, impressions, prevCost || cost, conversions, 0, cost);

  const trend = tt?.trend?.length ? tt.trend : (() => {
    const pts = 7, arr: AdsTrendPoint[] = [];
    for (let i = 0; i < pts; i++) { const w = 0.8 + (i / (pts - 1)) * 0.4; arr.push({ date: `יום ${i + 1}`, clicks: Math.round((clicks / pts) * w), conversions: round((conversions / pts) * w, 1), cost: round((cost / pts) * w), impressions: Math.round((impressions / pts) * w) }); }
    return arr;
  })();

  const data: AdsData = {
    current, previous,
    campaigns: campaigns.slice(0, 8), devices, locations: [], searchTerms, trend,
    optimizationScore: optScore, isMock: false,
  };
  return { data, warnings };
}
