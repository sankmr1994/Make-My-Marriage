import { model, Schema } from "mongoose";

export type UserDocument = {
  displayName: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  status: "ACTIVE" | "DISABLED";
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDocument>({
  displayName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, maxlength: 254 },
  emailNormalized: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  status: { type: String, required: true, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE" },
  lastLoginAt: { type: Date }
}, { timestamps: true, collection: "users" });

userSchema.index({ emailNormalized: 1 }, { unique: true, name: "users_email_normalized_unique" });

export const User = model<UserDocument>("User", userSchema);
