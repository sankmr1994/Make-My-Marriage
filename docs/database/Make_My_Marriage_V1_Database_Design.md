# Make My Marriage V1 — Database Design

**Document type:** Database Design Specification  
**Version:** 1.1  
**Status:** Revised V1 design, incorporating confirmed guest and expense storage decisions  
**Database:** MongoDB Atlas  
**Data access:** Mongoose with TypeScript  
**Request validation:** Zod  
**Last updated:** 22 October 2026

---

## 1. Purpose

This document defines the V1 MongoDB data model for Make My Marriage. It translates the approved product and system architecture into collections, fields, relationships, indexes, validation rules, and data lifecycle behavior that can be implemented by the backend team.

The design preserves these product decisions:

- One active wedding membership per user account.
- Three product roles: `ADMIN`, `ORGANISER`, and accountless `GUEST`.
- Admins can add and remove Organisers; Organisers cannot manage organiser membership.
- Guest operations use scoped links/QR codes and do not require a Make My Marriage account.
- Events, tasks, expenses, guests, vendors, invitations, RSVPs, website content, livestream configuration, and photos are scoped to a wedding.
- Vendor-to-event, vendor-to-task, and vendor-to-expense links are supported.
- Guest records represent one family/household invitation with one primary contact, one email address, and a family count.
- Expense amounts are stored as whole INR rupees; positive decimal inputs are rounded to the nearest whole rupee before persistence.
- Expense tracking has no budget, forecast, advance, or remaining-balance model.
- The wedding website selects one of four built-in Indian themes; theme definitions live in application code, not as user-created database records.
- Photos are stored in Cloudflare R2; MongoDB stores metadata and object keys only.
- Email delivery uses Resend with small batches and recipient-level status tracking.
- No audit-history collection, dedicated queue, image processing pipeline, or complex observability platform is required in V1.

## 2. Modeling principles

1. **Keep independently growing entities in separate collections.** Guests, events, tasks, expenses, photos, campaign recipients, and upload sessions can grow independently, so they are not embedded as unbounded arrays in a wedding document.
2. **Embed small, stable values.** Couple details, wedding location, event venue, simple contact details, and website copy can be embedded in their parent document.
3. **Use references for relationships.** Use MongoDB `ObjectId` references between weddings, users, events, guests, tasks, expenses, and vendors.
4. **Repeat `weddingId` on wedding-scoped child records.** This intentional duplication makes tenant-scoped queries and compound indexes straightforward. The service layer must verify that every referenced record belongs to the same wedding.
5. **Store money as whole INR rupees.** `amountRupees: 1251` represents ₹1,251. Positive decimal inputs are rounded to the nearest whole rupee before storage; do not store paise. Format stored integer rupees as INR in the UI.
6. **Store timestamps as BSON Date in UTC.** Store an IANA timezone such as `Asia/Kolkata` for wedding/event presentation. Convert user-entered local date/time using that timezone before persistence.
7. **Store media in object storage.** MongoDB stores R2 object keys, size, MIME type, moderation state, and metadata—not binary photo content or permanent public URLs for private assets.
8. **Validate at multiple layers.** Zod validates API input, Mongoose validates document shape, MongoDB indexes enforce uniqueness, and application services enforce cross-document business rules.
9. **No activity log collection in V1.** Use basic application logs, with secrets and sensitive guest data excluded.

MongoDB recommends choosing embedded documents versus references according to access patterns and relationship complexity. Large or independently queried child entities are a good fit for references. See the official data-modeling references at the end of this document.

## 3. Entity relationship overview

The relationship model can be read as follows:

- `users` connect to `weddings` through `weddingMemberships`. A user may have at most one active membership; a wedding has multiple Admin/Organiser memberships.
- A `wedding` has many `events`, `tasks`, `expenses`, `guests`, `vendors`, `photos`, `guestAccessLinks`, `emailCampaigns`, and `photoUploadSessions`.
- `eventGuestAssignments` connect `events` and `guests` many-to-many. `rsvps` stores the current response for one family invitation and one event.
- `vendorEventAssignments` connect `vendors` and `events` many-to-many. A `task` and an `expense` may each have an optional `vendorId`.
- `emailCampaigns` have many `emailRecipients`, one per recipient message in that campaign.
- Each wedding has one `websiteConfigs` record and one `livestreamConfigs` record in V1.
- A successful `photoUploadSessions` record leads to a `photos` metadata record; photo bytes remain in Cloudflare R2.
- `membershipInvitations` join a proposed member to a wedding, while `guestAccessLinks` authorize a specific guest-facing operation without creating a guest account.

```text
User --< WeddingMembership >-- Wedding
                                  |--< Events
                                  |--< Tasks ---------------- optional Vendor
                                  |--< Expenses -------------- optional Vendor
                                  |--< Guests --< EventGuestAssignments >-- Events
                                  |                |
                                  |                +--< RSVPs (one current response per event/family invitation)
                                  |--< Vendors --< VendorEventAssignments >-- Events
                                  |-- 1 WebsiteConfig
                                  |-- 1 LivestreamConfig
                                  |--< GuestAccessLinks
                                  |--< EmailCampaigns --< EmailRecipients
                                  |--< PhotoUploadSessions --> Photos metadata (file bytes in R2)
```

`users` and `weddingMemberships` represent logged-in Admins and Organisers. Guests are records in `guests`; they are not records in `users` unless they independently create an account and are invited into a management role.

## 4. Collection inventory

| Collection | Purpose | Key relationships |
|---|---|---|
| `users` | Login accounts and profile | One active membership at most |
| `sessions` | Server-side login sessions; schema managed by session-store adapter | Session ID to stored session payload |
| `weddings` | Main wedding record | Created by a user; has members and child collections |
| `weddingMemberships` | Admin/Organiser membership and role | `weddingId`, `userId` |
| `membershipInvitations` | Invitation to join a wedding as Admin or Organiser | `weddingId`, inviter, optional accepted user |
| `events` | Wedding events and venues | `weddingId` |
| `tasks` | Tasks and assignees | `weddingId`, optional event/member/vendor |
| `expenses` | Actual expenses only | `weddingId`, optional event/vendor/payer |
| `guests` | Accountless family/household invitation records | `weddingId`, `primaryContactName`, `emailNormalized`, `familyCount` |
| `eventGuestAssignments` | Which guests are invited to which events | `weddingId`, `eventId`, `guestId` |
| `rsvps` | Event attendance answer | `weddingId`, `eventId`, `guestId` |
| `guestAccessLinks` | Hashed/controlled RSVP and QR-based guest links | `weddingId`, purpose, optional event/guest |
| `emailCampaigns` | A logical batch of emails | `weddingId`, creator |
| `emailRecipients` | Per-recipient provider submission result | `campaignId`, optional guest/event/link references |
| `websiteConfigs` | Selected theme, public slug and website content | One per wedding |
| `livestreamConfigs` | YouTube Live embed configuration | One per wedding in V1 |
| `photos` | Photo metadata and gallery/moderation state | `weddingId`, optional event/upload link |
| `photoUploadSessions` | One temporary upload authorization per selected photo | `weddingId`, optional event/link, R2 object key |
| `vendors` | Vendors saved to the wedding | `weddingId`, optional Google Place ID |
| `vendorEventAssignments` | Links saved vendors to events | `weddingId`, `vendorId`, `eventId` |
| `passwordResetTokens` | Expiring password-recovery tokens | `userId` |

Static website theme definitions are stored in the application (for example, `traditional`, `royal`, `floral`, `modern`) and versioned in code. Do not create a separate `themes` collection for four fixed V1 themes.

## 5. Collection schemas

The field lists below define the proposed logical schema. All documents should use `createdAt` and `updatedAt` timestamps unless noted otherwise. Mongoose `timestamps: true` can manage these fields.

### 5.1 `users`

Stores application accounts only. Does not store guest RSVP records.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes | MongoDB primary key |
| `displayName` | string | Yes | Trimmed; reasonable maximum length |
| `email` | string | Yes | Display form; normalized for login |
| `emailNormalized` | string | Yes | Trimmed/lowercase according to one normalization function; unique index |
| `passwordHash` | string | Yes | Secure password hash; never plaintext |
| `status` | enum | Yes | `ACTIVE`, `DISABLED` |
| `lastLoginAt` | Date | No | Last successful login |
| `createdAt`, `updatedAt` | Date | Yes | Timestamps |

V1 does **not** require `emailVerifiedAt` and does not implement account-creation email verification. Because unverified email is an accepted trade-off, organiser invitations must still be accepted with a strong, purpose-specific invitation token and an email-address match check.

### 5.2 `sessions`

Managed by the chosen MongoDB-backed Express session-store adapter. Avoid hand-writing session documents unless required by that library. Configure secure cookies and expiry; ensure the store has the appropriate expiry index. Do not use an in-memory session store in production.

### 5.3 `weddings`

One root document per wedding.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Primary key |
| `createdByUserId` | ObjectId | Yes | References `users._id` |
| `couple.brideName` | string | Yes | Trimmed |
| `couple.groomName` | string | Yes | Trimmed |
| `weddingDate` | string (`YYYY-MM-DD`) | Yes | Local calendar date of the wedding; avoids UTC date shifting for date-only values |
| `timeZone` | string | Yes | IANA name; default may be `Asia/Kolkata` |
| `location.address` | string | Yes | Wedding location entered by user |
| `location.city` | string | No | Useful for vendor discovery |
| `location.state` | string | No |  |
| `location.country` | string | No |  |
| `location.coordinates` | GeoJSON Point | No | `{ type: "Point", coordinates: [longitude, latitude] }`; add a `2dsphere` index only if spatial MongoDB queries are needed |
| `contact.phone` | string | No | Treat as private data |
| `contact.email` | string | No | Contact information shown only where permitted |
| `couple.photoObjectKey` | string | No | R2 object key; not binary data |
| `status` | enum | Yes | `ACTIVE`, `ARCHIVED` |
| `createdAt`, `updatedAt` | Date | Yes | Timestamps |

Admin membership is authoritative in `weddingMemberships`, not in a duplicated `adminUserIds` array.

### 5.4 `weddingMemberships`

Represents all logged-in Admins and Organisers for a wedding.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes | References `weddings._id` |
| `userId` | ObjectId | Yes | References `users._id` |
| `role` | enum | Yes | `ADMIN`, `ORGANISER` only |
| `status` | enum | Yes | `ACTIVE`, `REMOVED` |
| `invitedByUserId` | ObjectId | No | References inviter where relevant |
| `joinedAt` | Date | Yes |  |
| `removedAt` | Date | No | Set when removed |
| `createdAt`, `updatedAt` | Date | Yes |  |

Rules:

- Create the first Admin membership when a user creates a wedding.
- The second Admin can be added through a controlled partner/Admin invitation flow; the intended product maximum is two Admin memberships (bride and groom). Enforce this in the service layer and transaction, because a normal unique index cannot enforce a maximum count of two.
- Admins can invite/remove Organisers. Organisers cannot create, revoke or manage organiser membership.
- A user can have at most one active wedding membership. Enforce via a unique partial index on `userId` for documents where `status: ACTIVE`.
- A membership's `userId` must be active and `weddingId` must be active.

### 5.5 `membershipInvitations`

One document per invite token, including reissued invitations.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes |  |
| `emailNormalized` | string | Yes | Destination email snapshot, normalized |
| `role` | enum | Yes | `ADMIN`, `ORGANISER` |
| `invitedByUserId` | ObjectId | Yes | Must be an Admin for an Organiser invitation; partner flow is separately controlled |
| `tokenHash` | string | Yes | Hash of cryptographically random token; unique index |
| `status` | enum | Yes | `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED` |
| `expiresAt` | Date | Yes | Always check explicitly in the API; TTL cleanup is asynchronous |
| `acceptedByUserId` | ObjectId | No | Set on acceptance |
| `acceptedAt` | Date | No |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

On acceptance, require a valid token, unexpired and non-revoked status, a matching normalized account email, and no existing active wedding membership. Create the membership and mark the invitation accepted atomically where supported.

### 5.6 `events`

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes | Tenant scope |
| `clientEventId` | string | No | Client-generated UUID used only for idempotent onboarding retries; unique within a wedding when present |
| `name` | string | Yes | User-entered event name; manual event creation in V1 |
| `startsAt` | Date | Yes | UTC instant computed from local entry plus event timezone |
| `endsAt` | Date | No | Must be after `startsAt` if supplied |
| `timeZone` | string | Yes | IANA timezone used for local display |
| `venue.name` | string | No |  |
| `venue.address` | string | Yes |  |
| `venue.city` | string | No |  |
| `venue.coordinates` | GeoJSON Point | No | `{ type: "Point", coordinates: [longitude, latitude] }`; may seed vendor search location |
| `description` | string | No | Length-limited plain text |
| `photoObjectKey` | string | No | R2 key, optional |
| `status` | enum | Yes | `ACTIVE`, `ARCHIVED`; archived events are hidden from normal event lists but retained for historical references |
| `createdByUserId` | ObjectId | Yes |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

The API must not accept arbitrary HTML in event fields. When an event is archived, keep linked tasks/expenses/history intact and hide the event from active planning lists. Permanent deletion/purge can be an explicit later operation.

### 5.7 `tasks`

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes |  |
| `eventId` | ObjectId | No | If provided, event must belong to the same wedding |
| `title` | string | Yes | Trimmed; not empty |
| `description` | string | No | Plain text |
| `assigneeMembershipId` | ObjectId | No | Must be an active membership in this wedding |
| `dueAt` | Date | No | Tasks can have no due date |
| `priority` | enum | Yes | `LOW`, `MEDIUM`, `HIGH` |
| `status` | enum | Yes | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED` |
| `notes` | string | No | Length-limited plain text |
| `vendorId` | ObjectId | No | Optional vendor relationship; does not give vendor login access |
| `createdByUserId` | ObjectId | Yes |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

Task reminders are out of scope. Dashboard queries can still display upcoming or overdue tasks. The service must verify the assignee membership and vendor are scoped to the same wedding.

### 5.8 `expenses`

Actual expense records only; this is not a budget-management model. Store INR values as whole rupees. If the API receives a positive decimal amount, round it to the nearest whole rupee before persistence (for example, ₹1,250.40 becomes ₹1,250; ₹1,250.50 becomes ₹1,251; ₹1,250.75 becomes ₹1,251). After rounding, reject the amount if it is less than ₹1. The persisted field must always be an integer; do not store paise.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes |  |
| `eventId` | ObjectId | No | Optional; must belong to the same wedding |
| `description` | string | Yes | Expense name/details |
| `amountRupees` | integer | Yes | Whole INR rupees, greater than zero; round positive decimal inputs to nearest whole rupee before storing |
| `currency` | string | Yes | `INR` in V1 |
| `category` | string / enum | Yes | Simple category; allow an `OTHER` value |
| `paymentStatus` | enum | Yes | `PAID`, `UNPAID` |
| `paymentDate` | Date | No | Required when paid if that rule is applied in the service; must not be a future date unless product rules allow it |
| `payerUserId` | ObjectId | No | Optional if payer is a logged-in member |
| `payerName` | string | No | Free-text payer for someone without an account |
| `vendorId` | ObjectId | No | Optional vendor integration |
| `notes` | string | No | Plain text |
| `createdByUserId` | ObjectId | Yes |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

Do not add budget totals, planned-vs-actual fields, shared-family cost allocation, vendor advances, remaining balances, or forecasts. Dashboard totals should be aggregated from expense records rather than stored as the authoritative financial value.

### 5.9 `guests`

Each document represents one family/household invitation for a wedding, not an individual login account. One family record has one primary contact, one email address, and a family count. The RSVP is one response per family per event. `familyCount` is used for approximate people counts; it is not an RSVP question.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes |  |
| `primaryContactName` | string | Yes | Name of the primary contact for this family; trimmed |
| `email` | string | Yes | One email address for this family; required because V1 invitations are sent by email |
| `emailNormalized` | string | Yes | Trimmed/lowercase using one normalization function; unique within a wedding |
| `familyCount` | integer | Yes | Number of people represented by the family invitation; must be at least 1 |
| `status` | enum | Yes | `ACTIVE`, `ARCHIVED` |
| `createdByUserId` | ObjectId | Yes |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

CSV/Excel import should validate rows and return row-level errors. Enforce a unique compound index on `(weddingId, emailNormalized)` so one email address represents at most one family invitation per wedding. During import, flag duplicate normalized emails within the same wedding and report the affected row numbers; do not silently merge records. The same email may still be used in a different wedding.

### 5.10 `eventGuestAssignments`

Defines the guest list for each event and provides a fast way to display invitation state.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes |  |
| `eventId` | ObjectId | Yes |  |
| `guestId` | ObjectId | Yes |  |
| `invitationStatus` | enum | Yes | `NOT_SENT`, `SUBMITTED`, `FAILED` |
| `lastInvitationSubmittedAt` | Date | No | `SUBMITTED` means accepted by Resend API, not confirmed inbox delivery |
| `lastInvitationRecipientId` | ObjectId | No | Most recent campaign recipient attempt |
| `assignedByUserId` | ObjectId | Yes |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

Unique constraint: one assignment per `(weddingId, eventId, guestId)`. Here, `guestId` identifies a family/household invitation record. Verify event and guest both belong to `weddingId` before write.

### 5.11 `rsvps`

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes |  |
| `eventId` | ObjectId | Yes |  |
| `guestId` | ObjectId | Yes |  |
| `response` | enum | Yes | `ATTENDING`, `NOT_ATTENDING` only |
| `respondedAt` | Date | Yes |  |
| `source` | enum | Yes | `INVITATION_LINK`, `OTHER_GUEST_LINK` |
| `createdAt`, `updatedAt` | Date | Yes |  |

Unique constraint: `(eventId, guestId)`. Here, `guestId` identifies a family/household invitation record; one RSVP applies to the whole family invitation. The absence of an RSVP document means `PENDING`; do not store a separate `PENDING` row unless there is a later reason. A valid token may update the family's answer until the link expires or is revoked. The endpoint must not accept a guest ID from untrusted request data without checking the token-to-guest mapping.

### 5.12 `guestAccessLinks`

Used for RSVP links and reusable QR/link access for photo uploads or gallery viewing.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes | Scope |
| `purpose` | enum | Yes | `RSVP`, `PHOTO_UPLOAD`, `GALLERY_VIEW` |
| `eventId` | ObjectId | No | Required for event-specific RSVP; optional for wedding-wide photo link |
| `guestId` | ObjectId | No | Required for RSVP link; absent for shared QR links |
| `tokenHash` | string | Yes | Unique; store a secure hash of the raw random token for validation |
| `tokenCiphertext` | string | No | Only for reusable QR links if the same QR must be re-rendered; encrypt with authenticated encryption and a server-only key, or reissue a new link instead |
| `expiresAt` | Date | No | If absent, the link stays valid until revoked; recommended to set a default expiration for QR links |
| `revokedAt` | Date | No | A non-null value blocks access |
| `createdByUserId` | ObjectId | No | Admin/Organiser that generated the link |
| `createdAt`, `updatedAt` | Date | Yes |  |

Generate at least 256 bits of randomness for bearer tokens. Store only the token hash where possible. For persistent QR posters, choose one explicit strategy: keep the raw token encrypted server-side so the same QR can be displayed again, or provide a “create new QR” flow and let Admin download/save the QR graphic. Do not store raw RSVP or password-reset tokens.

### 5.13 `emailCampaigns`

Tracks a logical operation such as an invitation batch or RSVP reminder. This is a lightweight record, not a job queue.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes |  |
| `type` | enum | Yes | `WEDDING_INVITATION`, `ORGANISER_INVITATION`, `RSVP_REMINDER`, `PASSWORD_RESET` |
| `status` | enum | Yes | `DRAFT`, `PROCESSING`, `PARTIALLY_SUBMITTED`, `SUBMITTED`, `FAILED` |
| `createdByUserId` | ObjectId | No | Null only for appropriate system-generated messages |
| `recipientCount` | number | Yes | Snapshot count |
| `submittedCount` | number | Yes | Provider accepted/submitted count |
| `failedCount` | number | Yes | Failed count |
| `lastProcessedAt` | Date | No |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

Process a small batch (initially up to about 50 recipients per API call, subject to current provider limits and Vercel execution limits). No dedicated queue/worker is required in V1. Keep campaign recipient state in `emailRecipients` so a retry can target only eligible failed/pending recipients. The UI must call these messages “submitted/sent” only as accurately as the provider response permits; provider acceptance does not prove inbox delivery.

### 5.14 `emailRecipients`

One document per recipient message attempt within a campaign.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `campaignId` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes | Denormalized for tenant-scoped lookup |
| `guestId` | ObjectId | No | For guest mail |
| `eventId` | ObjectId | No | For event invitations/reminders |
| `membershipInvitationId` | ObjectId | No | For organiser/partner invitations |
| `guestAccessLinkId` | ObjectId | No | Link included in an invitation where applicable |
| `recipientKey` | string | Yes | Deterministic key for this recipient/action within the campaign; unique with `campaignId` |
| `recipientEmail` | string | Yes | Email snapshot needed to execute this campaign |
| `messageType` | enum | Yes | Same known message types as campaign |
| `status` | enum | Yes | `PENDING`, `SUBMITTING`, `ACCEPTED`, `FAILED` |
| `attemptCount` | integer | Yes | Defaults to 0 |
| `providerMessageId` | string | No | Resend message ID when returned |
| `lastErrorCode` | string | No | Sanitized category only; do not keep secrets or full sensitive provider payloads |
| `submittedAt` | Date | No |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

Use a deterministic `recipientKey` (or equivalent) and a unique index on `(campaignId, recipientKey)` to prevent duplicate recipient rows in the same campaign. Use a compare-and-set status transition when claiming `PENDING` recipients for submission.

### 5.15 `websiteConfigs`

One website configuration per wedding, with four fixed theme keys stored in code.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes | Unique index: one config per wedding |
| `slug` | string | Yes | Normalized; globally unique; reserve system routes/words |
| `themeCode` | enum | Yes | `TRADITIONAL`, `ROYAL`, `FLORAL`, `MODERN` |
| `themeVersion` | string | Yes | Code version for stable rendering if a theme changes later |
| `publishStatus` | enum | Yes | `DRAFT`, `PUBLISHED`, `UNPUBLISHED` |
| `content.introduction` | string | No | Plain text only |
| `content.coupleStory` | string | No | Plain text only |
| `content.coverPhotoObjectKey` | string | No | R2 key |
| `content.contactDisplay` | object | No | Explicitly selected public contact values only |
| `publishedAt` | Date | No |  |
| `updatedByUserId` | ObjectId | Yes |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

Couple names, main wedding date/location, and event information remain the source of truth in `weddings` and `events`. The website renderer combines these with approved website copy and the selected theme. Never serve draft content from public routes. Do not store arbitrary HTML or custom scripts.

### 5.16 `livestreamConfigs`

One configuration per wedding in V1.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes | Unique index |
| `youtubeVideoId` | string | No | Store the validated video/live identifier, not arbitrary iframe HTML |
| `isEnabled` | boolean | Yes | Defaults false |
| `configuredByUserId` | ObjectId | Yes |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

YouTube viewer access is governed by the stream's YouTube visibility configuration; an embedded player does not make a stream private. The website should hide the player when disabled and should not claim confidentiality beyond the configured YouTube mode.

### 5.17 `photos`

MongoDB stores only metadata; media bytes are stored in R2.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes |  |
| `eventId` | ObjectId | No | If supplied, event must belong to the wedding |
| `objectKey` | string | Yes | Unique R2 object key; never accept an arbitrary key from guest input |
| `originalFilename` | string | No | Sanitized display value only |
| `contentType` | string | Yes | Allow-listed image MIME types for V1 |
| `sizeBytes` | integer | Yes | Must be within application size limit |
| `etag` | string | No | R2 object metadata if available |
| `uploaderType` | enum | Yes | `GUEST`, `ADMIN`, `ORGANISER` |
| `guestAccessLinkId` | ObjectId | No | Link used for guest upload |
| `moderationStatus` | enum | Yes | `PENDING_REVIEW`, `VISIBLE`, `REJECTED`, `DELETED` |
| `createdAt`, `updatedAt` | Date | Yes |  |

Private photos are served using controlled access, such as short-lived signed download URLs. Do not use a public CDN URL for private photos. A photo is not visible in the shared gallery until its moderation state and gallery access rules permit it.

### 5.18 `photoUploadSessions`

One document for each requested direct-to-R2 upload. Do not persist the presigned URL itself.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes | Upload session ID |
| `weddingId` | ObjectId | Yes |  |
| `eventId` | ObjectId | No | Optional event association |
| `guestAccessLinkId` | ObjectId | No | Guest QR/link context |
| `objectKey` | string | Yes | Unique server-generated R2 key |
| `expectedContentType` | string | Yes | Allow-list, e.g. JPEG/PNG/WebP |
| `expectedSizeBytes` | integer | Yes | Validate positive and below configured maximum |
| `uploadUrlExpiresAt` | Date | Yes | Must be checked against current time in completion flow |
| `status` | enum | Yes | `PENDING`, `COMPLETED`, `EXPIRED`, `REJECTED` |
| `completedAt` | Date | No |  |
| `purgeAt` | Date | Yes | Later cleanup date; TTL index may be used for this field, not `uploadUrlExpiresAt` |
| `createdAt`, `updatedAt` | Date | Yes |  |

The backend validates wedding/link scope before issuing a URL. After upload, it checks the session is still permitted, confirms the expected object key exists in R2, and verifies size/content-type metadata before creating a `photos` record. R2 expiry controls the presigned URL; the application's `uploadUrlExpiresAt` controls whether the completion action is still accepted by the app. These are separate checks.

### 5.19 `vendors`

Vendors do not log in. The saved vendor record belongs to one wedding.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes |  |
| `name` | string | Yes | User-confirmed display name |
| `category` | enum/string | Yes | Photographer, videographer, decorator, backdrop decorator, makeup artist, mehendi artist, caterer, venue, DJ/music, event planner, florist, invitation/printing, transportation, other |
| `source` | enum | Yes | `MANUAL`, `GOOGLE_PLACES` |
| `googlePlaceId` | string | No | May be stored as place identifier; consider unique per wedding when supplied |
| `contactPerson` | string | No | User-entered |
| `phone` | string | No | Prefer user-entered/confirmed contact detail |
| `email` | string | No | User-entered/confirmed contact detail |
| `address` | string | No | User-entered/confirmed address; provider data storage restrictions apply to Places results |
| `website` | string | No | User-entered/confirmed URL |
| `notes` | string | No | Private wedding notes |
| `status` | enum | Yes | `ACTIVE`, `ARCHIVED` |
| `createdByUserId` | ObjectId | Yes |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

For nearby discovery, fetch current Google Places results on demand. Do not permanently cache Places ratings, review counts, or other restricted place content in this collection without verifying current Google policies. Save the `placeId`, a user-chosen category, user-authored notes, and details entered/confirmed by the user. Display Google's required attribution when provider content is shown.

### 5.20 `vendorEventAssignments`

Many-to-many connection between saved vendors and wedding events.

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `weddingId` | ObjectId | Yes |  |
| `vendorId` | ObjectId | Yes | Same wedding |
| `eventId` | ObjectId | Yes | Same wedding |
| `notes` | string | No | Optional event-specific note |
| `createdByUserId` | ObjectId | Yes |  |
| `createdAt`, `updatedAt` | Date | Yes |  |

Unique constraint: `(weddingId, vendorId, eventId)`. A task or expense can reference `vendorId` directly, in addition to the task/expense's optional `eventId`.

### 5.21 `passwordResetTokens`

| Field | Type | Required | Rules / notes |
|---|---|---:|---|
| `_id` | ObjectId | Yes |  |
| `userId` | ObjectId | Yes |  |
| `tokenHash` | string | Yes | Unique index; never store raw reset token |
| `expiresAt` | Date | Yes | Validate explicitly in request handler |
| `usedAt` | Date | No | A used token cannot be reused |
| `createdAt` | Date | Yes |  |

A TTL index can clean up expired tokens, but authorization must check expiry and use state even if a document still exists. MongoDB TTL cleanup is asynchronous.

## 6. Index design

Create indexes through versioned setup/migration scripts. Avoid relying only on Mongoose's automatic index creation in production. Verify index definitions in the target Atlas environment before launch.

| Collection | Index | Purpose |
|---|---|---|
| `users` | Unique `{ emailNormalized: 1 }` | Prevent duplicate login accounts |
| `sessions` | Store-adapter expiry index | Expire inactive sessions |
| `weddings` | `{ createdByUserId: 1, status: 1 }` | Locate creator's wedding/status |
| `weddingMemberships` | Unique partial `{ userId: 1 }` where `status: ACTIVE` | Enforce one active wedding membership per account |
| `weddingMemberships` | `{ weddingId: 1, status: 1, role: 1 }` | Load active Admins/Organisers |
| `membershipInvitations` | Unique `{ tokenHash: 1 }` | Resolve token securely |
| `membershipInvitations` | `{ weddingId: 1, emailNormalized: 1, status: 1 }` | Find/reissue pending invitation |
| `membershipInvitations` | TTL `{ expiresAt: 1 }` (if old records may be removed) | Cleanup only; API still checks expiry |
| `events` | `{ weddingId: 1, status: 1, startsAt: 1 }` | Active upcoming events |
| `events` | Unique partial `{ weddingId: 1, clientEventId: 1 }` where `clientEventId` is a string | Idempotent onboarding event saves |
| `tasks` | `{ weddingId: 1, status: 1, dueAt: 1 }` | Dashboard status and overdue tasks |
| `tasks` | `{ weddingId: 1, assigneeMembershipId: 1, status: 1 }` | Tasks by assignee |
| `tasks` | `{ weddingId: 1, eventId: 1, status: 1 }` | Tasks per event |
| `expenses` | `{ weddingId: 1, paymentStatus: 1, paymentDate: -1 }` | Paid/unpaid summaries and filtering |
| `expenses` | `{ weddingId: 1, eventId: 1 }` | Event expenses |
| `expenses` | `{ weddingId: 1, vendorId: 1 }` | Expenses associated with a vendor |
| `guests` | `{ weddingId: 1, primaryContactName: 1 }` | Guest/family list search and sorting |
| `guests` | Unique `{ weddingId: 1, emailNormalized: 1 }` | Enforce one family record per email within a wedding; validate imports |
| `eventGuestAssignments` | Unique `{ weddingId: 1, eventId: 1, guestId: 1 }` | Prevent duplicate guest assignment |
| `eventGuestAssignments` | `{ weddingId: 1, eventId: 1, invitationStatus: 1 }` | Event invite/RSVP dashboard |
| `rsvps` | Unique `{ eventId: 1, guestId: 1 }` | One current RSVP per event/family invitation |
| `rsvps` | `{ weddingId: 1, eventId: 1, response: 1 }` | RSVP counts by event |
| `guestAccessLinks` | Unique `{ tokenHash: 1 }` | Resolve bearer token hash |
| `guestAccessLinks` | `{ weddingId: 1, purpose: 1, revokedAt: 1 }` | Manage/revoke scoped links |
| `guestAccessLinks` | TTL `{ expiresAt: 1 }` only if retention policy wants deletion | Cleanup; code must enforce expiry regardless of TTL |
| `emailCampaigns` | `{ weddingId: 1, createdAt: -1 }` | Campaign history |
| `emailCampaigns` | `{ weddingId: 1, status: 1 }` | Campaign status |
| `emailRecipients` | `{ campaignId: 1, status: 1 }` | Process batches and show progress |
| `emailRecipients` | Unique `{ campaignId: 1, recipientKey: 1 }` | Prevent duplicate target rows within campaign |
| `websiteConfigs` | Unique `{ weddingId: 1 }` | One config per wedding |
| `websiteConfigs` | Unique `{ slug: 1 }` | Unique public URL |
| `livestreamConfigs` | Unique `{ weddingId: 1 }` | One V1 configuration per wedding |
| `photos` | Unique `{ objectKey: 1 }` | Avoid two records for one object |
| `photos` | `{ weddingId: 1, moderationStatus: 1, createdAt: -1 }` | Gallery moderation/listing |
| `photos` | `{ weddingId: 1, eventId: 1, moderationStatus: 1, createdAt: -1 }` | Event album queries |
| `photoUploadSessions` | Unique `{ objectKey: 1 }` | One upload session per R2 key |
| `photoUploadSessions` | `{ weddingId: 1, status: 1, createdAt: -1 }` | Inspect pending uploads |
| `photoUploadSessions` | TTL `{ purgeAt: 1 }` | Remove old upload session metadata after retention period |
| `vendors` | `{ weddingId: 1, status: 1, category: 1, name: 1 }` | Saved vendor list/filter |
| `vendors` | Unique partial `{ weddingId: 1, googlePlaceId: 1 }` when `googlePlaceId` is a string | Avoid saving the same Place ID twice per wedding |
| `vendorEventAssignments` | Unique `{ weddingId: 1, vendorId: 1, eventId: 1 }` | Prevent duplicate vendor-event link |
| `vendorEventAssignments` | `{ weddingId: 1, eventId: 1 }` | List vendors for event |
| `passwordResetTokens` | Unique `{ tokenHash: 1 }` | Resolve reset tokens |
| `passwordResetTokens` | TTL `{ expiresAt: 1 }` | Clean up expired reset tokens |

**TTL rule:** TTL indexes delete expired records asynchronously. They are housekeeping, not security enforcement. Every token and presigned upload completion must validate its own expiry in application code.

## 7. Cross-document integrity rules

MongoDB references are not foreign keys. Enforce these rules in service functions before writes:

1. Every authenticated management request resolves an active `weddingMembership` and scopes reads/writes by its `weddingId`.
2. Every `eventId`, `guestId`, `vendorId`, `assigneeMembershipId`, or `userId` reference belongs to the same wedding where applicable.
3. The requester must have a role allowed for the action. Only Admin may create/revoke Organiser membership.
4. A user may have one active wedding membership. Rely on the unique partial index as the final race-condition barrier; do not rely only on a pre-check.
5. The first wedding and first Admin membership should be created in a MongoDB transaction where supported, so the account is not left with a wedding but no membership.
6. Invitation acceptance should validate token hash, purpose, status, expiry, normalized target email and existing membership, then create membership and update invitation atomically where supported.
7. Event/guest assignment validates both documents and uses a unique index for duplicate prevention.
8. RSVP upsert is permitted only when the link resolves to the intended guest/event and the assignment remains valid.
9. Website routes publish only approved `PUBLISHED` content. Slugs must be normalized and globally unique.
10. Photo completion verifies upload session, wedding scope, expiry, expected object key, and object metadata from R2. An uploaded photo is not automatically approved for a gallery.
11. Vendor links on tasks/expenses and `vendorEventAssignments` must stay within the same wedding.
12. Email campaign recipient creation and submission must be idempotent enough to avoid duplicate messages when the frontend retries an API call.

## 8. Recommended enums and shared types

Use literal string values for readability and stable API contracts.

```ts
export type MembershipRole = "ADMIN" | "ORGANISER";
export type MembershipStatus = "ACTIVE" | "REMOVED";

export type EventStatus = "ACTIVE" | "ARCHIVED";
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type ExpensePaymentStatus = "PAID" | "UNPAID";
export type GuestStatus = "ACTIVE" | "ARCHIVED";
export type RSVPResponse = "ATTENDING" | "NOT_ATTENDING";

export type WebsiteThemeCode =
  | "TRADITIONAL"
  | "ROYAL"
  | "FLORAL"
  | "MODERN";
export type WebsitePublishStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export type VendorSource = "MANUAL" | "GOOGLE_PLACES";
export type VendorStatus = "ACTIVE" | "ARCHIVED";
export type PhotoModerationStatus =
  | "PENDING_REVIEW"
  | "VISIBLE"
  | "REJECTED"
  | "DELETED";

export type GuestAccessPurpose = "RSVP" | "PHOTO_UPLOAD" | "GALLERY_VIEW";
export type EmailRecipientStatus = "PENDING" | "SUBMITTING" | "ACCEPTED" | "FAILED";
```

Do not duplicate enum values in many files. Export shared TypeScript types or use schemas from a shared validation package.

## 9. Example documents

Examples are illustrative. MongoDB `ObjectId` values are represented as placeholders rather than valid JSON `ObjectId` constructors.

### Wedding

```json
{
  "_id": "<weddingObjectId>",
  "createdByUserId": "<userObjectId>",
  "couple": {
    "brideName": "Riya",
    "groomName": "Arjun",
    "photoObjectKey": "weddings/<weddingId>/cover/couple.jpg"
  },
  "weddingDate": "2027-01-29",
  "timeZone": "Asia/Kolkata",
  "location": {
    "address": "Wedding venue address",
    "city": "Coimbatore",
    "state": "Tamil Nadu",
    "country": "India"
  },
  "status": "ACTIVE"
}
```

### Guest / family invitation

```json
{
  "weddingId": "<weddingObjectId>",
  "primaryContactName": "Ravi Kumar",
  "email": "ravi@example.com",
  "emailNormalized": "ravi@example.com",
  "familyCount": 4,
  "status": "ACTIVE"
}
```

This represents one family invitation. The family name is not stored. `familyCount` is used for approximate attendee totals; the RSVP is still only `ATTENDING` or `NOT_ATTENDING` for the family as a whole.

### Task linked to a vendor

```json
{
  "weddingId": "<weddingObjectId>",
  "eventId": "<eventObjectId>",
  "title": "Confirm photographer arrival time",
  "assigneeMembershipId": "<membershipObjectId>",
  "vendorId": "<vendorObjectId>",
  "priority": "HIGH",
  "status": "IN_PROGRESS"
}
```

### Expense linked to a vendor

```json
{
  "weddingId": "<weddingObjectId>",
  "eventId": "<eventObjectId>",
  "description": "Photography service",
  "amountRupees": 75000,
  "currency": "INR",
  "category": "PHOTOGRAPHY",
  "paymentStatus": "PAID",
  "payerName": "Bride",
  "vendorId": "<vendorObjectId>"
}
```

### Photo upload session (no presigned URL stored)

```json
{
  "weddingId": "<weddingObjectId>",
  "guestAccessLinkId": "<guestAccessLinkObjectId>",
  "objectKey": "weddings/<weddingId>/photos/<randomId>.jpg",
  "expectedContentType": "image/jpeg",
  "expectedSizeBytes": 2841000,
  "uploadUrlExpiresAt": "2026-10-21T12:05:00.000Z",
  "status": "PENDING",
  "purgeAt": "2026-10-22T12:00:00.000Z"
}
```

## 10. Data lifecycle and deletion behavior

| Entity | V1 behavior |
|---|---|
| User | Disable account rather than immediately removing records referenced by memberships/sessions |
| Wedding | Archive for normal UI removal; account/data purge should be a deliberate administrative operation |
| Membership | Set `REMOVED`; invalidate active sessions/permissions as appropriate |
| Event | Archive; preserve tasks, expenses, RSVPs and vendor associations for reference, while excluding archived event from active planning views |
| Guest | Archive; retain RSVP/email history unless a valid deletion request requires a deeper purge |
| Vendor | Archive; existing task/expense history remains meaningful |
| Photo | Immediately remove from gallery, mark `DELETED`, and attempt object deletion from R2; handle object deletion failures safely |
| Invitation/password-reset token | Revoke/use/expire; TTL cleanup is asynchronous and not relied on for authorization |
| Upload session | Mark expired/rejected/completed; a TTL index on `purgeAt` cleans stale metadata after a retention window |
| Email campaign/recipient | Retain minimal sending status for troubleshooting; do not store raw access tokens or unnecessary sensitive provider payloads |

If V1 offers permanent account/wedding deletion, implement a separate controlled purge operation that deletes related data and R2 objects and is idempotent. Do not attempt a large purge synchronously in a web request.

## 11. Validation strategy

- **Zod:** validate request bodies, params, query strings, email import rows, provider inputs and public-token payloads.
- **Mongoose:** define schema types, required fields, enums, string constraints, timestamps and normal field validation.
- **Update operations:** explicitly enable update validators where Mongoose update APIs are used (`runValidators: true`) and test the exact update methods chosen.
- **MongoDB indexes:** enforce uniqueness and query performance constraints such as account email, active membership, RSVP uniqueness, event-guest assignment, website slug and R2 object key.
- **Service layer:** enforce permission, tenant isolation, referenced-record consistency, token use/expiry, event-date logic and membership-count rules.

Client-side validation improves usability but is never a replacement for server-side validation.

## 12. Query patterns the model must support

1. Get the current user's active wedding membership and role.
2. Load a wedding dashboard with upcoming events, counts of tasks by status, expense totals, invitation/RSVP counts and vendors.
3. List active events sorted by start time.
4. List/filter tasks by event, status, assignee, priority and due date.
5. List/filter expenses by event, category and payment status; aggregate paid/unpaid totals.
6. List guests for a specific event, with invitation status and RSVP response.
7. Load RSVP counts by event: attending, not attending, and pending.
8. List vendors by category/name and load vendor assignments, associated tasks and expenses.
9. Load published website configuration by unique slug and only show approved/public fields.
10. Validate invitation/guest link tokens by hash, expiry, revocation and purpose.
11. Load visible photos for the wedding or an event, excluding rejected/deleted/pending-review photos.
12. Show campaign and per-recipient submission progress.

For dashboard counts, use indexed count queries or aggregation pipelines. Do not persist copied dashboard totals as the source of truth; calculate from the underlying records and optimize only if real performance data later requires denormalization.

## 13. Implementation order

1. Define TypeScript shared types and Zod schemas.
2. Implement `users`, `sessions`, `weddings`, `weddingMemberships`, and `membershipInvitations`.
3. Add `events`, `tasks`, and `expenses`.
4. Add `guests`, `eventGuestAssignments`, `rsvps`, and `guestAccessLinks`.
5. Add `emailCampaigns` and `emailRecipients` for Resend batching.
6. Add `websiteConfigs` and `livestreamConfigs`.
7. Add `vendors` and `vendorEventAssignments`; wire optional vendor references into tasks and expenses.
8. Add `photoUploadSessions` and `photos` for direct R2 uploads.
9. Add indexes through versioned migrations and validate against representative test data.
10. Run cross-wedding isolation tests and uniqueness/duplicate-request tests before feature acceptance.

## 14. Decisions carried forward and implementation notes

These are not new feature additions; they are constraints inherited from the approved architecture:

- No email verification at signup. Login and password recovery still require appropriate controls.
- Organiser invitations use secure, expiring tokens; no wedding code/number is used.
- Only Admin can add/remove Organisers. Admin/Organiser manage normal wedding operations.
- Guest access stays separate from logged-in account membership.
- All wedding-owned documents carry `weddingId` and must be queried within that scope.
- Four theme definitions stay in application code; database stores the selected `themeCode` and version.
- R2 presigned URLs are generated on demand and never stored as database fields.
- R2 upload URL expiry is validated by R2, while the API independently validates the application's upload-session expiry on completion.
- Google Places search results are fetched on demand. Save Place ID and user-authored/confirmed fields; do not persist restricted Places content without checking current policy.
- There is no vendor login, vendor advance/balance model, expense budgeting, task reminder system, audit-history collection, dedicated queue or image-processing pipeline in V1.

## 15. Design assumptions to confirm before implementation

The collection design is implementable with the approved requirements, but the following product rules are explicit assumptions rather than independently confirmed final behavior:

1. **Admin count:** maximum two active Admin memberships per wedding (Bride and Groom). If other family members must be Admins, change this rule before implementation.
2. **Photo moderation:** newly uploaded guest photos default to `PENDING_REVIEW` and require Admin/Organiser approval before appearing in the shared gallery. This is a safety-first default; automatic visibility would be a product decision.
3. **Reusable QR links:** a printed photo-sharing QR should remain stable for its lifetime. Choose either encrypted token recovery server-side or issue a new QR link when the original token cannot be re-displayed. Keep token validation hash-based either way.
4. **Guest-link expiry:** RSVP links and photo-sharing QR links should have defined expiration defaults and revocation controls. The exact defaults (for example, relative to the event/wedding date) should be decided before implementation.
5. **Guest gallery visibility:** confirm whether all guests with the photo gallery link can view every approved wedding photo, or whether viewing should require a separate access link from upload permission.
6. **Theme names:** `TRADITIONAL`, `ROYAL`, `FLORAL`, and `MODERN` are stable placeholder keys. Final theme names and visual definitions can be adjusted without changing the collection model as long as the theme keys are migrated safely.

These items do not block the conceptual database design, but should be resolved before API implementation and integration tests.

## 16. Risks and safeguards

| Risk | Safeguard |
|---|---|
| Cross-wedding data leak | Resolve membership on each request; scope every read/write by `weddingId`; test negative access cases |
| Duplicate users/memberships | Unique normalized email and unique partial active-membership index |
| Two Admin invitations accepted simultaneously | Use transaction/atomic checks and enforce Admin cap in service code |
| Duplicate guest imports | Return row-level errors and offer user-assisted duplicate review; don't unique-index guest email |
| Duplicate RSVP | Unique `(eventId, guestId)` and upsert after token validation; RSVP applies to the full family invitation |
| Expired token remains in database | Always validate `expiresAt` in code; TTL is cleanup only |
| Duplicate email sends on retry | Recipient rows, campaign status transitions, deterministic recipient keys and compare-and-set claim |
| Presigned URL reuse | Unique random object keys, short expiry, session checks, verify R2 object before photo record |
| Public/private photo confusion | Keep private bucket/object access controlled and use signed GET URLs for private galleries |
| Google Places storage-policy violation | Fetch details on demand, preserve required attribution and store Place ID plus user-entered/confirmed fields only |
| Website slug collision | Normalize and enforce a unique index; handle duplicate-key error with a friendly response |

## 17. Review checklist

- [ ] At most one active wedding membership per user is enforced by a database index.
- [ ] The first Admin membership is created together with the wedding.
- [ ] Two-Admin limit and organiser permissions are enforced in service tests.
- [ ] All child records are scoped to their wedding.
- [ ] Event, task, expense, guest and vendor references cannot cross wedding boundaries.
- [ ] Duplicate event guest assignments and RSVPs are rejected or upserted safely.
- [ ] A unique compound index on `(weddingId, emailNormalized)` prevents duplicate family email records within one wedding; imports report duplicates by row.
- [ ] Every guest/family record has `primaryContactName`, one email address and `familyCount >= 1`.
- [ ] Expense amounts are stored as whole integer INR rupees; positive decimal inputs are rounded before persistence.
- [ ] Website slug and selected theme are validated.
- [ ] R2 object keys are server-generated, presigned URLs are not stored, and uploads are verified before gallery creation.
- [ ] Private gallery content is not exposed through a public CDN URL.
- [ ] Expiry is enforced in application code; TTL is only cleanup.
- [ ] Google Places data is not cached beyond permitted terms.
- [ ] Resend recipient statuses distinguish provider acceptance from confirmed delivery.

## 18. Official technical references

1. MongoDB — Embedded Data: https://www.mongodb.com/docs/v8.0/data-modeling/embedding/
2. MongoDB — Referencing Data: https://www.mongodb.com/docs/manual/data-modeling/referencing/
3. MongoDB — Schema Design Process / Map Relationships: https://www.mongodb.com/docs/manual/data-modeling/schema-design-process/map-relationships/
4. MongoDB — Unique Indexes: https://www.mongodb.com/docs/manual/core/index-unique/
5. MongoDB — Partial Indexes: https://www.mongodb.com/docs/manual/core/index-partial/
6. MongoDB — TTL Indexes: https://www.mongodb.com/docs/manual/core/index-ttl/
7. Mongoose — Validation and update validators: https://mongoosejs.com/docs/validation.html
8. Google Places — Places policies and attributions: https://developers.google.com/maps/documentation/places/web-service/policies
9. Cloudflare R2 — Presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/

---

**End of document.**
