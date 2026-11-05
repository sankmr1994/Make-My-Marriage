import { model, Schema, Types } from "mongoose";

export const photoUploadPurposes = ["WEDDING_COVER", "EVENT_COVER", "GALLERY_PHOTO"] as const;
export type PhotoUploadPurpose = typeof photoUploadPurposes[number];
export type PhotoUploadSessionDocument = {
  weddingId: Types.ObjectId;
  eventId?: Types.ObjectId;
  guestAccessLinkId?: Types.ObjectId;
  guestId?: Types.ObjectId;
  purpose: PhotoUploadPurpose;
  objectKey: string;
  expectedContentType: string;
  expectedSizeBytes: number;
  originalFilename?: string;
  uploadUrlExpiresAt: Date;
  status: "PENDING" | "COMPLETED" | "EXPIRED" | "REJECTED";
  completedAt?: Date;
  purgeAt: Date;
  uploaderType: "GUEST" | "ADMIN" | "ORGANISER";
  uploaderUserId?: Types.ObjectId;
  contributorName?: string;
  createdAt: Date;
  updatedAt: Date;
};

const photoUploadSessionSchema = new Schema<PhotoUploadSessionDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding" },
  eventId: { type: Schema.Types.ObjectId, ref: "Event" },
  guestAccessLinkId: { type: Schema.Types.ObjectId, ref: "GuestAccessLink" },
  guestId: { type: Schema.Types.ObjectId, ref: "Guest" },
  purpose: { type: String, required: true, enum: photoUploadPurposes },
  objectKey: { type: String, required: true, unique: true },
  expectedContentType: { type: String, required: true },
  expectedSizeBytes: { type: Number, required: true, min: 1 },
  originalFilename: { type: String, maxlength: 160 },
  uploadUrlExpiresAt: { type: Date, required: true },
  status: { type: String, required: true, enum: ["PENDING", "COMPLETED", "EXPIRED", "REJECTED"], default: "PENDING" },
  completedAt: { type: Date },
  purgeAt: { type: Date, required: true },
  uploaderType: { type: String, required: true, enum: ["GUEST", "ADMIN", "ORGANISER"] },
  uploaderUserId: { type: Schema.Types.ObjectId, ref: "User" },
  contributorName: { type: String, trim: true, maxlength: 100 }
}, { timestamps: true, collection: "photoUploadSessions" });

photoUploadSessionSchema.index({ weddingId: 1, status: 1, createdAt: -1 });
photoUploadSessionSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0, name: "photo_upload_session_purge_ttl" });

export const PhotoUploadSession = model<PhotoUploadSessionDocument>("PhotoUploadSession", photoUploadSessionSchema);
