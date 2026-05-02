/**
 * Auto-add missing columns to the "tasks" table.
 * Follows the same pattern as ensureBusinessProjectColumns().
 * Runs once per process lifetime — safe to call from multiple routes.
 *
 * Required columns that may be missing:
 *   - notes          TEXT DEFAULT ''
 *   - client_name    TEXT DEFAULT ''
 *   - priority       TEXT DEFAULT 'medium'
 *   - due_date       TEXT
 *   - description    TEXT DEFAULT ''
 *   - gantt_item_id  TEXT
 */

import { getSupabase } from './store';

const TABLE = 'tasks';
let _done = false;

/** Columns that the tasks API reads/writes but may not exist in the DB yet. */
const REQUIRED_COLUMNS = [
  { name: 'notes',          def: "TEXT DEFAULT ''" },
  { name: 'client_name',    def: "TEXT DEFAULT ''" },
  { name: 'priority',       def: "TEXT DEFAULT 'medium'" },
  { name: 'due_date',       def: 'TEXT' },
  { name: 'description',    def: "TEXT DEFAULT ''" },
  { name: 'gantt_item_id',  def: 'TEXT' },
];

/** Probe which columns actually exist in the table right now. */
async function probeColumns(): Promise<Set<string>> {
  const sb = getSupabase();
  const present = new Set<string>();
  for (const col of REQUIRED_COLUMNS) {
    const { error } = await sb.from(TABLE).select(col.name).limit(1);
    if (!error) present.add(col.name);
  }
  return present;
}

/**
 * Ensure every REQUIRED_COLUMNS entry exists in `public.tasks`.
 * Call at the top of GET / POST / PUT handlers — it short-circuits after the
 * first successful run.
 *
 * Returns the set of column names that are confirmed present so callers can
 * exclude missing columns from their payloads if migration failed.
 */
export async function ensureTaskColumns(): Promise<Set<string>> {
  if (_done) return new Set(REQUIRED_COLUMNS.map(c => c.name));

  try {
    const present = await probeColumns();
    const missing = REQUIRED_COLUMNS.filter(c => !present.has(c.name));

    if (missing.length === 0) {
      _done = true;
      return present;
    }

    console.warn(
      `[ensureTaskColumns] Missing columns in "${TABLE}":`,
      missing.map(c => c.name).join(', '),
      '— attempting migration',
    );

    const sb = getSupabase();

    // Try combined ALTER first
    const alterClauses = missing
      .map(col => `ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`)
      .join(', ');
    const ddl = `ALTER TABLE public.${TABLE} ${alterClauses}; NOTIFY pgrst, 'reload schema';`;

    const { error: rpcErr } = await sb.rpc('exec_sql', { query: ddl });

    if (rpcErr) {
      // Fall back to one-by-one
      console.warn('[ensureTaskColumns] combined ALTER failed:', rpcErr.message, '— trying individually');
      for (const col of missing) {
        const singleDdl =
          `ALTER TABLE public.${TABLE} ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}; ` +
          `NOTIFY pgrst, 'reload schema';`;
        const { error: singleErr } = await sb.rpc('exec_sql', { query: singleDdl });
        if (singleErr && !singleErr.message.includes('already exists')) {
          console.warn(`[ensureTaskColumns] failed to add ${col.name}:`, singleErr.message);
        }
      }
    }

    // Verify
    const afterMigration = await probeColumns();
    const stillMissing = REQUIRED_COLUMNS.filter(c => !afterMigration.has(c.name));

    if (stillMissing.length > 0) {
      console.error(
        `[ensureTaskColumns] STILL missing after migration: ${stillMissing.map(c => c.name).join(', ')}.\n` +
        `Run this SQL manually in Supabase SQL Editor:\n\n` +
        stillMissing.map(c => `  ALTER TABLE public.${TABLE} ADD COLUMN IF NOT EXISTS ${c.name} ${c.def};`).join('\n') +
        `\n  NOTIFY pgrst, 'reload schema';\n`,
      );
      // Don't set _done — retry next request
      return afterMigration;
    }

    _done = true;
    console.log('[ensureTaskColumns] all columns verified for', TABLE);
    return afterMigration;
  } catch (err) {
    console.warn('[ensureTaskColumns] unexpected error:', err);
    // Return a probe so callers can at least exclude bad columns
    try { return await probeColumns(); } catch { return new Set<string>(); }
  }
}

/**
 * Filter an object to only include keys whose corresponding DB column
 * is confirmed present. Used by toInsert / toUpdate to avoid INSERT/UPDATE
 * failures when migration hasn't run yet.
 */
export function filterByPresent(
  row: Record<string, unknown>,
  presentCols: Set<string>,
  /** Columns that ALWAYS exist (core schema) — never filtered out */
  coreColumns: string[] = ['id', 'title', 'assignee_id', 'project_id', 'business_project_id', 'milestone_id', 'status', 'created_at', 'updated_at', 'client_id'],
): Record<string, unknown> {
  const core = new Set(coreColumns);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (core.has(k) || presentCols.has(k)) {
      out[k] = v;
    }
  }
  return out;
}
