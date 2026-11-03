import { model, Schema, Types } from "mongoose";

export const websiteThemeCodes = ["TRADITIONAL", "ROYAL", "FLORAL", "MODERN"] as const;

export type WebsiteConfigDocument = {
  weddingId: Types.ObjectId;
  slug: string;
  slugNormalized: string;
  themeCode: typeof websiteThemeCodes[number];
  status: "DRAFT" | "PUBLISHED";
  content: { introduction?: string; coupleStory?: string; displayNames?: { brideName?: string; groomName?: string }; showEventIds: Types.ObjectId[]; contactDisplay: { showEmail: boolean; showPhone: boolean } };
  createdByUserId: Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const websiteConfigSchema = new Schema<WebsiteConfigDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", unique: true },
  slug: { type: String, required: true, trim: true, maxlength: 80 },
  slugNormalized: { type: String, required: true, trim: true, maxlength: 80, unique: true },
  themeCode: { type: String, required: true, enum: websiteThemeCodes, default: "TRADITIONAL" },
  status: { type: String, required: true, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
  content: {
    introduction: { type: String, trim: true, maxlength: 600 },
    coupleStory: { type: String, trim: true, maxlength: 3000 },
    displayNames: { brideName: { type: String, trim: true, maxlength: 100 }, groomName: { type: String, trim: true, maxlength: 100 } },
    showEventIds: { type: [Schema.Types.ObjectId], default: [] },
    contactDisplay: { showEmail: { type: Boolean, default: false }, showPhone: { type: Boolean, default: false } }
  },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  publishedAt: { type: Date }
}, { timestamps: true, collection: "websiteConfigs" });

websiteConfigSchema.index({ status: 1, slugNormalized: 1 });

export const WebsiteConfig = model<WebsiteConfigDocument>("WebsiteConfig", websiteConfigSchema);
