import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/content/repo";
import { appEnv, serverEnv } from "@/lib/env";
import type { VotingStatus } from "./state";

export interface PublicCampaign {
  id: string;
  slug: string;
  name: string;
  status: VotingStatus;
  opens_at: string | null;
  closes_at: string | null;
  is_demo: boolean;
  show_leaderboard: boolean;
  show_vote_counts: boolean;
  show_rankings: boolean;
  show_supporter_history: boolean;
  leaderboard_frozen_at: string | null;
  results_published: boolean;
  refresh_interval_seconds: number;
  max_quantity_per_order: number;
  rules_version: string;
  price_note: string | null;
}

export interface PublicPackage {
  id: string;
  name: string;
  display_label: string | null;
  price_cents: number;
  votes: number;
  is_demo_value: boolean;
  max_quantity: number;
}

export interface LeaderboardRow {
  contestantId: string;
  slug: string;
  number: number | null;
  name: string;
  imageUrl: string | null;
  votes: number | null;
  rank: number | null;
}

const CAMPAIGN_COLUMNS =
  "id, slug, name, status, opens_at, closes_at, is_demo, show_leaderboard, show_vote_counts, show_rankings, show_supporter_history, leaderboard_frozen_at, results_published, refresh_interval_seconds, max_quantity_per_order, rules_version, price_note";

/** Demo voting is only ever available outside production. */
export function demoVotingAllowed(): boolean {
  return serverEnv().DEMO_VOTING_ENABLED && appEnv() !== "production";
}

export function activeCampaignSlug(): string {
  if (demoVotingAllowed()) return "demo-peoples-choice";
  return process.env.VOTING_CAMPAIGN_SLUG || "peoples-choice-2027";
}

export const getActiveCampaign = cache(async (): Promise<PublicCampaign | null> => {
  const db = createPublicClient();
  if (!db) return null;
  const { data, error } = await db.from("voting_campaigns").select(CAMPAIGN_COLUMNS).eq("slug", activeCampaignSlug()).maybeSingle();
  if (error) {
    console.warn(`[voting] campaign: ${error.message}`);
    return null;
  }
  const c = data as PublicCampaign | null;
  if (c?.is_demo && !demoVotingAllowed()) return null; // never show demo data on production
  return c;
});

export const getPackages = cache(async (campaignId: string): Promise<PublicPackage[]> => {
  const db = createPublicClient();
  if (!db) return [];
  const { data } = await db
    .from("voting_packages")
    .select("id, name, display_label, price_cents, votes, is_demo_value, max_quantity, sort_order")
    .eq("campaign_id", campaignId)
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as PublicPackage[];
});

/** Which ledger mode the public leaderboard should count in this environment. */
export function leaderboardMode(): "live" | "test" {
  const env = serverEnv();
  if (appEnv() === "production") return "live";
  return env.STRIPE_MODE === "live" ? "live" : "test";
}

export async function getLeaderboard(campaignId: string): Promise<LeaderboardRow[]> {
  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db.rpc("public_leaderboard", { p_campaign_id: campaignId, p_mode: leaderboardMode() });
  if (error) {
    console.warn(`[voting] leaderboard: ${error.message}`);
    return [];
  }
  return (data ?? []).map((r: { contestant_id: string; slug: string; contestant_number: number | null; public_name: string; profile_image_path: string | null; votes: number | null; rank: number | null }) => ({
    contestantId: r.contestant_id, slug: r.slug, number: r.contestant_number, name: r.public_name,
    imageUrl: publicMediaUrl(r.profile_image_path), votes: r.votes === null ? null : Number(r.votes), rank: r.rank === null ? null : Number(r.rank),
  }));
}

export async function getVoteTotal(campaignId: string): Promise<number | null> {
  const db = createPublicClient();
  if (!db) return null;
  const { data } = await db.rpc("public_vote_total", { p_campaign_id: campaignId, p_mode: leaderboardMode() });
  return data === null || data === undefined ? null : Number(data);
}

export async function getVotingHistory(campaignId: string) {
  const db = createPublicClient();
  if (!db) return [];
  const { data } = await db.rpc("public_voting_history", { p_campaign_id: campaignId, p_mode: leaderboardMode(), p_limit: 15 });
  return (data ?? []) as { supporter: string; contestant_name: string; contestant_slug: string; votes: number; approx_time: string }[];
}
