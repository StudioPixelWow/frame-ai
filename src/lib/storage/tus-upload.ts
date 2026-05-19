/**
 * Lightweight TUS resumable-upload client for Supabase Storage.
 *
 * Implements the core TUS v1.0.0 protocol using plain fetch — no tus-js-client
 * dependency required. Designed for large video files (up to 24 GB).
 *
 * Supabase TUS endpoint: POST to create, PATCH to send chunks, HEAD to resume.
 */

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface TusUploadOptions {
  /** Progress callback: percent 0-100, speed in bytes/sec, eta in seconds. */
  onProgress?: (percent: number, speed: number, eta: number) => void;
  /** Called on unrecoverable error (after retries exhausted). */
  onError?: (err: Error) => void;
  /** Called when upload completes. `url` is the public Supabase Storage URL. */
  onSuccess?: (url: string) => void;
  /** Custom metadata key-value pairs sent via Upload-Metadata header. */
  metadata?: Record<string, string>;
  /** Override default chunk size (bytes). Default 6 MB (Supabase default). */
  chunkSize?: number;
  /** Max retry attempts per chunk. Default 3. */
  maxRetries?: number;
}

interface StoredUploadState {
  uploadUrl: string;
  bucket: string;
  path: string;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
}

/* ── Constants ─────────────────────────────────────────────────────────── */

const DEFAULT_CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff
const TUS_VERSION = '1.0.0';

/* ── Helpers ───────────────────────────────────────────────────────────── */

function storageKey(bucket: string, path: string): string {
  return `tus_upload_${bucket}_${path}`;
}

function encodeMetadataValue(value: string): string {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(value)));
  return Buffer.from(value, 'utf-8').toString('base64');
}

function buildMetadataHeader(meta: Record<string, string>): string {
  return Object.entries(meta)
    .map(([k, v]) => `${k} ${encodeMetadataValue(v)}`)
    .join(',');
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ── TusUploader ───────────────────────────────────────────────────────── */

export class TusUploader {
  private supabaseUrl: string;
  private supabaseAnonKey: string;
  private tusEndpoint: string;

  private abortController: AbortController | null = null;
  private cancelled = false;

  // Current upload state (set during upload / resume)
  private currentFile: File | null = null;
  private currentBucket: string = '';
  private currentPath: string = '';
  private currentOptions: TusUploadOptions = {};

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    // Strip trailing slash
    this.supabaseUrl = supabaseUrl.replace(/\/$/, '');
    this.supabaseAnonKey = supabaseAnonKey;
    this.tusEndpoint = `${this.supabaseUrl}/storage/v1/upload/resumable`;
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  /**
   * Upload a file to Supabase Storage using the TUS resumable protocol.
   */
  async upload(
    file: File,
    bucket: string,
    path: string,
    options: TusUploadOptions = {},
  ): Promise<string> {
    this.cancelled = false;
    this.abortController = new AbortController();
    this.currentFile = file;
    this.currentBucket = bucket;
    this.currentPath = path;
    this.currentOptions = options;

    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const maxRetries = options.maxRetries ?? MAX_RETRIES;

    try {
      // 1. Create the TUS upload (POST)
      const uploadUrl = await this.createUpload(file, bucket, path, options);

      // Persist state for resume
      this.saveState({
        uploadUrl,
        bucket,
        path,
        fileName: file.name,
        fileSize: file.size,
        fileLastModified: file.lastModified,
      });

      // 2. Upload chunks (PATCH)
      const publicUrl = await this.uploadChunks(
        file,
        uploadUrl,
        0,
        chunkSize,
        maxRetries,
        options,
      );

      // 3. Cleanup persisted state
      this.clearState(bucket, path);

      options.onSuccess?.(publicUrl);
      return publicUrl;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!this.cancelled) {
        options.onError?.(error);
      }
      throw error;
    }
  }

  /**
   * Resume a previously interrupted upload.
   * The file must be the same (name + size + lastModified must match).
   */
  async resume(file: File, bucket: string, path: string, options: TusUploadOptions = {}): Promise<string> {
    this.cancelled = false;
    this.abortController = new AbortController();
    this.currentFile = file;
    this.currentBucket = bucket;
    this.currentPath = path;
    this.currentOptions = options;

    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const maxRetries = options.maxRetries ?? MAX_RETRIES;

    const stored = this.loadState(bucket, path);
    if (!stored) {
      throw new Error('No resumable upload found for this file. Use upload() instead.');
    }

    // Verify file identity
    if (
      file.name !== stored.fileName ||
      file.size !== stored.fileSize ||
      file.lastModified !== stored.fileLastModified
    ) {
      this.clearState(bucket, path);
      throw new Error('File has changed since the upload started. Starting fresh is required.');
    }

    try {
      // HEAD to find current offset
      const offset = await this.getOffset(stored.uploadUrl);

      const publicUrl = await this.uploadChunks(
        file,
        stored.uploadUrl,
        offset,
        chunkSize,
        maxRetries,
        options,
      );

      this.clearState(bucket, path);
      options.onSuccess?.(publicUrl);
      return publicUrl;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!this.cancelled) {
        options.onError?.(error);
      }
      throw error;
    }
  }

  /**
   * Cancel the current upload.
   */
  cancel(): void {
    this.cancelled = true;
    this.abortController?.abort();
  }

  /**
   * Check if a resumable upload exists for the given bucket/path.
   */
  hasResumableUpload(bucket: string, path: string): boolean {
    return this.loadState(bucket, path) !== null;
  }

  /* ── TUS Protocol Implementation ──────────────────────────────────── */

  /**
   * POST — Create a new TUS upload resource.
   * Returns the upload URL from the Location header.
   */
  private async createUpload(
    file: File,
    bucket: string,
    path: string,
    options: TusUploadOptions,
  ): Promise<string> {
    const metadata: Record<string, string> = {
      bucketName: bucket,
      objectName: path,
      contentType: file.type || 'application/octet-stream',
      ...(options.metadata ?? {}),
    };

    const response = await fetch(this.tusEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.supabaseAnonKey}`,
        'Tus-Resumable': TUS_VERSION,
        'Upload-Length': String(file.size),
        'Upload-Metadata': buildMetadataHeader(metadata),
        'x-upsert': 'true',
      },
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`TUS create failed (${response.status}): ${body}`);
    }

    const location = response.headers.get('Location');
    if (!location) {
      throw new Error('TUS create response missing Location header');
    }

    // Location may be relative or absolute
    if (location.startsWith('http')) return location;
    return `${this.supabaseUrl}${location}`;
  }

  /**
   * HEAD — Get the current offset of an existing upload.
   */
  private async getOffset(uploadUrl: string): Promise<number> {
    const response = await fetch(uploadUrl, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${this.supabaseAnonKey}`,
        'Tus-Resumable': TUS_VERSION,
      },
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(`TUS HEAD failed (${response.status})`);
    }

    const offset = response.headers.get('Upload-Offset');
    return offset ? parseInt(offset, 10) : 0;
  }

  /**
   * PATCH loop — Send file data in chunks starting from `startOffset`.
   * Returns the public URL of the completed upload.
   */
  private async uploadChunks(
    file: File,
    uploadUrl: string,
    startOffset: number,
    chunkSize: number,
    maxRetries: number,
    options: TusUploadOptions,
  ): Promise<string> {
    let offset = startOffset;
    const totalSize = file.size;
    const startTime = Date.now();
    let bytesAtStart = offset;

    while (offset < totalSize) {
      if (this.cancelled) throw new Error('Upload cancelled');

      const end = Math.min(offset + chunkSize, totalSize);
      const chunk = file.slice(offset, end);
      const chunkBuffer = await chunk.arrayBuffer();

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (this.cancelled) throw new Error('Upload cancelled');

        try {
          const response = await fetch(uploadUrl, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${this.supabaseAnonKey}`,
              'Tus-Resumable': TUS_VERSION,
              'Upload-Offset': String(offset),
              'Content-Type': 'application/offset+octet-stream',
            },
            body: chunkBuffer,
            signal: this.abortController?.signal,
          });

          if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`TUS PATCH failed (${response.status}): ${body}`);
          }

          const newOffset = response.headers.get('Upload-Offset');
          if (newOffset) {
            offset = parseInt(newOffset, 10);
          } else {
            offset = end;
          }

          lastError = null;
          break; // chunk succeeded
        } catch (err) {
          if (this.cancelled) throw new Error('Upload cancelled');
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < maxRetries) {
            const delay = RETRY_DELAYS[attempt] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
            await sleep(delay);
          }
        }
      }

      if (lastError) {
        throw lastError;
      }

      // Report progress
      if (options.onProgress) {
        const elapsed = (Date.now() - startTime) / 1000 || 0.001;
        const bytesUploaded = offset - bytesAtStart;
        const speed = bytesUploaded / elapsed; // bytes/sec
        const remaining = totalSize - offset;
        const eta = speed > 0 ? remaining / speed : 0;
        const percent = Math.round((offset / totalSize) * 100);

        options.onProgress(percent, speed, eta);
      }
    }

    // Build public URL
    return `${this.supabaseUrl}/storage/v1/object/public/${this.currentBucket}/${this.currentPath}`;
  }

  /* ── localStorage persistence ─────────────────────────────────────── */

  private saveState(state: StoredUploadState): void {
    try {
      const key = storageKey(state.bucket, state.path);
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable (SSR, quota); silently ignore
    }
  }

  private loadState(bucket: string, path: string): StoredUploadState | null {
    try {
      const key = storageKey(bucket, path);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as StoredUploadState;
    } catch {
      return null;
    }
  }

  private clearState(bucket: string, path: string): void {
    try {
      localStorage.removeItem(storageKey(bucket, path));
    } catch {
      // ignore
    }
  }
}
