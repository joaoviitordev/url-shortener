import { describe, expect, it } from "vitest";

import { COUNTER_KEY, COUNTER_START, syncCounter } from "../src/lib/counter.js";
import { urlsCollection } from "../src/lib/mongo.js";
import { redis } from "../src/lib/redis.js";
import { useTestApp } from "./helpers.js";

const insertUrl = (id: number) =>
  urlsCollection.insertOne({
    _id: id,
    shortCode: `code-${id}`,
    longUrl: "https://example.com",
    createdAt: new Date(),
  });

describe("syncCounter", () => {
  useTestApp();

  it("starts right before COUNTER_START on an empty database", async () => {
    await redis.del(COUNTER_KEY);

    expect(await syncCounter()).toBe(COUNTER_START - 1);
    expect(await redis.get(COUNTER_KEY)).toBe(String(COUNTER_START - 1));
  });

  it("raises the counter to the highest stored ID", async () => {
    await insertUrl(COUNTER_START + 41);
    await redis.del(COUNTER_KEY);

    expect(await syncCounter()).toBe(COUNTER_START + 41);
  });

  it("never lowers a counter that is ahead of the database", async () => {
    await insertUrl(COUNTER_START + 5);
    await redis.set(COUNTER_KEY, COUNTER_START + 100);

    expect(await syncCounter()).toBe(COUNTER_START + 100);
    expect(await redis.get(COUNTER_KEY)).toBe(String(COUNTER_START + 100));
  });
});
