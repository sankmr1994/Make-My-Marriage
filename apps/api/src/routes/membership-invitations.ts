import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { env } from "../config/env.js";
import { enforceAuthRateLimit } from "../middleware/auth-rate-limit.js";
import { enforceRequestOrigin } from "../middleware/request-origin.js";
import { MembershipInvitation } from "../models/membership-invitation.js";
import { Session } from "../models/session.js";
import { User } from "../models/user.js";
import { Wedding } from "../models/wedding.js";
import { WeddingMembership } from "../models/wedding-membership.js";
import { AppError } from "../utils/app-error.js";
import { createOpaqueToken, hashOpaqueToken } from "../utils/credentials.js";

export const membershipInvitationsRouter: ExpressRouter = Router();
membershipInvitationsRouter.use(enforceRequestOrigin, (_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });

const createInvitationSchema = z.object({ email: z.email().trim().max(254), role: z.enum(["ADMIN", "ORGANISER"]) }).strict();
const acceptInvitationSchema = z.object({ token: z.string().min(20).max(200) }).strict();
const invitationIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function normalizedEmail(email: string) { return email.trim().toLowerCase(); }
function validationFailure(response: Response, issues: z.ZodIssue[]) {
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request contains invalid fields.", fieldErrors: Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? "request"), issue.message])) } });
}
function readCookie(request: Request, name: string): string | undefined {
  const value = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!value) return undefined;
  try { return decodeURIComponent(value.slice(name.length + 1)); } catch { return undefined; }
}
async function authenticatedUser(request: Request) {
  const token = readCookie(request, "mmm_session");
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const session = await Session.findOne({ tokenHash: hashOpaqueToken(token), expiresAt: { $gt: new Date() } });
  const user = session ? await User.findOne({ _id: session.userId, status: "ACTIVE" }) : null;
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return user;
}
async function currentMembership(userId: Types.ObjectId) {
  const membership = await WeddingMembership.findOne({ userId, status: "ACTIVE" }).select("weddingId role").lean();
  if (!membership) throw new AppError(404, "NOT_FOUND", "Wedding not found.");
  const wedding = await Wedding.findOne({ _id: membership.weddingId, status: "ACTIVE" }).lean();
  if (!wedding) throw new AppError(404, "NOT_FOUND", "Wedding not found.");
  return { membership, wedding };
}
async function requireAdmin(userId: Types.ObjectId) {
  const context = await currentMembership(userId);
  if (context.membership.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "Only an Admin can manage the wedding team.");
  return context;
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
async function submitInvitationEmail(input: { email: string; token: string; role: "ADMIN" | "ORGANISER"; wedding: { couple: { brideName: string; groomName: string }; location: { city?: string } }; inviter: string }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return "NOT_CONFIGURED" as const;
  const acceptUrl = new URL("/accept-invitation", env.WEB_ORIGIN);
  acceptUrl.searchParams.set("token", input.token);
  const couple = `${input.wedding.couple.brideName} & ${input.wedding.couple.groomName}`;
  const roleLabel = input.role === "ADMIN" ? "Partner — Admin" : "Wedding Organiser";
  const weddingName = `${couple}'s Wedding${input.wedding.location.city ? ` · ${input.wedding.location.city}` : ""}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#262923;max-width:560px;margin:auto;padding:32px"><p style="letter-spacing:.12em;color:#747c68;font-size:12px">MAKE MY MARRIAGE</p><h1 style="font-family:Georgia,serif;font-weight:400">You’re invited to join the wedding team</h1><p>${escapeHtml(input.inviter)} invited you to collaborate on <strong>${escapeHtml(weddingName)}</strong> as <strong>${escapeHtml(roleLabel)}</strong>.</p><p>This invitation is for ${escapeHtml(input.email)} and expires in 7 days. Sign in or create an account with this email address to accept.</p><p style="margin:28px 0"><a href="${escapeHtml(acceptUrl.toString())}" style="background:#262923;color:#fff;text-decoration:none;padding:14px 20px;border-radius:4px">View invitation</a></p><p style="color:#747c68;font-size:12px">If you weren’t expecting this invitation, you can ignore this email.</p></div>`;
  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [input.email], subject: `Invitation to join ${couple}'s wedding team`, html })
    }) as unknown as { ok: boolean; status: number; json: () => Promise<unknown> };
    if (result.ok) return "ACCEPTED" as const;

    const providerError = await result.json().catch(() => null) as { name?: unknown; message?: unknown } | null;
    console.error("Resend rejected a wedding invitation email.", {
      status: result.status,
      code: typeof providerError?.name === "string" ? providerError.name : undefined,
      message: typeof providerError?.message === "string" ? providerError.message : undefined
    });
    return "FAILED" as const;
  } catch (error) {
    console.error("Could not submit a wedding invitation email to Resend.", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    return "FAILED" as const;
  }
}
function serializeInvitation(item: { _id: Types.ObjectId; emailNormalized: string; role: string; status: string; emailSubmissionStatus: string; expiresAt: Date; createdAt: Date }) {
  return { id: String(item._id), email: item.emailNormalized, role: item.role, status: item.status, emailSubmissionStatus: item.emailSubmissionStatus, expiresAt: item.expiresAt, createdAt: item.createdAt };
}

membershipInvitationsRouter.get("/weddings/current/members", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const { membership, wedding } = await currentMembership(user._id);
    const memberships = await WeddingMembership.find({ weddingId: membership.weddingId, status: "ACTIVE" }).sort({ joinedAt: 1 }).lean();
    const users = await User.find({ _id: { $in: memberships.map((item) => item.userId) }, status: "ACTIVE" }).select("displayName email").lean();
    const byId = new Map(users.map((item) => [String(item._id), item]));
    response.status(200).json({ data: { members: memberships.flatMap((item) => {
      const member = byId.get(String(item.userId));
      return member ? [{ id: String(item._id), userId: String(item.userId), displayName: member.displayName, email: member.email, role: item.role, joinedAt: item.joinedAt, isWorkspaceCreator: String(item.userId) === String(wedding.createdByUserId) }] : [];
    }) } });
  } catch (error) { next(error); }
});

membershipInvitationsRouter.get("/weddings/current/membership-invitations", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const { membership } = await requireAdmin(user._id);
    await MembershipInvitation.updateMany({ weddingId: membership.weddingId, status: "PENDING", expiresAt: { $lte: new Date() } }, { $set: { status: "EXPIRED" } });
    const invitations = await MembershipInvitation.find({ weddingId: membership.weddingId, status: { $in: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] } }).sort({ createdAt: -1 }).limit(50).lean();
    response.status(200).json({ data: { invitations: invitations.map(serializeInvitation) } });
  } catch (error) { next(error); }
});

membershipInvitationsRouter.post("/weddings/current/membership-invitations", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const { membership, wedding } = await requireAdmin(user._id);
    await enforceAuthRateLimit(request.ip || request.socket.remoteAddress || "unknown", "membership-invitation-create", 10);
    const parsed = createInvitationSchema.safeParse(request.body);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const emailNormalized = normalizedEmail(parsed.data.email);
    const existingUser = await User.findOne({ emailNormalized, status: "ACTIVE" }).select("_id displayName").lean();
    if (existingUser && await WeddingMembership.exists({ userId: existingUser._id, status: "ACTIVE" })) {
      throw new AppError(409, "ACCOUNT_ALREADY_HAS_WEDDING", "This account already belongs to a wedding.");
    }
    await MembershipInvitation.updateMany({ weddingId: membership.weddingId, emailNormalized, status: "PENDING", expiresAt: { $lte: new Date() } }, { $set: { status: "EXPIRED" } });
    if (await MembershipInvitation.exists({ weddingId: membership.weddingId, emailNormalized, status: "PENDING" })) {
      throw new AppError(409, "INVITATION_ALREADY_PENDING", "An invitation for this email is already pending.");
    }
    if (parsed.data.role === "ADMIN") {
      const [activeAdmins, pendingAdminInvitations] = await Promise.all([
        WeddingMembership.countDocuments({ weddingId: membership.weddingId, role: "ADMIN", status: "ACTIVE" }),
        MembershipInvitation.countDocuments({ weddingId: membership.weddingId, role: "ADMIN", status: "PENDING", expiresAt: { $gt: new Date() } })
      ]);
      if (activeAdmins + pendingAdminInvitations >= 2) throw new AppError(409, "ADMIN_LIMIT_REACHED", "A wedding can have at most two Admins.");
    }
    const rawToken = createOpaqueToken();
    const invitation = await MembershipInvitation.create({ weddingId: membership.weddingId, emailNormalized, role: parsed.data.role, invitedByUserId: user._id, tokenHash: hashOpaqueToken(rawToken), status: "PENDING", emailSubmissionStatus: "NOT_CONFIGURED", expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS) });
    const emailSubmissionStatus = await submitInvitationEmail({ email: parsed.data.email.trim(), token: rawToken, role: parsed.data.role, wedding, inviter: user.displayName });
    invitation.emailSubmissionStatus = emailSubmissionStatus;
    await invitation.save();
    response.status(201).json({ data: { invitationId: String(invitation._id), invitation: serializeInvitation(invitation), role: invitation.role, status: invitation.status, emailSubmissionStatus } });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
      const keyPattern = error.keyPattern as Record<string, unknown> | undefined;
      if (keyPattern?.role) return next(new AppError(409, "ADMIN_LIMIT_REACHED", "A partner/Admin invitation is already pending or the two Admin slots are assigned."));
      return next(new AppError(409, "INVITATION_ALREADY_PENDING", "An invitation for this email is already pending."));
    }
    next(error);
  }
});

membershipInvitationsRouter.post("/weddings/current/membership-invitations/:invitationId/resend", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const { membership, wedding } = await requireAdmin(user._id);
    await enforceAuthRateLimit(request.ip || request.socket.remoteAddress || "unknown", "membership-invitation-resend", 20);
    const parsedId = invitationIdSchema.safeParse(request.params.invitationId);
    if (!parsedId.success) { validationFailure(response, parsedId.error.issues); return; }
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new AppError(503, "EMAIL_NOT_CONFIGURED", "Invitation email is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to the API environment, then try again.");
    const current = await MembershipInvitation.findOneAndUpdate({ _id: parsedId.data, weddingId: membership.weddingId, status: "PENDING", expiresAt: { $gt: new Date() } }, { $set: { status: "REVOKED" } }, { new: true });
    if (!current) throw new AppError(404, "NOT_FOUND", "Pending invitation not found.");
    const oldEmail = current.emailNormalized;
    const rawToken = createOpaqueToken();
    let replacement;
    try {
      replacement = await MembershipInvitation.create({ weddingId: membership.weddingId, emailNormalized: oldEmail, role: current.role, invitedByUserId: user._id, tokenHash: hashOpaqueToken(rawToken), status: "PENDING", emailSubmissionStatus: "NOT_CONFIGURED", expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS) });
    } catch (error) {
      if (!await MembershipInvitation.exists({ weddingId: membership.weddingId, emailNormalized: oldEmail, status: "PENDING" })) {
        await MembershipInvitation.updateOne({ _id: current._id, status: "REVOKED" }, { $set: { status: "PENDING" } }).catch(() => undefined);
      }
      throw error;
    }
    const emailSubmissionStatus = await submitInvitationEmail({ email: oldEmail, token: rawToken, role: current.role, wedding, inviter: user.displayName });
    replacement.emailSubmissionStatus = emailSubmissionStatus;
    await replacement.save();
    response.status(201).json({ data: { invitationId: String(replacement._id), invitation: serializeInvitation(replacement), role: replacement.role, status: replacement.status, emailSubmissionStatus } });
  } catch (error) { next(error); }
});

membershipInvitationsRouter.delete("/weddings/current/membership-invitations/:invitationId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const { membership } = await requireAdmin(user._id);
    const parsedId = invitationIdSchema.safeParse(request.params.invitationId);
    if (!parsedId.success) { validationFailure(response, parsedId.error.issues); return; }
    const invitation = await MembershipInvitation.findOneAndUpdate({ _id: parsedId.data, weddingId: membership.weddingId, status: "PENDING" }, { $set: { status: "REVOKED" } }, { new: true });
    if (!invitation) throw new AppError(404, "NOT_FOUND", "Pending invitation not found.");
    response.status(200).json({ data: { invitation: serializeInvitation(invitation) } });
  } catch (error) { next(error); }
});

membershipInvitationsRouter.delete("/weddings/current/members/:membershipId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const { membership, wedding } = await requireAdmin(user._id);
    const parsedId = invitationIdSchema.safeParse(request.params.membershipId);
    if (!parsedId.success) { validationFailure(response, parsedId.error.issues); return; }
    const target = await WeddingMembership.findOne({ _id: parsedId.data, weddingId: membership.weddingId, status: "ACTIVE" }).select("userId").lean();
    if (!target) throw new AppError(404, "NOT_FOUND", "Active wedding member not found.");
    if (String(target.userId) === String(wedding.createdByUserId)) {
      throw new AppError(403, "WORKSPACE_CREATOR_PROTECTED", "The wedding workspace creator cannot be removed.");
    }
    const removed = await WeddingMembership.findOneAndUpdate(
      { _id: parsedId.data, weddingId: membership.weddingId, status: "ACTIVE", userId: { $ne: wedding.createdByUserId } },
      { $set: { status: "REMOVED", removedAt: new Date() } },
      { new: true }
    );
    if (!removed) throw new AppError(404, "NOT_FOUND", "Active wedding member not found.");
    response.status(200).json({ data: { removed: true } });
  } catch (error) { next(error); }
});

membershipInvitationsRouter.get("/membership-invitations/:token", async (request, response, next) => {
  try {
    const parsed = acceptInvitationSchema.safeParse({ token: request.params.token });
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const invitation = await MembershipInvitation.findOne({ tokenHash: hashOpaqueToken(parsed.data.token) }).select("+tokenHash").lean();
    if (!invitation) throw new AppError(404, "INVITATION_NOT_FOUND", "This invitation link is invalid.");
    if (invitation.status === "PENDING" && invitation.expiresAt <= new Date()) {
      await MembershipInvitation.updateOne({ _id: invitation._id, status: "PENDING" }, { $set: { status: "EXPIRED" } });
      invitation.status = "EXPIRED";
    }
    if (invitation.status !== "PENDING") {
      response.status(200).json({ data: { invitation: { status: invitation.status } } });
      return;
    }
    const [wedding, inviter] = await Promise.all([
      Wedding.findOne({ _id: invitation.weddingId, status: "ACTIVE" }).select("couple weddingDate location").lean(),
      User.findById(invitation.invitedByUserId).select("displayName").lean()
    ]);
    if (!wedding) throw new AppError(404, "INVITATION_NOT_FOUND", "This invitation link is no longer available.");
    response.status(200).json({ data: { invitation: { email: invitation.emailNormalized, role: invitation.role, status: invitation.status, expiresAt: invitation.expiresAt, invitedBy: inviter?.displayName ?? "A wedding Admin" }, wedding: { couple: wedding.couple, weddingDate: wedding.weddingDate, location: wedding.location } } });
  } catch (error) { next(error); }
});

membershipInvitationsRouter.post("/membership-invitations/accept", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const parsed = acceptInvitationSchema.safeParse(request.body);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const tokenHash = hashOpaqueToken(parsed.data.token);
    const invitation = await MembershipInvitation.findOne({ tokenHash }).select("+tokenHash");
    if (!invitation) throw new AppError(410, "TOKEN_EXPIRED_OR_REVOKED", "This invitation is invalid, expired, or revoked.");
    if (invitation.emailNormalized !== normalizedEmail(user.email)) throw new AppError(403, "INVITED_EMAIL_MISMATCH", "Sign in with the email address this invitation was sent to.");
    if (invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) {
      if (invitation.status === "PENDING") { invitation.status = "EXPIRED"; await invitation.save(); }
      throw new AppError(410, "TOKEN_EXPIRED_OR_REVOKED", "This invitation is invalid, expired, or revoked.");
    }
    if (await WeddingMembership.exists({ userId: user._id, status: "ACTIVE" })) throw new AppError(409, "USER_ALREADY_HAS_WEDDING", "This account already belongs to a wedding.");
    if (invitation.role === "ADMIN") {
      const count = await WeddingMembership.countDocuments({ weddingId: invitation.weddingId, role: "ADMIN", status: "ACTIVE" });
      if (count >= 2) throw new AppError(409, "ADMIN_LIMIT_REACHED", "This wedding already has two active Admins.");
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const claimed = await MembershipInvitation.findOneAndUpdate({ _id: invitation._id, status: "PENDING", expiresAt: { $gt: new Date() } }, { $set: { status: "ACCEPTED", acceptedByUserId: user._id, acceptedAt: new Date() } }, { new: true, session });
        if (!claimed) throw new AppError(410, "TOKEN_EXPIRED_OR_REVOKED", "This invitation is invalid, expired, or revoked.");
        await WeddingMembership.create([{ weddingId: invitation.weddingId, userId: user._id, role: invitation.role, status: "ACTIVE", invitedByUserId: invitation.invitedByUserId, joinedAt: new Date() }], { session });
      });
    } catch (error) {
      if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 20) throw error;
      const claimed = await MembershipInvitation.findOneAndUpdate({ _id: invitation._id, status: "PENDING", expiresAt: { $gt: new Date() } }, { $set: { status: "ACCEPTED", acceptedByUserId: user._id, acceptedAt: new Date() } }, { new: true });
      if (!claimed) throw new AppError(410, "TOKEN_EXPIRED_OR_REVOKED", "This invitation is invalid, expired, or revoked.");
      try {
        await WeddingMembership.create({ weddingId: invitation.weddingId, userId: user._id, role: invitation.role, status: "ACTIVE", invitedByUserId: invitation.invitedByUserId, joinedAt: new Date() });
      } catch (membershipError) {
        await MembershipInvitation.updateOne({ _id: invitation._id, status: "ACCEPTED", acceptedByUserId: user._id }, { $set: { status: "PENDING" }, $unset: { acceptedByUserId: 1, acceptedAt: 1 } });
        throw membershipError;
      }
    } finally { await session.endSession(); }
    response.status(200).json({ data: { accepted: true, weddingId: String(invitation.weddingId), role: invitation.role } });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) return next(new AppError(409, "USER_ALREADY_HAS_WEDDING", "This account already belongs to a wedding."));
    next(error);
  }
});
