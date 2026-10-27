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

## Current state

The repository scaffold and public homepage are complete. The homepage is a UI feature: it does not provide sign-in, persistent wedding data, or live backend integrations for its sample content.

## Planned V1 milestones

Follow the sequencing in the approved documents and README. The current next milestone is:

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
