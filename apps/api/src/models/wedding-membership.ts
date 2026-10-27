import { model, Schema, Types } from "mongoose";

export type WeddingMembershipDocument = {
  weddingId: Types.ObjectId;
  userId: Types.ObjectId;
  role: "ADMIN" | "ORGANISER";
  status: "ACTIVE" | "REMOVED";
  joinedAt: Date;
  removedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const membershipSchema = new Schema<WeddingMembershipDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding" },
  userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  role: { type: String, required: true, enum: ["ADMIN", "ORGANISER"] },
  status: { type: String, required: true, enum: ["ACTIVE", "REMOVED"] },
  joinedAt: { type: Date, required: true },
  removedAt: { type: Date }
}, { timestamps: true, collection: "weddingMemberships" });

membershipSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" }, name: "memberships_one_active_wedding_per_user" });

export const WeddingMembership = model<WeddingMembershipDocument>("WeddingMembership", membershipSchema);
