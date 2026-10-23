import { healthResponseSchema } from "@make-my-marriage/contracts";
import { Router, type Router as ExpressRouter } from "express";

export const healthRouter: ExpressRouter = Router();

healthRouter.get("/health", (_request, response) => {
  const payload = healthResponseSchema.parse({
    data: { status: "ok", service: "make-my-marriage-api" }
  });

  response.status(200).json(payload);
});
