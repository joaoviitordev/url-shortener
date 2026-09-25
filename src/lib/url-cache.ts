import { env } from "./env.js";
import { redis } from "./redis.js";

const cacheKey = (id: number) => `url:${id}`;

export const getCachedLongUrl = (id: number): Promise<string | null> =>
  redis.get(cacheKey(id));

export const cacheLongUrl = async (id: number, longUrl: string) => {
  await redis.set(cacheKey(id), longUrl, "EX", env.URL_CACHE_TTL_SECONDS);
};
