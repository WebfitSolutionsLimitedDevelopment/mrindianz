"use client";
import { createBrowserClient } from "@supabase/ssr";
import { DB_SCHEMA } from "./config";

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key, { db: { schema: DB_SCHEMA } });
}
