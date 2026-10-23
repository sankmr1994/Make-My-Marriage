# Make My Marriage V1 — REST API Design

**Document type:** API Design Specification  
**Version:** 1.0  
**Status:** Proposed API contract for review before implementation  
**Date:** 22 October 2026  
**Stack:** Next.js + TypeScript; Node.js + Express.js + TypeScript; MongoDB Atlas + Mongoose; Zod; Cloudflare R2; Resend; Vercel

---

## 1. Purpose

This document defines the proposed REST API contract for Make My Marriage V1. It maps the approved product requirements and revised database design to API routes, request/response formats, permissions, validation rules, and important workflows.

The API is designed for a modular Express monolith deployed separately from the Next.js frontend. MongoDB Atlas is the system of record. The browser never connects directly to MongoDB. Media bytes are uploaded directly to Cloudflare R2 using presigned URLs; email is sent through Resend; nearby vendor discovery uses Google Places API (New); livestream playback uses an embedded YouTube player.

### V1 rules this API must preserve

- Three product roles: `ADMIN`, `ORGANISER`, and accountless `GUEST`.
- Admin means the bride/groom. Admin can add and remove Organisers. Organisers can manage wedding planning but cannot add, remove, or otherwise manage membership.
- A user account can have at most one active wedding membership.
- Guests do not need a Make My Marriage account. Guest APIs are authorized by purpose-scoped links/tokens.
- One family/household is one guest record: primary contact, one email, and `familyCount`.
- An email address can appear at most once per wedding's guest list; the same email may appear in another wedding.
- RSVP is only `ATTENDING` or `NOT_ATTENDING`, one current response per family per event. No RSVP record means pending.
- Expenses store whole INR rupees in `amountRupees`, never paise. The API rounds positive decimal input to the nearest whole rupee before saving.
- Vendor-to-event, vendor-to-task, and vendor-to-expense relationships are supported. Vendors do not log in.
- Wedding websites use four fixed theme codes: `TRADITIONAL`, `ROYAL`, `FLORAL`, and `MODERN`.
- Task reminders, budgets, WhatsApp/SMS invitations, image transformation pipelines, dedicated queues, and audit-history collection are out of scope for V1.

---

## 2. API conventions

### 2.1 Base URL and versioning

All endpoints use the prefix:

```text
/api/v1
```

Example production origins (to be configured at deployment):

- Web app: `https://app.<your-domain>`
- API: `https://api.<your-domain>`

Use HTTPS in all deployed environments. The frontend uses a configured API base URL; provider credentials and MongoDB credentials exist only in server-side environment variables.

### 2.2 Request and response formats

- JSON requests use `Content-Type: application/json`.
- File bytes do not pass through Express for photo uploads; the browser sends them directly to R2.
- IDs are represented as strings in JSON even when stored as MongoDB `ObjectId` values.
- API timestamps are ISO 8601 UTC strings, e.g. `2026-10-22T08:30:00.000Z`.
- Wedding calendar dates use `YYYY-MM-DD`; event instants use UTC ISO timestamps plus an IANA `timeZone` such as `Asia/Kolkata`.
- Unknown request fields should be rejected on write endpoints unless a route explicitly permits them.
- Validate path parameters, query parameters, headers, and bodies with Zod. Mongoose remains the database-document validation layer.

### 2.3 Success envelope

Single-resource response:

```json
{
  "data": {
    "id": "671000000000000000000001",
    "name": "Wedding Ceremony"
  }
}
```

Paginated response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 0
  }
}
```

For actions with no response body, use `204 No Content`.

### 2.4 Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "fieldErrors": {
      "email": "Enter a valid email address."
    },
    "requestId": "req_abc123"
  }
}
```

Do not return stack traces, MongoDB error text, secrets, raw guest tokens, password-reset tokens, or presigned URLs in error messages/logs.

### 2.5 Pagination and filtering

List endpoints accept `page` (default `1`) and `pageSize` (default `25`, maximum `100`). They should return `meta.page`, `meta.pageSize`, and `meta.total`. Use the indexes from the Database Design document. A later release can adopt cursor pagination for very large galleries/lists if needed.

### 2.6 Idempotency and repeated requests

- A create operation that may be retried after a network timeout must avoid accidental duplicates where practical.
- Use unique database indexes as the final protection against duplicate guest emails, event assignments, RSVP records, vendor-event assignments, website slugs, and campaign recipient rows.
- Email processing must atomically claim recipient rows from `PENDING` to `SUBMITTING`; concurrent requests must not submit the same row twice.
- Consider an `Idempotency-Key` header for campaign creation and other high-impact POST operations. If enabled, persist the key or an equivalent request key in the relevant collection; do not rely on in-memory process state.

---

## 3. Authentication and authorization

### 3.1 Authentication approach

Use simple email/password authentication with server-side sessions stored through a MongoDB-compatible session store.

- No email verification during account creation in V1.
- Passwords must be securely hashed; never store plaintext passwords.
- Use secure, `HttpOnly` session cookies. Set `Secure` in production and select `SameSite`/CORS settings based on the deployment origins.
- Protect cookie-authenticated mutations using an appropriate CSRF strategy and origin checks.
- Do not store session state only in process memory because Vercel instances can restart or run concurrently.

### 3.2 Roles

| Capability | Admin | Organiser | Guest |
|---|---:|---:|---:|
| View/manage wedding details | Yes | Yes | Only public/purpose-scoped data |
| Create/edit/archive events | Yes | Yes | No |
| Manage tasks | Yes | Yes | No |
| Manage expenses | Yes | Yes | No |
| Manage guest list and invitations | Yes | Yes | No |
| Send RSVP reminders | Yes | Yes | No |
| Manage vendors and discovery | Yes | Yes | No |
| Assign vendors to events | Yes | Yes | No |
| Link vendors to tasks/expenses | Yes | Yes | No |
| Configure/publish website and livestream | Yes | Yes | View published experience only |
| Moderate/delete photos | Yes | Yes | Upload/view only through valid links |
| Invite/remove Organisers | **Yes** | **No** | No |
| Create or manage membership invitations | **Yes** | **No** | No |

`GUEST` is not a `weddingMemberships.role`. Guests do not have a management account unless they independently sign up and are invited into a management role.

### 3.3 Wedding scoping

For authenticated management APIs, derive `weddingId` from the current user's active `weddingMemberships` record. Do not treat a client-supplied `weddingId` as authoritative. For public guest endpoints, derive wedding/event/guest scope from the validated guest token.

Every linked record must be checked for the same wedding: event, assigned membership, guest, vendor, task, expense, photo, and guest-access link. A syntactically valid ID is not proof of authorization.

---

## 4. Endpoint inventory

All routes in this table are relative to `/api/v1`.

### 4.1 Authentication and account

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/auth/signup` | Public | Create an account; no email verification |
| `POST` | `/auth/login` | Public | Create authenticated session |
| `POST` | `/auth/logout` | Authenticated | Revoke current session |
| `GET` | `/auth/me` | Authenticated | Return current account and membership summary |
| `POST` | `/auth/password-reset/request` | Public | Request password-reset email; return generic response |
| `POST` | `/auth/password-reset/confirm` | Public with reset token | Validate token and set new password |

### 4.2 Wedding, dashboard, and membership

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/weddings` | Authenticated, no active membership | Create wedding and first Admin membership |
| `GET` | `/weddings/current` | Admin/Organiser | Get current wedding |
| `PATCH` | `/weddings/current` | Admin/Organiser | Update wedding information |
| `GET` | `/weddings/current/dashboard` | Admin/Organiser | Dashboard counts and summaries |
| `GET` | `/weddings/current/members` | Admin/Organiser | List active members and roles |
| `GET` | `/weddings/current/membership-invitations` | Admin only | List pending/recent membership invitations |
| `POST` | `/weddings/current/membership-invitations` | Admin only | Invite an Organiser or the second Admin/partner where allowed |
| `POST` | `/membership-invitations/accept` | Authenticated with valid invitation token | Accept invitation and create membership |
| `POST` | `/weddings/current/membership-invitations/:invitationId/resend` | Admin only | Reissue invitation with a fresh token and send email |
| `DELETE` | `/weddings/current/membership-invitations/:invitationId` | Admin only | Revoke a pending invitation |
| `DELETE` | `/weddings/current/organisers/:membershipId` | Admin only | Remove an Organiser membership |

The product permits two Admins (bride/groom). An `ADMIN` invitation is allowed only for the partner flow when the wedding has fewer than two active Admins. There is no general endpoint to create unlimited Admins. The organiser-removal endpoint must refuse to remove Admin memberships.

### 4.3 Events

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/events` | Admin/Organiser | List active events; filters and pagination |
| `POST` | `/events` | Admin/Organiser | Create manually entered event |
| `GET` | `/events/:eventId` | Admin/Organiser | Get event details |
| `PATCH` | `/events/:eventId` | Admin/Organiser | Update event |
| `DELETE` | `/events/:eventId` | Admin/Organiser | Archive event; do not cascade-delete tasks/expenses |

### 4.4 Tasks

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/tasks` | Admin/Organiser | List tasks; filter by event, status, priority, assignee, due/overdue |
| `POST` | `/tasks` | Admin/Organiser | Create task |
| `GET` | `/tasks/:taskId` | Admin/Organiser | Get task |
| `PATCH` | `/tasks/:taskId` | Admin/Organiser | Update task/status/assignee/vendor |
| `DELETE` | `/tasks/:taskId` | Admin/Organiser | Delete task |

V1 status values: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`. No task reminder endpoint exists.

### 4.5 Expenses

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/expenses` | Admin/Organiser | List/filter expenses |
| `POST` | `/expenses` | Admin/Organiser | Create expense |
| `GET` | `/expenses/:expenseId` | Admin/Organiser | Get expense |
| `PATCH` | `/expenses/:expenseId` | Admin/Organiser | Update expense |
| `DELETE` | `/expenses/:expenseId` | Admin/Organiser | Delete expense |

Filters: `eventId`, `category`, `paymentStatus`, `payerUserId`, and optional date range. There are no budget, forecast, advance, balance, or family-cost-splitting endpoints.

### 4.6 Guests and event assignments

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/guests` | Admin/Organiser | List family invitation records |
| `POST` | `/guests` | Admin/Organiser | Add one family/household record |
| `GET` | `/guests/:guestId` | Admin/Organiser | Get guest/family record and summary |
| `PATCH` | `/guests/:guestId` | Admin/Organiser | Update primary contact, email, family count or status |
| `DELETE` | `/guests/:guestId` | Admin/Organiser | Archive guest record; protect linked historical data |
| `POST` | `/guests/import` | Admin/Organiser | Import CSV/XLSX with row-level validation errors |
| `GET` | `/events/:eventId/guest-assignments` | Admin/Organiser | List families assigned to an event with invite/RSVP states |
| `POST` | `/events/:eventId/guest-assignments` | Admin/Organiser | Assign one or more guest IDs to event |
| `DELETE` | `/events/:eventId/guest-assignments/:guestId` | Admin/Organiser | Remove guest/family from event list |
| `GET` | `/events/:eventId/rsvp-summary` | Admin/Organiser | Counts for attending, not attending, and pending |

Each guest record contains `primaryContactName`, `email`, `emailNormalized`, and `familyCount`. Do not add a family/invitation name or individual child/plus-one records. The same normalized email must not be duplicated within one wedding.

### 4.7 Guest access links and public RSVP

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/weddings/current/guest-access-links` | Admin/Organiser | Create shared QR/link for `PHOTO_UPLOAD` or `GALLERY_VIEW` |
| `GET` | `/weddings/current/guest-access-links` | Admin/Organiser | List link metadata without revealing raw tokens |
| `POST` | `/weddings/current/guest-access-links/:linkId/revoke` | Admin/Organiser | Revoke a shared link |
| `POST` | `/public/guest-links/resolve` | Public with token in request body | Validate token and return minimal scoped context |
| `POST` | `/public/rsvps` | Public with RSVP token | Create/update RSVP for token-mapped family and event |

A public RSVP request accepts the token and response only. It must not accept a `guestId`, `weddingId`, or `eventId` as the authority for whose RSVP is being changed. The server resolves those from the validated RSVP link. Shared QR links are created only for photo upload or gallery view in V1; RSVP links are per family/event and are included in the invitation email.

### 4.8 Email campaigns

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/weddings/current/email-campaigns` | Admin/Organiser | Create invitation or RSVP-reminder campaign and snapshot recipients |
| `GET` | `/weddings/current/email-campaigns` | Admin/Organiser | List campaigns |
| `GET` | `/weddings/current/email-campaigns/:campaignId` | Admin/Organiser | Get campaign totals/status |
| `GET` | `/weddings/current/email-campaigns/:campaignId/recipients` | Admin/Organiser | List recipient status rows |
| `POST` | `/weddings/current/email-campaigns/:campaignId/process-next-batch` | Admin/Organiser | Submit at most 50 pending recipient emails |
| `POST` | `/weddings/current/email-campaigns/:campaignId/retry-failed` | Admin/Organiser | Re-queue eligible failed recipients for a later bounded batch |

Allowed Admin/Organiser campaign types: `WEDDING_INVITATION`, `RSVP_REMINDER`. `ORGANISER_INVITATION` is sent as part of membership-invitation flow. `PASSWORD_RESET` is initiated only through password-recovery endpoints, not through a generic campaign creation request.

Campaign creation snapshots eligible recipients. An invitation campaign includes families assigned to the selected event; a reminder campaign includes only assigned families whose RSVP is still pending. Do not send reminders to families that already responded. Each batch is bounded; the UI may call the next-batch endpoint again while `hasMore` is true. V1 does not use a dedicated queue or worker.

### 4.9 Wedding website and livestream

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/weddings/current/website-config` | Admin/Organiser | Get draft/published website configuration |
| `PUT` | `/weddings/current/website-config` | Admin/Organiser | Create/update one website configuration |
| `GET` | `/website-themes` | Authenticated | Return four fixed theme definitions stored in code |
| `POST` | `/weddings/current/website-config/publish` | Admin/Organiser | Validate slug/content and publish |
| `POST` | `/weddings/current/website-config/unpublish` | Admin/Organiser | Unpublish public page |
| `GET` | `/public/websites/:slug` | Public | Get explicitly publishable website content only |
| `GET` | `/weddings/current/livestream-config` | Admin/Organiser | Get YouTube configuration |
| `PUT` | `/weddings/current/livestream-config` | Admin/Organiser | Set video ID and enabled state |

Theme codes are `TRADITIONAL`, `ROYAL`, `FLORAL`, and `MODERN`. The website builder is template-based, not drag-and-drop. Never accept arbitrary HTML or scripts. Public website APIs must return `404` or an equivalent safe response for draft/unpublished websites. An embedded player does not make a YouTube stream private; YouTube controls actual visibility.

### 4.10 Vendor management and discovery

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/vendors` | Admin/Organiser | List saved vendors |
| `POST` | `/vendors` | Admin/Organiser | Add vendor manually |
| `GET` | `/vendors/:vendorId` | Admin/Organiser | Get saved vendor |
| `PATCH` | `/vendors/:vendorId` | Admin/Organiser | Update user-managed vendor details |
| `DELETE` | `/vendors/:vendorId` | Admin/Organiser | Archive saved vendor |
| `GET` | `/vendor-discovery/nearby` | Admin/Organiser | Search Google Places near event/wedding/custom coordinates |
| `POST` | `/vendors/from-place` | Admin/Organiser | Save selected Place as a wedding vendor, with user-confirmed fields |
| `GET` | `/vendors/:vendorId/event-assignments` | Admin/Organiser | List event assignments |
| `PUT` | `/vendors/:vendorId/event-assignments/:eventId` | Admin/Organiser | Create or update vendor-to-event assignment |
| `DELETE` | `/vendors/:vendorId/event-assignments/:eventId` | Admin/Organiser | Remove assignment |

Vendor-to-task and vendor-to-expense integration uses optional `vendorId` on task/expense create and update endpoints. There are no vendor login accounts, vendor advances, or remaining-balance workflows.

Nearby discovery inputs include `category`, `eventId` or explicit `lat`/`lng`, `radiusMeters` and optional query/ranking. Prefer event/wedding venue coordinates when available. V1 should limit the search radius to at most 50,000 metres and request only needed Google Places fields. Provider ratings/counts are returned for display, not permanently copied into the saved vendor record unless current Google policy permits it.

### 4.11 Photos and direct-to-R2 uploads

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/photos` | Admin/Organiser | List wedding photos and moderation states |
| `POST` | `/photo-upload-sessions` | Admin/Organiser | Request direct R2 upload URL for a cover/event/gallery image |
| `POST` | `/photo-upload-sessions/:sessionId/complete` | Admin/Organiser | Verify upload and create/update related media metadata |
| `POST` | `/public/photo-upload-sessions` | Public with `PHOTO_UPLOAD` token | Create upload session for guest photo |
| `POST` | `/public/photo-upload-sessions/:sessionId/complete` | Public with same token | Validate completed guest upload |
| `PATCH` | `/photos/:photoId/moderation` | Admin/Organiser | Set `VISIBLE` or `REJECTED` |
| `DELETE` | `/photos/:photoId` | Admin/Organiser | Mark deleted and delete/remove object safely |
| `GET` | `/photos/:photoId/download-url` | Admin/Organiser | Generate short-lived private read URL |
| `GET` | `/public/gallery/photos` | Public with `GALLERY_VIEW` token | List only visible photos in permitted scope |
| `GET` | `/public/gallery/photos/:photoId/download-url` | Public with `GALLERY_VIEW` token | Generate controlled read URL for a visible photo |

The `PHOTO_UPLOAD` link must be validated on both session creation and completion. A guest cannot submit an arbitrary R2 `objectKey`. The session owns a server-generated object key. Do not return a photo record until R2 metadata is verified. Guest uploads start as `PENDING_REVIEW`; only visible photos may be returned by the public gallery route.

**Database alignment note:** add a `purpose` field to `photoUploadSessions` (suggested values: `WEDDING_COVER`, `EVENT_COVER`, `GALLERY_PHOTO`) so the completion endpoint knows whether to update a wedding/event cover key or create a gallery `photos` record. This is a small database-design addition needed to support wedding/event cover uploads consistently.

### 4.12 Health

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/health/live` | Public/minimal | Process is alive; no secrets or dependency details |
| `GET` | `/health/ready` | Internal or minimally exposed | Check critical dependencies such as MongoDB connection |

---

## 5. Request and response contracts

The examples below define the expected public contract. Fields not shown are omitted for brevity. The server should return the canonical saved record or an appropriate resource summary.

### 5.1 Sign up

`POST /api/v1/auth/signup`

Request:

```json
{
  "displayName": "Riya Kumar",
  "email": "riya@example.com",
  "password": "a-strong-password"
}
```

Response: `201 Created`, set a secure session cookie.

```json
{
  "data": {
    "user": {
      "id": "671000000000000000000011",
      "displayName": "Riya Kumar",
      "email": "riya@example.com"
    },
    "membership": null
  }
}
```

No email-verification message is required. Duplicate normalized emails return `409 EMAIL_ALREADY_EXISTS`. An account with no membership can create a wedding or accept a valid management invitation.

### 5.2 Create a wedding

`POST /api/v1/weddings`

Request:

```json
{
  "couple": {
    "brideName": "Riya Kumar",
    "groomName": "Arjun Ravi"
  },
  "weddingDate": "2027-01-29",
  "timeZone": "Asia/Kolkata",
  "location": {
    "address": "Coimbatore, Tamil Nadu, India",
    "city": "Coimbatore",
    "state": "Tamil Nadu",
    "country": "India"
  },
  "contact": {
    "email": "riya@example.com"
  }
}
```

Response: `201 Created`; create the wedding and first `ADMIN` membership atomically where supported. Return the created wedding ID and wedding summary. Reject if the user already has an active wedding membership (`409 USER_ALREADY_HAS_WEDDING`). Cover photos are uploaded through a photo-upload session, not by accepting an arbitrary R2 key.

### 5.3 Create a membership invitation

`POST /api/v1/weddings/current/membership-invitations`

Request:

```json
{
  "email": "rahul@example.com",
  "role": "ORGANISER"
}
```

An `ADMIN` role is allowed only for the partner flow when the wedding has fewer than two active Admins. Only an Admin can call this endpoint. Express creates a secure invitation token, stores its hash, sends the invitation email through Resend, and records the email submission result. The raw token is not returned in the API response or stored in MongoDB.

Response: `201 Created`.

```json
{
  "data": {
    "invitationId": "671000000000000000000019",
    "role": "ORGANISER",
    "status": "PENDING",
    "emailSubmissionStatus": "ACCEPTED"
  }
}
```

`emailSubmissionStatus: ACCEPTED` means Resend accepted the message, not that the invitee received or read it. If submission fails, preserve the pending invitation and allow an Admin to resend it, issuing a fresh token and invalidating the previous link.

### 5.4 Create an event

`POST /api/v1/events`

Request:

```json
{
  "name": "Wedding Ceremony",
  "startsAt": "2027-01-29T00:30:00.000Z",
  "timeZone": "Asia/Kolkata",
  "venue": {
    "name": "Wedding Hall",
    "address": "Coimbatore, Tamil Nadu"
  },
  "description": "Main wedding ceremony"
}
```

Response: `201 Created`. `weddingId` and `createdByUserId` are assigned by the server; clients must not choose them.

### 5.5 Create a task with a vendor association

`POST /api/v1/tasks`

Request:

```json
{
  "eventId": "671000000000000000000021",
  "title": "Confirm photographer arrival time",
  "description": "Confirm arrival before the ceremony starts.",
  "assigneeMembershipId": "671000000000000000000022",
  "dueAt": "2027-01-20T04:30:00.000Z",
  "priority": "HIGH",
  "status": "NOT_STARTED",
  "vendorId": "671000000000000000000023"
}
```

The API verifies that the event, assignee membership, and vendor all belong to the current wedding. The vendor does not receive an account or task notification.

### 5.6 Create an expense in whole rupees

`POST /api/v1/expenses`

Request:

```json
{
  "eventId": "671000000000000000000021",
  "description": "Wedding photography",
  "amountRupees": 1250.75,
  "currency": "INR",
  "category": "PHOTOGRAPHY",
  "paymentStatus": "PAID",
  "paymentDate": "2026-10-21T00:00:00.000Z",
  "payerName": "Riya",
  "vendorId": "671000000000000000000023"
}
```

The response and saved record contain `amountRupees: 1251`. Positive decimal input is rounded to the nearest whole rupee on the server. After rounding, reject a value below ₹1. Do not store paise.

### 5.7 Create a family guest record

`POST /api/v1/guests`

Request:

```json
{
  "primaryContactName": "Ravi Kumar",
  "email": "ravi@example.com",
  "familyCount": 4
}
```

The server creates `emailNormalized` and assigns `weddingId`/`createdByUserId`. If the normalized email already exists in this wedding, return `409 GUEST_EMAIL_ALREADY_EXISTS`. There is no family/invitation name field.

### 5.8 Assign families to an event

`POST /api/v1/events/:eventId/guest-assignments`

Request:

```json
{
  "guestIds": [
    "671000000000000000000031",
    "671000000000000000000032"
  ]
}
```

Validate every guest belongs to the same wedding. Create missing assignments; do not duplicate existing `(weddingId, eventId, guestId)` assignments. Return counts for created/already-assigned items or row-level conflicts as appropriate.

### 5.9 Submit an RSVP

`POST /api/v1/public/rsvps`

Request:

```json
{
  "token": "raw-random-token-from-invitation-link",
  "response": "ATTENDING"
}
```

The token is a bearer credential. Resolve it by hashing the supplied value and finding an active, unexpired `guestAccessLinks` record with purpose `RSVP`. Resolve `weddingId`, `eventId`, and `guestId` from that record; never trust those IDs supplied by the caller. Create or update the single RSVP document for the `(eventId, guestId)` pair. Responding again through the same still-valid link updates the existing answer.

### 5.10 Create a shared photo QR link

`POST /api/v1/weddings/current/guest-access-links`

Request:

```json
{
  "purpose": "PHOTO_UPLOAD",
  "eventId": "671000000000000000000021",
  "expiresAt": "2027-02-15T00:00:00.000Z"
}
```

Response returns link metadata and the raw link/token once so the frontend can render a QR code. Persist the token hash, not the raw bearer token. A separate `GALLERY_VIEW` link may be generated for viewing the visible gallery. Admin/Organiser can revoke the link. Public requests must validate purpose, scope, expiration, and revocation on every use.

### 5.11 Create a direct R2 upload session (guest)

`POST /api/v1/public/photo-upload-sessions`

Request:

```json
{
  "token": "raw-photo-upload-token",
  "eventId": "671000000000000000000021",
  "expectedContentType": "image/jpeg",
  "expectedSizeBytes": 2500000,
  "originalFilename": "wedding.jpg"
}
```

Response:

```json
{
  "data": {
    "sessionId": "671000000000000000000041",
    "uploadUrl": "https://r2-presigned-url.example",
    "method": "PUT",
    "requiredHeaders": {
      "Content-Type": "image/jpeg"
    },
    "uploadUrlExpiresAt": "2026-10-22T06:30:00.000Z"
  }
}
```

The URL above is illustrative, not a working URL. The actual presigned URL is returned at runtime and must never be stored in MongoDB or application logs. The server generates the `objectKey` and records a `photoUploadSessions` document before returning the URL. The browser then PUTs the file bytes directly to R2. On completion, Express checks the session status/deadline and verifies the expected R2 object and metadata before creating a `photos` document.

### 5.12 Create and process an email campaign

`POST /api/v1/weddings/current/email-campaigns`

Request:

```json
{
  "type": "WEDDING_INVITATION",
  "eventId": "671000000000000000000021",
  "guestIds": [
    "671000000000000000000031",
    "671000000000000000000032"
  ]
}
```

If `guestIds` is omitted, target all eligible family records assigned to the event. For an `RSVP_REMINDER`, include only event-assigned families without an RSVP. Campaign creation snapshots recipients into `emailRecipients`; it does not submit an unbounded email campaign by itself.

`POST /api/v1/weddings/current/email-campaigns/:campaignId/process-next-batch` processes at most 50 pending recipients and returns a summary:

```json
{
  "data": {
    "campaignId": "671000000000000000000051",
    "processedCount": 50,
    "acceptedCount": 48,
    "failedCount": 2,
    "remainingCount": 20,
    "hasMore": true
  }
}
```

`acceptedCount` means the provider accepted/submitted those messages, not that all emails reached inboxes. The UI can call the endpoint again while `hasMore` is true. Each recipient has its own status and retry information; a retry should target eligible failed records only. Use Resend's batch endpoint with an operational batch size of about 50, below its documented maximum of 100 messages per batch, subject to current provider/account limits.

### 5.13 Save a vendor discovered through Google Places

`POST /api/v1/vendors/from-place`

Request:

```json
{
  "placeId": "GOOGLE_PLACE_ID",
  "category": "PHOTOGRAPHER",
  "name": "ABC Wedding Photography",
  "address": "User-confirmed address",
  "phone": "+91XXXXXXXXXX",
  "website": "https://example.com"
}
```

Store the `placeId` and fields entered/confirmed by the user. Do not assume Google rating and rating count may be permanently cached; return current provider data from discovery endpoints with the required attribution and field mask.

### 5.14 Publish a wedding website

`PUT /api/v1/weddings/current/website-config`

Request:

```json
{
  "slug": "riya-and-arjun",
  "themeCode": "FLORAL",
  "content": {
    "introduction": "Join us to celebrate our wedding!",
    "coupleStory": "Our journey together...",
    "contactDisplay": {
      "showEmail": false,
      "showPhone": false
    }
  }
}
```

The server validates that the theme code is one of the four built-in themes and that the slug is globally unique and not reserved. Publishing is a separate explicit action. Public responses combine this configuration with wedding/event source-of-truth data and exclude private contact details unless specifically approved for public display.

### 5.15 Configure YouTube Live

`PUT /api/v1/weddings/current/livestream-config`

Request:

```json
{
  "youtubeVideoId": "abc123xyz",
  "isEnabled": true
}
```

Validate the video ID format; do not accept raw iframe HTML. When disabled or not configured, public website responses omit/disable the player. The product must not claim that embedding makes the underlying YouTube stream private.

---

## 6. Validation and business rules by domain

### 6.1 Authentication

- Normalize account email consistently and enforce unique `users.emailNormalized`.
- Do not require email verification at signup.
- Return a generic response to password-reset requests to avoid account enumeration.
- Password-reset tokens must be random, stored hashed, checked for expiry and single-use, and revoked/marked used after success.

### 6.2 Wedding and memberships

- A user can create a wedding only if they have no active membership.
- A user may join a wedding only after a valid invitation is accepted.
- Membership acceptance requires a valid, unexpired, unrevoked invitation token and a normalized account email matching the invitation's destination.
- An account can have no more than one active wedding membership.
- Only Admin can create/revoke membership invitations or remove Organisers.
- Organiser APIs must return `403 FORBIDDEN` when attempting membership management.
- Do not expose `weddingId` as a way to select another tenant.

### 6.3 Events, tasks, expenses, vendors

- Validate all referenced IDs belong to the current wedding.
- If a task has `assigneeMembershipId`, it must reference an active member of that wedding.
- If a task or expense has `vendorId`, that vendor must belong to the same wedding.
- Vendor-event assignment requires both event and vendor to belong to the current wedding and rejects duplicate assignment cleanly.
- Event delete means archive for V1, preserving related records. Task and expense delete follow the product's explicit delete operation; do not silently cascade-delete linked records.
- Expense request accepts a positive numeric amount, rounds to nearest whole rupee server-side, stores integer `amountRupees`, and returns that integer. Currency is `INR` only.

### 6.4 Guests, event assignments, RSVP

- `primaryContactName`, email and `familyCount >= 1` are required.
- Normalize email on the server. A duplicate `(weddingId, emailNormalized)` returns `409 GUEST_EMAIL_ALREADY_EXISTS`.
- CSV/XLSX import should use conservative configurable limits suitable for Vercel request constraints (recommended initial maximum: 4 MB and 1,000 rows per file). Validate rows, report row numbers and errors, and do not silently merge duplicate email records.
- RSVP statuses are only `ATTENDING` and `NOT_ATTENDING`. Absence of an RSVP record means pending.
- `familyCount` is a guest-management field, not an RSVP response or an attendance count.
- Reminder campaigns target only pending RSVP records for the relevant event.

### 6.5 Guest tokens

- Generate at least 256 bits of cryptographically secure randomness.
- Store token hashes rather than raw tokens except encrypted storage where needed for reusable QR rendering; V1 may instead return/download a generated QR once and reissue a new link if lost.
- Validate token hash, purpose, wedding/event/guest scope, expiry, and `revokedAt` on every request.
- Do not accept client-supplied guest/wedding/event IDs as authorization.
- Rate-limit token resolution and RSVP submission. Do not log raw tokens.
- Email/QR URLs should avoid leaking tokens to third parties. Prefer putting tokens in the URL fragment for the page to read, then POST the token to the API body and immediately remove it from browser history.

### 6.6 Photos and R2

- Only allow configured JPEG, PNG, and WebP MIME types for V1; enforce a configured maximum size.
- Treat the client MIME type as an assertion, not proof. Verify R2 metadata and expected object key on completion; use additional content verification if feasible without building a transformation pipeline.
- Set a short presigned URL expiry (initial recommendation: five minutes) and store the same R2 URL expiry in `uploadUrlExpiresAt`.
- `uploadUrlExpiresAt` is checked by Express on completion; R2 independently checks presigned URL expiry when the URL is used. These are separate security checks.
- MongoDB TTL on `purgeAt` is asynchronous housekeeping only. It is not an expiry/auth mechanism.
- A completed session should create a photo gallery record only if purpose is `GALLERY_PHOTO`; cover-image uploads update the relevant wedding/event cover key.
- Guest uploads default to `PENDING_REVIEW`; only `VISIBLE` photos are returned from public gallery endpoints.
- Private photos are served via controlled short-lived download URLs, not public CDN URLs.

### 6.7 Email and campaign processing

- Create one `emailRecipients` record per recipient within each campaign; retries update that record and its attempt count rather than creating duplicate rows.
- Use atomic conditional updates to claim `PENDING` recipients before submission.
- Record provider message IDs, submission status and sanitized error codes.
- Provider acceptance is not inbox delivery; use wording like “submitted” or “accepted by email provider” until delivery events are deliberately integrated.
- Keep each Vercel request bounded. Process at most 50 recipients per request initially. Do not attach files in the batch API; link to hosted invitations/websites.
- A raw invitation/reset token must not be stored. If a message must be retried after the token is no longer available in memory, revoke the old link and issue a replacement token/link before resending.

### 6.8 Website and livestream

- Only `PUBLISHED` website configurations can be fetched by `GET /public/websites/:slug`.
- Reserve system paths and enforce unique normalized slug at database level.
- Accept plain text fields; never persist arbitrary HTML or user scripts.
- Public website API returns only intentionally public fields. Do not return guest emails, expense details, member lists, or private notes.
- Validate and store a YouTube video ID, not arbitrary iframe markup. Actual privacy is governed by the YouTube video/live visibility mode.

### 6.9 Vendor discovery

- The discovery endpoint uses wedding/event coordinates when available; optionally accept explicit coordinates or location selection.
- Map application categories to supported Google Place types/keywords in a backend adapter.
- Send the minimal required field mask (e.g. display name, Place ID, address, rating and user-rating count, phone/website only where needed) to manage cost.
- V1 radius is limited to 50 km and per-search result count to the provider's supported limit; treat provider results as current search results, not the saved wedding vendor catalogue.
- Display required Google attribution. Store Place ID and user-confirmed vendor details, not provider ratings/review counts unless current Google terms permit it.
- Handle quota exhaustion/provider errors as `502 PROVIDER_ERROR` or a safe upstream-specific error; never expose API keys.

---

## 7. Common error codes

| HTTP status | Error code | Meaning |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Invalid body, path, query or field value |
| `401` | `UNAUTHENTICATED` | Missing or invalid session |
| `403` | `FORBIDDEN` | Valid account/token but action is outside its permission scope |
| `404` | `NOT_FOUND` | Resource absent or intentionally hidden across tenant boundaries |
| `409` | `CONFLICT` | Duplicate record, existing membership, or invalid state transition |
| `409` | `EMAIL_ALREADY_EXISTS` | Normalized email is already registered to an account |
| `409` | `USER_ALREADY_HAS_WEDDING` | Account already has an active wedding membership |
| `409` | `GUEST_EMAIL_ALREADY_EXISTS` | Normalized email already exists in this wedding's guest list |
| `409` | `SLUG_UNAVAILABLE` | Website slug is already used or reserved |
| `410` | `TOKEN_EXPIRED_OR_REVOKED` | Guest/membership/password-reset token expired, was used where single-use, or revoked |
| `413` | `PAYLOAD_TOO_LARGE` | Import or request exceeds configured limit |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | File type/content type is not permitted |
| `422` | `BUSINESS_RULE_VIOLATION` | Request shape is valid but violates a domain rule |
| `429` | `RATE_LIMITED` | Request rate exceeded |
| `502` | `PROVIDER_ERROR` | External provider failure (Resend, Google Places, R2) |
| `500` | `INTERNAL_ERROR` | Unexpected server error |

Avoid revealing another wedding's data through different error messages. In some cross-tenant cases, return `404 NOT_FOUND` instead of confirming that a resource exists elsewhere.

---

## 8. Security and operational requirements

1. Enforce permission checks in Express services, not only in the Next.js UI.
2. Derive authenticated wedding scope from membership; every query/update/delete includes wedding scope.
3. Use secure session cookies, CSRF/origin defenses, rate limits on login/password reset/public guest-token routes, and generic password-reset responses.
4. Use Zod validation for request body, path and query. Use Mongoose validators/indexes as defence in depth.
5. Store secrets only in server-side environment variables. Restrict Google API keys by API and environment where supported.
6. Avoid logging email content, tokens, session cookies, passwords, signed URLs, private photo URLs, or full provider payloads that may contain personal information.
7. Public guest links grant only one purpose. `PHOTO_UPLOAD` cannot change RSVP; `RSVP` cannot read photos; `GALLERY_VIEW` cannot upload/delete photos.
8. Do not rely on TTL deletion to block tokens or upload completion. Validate expiry/revocation at request time.
9. Do not rely on R2 object keys as authorization. Use controlled reads and presigned URLs for private photos.
10. API mutations should be idempotent where practical, and multi-document operations should use a MongoDB transaction when supported; otherwise implement safe state transitions and compensating cleanup.
11. Limit import size/rows and email recipients per request so requests remain inside current Vercel execution limits.
12. Keep basic application logs only for V1; log request/correlation IDs and sanitized failure categories.

---

## 9. Implementation order

### Phase 1 — API foundation

- Express application structure and `/api/v1` routing.
- Environment configuration and health routes.
- MongoDB connection management and Mongoose models/indexes.
- Shared Zod contracts and common error handler.
- Session authentication and authorization middleware.
- Wedding scoping helper and role guards.

### Phase 2 — Core wedding management

- Signup/login/logout/current account/password recovery.
- Create/read/update wedding and dashboard summary.
- Membership invitations and Admin-only organiser management.
- Events, tasks and expenses.

### Phase 3 — Guests and email

- Guest CRUD and CSV/XLSX import.
- Event guest assignments and RSVP summary.
- Guest access links and public RSVP.
- Resend campaign creation, batch processing, recipient tracking and retries.

### Phase 4 — Website, livestream and photos

- Website config, theme list, publish/unpublish and public website data.
- YouTube livestream settings.
- R2 photo-upload sessions, completion verification, moderation and private read URLs.

### Phase 5 — Vendors and final hardening

- Saved vendors, Google Places discovery and vendor-event assignments.
- Vendor association in task/expense endpoints.
- Cross-wedding isolation tests, token lifecycle tests, email duplicate/retry tests, upload expiry tests, and rate-limit tests.

---

## 10. Acceptance checklist

Before implementation is considered complete, verify that:

- [ ] A logged-in user cannot create a second active wedding or join a second wedding.
- [ ] Admin can invite/remove Organisers; Organiser attempts to manage membership return `403`.
- [ ] A membership invitation only works with a valid unexpired token, matching account email, and available membership slot.
- [ ] Every event/task/expense/guest/vendor/photo query is scoped to the user's wedding or a validated guest token.
- [ ] Duplicate guest email within the same wedding is rejected; the same email can exist in another wedding.
- [ ] `familyCount` is an integer of at least 1; RSVP only accepts `ATTENDING` or `NOT_ATTENDING`.
- [ ] Expense amount is stored/returned as whole integer INR rupees after server-side rounding.
- [ ] Vendor-event assignments are unique; task/expense vendor links validate wedding ownership.
- [ ] Only published wedding websites are returned from the public endpoint; only the four themes are accepted.
- [ ] Livestream is hidden when disabled and the UI does not imply that embedding guarantees privacy.
- [ ] Guest QR tokens are purpose-specific, hashed at rest, expiring/revocable, and never written to logs.
- [ ] R2 upload uses server-generated object keys, the browser uploads directly to R2, and completion checks session expiry and R2 metadata.
- [ ] Expired/revoked upload sessions cannot create visible photo records; guest images default to moderation review.
- [ ] Public gallery endpoints return only visible photos to a valid gallery-view token.
- [ ] Email campaign retries do not create duplicate recipient rows; processing handles at most 50 recipients per API call initially.
- [ ] Dashboard email state distinguishes provider acceptance from confirmed inbox delivery.
- [ ] CSV/XLSX imports return useful row-level errors and reject duplicate normalized guest emails.
- [ ] Cross-origin session/CORS/CSRF settings are tested in the actual Vercel deployment.

---

## 11. Database alignment items before implementation

The API contract reveals a few small schema points to reconcile before coding:

1. Add `purpose` to `photoUploadSessions` (`WEDDING_COVER`, `EVENT_COVER`, `GALLERY_PHOTO`) so completion knows whether to update a cover key or create a gallery photo.
2. For robust retries of campaign creation requests, consider adding an idempotency/request key to `emailCampaigns` with an appropriate unique index. If deferred, the client must not blindly retry campaign creation after an ambiguous network timeout.
3. `emailRecipients` must support the states described here (`PENDING`, `SUBMITTING`, `ACCEPTED`, `FAILED`) and use a compare-and-set claim operation.
4. Confirm whether a successful guest RSVP link stays valid for answer changes until expiry/revocation (recommended) and whether it is rotated when an invitation is resent.

These are implementation alignment notes, not additional product features.

---

## 12. Provider references

Provider behavior and limits can change. Confirm the applicable account plan and current provider terms before production launch.

- Vercel, Express deployment: https://vercel.com/docs/frameworks/backend/express
- Vercel Function timeout guidance: https://vercel.com/docs/errors/function_invocation_timeout
- Resend Batch Emails API (up to 100 emails per batch request, subject to current account/API behavior): https://resend.com/blog/introducing-the-batch-emails-api
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Google Places API (New), Nearby Search: https://developers.google.com/maps/documentation/places/web-service/nearby-search
- Google Places API field masks: https://developers.google.com/maps/documentation/places/web-service/choose-fields
- MongoDB TTL indexes: https://www.mongodb.com/docs/manual/core/index-ttl/
- Mongoose validation: https://mongoosejs.com/docs/validation.html
- Zod: https://zod.dev/

