export type ObjectStorageProvider = "supabase" | "hetzner_s3";

export type ObjectStorageConfig =
  | { provider: "supabase" }
  | {
      provider: "hetzner_s3";
      endpoint: string;
      region: string;
      userFilesBucket: string;
      backupsBucket: string;
      accessKeyId: string;
      secretAccessKey: string;
    };

const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`OBJECT_STORAGE_CONFIG_MISSING:${name}`);
  return value;
}

function validPrivateEndpoint(value: string) {
  const endpoint = new URL(value);
  if (endpoint.protocol !== "https:") throw new Error("OBJECT_STORAGE_ENDPOINT_MUST_USE_HTTPS");
  if (endpoint.username || endpoint.password || endpoint.pathname !== "/" || endpoint.search || endpoint.hash) {
    throw new Error("OBJECT_STORAGE_ENDPOINT_INVALID");
  }
  return endpoint.origin;
}

function validBucket(value: string, variable: string) {
  if (!BUCKET_PATTERN.test(value)) throw new Error(`OBJECT_STORAGE_BUCKET_INVALID:${variable}`);
  return value;
}

export function readObjectStorageConfig(env: NodeJS.ProcessEnv = process.env): ObjectStorageConfig {
  const provider = (env.OBJECT_STORAGE_PROVIDER?.trim() || "supabase") as ObjectStorageProvider;
  if (provider === "supabase") return { provider };
  if (provider !== "hetzner_s3") throw new Error("OBJECT_STORAGE_PROVIDER_INVALID");

  const userFilesBucket = validBucket(required(env, "OBJECT_STORAGE_USER_FILES_BUCKET"), "OBJECT_STORAGE_USER_FILES_BUCKET");
  const backupsBucket = validBucket(required(env, "OBJECT_STORAGE_BACKUPS_BUCKET"), "OBJECT_STORAGE_BACKUPS_BUCKET");
  if (userFilesBucket === backupsBucket) throw new Error("OBJECT_STORAGE_BUCKETS_MUST_DIFFER");

  return {
    provider,
    endpoint: validPrivateEndpoint(required(env, "OBJECT_STORAGE_ENDPOINT")),
    region: required(env, "OBJECT_STORAGE_REGION"),
    userFilesBucket,
    backupsBucket,
    accessKeyId: required(env, "OBJECT_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: required(env, "OBJECT_STORAGE_SECRET_ACCESS_KEY"),
  };
}

export function objectStorageReadiness(env: NodeJS.ProcessEnv = process.env) {
  try {
    const config = readObjectStorageConfig(env);
    return { configured: config.provider === "hetzner_s3", provider: config.provider, error: null } as const;
  } catch (error) {
    return {
      configured: false,
      provider: env.OBJECT_STORAGE_PROVIDER?.trim() || "supabase",
      error: error instanceof Error ? error.message : "OBJECT_STORAGE_CONFIG_INVALID",
    } as const;
  }
}
