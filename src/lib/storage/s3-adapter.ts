/**
 * S3StorageAdapter — production adapter for AWS S3 and Cloudflare R2.
 *
 * R2 is S3-compatible; the same adapter serves both.
 * Only the endpoint URL differs (STORAGE_ENDPOINT env var).
 *
 * Required packages: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner
 * Install when deploying to production:
 *   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */

import type { StorageAdapter, UploadOptions, ListEntry } from "./adapter";

// Dynamic import to avoid hard dependency in dev
let S3Client: any;
let PutObjectCommand: any;
let DeleteObjectCommand: any;
let HeadObjectCommand: any;
let ListObjectsV2Command: any;
let getSignedUrl: any;

async function loadS3SDK() {
  if (S3Client) return;
  const clientMod = await import("@aws-sdk/client-s3");
  const presignerMod = await import("@aws-sdk/s3-request-presigner");
  S3Client = clientMod.S3Client;
  PutObjectCommand = clientMod.PutObjectCommand;
  DeleteObjectCommand = clientMod.DeleteObjectCommand;
  HeadObjectCommand = clientMod.HeadObjectCommand;
  ListObjectsV2Command = clientMod.ListObjectsV2Command;
  getSignedUrl = presignerMod.getSignedUrl;
}

export interface S3AdapterOptions {
  region: string;
  endpoint?: string; // set for R2: 'https://<acct>.r2.cloudflarestorage.com'
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string; // e.g. 'https://cdn.pixelmanageai.com'
}

export class S3StorageAdapter implements StorageAdapter {
  private client: any;
  private bucket: string;
  private publicBaseUrl?: string;
  private initPromise: Promise<void>;

  constructor(private opts: S3AdapterOptions) {
    this.bucket = opts.bucket;
    this.publicBaseUrl = opts.publicBaseUrl;
    this.initPromise = this.init();
  }

  private async init() {
    await loadS3SDK();
    this.client = new S3Client({
      region: this.opts.region,
      endpoint: this.opts.endpoint,
      credentials: {
        accessKeyId: this.opts.accessKeyId,
        secretAccessKey: this.opts.secretAccessKey,
      },
      forcePathStyle: !!this.opts.endpoint,
    });
  }

  private async ready() {
    await this.initPromise;
  }

  async put(
    key: string,
    body: Buffer | NodeJS.ReadableStream,
    opts: UploadOptions,
  ): Promise<{ key: string }> {
    await this.ready();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: opts.contentType,
        ContentLength: opts.contentLength,
        Metadata: opts.metadata,
      }),
    );
    return { key };
  }

  async getUrl(key: string, ttlSeconds = 3600): Promise<string> {
    await this.ready();
    if (this.publicBaseUrl && ttlSeconds === 0) {
      return `${this.publicBaseUrl}/${key}`;
    }
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  async getUploadUrl(
    key: string,
    contentType: string,
    _maxBytes: number,
  ): Promise<{ url: string; method: "PUT" | "POST" }> {
    await this.ready();
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 300 }, // 5-minute window for client uploads
    );
    return { url, method: "PUT" as const };
  }

  async delete(key: string): Promise<void> {
    await this.ready();
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      /* not found — ok */
    }
  }

  async exists(key: string): Promise<boolean> {
    await this.ready();
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<ListEntry[]> {
    await this.ready();
    const result = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix }),
    );
    return (result.Contents ?? []).map((obj: any) => ({
      key: obj.Key!,
      size: obj.Size ?? 0,
      updatedAt: obj.LastModified ?? new Date(),
    }));
  }
}
