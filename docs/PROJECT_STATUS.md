# Project Status

**Last updated:** 2026-10-28
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
- Kept task, expense, guest, vendor, website, livestream, and photo modules out of the interactive dashboard until those features are implemented.
- Verification: API and web ESLint and TypeScript checks passed. Manual browser interaction has not yet been verified.

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

### Member and invitation management

- Added the Team workspace with active-member and pending-invitation lists, Admin slot usage, role guidance, and member actions.
- Added authenticated APIs for listing members/invitations, creating and resending invitations, revoking invitations, accepting an invitation, and removing workspace membership. Invitations use seven-day random tokens; MongoDB stores only token hashes, and acceptance requires a signed-in account whose normalized email matches the invitation.
- Enforced the V1 Admin/Organiser permissions and two-Admin limit. Admins may remove active members except the workspace creator; Organisers cannot manage team membership. Removal marks membership `REMOVED` while retaining the user account and wedding records.
- Invitation email delivery uses Resend. Provider submission acceptance is not proof of inbox delivery; arbitrary recipients require a verified sender domain.
- Invitation links now make sign-in the primary path for existing accounts. The invited email is prefilled; choosing sign-up with an existing email redirects to sign-in while preserving the invitation return URL. After sign-in, the recipient returns to the invitation review and accepts it while authenticated.
- The sidebar team count loads with workspace data and shows a loading indicator until the member request completes.
- Verification: API and web ESLint and TypeScript checks passed. All API tests passed (3 files, 3 tests), including Mongo-backed authentication and membership invitation integration coverage. Manual browser acceptance of invitation links has not yet been verified end to end.

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

The repository scaffold, public homepage, signup/login/session flow, first wedding onboarding flow, initial wedding dashboard, event management, and member/invitation management are implemented. Password-reset completion UI and the remaining protected workspace modules are still outstanding.

## Planned V1 milestones

Follow the sequencing in the approved documents and README. Authentication, sessions, route protection, wedding onboarding, event management, and member invitations are implemented. Remaining work includes:

1. Complete and verify password recovery, including the reset page and email delivery.
2. Task and expense management.
3. Guest records, guest invitations, RSVP, and email campaigns.
4. Wedding website publishing, livestream, and moderated photo sharing.
5. Vendor management and nearby vendor discovery, followed by security hardening.

These are planned, not completed, until implemented and verified.

## Progress update rules

- Update this file when a feature or milestone is completed, or when the agreed sequence materially changes.
- Describe the delivered scope concretely and note important limitations, especially when a page contains illustrative UI or sample data.
- Record relevant verification (for example, lint, typecheck, tests, or a manual flow check) without claiming checks that were not run.
- Keep unfinished, planned, and completed work clearly separated.
