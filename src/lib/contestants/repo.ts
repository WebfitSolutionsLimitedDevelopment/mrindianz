import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/content/repo";
import { appEnv } from "@/lib/env";

/** Demo placeholder profiles (slug "demo-…") are never shown on production, even in a shared database. */
export const hideDemo = () => appEnv() === "production";

export interface PublicContestant {
  id: string;
  slug: string;
  number: number | null;
  name: string;
  shortBio: string | null;
  biography: string | null;
  cityRegion: string | null;
  interests: string[];
  talentInfo: string | null;
  socialLinks: Record<string, string>;
  imageUrl: string | null;
  votingEligible: boolean;
}

const PUBLIC_COLUMNS =
  "id, slug, contestant_number, public_name, short_bio, biography, city_region, interests, talent_info, social_links, profile_image_path, voting_eligible, sort_order";

type Row = {
  id: string; slug: string; contestant_number: number | null; public_name: string; short_bio: string | null;
  biography: string | null; city_region: string | null; interests: string[] | null; talent_info: string | null;
  social_links: Record<string, string> | null; profile_image_path: string | null; voting_eligible: boolean;
};

function map(r: Row): PublicContestant {
  return {
    id: r.id, slug: r.slug, number: r.contestant_number, name: r.public_name, shortBio: r.short_bio,
    biography: r.biography, cityRegion: r.city_region, interests: r.interests ?? [], talentInfo: r.talent_info,
    socialLinks: sanitiseSocialLinks(r.social_links ?? {}), imageUrl: publicMediaUrl(r.profile_image_path),
    votingEligible: r.voting_eligible,
  };
}

/** Only allow https links to known social platforms. */
export function sanitiseSocialLinks(links: Record<string, unknown>): Record<string, string> {
  const allowed = /^https:\/\/(www\.)?(instagram\.com|facebook\.com|tiktok\.com|youtube\.com|x\.com|linkedin\.com)\//i;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(links)) {
    if (typeof v === "string" && allowed.test(v) && /^[a-z]+$/.test(k)) out[k] = v;
  }
  return out;
}

export const getPublishedContestants = cache(async (): Promise<PublicContestant[]> => {
  const db = createPublicClient();
  if (!db) return [];
  let q = db.from("contestants").select(PUBLIC_COLUMNS).eq("publication_status", "published");
  if (hideDemo()) q = q.not("slug", "like", "demo-%");
  const { data, error } = await q.order("contestant_number", { ascending: true, nullsFirst: false }).order("public_name");
  if (error) {
    console.warn(`[contestants] list: ${error.message}`);
    return [];
  }
  return (data as Row[]).map(map);
});

export const getContestantBySlug = cache(async (slug: string): Promise<PublicContestant | null> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  if (hideDemo() && slug.startsWith("demo-")) return null;
  const db = createPublicClient();
  if (!db) return null;
  const { data, error } = await db
    .from("contestants")
    .select(PUBLIC_COLUMNS)
    .eq("slug", slug)
    .eq("publication_status", "published")
    .maybeSingle();
  if (error) {
    console.warn(`[contestants] get: ${error.message}`);
    return null;
  }
  return data ? map(data as Row) : null;
});

export const getContestantGallery = cache(async (contestantId: string) => {
  const db = createPublicClient();
  if (!db) return [];
  const { data } = await db
    .from("contestant_media")
    .select("id, storage_path, alt_text, sort_order")
    .eq("contestant_id", contestantId)
    .order("sort_order");
  return (data ?? []).map((m) => ({ id: m.id as string, url: publicMediaUrl(m.storage_path as string), alt: m.alt_text as string }));
});
