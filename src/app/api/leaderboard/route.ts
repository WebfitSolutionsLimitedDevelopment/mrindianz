import { NextResponse } from "next/server";
import { getActiveCampaign, getLeaderboard, getVoteTotal } from "@/lib/voting/repo";

export const dynamic = "force-dynamic";

/** Public leaderboard (verified net votes only). Cached briefly at the edge to absorb traffic spikes. */
export async function GET() {
  const campaign = await getActiveCampaign();
  if (!campaign || !campaign.show_leaderboard) return NextResponse.json({ rows: [], total: null }, { status: 200 });
  const [rows, total] = await Promise.all([getLeaderboard(campaign.id), getVoteTotal(campaign.id)]);
  return NextResponse.json(
    { rows, total, frozen: !!campaign.leaderboard_frozen_at, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } },
  );
}
