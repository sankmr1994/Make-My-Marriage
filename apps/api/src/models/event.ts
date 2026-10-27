import { model, Schema, Types } from "mongoose";
import { isValidIanaTimeZone } from "../utils/iana-time-zone.js";

export type EventDocument = {
  weddingId: Types.ObjectId;
  clientEventId?: string;
  name: string;
  startsAt: Date;
  endsAt?: Date;
  timeZone: string;
  venue: { name?: string; address: string; city?: string };
  description?: string;
  status: "ACTIVE" | "ARCHIVED";
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const eventSchema = new Schema<EventDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  clientEventId: { type: String, trim: true, maxlength: 64 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date },
  timeZone: { type: String, required: true, default: "Asia/Kolkata", validate: { validator: isValidIanaTimeZone, message: "Must be a valid IANA time zone." } },
  venue: {
    name: { type: String, trim: true, maxlength: 150 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 100 }
  },
  description: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: ["ACTIVE", "ARCHIVED"], required: true, default: "ACTIVE" },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" }
}, { timestamps: true, collection: "events" });

eventSchema.index({ weddingId: 1, status: 1, startsAt: 1 });
eventSchema.index({ weddingId: 1, clientEventId: 1 }, { unique: true, partialFilterExpression: { clientEventId: { $type: "string" } } });

export const Event = model<EventDocument>("Event", eventSchema);
