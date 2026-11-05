import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional()
);
const optionalEmailSender = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().refine((value) => {
    const match = value.match(/^(?:[^<>]+<)?([^<>\s]+@[^<>\s]+)(?:>)?$/);
    return Boolean(match && z.email().safeParse(match[1]).success);
  }, "Use an email address or a display name followed by an email address in angle brackets.").optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  MONGODB_URI: optionalNonEmptyString,
  MONGODB_DNS_SERVERS: optionalNonEmptyString,
  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: optionalEmailSender,
  R2_ACCOUNT_ID: optionalNonEmptyString,
  R2_ENDPOINT: optionalUrl,
  R2_ACCESS_KEY_ID: optionalNonEmptyString,
  R2_SECRET_ACCESS_KEY: optionalNonEmptyString,
  R2_BUCKET_NAME: optionalNonEmptyString,
  GEOAPIFY_API_KEY: optionalNonEmptyString
}).superRefine((value, context) => {
  if (Boolean(value.RESEND_API_KEY) !== Boolean(value.RESEND_FROM_EMAIL)) {
    context.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Configure both Resend email settings or leave both empty." });
  }
  const r2Fields = [value.R2_ACCOUNT_ID, value.R2_ENDPOINT, value.R2_ACCESS_KEY_ID, value.R2_SECRET_ACCESS_KEY, value.R2_BUCKET_NAME];
  const configuredR2Fields = r2Fields.filter(Boolean).length;
  if (configuredR2Fields !== 0 && configuredR2Fields !== r2Fields.length) {
    context.addIssue({ code: "custom", path: ["R2_ACCOUNT_ID"], message: "Configure all five R2 settings together or leave them all empty." });
  }
  if (configuredR2Fields === r2Fields.length && value.R2_ENDPOINT && value.R2_ACCOUNT_ID) {
    const endpoint = new URL(value.R2_ENDPOINT);
    if (!endpoint.hostname.toLowerCase().startsWith(`${value.R2_ACCOUNT_ID.toLowerCase()}.`)) {
      context.addIssue({ code: "custom", path: ["R2_ENDPOINT"], message: "Use the S3 endpoint for the configured R2 account." });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
