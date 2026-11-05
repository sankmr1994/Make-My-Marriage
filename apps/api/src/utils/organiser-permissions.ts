import { z } from "zod";

export const organiserPermissionKeys = [
  "wedding.edit",
  "events.view", "events.manage", "events.archive",
  "tasks.view", "tasks.manage", "tasks.delete",
  "expenses.view", "expenses.manage", "expenses.delete",
  "guests.view", "guests.manage", "guests.import", "guests.sendInvitations",
  "vendors.view", "vendors.manage", "vendors.discover",
  "website.view", "website.edit", "website.publish",
  "photos.view", "photos.upload", "photos.moderate", "photos.delete", "photos.manageLinks"
] as const;

export type OrganiserPermission = typeof organiserPermissionKeys[number];
export const organiserPermissionSchema = z.enum(organiserPermissionKeys);
export const organiserPermissionsSchema = z.array(organiserPermissionSchema).max(organiserPermissionKeys.length).refine((permissions) => new Set(permissions).size === permissions.length, "Each permission can be selected only once.").refine((permissions) => permissions.every((permission) => {
  const moduleName = permission.split(".")[0];
  return permission.endsWith(".view") || moduleName === "wedding" || permissions.includes(`${moduleName}.view` as OrganiserPermission);
}), "A module’s view access is required before granting its other permissions.");

export const allOrganiserPermissions: OrganiserPermission[] = [...organiserPermissionKeys];

// New organisers start with common planning work. Financial access, publishing,
// photo deletion, and guest-link administration require an explicit grant.
export const standardOrganiserPermissions: OrganiserPermission[] = [
  "events.view", "events.manage", "events.archive",
  "tasks.view", "tasks.manage",
  "guests.view", "guests.manage",
  "vendors.view", "vendors.manage", "vendors.discover",
  "website.view",
  "photos.view", "photos.upload", "photos.moderate"
];

export function effectiveOrganiserPermissions(role: "ADMIN" | "ORGANISER", permissions?: readonly string[] | null): OrganiserPermission[] {
  if (role === "ADMIN" || permissions === undefined || permissions === null) return allOrganiserPermissions;
  return permissions.filter((permission): permission is OrganiserPermission => organiserPermissionSchema.safeParse(permission).success);
}

export function membershipHasPermission(membership: { role: "ADMIN" | "ORGANISER"; permissions?: readonly string[] | null }, permission: OrganiserPermission): boolean {
  return effectiveOrganiserPermissions(membership.role, membership.permissions).includes(permission);
}
