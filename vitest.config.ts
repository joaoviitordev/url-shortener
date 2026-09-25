import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      BASE_URL: "http://short.test",
      MONGO_DB_NAME: "url_shortener_test",
      REDIS_URL: "redis://localhost:6379",
      HASHIDS_SALT: "test-salt",
      CORS_ORIGIN: "http://front.test",
      RATE_LIMIT_MAX: "1000",
      SHORTEN_RATE_LIMIT_MAX: "5",
      URL_CACHE_TTL_SECONDS: "60",
    },
  },
});
