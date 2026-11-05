import { model, Schema, Types } from "mongoose";

export type PhotoDocument = {
  weddingId: Types.ObjectId;
  eventId?: Types.ObjectId;
  objectKey: string;
  originalFilename?: string;
  contentType: string;
  sizeBytes: number;
  etag?: string;
  uploaderType: "GUEST" | "ADMIN" | "ORGANISER";
  guestId?: Types.ObjectId;
  uploaderUserId?: Types.ObjectId;
  contributorName?: string;
  guestAccessLinkId?: Types.ObjectId;
  moderationStatus: "PENDING_REVIEW" | "VISIBLE" | "REJECTED" | "DELETED";
  createdAt: Date;
  updatedAt: Date;
};

const photoSchema = new Schema<PhotoDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding" },
  eventId: { type: Schema.Types.ObjectId, ref: "Event" },
  objectKey: { type: String, required: true, unique: true },
  originalFilename: { type: String, maxlength: 160 },
  contentType: { type: String, required: true, enum: ["image/jpeg", "image/png", "image/webp"] },
  sizeBytes: { type: Number, required: true, min: 1 },
  etag: { type: String },
  uploaderType: { type: String, required: true, enum: ["GUEST", "ADMIN", "ORGANISER"] },
  guestId: { type: Schema.Types.ObjectId, ref: "Guest" },
  uploaderUserId: { type: Schema.Types.ObjectId, ref: "User" },
  contributorName: { type: String, trim: true, maxlength: 100 },
  guestAccessLinkId: { type: Schema.Types.ObjectId, ref: "GuestAccessLink" },
  moderationStatus: { type: String, required: true, enum: ["PENDING_REVIEW", "VISIBLE", "REJECTED", "DELETED"], default: "PENDING_REVIEW" }
}, { timestamps: true, collection: "photos" });

photoSchema.index({ weddingId: 1, moderationStatus: 1, createdAt: -1 });
photoSchema.index({ weddingId: 1, eventId: 1, moderationStatus: 1, createdAt: -1 });
photoSchema.index({ weddingId: 1, uploaderType: 1, uploaderUserId: 1, contributorName: 1, createdAt: -1 });
photoSchema.index({ weddingId: 1, guestId: 1, createdAt: -1 });

export const Photo = model<PhotoDocument>("Photo", photoSchema);
