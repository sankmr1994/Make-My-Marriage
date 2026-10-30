# Project Status

**Last updated:** 2026-10-29
**Product scope source:** The approved V1 documents in `docs/prd/`, `docs/architecture/`, `docs/database/`, and `docs/api/`.

This file tracks delivery progress. It is not a replacement for the approved product requirements.

## Completed

### Repository scaffold

- Set up the monorepo foundation with a Next.js App Router web app, Express API, and shared TypeScript contracts package.
- Added the API health endpoint and local development scripts documented in the repository README.
- Configured strict TypeScript checks and workspace lint/typecheck commands.
- The local scaffold was started and confirmed working during the initial project setup.

### Public homepage

- Built the public marketing homepage using the approved Stitch design as the visual reference.
- Added responsive sections for the hero, feature overview, sample planning workspace, ceremony schedule, collaboration and guest list, wedding themes, guest experience, FAQs, and footer.
- Added local wedding imagery and sample content for presentation.
- Organized the page as a route composer with section components and shared landing-page data under `apps/web/src/components/landing/`.
- Added presentation-only selection states for the sample ceremony and theme cards. These selections are not saved and do not configure a real wedding website.
- Verification after the homepage component refactor: web ESLint and TypeScript checks passed.

### Wedding onboarding

- Added a responsive onboarding flow based on the Stitch welcome, couple details, wedding details, events, review, and completion designs.
- The flow requires bride and groom names, wedding date, city, state, and address. Ceremony/event entry is optional; each event captures its name, local date/time, and venue.
- Added browser-session draft saving, inline validation, editable review, and retryable creation states.
- Added the documented `POST /weddings` API with Zod validation, Mongoose models, one-active-wedding enforcement, and first Admin membership creation. Mongo transactions are used when supported, with compensating cleanup for standalone MongoDB deployments.
- Added the documented `POST /events` API for optional onboarding events and a `GET /weddings/current` endpoint for recovering a successful create when the client loses the response.
- The onboarding route requires a valid account session and redirects existing wedding members. Account welcome now links users without a wedding into onboarding.
- The first dashboard milestone is implemented below; tasks, expenses, guests, vendors, publishing, and other workspace modules remain future work.
- Manual browser verification on localhost:3000: tested signed-out redirect, existing-wedding redirect, defer and save/exit, required-field validation, back/forward editing, draft restoration after reload, suggested/custom event add/edit/remove, incomplete-event validation, three-event workspace creation, and zero-event workspace creation. `GET /weddings/current` confirmed the no-event wedding and `ADMIN` membership. The browser walkthrough exposed a privacy issue: onboarding draft data in tab-scoped `sessionStorage` is reused after switching to another account in the same tab, so the second account saw the first account’s couple names. Reload and resume also returns to the welcome step rather than the last active step. Failure injection for wedding/event request retry and mobile viewport/keyboard testing were not performed.

### Initial wedding dashboard

- Replaced the post-onboarding welcome view for wedding members with a responsive dashboard based on the Stitch V1 dashboard screen.
- Added separate Dashboard, My Wedding, and Events views in the sidebar, matching Stitch’s section-based navigation. Dashboard shows an overview; wedding details and the full event schedule live in their respective views.
- Displays the saved couple names, wedding date/countdown, location, and onboarding events; an empty state is shown when no events were added.
- Added working edit dialogs for wedding details and each event, persisted through authenticated, wedding-scoped `PATCH /weddings/current` and `PATCH /events/:eventId` APIs. Added authenticated `GET /events` for the timeline.
- Initially kept task, expense, guest, vendor, website, livestream, and photo modules out of the interactive dashboard; Task Management has since been implemented below, while the other modules remain deferred.
- Verification: API and web ESLint and TypeScript checks passed. Manual browser interaction has not yet been verified.

### Dashboard visual alignment

- Refined the implemented dashboard against the approved Stitch V1 dashboard reference without presenting unbuilt modules as working features.
- Added the Stitch-inspired workspace header, a desktop sidebar **Create event** action, a structured wedding overview, real-data dashboard metrics, and an upcoming-ceremonies module.
- Dashboard values are derived only from implemented, authenticated workspace data. The task summary now uses persisted task data; guest/RSVP, expense, vendor, website, livestream, and photo dashboard modules remain deferred until their associated V1 capabilities exist.
- Verification: web ESLint and TypeScript checks passed. The local `next build` attempt was blocked by a Next.js/Turbopack CSS-worker startup failure in this environment; it did not report a TypeScript or stylesheet syntax error. Manual browser verification remains pending.

### Event management

- Implemented the Stitch Events overview and mobile layout with All, Upcoming, Past, and Archived filters, event search, chronological event cards, and an empty state with ceremony quick-add chips.
- Added create and edit forms for event name, date, local start time, venue name/address, city, and optional notes. Times use the wedding timezone (onboarding currently configures IST).
- Added a confirmation flow and soft archive action. Archived events remain stored with their details and notes, can be viewed through the Archived filter, and can be restored to active planning.
- Added authenticated, wedding-scoped status filtering for `GET /events`, archive via `DELETE /events/:eventId`, and restore via `POST /events/:eventId/unarchive`.
- Aligned event action controls within the event card on desktop and mobile layouts.
- Refined event-card surfaces and hover/focus states to better match Stitch, and added a venue overview and itinerary summary derived from saved active events.
- Added a working event sort menu with Earliest first and Latest first options; the selected order updates the event list, and the menu closes on outside click or Escape.
- Added optional Indian wedding event name suggestions (Engagement, Roka, Haldi, Mehendi, Sangeet, Muhurtham, Wedding Ceremony, and Reception) to the create- and edit-event forms; selecting one fills the editable name field, and custom event names remain supported.
- Improved create/edit dialog context and notes character count; archive confirmation now gives an event summary and explains that restore is available from the Archived filter. Ceremony labels remain based on event name/status because the V1 event model has no category or primary-ceremony field.
- Verification: web ESLint and TypeScript checks passed after the design refinements. Manual browser interaction has not yet been verified.

### Task management

- Implemented the full responsive Task Management workspace from the approved Stitch desktop and mobile references: status summary cards, search and local filters, grouped overdue/upcoming/completed task lists, quick-start templates, edit controls, status updates, and a deliberate permanent-delete confirmation.
- Added create/edit task forms with required task name, optional plain-text description and coordination notes, active-member assignment, optional IST due date, priority, optional active-event link, and the three V1 statuses: Not Started, In Progress, and Completed.
- Added authenticated, wedding-scoped `GET`, `POST`, `PATCH`, and `DELETE /tasks` APIs; Zod validates payloads and query filters, Mongoose validates persisted documents, and the server verifies that an assignee and linked event belong to the current wedding. Task records use the documented dashboard/status, assignee/status, and event/status indexes.
- The Stitch form's Vendor area is represented as an honest disabled notice because vendor records are not implemented yet. The design's SMS/WhatsApp notification suggestion was intentionally omitted: task reminders and automated notification claims are out of V1 scope.
- The dashboard now uses real task counts and overdue status, and its Tasks navigation opens the working task board. No illustrative task totals are treated as backend data.
- Verification: API and web ESLint and TypeScript checks passed. All API tests passed (4 files, 4 tests); Mongo-backed task coverage includes task creation, priority filtering, status/assignee update, and permanent deletion. Manual browser and mobile viewport verification remain pending.

### Expense management

- Implemented the V1 Expense Ledger from the approved Stitch desktop and mobile references: responsive summary cards, search and filters, empty state quick-starts, ledger rows, create/edit form, and permanent-delete confirmation.
- The main Dashboard now reads the same authenticated Expense API and shows live recorded, paid, and unpaid totals with a direct link to the Expense Ledger.
- Added authenticated, wedding-scoped `GET`, `POST`, `PATCH`, and `DELETE /expenses` APIs. Zod validates requests, Mongoose validates persisted records, and linked events are verified as active records in the current wedding.
- Expense records use the approved V1 fields: description, rounded whole-INR `amountRupees`, category, optional linked event, `PAID` or `UNPAID` payment status, payment date, payer name, and notes. API amounts are rounded to the nearest rupee before persistence and values below ₹1 are rejected.
- Deliberately omitted the Stitch concept's partial payments, outstanding balances, payment due dates, advances/installments, CSV export, and all budget behaviour because they are outside the approved V1 scope. Ledger totals are calculated from the actual expense records.
- Verification: API and web TypeScript and ESLint checks passed. Full API suite passed (5 files, 5 tests), including Mongo-backed expense coverage for creation, filtering, whole-rupee rounding, updating, totals, and permanent deletion. Manual browser and mobile viewport verification remain pending.

### Guest records and RSVP invitations (core flow)

- Added the Stitch-inspired Guests & Invitations workspace with household-based guest records, family-size summary cards, ceremony assignment selection, search/filtering, edit, and archive protection. The dashboard now displays live guest-family, invited-person, confirmed-family/person, declined-family, and pending-RSVP figures from the authenticated Guest API. Confirmed people are an approximate household total derived from `familyCount`, because V1 RSVP responses apply to the whole family. Guest feedback uses distinct success, warning, and error states, and the compact household editor has aligned fields and ceremony choices.
- Added authenticated, wedding-scoped APIs for guest-family create/read/update/archive/restore, per-event guest assignment, and event RSVP summaries. Records use the approved V1 `primaryContactName`, one email per wedding, and `familyCount` fields; archived families stay in the database but are excluded from active planning. The Guests view now has an Archived families filter with a Restore action. Archived emails remain reserved to preserve invitation and RSVP history; restore and edit the original record before reusing an email for a different household.
- Added an Admin/Organiser invitation campaign action and accountless public RSVP links. Links contain opaque random tokens, with only a token hash persisted. A public response can only update the family and ceremony encoded by that token; it cannot select another guest or event. A resend revokes the earlier active link, and invitation/reminder/RSVP routes are rate limited.
- The invitation email states only that a provider submission was accepted or failed; it does not claim inbox delivery. The visual design’s meal preferences, blessing/notes field, provider audit claims, and automated reminder claims were excluded because they are outside approved V1 scope.
- Verification: API and web TypeScript and ESLint checks passed. The Mongo-backed guest/RSVP integration test passed, covering household creation, duplicate-email protection, event assignment, token-scoped public RSVP, archive/restore behavior, and safe email reuse after restoring and editing the original record. Manual browser and mobile viewport verification are still pending.
- Added CSV/XLS/XLSX guest import with a 4 MB / 1,000-row limit, required household-column validation, optional comma-separated active ceremony assignment, and row-numbered duplicate/validation feedback. Import is all-or-nothing for rows that fail pre-write validation.
- Remaining V1 guest work: the full campaign history/dispatch review surface is not yet implemented.

### Member and invitation management

- Added the Team workspace with active-member and pending-invitation lists, Admin slot usage, role guidance, and member actions.
- Added authenticated APIs for listing members/invitations, creating and resending invitations, revoking invitations, accepting an invitation, and removing workspace membership. Invitations use seven-day random tokens; MongoDB stores only token hashes, and acceptance requires a signed-in account whose normalized email matches the invitation.
- Enforced the V1 Admin/Organiser permissions and two-Admin limit. Admins may remove active members except the workspace creator; Organisers cannot manage team membership. Removal marks membership `REMOVED` while retaining the user account and wedding records.
- Invitation email delivery uses Resend. Provider submission acceptance is not proof of inbox delivery; arbitrary recipients require a verified sender domain.
- Invitation links now make sign-in the primary path for existing accounts. The invited email is prefilled; choosing sign-up with an existing email redirects to sign-in while preserving the invitation return URL. After sign-in, the recipient returns to the invitation review and accepts it while authenticated.
- The sidebar team count loads with workspace data and shows a loading indicator until the member request completes.
- Verification: API and web ESLint and TypeScript checks passed. All API tests passed (now 4 files, 4 tests), including Mongo-backed authentication and membership invitation integration coverage. Manual browser acceptance of invitation links has not yet been verified end to end.

## In progress

### Authentication and account API

- Added `/sign-in` and `/sign-up` pages with responsive forms based on the API design's email/password contracts and the Stitch desktop/mobile login design. The sign-up view follows the login design language because the Stitch project has no separate sign-up screen.
- Added a direct **Sign in** link beside **Start planning** in the public homepage header; **Start planning** opens sign-up.
- Forms submit to the documented `/auth/login` and `/auth/signup` API endpoints and expect an HttpOnly session cookie. Password recovery uses the documented `/auth/password-reset/request` route.
- Successful sign-in and sign-up now open a welcome page that reads the current account from `/auth/me`; guests are redirected to sign-in. The welcome page's sign-out action revokes the current server session, clears the HttpOnly browser cookie, and verifies that `/auth/me` returns `401` before returning home.
- Visiting sign-in or sign-up with a valid existing session redirects to the welcome page before rendering the auth form, unless a safe invitation return path is present, in which case the user returns to that invitation.
- Reworked the form-and-workspace split layout to match Stitch, including the editorial headline, warm dotted canvas, sample dashboard preview, input focus treatment, and responsive layout. The preview is explicitly illustrative and avoids out-of-scope budget/escrow or live-sync claims.
- Added Express routes for signup, login, logout, current account, and password reset request/confirmation. User, session, password-reset token, and membership Mongoose models use the collections and constraints from the database design. Sessions and reset tokens are random opaque values whose hashes are stored in MongoDB; passwords are hashed with scrypt.
- API startup now requires MongoDB, initializes the core indexes, and fails clearly when configuration or connectivity is missing. Auth endpoints use Zod validation, generic login/reset responses, origin checks, secure HttpOnly cookies, and MongoDB-backed attempt limits.
- Password reset delivery requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; reset completion UI and email delivery still require further implementation and verification. Wedding creation, invitation acceptance, authorization middleware, and protected workspace routes are implemented.
- Signup and password reset require a password of at least 12 characters. Verification: web ESLint and TypeScript checks passed; the API health and authentication integration tests passed against the configured MongoDB database, including signup, login, password reset, session invalidation, and logout.
- Known source-document mismatch: the API and database designs specify Express/MongoDB, while the system architecture document still specifies Spring Boot/PostgreSQL. This implementation follows the user instruction and the API/database designs; reconciling that architecture document remains open.
- Manual browser verification on localhost:3000: created a fresh dummy account with a valid password, confirmed signup signs in, session survives reload, login accepts case-insensitive email and rejects password case changes, and logout disables repeated clicks, returns home, and invalidates direct `/welcome` access. Checked required signup/login fields, malformed email, password mismatch, duplicate signup emails, unknown account, wrong password, and show/hide password. Invalid credentials use a generic message; server-side signup password errors explain the 12-character minimum. Authentication remains in progress because the user-facing password recovery completion page and broader protected workspace routes are outstanding.

## Current state

The repository scaffold, public homepage, signup/login/session flow, first wedding onboarding flow, dashboard, event management, task management, expense management, member/invitation management, and the core guest/RSVP flow with guest import are implemented. Password-reset completion UI, guest campaign history, and the remaining protected workspace modules are still outstanding.

## Planned V1 milestones

Follow the sequencing in the approved documents and README. Authentication, sessions, route protection, wedding onboarding, event management, task management, and member invitations are implemented. Remaining work includes:

1. Complete and verify password recovery, including the reset page and email delivery.
2. Complete guest campaign history/dispatch review.
3. Wedding website publishing, livestream, and moderated photo sharing.
4. Vendor management and nearby vendor discovery, followed by security hardening.

These are planned, not completed, until implemented and verified.

## Progress update rules

- Update this file when a feature or milestone is completed, or when the agreed sequence materially changes.
- Describe the delivered scope concretely and note important limitations, especially when a page contains illustrative UI or sample data.
- Record relevant verification (for example, lint, typecheck, tests, or a manual flow check) without claiming checks that were not run.
- Keep unfinished, planned, and completed work clearly separated.
