import cors from "cors";
import express, { type Express } from "express";
import { createRequire } from "node:module";
import { env } from "./config/env.js";
import { requireDatabase } from "./middleware/database.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { weddingsRouter } from "./routes/weddings.js";
import { membershipInvitationsRouter } from "./routes/membership-invitations.js";
import { tasksRouter } from "./routes/tasks.js";
import { expensesRouter } from "./routes/expenses.js";
import { guestsRouter } from "./routes/guests.js";
import { vendorsRouter } from "./routes/vendors.js";
import { websiteRouter } from "./routes/website.js";
import { photosRouter } from "./routes/photos.js";
import { enforceOrganiserPermissions } from "./middleware/organiser-permissions.js";

const require = createRequire(import.meta.url);
const helmet = require("helmet") as typeof import("helmet").default;

export const app: Express = express();

app.disable("x-powered-by");
// This API is intentionally consumed by the separate web origin configured in
// WEB_ORIGIN. CORS restricts which origin may read responses; CORP must not
// contradict that policy by treating the API as same-origin only.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/v1", healthRouter);
app.use("/api/v1", requireDatabase);
app.use("/api/v1", authRouter);
app.use("/api/v1", enforceOrganiserPermissions);
app.use("/api/v1", weddingsRouter);
app.use("/api/v1", membershipInvitationsRouter);
app.use("/api/v1", tasksRouter);
app.use("/api/v1", expensesRouter);
app.use("/api/v1", guestsRouter);
app.use("/api/v1", vendorsRouter);
app.use("/api/v1", websiteRouter);
app.use("/api/v1", photosRouter);
app.use(errorHandler);

export default app;
