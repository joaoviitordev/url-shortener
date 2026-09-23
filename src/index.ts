import { env } from "./lib/env.js";

import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifyApiReference from "@scalar/fastify-api-reference";
import Fastify from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import z from "zod";

import { connectMongo, mongoClient } from "./lib/mongo.js";
import { connectRedis, redis } from "./lib/redis.js";
import { urlRoutes } from "./routes/urls.js";

const app = Fastify({
  logger:
    env.NODE_ENV === "production"
      ? true
      : {
          transport: {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
        },
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
        description: "Localhost",
        url: `http://localhost:${env.PORT}`,
      },
      {
        description: "Production",
        url: "https://bitly.fullstackclub.com.br",
      },
    ],
  },
  transform: jsonSchemaTransform,
});

await app.register(fastifyCors, {
  origin: ["http://localhost:3000"],
  credentials: true,
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

await app.register(urlRoutes);

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/swagger.json",
  schema: { hide: true },
  handler: async () => {
    return app.swagger();
  },
});

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/",
  schema: {
    description: "Health check",
    tags: ["Health"],
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

app.addHook("onClose", async () => {
  await Promise.allSettled([mongoClient.close(), redis.quit()]);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    process.exit(0);
  });
}

try {
  await Promise.all([connectMongo(), connectRedis()]);

  await app.listen({ host: "0.0.0.0", port: env.PORT });
  app.log.info(`API docs available at http://localhost:${env.PORT}/docs`);
} catch (err) {
  app.log.error(err);
  await Promise.allSettled([mongoClient.close(), redis.quit()]);
  process.exit(1);
}
