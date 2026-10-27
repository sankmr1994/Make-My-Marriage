import { model, Schema } from "mongoose";

const authRateLimitSchema = new Schema({
  bucketKey: { type: String, required: true, unique: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true }
}, { versionKey: false, collection: "authRateLimits" });

authRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "auth_rate_limit_expiry_ttl" });

export const AuthRateLimit = model("AuthRateLimit", authRateLimitSchema);
