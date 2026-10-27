import { model, Schema, Types } from "mongoose";
import { isValidIanaTimeZone } from "../utils/iana-time-zone.js";

export type WeddingDocument = {
  createdByUserId: Types.ObjectId;
  couple: { brideName: string; groomName: string; photoObjectKey?: string };
  weddingDate: string;
  timeZone: string;
  location: { address: string; city?: string; state?: string; country?: string };
  contact?: { phone?: string; email?: string };
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
};

const weddingSchema = new Schema<WeddingDocument>({
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  couple: {
    brideName: { type: String, required: true, trim: true, maxlength: 100 },
    groomName: { type: String, required: true, trim: true, maxlength: 100 },
    photoObjectKey: { type: String }
  },
  weddingDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  timeZone: { type: String, required: true, default: "Asia/Kolkata", validate: { validator: isValidIanaTimeZone, message: "Must be a valid IANA time zone." } },
  location: {
    address: { type: String, required: true, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 100 }
  },
  contact: { phone: { type: String, trim: true, maxlength: 32 }, email: { type: String, trim: true, lowercase: true, maxlength: 254 } },
  status: { type: String, enum: ["ACTIVE", "ARCHIVED"], required: true, default: "ACTIVE" }
}, { timestamps: true, collection: "weddings" });

export const Wedding = model<WeddingDocument>("Wedding", weddingSchema);
