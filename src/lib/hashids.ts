import Hashids from "hashids";

import { env } from "./env.js";

export const BASE62_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const hashids = new Hashids(env.HASHIDS_SALT, 0, BASE62_ALPHABET);

export const encodeId = (id: number): string => hashids.encode(id);

export const decodeShortCode = (shortCode: string): number | null => {
  if (!hashids.isValidId(shortCode)) return null;

  const [id, ...rest] = hashids.decode(shortCode);

  if (rest.length > 0) return null;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) {
    return null;
  }

  return id;
};
