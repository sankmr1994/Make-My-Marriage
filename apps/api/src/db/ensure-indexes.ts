import { AuthRateLimit } from "../models/auth-rate-limit.js";
import { PasswordResetToken } from "../models/password-reset-token.js";
import { Session } from "../models/session.js";
import { User } from "../models/user.js";
import { WeddingMembership } from "../models/wedding-membership.js";

export async function ensureCoreIndexes(): Promise<void> {
  await Promise.all([
    User.createIndexes(),
    Session.createIndexes(),
    PasswordResetToken.createIndexes(),
    WeddingMembership.createIndexes(),
    AuthRateLimit.createIndexes()
  ]);
  console.info("Core account and session indexes are ready.");
}
