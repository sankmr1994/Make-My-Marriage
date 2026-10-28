import cors from "cors";
import express, { type Express } from "express";
import * as helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { weddingsRouter } from "./routes/weddings.js";
import { membershipInvitationsRouter } from "./routes/membership-invitations.js";

export const app: Express = express();

app.disable("x-powered-by");
app.use(helmet.default());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/v1", healthRouter);
app.use("/api/v1", authRouter);
app.use("/api/v1", weddingsRouter);
app.use("/api/v1", membershipInvitationsRouter);
app.use(errorHandler);
