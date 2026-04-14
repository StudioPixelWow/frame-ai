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
    }
  } catch {
    // rpc function doesn't exist — non-fatal
  }

  _ensuredTables.add(table);
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

  constructor(collection: string, prefix: string) {
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
    return newItem;
  }

  update(id: string, data: Partial<T>): T | null {
    const all = this.read();
    const index = all.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    const updated = { ...all[index], ...data };
    all[index] = updated;
    this.write(all);
    return updated;
  }

  delete(id: string): boolean {
    const all = this.read();
    const index = all.findIndex((item) => item.id === id);

    if (index === -1) {
      return false;
    }

    all.splice(index, 1);
    this.write(all);
    return true;
  }

  query(predicate: (item: T) => boolean): T[] {
    return this.read().filter(predicate);
  }

  count(): number {
    return this.read().length;
  }
}