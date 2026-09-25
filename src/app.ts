import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifyApiReference from "@scalar/fastify-api-reference";
import Fastify, { FastifyServerOptions } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";

import { env } from "./lib/env.js";
import { healthRoutes } from "./routes/health.js";
import { urlRoutes } from "./routes/urls.js";

const loggerByEnvironment = {
  production: true,
  test: false,
  development: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
} satisfies Record<typeof env.NODE_ENV, FastifyServerOptions["logger"]>;

export const buildApp = async () => {
  const app = Fastify({
    trustProxy: env.NODE_ENV === "production",
    logger: loggerByEnvironment[env.NODE_ENV],
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: "code" in error ? String(error.code) : "BAD_REQUEST",
      });
    }

    request.log.error({ err: error }, "Unhandled error");
    return reply.status(500).send({
      error: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "URL Shortener API",
        description:
          "URL shortener using Redis INCR counter + base62 (Hashids) short codes, MongoDB storage and Redis cache.",
        version: "1.0.0",
      },
      servers: [
        {
          description: env.NODE_ENV,
          url: env.BASE_URL,
        },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  await app.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
  });

  await app.register(fastifyRateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) =>
      Object.assign(
        new Error(`Too many requests, please try again in ${context.after}`),
        { statusCode: context.statusCode, code: "RATE_LIMITED" },
      ),
  });

  await app.register(fastifyApiReference, {
    routePrefix: "/docs",
    configuration: {
      sources: [
        {
          title: "URL Shortener API",
          slug: "url-shortener",
          url: "/swagger.json",
        },
      ],
    },
  });

  await app.register(healthRoutes);
  await app.register(urlRoutes);

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/swagger.json",
    schema: { hide: true },
    handler: async () => {
      return app.swagger();
    },
  });

  return app;
};
