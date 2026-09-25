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
  REDIS_URL: z.string().min(1),
  HASHIDS_SALT: z.string().min(1),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  SHORTEN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  URL_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
});

const parsed = envSchema.safeParse({
  ...process.env,
  BASE_URL: process.env.BASE_URL ?? process.env.RENDER_EXTERNAL_URL,
});

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
