export type VotingStatus = "draft" | "scheduled" | "open" | "paused" | "closed" | "finalised";

export interface CampaignWindow {
  status: VotingStatus;
  opens_at: string | null;
  closes_at: string | null;
}

/** The effective public state, combining the organiser-set status with the configured window. */
export function effectiveVotingState(c: CampaignWindow, now = new Date()): VotingStatus {
  const t = now.getTime();
  if (c.status === "open") {
    if (c.opens_at && t < Date.parse(c.opens_at)) return "scheduled";
    if (c.closes_at && t >= Date.parse(c.closes_at)) return "closed";
  }
  if (c.status === "scheduled" && c.opens_at && t >= Date.parse(c.opens_at) && (!c.closes_at || t < Date.parse(c.closes_at))) {
    // Scheduled campaigns do NOT auto-open; an organiser must set status to Open. Report as scheduled.
    return "scheduled";
  }
  return c.status;
}

export const VOTING_STATE_LABELS: Record<VotingStatus, string> = {
  draft: "Not yet announced",
  scheduled: "Opening soon",
  open: "Voting is open",
  paused: "Voting is paused",
  closed: "Voting has closed",
  finalised: "Final results",
};

/** Standard competition ranking (1, 2, 2, 4) — mirrors SQL rank(). */
export function competitionRanks(votes: number[]): number[] {
  return votes.map((v) => 1 + votes.filter((o) => o > v).length);
}
