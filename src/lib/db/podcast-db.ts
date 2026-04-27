/**
 * Podcast Strategy Database — proper relational tables
 *
 * Tables:
 *   podcast_strategies — main strategy record with real columns
 *   podcast_questions  — questions linked to strategy
 *   podcast_clips      — clip ideas linked to strategy
 *
 * Auto-creates tables on first use via exec_sql RPC.
 * Falls back gracefully if RPC is unavailable.
 */

import { getSupabase } from './store';

/* ── DDL ── */

const DDL_STRATEGIES = `
CREATE TABLE IF NOT EXISTS public.podcast_strategies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT,
  client_id       TEXT,
  client_name     TEXT,
  episode_type    TEXT,
  goals           TEXT[] DEFAULT '{}',
  target_audience TEXT DEFAULT '',
  persona         JSONB DEFAULT '{}',
  episode_structure JSONB,
  strategy_summary TEXT DEFAULT '',
  tone            TEXT DEFAULT 'casual',
  hooks           TEXT[] DEFAULT '{}',
  status          TEXT DEFAULT 'draft',
  use_real_ai     BOOLEAN DEFAULT false,
  client_approved BOOLEAN DEFAULT false,
  client_approved_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_podcast_strategies_session ON public.podcast_strategies(session_id);
CREATE INDEX IF NOT EXISTS idx_podcast_strategies_client  ON public.podcast_strategies(client_id);
`;

const DDL_QUESTIONS = `
CREATE TABLE IF NOT EXISTS public.podcast_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id   UUID REFERENCES public.podcast_strategies(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'open',
  score         INT DEFAULT 50,
  labels        TEXT[] DEFAULT '{}',
  selected      BOOLEAN DEFAULT true,
  order_index   INT DEFAULT 0,
  status        TEXT DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_podcast_questions_strategy ON public.podcast_questions(strategy_id);
`;

const DDL_CLIPS = `
CREATE TABLE IF NOT EXISTS public.podcast_clips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id   UUID REFERENCES public.podcast_strategies(id) ON DELETE CASCADE,
  question_id   TEXT,
  title         TEXT DEFAULT '',
  hook          TEXT DEFAULT '',
  caption_idea  TEXT DEFAULT '',
  platform_fit  TEXT[] DEFAULT '{}',
  duration      INT DEFAULT 0,
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_podcast_clips_strategy ON public.podcast_clips(strategy_id);
`;

/* ── Auto-migration state ── */

let _tablesReady: boolean | null = null;
let _migrationPromise: Promise<boolean> | null = null;

/**
 * Ensure all podcast tables exist. Auto-creates them via exec_sql.
 * Caches result — only runs once per process lifecycle.
 */
export async function ensurePodcastTables(): Promise<boolean> {
  if (_tablesReady === true) return true;
  if (_migrationPromise) return _migrationPromise;

  _migrationPromise = _doMigration();
  _tablesReady = await _migrationPromise;
  _migrationPromise = null;
  return _tablesReady;
}

async function _doMigration(): Promise<boolean> {
  const sb = getSupabase();

  // Quick check: is the main table already accessible?
  try {
    const { error } = await sb.from('podcast_strategies').select('id').limit(0);
    if (!error) {
      console.log('[podcast-db] Tables already exist');
      return true;
    }
  } catch {}

  // Try to create tables via exec_sql
  for (const ddl of [DDL_STRATEGIES, DDL_QUESTIONS, DDL_CLIPS]) {
    try {
      const { error } = await sb.rpc('exec_sql', { query: ddl });
      if (error) {
        console.warn('[podcast-db] exec_sql failed:', error.message);
        // If exec_sql RPC doesn't exist, we can't auto-create
        if (error.message.includes('function') || error.message.includes('could not find')) {
          console.error('[podcast-db] exec_sql RPC not available. Tables must be created manually in Supabase SQL editor.');
          console.error('[podcast-db] Run this SQL:\n' + DDL_STRATEGIES + DDL_QUESTIONS + DDL_CLIPS);
          return false;
        }
      }
    } catch (e) {
      console.error('[podcast-db] Migration error:', e);
      return false;
    }
  }

  // Refresh PostgREST schema cache
  try {
    await sb.rpc('exec_sql', { query: "NOTIFY pgrst, 'reload schema';" });
  } catch {}

  // Wait for schema cache to refresh
  await new Promise(r => setTimeout(r, 1000));

  // Verify
  try {
    const { error } = await sb.from('podcast_strategies').select('id').limit(0);
    if (!error) {
      console.log('[podcast-db] All podcast tables created successfully');
      return true;
    }
    console.warn('[podcast-db] Tables created but not yet accessible. Schema cache may need more time.');
    return true; // Optimistically return true — the cache will catch up
  } catch {
    return false;
  }
}

/* ── CRUD: Strategies ── */

export interface StrategyRow {
  id: string;
  session_id: string | null;
  client_id: string | null;
  client_name: string | null;
  episode_type: string | null;
  goals: string[];
  target_audience: string | null;
  persona: Record<string, unknown>;
  episode_structure: Record<string, unknown> | null;
  strategy_summary: string | null;
  tone: string | null;
  hooks: string[];
  status: string;
  use_real_ai: boolean;
  client_approved: boolean;
  client_approved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Map API camelCase body → DB snake_case row */
function bodyToRow(body: Record<string, unknown>): Record<string, unknown> {
  return {
    session_id: body.sessionId ?? null,
    client_id: body.clientId ?? null,
    client_name: body.clientName ?? null,
    episode_type: body.episodeType ?? null,
    goals: body.goals ?? [],
    target_audience: body.targetAudience ?? '',
    persona: body.persona ?? {},
    episode_structure: body.episodeStructure ?? null,
    strategy_summary: body.strategySummary ?? '',
    tone: (body.persona as any)?.tone ?? 'casual',
    hooks: body.hooks ?? [],
    status: body.status ?? 'draft',
    use_real_ai: body.useRealAI ?? false,
    client_approved: body.clientApproved ?? false,
    client_approved_at: body.clientApprovedAt ?? null,
  };
}

/** Map DB row → API camelCase response (including nested questions + clips) */
function rowToApi(row: Record<string, unknown>, questions?: Record<string, unknown>[], clips?: Record<string, unknown>[]): Record<string, unknown> {
  return {
    id: row.id,
    sessionId: row.session_id,
    clientId: row.client_id,
    clientName: row.client_name,
    episodeType: row.episode_type,
    goals: row.goals ?? [],
    targetAudience: row.target_audience ?? '',
    persona: row.persona ?? {},
    episodeStructure: row.episode_structure ?? null,
    strategySummary: row.strategy_summary ?? '',
    tone: row.tone ?? 'casual',
    hooks: row.hooks ?? [],
    status: row.status ?? 'draft',
    useRealAI: row.use_real_ai ?? false,
    clientApproved: row.client_approved ?? false,
    clientApprovedAt: row.client_approved_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questions: (questions ?? []).map(q => ({
      id: q.id,
      text: q.question_text,
      type: q.question_type ?? 'open',
      score: q.score ?? 50,
      labels: q.labels ?? [],
      selected: q.selected ?? true,
      order: q.order_index ?? 0,
      status: q.status ?? 'pending',
    })),
    clipIdeas: (clips ?? []).map(c => ({
      questionId: c.question_id ?? '',
      clipTitle: c.title ?? '',
      hookLine: c.hook ?? '',
      captionIdea: c.caption_idea ?? '',
      platformFit: c.platform_fit ?? [],
    })),
  };
}

/** Get all strategies with nested questions and clips */
export async function getAllStrategies(): Promise<Record<string, unknown>[]> {
  const sb = getSupabase();
  const { data: rows, error } = await sb
    .from('podcast_strategies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[podcast-db] getAllStrategies error:', error.message);
    return [];
  }

  if (!rows || rows.length === 0) return [];

  // Batch-fetch questions and clips for all strategies
  const ids = rows.map(r => r.id);
  const [qRes, cRes] = await Promise.all([
    sb.from('podcast_questions').select('*').in('strategy_id', ids).order('order_index'),
    sb.from('podcast_clips').select('*').in('strategy_id', ids),
  ]);

  const questionsByStrategy = new Map<string, Record<string, unknown>[]>();
  const clipsByStrategy = new Map<string, Record<string, unknown>[]>();

  for (const q of (qRes.data ?? [])) {
    const sid = q.strategy_id;
    if (!questionsByStrategy.has(sid)) questionsByStrategy.set(sid, []);
    questionsByStrategy.get(sid)!.push(q);
  }
  for (const c of (cRes.data ?? [])) {
    const sid = c.strategy_id;
    if (!clipsByStrategy.has(sid)) clipsByStrategy.set(sid, []);
    clipsByStrategy.get(sid)!.push(c);
  }

  return rows.map(r => rowToApi(r, questionsByStrategy.get(r.id), clipsByStrategy.get(r.id)));
}

/** Get single strategy by ID with nested data */
export async function getStrategyById(id: string): Promise<Record<string, unknown> | null> {
  const sb = getSupabase();
  const { data: row, error } = await sb
    .from('podcast_strategies')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !row) return null;

  const [qRes, cRes] = await Promise.all([
    sb.from('podcast_questions').select('*').eq('strategy_id', id).order('order_index'),
    sb.from('podcast_clips').select('*').eq('strategy_id', id),
  ]);

  return rowToApi(row, qRes.data ?? [], cRes.data ?? []);
}

/** Create strategy + nested questions/clips */
export async function createStrategy(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const sb = getSupabase();
  const row = bodyToRow(body);

  const { data: inserted, error } = await sb
    .from('podcast_strategies')
    .insert(row)
    .select('*')
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to insert podcast strategy: ${error?.message ?? 'no row'}`);
  }

  const strategyId = inserted.id;

  // Insert questions
  const questions = (body.questions as any[]) ?? [];
  if (questions.length > 0) {
    const qRows = questions.map((q, i) => ({
      strategy_id: strategyId,
      question_text: q.text ?? q.question_text ?? '',
      question_type: q.type ?? q.question_type ?? 'open',
      score: q.score ?? 50,
      labels: q.labels ?? [],
      selected: q.selected ?? true,
      order_index: q.order ?? q.order_index ?? i,
      status: q.status ?? 'pending',
    }));
    const { error: qErr } = await sb.from('podcast_questions').insert(qRows);
    if (qErr) console.warn('[podcast-db] Failed to insert questions:', qErr.message);
  }

  // Insert clips
  const clips = (body.clipIdeas as any[]) ?? [];
  if (clips.length > 0) {
    const cRows = clips.map(c => ({
      strategy_id: strategyId,
      question_id: c.questionId ?? '',
      title: c.clipTitle ?? c.title ?? '',
      hook: c.hookLine ?? c.hook ?? '',
      caption_idea: c.captionIdea ?? c.caption_idea ?? '',
      platform_fit: c.platformFit ?? c.platform_fit ?? [],
    }));
    const { error: cErr } = await sb.from('podcast_clips').insert(cRows);
    if (cErr) console.warn('[podcast-db] Failed to insert clips:', cErr.message);
  }

  // Re-fetch with nested data
  return (await getStrategyById(strategyId)) ?? { ...body, id: strategyId };
}

/** Update strategy + replace questions/clips */
export async function updateStrategy(id: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const sb = getSupabase();
  const row = bodyToRow(body);
  row.updated_at = new Date().toISOString();

  const { error } = await sb
    .from('podcast_strategies')
    .update(row)
    .eq('id', id);

  if (error) {
    console.error('[podcast-db] updateStrategy error:', error.message);
    return null;
  }

  // Replace questions if provided
  if (body.questions !== undefined) {
    await sb.from('podcast_questions').delete().eq('strategy_id', id);
    const questions = (body.questions as any[]) ?? [];
    if (questions.length > 0) {
      const qRows = questions.map((q, i) => ({
        strategy_id: id,
        question_text: q.text ?? q.question_text ?? '',
        question_type: q.type ?? q.question_type ?? 'open',
        score: q.score ?? 50,
        labels: q.labels ?? [],
        selected: q.selected ?? true,
        order_index: q.order ?? q.order_index ?? i,
        status: q.status ?? 'pending',
      }));
      await sb.from('podcast_questions').insert(qRows);
    }
  }

  // Replace clips if provided
  if (body.clipIdeas !== undefined) {
    await sb.from('podcast_clips').delete().eq('strategy_id', id);
    const clips = (body.clipIdeas as any[]) ?? [];
    if (clips.length > 0) {
      const cRows = clips.map(c => ({
        strategy_id: id,
        question_id: c.questionId ?? '',
        title: c.clipTitle ?? c.title ?? '',
        hook: c.hookLine ?? c.hook ?? '',
        caption_idea: c.captionIdea ?? c.caption_idea ?? '',
        platform_fit: c.platformFit ?? c.platform_fit ?? [],
      }));
      await sb.from('podcast_clips').insert(cRows);
    }
  }

  return getStrategyById(id);
}

/** Delete strategy (cascades to questions + clips via FK) */
export async function deleteStrategy(id: string): Promise<boolean> {
  const sb = getSupabase();
  const { error } = await sb
    .from('podcast_strategies')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[podcast-db] deleteStrategy error:', error.message);
    return false;
  }
  return true;
}
