import { AuthRateLimit } from "../models/auth-rate-limit.js";
import { AppError } from "../utils/app-error.js";
import { createHash } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;

export async function enforceAuthRateLimit(ipAddress: string, route: string, limit: number): Promise<void> {
  const now = Date.now();
  const bucket = Math.floor(now / WINDOW_MS);
  const bucketKey = createHash("sha256").update(`${route}:${ipAddress}:${bucket}`).digest("hex");
  const expiresAt = new Date((bucket + 2) * WINDOW_MS);
  try {
    const updated = await AuthRateLimit.findOneAndUpdate(
      { bucketKey },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    if (updated && updated.count > limit) throw new AppError(429, "RATE_LIMITED", "Too many attempts. Please try again later.");
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      const updated = await AuthRateLimit.findOneAndUpdate({ bucketKey }, { $inc: { count: 1 } }, { new: true }).lean();
      if (updated && updated.count > limit) throw new AppError(429, "RATE_LIMITED", "Too many attempts. Please try again later.");
      return;
    }
    throw error;
  }
}
