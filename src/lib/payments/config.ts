import "server-only";
import { appEnv, serverEnv } from "@/lib/env";

export type PaymentReadiness =
  | { ready: true; mode: "test" | "live" }
  | { ready: false; reason: string };

/**
 * Real payments run ONLY when explicitly enabled AND fully configured. Production additionally
 * requires live mode; non-production environments are forced to Stripe test mode.
 */
export function paymentReadiness(): PaymentReadiness {
  const env = serverEnv();
  if (!env.PAYMENTS_ENABLED) return { ready: false, reason: "Payments are disabled (PAYMENTS_ENABLED is not true)." };
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_MODE) {
    return { ready: false, reason: "Stripe credentials are incomplete." };
  }
  const keyMode = env.STRIPE_SECRET_KEY.startsWith("sk_live_") || env.STRIPE_SECRET_KEY.startsWith("rk_live_") ? "live" : "test";
  if (keyMode !== env.STRIPE_MODE) return { ready: false, reason: "STRIPE_MODE does not match the secret key." };
  if (appEnv() === "production" && env.STRIPE_MODE !== "live") return { ready: false, reason: "Production requires live Stripe mode." };
  if (appEnv() !== "production" && env.STRIPE_MODE === "live") return { ready: false, reason: "Live Stripe keys are only allowed in production." };
  return { ready: true, mode: env.STRIPE_MODE };
}
