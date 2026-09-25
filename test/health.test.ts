import { describe, expect, it, vi } from "vitest";

import { redis } from "../src/lib/redis.js";
import { useTestApp } from "./helpers.js";

describe("health routes", () => {
  const context = useTestApp();

  it("answers the liveness check on /", async () => {
    const response = await context.app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
  });

  it("reports ok when MongoDB and Redis are up", async () => {
    const response = await context.app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", mongo: "up", redis: "up" });
  });

  it("reports 503 when a dependency is down", async () => {
    const ping = vi
      .spyOn(redis, "ping")
      .mockRejectedValueOnce(new Error("Redis is down"));

    const response = await context.app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "degraded",
      mongo: "up",
      redis: "down",
    });

    ping.mockRestore();
  });
});
