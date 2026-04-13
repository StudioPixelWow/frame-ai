import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DATA_DIR } from './paths';

/* ══════════════════════════════════════════════════════════════════════════
   Supabase client — used by migrated routes (clients, etc.)
   ══════════════════════════════════════════════════════════════════════════ */

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
    );
  }

  _supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
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
  // Use Supabase's ability to run raw SQL via the rpc endpoint.
  // Requires the "exec_sql" function — if it doesn't exist, the error is non-fatal.
  try {
    const { error } = await sb.rpc('exec_sql', { query: ddl });
    if (error && !error.message.includes('already exists')) {
      console.warn(`[ensureTable] Could not auto-create "${table}":`, error.message);
      console.warn(`[ensureTable] Create it manually:\n${ddl}`);
    }
  } catch {
    // rpc function doesn't exist — that's OK, table may already be there
  }
  _ensuredTables.add(table);
}

/* ══════════════════════════════════════════════════════════════════════════
   JsonStore — file-based fallback for routes not yet migrated to Supabase
   ══════════════════════════════════════════════════════════════════════════ */

export class JsonStore<T extends { id: string }> {
  private filePath: string;
  private prefix: string;
  private seq: number = 0;

  constructor(collection: string, prefix: string) {
    this.filePath = path.join(DATA_DIR, `${collection}.json`);
    this.prefix = prefix;
    this.initializeSequence();
    this.ensureFile();
  }

  private ensureFile(): void {
    // Create directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Create file if it doesn't exist
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private initializeSequence(): void {
    try {
      const data = this.read();
      if (data.length > 0) {
        // Extract the highest sequence number from existing IDs
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
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private write(data: T[]): void {
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
    const data = this.read();
    return data.filter(predicate);
  }

  count(): number {
    return this.read().length;
  }
}
