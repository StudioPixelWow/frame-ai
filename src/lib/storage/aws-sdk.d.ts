/**
 * Stub type declarations for @aws-sdk packages.
 * These are dynamically imported at runtime only when S3/R2 storage is configured.
 * The actual packages are installed in production but not in the dev/build environment.
 */
declare module "@aws-sdk/client-s3" {
  export class S3Client {
    constructor(config: any);
    send(command: any): Promise<any>;
  }
  export class PutObjectCommand {
    constructor(input: any);
  }
  export class DeleteObjectCommand {
    constructor(input: any);
  }
  export class HeadObjectCommand {
    constructor(input: any);
  }
  export class ListObjectsV2Command {
    constructor(input: any);
  }
}

declare module "@aws-sdk/s3-request-presigner" {
  export function getSignedUrl(client: any, command: any, options?: any): Promise<string>;
}
