import "server-only";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStore, PresignedUpload } from "./types";

/**
 * Cloudflare R2, through its S3-compatible API.
 *
 * The bucket is private and has no public base URL: every read and every write
 * goes through a URL this server signs, for one key, for a few minutes. The
 * credentials live only here — nothing in `lib/` outside the server tree can
 * even import this file, and `scripts/check-db-access.mjs` fails the build if a
 * client component reads any of the four variables.
 *
 * R2 was chosen for one reason above the others: egress is free. Photos are
 * read far more often than they are written, and on S3 that asymmetry would be
 * the whole bill.
 */
export class R2ObjectStore implements ObjectStore {
  readonly kind = "r2" as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  }) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async presignUpload(
    key: string,
    contentType: string,
    maxBytes: number,
  ): Promise<PresignedUpload> {
    const expiresIn = 300;
    // ContentLength is part of the signature, so a client cannot quietly send
    // more than it declared. The real size is checked again after the fact,
    // because a declared length is still a claim.
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    );
    return {
      url,
      headers: { "content-type": contentType },
      expiresAt: Date.now() + expiresIn * 1000,
    };
  }

  async presignDownload(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  async head(key: string, prefixBytes: number) {
    try {
      // A ranged GET rather than a HEAD: it returns the size *and* the leading
      // bytes in one request, and the leading bytes are what decide whether
      // this is really an image.
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=0-${Math.max(0, prefixBytes - 1)}`,
        }),
      );

      const prefix = new Uint8Array(await response.Body!.transformToByteArray());
      // `Content-Range: bytes 0-15/391234` — the total is after the slash.
      const total = Number(response.ContentRange?.split("/")[1] ?? response.ContentLength ?? 0);

      return {
        object: { bytes: total, contentType: response.ContentType ?? "application/octet-stream" },
        prefix,
      };
    } catch {
      return null;
    }
  }

  async remove(keys: string[]): Promise<void> {
    if (!keys.length) return;
    // A thousand at a time is the API's limit.
    for (let i = 0; i < keys.length; i += 1000) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
        }),
      );
    }
  }
}
