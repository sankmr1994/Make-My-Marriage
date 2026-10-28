# Make My Marriage

Make My Marriage is an India-focused collaborative workspace for planning and running a wedding. This repository is the V1 foundation: a Next.js frontend, an Express API, and shared TypeScript contracts.

## Repository structure

```text
apps/web                 Next.js App Router frontend
apps/api                 Express API and Vercel function entry point
packages/contracts       Shared Zod schemas and inferred TypeScript types
docs/prd                 Approved product requirements
docs/architecture        Approved system architecture
docs/database            Approved database design
docs/api                 Approved API design
```

## Prerequisites

- Node.js 22 or later
- Corepack (included with supported Node.js releases)
- pnpm 10 (Corepack supplies the pinned workspace version)

## Install and configure

```bash
corepack pnpm install
```

Create local environment files from the examples:

```bash
copy apps\web\.env.example apps\web\.env.local
copy apps\api\.env.example apps\api\.env
```

The scaffold only requires `NEXT_PUBLIC_API_BASE_URL`, `PORT`, and `WEB_ORIGIN` for local operation. MongoDB and provider variables are documented now for later modules; the health endpoint does not use MongoDB.

## Run locally

```bash
corepack pnpm dev
```

The frontend runs at `http://localhost:3000` and the API at `http://localhost:4000`. The web app calls `NEXT_PUBLIC_API_BASE_URL`, which defaults locally to `http://localhost:4000/api/v1`. Confirm API liveness at `http://localhost:4000/api/v1/health`.

To run one service:

```bash
corepack pnpm dev:web
corepack pnpm dev:api
```

## Commands

| Command | Purpose |
| --- | --- |
| `corepack pnpm dev` | Run the web app and API together |
| `corepack pnpm dev:web` | Run the Next.js web app |
| `corepack pnpm dev:api` | Run the Express API |
| `corepack pnpm build` | Build contracts, web app, and API |
| `corepack pnpm lint` | Run lint checks across all workspaces |
| `corepack pnpm typecheck` | Run strict TypeScript checks |
| `corepack pnpm test` | Run API tests |

## Deployment readiness

Deploy `apps/web` and `apps/api` as separate Vercel projects. The API exports its Express app as the default export from `apps/api/src/app.ts` for Vercel, while `src/server.ts` starts the local development server and database indexes. In the web project, set `API_ORIGIN` to the API deployment origin (for example, `https://make-my-marriage-api-one.vercel.app`) and `NEXT_PUBLIC_API_BASE_URL` to `/api/v1`; Next.js proxies browser requests through the web origin so the HttpOnly session cookie remains first-party. Set the API project's `WEB_ORIGIN` to the web deployment origin. Keep database and provider secrets only in the API project's environment.

## Planned stages

1. Authentication, sessions, authorization, and wedding scoping.
2. Wedding, event, task, and expense management.
3. Guests, invitations, RSVP, and email campaigns.
4. Wedding website, livestream, and moderated photo sharing.
5. Vendors, Google Places discovery, and security hardening.

Read the approved documents in `docs/` before implementing any product module.
