import { model, Schema, Types } from "mongoose";

export type MembershipInvitationDocument = {
  weddingId: Types.ObjectId;
  emailNormalized: string;
  role: "ADMIN" | "ORGANISER";
  invitedByUserId: Types.ObjectId;
  tokenHash: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  emailSubmissionStatus: "ACCEPTED" | "FAILED" | "NOT_CONFIGURED";
  expiresAt: Date;
  acceptedByUserId?: Types.ObjectId;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const membershipInvitationSchema = new Schema<MembershipInvitationDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding" },
  emailNormalized: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  role: { type: String, required: true, enum: ["ADMIN", "ORGANISER"] },
  invitedByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  tokenHash: { type: String, required: true, unique: true, select: false },
  status: { type: String, required: true, enum: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] },
  emailSubmissionStatus: { type: String, required: true, enum: ["ACCEPTED", "FAILED", "NOT_CONFIGURED"], default: "NOT_CONFIGURED" },
  expiresAt: { type: Date, required: true },
  acceptedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  acceptedAt: { type: Date }
}, { timestamps: true, collection: "membershipInvitations" });

membershipInvitationSchema.index({ weddingId: 1, emailNormalized: 1 }, { unique: true, partialFilterExpression: { status: "PENDING" }, name: "membership_invitations_one_pending_per_email" });
membershipInvitationSchema.index({ weddingId: 1, role: 1 }, { unique: true, partialFilterExpression: { role: "ADMIN", status: "PENDING" }, name: "membership_invitations_one_pending_admin" });
membershipInvitationSchema.index({ weddingId: 1, status: 1, createdAt: -1 }, { name: "membership_invitations_by_wedding_status" });
membershipInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "membership_invitation_expiry_ttl" });

export const MembershipInvitation = model<MembershipInvitationDocument>("MembershipInvitation", membershipInvitationSchema);
