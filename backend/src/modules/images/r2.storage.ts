import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { env, isStorageConfigured, storageEndpoint } from "../../config/env.ts";

/**
 * Object storage for crop photographs, over the S3 API.
 *
 * Why not Supabase Storage or Postgres bytea:
 *   - Postgres bytea burns the 500MB free database quota on binary data that
 *     is never queried, only served.
 *   - Supabase Storage's free tier caps egress at 5GB/month. A crop-history
 *     screen re-displays the same photos every visit, so egress - not storage
 *     - is the quota that actually bites.
 *
 * Two backends, one API:
 *
 *   - **MinIO**, for local development and for deployments without a cloud
 *     account. Runs from docker-compose, stores on local disk, costs nothing.
 *   - **Cloudflare R2**, for production. Zero egress at any volume, which is
 *     the property that matters here; the 10GB free storage is a bonus.
 *
 * Both speak S3, so the AWS SDK covers both and the only difference is the
 * endpoint and address style. Nothing below this line is vendor-specific.
 */

let client: S3Client | null = null;

const getClient = (): S3Client => {
  if (!isStorageConfigured()) {
    throw new Error(
      "Object storage is not configured. Set S3_ENDPOINT (MinIO) or R2_ACCOUNT_ID (Cloudflare R2), " +
        "plus R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY."
    );
  }

  if (!client) {
    client = new S3Client({
      // R2 has no regions and MinIO ignores them, but the SDK insists on one.
      // "auto" is R2's answer and MinIO accepts anything.
      region: process.env.S3_REGION ?? "auto",
      endpoint: storageEndpoint(),
      forcePathStyle: env.s3ForcePathStyle,
      credentials: {
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey,
      },
    });
  }

  return client;
};

/**
 * Client used only to sign browser-facing URLs. A presigned URL embeds its
 * host in the signature, so it has to be signed for the host the browser will
 * actually call, not the one the backend uses internally.
 */
let signingClient: S3Client | null = null;

const getSigningClient = (): S3Client => {
  if (!env.s3PublicEndpoint) return getClient();

  if (!signingClient) {
    signingClient = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: env.s3PublicEndpoint,
      forcePathStyle: env.s3ForcePathStyle,
      credentials: {
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey,
      },
    });
  }

  return signingClient;
};

/**
 * Creates the bucket if it is missing.
 *
 * R2 buckets are made once in a dashboard and persist. A MinIO container
 * started from a fresh volume has none, and a first upload would fail with
 * NoSuchBucket - a confusing way to learn that storage is working fine and
 * merely empty. Idempotent, and only ever called on the upload path.
 */
let bucketReady = false;

const ensureBucket = async (): Promise<void> => {
  if (bucketReady) return;

  const s3 = getClient();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.r2Bucket }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: env.r2Bucket }));
      console.log(`Created object storage bucket "${env.r2Bucket}".`);
    } catch (err: any) {
      // A parallel request may have won the race; that is success, not failure.
      if (!/BucketAlreadyOwnedByYou|BucketAlreadyExists/.test(err?.name ?? "")) {
        throw err;
      }
    }
  }

  bucketReady = true;
};

/**
 * Builds the object key.
 *
 * The date prefix is not decoration: it makes lifecycle rules ("archive
 * anything older than one season") expressible as a prefix match, and keeps
 * listings navigable. The UUID prevents two farmers photographing the same
 * crop in the same second from colliding, and means the key leaks nothing
 * about the uploader.
 */
export const buildImageKey = (cropInstanceId: string, date = new Date()): string => {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `crops/${yyyy}/${mm}/${cropInstanceId}/${randomUUID()}.jpg`;
};

export const uploadImage = async (
  key: string,
  body: Buffer,
  contentType = "image/jpeg"
): Promise<string> => {
  await ensureBucket();
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.r2Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Photos are immutable once written, so let browsers cache them
      // indefinitely. Every cache hit is an R2 read operation we do not pay
      // for out of the 10M/month free allowance.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return key;
};

export const deleteImage = async (key: string): Promise<void> => {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: env.r2Bucket, Key: key })
  );
};

/**
 * Turns a stored key into something the browser can load.
 *
 * With a public R2.dev or custom-domain binding we return a plain URL, which
 * costs nothing and caches at Cloudflare's edge. Without one we fall back to a
 * short-lived presigned URL, which works but hits R2 on every view.
 */
export const resolveImageUrl = async (key: string): Promise<string> => {
  if (env.r2PublicBaseUrl) {
    return `${env.r2PublicBaseUrl.replace(/\/$/, "")}/${key}`;
  }

  return getSignedUrl(
    getSigningClient(),
    new GetObjectCommand({ Bucket: env.r2Bucket, Key: key }),
    { expiresIn: 3600 }
  );
};
