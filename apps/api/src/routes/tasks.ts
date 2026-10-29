import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { Event } from "../models/event.js";
import { Session } from "../models/session.js";
import { Task } from "../models/task.js";
import { User } from "../models/user.js";
import { WeddingMembership } from "../models/wedding-membership.js";
import { enforceRequestOrigin } from "../middleware/request-origin.js";
import { AppError } from "../utils/app-error.js";
import { hashOpaqueToken } from "../utils/credentials.js";

export const tasksRouter: ExpressRouter = Router();
tasksRouter.use(enforceRequestOrigin, (_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid workspace record.");
const statusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Task name is required.").max(120),
  description: z.string().trim().max(2000).optional(),
  assigneeMembershipId: objectIdSchema.nullable().optional(),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  priority: prioritySchema.default("MEDIUM"),
  eventId: objectIdSchema.nullable().optional(),
  status: statusSchema.default("NOT_STARTED"),
  notes: z.string().trim().max(2000).optional()
}).strict();
const taskUpdateSchema = z.object({
  title: z.string().trim().min(1, "Task name is required.").max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  assigneeMembershipId: objectIdSchema.nullable().optional(),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  priority: prioritySchema.optional(),
  eventId: objectIdSchema.nullable().optional(),
  status: statusSchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional()
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

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
  if (!membership) throw new AppError(403, "FORBIDDEN", "Create a wedding before managing tasks.");
  return membership;
}
function validationFailure(response: Response, issues: z.ZodIssue[]) {
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request contains invalid fields.", fieldErrors: Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? "request"), issue.message])) } });
}
async function verifyReferences(input: { weddingId: unknown; eventId?: string | null; assigneeMembershipId?: string | null }) {
  if (input.eventId) {
    const event = await Event.exists({ _id: input.eventId, weddingId: input.weddingId, status: "ACTIVE" });
    if (!event) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "The selected event is not active in this wedding.");
  }
  if (input.assigneeMembershipId) {
    const membership = await WeddingMembership.exists({ _id: input.assigneeMembershipId, weddingId: input.weddingId, status: "ACTIVE" });
    if (!membership) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "The selected assignee is not an active wedding member.");
  }
}
function serializeTask(task: { _id: unknown; title: string; description?: string; assigneeMembershipId?: unknown; dueAt?: Date; priority: string; eventId?: unknown; status: string; notes?: string; createdAt: Date; updatedAt: Date }) {
  return { id: String(task._id), title: task.title, description: task.description, assigneeMembershipId: task.assigneeMembershipId ? String(task.assigneeMembershipId) : undefined, dueAt: task.dueAt, priority: task.priority, eventId: task.eventId ? String(task.eventId) : undefined, status: task.status, notes: task.notes, createdAt: task.createdAt, updatedAt: task.updatedAt };
}

tasksRouter.get("/tasks", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const membership = await currentMembership(user._id);
    const query = z.object({ status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).optional(), priority: prioritySchema.optional(), assigneeMembershipId: objectIdSchema.optional(), eventId: objectIdSchema.optional(), due: z.enum(["UPCOMING", "OVERDUE", "NONE"]).optional() }).safeParse(request.query);
    if (!query.success) { validationFailure(response, query.error.issues); return; }
    const filter: Record<string, unknown> = { weddingId: membership.weddingId };
    if (query.data.status) filter.status = query.data.status;
    if (query.data.priority) filter.priority = query.data.priority;
    if (query.data.assigneeMembershipId) filter.assigneeMembershipId = query.data.assigneeMembershipId;
    if (query.data.eventId) filter.eventId = query.data.eventId;
    if (query.data.due === "UPCOMING") filter.dueAt = { $gte: new Date() };
    if (query.data.due === "OVERDUE") { filter.dueAt = { $lt: new Date() }; filter.status = { $ne: "COMPLETED" }; }
    if (query.data.due === "NONE") filter.dueAt = { $exists: false };
    const tasks = await Task.find(filter).sort({ dueAt: 1, createdAt: -1 }).lean();
    response.status(200).json({ data: { tasks: tasks.map(serializeTask) } });
  } catch (error) { next(error); }
});

tasksRouter.post("/tasks", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const membership = await currentMembership(user._id);
    const parsed = taskInputSchema.safeParse(request.body);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    await verifyReferences({ weddingId: membership.weddingId, eventId: parsed.data.eventId, assigneeMembershipId: parsed.data.assigneeMembershipId });
    const task = await Task.create({ ...parsed.data, eventId: parsed.data.eventId ?? undefined, assigneeMembershipId: parsed.data.assigneeMembershipId ?? undefined, dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined, weddingId: membership.weddingId, createdByUserId: user._id });
    response.status(201).json({ data: { task: serializeTask(task) } });
  } catch (error) { next(error); }
});

tasksRouter.patch("/tasks/:taskId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const membership = await currentMembership(user._id);
    const taskId = objectIdSchema.safeParse(request.params.taskId);
    const parsed = taskUpdateSchema.safeParse(request.body);
    if (!taskId.success) { validationFailure(response, taskId.error.issues); return; }
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const task = await Task.findOne({ _id: taskId.data, weddingId: membership.weddingId });
    if (!task) throw new AppError(404, "NOT_FOUND", "Task not found.");
    await verifyReferences({ weddingId: membership.weddingId, eventId: parsed.data.eventId, assigneeMembershipId: parsed.data.assigneeMembershipId });
    if (parsed.data.title !== undefined) task.title = parsed.data.title;
    if (parsed.data.description !== undefined) task.description = parsed.data.description ?? undefined;
    if (parsed.data.assigneeMembershipId !== undefined) task.assigneeMembershipId = parsed.data.assigneeMembershipId ? new Types.ObjectId(parsed.data.assigneeMembershipId) : undefined;
    if (parsed.data.dueAt !== undefined) task.dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined;
    if (parsed.data.priority !== undefined) task.priority = parsed.data.priority;
    if (parsed.data.eventId !== undefined) task.eventId = parsed.data.eventId ? new Types.ObjectId(parsed.data.eventId) : undefined;
    if (parsed.data.status !== undefined) task.status = parsed.data.status;
    if (parsed.data.notes !== undefined) task.notes = parsed.data.notes ?? undefined;
    await task.save();
    response.status(200).json({ data: { task: serializeTask(task) } });
  } catch (error) { next(error); }
});

tasksRouter.delete("/tasks/:taskId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const membership = await currentMembership(user._id);
    const taskId = objectIdSchema.safeParse(request.params.taskId);
    if (!taskId.success) { validationFailure(response, taskId.error.issues); return; }
    const result = await Task.deleteOne({ _id: taskId.data, weddingId: membership.weddingId });
    if (!result.deletedCount) throw new AppError(404, "NOT_FOUND", "Task not found.");
    response.status(200).json({ data: { deleted: true } });
  } catch (error) { next(error); }
});
