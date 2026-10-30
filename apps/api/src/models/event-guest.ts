import { model, Schema, Types } from "mongoose";

export type EventGuestDocument = {
  weddingId: Types.ObjectId;
  eventId: Types.ObjectId;
  guestId: Types.ObjectId;
  rsvpStatus: "PENDING" | "ATTENDING" | "NOT_ATTENDING";
  rsvpRespondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const eventGuestSchema = new Schema<EventGuestDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event" },
  guestId: { type: Schema.Types.ObjectId, required: true, ref: "Guest" },
  rsvpStatus: { type: String, required: true, enum: ["PENDING", "ATTENDING", "NOT_ATTENDING"], default: "PENDING" },
  rsvpRespondedAt: { type: Date }
}, { timestamps: true, collection: "eventGuests" });

eventGuestSchema.index({ eventId: 1, guestId: 1 }, { unique: true, name: "event_guests_one_assignment" });
eventGuestSchema.index({ weddingId: 1, eventId: 1, rsvpStatus: 1 });
eventGuestSchema.index({ weddingId: 1, guestId: 1 });

export const EventGuest = model<EventGuestDocument>("EventGuest", eventGuestSchema);
