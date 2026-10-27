import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const knownError = error instanceof AppError;
  const statusCode = knownError ? error.statusCode : 500;
  const code = knownError ? error.code : "INTERNAL_ERROR";

  if (!knownError) console.error("Unhandled API error", { name: error instanceof Error ? error.name : "UnknownError" });

  response.status(statusCode).json({
    error: {
      code,
      message: knownError ? error.message : "An unexpected error occurred."
    }
  });
};
