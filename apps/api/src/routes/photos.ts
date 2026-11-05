import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { z } from "zod";
import { enforceRequestOrigin } from "../middleware/request-origin.js";
import { enforceAuthRateLimit } from "../middleware/auth-rate-limit.js";
import { Event } from "../models/event.js";
import { GuestAccessLink } from "../models/guest-access-link.js";
import { Photo } from "../models/photo.js";
import { Guest } from "../models/guest.js";
import { PhotoUploadSession, photoUploadPurposes } from "../models/photo-upload-session.js";
import { Session } from "../models/session.js";
import { User } from "../models/user.js";
import { Wedding } from "../models/wedding.js";
import { WeddingMembership } from "../models/wedding-membership.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { createOpaqueToken, hashOpaqueToken } from "../utils/credentials.js";
import { createDownloadUrl, createUploadUrl, deleteObject, inspectObject } from "../utils/r2-storage.js";

export const photosRouter: ExpressRouter = Router();
photosRouter.use(enforceRequestOrigin, (_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const imageType = z.enum(["image/jpeg", "image/png", "image/webp"]);
const maximumSizeBytes = 20 * 1024 * 1024;
const tokenSchema = z.string().min(40).max(100);
const accessPurpose = z.enum(["PHOTO_UPLOAD", "GALLERY_VIEW"]);
const uploadPurpose = z.enum(photoUploadPurposes);
const guestLinkInput = z.object({ purpose: accessPurpose, eventId: objectId.optional(), expiresAt: z.iso.datetime({ offset: true }).optional() }).strict();
const guestLinkListQuery = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), search: z.string().trim().max(120).optional(), purpose: accessPurpose.optional(), includeRevoked: z.enum(["true", "false"]).default("false") }).strict();
const uploadInput = z.object({
  purpose: uploadPurpose.default("GALLERY_PHOTO"), eventId: objectId.optional(),
  expectedContentType: imageType, expectedSizeBytes: z.number().int().min(1).max(maximumSizeBytes),
  originalFilename: z.string().trim().min(1).max(160).optional()
}).strict();
const publicUploadInput = z.object({ token: tokenSchema, eventId: objectId.optional(), expectedContentType: imageType, expectedSizeBytes: z.number().int().min(1).max(maximumSizeBytes), originalFilename: z.string().trim().min(1).max(160).optional() }).strict();
const guestPhotoLinksInput = z.object({ guestId: objectId, purposes: z.array(accessPurpose).min(1).max(2).refine((purposes) => new Set(purposes).size === purposes.length, "Choose each link type only once."), sendEmail: z.boolean().default(true) }).strict();
const moderationInput = z.object({ moderationStatus: z.enum(["VISIBLE", "REJECTED"]) }).strict();
const listQuery = z.object({ status: z.enum(["PENDING_REVIEW", "VISIBLE", "REJECTED", "DELETED"]).optional(), eventId: objectId.optional(), scope: z.enum(["ALL", "COMMON"]).optional(), uploaderType: z.enum(["GUEST", "ADMIN", "ORGANISER"]).optional(), uploaderUserId: objectId.optional(), guestId: objectId.optional(), limit: z.coerce.number().int().min(1).max(100).default(40), before: z.iso.datetime({ offset: true }).optional() }).strict().refine((value) => !(value.eventId && value.scope && value.scope !== "ALL"), "Choose either an event or common photos.").refine((value) => !(value.uploaderUserId && value.guestId), "Choose either a team member or a guest.");
const publicGalleryQuery = z.object({ eventId: objectId.optional(), scope: z.enum(["ALL", "COMMON"]).optional(), limit: z.coerce.number().int().min(1).max(100).default(40), before: z.iso.datetime({ offset: true }).optional() }).strict().refine((value) => !(value.eventId && value.scope && value.scope !== "ALL"), "Choose either an event or common photos.");

function cookieValue(request: Request, name: string) {
  const value = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!value) return undefined;
  try { return decodeURIComponent(value.slice(name.length + 1)); } catch { return undefined; }
}
async function adminScope(request: Request) {
  const token = cookieValue(request, "mmm_session");
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const session = await Session.findOne({ tokenHash: hashOpaqueToken(token), expiresAt: { $gt: new Date() } });
  const user = session ? await User.findOne({ _id: session.userId, status: "ACTIVE" }) : null;
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const membership = await WeddingMembership.findOne({ userId: user._id, status: "ACTIVE" }).select("weddingId role").lean();
  if (!membership || !["ADMIN", "ORGANISER"].includes(membership.role)) throw new AppError(403, "FORBIDDEN", "Only wedding Admins and Organisers can manage photos.");
  return { user, membership };
}
function validationError(response: Response, issues: z.ZodIssue[]) {
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request contains invalid fields.", fieldErrors: Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? "request"), issue.message])) } });
}
function cleanFilename(filename?: string) { return filename?.replaceAll("/", "_").replaceAll("\\", "_").split("").filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join("").slice(0, 160); }
function photoView(photo: { _id: unknown; weddingId: unknown; eventId?: unknown; originalFilename?: string; contentType: string; sizeBytes: number; uploaderType: string; moderationStatus: string; createdAt: Date; updatedAt: Date }) {
  return { id: String(photo._id), weddingId: String(photo.weddingId), eventId: photo.eventId ? String(photo.eventId) : undefined, originalFilename: photo.originalFilename, contentType: photo.contentType, sizeBytes: photo.sizeBytes, uploaderType: photo.uploaderType, moderationStatus: photo.moderationStatus, createdAt: photo.createdAt, updatedAt: photo.updatedAt };
}
async function activeEvent(weddingId: unknown, eventId: string) {
  const event = await Event.findOne({ _id: eventId, weddingId, status: "ACTIVE" });
  if (!event) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "Select an active ceremony from this wedding.");
  return event;
}
async function verifyImageBytes(objectKey: string, contentType: string) {
  const response = await fetch(createDownloadUrl(objectKey, 60), { headers: { Range: "bytes=0-11" } });
  if (!response.ok || !response.body) return false;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < 12) {
      const chunk = await reader.read();
      if (chunk.done) break;
      chunks.push(chunk.value);
      length += chunk.value.length;
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const prefix = new Uint8Array(Math.min(length, 12));
  let offset = 0;
  for (const chunk of chunks) { const count = Math.min(chunk.length, prefix.length - offset); prefix.set(chunk.subarray(0, count), offset); offset += count; if (offset === prefix.length) break; }
  if (contentType === "image/jpeg") return prefix.length >= 3 && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff;
  if (contentType === "image/png") return prefix.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => prefix[index] === value);
  if (contentType === "image/webp") return prefix.length >= 12 && String.fromCharCode(...prefix.subarray(0, 4)) === "RIFF" && String.fromCharCode(...prefix.subarray(8, 12)) === "WEBP";
  return false;
}
async function validGuestLink(token: string, purpose: "PHOTO_UPLOAD" | "GALLERY_VIEW") {
  const link = await GuestAccessLink.findOne({ tokenHash: hashOpaqueToken(token), purpose, revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
  if (!link) throw new AppError(401, "INVALID_GUEST_LINK", "This photo link is invalid, expired, or revoked.");
  const wedding = await Wedding.findOne({ _id: link.weddingId, status: "ACTIVE" }).select("_id");
  if (!wedding) throw new AppError(404, "NOT_FOUND", "This wedding is no longer available.");
  if (link.guestId && !await Guest.exists({ _id: link.guestId, weddingId: link.weddingId, status: "ACTIVE" })) throw new AppError(401, "INVALID_GUEST_LINK", "This guest link is no longer available.");
  return link;
}
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }
async function submitPhotoLinksEmail(input: { email: string; guestName: string; weddingName: string; links: Array<{ purpose: "PHOTO_UPLOAD" | "GALLERY_VIEW"; url: string }> }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return { status: "NOT_CONFIGURED" as const };
  const items = input.links.map((link) => `<p style="margin:18px 0"><a href="${escapeHtml(link.url)}" style="display:inline-block;background:#262923;color:#fff;text-decoration:none;padding:14px 20px;border-radius:4px">${link.purpose === "PHOTO_UPLOAD" ? "Upload wedding photos" : "View wedding gallery"}</a></p>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#262923;max-width:560px;margin:auto;padding:32px"><p style="letter-spacing:.12em;color:#747c68;font-size:12px">MAKE MY MARRIAGE</p><h1 style="font-family:Georgia,serif;font-weight:400">Wedding photo access</h1><p>Dear ${escapeHtml(input.guestName)},</p><p>You have been given access to photos for <strong>${escapeHtml(input.weddingName)}</strong>. Use the link${input.links.length === 1 ? "" : "s"} below. ${input.links.some((link) => link.purpose === "PHOTO_UPLOAD") ? "Guest uploads are reviewed by the wedding team before appearing in the gallery." : "The gallery shows approved photos."}</p>${items}<p style="color:#747c68;font-size:12px">These private links expire in 90 days. Please do not forward them.</p></div>`;
  try {
    const result = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [input.email], subject: `Wedding photos · ${input.weddingName}`, html }) });
    if (!result.ok) return { status: "FAILED" as const };
    return { status: "ACCEPTED" as const };
  } catch { return { status: "FAILED" as const }; }
}
async function rateLimitPublic(request: Request, operation: string, limit: number) {
  await enforceAuthRateLimit(request.ip || request.socket.remoteAddress || "unknown", `photo-${operation}`, limit);
}
async function createUploadSession(input: z.infer<typeof uploadInput>, options: { weddingId: Types.ObjectId; guestAccessLinkId?: Types.ObjectId; guestId?: Types.ObjectId; uploaderType: "GUEST" | "ADMIN" | "ORGANISER"; uploaderUserId?: Types.ObjectId; contributorName?: string }) {
  const event = input.eventId ? await activeEvent(options.weddingId, input.eventId) : null;
  if (input.purpose === "WEDDING_COVER" && input.eventId) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "A wedding cover cannot be assigned to an event.");
  if (input.purpose === "EVENT_COVER" && !event) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "Select a ceremony for its cover photo.");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const weddingPrefix = `weddings/${String(options.weddingId)}`;
  const eventSlug = event?.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
  const objectKey = input.purpose === "WEDDING_COVER"
    ? `${weddingPrefix}/cover/${randomUUID()}`
    : input.purpose === "EVENT_COVER" && event
      ? `${weddingPrefix}/events/${eventSlug}-${String(event._id)}/cover/${randomUUID()}`
      : event
        ? `${weddingPrefix}/events/${eventSlug}-${String(event._id)}/photos/${randomUUID()}`
        : `${weddingPrefix}/photos/${randomUUID()}`;
  const uploadUrl = createUploadUrl(objectKey, input.expectedContentType);
  const session = await PhotoUploadSession.create({
    weddingId: options.weddingId, eventId: event?._id, guestAccessLinkId: options.guestAccessLinkId, guestId: options.guestId,
    purpose: input.purpose, objectKey,
    expectedContentType: input.expectedContentType, expectedSizeBytes: input.expectedSizeBytes,
    originalFilename: cleanFilename(input.originalFilename), uploadUrlExpiresAt: expiresAt,
    purgeAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), uploaderType: options.uploaderType,
    uploaderUserId: options.uploaderUserId, contributorName: options.uploaderType === "GUEST" ? undefined : options.contributorName?.trim().slice(0, 100)
  });
  return { sessionId: String(session._id), uploadUrl, method: "PUT" as const, requiredHeaders: { "Content-Type": session.expectedContentType }, uploadUrlExpiresAt: expiresAt };
}
async function completeUpload(sessionId: string, token?: string) {
  const session = await PhotoUploadSession.findById(sessionId);
  if (!session) throw new AppError(404, "NOT_FOUND", "Upload session not found.");
  if (token) {
    const link = await validGuestLink(token, "PHOTO_UPLOAD");
    if (!session.guestAccessLinkId || !session.guestAccessLinkId.equals(link._id) || !session.weddingId.equals(link.weddingId)) throw new AppError(403, "FORBIDDEN", "This upload session belongs to another photo link.");
  }
  if (session.status === "COMPLETED") {
    const existing = await Photo.findOne({ objectKey: session.objectKey });
    return existing ? { photo: photoView(existing), alreadyCompleted: true } : { photo: null, alreadyCompleted: true };
  }
  if (session.status !== "PENDING") throw new AppError(409, "UPLOAD_NOT_PENDING", "This upload session can no longer be completed.");
  if (session.uploadUrlExpiresAt.getTime() <= Date.now()) {
    session.status = "EXPIRED";
    await session.save();
    throw new AppError(410, "UPLOAD_EXPIRED", "The upload link expired. Request a new upload link and try again.");
  }
  if (session.purpose === "GALLERY_PHOTO") {
    const metadata = await inspectObject(session.objectKey);
    const imageBytesValid = metadata ? await verifyImageBytes(session.objectKey, metadata.contentType) : false;
    if (!metadata || metadata.sizeBytes !== session.expectedSizeBytes || metadata.contentType !== session.expectedContentType || !imageBytesValid) {
      session.status = "REJECTED";
      await session.save();
      await deleteObject(session.objectKey).catch(() => null);
      throw new AppError(422, "UPLOAD_METADATA_MISMATCH", "Uploaded file size or image type did not match the request.");
    }
    const moderationStatus = session.uploaderType === "GUEST" ? "PENDING_REVIEW" : "VISIBLE";
    const photo = await Photo.findOneAndUpdate({ objectKey: session.objectKey }, { $setOnInsert: {
      weddingId: session.weddingId, eventId: session.eventId, objectKey: session.objectKey,
      originalFilename: session.originalFilename, contentType: metadata.contentType, sizeBytes: metadata.sizeBytes,
      etag: metadata.etag, uploaderType: session.uploaderType, uploaderUserId: session.uploaderUserId, guestId: session.guestId,
      contributorName: session.contributorName, guestAccessLinkId: session.guestAccessLinkId,
      moderationStatus
    } }, { upsert: true, new: true, runValidators: true });
    session.status = "COMPLETED";
    session.completedAt = new Date();
    await session.save();
    return { photo: photoView(photo), alreadyCompleted: false };
  }
  const metadata = await inspectObject(session.objectKey);
  const imageBytesValid = metadata ? await verifyImageBytes(session.objectKey, metadata.contentType) : false;
  if (!metadata || metadata.sizeBytes !== session.expectedSizeBytes || metadata.contentType !== session.expectedContentType || !imageBytesValid) {
    session.status = "REJECTED";
    await session.save();
    await deleteObject(session.objectKey).catch(() => null);
    throw new AppError(422, "UPLOAD_METADATA_MISMATCH", "Uploaded file size or image type did not match the request.");
  }
  if (session.purpose === "WEDDING_COVER") await Wedding.updateOne({ _id: session.weddingId }, { $set: { "couple.photoObjectKey": session.objectKey } });
  else if (session.eventId) await Event.updateOne({ _id: session.eventId, weddingId: session.weddingId }, { $set: { coverPhotoObjectKey: session.objectKey } });
  session.status = "COMPLETED";
  session.completedAt = new Date();
  await session.save();
  return { photo: null, alreadyCompleted: false };
}

photosRouter.post("/weddings/current/guest-access-links", async (request, response, next) => {
  try {
    const { user, membership } = await adminScope(request);
    const parsed = guestLinkInput.safeParse(request.body);
    if (!parsed.success) { validationError(response, parsed.error.issues); return; }
    const event = parsed.data.eventId ? await activeEvent(membership.weddingId, parsed.data.eventId) : null;
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    if (expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "Choose an expiry in the next 365 days.");
    const token = createOpaqueToken();
    const link = await GuestAccessLink.create({ weddingId: membership.weddingId, purpose: parsed.data.purpose, eventId: event?._id, tokenHash: hashOpaqueToken(token), expiresAt, createdByUserId: user._id });
    response.status(201).json({ data: { link: { id: String(link._id), purpose: link.purpose, eventId: link.eventId ? String(link.eventId) : undefined, expiresAt: link.expiresAt }, token, url: new URL(`${parsed.data.purpose === "PHOTO_UPLOAD" ? "/share/photos" : "/share/gallery"}#${token}`, env.WEB_ORIGIN).toString() } });
  } catch (error) { next(error); }
});

photosRouter.post("/weddings/current/guest-photo-links", async (request, response, next) => {
  try {
    const { user, membership } = await adminScope(request);
    await rateLimitPublic(request, "guest-photo-link-create", 20);
    const parsed = guestPhotoLinksInput.safeParse(request.body);
    if (!parsed.success) { validationError(response, parsed.error.issues); return; }
    const guest = await Guest.findOne({ _id: parsed.data.guestId, weddingId: membership.weddingId, status: "ACTIVE" }).lean();
    if (!guest) throw new AppError(404, "NOT_FOUND", "Active guest record not found in this wedding.");
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const links = await Promise.all(parsed.data.purposes.map(async (purpose) => {
      const token = createOpaqueToken();
      const link = await GuestAccessLink.create({ weddingId: membership.weddingId, guestId: guest._id, purpose, tokenHash: hashOpaqueToken(token), expiresAt, createdByUserId: user._id });
      return { link: { id: String(link._id), guestId: String(guest._id), purpose: link.purpose, expiresAt: link.expiresAt, createdAt: link.createdAt }, token, url: new URL(`${purpose === "PHOTO_UPLOAD" ? "/share/photos" : "/share/gallery"}#${token}`, env.WEB_ORIGIN).toString() };
    }));
    const [wedding, guestLinks] = await Promise.all([Wedding.findById(membership.weddingId).select("couple").lean(), GuestAccessLink.find({ weddingId: membership.weddingId, guestId: guest._id }).select("purpose expiresAt revokedAt createdAt").sort({ createdAt: -1 }).limit(12).lean()]);
    const weddingName = wedding ? `${wedding.couple.brideName} & ${wedding.couple.groomName}'s Wedding` : "the wedding";
    const emailResult = parsed.data.sendEmail ? await submitPhotoLinksEmail({ email: guest.email, guestName: guest.primaryContactName, weddingName, links: links.map(({ link, url }) => ({ purpose: link.purpose, url })) }) : { status: "NOT_REQUESTED" as const };
    response.status(201).json({ data: { links: links.map(({ link, token, url }) => ({ ...link, token, url })), emailSubmissionStatus: emailResult.status, guestLinks: guestLinks.map((link) => ({ purpose: link.purpose, expiresAt: link.expiresAt, revokedAt: link.revokedAt, createdAt: link.createdAt })) } });
  } catch (error) { next(error); }
});

photosRouter.get("/weddings/current/guest-access-links", async (request, response, next) => {
  try {
    const { membership } = await adminScope(request);
    const parsed = guestLinkListQuery.safeParse(request.query);
    if (!parsed.success) { validationError(response, parsed.error.issues); return; }
    const query = parsed.data;
    const filter: Record<string, unknown> = { weddingId: membership.weddingId };
    if (query.purpose) filter.purpose = query.purpose;
    if (!query.includeRevoked || query.includeRevoked === "false") filter.revokedAt = null;
    if (query.search) {
      const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matchingGuests = await Guest.find({ weddingId: membership.weddingId, $or: [{ primaryContactName: { $regex: escapedSearch, $options: "i" } }, { email: { $regex: escapedSearch, $options: "i" } }] }).select("_id").lean();
      filter.guestId = { $in: matchingGuests.map((guest) => guest._id) };
    }
    const total = await GuestAccessLink.countDocuments(filter);
    const revokedCount = await GuestAccessLink.countDocuments({ ...filter, revokedAt: { $ne: null } });
    const pageSize = 7;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(query.page, totalPages);
    const links = await GuestAccessLink.find(filter).select("purpose eventId guestId expiresAt revokedAt createdAt").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean();
    const guests = await Guest.find({ _id: { $in: links.flatMap((link) => link.guestId ? [link.guestId] : []) }, weddingId: membership.weddingId }).select("primaryContactName email").lean();
    const guestNames = new Map(guests.map((guest) => [String(guest._id), guest.primaryContactName]));
    response.status(200).json({ data: { links: links.map((link) => ({ id: String(link._id), purpose: link.purpose, eventId: link.eventId ? String(link.eventId) : undefined, guestId: link.guestId ? String(link.guestId) : undefined, guestName: link.guestId ? guestNames.get(String(link.guestId)) : undefined, expiresAt: link.expiresAt, revokedAt: link.revokedAt, createdAt: link.createdAt })), pagination: { page, pageSize, total, totalPages, revokedCount } } });
  } catch (error) { next(error); }
});

photosRouter.post("/weddings/current/guest-access-links/:linkId/revoke", async (request, response, next) => {
  try {
    const { membership } = await adminScope(request);
    const id = objectId.safeParse(request.params.linkId);
    if (!id.success) { validationError(response, id.error.issues); return; }
    const link = await GuestAccessLink.findOneAndUpdate({ _id: id.data, weddingId: membership.weddingId, revokedAt: null }, { $set: { revokedAt: new Date() } }, { new: true });
    if (!link) throw new AppError(404, "NOT_FOUND", "Active photo link not found.");
    response.status(200).json({ data: { link: { id: String(link._id), revokedAt: link.revokedAt } } });
  } catch (error) { next(error); }
});

photosRouter.post("/weddings/current/guest-access-links/:linkId/reissue", async (request, response, next) => {
  try {
    const { user, membership } = await adminScope(request);
    const id = objectId.safeParse(request.params.linkId);
    if (!id.success) { validationError(response, id.error.issues); return; }
    const previous = await GuestAccessLink.findOne({ _id: id.data, weddingId: membership.weddingId, revokedAt: null });
    if (!previous) throw new AppError(404, "NOT_FOUND", "Active photo link not found.");
    const linkedGuest = previous.guestId ? await Guest.findOne({ _id: previous.guestId, weddingId: membership.weddingId, status: "ACTIVE" }).lean() : null;
    if (previous.guestId && !linkedGuest) throw new AppError(404, "NOT_FOUND", "The linked guest is no longer active.");
    const token = createOpaqueToken();
    const expiresAt = previous.expiresAt && previous.expiresAt.getTime() > Date.now()
      ? previous.expiresAt
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const replacement = await GuestAccessLink.create({ weddingId: previous.weddingId, guestId: previous.guestId, purpose: previous.purpose, eventId: previous.eventId, tokenHash: hashOpaqueToken(token), expiresAt, createdByUserId: user._id });
    const revoked = await GuestAccessLink.updateOne({ _id: previous._id, weddingId: membership.weddingId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    if (revoked.modifiedCount !== 1) {
      await GuestAccessLink.deleteOne({ _id: replacement._id, weddingId: membership.weddingId });
      throw new AppError(409, "LINK_CHANGED", "This link changed while being refreshed. Reload the list and try again.");
    }
    const url = new URL(`${replacement.purpose === "PHOTO_UPLOAD" ? "/share/photos" : "/share/gallery"}#${token}`, env.WEB_ORIGIN).toString();
    let emailSubmissionStatus: "ACCEPTED" | "FAILED" | "NOT_CONFIGURED" | "NOT_REQUESTED" = "NOT_REQUESTED";
    if (linkedGuest) {
      const wedding = await Wedding.findById(membership.weddingId).select("couple").lean();
      const weddingName = wedding ? `${wedding.couple.brideName} & ${wedding.couple.groomName}'s Wedding` : "the wedding";
      emailSubmissionStatus = (await submitPhotoLinksEmail({ email: linkedGuest.email, guestName: linkedGuest.primaryContactName, weddingName, links: [{ purpose: replacement.purpose, url }] })).status;
    }
    response.status(201).json({ data: { link: { id: String(replacement._id), purpose: replacement.purpose, eventId: replacement.eventId ? String(replacement.eventId) : undefined, guestId: replacement.guestId ? String(replacement.guestId) : undefined, expiresAt: replacement.expiresAt }, token, url, emailSubmissionStatus } });
  } catch (error) { next(error); }
});

photosRouter.post("/photo-upload-sessions", async (request, response, next) => {
  try {
    const { user, membership } = await adminScope(request);
    const parsed = uploadInput.safeParse(request.body);
    if (!parsed.success) { validationError(response, parsed.error.issues); return; }
    response.status(201).json({ data: await createUploadSession(parsed.data, { weddingId: membership.weddingId, uploaderType: membership.role, uploaderUserId: user._id, contributorName: user.displayName }) });
  } catch (error) { next(error); }
});

photosRouter.post("/photo-upload-sessions/:sessionId/complete", async (request, response, next) => {
  try {
    const { membership } = await adminScope(request);
    const id = objectId.safeParse(request.params.sessionId);
    if (!id.success) { validationError(response, id.error.issues); return; }
    const session = await PhotoUploadSession.findOne({ _id: id.data, weddingId: membership.weddingId, uploaderType: { $in: ["ADMIN", "ORGANISER"] } }).select("_id");
    if (!session) throw new AppError(404, "NOT_FOUND", "Upload session not found.");
    response.status(200).json({ data: await completeUpload(id.data) });
  } catch (error) { next(error); }
});

photosRouter.post("/public/photo-upload-sessions", async (request, response, next) => {
  try {
    await rateLimitPublic(request, "upload-session", 30);
    const parsed = publicUploadInput.safeParse(request.body);
    if (!parsed.success) { validationError(response, parsed.error.issues); return; }
    const link = await validGuestLink(parsed.data.token, "PHOTO_UPLOAD");
    if (link.eventId && parsed.data.eventId !== String(link.eventId)) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "This upload link is for a different ceremony.");
    const uploadInput = { eventId: link.eventId ? String(link.eventId) : parsed.data.eventId, expectedContentType: parsed.data.expectedContentType, expectedSizeBytes: parsed.data.expectedSizeBytes, originalFilename: parsed.data.originalFilename, purpose: "GALLERY_PHOTO" as const };
    const upload = await createUploadSession(uploadInput, { weddingId: link.weddingId, guestAccessLinkId: link._id, guestId: link.guestId, uploaderType: "GUEST" });
    response.status(201).json({ data: upload });
  } catch (error) { next(error); }
});

photosRouter.post("/public/photo-upload-sessions/:sessionId/complete", async (request, response, next) => {
  try {
    await rateLimitPublic(request, "upload-complete", 60);
    const id = objectId.safeParse(request.params.sessionId);
    const parsed = z.object({ token: tokenSchema }).strict().safeParse(request.body);
    if (!id.success) { validationError(response, id.error.issues); return; }
    if (!parsed.success) { validationError(response, parsed.error.issues); return; }
    response.status(200).json({ data: await completeUpload(id.data, parsed.data.token) });
  } catch (error) { next(error); }
});

photosRouter.get("/photos", async (request, response, next) => {
  try {
    const { membership } = await adminScope(request);
    const query = listQuery.safeParse(request.query);
    if (!query.success) { validationError(response, query.error.issues); return; }
    const filter: Record<string, unknown> = { weddingId: membership.weddingId };
    if (query.data.status) filter.moderationStatus = query.data.status;
    if (query.data.eventId) filter.eventId = query.data.eventId;
    else if (query.data.scope === "COMMON") filter.eventId = { $exists: false };
    if (query.data.uploaderType) filter.uploaderType = query.data.uploaderType;
    if (query.data.uploaderUserId) filter.uploaderUserId = query.data.uploaderUserId;
    if (query.data.guestId) { filter.uploaderType = "GUEST"; filter.guestId = query.data.guestId; }
    if (query.data.before) filter.createdAt = { $lt: new Date(query.data.before) };
    if (!query.data.status) filter.moderationStatus = { $ne: "DELETED" };
    const photos = await Photo.find(filter).sort({ createdAt: -1, _id: -1 }).limit(query.data.limit).lean();
    const contributorRows = await Photo.aggregate<{ _id: { uploaderType: "GUEST" | "ADMIN" | "ORGANISER"; uploaderUserId?: Types.ObjectId; guestId?: Types.ObjectId; contributorName?: string }; photoCount: number }>([
      { $match: { weddingId: membership.weddingId, moderationStatus: { $ne: "DELETED" } } },
      { $group: { _id: { uploaderType: "$uploaderType", uploaderUserId: "$uploaderUserId", guestId: "$guestId", contributorName: "$contributorName" }, photoCount: { $sum: 1 } } },
      { $sort: { "_id.uploaderType": 1, "_id.contributorName": 1 } }
    ]);
    const knownGuests = await Guest.find({ _id: { $in: contributorRows.flatMap((row) => row._id.guestId ? [row._id.guestId] : []) }, weddingId: membership.weddingId }).select("primaryContactName").lean();
    const guestNameById = new Map(knownGuests.map((guest) => [String(guest._id), guest.primaryContactName]));
    const knownUsers = await User.find({ _id: { $in: contributorRows.flatMap((row) => row._id.uploaderUserId ? [row._id.uploaderUserId] : []) } }).select("displayName").lean();
    const userNameById = new Map(knownUsers.map((user) => [String(user._id), user.displayName]));
    const contributors = contributorRows.map((row) => ({
      uploaderType: row._id.uploaderType,
      uploaderUserId: row._id.uploaderUserId ? String(row._id.uploaderUserId) : undefined,
      guestId: row._id.guestId ? String(row._id.guestId) : undefined,
      contributorName: row._id.guestId ? guestNameById.get(String(row._id.guestId)) : row._id.uploaderUserId ? userNameById.get(String(row._id.uploaderUserId)) || row._id.contributorName || undefined : row._id.contributorName || undefined,
      photoCount: row.photoCount
    }));
    const guestById = new Map(knownGuests.map((guest) => [String(guest._id), guest.primaryContactName]));
    response.status(200).json({ data: { photos: photos.map((photo) => ({ ...photoView(photo), uploaderUserId: photo.uploaderUserId ? String(photo.uploaderUserId) : undefined, guestId: photo.guestId ? String(photo.guestId) : undefined, contributorName: photo.guestId ? guestById.get(String(photo.guestId)) ?? "Guest record unavailable" : photo.uploaderType === "GUEST" ? "Guest (shared link)" : photo.uploaderUserId ? userNameById.get(String(photo.uploaderUserId)) ?? photo.contributorName ?? `${photo.uploaderType === "ADMIN" ? "Admin" : "Organiser"} (older upload)` : photo.contributorName || `${photo.uploaderType === "ADMIN" ? "Admin" : "Organiser"} (older upload)`, previewUrl: createDownloadUrl(photo.objectKey) })), contributors } });
  } catch (error) { next(error); }
});

photosRouter.patch("/photos/:photoId/moderation", async (request, response, next) => {
  try {
    const { membership } = await adminScope(request);
    const id = objectId.safeParse(request.params.photoId);
    const parsed = moderationInput.safeParse(request.body);
    if (!id.success) { validationError(response, id.error.issues); return; }
    if (!parsed.success) { validationError(response, parsed.error.issues); return; }
    const photo = await Photo.findOneAndUpdate({ _id: id.data, weddingId: membership.weddingId, moderationStatus: { $ne: "DELETED" } }, { $set: { moderationStatus: parsed.data.moderationStatus } }, { new: true });
    if (!photo) throw new AppError(404, "NOT_FOUND", "Photo not found.");
    response.status(200).json({ data: { photo: photoView(photo) } });
  } catch (error) { next(error); }
});

photosRouter.delete("/photos/:photoId", async (request, response, next) => {
  try {
    const { membership } = await adminScope(request);
    const id = objectId.safeParse(request.params.photoId);
    if (!id.success) { validationError(response, id.error.issues); return; }
    const photo = await Photo.findOne({ _id: id.data, weddingId: membership.weddingId });
    if (!photo) throw new AppError(404, "NOT_FOUND", "Photo not found.");
    if (photo.moderationStatus !== "DELETED") { photo.moderationStatus = "DELETED"; await photo.save(); }
    await deleteObject(photo.objectKey);
    response.status(200).json({ data: { photo: photoView(photo) } });
  } catch (error) { next(error); }
});

photosRouter.get("/photos/:photoId/download-url", async (request, response, next) => {
  try {
    const { membership } = await adminScope(request);
    const id = objectId.safeParse(request.params.photoId);
    if (!id.success) { validationError(response, id.error.issues); return; }
    const photo = await Photo.findOne({ _id: id.data, weddingId: membership.weddingId, moderationStatus: { $ne: "DELETED" } }).select("objectKey").lean();
    if (!photo) throw new AppError(404, "NOT_FOUND", "Photo not found.");
    response.status(200).json({ data: { downloadUrl: createDownloadUrl(photo.objectKey), expiresInSeconds: 300 } });
  } catch (error) { next(error); }
});

photosRouter.get("/public/gallery/photos", async (request, response, next) => {
  try {
    await rateLimitPublic(request, "gallery-read", 120);
    const token = request.header("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw new AppError(401, "INVALID_GUEST_LINK", "A gallery access link is required.");
    const link = await validGuestLink(token, "GALLERY_VIEW");
    const query = publicGalleryQuery.safeParse(request.query);
    if (!query.success) { validationError(response, query.error.issues); return; }
    const filter: Record<string, unknown> = { weddingId: link.weddingId, moderationStatus: "VISIBLE" };
    if (link.eventId) {
      if (query.data.scope === "COMMON" || (query.data.eventId && query.data.eventId !== String(link.eventId))) throw new AppError(403, "FORBIDDEN", "This gallery link is limited to one ceremony.");
      filter.eventId = link.eventId;
    } else if (query.data.eventId) {
      const event = await Event.findOne({ _id: query.data.eventId, weddingId: link.weddingId }).select("_id");
      if (!event) throw new AppError(404, "NOT_FOUND", "Ceremony not found in this wedding.");
      filter.eventId = event._id;
    } else if (query.data.scope === "COMMON") filter.eventId = { $exists: false };
    if (query.data.before) filter.createdAt = { $lt: new Date(query.data.before) };
    const photos = await Photo.find(filter).sort({ createdAt: -1, _id: -1 }).limit(query.data.limit).lean();
    const eventIds = link.eventId ? [link.eventId] : await Photo.distinct("eventId", { weddingId: link.weddingId, moderationStatus: "VISIBLE", eventId: { $exists: true, $ne: null } });
    const events = await Event.find({ weddingId: link.weddingId, _id: { $in: eventIds } }).select("_id name").lean();
    response.status(200).json({ data: { photos: photos.map((photo) => ({ ...photoView(photo), previewUrl: createDownloadUrl(photo.objectKey) })), events: events.map((event) => ({ id: String(event._id), name: event.name })), scopedEventId: link.eventId ? String(link.eventId) : undefined, scopedEventName: link.eventId ? events[0]?.name : undefined } });
  } catch (error) { next(error); }
});

photosRouter.get("/public/gallery/photos/:photoId/download-url", async (request, response, next) => {
  try {
    await rateLimitPublic(request, "gallery-download", 120);
    const token = request.header("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw new AppError(401, "INVALID_GUEST_LINK", "A gallery access link is required.");
    const link = await validGuestLink(token, "GALLERY_VIEW");
    const id = objectId.safeParse(request.params.photoId);
    if (!id.success) { validationError(response, id.error.issues); return; }
    const filter: Record<string, unknown> = { _id: id.data, weddingId: link.weddingId, moderationStatus: "VISIBLE" };
    if (link.eventId) filter.eventId = link.eventId;
    const photo = await Photo.findOne(filter).select("objectKey").lean();
    if (!photo) throw new AppError(404, "NOT_FOUND", "Visible photo not found.");
    response.status(200).json({ data: { downloadUrl: createDownloadUrl(photo.objectKey), expiresInSeconds: 300 } });
  } catch (error) { next(error); }
});
