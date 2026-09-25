import { env } from "./lib/env.js";

import { buildApp } from "./app.js";
import { syncCounter } from "./lib/counter.js";
import { connectMongo, mongoClient } from "./lib/mongo.js";
import { connectRedis, redis } from "./lib/redis.js";

const closeConnections = () =>
  Promise.allSettled([mongoClient.close(), redis.quit()]);

const app = await buildApp();

app.addHook("onClose", async () => {
  await closeConnections();
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
  const counter = await syncCounter();
  app.log.info(`URL counter synced at ${counter}`);

  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`API docs available at http://localhost:${env.PORT}/docs`);
} catch (err) {
  app.log.error(err);
  await closeConnections();
  process.exit(1);
}
