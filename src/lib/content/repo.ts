import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import {
  DEFAULT_SETTINGS, FAQ_DEFAULTS, SECTION_DEFAULTS,
  type ApprovalStatus, type SectionContent, type SiteSettings,
} from "./defaults";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) return (override === undefined ? base : (override as T));
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in out && isPlainObject(out[k]) && isPlainObject(v) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

function warn(scope: string, err: unknown) {
  // Never log payloads (may contain personal data); log scope + message only.
  console.warn(`[content] ${scope}: ${err instanceof Error ? err.message : String(err)}`);
}

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const db = createPublicClient();
  if (!db) return DEFAULT_SETTINGS;
  const { data, error } = await db.from("site_settings").select("key, published");
  if (error) {
    warn("settings", error);
    return DEFAULT_SETTINGS;
  }
  const overrides: Record<string, unknown> = {};
  for (const row of data ?? []) overrides[row.key] = row.published;
  return deepMerge(DEFAULT_SETTINGS, overrides);
});

export interface Section {
  key: string;
  approvalStatus: ApprovalStatus;
  content: SectionContent;
}

export const getSections = cache(async (page: string): Promise<Record<string, Section>> => {
  const fallback = Object.fromEntries(
    SECTION_DEFAULTS.filter((s) => s.page === page).map((s) => [s.key, { key: s.key, approvalStatus: s.approvalStatus, content: s.content }]),
  );
  const db = createPublicClient();
  if (!db) return fallback;
  const { data, error } = await db
    .from("content_sections")
    .select("key, published, approval_status, sort_order")
    .eq("page_slug", page)
    .order("sort_order");
  if (error) {
    warn(`sections:${page}`, error);
    return fallback;
  }
  const out: Record<string, Section> = { ...fallback };
  for (const row of data ?? []) {
    out[row.key] = { key: row.key, approvalStatus: row.approval_status, content: row.published as SectionContent };
  }
  return out;
});

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  approvalStatus: ApprovalStatus;
}

export const getFaqs = cache(async (): Promise<Faq[]> => {
  const fallback = FAQ_DEFAULTS.map((f, i) => ({ id: `default-${i}`, ...f }));
  const db = createPublicClient();
  if (!db) return fallback;
  const { data, error } = await db
    .from("faqs")
    .select("id, question, answer, category, approval_status, sort_order")
    .eq("is_published", true)
    .order("sort_order");
  if (error) {
    warn("faqs", error);
    return fallback;
  }
  return (data ?? []).map((f) => ({ id: f.id, question: f.question, answer: f.answer, category: f.category, approvalStatus: f.approval_status }));
});

export interface Partner {
  id: string;
  name: string;
  category: "presenting" | "major" | "supporting" | "media" | "community";
  description: string | null;
  logoUrl: string | null;
  url: string | null;
}

export const getPartners = cache(async (): Promise<Partner[]> => {
  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("partners")
    .select("id, name, category, description, logo_path, url, sort_order")
    .eq("is_published", true)
    .order("sort_order");
  if (error) {
    warn("partners", error);
    return [];
  }
  return (data ?? []).map((p) => ({
    id: p.id, name: p.name, category: p.category, description: p.description,
    logoUrl: publicMediaUrl(p.logo_path), url: p.url,
  }));
});

export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https:\/\//.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/public-media/${path.split("/").map(encodeURIComponent).join("/")}`;
}
