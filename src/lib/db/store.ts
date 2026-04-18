import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DATA_DIR } from './paths';

/* ══════════════════════════════════════════════════════════════════════════
   Supabase client — temporary production-safe setup
   ══════════════════════════════════════════════════════════════════════════ */

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://uaruggdabeyiuppcvbbi.supabase.co';

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Supabase env check', {
    hasNextPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    startsWithHttp: typeof url === 'string' ? url.startsWith('http') : false,
    preview: typeof url === 'string' ? url.slice(0, 30) : null,
  });

  if (!url) {
    throw new Error('Missing Supabase URL');
  }

  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  _supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabase;
}

/* ══════════════════════════════════════════════════════════════════════════
   Auto-create table helper — runs CREATE TABLE IF NOT EXISTS via rpc
   ══════════════════════════════════════════════════════════════════════════ */

const _ensuredTables = new Set<string>();

export async function ensureTable(table: string, ddl: string): Promise<void> {
  if (_ensuredTables.has(table)) return;
  const sb = getSupabase();

  try {
    const { error } = await sb.rpc('exec_sql', { query: ddl });
    if (error && !error.message.includes('already exists')) {
      console.warn(`[ensureTable] Could not auto-create "${table}":`, error.message);
      console.warn(`[ensureTable] Create it manually:\n${ddl}`);
    } else {
      // Notify PostgREST to reload its schema cache so the new table is immediately visible
      try {
        await sb.rpc('exec_sql', { query: "NOTIFY pgrst, 'reload schema';" });
      } catch {
        // Non-fatal — schema cache will refresh on its own eventually
      }
    }
  } catch {
    // rpc function doesn't exist — non-fatal
  }

  _ensuredTables.add(table);
}

/**
 * Check if a table exists in Supabase by attempting a lightweight query.
 * Returns true if the table is accessible, false if schema cache miss or table missing.
 */
export async function tableExistsInCache(tableName: string): Promise<boolean> {
  try {
    const sb = getSupabase();
    const { error } = await sb.from(tableName).select('id').limit(0);
    if (error && (error.message.includes('schema cache') || error.message.includes('does not exist') || error.message.includes('relation'))) {
      return false;
    }
    return !error;
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   JsonStore — fallback for routes not yet migrated to Supabase
   In production on Vercel use /tmp, locally use DATA_DIR
   ══════════════════════════════════════════════════════════════════════════ */

const RUNTIME_DATA_DIR =
  process.env.VERCEL || process.env.NODE_ENV === 'production'
    ? '/tmp/.frameai/data'
    : DATA_DIR;

export class JsonStore<T extends { id: string }> {
  private filePath: string;
  private prefix: string;
  private seq = 0;

  private collection: string;

  constructor(collection: string, prefix: string) {
    this.collection = collection;
    this.filePath = path.join(RUNTIME_DATA_DIR, `${collection}.json`);
    this.prefix = prefix;
    this.initializeSequence();
    this.ensureFile();
  }

  private ensureFile(): void {
    if (!fs.existsSync(RUNTIME_DATA_DIR)) {
      fs.mkdirSync(RUNTIME_DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private initializeSequence(): void {
    try {
      const data = this.read();
      if (data.length > 0) {
        const sequences = data
          .map((item) => {
            const match = item.id.match(new RegExp(`^${this.prefix}_(\\d+)$`));
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((num) => !isNaN(num));

        this.seq = sequences.length > 0 ? Math.max(...sequences) : 0;
      }
    } catch {
      this.seq = 0;
    }
  }

  private read(): T[] {
    try {
      this.ensureFile();
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private write(data: T[]): void {
    this.ensureFile();
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private generateId(): string {
    this.seq += 1;
    return `${this.prefix}_${this.seq}`;
  }

  getAll(): T[] {
    return this.read();
  }

  getById(id: string): T | null {
    const data = this.read();
    return data.find((item) => item.id === id) || null;
  }

  create(data: Omit<T, 'id'>): T {
    const id = this.generateId();
    const newItem = { ...data, id } as T;
    const all = this.read();
    all.push(newItem);
    this.write(all);
    console.log(`[JsonStore][${this.collection}] CREATE id=${id} (total: ${all.length}) ⚠️ EPHEMERAL on Vercel`);
    return newItem;
  }

  update(id: string, data: Partial<T>): T | null {
    const all = this.read();
    const index = all.findIndex((item) => item.id === id);

    if (index === -1) {
      console.warn(`[JsonStore][${this.collection}] UPDATE id=${id} NOT FOUND`);
      return null;
    }

    const updated = { ...all[index], ...data };
    all[index] = updated;
    this.write(all);
    console.log(`[JsonStore][${this.collection}] UPDATE id=${id} keys=[${Object.keys(data).join(',')}] ⚠️ EPHEMERAL on Vercel`);
    return updated;
  }

  delete(id: string): boolean {
    const all = this.read();
    const index = all.findIndex((item) => item.id === id);

    if (index === -1) {
      console.warn(`[JsonStore][${this.collection}] DELETE id=${id} NOT FOUND`);
      return false;
    }

    all.splice(index, 1);
    this.write(all);
    console.log(`[JsonStore][${this.collection}] DELETE id=${id} (remaining: ${all.length}) ⚠️ EPHEMERAL on Vercel`);
    return true;
  }

  query(predicate: (item: T) => boolean): T[] {
    return this.read().filter(predicate);
  }

  count(): number {
    return this.read().length;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   SupabaseCrud — drop-in replacement for JsonStore that persists to Supabase

   Uses a generic (id TEXT, data JSONB) pattern per table so:
   - No camelCase↔snake_case mapping needed
   - Exact same API as JsonStore (getAll, getById, create, update, delete, query)
   - Data is stored durably — survives deploys and cold starts

   Each module gets its own Supabase table. The `data` column holds the full
   entity JSON. The `id` column is extracted for efficient lookups.
   ══════════════════════════════════════════════════════════════════════════ */

const _tableInitPromises = new Map<string, Promise<void>>();

export class SupabaseCrud<T extends { id: string }> {
  private tableName: string;
  private prefix: string; // kept for backward compat, no longer used for ID generation

  constructor(tableName: string, prefix: string) {
    this.tableName = tableName;
    this.prefix = prefix;
    // Trigger table creation in background (non-blocking)
    this.ensureTableExists();
  }

  /** Create the table if it doesn't exist.
   *  Uses UUID for new tables; pre-existing tables keep their schema. */
  private ensureTableExists(): Promise<void> {
    if (_tableInitPromises.has(this.tableName)) {
      return _tableInitPromises.get(this.tableName)!;
    }

    const ddl = `
      CREATE TABLE IF NOT EXISTS public.${this.tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    const promise = ensureTable(this.tableName, ddl);
    _tableInitPromises.set(this.tableName, promise);
    return promise;
  }

  /** Convert a DB row {id, data, created_at, updated_at} back to T */
  private rowToEntity(row: { id: string; data: unknown }): T {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return { ...data, id: row.id } as T;
  }

  getAll(): T[] {
    // Synchronous-looking wrapper that blocks on the async call
    // We need to return T[] synchronously to match JsonStore's API.
    // In Next.js API routes, this actually works because the routes are async.
    throw new Error(
      `[SupabaseCrud][${this.tableName}] Use getAllAsync() instead of getAll(). ` +
      `SupabaseCrud requires async calls.`
    );
  }

  async getAllAsync(): Promise<T[]> {
    await this.ensureTableExists();
    const sb = getSupabase();
    const { data: rows, error } = await sb
      .from(this.tableName)
      .select('id, data')
      .order('created_at', { ascending: true });

    if (error) {
      // Schema cache miss — force table re-creation and retry once
      if (error.message.includes('schema cache') || error.message.includes('does not exist') || error.message.includes('relation')) {
        console.warn(`[SupabaseCrud][${this.tableName}] Schema cache miss, forcing re-create and retry...`);
        _tableInitPromises.delete(this.tableName);
        _ensuredTables.delete(this.tableName);
        await this.ensureTableExists();
        // Brief delay for schema cache to propagate
        await new Promise(r => setTimeout(r, 500));
        const retry = await sb.from(this.tableName).select('id, data').order('created_at', { ascending: true });
        if (retry.error) {
          console.error(`[SupabaseCrud][${this.tableName}] getAllAsync retry still failed:`, retry.error.message);
          throw new Error(`Failed to fetch from ${this.tableName}: ${retry.error.message}`);
        }
        console.log(`[SupabaseCrud][${this.tableName}] SELECT (retry) → ${retry.data?.length ?? 0} rows ✅ DURABLE`);
        return (retry.data ?? []).map((r: { id: string; data: unknown }) => this.rowToEntity(r));
      }

      console.error(`[SupabaseCrud][${this.tableName}] getAllAsync error:`, error.message);
      throw new Error(`Failed to fetch from ${this.tableName}: ${error.message}`);
    }

    console.log(`[SupabaseCrud][${this.tableName}] SELECT → ${rows?.length ?? 0} rows ✅ DURABLE`);
    return (rows ?? []).map((r: { id: string; data: unknown }) => this.rowToEntity(r));
  }

  getById(id: string): T | null {
    throw new Error(
      `[SupabaseCrud][${this.tableName}] Use getByIdAsync() instead of getById().`
    );
  }

  async getByIdAsync(id: string): Promise<T | null> {
    await this.ensureTableExists();
    const sb = getSupabase();
    const { data: row, error } = await sb
      .from(this.tableName)
      .select('id, data')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseCrud][${this.tableName}] getByIdAsync error:`, error.message);
      return null;
    }

    if (!row) return null;
    return this.rowToEntity(row as { id: string; data: unknown });
  }

  create(item: Omit<T, 'id'>): T {
    throw new Error(
      `[SupabaseCrud][${this.tableName}] Use createAsync() instead of create().`
    );
  }

  async createAsync(item: Omit<T, 'id'>): Promise<T> {
    await this.ensureTableExists();

    const now = new Date().toISOString();
    // Build entity without id — DB will generate UUID
    const entityWithoutId = { ...item, createdAt: now, updatedAt: now };

    const sb = getSupabase();
    const { data: inserted, error } = await sb
      .from(this.tableName)
      .insert({
        // Do NOT send id — let Postgres gen_random_uuid() handle it
        data: JSON.parse(JSON.stringify(entityWithoutId)),
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.error(`[SupabaseCrud][${this.tableName}] createAsync error:`, error?.message);
      throw new Error(`Failed to create in ${this.tableName}: ${error?.message ?? 'no row returned'}`);
    }

    const id = (inserted as { id: string }).id;
    const entity = { ...entityWithoutId, id } as unknown as T;

    // Also store the id inside the data JSONB so rowToEntity works consistently
    await sb
      .from(this.tableName)
      .update({ data: JSON.parse(JSON.stringify(entity)) })
      .eq('id', id);

    console.log(`[SupabaseCrud][${this.tableName}] INSERT id=${id} ✅ DURABLE (DB-generated UUID)`);
    return entity;
  }

  update(id: string, partial: Partial<T>): T | null {
    throw new Error(
      `[SupabaseCrud][${this.tableName}] Use updateAsync() instead of update().`
    );
  }

  async updateAsync(id: string, partial: Partial<T>): Promise<T | null> {
    await this.ensureTableExists();
    const sb = getSupabase();

    // Fetch existing
    const existing = await this.getByIdAsync(id);
    if (!existing) {
      console.warn(`[SupabaseCrud][${this.tableName}] UPDATE id=${id} NOT FOUND`);
      return null;
    }

    const now = new Date().toISOString();
    const merged = { ...existing, ...partial, id, updatedAt: now } as T;

    const { error } = await sb
      .from(this.tableName)
      .update({
        data: JSON.parse(JSON.stringify(merged)),
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      console.error(`[SupabaseCrud][${this.tableName}] updateAsync error:`, error.message);
      throw new Error(`Failed to update ${this.tableName}/${id}: ${error.message}`);
    }

    console.log(`[SupabaseCrud][${this.tableName}] UPDATE id=${id} keys=[${Object.keys(partial).join(',')}] ✅ DURABLE`);
    return merged;
  }

  delete(id: string): boolean {
    throw new Error(
      `[SupabaseCrud][${this.tableName}] Use deleteAsync() instead of delete().`
    );
  }

  async deleteAsync(id: string): Promise<boolean> {
    await this.ensureTableExists();
    const sb = getSupabase();

    const { error, count } = await sb
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[SupabaseCrud][${this.tableName}] deleteAsync error:`, error.message);
      return false;
    }

    console.log(`[SupabaseCrud][${this.tableName}] DELETE id=${id} ✅ DURABLE`);
    return true;
  }

  query(predicate: (item: T) => boolean): T[] {
    throw new Error(
      `[SupabaseCrud][${this.tableName}] Use queryAsync() instead of query().`
    );
  }

  async queryAsync(predicate: (item: T) => boolean): Promise<T[]> {
    const all = await this.getAllAsync();
    return all.filter(predicate);
  }

  async countAsync(): Promise<number> {
    const all = await this.getAllAsync();
    return all.length;
  }
}