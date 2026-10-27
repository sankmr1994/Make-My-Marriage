import { model, Schema, Types } from "mongoose";

export type PasswordResetTokenDocument = {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const passwordResetTokenSchema = new Schema<PasswordResetTokenDocument>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date }
}, { timestamps: true, collection: "passwordResetTokens" });

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "password_reset_expiry_ttl" });

export const PasswordResetToken = model<PasswordResetTokenDocument>("PasswordResetToken", passwordResetTokenSchema);
