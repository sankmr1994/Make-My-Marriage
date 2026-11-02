import { model, Schema, Types } from "mongoose";

export const vendorCategories = ["PHOTOGRAPHER", "VIDEOGRAPHER", "DECORATOR", "BACKDROP_DECORATOR", "MAKEUP_ARTIST", "MEHENDI_ARTIST", "CATERER", "VENUE", "DJ_MUSIC", "EVENT_PLANNER", "FLORIST", "INVITATION_PRINTING", "TRANSPORTATION", "OTHER"] as const;
export const vendorPlanningStatuses = ["SHORTLISTED", "CONTACTED", "CONTRACTED", "DECLINED"] as const;

export type VendorDocument = {
  weddingId: Types.ObjectId;
  name: string;
  category: typeof vendorCategories[number];
  source: "MANUAL" | "GOOGLE_PLACES" | "GEOAPIFY";
  providerPlaceId?: string;
  googlePlaceId?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  notes?: string;
  planningStatus: typeof vendorPlanningStatuses[number];
  status: "ACTIVE" | "ARCHIVED";
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const vendorSchema = new Schema<VendorDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, required: true, enum: vendorCategories },
  // GOOGLE_PLACES remains valid for records saved before the discovery provider migration.
  source: { type: String, required: true, enum: ["MANUAL", "GOOGLE_PLACES", "GEOAPIFY"], default: "MANUAL" },
  providerPlaceId: { type: String, trim: true, maxlength: 200 },
  googlePlaceId: { type: String, trim: true, maxlength: 200 },
  contactPerson: { type: String, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, maxlength: 40 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254 },
  address: { type: String, trim: true, maxlength: 500 },
  website: { type: String, trim: true, maxlength: 500 },
  notes: { type: String, trim: true, maxlength: 2000 },
  planningStatus: { type: String, required: true, enum: vendorPlanningStatuses, default: "SHORTLISTED" },
  status: { type: String, required: true, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE" },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" }
}, { timestamps: true, collection: "vendors" });

vendorSchema.index({ weddingId: 1, status: 1, category: 1, name: 1 });
vendorSchema.index({ weddingId: 1, googlePlaceId: 1 }, { unique: true, partialFilterExpression: { googlePlaceId: { $type: "string" } } });
vendorSchema.index({ weddingId: 1, source: 1, providerPlaceId: 1 }, { unique: true, partialFilterExpression: { providerPlaceId: { $type: "string" } } });

export const Vendor = model<VendorDocument>("Vendor", vendorSchema);
