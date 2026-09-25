import { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { buildApp } from "../src/app.js";
import { syncCounter } from "../src/lib/counter.js";
import { connectMongo, mongoClient, urlsCollection } from "../src/lib/mongo.js";
import { redis } from "../src/lib/redis.js";

let lastIpSuffix = 0;

export const nextClientIp = () => {
  lastIpSuffix += 1;
  return `10.0.${Math.floor(lastIpSuffix / 250)}.${lastIpSuffix % 250}`;
};

export const resetDatabases = async () => {
  await Promise.all([urlsCollection.deleteMany({}), redis.flushall()]);
  await syncCounter();
};

export const useTestApp = () => {
  const context = {} as { app: FastifyInstance };

  beforeAll(async () => {
    await connectMongo();
    context.app = await buildApp();
    await context.app.ready();
  });

  beforeEach(resetDatabases);

  afterAll(async () => {
    await context.app.close();
    await mongoClient.close();
  });

  return context;
};

export const shorten = (
  app: FastifyInstance,
  url: string,
  ip = nextClientIp(),
) =>
  app.inject({
    method: "POST",
    url: "/api/shorten",
    remoteAddress: ip,
    payload: { url },
  });
