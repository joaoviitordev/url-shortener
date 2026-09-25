import { inject, vi } from "vitest";

process.env.MONGO_URL = inject("mongoUri");

vi.mock("../src/lib/redis.js", async () => {
  const { default: RedisMock } = await import("ioredis-mock");

  return {
    redis: new RedisMock(),
    connectRedis: async () => {},
  };
});
