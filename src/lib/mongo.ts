import { MongoClient } from "mongodb";

import { env } from "./env.js";

export interface UrlDocument {
  _id: number;
  shortCode: string;
  longUrl: string;
  createdAt: Date;
}

export const mongoClient = new MongoClient(env.MONGO_URL, {
  maxPoolSize: env.MONGO_MAX_POOL_SIZE,
});

export const urlsCollection = mongoClient
  .db(env.MONGO_DB_NAME)
  .collection<UrlDocument>("urls");

export const connectMongo = async () => {
  await mongoClient.connect();
};
