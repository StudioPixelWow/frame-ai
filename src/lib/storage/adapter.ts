/**
 * StorageAdapter — abstraction layer for all file I/O.
 *
 * The rest of the codebase never calls a cloud SDK directly. This keeps
 * the API server and workers environment-agnostic and makes local
 * development work without any cloud credentials.
 */

export interface UploadOptions {
  contentType: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}

export interface ListEntry {
  key: string;
  size: number;
  updatedAt: Date;
}

export interface StorageAdapter {
  /**
   * Write a file. Returns the stable storage key.
   * The key is what gets persisted in the DB — never the URL.
   */
  put(
    key: string,
    body: Buffer | NodeJS.ReadableStream,
    opts: UploadOptions,
  ): Promise<{ key: string }>;

  /**
   * Generate a time-limited URL for reading a file.
   * Default TTL: 3600 s (1 hour). Pass 0 for a permanent public URL
   * (only valid on public-access buckets used for rendered outputs in production).
   */
  getUrl(key: string, ttlSeconds?: number): Promise<string>;

  /**
   * Generate a pre-signed URL that lets the client upload directly to
   * storage without routing through the API server. Avoids doubling
   * bandwidth cost.
   */
  getUploadUrl(
    key: string,
    contentType: string,
    maxBytes: number,
  ): Promise<{
    url: string;
    method: "PUT" | "POST";
    fields?: Record<string, string>;
  }>;

  /** Delete a single file. Resolves silently if the key does not exist. */
  delete(key: string): Promise<void>;

  /** Returns true if the key exists in storage. */
  exists(key: string): Promise<boolean>;

  /** List all keys under a prefix. Used by the cleanup job. */
  list(prefix: string): Promise<ListEntry[]>;
}
