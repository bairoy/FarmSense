import "dotenv/config";

/**
 * Reads an environment variable, throwing at boot if a required one is absent.
 *
 * Failing at startup is deliberate. A missing AI_SERVICE_TOKEN discovered when
 * the first farmer uploads a photo is far worse than a container that refuses
 * to start.
 */
const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

export const env = {
  port: Number(optional("PORT", "5050")),

  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_PUBLISHABLE_OR_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),

  aiServiceUrl: optional("AI_SERVICE_URL", "http://localhost:8000"),
  aiServiceToken: process.env.AI_SERVICE_TOKEN ?? "",

  /**
   * How long to wait for a chat answer.
   *
   * Default is generous because a locally hosted model is the default provider:
   * a ReAct turn is several full generations, and on consumer hardware that is
   * minutes rather than seconds. Lower it when pointing at a hosted API.
   */
  chatTimeoutMs: Number(process.env.CHAT_TIMEOUT_MS ?? 300_000),

  // Object storage, S3-compatible. Left optional so the app still boots
  // without image storage configured — the images module reports its own
  // unavailability rather than crashing the whole server.
  //
  // Two backends are supported because they are the same API:
  //   - Cloudflare R2 in production (zero egress cost, which is the quota that
  //     actually bites when a crop-history screen re-serves the same photos).
  //   - MinIO for local development and for anyone without a cloud account.
  //
  // S3_ENDPOINT selects between them. When it is set it wins outright; when it
  // is not, an R2 account id builds the R2 endpoint as before, so existing
  // deployments keep working with no config change.
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  /**
   * Endpoint put into presigned URLs the browser loads. Differs from
   * S3_ENDPOINT under docker compose, where the backend reaches MinIO as
   * `minio:9000` but the browser must use `localhost:9002`.
   */
  s3PublicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? "",
  /**
   * Path-style addressing (`endpoint/bucket/key`) rather than virtual-hosted
   * (`bucket.endpoint/key`). MinIO on a bare host or IP needs this; R2 does
   * not. Defaults to on whenever a custom endpoint is set, which is the case
   * that needs it.
   */
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE
    ? process.env.S3_FORCE_PATH_STYLE !== "false"
    : Boolean(process.env.S3_ENDPOINT),

  r2AccountId: process.env.R2_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2Bucket: process.env.R2_BUCKET ?? "farmsense-images",
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? "",

  // Copernicus Data Space Ecosystem — free ESA source for Sentinel-1/2.
  cdseClientId: process.env.CDSE_CLIENT_ID ?? "",
  cdseClientSecret: process.env.CDSE_CLIENT_SECRET ?? "",

  defaultRegion: optional("DEFAULT_REGION", "gorakhpur"),
};

/**
 * Is object storage usable?
 *
 * Credentials plus somewhere to send them: either an explicit S3 endpoint
 * (MinIO, or any other S3-compatible server) or an R2 account id to build one
 * from. Named for the capability rather than the vendor, because the answer no
 * longer depends on which vendor it is.
 */
export const isStorageConfigured = (): boolean =>
  Boolean(
    env.r2AccessKeyId &&
      env.r2SecretAccessKey &&
      (env.s3Endpoint || env.r2AccountId)
  );

/** @deprecated Use isStorageConfigured. Retained so existing callers keep working. */
export const isR2Configured = isStorageConfigured;

/** Where S3 requests go. Explicit endpoint wins; otherwise build R2's. */
export const storageEndpoint = (): string =>
  env.s3Endpoint || `https://${env.r2AccountId}.r2.cloudflarestorage.com`;

export const isCdseConfigured = (): boolean =>
  Boolean(env.cdseClientId && env.cdseClientSecret);
