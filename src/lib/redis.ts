import { Redis } from "ioredis";

import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, { lazyConnect: true });

export const connectRedis = async () => {
  await redis.connect();
};
