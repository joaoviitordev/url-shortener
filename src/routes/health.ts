import { setTimeout as delay } from "node:timers/promises";

import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { env } from "../lib/env.js";
import { mongoClient } from "../lib/mongo.js";
import { redis } from "../lib/redis.js";
import { DependencyStatus, HealthSchema } from "../schemas/index.js";

const DEPENDENCY_CHECK_TIMEOUT_MS = 2000;

const checkDependency = async (
  check: () => Promise<unknown>,
): Promise<DependencyStatus> => {
  const timeout = delay(DEPENDENCY_CHECK_TIMEOUT_MS, "timeout" as const, {
    ref: false,
  });

  try {
    const result = await Promise.race([check(), timeout]);
    return result === "timeout" ? "down" : "up";
  } catch {
    return "down";
  }
};

export const healthRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    config: {
      rateLimit: false,
    },
    schema: {
      tags: ["Health"],
      summary: "Liveness check",
      description:
        "Answers as long as the process is running, without touching MongoDB or Redis. Used by the Render health check.",
      response: {
        200: z.object({
          message: z.string(),
        }),
      },
    },
    handler: () => {
      return { message: "Hello World" };
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/api/health",
    schema: {
      tags: ["Health"],
      summary: "Readiness check",
      description:
        "Pings MongoDB and Redis. Returns 503 when any of them is unreachable or takes longer than 2 seconds.",
      response: {
        200: HealthSchema.describe("All dependencies are up"),
        503: HealthSchema.describe("At least one dependency is down"),
      },
    },
    handler: async (request, reply) => {
      const [mongo, redisStatus] = await Promise.all([
        checkDependency(() =>
          mongoClient.db(env.MONGO_DB_NAME).command({ ping: 1 }),
        ),
        checkDependency(() => redis.ping()),
      ]);

      const healthy = mongo === "up" && redisStatus === "up";

      if (!healthy) {
        request.log.warn({ mongo, redis: redisStatus }, "Health check failed");
      }

      return reply.status(healthy ? 200 : 503).send({
        status: healthy ? "ok" : "degraded",
        mongo,
        redis: redisStatus,
      });
    },
  });
};
