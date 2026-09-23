import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { env } from "../lib/env.js";
import { decodeShortCode, encodeId } from "../lib/hashids.js";
import { urlsCollection } from "../lib/mongo.js";
import { COUNTER_KEY, redis } from "../lib/redis.js";
import {
  ErrorSchema,
  RedirectParamsSchema,
  ShortenBodySchema,
  ShortenResponseSchema,
} from "../schemas/index.js";

export const urlRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/api/shorten",
    schema: {
      tags: ["URLs"],
      summary: "Shorten a long URL",
      description:
        "Generates a unique numeric ID with Redis INCR, converts it to a base62 short code obfuscated with Hashids and saves it to the database.",
      body: ShortenBodySchema,
      response: {
        201: ShortenResponseSchema.describe("Short URL created"),
        400: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      const longUrl = request.body.url;

      const id = await redis.incr(COUNTER_KEY);
      const shortCode = encodeId(id);

      await urlsCollection.insertOne({
        _id: id,
        shortCode,
        longUrl,
        createdAt: new Date(),
      });

      return reply.status(201).send({
        shortCode,
        shortUrl: `${env.BASE_URL}/${shortCode}`,
        longUrl,
      });
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:shortCode",
    schema: {
      tags: ["URLs"],
      summary: "Redirect to the long URL",
      description:
        "Decodes the base62 short code back to the numeric ID with Hashids, looks it up in MongoDB and redirects with 301.",
      params: RedirectParamsSchema,
      response: {
        301: z.null().describe("Redirect to the long URL (Location header)"),
        404: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      const id = decodeShortCode(request.params.shortCode);

      if (id === null) {
        return reply
          .status(404)
          .send({ error: "Short URL not found", code: "NOT_FOUND" });
      }

      const url = await urlsCollection.findOne(
        { _id: id },
        { projection: { longUrl: 1 } },
      );

      if (!url) {
        return reply
          .status(404)
          .send({ error: "Short URL not found", code: "NOT_FOUND" });
      }

      return reply.redirect(url.longUrl, 301);
    },
  });
};
