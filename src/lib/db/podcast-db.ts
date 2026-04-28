/**
 * Podcast Strategy Database
 *
 * Two-tier persistence:
 *   1. Relational tables (podcast_strategies, podcast_questions, podcast_clips)
 *      — best schema, auto-created via exec_sql if available
 *   2. Fallback: app_podcast_strategies (SupabaseCrud, id + data JSONB)
 *      — always works, even without exec_sql RPC
 *
 * The route handler NEVER returns 503. Data is always saved.
 */

import { getSupabase } from './store';
import { podcastStrategies as podcastCrud } from './collections';

/* ── DDL for relational tables ── */

const DDL = `
CREATE TABLE IF NOT EXISTS public.podcast_strategies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT,
  client_id       TEXT,
  client_name     TEXT,
  episode_type    TEXT,
  goals           JSONB DEFAULT '[]',
  target_audience TEXT DEFAULT '',
  persona         JSONB DEFAULT '{}',
  episode_structure JSONB,
  strategy_summary TEXT DEFAULT '',
  tone            TEXT DEFAULT 'casual',
  hooks           JSONB DEFAULT '[]',
  status          TEXT DEFAULT 'draft',
  selected_questions JSONB DEFAULT '[]',
  all_questions   JSONB DEFAULT '[]',
  clip_ideas      JSONB DEFAULT '[]',
  use_real_ai     BOOLEAN DEFAULT false,
  client_approved BOOLEAN DEFAULT false,
  client_approved_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ps_session ON public.podcast_strategies(session_id);
CREATE INDEX IF NOT EXISTS idx_ps_client  ON public.podcast_strategies(client_id);
`;

/* ── Migration state ── */

type StorageMode = 'relational' | 'jsonb' | null;
let _mode: StorageMode = null;
let _modePromise: Promise<StorageMode> | null = null;

/**
 * Detect which storage mode is available.
 * Tries relational first, falls back to JSONB.
 * Result is cached — runs once per process.
 */
async function detectMode(): Promise<StorageMode> {
  if (_mode) return _mode;
  if (_modePromise) return _modePromise;

  _modePromise = _detect();
  _mode = await _modePromise;
  _modePromise = null;
  return _mode;
}

async function _detect(): Promise<StorageMode> {
  const sb = getSupabase();

  // 1. Check if relational table already exists
  try {
    const { error } = await sb.from('podcast_strategies').select('id').limit(0);
    if (!error) {
      console.log('[podcast-db] Using relational table podcast_strategies');
      return 'relational';
    }
  } catch {}

  // 2. Try to create relational table via exec_sql
  try {
    const { error } = await sb.rpc('exec_sql', { query: DDL });
    if (!error) {
      // Refresh PostgREST cache
      await sb.rpc('exec_sql', { query: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});
      await new Promise(r => setTimeout(r, 800));

      // Verify
      const { error: verifyErr } = await sb.from('podcast_strategies').select('id').limit(0);
      if (!verifyErr) {
        console.log('[podcast-db] Created relational table podcast_strategies');
        return 'relational';
      }
      // Created but not yet in cache — try relational optimistically
      console.log('[podcast-db] Table created, schema cache may need time. Using relational.');
      return 'relational';
    }
    // exec_sql failed — might not exist
    if (error.message.includes('function') || error.message.includes('could not find')) {
      console.warn('[podcast-db] exec_sql RPC unavailable — falling back to JSONB table');
    }
  } catch {}

  // 3. Fallback: use existing SupabaseCrud JSONB table
  console.log('[podcast-db] Using JSONB fallback table app_podcast_strategies');
  return 'jsonb';
}

/**
 * Ensure storage is ready. Always returns true — never blocks saves.
 */
export async function ensurePodcastTables(): Promise<boolean> {
  await detectMode();
  return true; // ALWAYS true — we have at least JSONB fallback
}

/* ── Helpers ── */

function bodyToRow(body: Record<string, unknown>): Record<string, unknown> {
  const questions = (body.questions as any[]) ?? [];
  const selectedQuestions = questions.filter((q: any) => q.selected !== false);

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
    selected_questions: selectedQuestions,
    all_questions: questions,
    clip_ideas: body.clipIdeas ?? [],
    use_real_ai: body.useRealAI ?? false,
    client_approved: body.clientApproved ?? false,
    client_approved_at: body.clientApprovedAt ?? null,
  };
}

function rowToApi(row: Record<string, unknown>): Record<string, unknown> {
  // Works for both relational rows and JSONB-extracted objects
  return {
    id: row.id,
    sessionId: row.session_id ?? row.sessionId,
    clientId: row.client_id ?? row.clientId,
    clientName: row.client_name ?? row.clientName,
    episodeType: row.episode_type ?? row.episodeType,
    goals: row.goals ?? [],
    targetAudience: row.target_audience ?? row.targetAudience ?? '',
    persona: row.persona ?? {},
    episodeStructure: row.episode_structure ?? row.episodeStructure ?? null,
    strategySummary: row.strategy_summary ?? row.strategySummary ?? '',
    tone: row.tone ?? 'casual',
    hooks: row.hooks ?? [],
    status: row.status ?? 'draft',
    useRealAI: row.use_real_ai ?? row.useRealAI ?? false,
    clientApproved: row.client_approved ?? row.clientApproved ?? false,
    clientApprovedAt: row.client_approved_at ?? row.clientApprovedAt ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    questions: row.all_questions ?? row.questions ?? [],
    selectedQuestions: row.selected_questions ?? row.selectedQuestions ?? [],
    clipIdeas: row.clip_ideas ?? row.clipIdeas ?? [],
  };
}

/* ── CRUD: Relational mode ── */

async function _relGetAll(): Promise<Record<string, unknown>[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('podcast_strategies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[podcast-db] relational getAllStrategies error:', error.message);
    return [];
  }
  return (data ?? []).map(rowToApi);
}

async function _relGetById(id: string): Promise<Record<string, unknown> | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('podcast_strategies')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return rowToApi(data);
}

async function _relCreate(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const sb = getSupabase();
  const row = bodyToRow(body);

  const { data: inserted, error } = await sb
    .from('podcast_strategies')
    .insert(row)
    .select('*')
    .single();

  if (error || !inserted) {
    throw new Error(`Insert failed: ${error?.message ?? 'no row'}`);
  }

  console.log(`[podcast-db] Created strategy ${inserted.id} (relational)`);
  return rowToApi(inserted);
}

async function _relUpdate(id: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const sb = getSupabase();
  const row = bodyToRow(body);
  row.updated_at = new Date().toISOString();

  const { error } = await sb
    .from('podcast_strategies')
    .update(row)
    .eq('id', id);

  if (error) {
    console.error('[podcast-db] relational update error:', error.message);
    return null;
  }
  return _relGetById(id);
}

async function _relDelete(id: string): Promise<boolean> {
  const sb = getSupabase();
  const { error } = await sb.from('podcast_strategies').delete().eq('id', id);
  if (error) {
    console.error('[podcast-db] relational delete error:', error.message);
    return false;
  }
  return true;
}

/* ── CRUD: JSONB fallback mode ── */

async function _jsonbGetAll(): Promise<Record<string, unknown>[]> {
  const items = await podcastCrud.getAllAsync();
  return items.map(i => rowToApi(i as unknown as Record<string, unknown>));
}

async function _jsonbGetById(id: string): Promise<Record<string, unknown> | null> {
  const item = await podcastCrud.getByIdAsync(id);
  if (!item) return null;
  return rowToApi(item as unknown as Record<string, unknown>);
}

async function _jsonbCreate(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const payload = {
    ...body,
    createdAt: now,
    updatedAt: now,
    status: body.status ?? 'draft',
  };
  const created = await podcastCrud.createAsync(payload as any);
  console.log(`[podcast-db] Created strategy ${created.id} (JSONB fallback)`);
  return rowToApi(created as unknown as Record<string, unknown>);
}

async function _jsonbUpdate(id: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const updated = await podcastCrud.updateAsync(id, {
    ...body,
    updatedAt: new Date().toISOString(),
  } as any);
  if (!updated) return null;
  return rowToApi(updated as unknown as Record<string, unknown>);
}

async function _jsonbDelete(id: string): Promise<boolean> {
  return podcastCrud.deleteAsync(id);
}

/* ── Public API — auto-selects storage mode ── */

export async function getAllStrategies(): Promise<Record<string, unknown>[]> {
  const mode = await detectMode();
  if (mode === 'relational') {
    try { return await _relGetAll(); }
    catch (e) { console.warn('[podcast-db] relational getAll failed, trying JSONB:', e); }
  }
  return _jsonbGetAll();
}

export async function getStrategyById(id: string): Promise<Record<string, unknown> | null> {
  const mode = await detectMode();
  if (mode === 'relational') {
    try { return await _relGetById(id); }
    catch (e) { console.warn('[podcast-db] relational getById failed, trying JSONB:', e); }
  }
  return _jsonbGetById(id);
}

export async function createStrategy(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const mode = await detectMode();
  if (mode === 'relational') {
    try { return await _relCreate(body); }
    catch (e) {
      console.warn('[podcast-db] relational create failed, falling back to JSONB:', e);
      // Switch mode for future calls
      _mode = 'jsonb';
    }
  }
  return _jsonbCreate(body);
}

export async function updateStrategy(id: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const mode = await detectMode();
  if (mode === 'relational') {
    try { return await _relUpdate(id, body); }
    catch (e) { console.warn('[podcast-db] relational update failed, trying JSONB:', e); }
  }
  return _jsonbUpdate(id, body);
}

export async function deleteStrategy(id: string): Promise<boolean> {
  const mode = await detectMode();
  if (mode === 'relational') {
    try { return await _relDelete(id); }
    catch (e) { console.warn('[podcast-db] relational delete failed, trying JSONB:', e); }
  }
  return _jsonbDelete(id);
}

/* ── Exported types for backward compat ── */

export interface StrategyRow {
  id: string;
  session_id: string | null;
  client_id: string | null;
  client_name: string | null;
  goals: unknown;
  selected_questions: unknown;
  all_questions: unknown;
  created_at: string;
  updated_at: string;
}
