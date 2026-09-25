import { MongoServerError } from "mongodb";

import { urlsCollection } from "./mongo.js";
import { redis } from "./redis.js";

export const COUNTER_KEY = "url:counter";

export const COUNTER_START = 238_328;

const DUPLICATE_KEY_ERROR_CODE = 11000;

const RAISE_COUNTER_SCRIPT = `
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
local floor = tonumber(ARGV[1])
if current < floor then
  redis.call("SET", KEYS[1], ARGV[1])
  return floor
end
return current
`;

export const syncCounter = async (): Promise<number> => {
  const latest = await urlsCollection.findOne(
    {},
    { sort: { _id: -1 }, projection: { _id: 1 } },
  );

  const floor = Math.max(latest?._id ?? 0, COUNTER_START - 1);

  const counter = await redis.eval(RAISE_COUNTER_SCRIPT, 1, COUNTER_KEY, floor);

  return Number(counter);
};

export const nextId = async (): Promise<number> => {
  const id = await redis.incr(COUNTER_KEY);

  if (id >= COUNTER_START) return id;

  await syncCounter();
  return redis.incr(COUNTER_KEY);
};

export const isDuplicateKeyError = (error: unknown): boolean =>
  error instanceof MongoServerError &&
  error.code === DUPLICATE_KEY_ERROR_CODE;
