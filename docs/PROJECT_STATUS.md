# Project Status

**Last updated:** 2026-10-27  
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

## In progress

### Authentication and account API

- Added `/sign-in` and `/sign-up` pages with responsive forms based on the API design's email/password contracts and the Stitch desktop/mobile login design. The sign-up view follows the login design language because the Stitch project has no separate sign-up screen.
- Added a direct **Sign in** link beside **Start planning** in the public homepage header; **Start planning** opens sign-up.
- Forms submit to the documented `/auth/login` and `/auth/signup` API endpoints and expect an HttpOnly session cookie. Password recovery uses the documented `/auth/password-reset/request` route.
- Successful sign-in and sign-up now open a welcome page that reads the current account from `/auth/me`; guests are redirected to sign-in. The welcome page's sign-out action revokes the current server session, clears the HttpOnly browser cookie, and verifies that `/auth/me` returns `401` before returning home.
- Visiting sign-in or sign-up with a valid existing session redirects to the welcome page before rendering the auth form.
- Reworked the form-and-workspace split layout to match Stitch, including the editorial headline, warm dotted canvas, sample dashboard preview, input focus treatment, and responsive layout. The preview is explicitly illustrative and avoids out-of-scope budget/escrow or live-sync claims.
- Added Express routes for signup, login, logout, current account, and password reset request/confirmation. User, session, password-reset token, and membership Mongoose models use the collections and constraints from the database design. Sessions and reset tokens are random opaque values whose hashes are stored in MongoDB; passwords are hashed with scrypt.
- API startup now requires MongoDB, initializes the core indexes, and fails clearly when configuration or connectivity is missing. Auth endpoints use Zod validation, generic login/reset responses, origin checks, secure HttpOnly cookies, and MongoDB-backed attempt limits.
- Password reset delivery requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; keep delivery unconfigured until the missing `/reset-password` page is implemented. Wedding creation, invitation acceptance, authorization middleware, and protected workspace routes remain future backend work.
- Signup and password reset require a password of at least 12 characters. Verification: web ESLint and TypeScript checks passed; the API health and authentication integration tests passed against the configured MongoDB database, including signup, login, password reset, session invalidation, and logout.
- Known source-document mismatch: the API and database designs specify Express/MongoDB, while the system architecture document still specifies Spring Boot/PostgreSQL. This implementation follows the user instruction and the API/database designs; reconciling that architecture document remains open.
- Manual browser verification on localhost:3000: created a fresh dummy account with a valid password, confirmed signup signs in, session survives reload, login accepts case-insensitive email and rejects password case changes, and logout disables repeated clicks, returns home, and invalidates direct `/welcome` access. Checked required signup/login fields, malformed email, password mismatch, duplicate signup emails, unknown account, wrong password, and show/hide password. Invalid credentials use a generic message; server-side signup password errors explain the 12-character minimum. Auth remains in progress because password recovery UI completion and wedding onboarding/protected workspace routes remain outstanding.

## Current state

The repository scaffold and public homepage are complete. Authentication is in progress: signup, login, current-account lookup, and current-session logout are implemented with a welcome page. Password-reset email delivery and its user-facing completion page, wedding onboarding, and protected workspace routes remain outstanding.

## Planned V1 milestones

Follow the sequencing in the approved documents and README. After the authentication UI, continue the current account milestone with API-backed authentication, sessions, and route protection, then proceed to:

1. Authentication, sessions, authorization, and wedding scoping.
2. Wedding, event, task, and expense management.
3. Guests, invitations, RSVP, and email campaigns.
4. Wedding website publishing, livestream, and moderated photo sharing.
5. Vendor management and nearby vendor discovery, followed by security hardening.

These are planned, not completed, until implemented and verified.

## Progress update rules

- Update this file when a feature or milestone is completed, or when the agreed sequence materially changes.
- Describe the delivered scope concretely and note important limitations, especially when a page contains illustrative UI or sample data.
- Record relevant verification (for example, lint, typecheck, tests, or a manual flow check) without claiming checks that were not run.
- Keep unfinished, planned, and completed work clearly separated.
