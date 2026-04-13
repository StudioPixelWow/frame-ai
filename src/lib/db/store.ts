import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths';

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
