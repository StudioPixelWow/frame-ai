/**
 * Rank + Backlink engine — ensures up to 150 tracked keywords per plan, scans
 * their Google ranks over time, and monitors up to 500 backlinks + site authority.
 */

import { seoPlans } from '@/lib/db';
import { ensureRbTables, rbSb, rbId, listKeywords } from './db';
import { getRank, getAuthority, getBacklinks } from './providers';
import { generateWithAI } from '@/lib/ai/openai-client';

const MAX_KEYWORDS = 150;
const MAX_BACKLINKS = 500;
const planDomain = (plan: any) => (plan?.websiteUrl || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

/** Ensure up to 150 tracked keywords: seed from plan keywords, then AI-expand. */
export async function ensureTrackedKeywords(plan: any): Promise<number> {
  await ensureRbTables();
  const sb = rbSb();
  const existing = await listKeywords(plan.id);
  if (existing.length >= MAX_KEYWORDS) return 0;
  const have = new Set(existing.map((k: any) => k.keyword));

  const seed: string[] = [...(plan.clientKeywords || []), ...(plan.aiKeywords || [])]
    .map((k: any) => (typeof k === 'string' ? k : k?.keyword)).filter(Boolean);

  // AI-expand to reach 150 if we have a base + room.
  let expanded: string[] = [];
  const need = MAX_KEYWORDS - (existing.length + seed.filter((s) => !have.has(s)).length);
  if (need > 0 && seed.length) {
    try {
      const facts = plan?.websiteScan?.websiteFacts || {};
      const out = await generateWithAI(
        'אתה חוקר מילות מפתח SEO. החזר JSON array של מחרוזות בלבד (ביטויי חיפוש מסחריים/אינפורמטיביים בעברית, ללא מותג).',
        `עסק: ${plan.clientName || ''}${facts?.detected_industry?.value ? `, תחום: ${facts.detected_industry.value}` : ''}${facts?.detected_location?.value ? `, אזור: ${facts.detected_location.value}` : ''}.
ביטויי בסיס: ${seed.slice(0, 20).join(', ')}.
ייצר ${Math.min(need, 130)} ביטויי מפתח נוספים רלוונטיים למעקב דירוג. JSON array בלבד.`,
        { temperature: 0.5, maxTokens: 2000 });
      const d: any = out?.success ? out.data : [];
      expanded = (Array.isArray(d) ? d : (typeof d === 'string' ? JSON.parse(d.slice(d.indexOf('['), d.lastIndexOf(']') + 1)) : [])).filter((x: any) => typeof x === 'string');
    } catch { /* seed-only */ }
  }

  const all = Array.from(new Set([...seed, ...expanded])).filter((k) => k && !have.has(k)).slice(0, MAX_KEYWORDS - existing.length);
  if (!all.length) return 0;
  const now = new Date().toISOString();
  const rows = all.map((keyword) => ({ id: rbId('tkw'), plan_id: plan.id, client_id: plan.clientId || null, keyword, target_url: plan.websiteUrl || null, country: 'IL', language: 'he', history: [], created_at: now }));
  for (let i = 0; i < rows.length; i += 200) await sb.from('geo_tracked_keywords').insert(rows.slice(i, i + 200)).then(() => {}, () => {});
  return rows.length;
}

/** Scan Google ranks for tracked keywords (cap per run to control cost). */
export async function scanRanks(plan: any, limit = MAX_KEYWORDS): Promise<{ checked: number; mock: boolean }> {
  await ensureRbTables();
  const sb = rbSb();
  const domain = planDomain(plan);
  const kws = (await listKeywords(plan.id)).slice(0, limit);
  let mock = false; let checked = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const k of kws) {
    try {
      const res = await getRank(k.keyword, domain, (k.country || 'IL').toLowerCase(), k.language || 'he');
      if (res.mock) mock = true;
      const history = Array.isArray(k.history) ? k.history.slice(-29) : [];
      history.push({ date: today, rank: res.rank });
      const best = [k.best_rank, res.rank].filter((x) => typeof x === 'number') as number[];
      await sb.from('geo_tracked_keywords').update({
        previous_rank: k.current_rank ?? null, current_rank: res.rank,
        best_rank: best.length ? Math.min(...best) : null,
        search_volume: k.search_volume || res.volume || null, difficulty: k.difficulty || res.difficulty || null,
        history, last_checked: new Date().toISOString(),
      }).eq('id', k.id);
      checked++;
    } catch { /* skip one */ }
  }
  return { checked, mock };
}

/** Monitor up to 500 backlinks + compute/store site authority metrics. */
export async function scanBacklinks(plan: any): Promise<{ backlinks: number; mock: boolean }> {
  await ensureRbTables();
  const sb = rbSb();
  const domain = planDomain(plan);
  if (!domain) return { backlinks: 0, mock: true };

  const [auth, links] = await Promise.all([getAuthority(domain), getBacklinks(domain, MAX_BACKLINKS)]);
  const mock = auth.source === 'estimated';
  const now = new Date().toISOString();

  // Authority snapshot.
  await sb.from('geo_authority_metrics').insert({ id: rbId('authm'), plan_id: plan.id, client_id: plan.clientId || null, dr: auth.dr, ur: auth.ur, total_links: auth.totalLinks, referring_domains: auth.referringDomains, dofollow_domains: auth.dofollowDomains, dofollow_links: auth.dofollowLinks, source: auth.source, computed_at: now });

  // Upsert backlinks (mark new/active; flag lost ones not seen now).
  const { data: existing } = await sb.from('geo_backlinks').select('id, source_url').eq('plan_id', plan.id).limit(2000);
  const have = new Map((existing || []).map((r: any) => [r.source_url, r.id]));
  const seen = new Set<string>();
  const toInsert: any[] = [];
  for (const b of links.slice(0, MAX_BACKLINKS)) {
    seen.add(b.source_url);
    if (have.has(b.source_url)) { await sb.from('geo_backlinks').update({ last_seen: now, status: 'active', anchor: b.anchor, dofollow: b.dofollow, domain_rating: b.domain_rating ?? null }).eq('id', have.get(b.source_url)); }
    else toInsert.push({ id: rbId('bl'), plan_id: plan.id, client_id: plan.clientId || null, source_url: b.source_url, source_domain: b.source_domain, target_url: b.target_url, anchor: b.anchor, dofollow: b.dofollow, domain_rating: b.domain_rating ?? null, first_seen: now, last_seen: now, status: 'new', created_at: now });
  }
  for (let i = 0; i < toInsert.length; i += 200) await sb.from('geo_backlinks').insert(toInsert.slice(i, i + 200)).then(() => {}, () => {});
  // Mark lost (previously active, not seen this scan).
  for (const [url, id] of have) if (!seen.has(url)) await sb.from('geo_backlinks').update({ status: 'lost' }).eq('id', id);

  return { backlinks: links.length, mock };
}

export async function loadPlanForRb(planId: string) { return seoPlans.getByIdAsync(planId); }
