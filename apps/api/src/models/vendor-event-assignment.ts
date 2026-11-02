import { model, Schema, Types } from "mongoose";

export type VendorEventAssignmentDocument = {
  weddingId: Types.ObjectId;
  vendorId: Types.ObjectId;
  eventId: Types.ObjectId;
  notes?: string;
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const vendorEventAssignmentSchema = new Schema<VendorEventAssignmentDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  vendorId: { type: Schema.Types.ObjectId, required: true, ref: "Vendor" },
  eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event" },
  notes: { type: String, trim: true, maxlength: 1000 },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" }
}, { timestamps: true, collection: "vendorEventAssignments" });

vendorEventAssignmentSchema.index({ weddingId: 1, vendorId: 1, eventId: 1 }, { unique: true });
vendorEventAssignmentSchema.index({ weddingId: 1, eventId: 1 });

export const VendorEventAssignment = model<VendorEventAssignmentDocument>("VendorEventAssignment", vendorEventAssignmentSchema);
