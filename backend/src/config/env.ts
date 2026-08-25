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

  // Cloudflare R2 (S3-compatible). Left optional so the app still boots
  // without image storage configured — the images module reports its own
  // unavailability rather than crashing the whole server.
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

export const isR2Configured = (): boolean =>
  Boolean(env.r2AccountId && env.r2AccessKeyId && env.r2SecretAccessKey);

export const isCdseConfigured = (): boolean =>
  Boolean(env.cdseClientId && env.cdseClientSecret);
