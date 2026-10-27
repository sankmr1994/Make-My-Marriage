import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { Session } from "../models/session.js";
import { User } from "../models/user.js";
import { Wedding } from "../models/wedding.js";
import { WeddingMembership } from "../models/wedding-membership.js";
import { Event } from "../models/event.js";
import { enforceRequestOrigin } from "../middleware/request-origin.js";
import { AppError } from "../utils/app-error.js";
import { hashOpaqueToken } from "../utils/credentials.js";
import { isValidIanaTimeZone } from "../utils/iana-time-zone.js";

export const weddingsRouter: ExpressRouter = Router();
weddingsRouter.use(enforceRequestOrigin, (_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
const weddingSchema = z.object({
  couple: z.object({ brideName: z.string().trim().min(1).max(100), groomName: z.string().trim().min(1).max(100) }).strict(),
  weddingDate: z.iso.date(),
  timeZone: z.string().trim().min(1).max(64).refine(isValidIanaTimeZone, "Must be a valid IANA time zone.").default("Asia/Kolkata"),
  location: z.object({ address: z.string().trim().min(1).max(300), city: z.string().trim().max(100).optional(), state: z.string().trim().max(100).optional(), country: z.string().trim().max(100).optional() }).strict(),
  contact: z.object({ phone: z.string().trim().max(32).optional(), email: z.email().trim().max(254).optional() }).strict().optional()
}).strict();
const eventSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }).optional(),
  timeZone: z.string().trim().min(1).max(64).refine(isValidIanaTimeZone, "Must be a valid IANA time zone.").default("Asia/Kolkata"),
  clientEventId: z.uuid().optional(),
  venue: z.object({ name: z.string().trim().max(150).optional(), address: z.string().trim().min(1).max(300), city: z.string().trim().max(100).optional() }).strict(),
  description: z.string().trim().max(2000).optional()
}).strict();
const weddingUpdateSchema = z.object({
  couple: z.object({ brideName: z.string().trim().min(1).max(100).optional(), groomName: z.string().trim().min(1).max(100).optional() }).strict().optional(),
  weddingDate: z.iso.date().optional(),
  timeZone: z.string().trim().min(1).max(64).refine(isValidIanaTimeZone, "Must be a valid IANA time zone.").optional(),
  location: z.object({ address: z.string().trim().min(1).max(300).optional(), city: z.string().trim().max(100).optional(), state: z.string().trim().max(100).optional(), country: z.string().trim().max(100).optional() }).strict().optional()
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");
const eventUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  endsAt: z.iso.datetime({ offset: true }).optional(),
  timeZone: z.string().trim().min(1).max(64).refine(isValidIanaTimeZone, "Must be a valid IANA time zone.").optional(),
  venue: z.object({ name: z.string().trim().max(150).optional(), address: z.string().trim().min(1).max(300).optional(), city: z.string().trim().max(100).optional() }).strict().optional(),
  description: z.string().trim().max(2000).optional()
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!cookie) return undefined;
  try { return decodeURIComponent(cookie.slice(name.length + 1)); } catch { return undefined; }
}

async function authenticatedUser(request: Request) {
  const token = cookieValue(request, "mmm_session");
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const session = await Session.findOne({ tokenHash: hashOpaqueToken(token), expiresAt: { $gt: new Date() } });
  if (!session) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const user = await User.findOne({ _id: session.userId, status: "ACTIVE" });
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return user;
}

function reportValidation(response: Response, issues: z.ZodIssue[]) {
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request contains invalid fields.", fieldErrors: Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? "request"), issue.message])) } });
}

weddingsRouter.post("/weddings", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const parsed = weddingSchema.safeParse(request.body);
    if (!parsed.success) { reportValidation(response, parsed.error.issues); return; }
    const existingMembership = await WeddingMembership.findOne({ userId: user._id, status: "ACTIVE" }).select("_id").lean();
    if (existingMembership) throw new AppError(409, "USER_ALREADY_HAS_WEDDING", "This account already belongs to a wedding.");

    const session = await mongoose.startSession();
    let weddingId = "";
    try {
      await session.withTransaction(async () => {
        const wedding = await Wedding.create([{ ...parsed.data, createdByUserId: user._id, status: "ACTIVE" }], { session });
        await WeddingMembership.create([{ weddingId: wedding[0]._id, userId: user._id, role: "ADMIN", status: "ACTIVE", joinedAt: new Date() }], { session });
        weddingId = String(wedding[0]._id);
      });
    } catch (error) {
      // MongoDB standalone deployments do not support transactions; compensate if the first membership insert fails.
      if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 20) throw error;
      const wedding = await Wedding.create({ ...parsed.data, createdByUserId: user._id, status: "ACTIVE" });
      try {
        await WeddingMembership.create({ weddingId: wedding._id, userId: user._id, role: "ADMIN", status: "ACTIVE", joinedAt: new Date() });
        weddingId = String(wedding._id);
      } catch (membershipError) {
        await Wedding.deleteOne({ _id: wedding._id });
        throw membershipError;
      }
    } finally { await session.endSession(); }
    response.status(201).json({ data: { wedding: { id: weddingId, ...parsed.data, status: "ACTIVE" }, membership: { weddingId, role: "ADMIN" } } });
  } catch (error) {
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) return next(new AppError(409, "USER_ALREADY_HAS_WEDDING", "This account already belongs to a wedding."));
    next(error);
  }
});

weddingsRouter.post("/events", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const parsed = eventSchema.safeParse(request.body);
    if (!parsed.success) { reportValidation(response, parsed.error.issues); return; }
    const membership = await WeddingMembership.findOne({ userId: user._id, status: "ACTIVE" }).select("weddingId").lean();
    if (!membership) throw new AppError(403, "FORBIDDEN", "Create a wedding before adding events.");
    const wedding = await Wedding.exists({ _id: membership.weddingId, status: "ACTIVE" });
    if (!wedding) throw new AppError(404, "NOT_FOUND", "Wedding not found.");
    const start = new Date(parsed.data.startsAt);
    const end = parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined;
    if (end && end <= start) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "The event end time must be after its start time.");
    const eventData = { ...parsed.data, startsAt: start, endsAt: end, weddingId: membership.weddingId, createdByUserId: user._id, status: "ACTIVE" as const };
    const event = parsed.data.clientEventId
      ? await Event.findOneAndUpdate(
        { weddingId: membership.weddingId, clientEventId: parsed.data.clientEventId },
        { $set: eventData },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      )
      : await Event.create(eventData);
    response.status(201).json({ data: { event: { id: String(event._id), name: event.name, startsAt: event.startsAt, timeZone: event.timeZone, venue: event.venue } } });
  } catch (error) { next(error); }
});

weddingsRouter.get("/events", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const membership = await WeddingMembership.findOne({ userId: user._id, status: "ACTIVE" }).select("weddingId").lean();
    if (!membership) throw new AppError(403, "FORBIDDEN", "Create a wedding before viewing events.");
    const events = await Event.find({ weddingId: membership.weddingId, status: "ACTIVE" }).sort({ startsAt: 1 }).lean();
    response.status(200).json({ data: { events: events.map((event) => ({ id: String(event._id), name: event.name, startsAt: event.startsAt, endsAt: event.endsAt, timeZone: event.timeZone, venue: event.venue, description: event.description })) } });
  } catch (error) { next(error); }
});

weddingsRouter.patch("/events/:eventId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const id = z.string().regex(/^[a-f\d]{24}$/i).safeParse(request.params.eventId);
    if (!id.success) { reportValidation(response, id.error.issues); return; }
    const parsed = eventUpdateSchema.safeParse(request.body);
    if (!parsed.success) { reportValidation(response, parsed.error.issues); return; }
    const membership = await WeddingMembership.findOne({ userId: user._id, status: "ACTIVE" }).select("weddingId").lean();
    if (!membership) throw new AppError(403, "FORBIDDEN", "Create a wedding before editing events.");
    const current = await Event.findOne({ _id: id.data, weddingId: membership.weddingId, status: "ACTIVE" });
    if (!current) throw new AppError(404, "NOT_FOUND", "Event not found.");
    if (parsed.data.name !== undefined) current.name = parsed.data.name;
    if (parsed.data.startsAt !== undefined) current.startsAt = new Date(parsed.data.startsAt);
    if (parsed.data.endsAt !== undefined) current.endsAt = new Date(parsed.data.endsAt);
    if (parsed.data.timeZone !== undefined) current.timeZone = parsed.data.timeZone;
    if (parsed.data.venue !== undefined) current.venue = { ...current.venue, ...parsed.data.venue, address: parsed.data.venue.address ?? current.venue.address };
    if (parsed.data.description !== undefined) current.description = parsed.data.description;
    if (current.endsAt && current.endsAt <= current.startsAt) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "The event end time must be after its start time.");
    await current.save();
    response.status(200).json({ data: { event: { id: String(current._id), name: current.name, startsAt: current.startsAt, endsAt: current.endsAt, timeZone: current.timeZone, venue: current.venue, description: current.description } } });
  } catch (error) { next(error); }
});

weddingsRouter.delete("/events/onboarding/:clientEventId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const parsedId = z.uuid().safeParse(request.params.clientEventId);
    if (!parsedId.success) { reportValidation(response, parsedId.error.issues); return; }
    const membership = await WeddingMembership.findOne({ userId: user._id, status: "ACTIVE" }).select("weddingId").lean();
    if (!membership) throw new AppError(403, "FORBIDDEN", "Create a wedding before managing events.");
    await Event.deleteOne({ weddingId: membership.weddingId, clientEventId: parsedId.data });
    response.status(200).json({ data: { deleted: true } });
  } catch (error) { next(error); }
});

weddingsRouter.get("/weddings/current", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const membership = await WeddingMembership.findOne({ userId: user._id, status: "ACTIVE" }).select("weddingId role").lean();
    if (!membership) throw new AppError(404, "NOT_FOUND", "Wedding not found.");
    const wedding = await Wedding.findOne({ _id: new Types.ObjectId(String(membership.weddingId)), status: "ACTIVE" }).lean();
    if (!wedding) throw new AppError(404, "NOT_FOUND", "Wedding not found.");
    response.status(200).json({ data: { wedding: { id: String(wedding._id), couple: wedding.couple, weddingDate: wedding.weddingDate, timeZone: wedding.timeZone, location: wedding.location }, membership: { role: membership.role } } });
  } catch (error) { next(error); }
});

weddingsRouter.patch("/weddings/current", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const parsed = weddingUpdateSchema.safeParse(request.body);
    if (!parsed.success) { reportValidation(response, parsed.error.issues); return; }
    const membership = await WeddingMembership.findOne({ userId: user._id, status: "ACTIVE" }).select("weddingId role").lean();
    if (!membership) throw new AppError(404, "NOT_FOUND", "Wedding not found.");
    const updates: Record<string, string> = {};
    if (parsed.data.couple?.brideName !== undefined) updates["couple.brideName"] = parsed.data.couple.brideName;
    if (parsed.data.couple?.groomName !== undefined) updates["couple.groomName"] = parsed.data.couple.groomName;
    if (parsed.data.weddingDate !== undefined) updates.weddingDate = parsed.data.weddingDate;
    if (parsed.data.timeZone !== undefined) updates.timeZone = parsed.data.timeZone;
    for (const [key, value] of Object.entries(parsed.data.location ?? {})) updates[`location.${key}`] = value;
    const wedding = await Wedding.findOneAndUpdate({ _id: membership.weddingId, status: "ACTIVE" }, { $set: updates }, { new: true, runValidators: true }).lean();
    if (!wedding) throw new AppError(404, "NOT_FOUND", "Wedding not found.");
    response.status(200).json({ data: { wedding: { id: String(wedding._id), couple: wedding.couple, weddingDate: wedding.weddingDate, timeZone: wedding.timeZone, location: wedding.location } } });
  } catch (error) { next(error); }
});
