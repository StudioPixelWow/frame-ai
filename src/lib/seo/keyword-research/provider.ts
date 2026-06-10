/**
 * Keyword Research provider — keyword ideas with monthly volume, competition,
 * CPC (low/high) and a 12-month trend, via DataForSEO Google Ads keyword data,
 * with a deterministic Mock fallback so the tool works before keys are added.
 *
 * ENV: DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD.
 */

const DFS_LOGIN = () => process.env.DATAFORSEO_LOGIN || '';
const DFS_PASS = () => process.env.DATAFORSEO_PASSWORD || '';
export function keywordProviderConfigured(): boolean { return !!(DFS_LOGIN() && DFS_PASS()); }

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return Math.abs(h); };
const HE_MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

export type Competition = 'LOW' | 'MEDIUM' | 'HIGH';
export interface KeywordIdea {
  keyword: string;
  volume: number;          // monthly searches
  competition: Competition;
  competitionIndex: number; // 0-100
  cpcLow: number;
  cpcHigh: number;
  potential: 'גבוה' | 'בינוני' | 'נמוך';
  trend: { month: string; volume: number }[]; // 12 months
}

function potentialOf(volume: number, competitionIndex: number): KeywordIdea['potential'] {
  // High volume + lower competition = higher opportunity.
  const score = Math.log10(Math.max(10, volume)) * 25 - competitionIndex * 0.5;
  return score > 55 ? 'גבוה' : score > 35 ? 'בינוני' : 'נמוך';
}

function buildTrend(seed: number, base: number): { month: string; volume: number }[] {
  const now = new Date();
  const out: { month: string; volume: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const wobble = 0.7 + (((seed >> i) & 7) / 7) * 0.6; // 0.7..1.3
    out.push({ month: `${HE_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, volume: Math.round(base * wobble) });
  }
  return out;
}

/** Hebrew/Generic modifiers used to expand a seed into idea variants (mock). */
const MODIFIERS = ['', 'מחיר', 'מומלץ', 'הזמנה', 'אונליין', 'בישראל', 'איכותי', 'זול', 'מקצועי', 'ביקורות', 'השוואה', 'חנות', 'קרוב אליי', 'הטוב ביותר', 'לעסקים'];

function mockIdeas(seed: string, limit: number): KeywordIdea[] {
  const base = hash(seed);
  const ideas: KeywordIdea[] = [];
  for (let i = 0; i < Math.min(limit, MODIFIERS.length); i++) {
    const kw = (MODIFIERS[i] ? `${seed} ${MODIFIERS[i]}` : seed).trim();
    const h = hash(kw);
    const volume = [12100, 6600, 3600, 2400, 1900, 1600, 1300, 880, 720, 590, 480, 390, 320, 260, 210][i] || (50 + (h % 1500));
    const competitionIndex = 30 + (h % 70);
    const competition: Competition = competitionIndex > 66 ? 'HIGH' : competitionIndex > 33 ? 'MEDIUM' : 'LOW';
    const cpcLow = Math.round((0.4 + (h % 120) / 100) * 100) / 100;
    const cpcHigh = Math.round((cpcLow + 0.8 + (h % 200) / 100) * 100) / 100;
    ideas.push({ keyword: kw, volume, competition, competitionIndex, cpcLow, cpcHigh, potential: potentialOf(volume, competitionIndex), trend: buildTrend(base + i, volume) });
  }
  return ideas.sort((a, b) => b.volume - a.volume);
}

export async function getKeywordIdeas(seed: string, country = 'Israel', language = 'Hebrew', limit = 100): Promise<{ ideas: KeywordIdea[]; mock: boolean; reason?: string }> {
  const s = (seed || '').trim();
  if (!s) return { ideas: [], mock: true, reason: 'no_seed' };

  if (!keywordProviderConfigured()) {
    return { ideas: mockIdeas(s, limit), mock: true, reason: 'no_credentials' };
  }

  const auth = 'Basic ' + Buffer.from(`${DFS_LOGIN()}:${DFS_PASS()}`).toString('base64');
  const locationCode = /israel|ישראל/i.test(country) ? 2376 : 2840; // 2376=Israel, 2840=US
  const languageCode = /hebrew|עברית|he/i.test(language) ? 'he' : 'en';

  // Try multiple DataForSEO endpoints in order — whichever the account has access to.
  // 1) Google Ads "keywords for keywords" (flat items)
  // 2) DataForSEO Labs "keyword ideas" (nested keyword_info)
  const attempts: Array<{ url: string; body: any; parse: (it: any) => KeywordIdea | null }> = [
    {
      url: 'https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live',
      body: [{ keywords: [s], location_code: locationCode, language_code: languageCode }],
      parse: (it: any) => {
        if (!it?.keyword) return null;
        const volume = it.search_volume || 0;
        const compIdx = Math.round((it.competition_index ?? (it.competition === 'HIGH' ? 80 : it.competition === 'MEDIUM' ? 50 : 20)) || 0);
        const competition: Competition = compIdx > 66 ? 'HIGH' : compIdx > 33 ? 'MEDIUM' : 'LOW';
        const ms = (it.monthly_searches || []).slice(-12).map((m: any) => ({ month: `${HE_MONTHS[(m.month || 1) - 1]} ${String(m.year || '').slice(2)}`, volume: m.search_volume || 0 }));
        return { keyword: it.keyword, volume, competition, competitionIndex: compIdx, cpcLow: Math.round((it.low_top_of_page_bid ?? it.cpc ?? 0) * 100) / 100, cpcHigh: Math.round((it.high_top_of_page_bid ?? it.cpc ?? 0) * 100) / 100, potential: potentialOf(volume, compIdx), trend: ms.length ? ms : buildTrend(hash(it.keyword), volume) };
      },
    },
    {
      url: 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live',
      body: [{ keywords: [s], location_code: locationCode, language_code: languageCode, limit }],
      parse: (it: any) => {
        const ki = it?.keyword_info || {};
        const kw = it?.keyword;
        if (!kw) return null;
        const volume = ki.search_volume || 0;
        const compIdx = Math.round((ki.competition != null ? ki.competition * 100 : (ki.competition_level === 'HIGH' ? 80 : ki.competition_level === 'MEDIUM' ? 50 : 20)) || 0);
        const competition: Competition = compIdx > 66 ? 'HIGH' : compIdx > 33 ? 'MEDIUM' : 'LOW';
        const ms = (ki.monthly_searches || []).slice(-12).map((m: any) => ({ month: `${HE_MONTHS[(m.month || 1) - 1]} ${String(m.year || '').slice(2)}`, volume: m.search_volume || 0 }));
        return { keyword: kw, volume, competition, competitionIndex: compIdx, cpcLow: Math.round((ki.low_top_of_page_bid ?? ki.cpc ?? 0) * 100) / 100, cpcHigh: Math.round((ki.high_top_of_page_bid ?? ki.cpc ?? 0) * 100) / 100, potential: potentialOf(volume, compIdx), trend: ms.length ? ms : buildTrend(hash(kw), volume) };
      },
    },
  ];

  let reason = 'unknown';
  for (const attempt of attempts) {
    try {
      const r = await fetch(attempt.url, {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt.body), signal: AbortSignal.timeout(25000),
      });
      const j = await r.json().catch(() => ({}));
      const task = j?.tasks?.[0];
      try { console.log(`[keyword-research] ${attempt.url.split('/v3/')[1]} → http=${r.status} status=${j?.status_code} "${j?.status_message}" task=${task?.status_code} "${task?.status_message}"`); } catch { /* */ }

      if (r.status === 401) { reason = 'auth_failed: שם משתמש/סיסמת API שגויים'; break; }
      if (r.status === 402 || j?.status_code === 40200) { reason = 'payment_required: החשבון לא מאומת/ממומן ב-DataForSEO'; break; }
      if (j?.status_code && j.status_code !== 20000) reason = `api_error: ${j.status_message || j.status_code}`;
      if (task?.status_code && task.status_code !== 20000) reason = `task_error: ${task.status_message || task.status_code}`;

      // Labs nests items under result[0].items; Google Ads puts them directly in result[].
      const result = task?.result || [];
      const rawItems = Array.isArray(result?.[0]?.items) ? result[0].items : result;
      const ideas = (Array.isArray(rawItems) ? rawItems : []).map(attempt.parse).filter(Boolean).slice(0, limit) as KeywordIdea[];
      if (ideas.length) return { ideas, mock: false };
      if (reason === 'unknown') reason = 'no_results: לא נמצאו ביטויים לזרע הזה';
    } catch (e) {
      reason = `request_failed: ${e instanceof Error ? e.message : 'שגיאת רשת'}`;
    }
    // If it was an auth/payment problem, no point trying the next endpoint.
    if (reason.startsWith('auth_failed') || reason.startsWith('payment_required')) break;
  }
  console.warn('[keyword-research] all DataForSEO attempts failed, using mock. reason:', reason);
  return { ideas: mockIdeas(s, limit), mock: true, reason };
}
