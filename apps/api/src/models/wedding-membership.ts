import { model, Schema, Types } from "mongoose";
import { organiserPermissionKeys } from "../utils/organiser-permissions.js";

export type WeddingMembershipDocument = {
  weddingId: Types.ObjectId;
  userId: Types.ObjectId;
  role: "ADMIN" | "ORGANISER";
  permissions?: string[];
  status: "ACTIVE" | "REMOVED";
  invitedByUserId?: Types.ObjectId;
  joinedAt: Date;
  removedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const membershipSchema = new Schema<WeddingMembershipDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding" },
  userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  role: { type: String, required: true, enum: ["ADMIN", "ORGANISER"] },
  permissions: { type: [{ type: String, trim: true, enum: organiserPermissionKeys }], default: undefined },
  status: { type: String, required: true, enum: ["ACTIVE", "REMOVED"] },
  invitedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  joinedAt: { type: Date, required: true },
  removedAt: { type: Date }
}, { timestamps: true, collection: "weddingMemberships" });

membershipSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" }, name: "memberships_one_active_wedding_per_user" });

export const WeddingMembership = model<WeddingMembershipDocument>("WeddingMembership", membershipSchema);
