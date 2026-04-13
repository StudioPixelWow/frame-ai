/**
 * LocalStorageAdapter — filesystem-backed adapter for development and CI.
 *
 * Files are written to ./data/storage/ relative to the project root.
 * The API server should mount a static route at /files/ to serve them.
 */

import fs from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import type { StorageAdapter, UploadOptions, ListEntry } from "./adapter";

const BASE = path.resolve("./data/storage");
const BASE_URL =
  process.env.STORAGE_BASE_URL ?? "http://localhost:3001/files";

export class LocalStorageAdapter implements StorageAdapter {
  private fullPath(key: string): string {
    const resolved = path.resolve(BASE, key);
    if (!resolved.startsWith(BASE)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return resolved;
  }

  async put(
    key: string,
    body: Buffer | NodeJS.ReadableStream,
    _opts: UploadOptions,
  ): Promise<{ key: string }> {
    const filePath = this.fullPath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    if (Buffer.isBuffer(body)) {
      await fs.writeFile(filePath, body);
    } else {
      await pipeline(body, createWriteStream(filePath));
    }

    return { key };
  }

  async getUrl(key: string, _ttl?: number): Promise<string> {
    // No TTL in local dev — files are permanent
    return `${BASE_URL}/${key}`;
  }

  async getUploadUrl(
    key: string,
    _contentType: string,
    _maxBytes: number,
  ): Promise<{ url: string; method: "PUT" | "POST" }> {
    // In local dev, direct PUT to the API upload endpoint
    return {
      url: `http://localhost:3001/api/storage/${key}`,
      method: "PUT" as const,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.fullPath(key));
    } catch {
      /* already gone */
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.fullPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<ListEntry[]> {
    const dir = this.fullPath(prefix);
    try {
      const entries = await fs.readdir(dir, {
        withFileTypes: true,
        recursive: true,
      });
      return entries
        .filter((e) => e.isFile())
        .map((e) => ({
          key: path.join(prefix, e.name),
          size: 0, // stat on demand if needed
          updatedAt: new Date(),
        }));
    } catch {
      return [];
    }
  }
}
