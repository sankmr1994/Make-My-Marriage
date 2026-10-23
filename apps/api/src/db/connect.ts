import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase(): Promise<typeof mongoose | undefined> {
  if (!env.MONGODB_URI) {
    console.warn("MONGODB_URI is not configured; database connection skipped.");
    return undefined;
  }

  if (mongoose.connection.readyState === 1) return mongoose;

  return mongoose.connect(env.MONGODB_URI);
}
