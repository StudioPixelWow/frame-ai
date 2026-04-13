/**
 * Storage module — environment-driven adapter selection.
 *
 * Environment variables:
 *
 *   STORAGE_PROVIDER=local     (default — no vars needed for dev)
 *   STORAGE_PROVIDER=s3|r2     (production — requires AWS/R2 credentials)
 *
 * See s3-adapter.ts for the full list of env vars needed in production.
 */

export type { StorageAdapter, UploadOptions, ListEntry } from "./adapter";
export { StorageKeys } from "./keys";

import type { StorageAdapter } from "./adapter";
import { LocalStorageAdapter } from "./local-adapter";

function createStorage(): StorageAdapter {
  const provider = process.env.STORAGE_PROVIDER ?? "local";

  if (provider === "s3" || provider === "r2") {
    // Lazy-require to avoid pulling in @aws-sdk in dev
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3StorageAdapter } = require("./s3-adapter");
    return new S3StorageAdapter({
      region: process.env.STORAGE_REGION ?? "auto",
      endpoint: process.env.STORAGE_ENDPOINT,
      accessKeyId: process.env.STORAGE_ACCESS_KEY!,
      secretAccessKey: process.env.STORAGE_SECRET_KEY!,
      bucket: process.env.STORAGE_BUCKET!,
      publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL,
    });
  }

  // Default: local filesystem for development
  return new LocalStorageAdapter();
}

/** Singleton storage instance — import this everywhere. */
export const storage = createStorage();
