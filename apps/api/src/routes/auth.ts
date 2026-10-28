import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { enforceAuthRateLimit } from "../middleware/auth-rate-limit.js";
import { enforceRequestOrigin } from "../middleware/request-origin.js";
import { PasswordResetToken } from "../models/password-reset-token.js";
import { Session } from "../models/session.js";
import { User } from "../models/user.js";
import { WeddingMembership } from "../models/wedding-membership.js";
import { createOpaqueToken, hashOpaqueToken, hashPassword, verifyPassword } from "../utils/credentials.js";

const SESSION_COOKIE = "mmm_session";
const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
const RESET_LIFETIME_MS = 30 * 60 * 1000;
const passwordSchema = z.string().min(12).max(128);
const signupSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  email: z.email().trim().max(254),
  password: passwordSchema
}).strict();
const loginSchema = z.object({ email: z.email().trim().max(254), password: z.string().min(1).max(128) }).strict();
const resetRequestSchema = z.object({ email: z.email().trim().max(254) }).strict();
const resetConfirmSchema = z.object({ token: z.string().min(20).max(200), newPassword: passwordSchema }).strict();

export const authRouter: ExpressRouter = Router();
authRouter.use(enforceRequestOrigin, (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!cookie) return undefined;
  try { return decodeURIComponent(cookie.slice(name.length + 1)); } catch { return undefined; }
}

function setSessionCookie(response: Response, token: string, expiresAt: Date): void {
  const crossOriginAttributes = env.NODE_ENV === "production" ? "; SameSite=None; Secure" : "; SameSite=Lax";
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${crossOriginAttributes}; Max-Age=${maxAge}`);
}

function clearSessionCookie(response: Response): void {
  const crossOriginAttributes = env.NODE_ENV === "production" ? "; SameSite=None; Secure" : "; SameSite=Lax";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly${crossOriginAttributes}; Max-Age=0`);
}

function validationFailure(response: Response, issues: z.ZodIssue[]): void {
  const fieldErrors = Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? "request"), issue.message]));
  response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request contains invalid fields.", fieldErrors } });
}

async function createSession(userId: string, response: Response): Promise<void> {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await Session.create({ userId, tokenHash: hashOpaqueToken(token), expiresAt });
  setSessionCookie(response, token, expiresAt);
}

async function currentSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const now = new Date();
  const session = await Session.findOne({ tokenHash: hashOpaqueToken(token), expiresAt: { $gt: now } });
  if (!session) return null;
  const user = await User.findOne({ _id: session.userId, status: "ACTIVE" });
  return user ? { session, user } : null;
}

function rateKey(request: Request): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}

authRouter.post("/auth/signup", async (request, response, next) => {
  try {
    await enforceAuthRateLimit(rateKey(request), "signup", 10);
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const { displayName, email, password } = parsed.data;
    const emailNormalized = normalizedEmail(email);
    const user = await User.create({ displayName, email: email.trim(), emailNormalized, passwordHash: await hashPassword(password), status: "ACTIVE" });
    await createSession(user.id, response);
    response.status(201).json({ data: { user: { id: user.id, displayName: user.displayName, email: user.email }, membership: null } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      response.status(409).json({ error: { code: "EMAIL_ALREADY_EXISTS", message: "An account with this email already exists." } });
      return;
    }
    next(error);
  }
});

authRouter.post("/auth/login", async (request, response, next) => {
  try {
    await enforceAuthRateLimit(rateKey(request), "login", 10);
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const user = await User.findOne({ emailNormalized: normalizedEmail(parsed.data.email), status: "ACTIVE" }).select("+passwordHash");
    const validPassword = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
    if (!user || !validPassword) {
      response.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "The email or password is incorrect." } });
      return;
    }
    user.lastLoginAt = new Date();
    await user.save();
    await createSession(user.id, response);
    response.status(200).json({ data: { user: { id: user.id, displayName: user.displayName, email: user.email }, membership: null } });
  } catch (error) { next(error); }
});

authRouter.post("/auth/logout", async (request, response, next) => {
  try {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) await Session.deleteOne({ tokenHash: hashOpaqueToken(token) });
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) { next(error); }
});

authRouter.get("/auth/me", async (request, response, next) => {
  try {
    const current = await currentSession(request);
    if (!current) {
      clearSessionCookie(response);
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
      return;
    }
    const membership = await WeddingMembership.findOne({ userId: current.user._id, status: "ACTIVE" }).select("weddingId role").lean();
    response.status(200).json({ data: {
      user: { id: current.user.id, displayName: current.user.displayName, email: current.user.email },
      membership: membership ? { weddingId: String(membership.weddingId), role: membership.role } : null
    } });
  } catch (error) { next(error); }
});

authRouter.post("/auth/password-reset/request", async (request, response, next) => {
  try {
    await enforceAuthRateLimit(rateKey(request), "password-reset", 5);
    const parsed = resetRequestSchema.safeParse(request.body);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const genericResponse = { data: { message: "If an account matches and password recovery is configured, reset instructions will be sent." } };
    const user = await User.findOne({ emailNormalized: normalizedEmail(parsed.data.email), status: "ACTIVE" });
    if (user && env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
      const token = createOpaqueToken();
      await PasswordResetToken.create({ userId: user._id, tokenHash: hashOpaqueToken(token), expiresAt: new Date(Date.now() + RESET_LIFETIME_MS) });
      const resetUrl = new URL("/reset-password", env.WEB_ORIGIN);
      resetUrl.searchParams.set("token", token);
      try {
        const sent = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [user.email], subject: "Reset your Make My Marriage password", html: `<p>Use this link to reset your password. It expires in 30 minutes.</p><p><a href="${resetUrl.toString()}">Reset password</a></p>` })
        }) as unknown as { ok: boolean };
        if (!sent.ok) throw new Error("email_delivery_failed");
      } catch {
        await PasswordResetToken.deleteOne({ tokenHash: hashOpaqueToken(token) });
        console.error("Password reset email delivery failed.");
      }
    }
    response.status(202).json(genericResponse);
  } catch (error) { next(error); }
});

authRouter.post("/auth/password-reset/confirm", async (request, response, next) => {
  try {
    await enforceAuthRateLimit(rateKey(request), "password-reset-confirm", 5);
    const parsed = resetConfirmSchema.safeParse(request.body);
    if (!parsed.success) { validationFailure(response, parsed.error.issues); return; }
    const reset = await PasswordResetToken.findOneAndUpdate(
      { tokenHash: hashOpaqueToken(parsed.data.token), expiresAt: { $gt: new Date() }, usedAt: { $exists: false } },
      { $set: { usedAt: new Date() } },
      { new: true }
    );
    if (!reset) {
      response.status(410).json({ error: { code: "TOKEN_EXPIRED_OR_REVOKED", message: "This reset link is invalid or has expired." } });
      return;
    }
    const user = await User.findOne({ _id: reset.userId, status: "ACTIVE" });
    if (!user) {
      response.status(410).json({ error: { code: "TOKEN_EXPIRED_OR_REVOKED", message: "This reset link is invalid or has expired." } });
      return;
    }
    user.passwordHash = await hashPassword(parsed.data.newPassword);
    await user.save();
    await Session.deleteMany({ userId: user._id });
    response.status(200).json({ data: { message: "Password updated. Sign in with your new password." } });
  } catch (error) { next(error); }
});
