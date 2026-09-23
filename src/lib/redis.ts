import { Cluster, Redis } from "ioredis";

import { Resource } from "sst";

export const redis = new Cluster(
  [
    {
      host: Resource.MyRedis.host,
      port: Resource.MyRedis.port,
    },
  ],
  {
    redisOptions: {
      tls: { checkServerIdentity: () => undefined },
      username: Resource.MyRedis.username,
      password: Resource.MyRedis.password,
    },
  },
);

export const COUNTER_KEY = "url:counter";

export const COUNTER_START = 238_328;

export const connectRedis = async () => {
  await redis.set(COUNTER_KEY, COUNTER_START - 1, "NX");
};
