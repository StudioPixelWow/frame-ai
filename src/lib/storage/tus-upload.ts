/**
 * TUS resumable-upload client for Supabase Storage.
 *
 * Uses tus-js-client for the TUS v1.0.0 protocol. Designed for large video
 * files (up to 24 GB).
 *
 * Supabase TUS endpoint: ${supabaseUrl}/storage/v1/upload/resumable
 */

import * as tus from 'tus-js-client';

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

/* ── Constants ─────────────────────────────────────────────────────────── */

const DEFAULT_CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB
const MAX_RETRIES = 3;

/* ── TusUploader ───────────────────────────────────────────────────────── */

export class TusUploader {
  private supabaseUrl: string;
  private supabaseAnonKey: string;
  private tusEndpoint: string;

  private currentUpload: tus.Upload | null = null;
  private currentBucket: string = '';
  private currentPath: string = '';

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
    this.currentBucket = bucket;
    this.currentPath = path;

    return new Promise<string>((resolve, reject) => {
      const startTime = Date.now();

      const upload = new tus.Upload(file, {
        endpoint: this.tusEndpoint,
        retryDelays: this.buildRetryDelays(options.maxRetries ?? MAX_RETRIES),
        chunkSize: options.chunkSize ?? DEFAULT_CHUNK_SIZE,
        headers: {
          Authorization: `Bearer ${this.supabaseAnonKey}`,
          'x-upsert': 'true',
        },
        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: file.type || 'application/octet-stream',
          ...(options.metadata ?? {}),
        },
        removeFingerprintOnSuccess: true,

        onError: (err: Error) => {
          options.onError?.(err);
          reject(err);
        },

        onProgress: (bytesUploaded: number, bytesTotal: number) => {
          if (!options.onProgress) return;

          const percent = Math.round((bytesUploaded / bytesTotal) * 100);
          const elapsed = (Date.now() - startTime) / 1000 || 0.001;
          const speed = bytesUploaded / elapsed;
          const remaining = bytesTotal - bytesUploaded;
          const eta = speed > 0 ? remaining / speed : 0;

          options.onProgress(percent, speed, eta);
        },

        onSuccess: () => {
          const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
          options.onSuccess?.(publicUrl);
          resolve(publicUrl);
        },
      });

      this.currentUpload = upload;
      upload.start();
    });
  }

  /**
   * Resume a previously interrupted upload.
   * The file must be the same (fingerprint must match the original upload).
   */
  async resume(
    file: File,
    bucket: string,
    path: string,
    options: TusUploadOptions = {},
  ): Promise<string> {
    this.currentBucket = bucket;
    this.currentPath = path;

    return new Promise<string>((resolve, reject) => {
      const startTime = Date.now();

      const upload = new tus.Upload(file, {
        endpoint: this.tusEndpoint,
        retryDelays: this.buildRetryDelays(options.maxRetries ?? MAX_RETRIES),
        chunkSize: options.chunkSize ?? DEFAULT_CHUNK_SIZE,
        headers: {
          Authorization: `Bearer ${this.supabaseAnonKey}`,
          'x-upsert': 'true',
        },
        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: file.type || 'application/octet-stream',
          ...(options.metadata ?? {}),
        },
        removeFingerprintOnSuccess: true,

        onError: (err: Error) => {
          options.onError?.(err);
          reject(err);
        },

        onProgress: (bytesUploaded: number, bytesTotal: number) => {
          if (!options.onProgress) return;

          const percent = Math.round((bytesUploaded / bytesTotal) * 100);
          const elapsed = (Date.now() - startTime) / 1000 || 0.001;
          const speed = bytesUploaded / elapsed;
          const remaining = bytesTotal - bytesUploaded;
          const eta = speed > 0 ? remaining / speed : 0;

          options.onProgress(percent, speed, eta);
        },

        onSuccess: () => {
          const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
          options.onSuccess?.(publicUrl);
          resolve(publicUrl);
        },
      });

      this.currentUpload = upload;

      // Use tus-js-client's built-in resume: findPreviousUploads checks
      // the fingerprint store for a matching prior upload URL.
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      }).catch((err) => {
        const error = err instanceof Error
          ? err
          : new Error('שגיאה בחיפוש העלאה קודמת לחידוש');
        options.onError?.(error);
        reject(error);
      });
    });
  }

  /**
   * Cancel the current upload.
   */
  cancel(): void {
    if (this.currentUpload) {
      this.currentUpload.abort(true);
      this.currentUpload = null;
    }
  }

  /**
   * Check if a resumable upload exists for the given bucket/path.
   * Creates a temporary tus.Upload to query the fingerprint store.
   */
  hasResumableUpload(bucket: string, path: string): boolean {
    // tus-js-client stores fingerprints in localStorage by default.
    // We check for any keys that match the tus fingerprint pattern.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('tus::') && key.includes(this.tusEndpoint)) {
          const value = localStorage.getItem(key);
          if (value && value.includes(bucket) && value.includes(path)) {
            return true;
          }
        }
      }
    } catch {
      // localStorage may be unavailable (SSR); silently ignore
    }
    return false;
  }

  /* ── Private helpers ─────────────────────────────────────────────── */

  /**
   * Build exponential backoff retry delays array for tus-js-client.
   */
  private buildRetryDelays(maxRetries: number): number[] {
    const delays: number[] = [];
    for (let i = 0; i < maxRetries; i++) {
      delays.push(Math.min(1000 * Math.pow(2, i), 8000));
    }
    return delays;
  }
}
