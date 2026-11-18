import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicConfig } from "./config";

/** Request-scoped client acting as the signed-in user (RLS applies). */
export async function createUserClient(): Promise<SupabaseClient> {
  const cfg = supabasePublicConfig();
  if (!cfg) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes sessions instead.
        }
      },
    },
  });
}

/** Cookie-less anonymous client for public reads (RLS applies as `anon`). */
export function createPublicClient(): SupabaseClient | null {
  const cfg = supabasePublicConfig();
  if (!cfg) return null;
  return createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Service-role client. Bypasses RLS — use ONLY in server code after validating input and,
 * for admin operations, after checking roles. Never expose to the browser.
 */
export function createServiceClient(): SupabaseClient | null {
  const cfg = supabasePublicConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cfg || !key) return null;
  return createClient(cfg.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
