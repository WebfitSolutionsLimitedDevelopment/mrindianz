import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

/** Hashed client identifier for rate limiting — raw IPs are never stored. */
export async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const salt = process.env.RATE_LIMIT_SALT || "mrindianz";
  return `${scope}:${createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32)}`;
}

/**
 * Database-backed fixed-window rate limit (works across serverless instances).
 * Fails open only when the database is not configured at all (local preview).
 */
export async function rateLimit(scope: string, max: number, windowSeconds: number): Promise<boolean> {
  const db = createServiceClient();
  if (!db) return true;
  const key = await clientKey(scope);
  const { data, error } = await db.rpc("hit_rate_limit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
  if (error) {
    console.warn(`[rate-limit] ${scope}: ${error.message}`);
    return false; // fail closed when the limiter errors
  }
  return data === true;
}

/** Same-origin check for state-changing route handlers (CSRF defence in depth). */
export async function isSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
