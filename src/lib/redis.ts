import { Redis } from "ioredis";

import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, { lazyConnect: true });

export const COUNTER_KEY = "url:counter";

export const COUNTER_START = 238_328;

export const connectRedis = async () => {
  await redis.connect();
  await redis.set(COUNTER_KEY, COUNTER_START - 1, "NX");
};
