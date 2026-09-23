import z from "zod";

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const ShortenBodySchema = z.object({
  url: z
    .url({ protocol: /^https?$/, normalize: true })
    .max(2048)
    .describe("Long URL to be shortened (http or https)"),
});

export const ShortenResponseSchema = z.object({
  shortCode: z.string().describe("Base62 short code"),
  shortUrl: z.url().describe("Full short URL"),
  longUrl: z.url().describe("Original long URL"),
});

export const RedirectParamsSchema = z.object({
  shortCode: z.string().min(1).max(64).describe("Base62 short code"),
});
