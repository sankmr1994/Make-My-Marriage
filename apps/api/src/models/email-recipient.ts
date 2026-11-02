import { model, Schema, Types } from "mongoose";
import { emailCampaignTypes, type EmailCampaignType } from "./email-campaign.js";

export const emailRecipientStatuses = ["PENDING", "SUBMITTING", "ACCEPTED", "FAILED"] as const;
export type EmailRecipientStatus = typeof emailRecipientStatuses[number];

export type EmailRecipientDocument = {
  campaignId: Types.ObjectId;
  weddingId: Types.ObjectId;
  guestId: Types.ObjectId;
  eventId: Types.ObjectId;
  recipientKey: string;
  recipientEmail: string;
  messageType: EmailCampaignType;
  status: EmailRecipientStatus;
  attemptCount: number;
  lastErrorCode?: string;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const emailRecipientSchema = new Schema<EmailRecipientDocument>({
  campaignId: { type: Schema.Types.ObjectId, required: true, ref: "EmailCampaign", index: true },
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  guestId: { type: Schema.Types.ObjectId, required: true, ref: "Guest" },
  eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event" },
  recipientKey: { type: String, required: true, maxlength: 320 },
  recipientEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  messageType: { type: String, required: true, enum: emailCampaignTypes },
  status: { type: String, required: true, enum: emailRecipientStatuses, default: "PENDING" },
  attemptCount: { type: Number, required: true, min: 0, default: 0 },
  lastErrorCode: { type: String, maxlength: 240 },
  submittedAt: { type: Date }
}, { timestamps: true, collection: "emailRecipients" });

emailRecipientSchema.index({ campaignId: 1, status: 1 });
emailRecipientSchema.index({ campaignId: 1, recipientKey: 1 }, { unique: true, name: "email_recipients_one_target_per_campaign" });

export const EmailRecipient = model<EmailRecipientDocument>("EmailRecipient", emailRecipientSchema);
