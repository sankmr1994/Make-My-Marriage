import { Router, type Request, type Response as ExpressResponse, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { Event } from "../models/event.js";
import { Expense } from "../models/expense.js";
import { Session } from "../models/session.js";
import { Task } from "../models/task.js";
import { User } from "../models/user.js";
import { Vendor, vendorCategories, vendorPlanningStatuses } from "../models/vendor.js";
import { VendorEventAssignment } from "../models/vendor-event-assignment.js";
import { Wedding } from "../models/wedding.js";
import { WeddingMembership } from "../models/wedding-membership.js";
import { enforceRequestOrigin } from "../middleware/request-origin.js";
import { AppError } from "../utils/app-error.js";
import { hashOpaqueToken } from "../utils/credentials.js";

export const vendorsRouter: ExpressRouter = Router();
vendorsRouter.use(enforceRequestOrigin, (_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid workspace record.");
const categorySchema = z.enum(vendorCategories);
const planningStatusSchema = z.enum(vendorPlanningStatuses);
const fieldsSchema = z.object({
  name: z.string().trim().min(1, "Vendor name is required.").max(160),
  category: categorySchema,
  planningStatus: planningStatusSchema.default("SHORTLISTED"),
  contactPerson: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.email("Enter a valid email address.").max(254).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  website: z.url("Enter a valid website URL.").max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  eventIds: z.array(objectIdSchema).max(30).default([])
}).strict();
const createSchema = fieldsSchema;
const updateSchema = fieldsSchema.partial().extend({ eventIds: z.array(objectIdSchema).max(30).optional() }).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

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
async function currentMembership(userId: unknown) {
  const membership = await WeddingMembership.findOne({ userId, status: "ACTIVE" }).select("weddingId role").lean();
  if (!membership || !["ADMIN", "ORGANISER"].includes(membership.role)) throw new AppError(403, "FORBIDDEN", "Only active wedding Admins and Organisers can manage vendors.");
  return membership;
}
function validationFailure(response: ExpressResponse, issues: z.ZodIssue[]) {
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request contains invalid fields.", fieldErrors: Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? "request"), issue.message])) } });
}
function escapedRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
async function verifyEventIds(weddingId: unknown, eventIds: string[]) {
  const distinct = [...new Set(eventIds)];
  if (!distinct.length) return distinct;
  const count = await Event.countDocuments({ _id: { $in: distinct }, weddingId, status: "ACTIVE" });
  if (count !== distinct.length) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "Every linked ceremony must be active in this wedding.");
  return distinct;
}
async function replaceAssignments(input: { weddingId: unknown; vendorId: unknown; eventIds: string[]; userId: unknown }) {
  const ids = await verifyEventIds(input.weddingId, input.eventIds);
  await VendorEventAssignment.deleteMany({ weddingId: input.weddingId, vendorId: input.vendorId });
  if (ids.length) await VendorEventAssignment.insertMany(ids.map((eventId) => ({ weddingId: input.weddingId, vendorId: input.vendorId, eventId, createdByUserId: input.userId })));
}
async function vendorView(vendor: { _id: unknown; weddingId: unknown; name: string; category: string; source: string; providerPlaceId?: string; googlePlaceId?: string; contactPerson?: string; phone?: string; email?: string; address?: string; website?: string; notes?: string; planningStatus: string; status: string; createdAt: Date; updatedAt: Date }) {
  const [assignments, expenses, taskCount] = await Promise.all([
    VendorEventAssignment.find({ weddingId: vendor.weddingId, vendorId: vendor._id }).lean(),
    Expense.find({ weddingId: vendor.weddingId, vendorId: vendor._id }).select("amountRupees paymentStatus").lean(),
    Task.countDocuments({ weddingId: vendor.weddingId, vendorId: vendor._id })
  ]);
  const expenseTotals = expenses.reduce((total, expense) => ({ totalRupees: total.totalRupees + expense.amountRupees, paidRupees: total.paidRupees + (expense.paymentStatus === "PAID" ? expense.amountRupees : 0) }), { totalRupees: 0, paidRupees: 0 });
  return { id: String(vendor._id), name: vendor.name, category: vendor.category, source: vendor.source, providerPlaceId: vendor.providerPlaceId, googlePlaceId: vendor.googlePlaceId, contactPerson: vendor.contactPerson, phone: vendor.phone, email: vendor.email, address: vendor.address, website: vendor.website, notes: vendor.notes, planningStatus: vendor.planningStatus, status: vendor.status, eventIds: assignments.map((assignment) => String(assignment.eventId)), expenseTotals, taskCount, createdAt: vendor.createdAt, updatedAt: vendor.updatedAt };
}

const geoapifyCategoryByVendorCategory: Record<typeof vendorCategories[number], string[]> = {
  PHOTOGRAPHER: ["service.photographer"], VIDEOGRAPHER: ["service.photographer"], DECORATOR: ["service"], BACKDROP_DECORATOR: ["service"],
  MAKEUP_ARTIST: ["service"], MEHENDI_ARTIST: ["service"], CATERER: ["catering"], VENUE: ["activity.events_venue", "accommodation"],
  DJ_MUSIC: ["entertainment"], EVENT_PLANNER: ["service"], FLORIST: ["commercial"], INVITATION_PRINTING: ["commercial"],
  TRANSPORTATION: ["service.vehicle"], OTHER: ["service"]
};
// Geoapify has no wedding-specific category for several V1 services. Broad
// categories are only a candidate source; these terms prevent public offices
// and unrelated local services from being presented as vendor leads.
const discoveryTermsByVendorCategory: Record<typeof vendorCategories[number], string[]> = {
  PHOTOGRAPHER: ["photo", "photographer", "photography"], VIDEOGRAPHER: ["video", "videographer", "cinema"], DECORATOR: ["decor", "floral", "florist", "mandap"],
  BACKDROP_DECORATOR: ["backdrop", "decor", "floral", "mandap"], MAKEUP_ARTIST: ["makeup", "beauty", "salon"], MEHENDI_ARTIST: ["mehendi", "henna"],
  CATERER: ["cater", "restaurant", "food"], VENUE: ["venue", "banquet", "wedding", "hall", "resort"], DJ_MUSIC: ["dj", "music", "sound"],
  EVENT_PLANNER: ["event", "planner", "wedding"], FLORIST: ["flor", "flower"], INVITATION_PRINTING: ["print", "invitation", "card"],
  TRANSPORTATION: ["transport", "travel", "taxi", "bus", "car"], OTHER: []
};
type GeoapifyFeature = { properties?: { place_id?: string; name?: string; formatted?: string; website?: string; contact?: { phone?: string; website?: string }; categories?: string[]; lon?: number; lat?: number }; geometry?: { coordinates?: [number, number] } };
type GeoapifyCollection = { features?: GeoapifyFeature[] };

async function geoapifyJson(url: URL): Promise<GeoapifyCollection> {
  // Vercel's TypeScript function compiler can resolve `Response` to Express's
  // response type in this file. Keep the provider boundary explicit rather
  // than relying on the ambient fetch Response declaration.
  const providerResponse = await fetch(url, { headers: { Accept: "application/json" } }) as unknown as {
    ok: boolean;
    json: () => Promise<GeoapifyCollection>;
  };
  if (!providerResponse.ok) throw new AppError(503, "DISCOVERY_UNAVAILABLE", "Vendor discovery is temporarily unavailable. Try again later or add a vendor manually.");
  return providerResponse.json();
}

vendorsRouter.get("/vendors", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const parsed = z.object({ category: categorySchema.optional(), planningStatus: planningStatusSchema.optional(), status: z.enum(["ACTIVE", "ARCHIVED"]).optional(), eventId: objectIdSchema.optional(), query: z.string().trim().max(160).optional() }).safeParse(request.query);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const filter: Record<string, unknown> = { weddingId: membership.weddingId, status: parsed.data.status ?? "ACTIVE" };
    if (parsed.data.category) filter.category = parsed.data.category;
    if (parsed.data.planningStatus) filter.planningStatus = parsed.data.planningStatus;
    if (parsed.data.query) { const expression = new RegExp(escapedRegex(parsed.data.query), "i"); filter.$or = [{ name: expression }, { contactPerson: expression }, { address: expression }, { notes: expression }]; }
    if (parsed.data.eventId) {
      const vendorIds = await VendorEventAssignment.find({ weddingId: membership.weddingId, eventId: parsed.data.eventId }).distinct("vendorId");
      filter._id = { $in: vendorIds };
    }
    const vendors = await Vendor.find(filter).sort({ name: 1 }).lean();
    const views = await Promise.all(vendors.map(vendorView));
    const totals = views.reduce((summary, vendor) => ({ ...summary, [vendor.planningStatus]: summary[vendor.planningStatus] + 1, committedRupees: summary.committedRupees + (vendor.planningStatus === "CONTRACTED" ? vendor.expenseTotals.totalRupees : 0) }), { SHORTLISTED: 0, CONTACTED: 0, CONTRACTED: 0, DECLINED: 0, committedRupees: 0 } as Record<string, number>);
    response.status(200).json({ data: { vendors: views, totals } });
  } catch (error) { next(error); }
});

vendorsRouter.post("/vendors", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const eventIds = await verifyEventIds(membership.weddingId, parsed.data.eventIds);
    const vendor = await Vendor.create({ ...parsed.data, eventIds: undefined, contactPerson: parsed.data.contactPerson ?? undefined, phone: parsed.data.phone ?? undefined, email: parsed.data.email ?? undefined, address: parsed.data.address ?? undefined, website: parsed.data.website ?? undefined, notes: parsed.data.notes ?? undefined, source: "MANUAL", weddingId: membership.weddingId, createdByUserId: user._id });
    await replaceAssignments({ weddingId: membership.weddingId, vendorId: vendor._id, eventIds, userId: user._id });
    response.status(201).json({ data: { vendor: await vendorView(vendor) } });
  } catch (error) { next(error); }
});

vendorsRouter.get("/vendors/:vendorId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const id = objectIdSchema.safeParse(request.params.vendorId); if (!id.success) { validationFailure(response, id.error.issues); return; }
    const vendor = await Vendor.findOne({ _id: id.data, weddingId: membership.weddingId });
    if (!vendor) throw new AppError(404, "NOT_FOUND", "Vendor not found.");
    response.status(200).json({ data: { vendor: await vendorView(vendor) } });
  } catch (error) { next(error); }
});

vendorsRouter.get("/vendors/:vendorId/event-assignments", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const id = objectIdSchema.safeParse(request.params.vendorId); if (!id.success) { validationFailure(response, id.error.issues); return; }
    const vendor = await Vendor.exists({ _id: id.data, weddingId: membership.weddingId });
    if (!vendor) throw new AppError(404, "NOT_FOUND", "Vendor not found.");
    const assignments = await VendorEventAssignment.find({ weddingId: membership.weddingId, vendorId: id.data }).select("eventId notes createdAt").lean();
    response.status(200).json({ data: { assignments: assignments.map((assignment) => ({ eventId: String(assignment.eventId), notes: assignment.notes, createdAt: assignment.createdAt })) } });
  } catch (error) { next(error); }
});

vendorsRouter.put("/vendors/:vendorId/event-assignments", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const id = objectIdSchema.safeParse(request.params.vendorId); const parsed = z.object({ eventIds: z.array(objectIdSchema).max(30) }).strict().safeParse(request.body);
    if (!id.success) { validationFailure(response, id.error.issues); return; }
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const vendor = await Vendor.exists({ _id: id.data, weddingId: membership.weddingId });
    if (!vendor) throw new AppError(404, "NOT_FOUND", "Vendor not found.");
    await replaceAssignments({ weddingId: membership.weddingId, vendorId: id.data, eventIds: parsed.data.eventIds, userId: user._id });
    response.status(200).json({ data: { eventIds: [...new Set(parsed.data.eventIds)] } });
  } catch (error) { next(error); }
});

vendorsRouter.delete("/vendors/:vendorId/event-assignments/:eventId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const vendorId = objectIdSchema.safeParse(request.params.vendorId); const eventId = objectIdSchema.safeParse(request.params.eventId);
    if (!vendorId.success) { validationFailure(response, vendorId.error.issues); return; }
    if (!eventId.success) { validationFailure(response, eventId.error.issues); return; }
    const result = await VendorEventAssignment.deleteOne({ weddingId: membership.weddingId, vendorId: vendorId.data, eventId: eventId.data });
    if (!result.deletedCount) throw new AppError(404, "NOT_FOUND", "Vendor ceremony assignment not found.");
    response.status(204).send();
  } catch (error) { next(error); }
});

vendorsRouter.patch("/vendors/:vendorId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const id = objectIdSchema.safeParse(request.params.vendorId); const parsed = updateSchema.safeParse(request.body);
    if (!id.success) { validationFailure(response, id.error.issues); return; }
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const vendor = await Vendor.findOne({ _id: id.data, weddingId: membership.weddingId });
    if (!vendor) throw new AppError(404, "NOT_FOUND", "Vendor not found.");
    const { eventIds, ...fields } = parsed.data;
    Object.assign(vendor, Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value === null ? undefined : value])));
    await vendor.save();
    if (eventIds) await replaceAssignments({ weddingId: membership.weddingId, vendorId: vendor._id, eventIds, userId: user._id });
    response.status(200).json({ data: { vendor: await vendorView(vendor) } });
  } catch (error) { next(error); }
});

vendorsRouter.delete("/vendors/:vendorId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const id = objectIdSchema.safeParse(request.params.vendorId); if (!id.success) { validationFailure(response, id.error.issues); return; }
    const vendor = await Vendor.findOneAndUpdate({ _id: id.data, weddingId: membership.weddingId, status: "ACTIVE" }, { status: "ARCHIVED" }, { new: true });
    if (!vendor) throw new AppError(404, "NOT_FOUND", "Active vendor not found.");
    response.status(200).json({ data: { vendor: await vendorView(vendor) } });
  } catch (error) { next(error); }
});

vendorsRouter.post("/vendors/:vendorId/unarchive", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const id = objectIdSchema.safeParse(request.params.vendorId); if (!id.success) { validationFailure(response, id.error.issues); return; }
    const vendor = await Vendor.findOneAndUpdate({ _id: id.data, weddingId: membership.weddingId, status: "ARCHIVED" }, { status: "ACTIVE" }, { new: true });
    if (!vendor) throw new AppError(404, "NOT_FOUND", "Archived vendor not found.");
    response.status(200).json({ data: { vendor: await vendorView(vendor) } });
  } catch (error) { next(error); }
});

vendorsRouter.get("/vendor-discovery/nearby", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const parsed = z.object({ category: categorySchema, query: z.string().trim().max(160).optional(), city: z.string().trim().min(1).max(100).optional() }).safeParse(request.query);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    if (!env.GEOAPIFY_API_KEY) throw new AppError(503, "DISCOVERY_UNAVAILABLE", "Vendor discovery is not configured yet. Add GEOAPIFY_API_KEY to the API environment, then try again.");
    const wedding = await Wedding.findById(membership.weddingId).select("location.city location.state location.country").lean();
    const location = parsed.data.city || [wedding?.location?.city, wedding?.location?.state, wedding?.location?.country].filter(Boolean).join(", ");
    if (!location) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "Add a wedding city or choose a discovery city first.");
    const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
    geocodeUrl.searchParams.set("text", location); geocodeUrl.searchParams.set("limit", "1"); geocodeUrl.searchParams.set("apiKey", env.GEOAPIFY_API_KEY);
    const geocode = await geoapifyJson(geocodeUrl);
    const center = geocode.features?.[0]; const [longitude, latitude] = center?.geometry?.coordinates ?? [center?.properties?.lon, center?.properties?.lat];
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "We couldn’t locate that city. Try a more specific city and state.");
    const placesUrl = new URL("https://api.geoapify.com/v2/places");
    placesUrl.searchParams.set("categories", geoapifyCategoryByVendorCategory[parsed.data.category].join(","));
    placesUrl.searchParams.set("filter", `circle:${longitude},${latitude},25000`);
    placesUrl.searchParams.set("bias", `proximity:${longitude},${latitude}`);
    placesUrl.searchParams.set("limit", "15"); placesUrl.searchParams.set("apiKey", env.GEOAPIFY_API_KEY);
    const body = await geoapifyJson(placesUrl);
    const searchTerms = parsed.data.query?.toLocaleLowerCase().split(/\s+/).filter((term) => term.length > 2) ?? discoveryTermsByVendorCategory[parsed.data.category];
    const leads = (body.features ?? []).filter((place) => place.properties?.place_id && place.properties.name).filter((place) => {
      if (!searchTerms.length) return true;
      const leadText = [place.properties?.name, ...(place.properties?.categories ?? [])].filter(Boolean).join(" ").toLocaleLowerCase();
      return searchTerms.some((term) => leadText.includes(term));
    }).map((place) => ({ placeId: place.properties!.place_id!, name: place.properties!.name!, address: place.properties!.formatted, phone: place.properties!.contact?.phone, website: place.properties!.website ?? place.properties!.contact?.website, providerType: place.properties!.categories?.[0]?.replaceAll(".", " "), category: parsed.data.category }));
    response.status(200).json({ data: { attribution: "Geoapify", attributionUrl: "https://www.geoapify.com/", location, leads } });
  } catch (error) { next(error); }
});

vendorsRouter.post("/vendors/from-place", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request); const membership = await currentMembership(user._id);
    const parsed = fieldsSchema.extend({ providerPlaceId: z.string().trim().min(1).max(200) }).safeParse(request.body);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const eventIds = await verifyEventIds(membership.weddingId, parsed.data.eventIds);
    const vendor = await Vendor.create({ ...parsed.data, eventIds: undefined, contactPerson: parsed.data.contactPerson ?? undefined, phone: parsed.data.phone ?? undefined, email: parsed.data.email ?? undefined, address: parsed.data.address ?? undefined, website: parsed.data.website ?? undefined, notes: parsed.data.notes ?? undefined, source: "GEOAPIFY", weddingId: membership.weddingId, createdByUserId: user._id });
    await replaceAssignments({ weddingId: membership.weddingId, vendorId: vendor._id, eventIds, userId: user._id });
    response.status(201).json({ data: { vendor: await vendorView(vendor) } });
  } catch (error) { next(error); }
});
