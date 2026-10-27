import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export const enforceRequestOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get("origin");
  if (origin && origin !== env.WEB_ORIGIN) {
    next(new AppError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed."));
    return;
  }
  next();
};
