import dns from "node:dns";
import { isIP } from "node:net";
import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase(): Promise<typeof mongoose> {
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required before the API can start.");
  }

  if (env.MONGODB_DNS_SERVERS) {
    const servers = env.MONGODB_DNS_SERVERS.split(",").map((server) => server.trim());
    if (servers.some((server) => isIP(server) === 0)) {
      throw new Error("MONGODB_DNS_SERVERS must contain comma-separated IPv4 or IPv6 addresses.");
    }
    dns.setServers(servers);
  }

  if (mongoose.connection.readyState === 1) return mongoose;
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
    autoIndex: env.NODE_ENV !== "production"
  });
  console.info("MongoDB connection established.");
  return mongoose;
}
