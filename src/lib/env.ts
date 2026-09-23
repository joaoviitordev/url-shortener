import { Resource } from "sst";

import z from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3333),
  BASE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  MONGO_URL: z.string().min(1),
  MONGO_DB_NAME: z.string().min(1).default("url_shortener"),
  MONGO_MAX_POOL_SIZE: z.coerce.number().int().positive().default(100),
  HASHIDS_SALT: z.string().min(1),
  HASHIDS_MIN_LENGTH: z.coerce.number().int().min(0).default(7),
});

const parsed = envSchema.safeParse({
  MONGO_URL: Resource.MongoUrl.value,
  HASHIDS_SALT: Resource.HashIdsSalt.value,
  HASHIDS_MIN_LENGTH: Resource.HashIdsMinLength.value,
  PORT: Resource.Port.value,
  BASE_URL: Resource.BaseUrl.value,
  NODE_ENV: Resource.NodeEnv.value,
  MONGO_MAX_POOL_SIZE: Resource.MongoMaxPoolSize.value,
});

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
