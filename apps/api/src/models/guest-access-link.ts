import { model, Schema, Types } from "mongoose";

export type GuestAccessPurpose = "PHOTO_UPLOAD" | "GALLERY_VIEW";
export type GuestAccessLinkDocument = {
  weddingId: Types.ObjectId;
  purpose: GuestAccessPurpose;
  eventId?: Types.ObjectId;
  guestId?: Types.ObjectId;
  tokenHash: string;
  expiresAt?: Date;
  revokedAt?: Date;
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const guestAccessLinkSchema = new Schema<GuestAccessLinkDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  purpose: { type: String, required: true, enum: ["PHOTO_UPLOAD", "GALLERY_VIEW"] },
  eventId: { type: Schema.Types.ObjectId, ref: "Event" },
  guestId: { type: Schema.Types.ObjectId, ref: "Guest" },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date },
  revokedAt: { type: Date },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" }
}, { timestamps: true, collection: "guestAccessLinks" });

guestAccessLinkSchema.index({ weddingId: 1, purpose: 1, createdAt: -1 });

export const GuestAccessLink = model<GuestAccessLinkDocument>("GuestAccessLink", guestAccessLinkSchema);
