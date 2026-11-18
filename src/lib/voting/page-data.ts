import "server-only";
import { getActiveCampaign, getLeaderboard, getPackages, getVoteTotal, getVotingHistory } from "./repo";
import { effectiveVotingState, type VotingStatus } from "./state";
import { paymentReadiness } from "@/lib/payments/config";
import type { VoteFlowPackage } from "@/components/voting/vote-flow";

export async function getVotingPageData() {
  const campaign = await getActiveCampaign();
  if (!campaign) return null;
  const state: VotingStatus = effectiveVotingState(campaign);
  const [packages, leaderboard, total, history] = await Promise.all([
    getPackages(campaign.id),
    campaign.show_leaderboard ? getLeaderboard(campaign.id) : Promise.resolve([]),
    campaign.show_leaderboard ? getVoteTotal(campaign.id) : Promise.resolve(null),
    campaign.show_supporter_history ? getVotingHistory(campaign.id) : Promise.resolve([]),
  ]);
  const flowPackages: VoteFlowPackage[] = packages.map((p) => ({
    id: p.id, name: p.name, label: p.display_label, priceCents: p.price_cents, votes: p.votes, maxQuantity: p.max_quantity, isDemoValue: p.is_demo_value,
  }));
  return { campaign, state, packages: flowPackages, leaderboard, total, history, paymentsReady: paymentReadiness().ready, demoMode: campaign.is_demo };
}
