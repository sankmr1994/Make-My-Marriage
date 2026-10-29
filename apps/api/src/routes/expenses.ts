import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { Event } from "../models/event.js";
import { Expense, expenseCategories } from "../models/expense.js";
import { Session } from "../models/session.js";
import { User } from "../models/user.js";
import { WeddingMembership } from "../models/wedding-membership.js";
import { enforceRequestOrigin } from "../middleware/request-origin.js";
import { AppError } from "../utils/app-error.js";
import { hashOpaqueToken } from "../utils/credentials.js";

export const expensesRouter: ExpressRouter = Router();
expensesRouter.use(enforceRequestOrigin, (_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid workspace record.");
const categorySchema = z.enum(expenseCategories);
const paymentStatusSchema = z.enum(["PAID", "UNPAID"]);
const amountSchema = z.number().finite("Enter a valid amount.").positive("Amount must be at least ₹1.");
const expenseFieldsSchema = z.object({
  description: z.string().trim().min(1, "Expense name is required.").max(200),
  amountRupees: amountSchema,
  category: categorySchema,
  eventId: objectIdSchema.nullable().optional(),
  paymentStatus: paymentStatusSchema.default("UNPAID"),
  paymentDate: z.iso.datetime({ offset: true }).nullable().optional(),
  payerName: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
}).strict();
const expenseInputSchema = expenseFieldsSchema.superRefine((value, context) => {
  if (value.paymentStatus === "PAID" && !value.paymentDate) context.addIssue({ code: "custom", path: ["paymentDate"], message: "Payment date is required for a paid expense." });
});
const expenseUpdateSchema = expenseFieldsSchema.partial().strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

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
  const membership = await WeddingMembership.findOne({ userId, status: "ACTIVE" }).select("weddingId").lean();
  if (!membership) throw new AppError(403, "FORBIDDEN", "Create a wedding before managing expenses.");
  return membership;
}
function validationFailure(response: Response, issues: z.ZodIssue[]) {
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request contains invalid fields.", fieldErrors: Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? "request"), issue.message])) } });
}
async function verifyEvent(weddingId: unknown, eventId?: string | null) {
  if (!eventId) return;
  const event = await Event.exists({ _id: eventId, weddingId, status: "ACTIVE" });
  if (!event) throw new AppError(422, "BUSINESS_RULE_VIOLATION", "The selected event is not active in this wedding.");
}
function roundedAmount(amount: number) { return Math.round(amount); }
function serializeExpense(expense: { _id: unknown; description: string; amountRupees: number; currency: string; category: string; eventId?: unknown; paymentStatus: string; paymentDate?: Date; payerName?: string; notes?: string; createdAt: Date; updatedAt: Date }) {
  return { id: String(expense._id), description: expense.description, amountRupees: expense.amountRupees, currency: expense.currency, category: expense.category, eventId: expense.eventId ? String(expense.eventId) : undefined, paymentStatus: expense.paymentStatus, paymentDate: expense.paymentDate, payerName: expense.payerName, notes: expense.notes, createdAt: expense.createdAt, updatedAt: expense.updatedAt };
}
function escapedRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

expensesRouter.get("/expenses", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const membership = await currentMembership(user._id);
    const query = z.object({ paymentStatus: paymentStatusSchema.optional(), category: categorySchema.optional(), eventId: objectIdSchema.optional(), query: z.string().trim().max(200).optional() }).safeParse(request.query);
    if (!query.success) { validationFailure(response, query.error.issues); return; }
    const filter: Record<string, unknown> = { weddingId: membership.weddingId };
    if (query.data.paymentStatus) filter.paymentStatus = query.data.paymentStatus;
    if (query.data.category) filter.category = query.data.category;
    if (query.data.eventId) filter.eventId = query.data.eventId;
    if (query.data.query) { const expression = new RegExp(escapedRegex(query.data.query), "i"); filter.$or = [{ description: expression }, { payerName: expression }, { notes: expression }]; }
    const expenses = await Expense.find(filter).sort({ paymentDate: -1, createdAt: -1 }).lean();
    const totals = expenses.reduce((summary, expense) => ({ totalRupees: summary.totalRupees + expense.amountRupees, paidRupees: summary.paidRupees + (expense.paymentStatus === "PAID" ? expense.amountRupees : 0), unpaidRupees: summary.unpaidRupees + (expense.paymentStatus === "UNPAID" ? expense.amountRupees : 0) }), { totalRupees: 0, paidRupees: 0, unpaidRupees: 0 });
    response.status(200).json({ data: { expenses: expenses.map(serializeExpense), totals } });
  } catch (error) { next(error); }
});

expensesRouter.post("/expenses", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const membership = await currentMembership(user._id);
    const parsed = expenseInputSchema.safeParse(request.body);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const amountRupees = roundedAmount(parsed.data.amountRupees);
    if (amountRupees < 1) throw new AppError(400, "VALIDATION_ERROR", "Amount must be at least ₹1.");
    await verifyEvent(membership.weddingId, parsed.data.eventId);
    const expense = await Expense.create({ ...parsed.data, amountRupees, eventId: parsed.data.eventId ?? undefined, paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : undefined, payerName: parsed.data.payerName ?? undefined, notes: parsed.data.notes ?? undefined, weddingId: membership.weddingId, createdByUserId: user._id });
    response.status(201).json({ data: { expense: serializeExpense(expense) } });
  } catch (error) { next(error); }
});

expensesRouter.patch("/expenses/:expenseId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const membership = await currentMembership(user._id);
    const expenseId = objectIdSchema.safeParse(request.params.expenseId);
    const parsed = expenseUpdateSchema.safeParse(request.body);
    if (!expenseId.success) { validationFailure(response, expenseId.error.issues); return; }
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const expense = await Expense.findOne({ _id: expenseId.data, weddingId: membership.weddingId });
    if (!expense) throw new AppError(404, "NOT_FOUND", "Expense not found.");
    const nextStatus = parsed.data.paymentStatus ?? expense.paymentStatus;
    const nextDate = parsed.data.paymentDate === undefined ? expense.paymentDate : parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : undefined;
    if (nextStatus === "PAID" && !nextDate) throw new AppError(400, "VALIDATION_ERROR", "Payment date is required for a paid expense.");
    await verifyEvent(membership.weddingId, parsed.data.eventId);
    if (parsed.data.description !== undefined) expense.description = parsed.data.description;
    if (parsed.data.amountRupees !== undefined) { const amount = roundedAmount(parsed.data.amountRupees); if (amount < 1) throw new AppError(400, "VALIDATION_ERROR", "Amount must be at least ₹1."); expense.amountRupees = amount; }
    if (parsed.data.category !== undefined) expense.category = parsed.data.category;
    if (parsed.data.eventId !== undefined) expense.eventId = parsed.data.eventId ? new Types.ObjectId(parsed.data.eventId) : undefined;
    if (parsed.data.paymentStatus !== undefined) expense.paymentStatus = parsed.data.paymentStatus;
    if (parsed.data.paymentDate !== undefined) expense.paymentDate = parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : undefined;
    if (parsed.data.payerName !== undefined) expense.payerName = parsed.data.payerName ?? undefined;
    if (parsed.data.notes !== undefined) expense.notes = parsed.data.notes ?? undefined;
    await expense.save();
    response.status(200).json({ data: { expense: serializeExpense(expense) } });
  } catch (error) { next(error); }
});

expensesRouter.delete("/expenses/:expenseId", async (request, response, next) => {
  try {
    const user = await authenticatedUser(request);
    const membership = await currentMembership(user._id);
    const expenseId = objectIdSchema.safeParse(request.params.expenseId);
    if (!expenseId.success) { validationFailure(response, expenseId.error.issues); return; }
    const result = await Expense.deleteOne({ _id: expenseId.data, weddingId: membership.weddingId });
    if (!result.deletedCount) throw new AppError(404, "NOT_FOUND", "Expense not found.");
    response.status(200).json({ data: { deleted: true } });
  } catch (error) { next(error); }
});
