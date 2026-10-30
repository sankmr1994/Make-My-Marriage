import { model, Schema, Types } from "mongoose";

export type GuestInvitationDocument = {
  weddingId: Types.ObjectId;
  eventId: Types.ObjectId;
  guestId: Types.ObjectId;
  tokenHash: string;
  emailSubmissionStatus: "ACCEPTED" | "FAILED" | "NOT_CONFIGURED";
  expiresAt: Date;
  revokedAt?: Date;
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const guestInvitationSchema = new Schema<GuestInvitationDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event" },
  guestId: { type: Schema.Types.ObjectId, required: true, ref: "Guest" },
  tokenHash: { type: String, required: true, unique: true, select: false },
  emailSubmissionStatus: { type: String, required: true, enum: ["ACCEPTED", "FAILED", "NOT_CONFIGURED"], default: "NOT_CONFIGURED" },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" }
}, { timestamps: true, collection: "guestInvitations" });

guestInvitationSchema.index({ weddingId: 1, eventId: 1, guestId: 1, createdAt: -1 });
guestInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "guest_invitation_expiry_ttl" });

export const GuestInvitation = model<GuestInvitationDocument>("GuestInvitation", guestInvitationSchema);
