import { model, Schema, Types } from "mongoose";

export type GuestDocument = {
  weddingId: Types.ObjectId;
  primaryContactName: string;
  email: string;
  emailNormalized: string;
  familyCount: number;
  status: "ACTIVE" | "ARCHIVED";
  createdByUserId: Types.ObjectId;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const guestSchema = new Schema<GuestDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  primaryContactName: { type: String, required: true, trim: true, maxlength: 160 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  emailNormalized: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  familyCount: { type: Number, required: true, min: 1, max: 100, validate: { validator: Number.isInteger, message: "Family count must be a whole number." } },
  status: { type: String, required: true, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE" },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  archivedAt: { type: Date }
}, { timestamps: true, collection: "guests" });

guestSchema.index({ weddingId: 1, emailNormalized: 1 }, { unique: true, name: "guests_one_email_per_wedding" });
guestSchema.index({ weddingId: 1, status: 1, primaryContactName: 1 });

export const Guest = model<GuestDocument>("Guest", guestSchema);
