import { describe, expect, it, vi } from "vitest";

import { COUNTER_KEY, COUNTER_START } from "../src/lib/counter.js";
import { decodeShortCode, encodeId } from "../src/lib/hashids.js";
import { urlsCollection } from "../src/lib/mongo.js";
import { redis } from "../src/lib/redis.js";
import { nextClientIp, shorten, useTestApp } from "./helpers.js";

const LONG_URL = "https://example.com/some/very/long/path?query=1";

describe("POST /api/shorten", () => {
  const context = useTestApp();

  it("creates a short URL and stores it in MongoDB", async () => {
    const response = await shorten(context.app, LONG_URL);

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body).toEqual({
      shortCode: expect.any(String),
      shortUrl: `http://short.test/${body.shortCode}`,
      longUrl: LONG_URL,
    });

    expect(decodeShortCode(body.shortCode)).toBe(COUNTER_START);

    const stored = await urlsCollection.findOne({ _id: COUNTER_START });
    expect(stored).toMatchObject({
      shortCode: body.shortCode,
      longUrl: LONG_URL,
    });
  });

  it("generates sequential IDs with distinct short codes", async () => {
    const first = (await shorten(context.app, LONG_URL)).json();
    const second = (await shorten(context.app, LONG_URL)).json();

    expect(decodeShortCode(second.shortCode)).toBe(
      decodeShortCode(first.shortCode)! + 1,
    );
    expect(second.shortCode).not.toBe(first.shortCode);
  });

  it.each([
    ["a malformed URL", "not a url"],
    ["a non-http protocol", "ftp://example.com/file"],
    [
      "a URL longer than 2048 characters",
      `https://example.com/${"a".repeat(2050)}`,
    ],
  ])("rejects %s", async (_description, url) => {
    const response = await shorten(context.app, url);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects URLs that already point to the shortener", async () => {
    const response = await shorten(context.app, "http://short.test/abc123");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "URL is already a short URL from this service",
      code: "ALREADY_SHORTENED",
    });
    expect(await urlsCollection.countDocuments()).toBe(0);
  });

  it("keeps working after the Redis counter is lost", async () => {
    const first = (await shorten(context.app, LONG_URL)).json();

    await redis.del(COUNTER_KEY);

    const response = await shorten(context.app, LONG_URL);

    expect(response.statusCode).toBe(201);
    expect(decodeShortCode(response.json().shortCode)).toBe(
      decodeShortCode(first.shortCode)! + 1,
    );
  });

  it("retries with a fresh ID when the counter falls behind stored IDs", async () => {
    await shorten(context.app, LONG_URL);
    const latest = (await shorten(context.app, LONG_URL)).json();

    await redis.set(COUNTER_KEY, COUNTER_START);

    const response = await shorten(context.app, LONG_URL);

    expect(response.statusCode).toBe(201);
    expect(decodeShortCode(response.json().shortCode)).toBe(
      decodeShortCode(latest.shortCode)! + 1,
    );
  });

  it("limits requests per client IP", async () => {
    const ip = nextClientIp();

    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await shorten(context.app, LONG_URL, ip)).statusCode).toBe(201);
    }

    const limited = await shorten(context.app, LONG_URL, ip);
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ code: "RATE_LIMITED" });
    expect(limited.headers["retry-after"]).toBeDefined();

    const otherClient = await shorten(context.app, LONG_URL);
    expect(otherClient.statusCode).toBe(201);
  });

  it("allows only the configured CORS origin", async () => {
    const preflight = (origin: string) =>
      context.app.inject({
        method: "OPTIONS",
        url: "/api/shorten",
        headers: {
          origin,
          "access-control-request-method": "POST",
        },
      });

    const allowed = await preflight("http://front.test");
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://front.test",
    );

    const blocked = await preflight("http://evil.test");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("sends security headers", async () => {
    const response = await shorten(context.app, LONG_URL);

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["strict-transport-security"]).toBeDefined();
  });
});

describe("GET /:shortCode", () => {
  const context = useTestApp();

  const redirect = (shortCode: string) =>
    context.app.inject({
      method: "GET",
      url: `/${shortCode}`,
      remoteAddress: nextClientIp(),
    });

  it("redirects to the long URL with 301", async () => {
    const { shortCode } = (await shorten(context.app, LONG_URL)).json();

    const response = await redirect(shortCode);

    expect(response.statusCode).toBe(301);
    expect(response.headers.location).toBe(LONG_URL);
  });

  it("caches the long URL in Redis and serves it from the cache", async () => {
    const { shortCode } = (await shorten(context.app, LONG_URL)).json();
    const id = decodeShortCode(shortCode)!;

    await redirect(shortCode);

    expect(await redis.get(`url:${id}`)).toBe(LONG_URL);
    expect(await redis.ttl(`url:${id}`)).toBeGreaterThan(0);

    await urlsCollection.deleteOne({ _id: id });

    const cached = await redirect(shortCode);
    expect(cached.statusCode).toBe(301);
    expect(cached.headers.location).toBe(LONG_URL);
  });

  it("falls back to MongoDB when the cache is unavailable", async () => {
    const { shortCode } = (await shorten(context.app, LONG_URL)).json();

    const get = vi
      .spyOn(redis, "get")
      .mockRejectedValueOnce(new Error("Redis is down"));
    const set = vi
      .spyOn(redis, "set")
      .mockRejectedValueOnce(new Error("Redis is down"));

    const response = await redirect(shortCode);

    expect(response.statusCode).toBe(301);
    expect(response.headers.location).toBe(LONG_URL);

    get.mockRestore();
    set.mockRestore();
  });

  it.each([
    ["an unknown code", () => encodeId(999_999_999)],
    ["an invalid code", () => "not-a-code"],
  ])("returns 404 for %s", async (_description, shortCode) => {
    const response = await redirect(shortCode());

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Short URL not found",
      code: "NOT_FOUND",
    });
  });
});
