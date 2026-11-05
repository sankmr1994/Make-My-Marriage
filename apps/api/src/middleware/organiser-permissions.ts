import type { NextFunction, Request, Response } from "express";
import { Session } from "../models/session.js";
import { User } from "../models/user.js";
import { WeddingMembership } from "../models/wedding-membership.js";
import { AppError } from "../utils/app-error.js";
import { hashOpaqueToken } from "../utils/credentials.js";
import { membershipHasPermission, type OrganiserPermission } from "../utils/organiser-permissions.js";

const rules: Array<{ method: string; path: RegExp; permission: OrganiserPermission }> = [
  { method: "PATCH", path: /^\/weddings\/current$/, permission: "wedding.edit" },
  { method: "GET", path: /^\/events$/, permission: "events.view" },
  { method: "POST", path: /^\/events$/, permission: "events.manage" },
  { method: "PATCH", path: /^\/events\/[a-f\d]{24}$/i, permission: "events.manage" },
  { method: "DELETE", path: /^\/events\/onboarding\/[^/]+$/i, permission: "events.manage" },
  { method: "DELETE", path: /^\/events\/[a-f\d]{24}$/i, permission: "events.archive" },
  { method: "POST", path: /^\/events\/[a-f\d]{24}\/unarchive$/i, permission: "events.archive" },
  { method: "GET", path: /^\/tasks$/, permission: "tasks.view" },
  { method: "POST", path: /^\/tasks$/, permission: "tasks.manage" },
  { method: "PATCH", path: /^\/tasks\/[a-f\d]{24}$/i, permission: "tasks.manage" },
  { method: "DELETE", path: /^\/tasks\/[a-f\d]{24}$/i, permission: "tasks.delete" },
  { method: "GET", path: /^\/expenses$/, permission: "expenses.view" },
  { method: "POST", path: /^\/expenses$/, permission: "expenses.manage" },
  { method: "PATCH", path: /^\/expenses\/[a-f\d]{24}$/i, permission: "expenses.manage" },
  { method: "DELETE", path: /^\/expenses\/[a-f\d]{24}$/i, permission: "expenses.delete" },
  { method: "GET", path: /^\/guests$/, permission: "guests.view" },
  { method: "POST", path: /^\/guests$/, permission: "guests.manage" },
  { method: "POST", path: /^\/guests\/import$/, permission: "guests.import" },
  { method: "PATCH", path: /^\/guests\/[a-f\d]{24}$/i, permission: "guests.manage" },
  { method: "DELETE", path: /^\/guests\/[a-f\d]{24}$/i, permission: "guests.manage" },
  { method: "POST", path: /^\/guests\/[a-f\d]{24}\/unarchive$/i, permission: "guests.manage" },
  { method: "GET", path: /^\/events\/[a-f\d]{24}\/guest-assignments$/i, permission: "guests.view" },
  { method: "POST", path: /^\/events\/[a-f\d]{24}\/guest-assignments$/i, permission: "guests.manage" },
  { method: "DELETE", path: /^\/events\/[a-f\d]{24}\/guest-assignments\/[a-f\d]{24}$/i, permission: "guests.manage" },
  { method: "POST", path: /^\/events\/[a-f\d]{24}\/guest-invitations$/i, permission: "guests.sendInvitations" },
  { method: "POST", path: /^\/events\/[a-f\d]{24}\/rsvp-reminders$/i, permission: "guests.sendInvitations" },
  { method: "POST", path: /^\/weddings\/current\/email-campaigns$/, permission: "guests.sendInvitations" },
  { method: "POST", path: /^\/weddings\/current\/email-campaigns\/[a-f\d]{24}\/process-next-batch$/i, permission: "guests.sendInvitations" },
  { method: "GET", path: /^\/weddings\/current\/email-campaigns(?:\/[a-f\d]{24}\/recipients)?$/i, permission: "guests.view" },
  { method: "GET", path: /^\/vendors$/, permission: "vendors.view" },
  { method: "GET", path: /^\/vendors\/[a-f\d]{24}(?:\/event-assignments)?$/i, permission: "vendors.view" },
  { method: "POST", path: /^\/vendors$/, permission: "vendors.manage" },
  { method: "PATCH", path: /^\/vendors\/[a-f\d]{24}$/i, permission: "vendors.manage" },
  { method: "DELETE", path: /^\/vendors\/[a-f\d]{24}(?:\/event-assignments\/[a-f\d]{24})?$/i, permission: "vendors.manage" },
  { method: "PUT", path: /^\/vendors\/[a-f\d]{24}\/event-assignments$/i, permission: "vendors.manage" },
  { method: "POST", path: /^\/vendors\/[a-f\d]{24}\/unarchive$/i, permission: "vendors.manage" },
  { method: "GET", path: /^\/vendor-discovery\/nearby$/, permission: "vendors.discover" },
  { method: "POST", path: /^\/vendors\/from-place$/, permission: "vendors.manage" },
  { method: "GET", path: /^\/website-themes$/, permission: "website.view" },
  { method: "GET", path: /^\/weddings\/current\/website-config(?:\/preview)?$/, permission: "website.view" },
  { method: "PUT", path: /^\/weddings\/current\/website-config$/, permission: "website.edit" },
  { method: "POST", path: /^\/weddings\/current\/website-config\/(?:publish|unpublish)$/, permission: "website.publish" },
  { method: "GET", path: /^\/photos$/, permission: "photos.view" },
  { method: "GET", path: /^\/photos\/[a-f\d]{24}\/download-url$/i, permission: "photos.view" },
  { method: "POST", path: /^\/photo-upload-sessions$/, permission: "photos.upload" },
  { method: "POST", path: /^\/photo-upload-sessions\/[a-f\d]{24}\/complete$/i, permission: "photos.upload" },
  { method: "PATCH", path: /^\/photos\/[a-f\d]{24}\/moderation$/i, permission: "photos.moderate" },
  { method: "DELETE", path: /^\/photos\/[a-f\d]{24}$/i, permission: "photos.delete" },
  { method: "POST", path: /^\/weddings\/current\/(?:guest-access-links|guest-photo-links)$/, permission: "photos.manageLinks" },
  { method: "GET", path: /^\/weddings\/current\/guest-access-links$/, permission: "photos.manageLinks" },
  { method: "POST", path: /^\/weddings\/current\/guest-access-links\/[a-f\d]{24}\/(?:revoke|reissue)$/i, permission: "photos.manageLinks" }
];

const protectedPrefixes = ["/events", "/tasks", "/expenses", "/guests", "/vendors", "/vendor-discovery", "/photos", "/photo-upload-sessions", "/website-themes", "/weddings/current"];

export async function enforceOrganiserPermissions(request: Request, _response: Response, next: NextFunction) {
  try {
    const path = request.path;
    if (path.startsWith("/public/") || path.startsWith("/guest-rsvps/") || path === "/weddings" || (path === "/weddings/current" && request.method === "GET") || path === "/weddings/current/members" || path.startsWith("/weddings/current/membership-") || path.startsWith("/weddings/current/members/")) { next(); return; }
    if (!protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) { next(); return; }
    const cookie = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("mmm_session="));
    const token = cookie?.slice("mmm_session=".length);
    if (!token) { next(); return; }
    let decoded: string;
    try { decoded = decodeURIComponent(token); } catch { next(); return; }
    const session = await Session.findOne({ tokenHash: hashOpaqueToken(decoded), expiresAt: { $gt: new Date() } }).lean();
    if (!session) { next(); return; }
    const user = await User.findOne({ _id: session.userId, status: "ACTIVE" }).select("_id").lean();
    if (!user) { next(); return; }
    const membership = await WeddingMembership.findOne({ userId: user._id, status: "ACTIVE" }).select("role permissions").lean();
    if (!membership || membership.role === "ADMIN") { next(); return; }
    const rule = rules.find((item) => item.method === request.method && item.path.test(path));
    if (!rule) throw new AppError(403, "FORBIDDEN", "This action is not available with your organiser access.");
    if (!membershipHasPermission(membership, rule.permission)) throw new AppError(403, "FORBIDDEN", "You don’t have permission to do that.");
    next();
  } catch (error) { next(error); }
}
