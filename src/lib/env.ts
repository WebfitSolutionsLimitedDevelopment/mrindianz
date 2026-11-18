import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Read lazily so the site builds without optional integrations.
 * NEVER import this module from client components.
 */
const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  RESEND_API_KEY: z.string().min(10).optional(),
  EMAIL_FROM: z.string().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_MODE: z.enum(["test", "live"]).optional(),
  PAYMENTS_ENABLED: bool,
  CONTESTANT_FEE_PAYMENTS_ENABLED: bool,
  REGISTRATION_ENABLED: bool,
  DEMO_VOTING_ENABLED: bool,
  ALLOW_UNAPPROVED_POLICIES: bool,
  RATE_LIMIT_SALT: z.string().optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  APP_ENV: z.enum(["production", "staging", "development", "test"]).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

export function serverEnv(): ServerEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}

export function appEnv(): "production" | "staging" | "development" | "test" {
  const e = serverEnv();
  if (e.APP_ENV) return e.APP_ENV;
  if (e.VERCEL_ENV === "production") return "production";
  if (e.VERCEL_ENV === "preview") return "staging";
  return process.env.NODE_ENV === "test" ? "test" : "development";
}

export const isProduction = () => appEnv() === "production";
