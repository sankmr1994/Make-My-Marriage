import { z } from "zod";

export const apiSuccessSchema = <T extends z.ZodType>(data: T) =>
  z.object({ data });

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string()
  })
});

export const healthDataSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("make-my-marriage-api")
});

export const healthResponseSchema = apiSuccessSchema(healthDataSchema);

export type ApiSuccess<T> = { data: T };
export type ApiError = z.infer<typeof apiErrorSchema>;
export type HealthData = z.infer<typeof healthDataSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
