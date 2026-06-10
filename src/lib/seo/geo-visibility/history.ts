/**
 * Visibility history engine — called at the end of every run. Turns a single
 * run into longitudinal intelligence: answer snapshots, change events vs the
 * prior run, per-citation lifecycle history, citation diffs, source-strength
 * classification, alerts, and anonymous Global Citation Index aggregates.
 */

import { ensureVisibilityHistoryTables, histSb, hid } from './history-db';

export interface PerResponse {
  queryId: string; queryText: string; topic: string; engine: string;
  found: boolean; recommendationLevel: string;
  citations: { url: string; domain: string; isOwn: boolean; isCompetitor: boolean; position: number }[];
  competitors: string[];
}

/** Classify a citation's strength from its position (1 = primary). */
export function classifyCitation(position: number, isOwn: boolean) {
  if (position <= 1) return { classification: 'primary_source', weight: 5, isPrimary: true, isFeatured: true, reason: 'מקור ראשון בתשובה' };
  if (position <= 3) return { classification: 'featured_source', weight: 3, isPrimary: false, isFeatured: true, reason: `מקור בולט (מיקום ${position})` };
  if (position <= 6) return { classification: 'supporting_source', weight: 1.5, isPrimary: false, isFeatured: false, reason: `מקור תומך (מיקום ${position})` };
  return { classification: 'citation', weight: 1, isPrimary: false, isFeatured: false, reason: `ציטוט (מיקום ${position})` };
}

const sev = (t: string): string => (['brand_left', 'primary_source_lost', 'competitor_overtook_brand'].includes(t) ? 'high'
  : ['citation_lost', 'featured_source_lost', 'recommendation_downgraded', 'share_dropped'].includes(t) ? 'medium' : 'low');

const REC_RANK: Record<string, number> = { not_mentioned: 0, mentioned: 1, neutrally_listed: 2, recommended: 3, strongly_recommended: 4, top_recommendation: 5 };
const pageType = (url: string) => /\/(blog|article|magazine|news)\//i.test(url) ? 'blog' : /\.gov|\.gov\.il|\.muni/i.test(url) ? 'government' : /\/(service|services|product)/i.test(url) ? 'service' : /wikipedia|wiki/i.test(url) ? 'reference' : 'page';

export async function recordRunHistory(args: {
  planId: string; clientId: string | null; runId: string; prevRunId: string | null;
  perResponse: PerResponse[]; industry?: string; country?: string; language?: string;
}) {
  await ensureVisibilityHistoryTables();
  const sb = histSb();
  const now = new Date().toISOString();

  // Previous-run snapshots keyed by query:engine for diffing.
  const prevMap = new Map<string, any>();
  if (args.prevRunId) {
    const { data } = await sb.from('geo_ai_answer_snapshots').select('*').eq('run_id', args.prevRunId);
    for (const s of (data || [])) prevMap.set(`${s.query_id}:${s.ai_engine}`, s);
  }

  const snapRows: any[] = [], eventRows: any[] = [], diffRows: any[] = [], alertRows: any[] = [];
  const addEvent = (pr: PerResponse, type: string, before: string, after: string, explanation: string) =>
    eventRows.push({ id: hid('chg'), plan_id: args.planId, query_id: pr.queryId, ai_engine: pr.engine, event_type: type, severity: sev(type), before_value: before, after_value: after, explanation, created_at: now });
  const addAlert = (pr: PerResponse, type: string, title: string, description: string, extra: any = {}) =>
    alertRows.push({ id: hid('alert'), plan_id: args.planId, client_id: args.clientId, alert_type: type, severity: sev(type), title, description, related_query_id: pr.queryId, related_url: extra.url || null, related_competitor: extra.competitor || null, before_value: extra.before || null, after_value: extra.after || null, detected_at: now, status: 'new', action_recommendation: extra.rec || null });
  const addDiff = (pr: PerResponse, type: string, prev: string, cur: string, impact: number) =>
    diffRows.push({ id: hid('diff'), plan_id: args.planId, query_id: pr.queryId, ai_engine: pr.engine, diff_type: type, previous_run_id: args.prevRunId, current_run_id: args.runId, previous_value: prev, current_value: cur, impact_score: impact, severity: sev(type), created_at: now });

  // Aggregate citation-history + global-index changes.
  const ownUrlsSeen = new Map<string, { domain: string; topics: Set<string>; engines: Set<string>; queries: Set<string>; isOwn: boolean }>();
  const lostOwnUrls = new Set<string>();
  const globalAgg = new Map<string, { domain: string; topic: string; engine: string; count: number; posSum: number; pageType: string }>();

  for (const pr of args.perResponse) {
    const key = `${pr.queryId}:${pr.engine}`;
    const prev = prevMap.get(key);
    const curUrls = pr.citations.map((c) => c.url);
    const curCompetitors = pr.competitors;

    snapRows.push({ id: hid('snap'), plan_id: args.planId, run_id: args.runId, query_id: pr.queryId, ai_engine: pr.engine, response_hash: String(hashStr(curUrls.join('|') + pr.found + pr.recommendationLevel)), normalized_answer: '', brand_found: pr.found, recommendation_level: pr.recommendationLevel, citations: pr.citations, competitors: curCompetitors, created_at: now });

    if (prev) {
      const prevUrls: string[] = (prev.citations || []).map((c: any) => c.url);
      const prevComp: string[] = prev.competitors || [];
      // Brand presence.
      if (!prev.brand_found && pr.found) { addEvent(pr, 'brand_entered', 'absent', 'present', `המותג נכנס לתשובה ל"${pr.queryText}"`); addAlert(pr, 'brand_entered', 'המותג נכנס לתשובת AI', `"${pr.queryText}" (${pr.engine})`, { rec: 'נצל מומנטום — חזק את העמוד' }); }
      if (prev.brand_found && !pr.found) { addEvent(pr, 'brand_left', 'present', 'absent', `המותג נעלם מהתשובה ל"${pr.queryText}"`); addAlert(pr, 'brand_left', 'המותג נעלם מתשובת AI', `"${pr.queryText}" (${pr.engine})`, { rec: 'בדוק עמוד יעד + חזק תוכן/ציטוטים' }); }
      // Recommendation level.
      if ((REC_RANK[pr.recommendationLevel] ?? 0) < (REC_RANK[prev.recommendation_level] ?? 0)) addEvent(pr, 'recommendation_downgraded', prev.recommendation_level, pr.recommendationLevel, 'רמת ההמלצה ירדה');
      else if ((REC_RANK[pr.recommendationLevel] ?? 0) > (REC_RANK[prev.recommendation_level] ?? 0)) addEvent(pr, 'recommendation_upgraded', prev.recommendation_level, pr.recommendationLevel, 'רמת ההמלצה עלתה');
      // Citations gained/lost.
      for (const u of curUrls) if (!prevUrls.includes(u)) { addDiff(pr, 'citation_gained', '', u, 5); const own = pr.citations.find((c) => c.url === u)?.isOwn; if (own) addEvent(pr, 'citation_added', '', u, 'ציטוט חדש לאתר'); }
      for (const u of prevUrls) if (!curUrls.includes(u)) { addDiff(pr, 'citation_lost', u, '', -5); const wasOwn = (prev.citations || []).find((c: any) => c.url === u)?.isOwn; if (wasOwn) { lostOwnUrls.add(u); addEvent(pr, 'citation_removed', u, '', 'ציטוט לאתר אבד'); addAlert(pr, 'citation_lost', 'ציטוט לאתר אבד', `${u} ב"${pr.queryText}"`, { url: u, rec: 'חזק את העמוד / הוסף מקורות' }); } }
      // Competitors.
      for (const c of curCompetitors) if (!prevComp.includes(c)) { addEvent(pr, 'competitor_entered', '', c, `מתחרה נכנס: ${c}`); if (!pr.found) addAlert(pr, 'competitor_overtook_brand', 'מתחרה עוקף אותך', `${c} מופיע ב"${pr.queryText}" ואנחנו לא`, { competitor: c, rec: 'צור/חזק תוכן לשאילתה' }); }
      for (const c of prevComp) if (!curCompetitors.includes(c)) addEvent(pr, 'competitor_left', c, '', `מתחרה יצא: ${c}`);
    } else if (pr.found) {
      addEvent(pr, 'brand_new_appearance', 'absent', 'present', `הופעה ראשונה ב"${pr.queryText}"`);
    }

    // Citation history + global index accumulation.
    for (const c of pr.citations) {
      if (c.isOwn) {
        const e = ownUrlsSeen.get(c.url) || { domain: c.domain, topics: new Set<string>(), engines: new Set<string>(), queries: new Set<string>(), isOwn: true };
        e.topics.add(pr.topic); e.engines.add(pr.engine); e.queries.add(pr.queryId); ownUrlsSeen.set(c.url, e);
      }
      const gKey = `${c.domain}|${pr.topic}|${pr.engine}`;
      const g = globalAgg.get(gKey) || { domain: c.domain, topic: pr.topic, engine: pr.engine, count: 0, posSum: 0, pageType: pageType(c.url) };
      g.count++; g.posSum += c.position; globalAgg.set(gKey, g);
    }
  }

  // Persist snapshots/events/diffs/alerts (chunked).
  const ins = async (t: string, rows: any[]) => { for (let i = 0; i < rows.length; i += 200) await sb.from(t).insert(rows.slice(i, i + 200)).then(() => {}, () => {}); };
  await ins('geo_ai_answer_snapshots', snapRows);
  await ins('geo_ai_answer_change_events', eventRows);
  await ins('geo_citation_diffs', diffRows);
  await ins('geo_visibility_alerts', alertRows);

  // ── Action Center bridge: high-severity alerts become Authority recommendations ──
  const ALERT_MODULE: Record<string, string> = { brand_left: 'brand_mention', citation_lost: 'citation_builder', competitor_overtook_brand: 'content_authority' };
  const recRows = alertRows.filter((a) => a.severity === 'high' || a.alert_type === 'citation_lost').slice(0, 25).map((a) => ({
    id: hid('grec'), plan_id: args.planId, client_id: args.clientId,
    module_id: ALERT_MODULE[a.alert_type] || 'authority_score',
    title: `[נראות AI] ${a.title}`, description: `${a.description}${a.action_recommendation ? ' — ' + a.action_recommendation : ''}`,
    priority: a.severity === 'high' ? 'high' : 'medium', related_page: a.related_url || null,
    estimated_impact: 'שיפור נראות AI', status: 'open', created_by: 'ai_visibility', created_at: now,
  }));
  if (recRows.length) { try { await sb.from('geo_recommendations').insert(recRows); } catch { /* table from authority center */ } }

  // Upsert citation history (own-site URLs seen this run + lost).
  await upsertCitationHistory(args.planId, now, ownUrlsSeen, lostOwnUrls);
  // Upsert global index.
  await upsertGlobalIndex(now, globalAgg, args.industry, args.country, args.language);

  // ── Outbound notification: email the team about high-severity changes (throttled). ──
  let notified: any = null;
  try {
    const { notifyVisibilityAlerts } = await import('./notify');
    notified = await notifyVisibilityAlerts(args.planId, args.clientId, alertRows);
  } catch { /* non-fatal */ }

  return { snapshots: snapRows.length, changeEvents: eventRows.length, diffs: diffRows.length, alerts: alertRows.length, notified };
}

async function upsertCitationHistory(planId: string, now: string, seen: Map<string, any>, lost: Set<string>) {
  const sb = histSb();
  const { data: existing } = await sb.from('geo_citation_history').select('*').eq('plan_id', planId).limit(2000);
  const byUrl = new Map((existing || []).map((r: any) => [r.cited_url, r]));
  for (const [url, info] of seen) {
    const ex = byUrl.get(url);
    if (ex) {
      await sb.from('geo_citation_history').update({
        last_seen_at: now, total_times_seen: (ex.total_times_seen || 0) + 1,
        current_visibility_status: ex.current_visibility_status === 'lost' ? 'regained' : 'active',
        visibility_trend: 'growing',
        engines_seen_on: Array.from(new Set([...(ex.engines_seen_on || []), ...info.engines])),
        topics_seen_on: Array.from(new Set([...(ex.topics_seen_on || []), ...info.topics])),
        updated_at: now,
      }).eq('id', ex.id);
    } else {
      await sb.from('geo_citation_history').insert({
        id: hid('cithist'), plan_id: planId, cited_url: url, cited_domain: info.domain,
        first_seen_at: now, last_seen_at: now, total_times_seen: 1, current_visibility_status: 'new',
        visibility_trend: 'growing', engines_seen_on: Array.from(info.engines), topics_seen_on: Array.from(info.topics),
        queries_seen_on: Array.from(info.queries), is_own_site: true, updated_at: now,
      });
    }
  }
  for (const url of lost) {
    const ex = byUrl.get(url);
    if (ex && !seen.has(url)) await sb.from('geo_citation_history').update({ current_visibility_status: 'lost', visibility_trend: 'declining', citation_loss_count: (ex.citation_loss_count || 0) + 1, updated_at: now }).eq('id', ex.id);
  }
}

async function upsertGlobalIndex(now: string, agg: Map<string, any>, industry?: string, country?: string, language?: string) {
  const sb = histSb();
  let n = 0;
  for (const g of agg.values()) {
    if (n++ > 200) break;
    const { data: ex } = await sb.from('geo_global_citation_index').select('*').eq('cited_domain', g.domain).eq('topic', g.topic).eq('ai_engine', g.engine).maybeSingle();
    if (ex) {
      const freq = (ex.citation_frequency || 0) + g.count;
      const posAvg = ((ex.citation_position_avg || 0) * (ex.citation_frequency || 0) + g.posSum) / Math.max(1, freq);
      await sb.from('geo_global_citation_index').update({ citation_frequency: freq, citation_position_avg: +posAvg.toFixed(2), last_seen_at: now }).eq('id', ex.id);
    } else {
      await sb.from('geo_global_citation_index').insert({ id: hid('gci'), cited_domain: g.domain, page_type: g.pageType, topic: g.topic, industry: industry || null, language: language || 'he', country: country || 'IL', ai_engine: g.engine, citation_frequency: g.count, citation_position_avg: +(g.posSum / g.count).toFixed(2), source_type: g.pageType, first_seen_at: now, last_seen_at: now });
    }
  }
}

function hashStr(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return Math.abs(h); }
