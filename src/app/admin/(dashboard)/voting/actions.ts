"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { createUserClient } from "@/lib/supabase/server";
import { votingCampaignSchema, votingPackageSchema } from "@/lib/validation/voting";
import { back, firstIssue } from "@/lib/admin/flash";
import { nzLocalToIso } from "@/lib/format";

const PATH = "/admin/voting";

export async function saveCampaign(formData: FormData) {
  await assertPermission("voting:configure");
  const id = String(formData.get("id"));
  const raw = Object.fromEntries(formData);
  raw.opensAt = raw.opensAt ? nzLocalToIso(String(raw.opensAt)) ?? "invalid" : "";
  raw.closesAt = raw.closesAt ? nzLocalToIso(String(raw.closesAt)) ?? "invalid" : "";
  const parsed = votingCampaignSchema.safeParse(raw);
  if (!parsed.success) back(PATH, { error: firstIssue(parsed.error) });
  const v = parsed.data;
  const db = await createUserClient();
  const { data: current } = await db.from("voting_campaigns").select("leaderboard_frozen_at, is_demo").eq("id", id).single();
  if (!current) back(PATH, { error: "Campaign not found." });
  if (v.status === "open" && !current.is_demo && !(v.opensAt && v.closesAt)) back(PATH, { error: "Set opening and closing times before opening voting." });
  const { error } = await db.from("voting_campaigns").update({
    name: v.name, status: v.status, opens_at: v.opensAt, closes_at: v.closesAt,
    show_leaderboard: v.showLeaderboard, show_vote_counts: v.showVoteCounts, show_rankings: v.showRankings, show_supporter_history: v.showSupporterHistory,
    leaderboard_frozen_at: v.freezeLeaderboard ? current.leaderboard_frozen_at ?? new Date().toISOString() : null,
    results_published: v.resultsPublished, refresh_interval_seconds: v.refreshIntervalSeconds, max_quantity_per_order: v.maxQuantityPerOrder,
    rules_version: v.rulesVersion, price_note: v.priceNote,
  }).eq("id", id);
  if (error) back(PATH, { error: "Save failed." });
  revalidatePath("/peoples-choice");
  revalidatePath("/", "layout");
  back(PATH, { ok: "Campaign saved." });
}

export async function savePackage(formData: FormData) {
  await assertPermission("voting:configure");
  const id = String(formData.get("id") ?? "");
  const campaignId = String(formData.get("campaignId"));
  const raw = Object.fromEntries(formData);
  // Admin enters dollars; convert to integer cents without floating point.
  const dollars = String(raw.price ?? "").trim();
  const m = dollars.match(/^(\d{1,5})(?:\.(\d{1,2}))?$/);
  if (!m) back(PATH, { error: "Price must be in dollars, e.g. 10 or 10.50" });
  raw.priceCents = String(Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0")));
  const parsed = votingPackageSchema.safeParse(raw);
  if (!parsed.success) back(PATH, { error: firstIssue(parsed.error) });
  const v = parsed.data;
  const row = { name: v.name, display_label: v.displayLabel, price_cents: v.priceCents, votes: v.votes, is_active: v.isActive, sort_order: v.sortOrder, max_quantity: v.maxQuantity, is_demo_value: formData.get("isDemoValue") === "on" };
  const db = await createUserClient();
  const { error } = id ? await db.from("voting_packages").update(row).eq("id", id) : await db.from("voting_packages").insert({ ...row, campaign_id: campaignId });
  if (error) back(PATH, { error: "Package save failed." });
  revalidatePath("/peoples-choice");
  back(PATH, { ok: id ? "Package updated." : "Package added." });
}
