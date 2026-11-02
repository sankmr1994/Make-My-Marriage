import { model, Schema, Types } from "mongoose";

export const emailCampaignTypes = ["WEDDING_INVITATION", "RSVP_REMINDER"] as const;
export type EmailCampaignType = typeof emailCampaignTypes[number];
export const emailCampaignStatuses = ["DRAFT", "PROCESSING", "PARTIALLY_SUBMITTED", "SUBMITTED", "FAILED"] as const;
export type EmailCampaignStatus = typeof emailCampaignStatuses[number];

export type EmailCampaignDocument = {
  weddingId: Types.ObjectId;
  eventId: Types.ObjectId;
  type: EmailCampaignType;
  status: EmailCampaignStatus;
  createdByUserId: Types.ObjectId;
  recipientCount: number;
  submittedCount: number;
  failedCount: number;
  lastProcessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const emailCampaignSchema = new Schema<EmailCampaignDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event" },
  type: { type: String, required: true, enum: emailCampaignTypes },
  status: { type: String, required: true, enum: emailCampaignStatuses, default: "DRAFT" },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  recipientCount: { type: Number, required: true, min: 0, default: 0 },
  submittedCount: { type: Number, required: true, min: 0, default: 0 },
  failedCount: { type: Number, required: true, min: 0, default: 0 },
  lastProcessedAt: { type: Date }
}, { timestamps: true, collection: "emailCampaigns" });

emailCampaignSchema.index({ weddingId: 1, createdAt: -1 });
emailCampaignSchema.index({ weddingId: 1, status: 1 });

export const EmailCampaign = model<EmailCampaignDocument>("EmailCampaign", emailCampaignSchema);
